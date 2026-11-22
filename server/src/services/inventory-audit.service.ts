import { ItemType, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface PhysicalCountItemDto {
  itemType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS';
  itemId: string;
  physicalStock: number;
  discrepancyReason?: string;
}

export class InventoryAuditService {
  /**
   * Fetch current system stock for all items to prepare audit worksheet
   */
  static async getAuditWorksheet() {
    const [rawMaterials, packagingMaterials, products] = await Promise.all([
      prisma.rawMaterial.findMany({ where: { active: true } }),
      prisma.packagingMaterial.findMany({ where: { active: true } }),
      prisma.product.findMany({ where: { active: true } }),
    ]);

    const worksheet: any[] = [];

    // 1. Raw Materials
    for (const rm of rawMaterials) {
      const currentStock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, rm.id);
      worksheet.push({
        itemType: 'RAW_MATERIAL',
        itemId: rm.id,
        itemName: rm.name,
        itemCode: rm.code,
        unit: rm.uom || 'kg',
        unitCost: Number(rm.purchasePrice || 0),
        systemStock: currentStock,
      });
    }

    // 2. Packaging Materials
    for (const pm of packagingMaterials) {
      const currentStock = await InventoryService.getCurrentStock(ItemType.PACKAGING, pm.id);
      worksheet.push({
        itemType: 'PACKAGING',
        itemId: pm.id,
        itemName: pm.name,
        itemCode: pm.code,
        unit: pm.uom || 'units',
        unitCost: Number(pm.purchasePrice || 0),
        systemStock: currentStock,
      });
    }

    // 3. Finished Goods Products
    for (const p of products) {
      const currentStock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, p.id);
      worksheet.push({
        itemType: 'FINISHED_GOODS',
        itemId: p.id,
        itemName: p.name,
        itemCode: p.sku,
        unit: p.unit || 'pkts',
        unitCost: Number(p.sellingPrice || 0) * 0.6, // Approximate standard production cost
        systemStock: currentStock,
      });
    }

    return worksheet;
  }

  /**
   * Conduct inventory audit comparison: physical stock vs system stock
   */
  static async recordInventoryAudit(
    auditSessionId: string,
    physicalCounts: PhysicalCountItemDto[],
    userId: string
  ) {
    const session = await prisma.auditSession.findUnique({
      where: { id: auditSessionId },
    });
    if (!session) throw new AppError('Audit session not found.', 404);

    const worksheet = await this.getAuditWorksheet();
    const worksheetMap = new Map<string, any>();
    worksheet.forEach(item => worksheetMap.set(`${item.itemType}_${item.itemId}`, item));

    const auditItemsToCreate: any[] = [];
    let totalDiscrepancies = 0;
    let totalVarianceValue = 0;

    for (const count of physicalCounts) {
      const key = `${count.itemType}_${count.itemId}`;
      const base = worksheetMap.get(key);
      if (!base) continue;

      const physicalStock = Number(count.physicalStock);
      const systemStock = Number(base.systemStock);
      const varianceQuantity = Math.round((physicalStock - systemStock) * 1000) / 1000;
      const unitCost = Number(base.unitCost || 0);
      const varianceValue = Math.round((varianceQuantity * unitCost) * 100) / 100;

      const isDiscrepant = Math.abs(varianceQuantity) > 0.001;
      if (isDiscrepant) {
        totalDiscrepancies++;
        totalVarianceValue += Math.abs(varianceValue);
      }

      auditItemsToCreate.push({
        auditSessionId,
        itemType: count.itemType,
        itemId: count.itemId,
        itemName: base.itemName,
        itemCode: base.itemCode,
        systemStock: new Prisma.Decimal(systemStock),
        physicalStock: new Prisma.Decimal(physicalStock),
        varianceQuantity: new Prisma.Decimal(varianceQuantity),
        unitCost: new Prisma.Decimal(unitCost),
        varianceValue: new Prisma.Decimal(varianceValue),
        discrepancyReason: count.discrepancyReason || (isDiscrepant ? 'Physical count variance detected' : null),
        status: isDiscrepant ? 'DISCREPANCY_FLAGGED' : 'MATCHED',
      });
    }

    // Delete any previous audit items for this session and replace with fresh counts
    await prisma.$transaction(async (tx) => {
      await tx.inventoryAuditItem.deleteMany({
        where: { auditSessionId },
      });

      await tx.inventoryAuditItem.createMany({
        data: auditItemsToCreate,
      });

      // If critical discrepancies detected, auto-log an audit finding
      if (totalDiscrepancies > 0) {
        const findingCount = await tx.auditFinding.count();
        const findingNumber = `FND-${new Date().getFullYear()}-${String(findingCount + 1).padStart(4, '0')}`;

        await tx.auditFinding.create({
          data: {
            auditSessionId,
            findingNumber,
            title: `Inventory Reconciliation Variance in ${session.title}`,
            category: 'INVENTORY',
            severity: totalVarianceValue > 2000 ? 'CRITICAL' : 'MAJOR',
            status: 'OPEN',
            description: `${totalDiscrepancies} stock items have variances between physical counts and system ledger with a net absolute variance of INR ${totalVarianceValue.toFixed(2)}.`,
            correctiveAction: 'Investigate physical count discrepancies, verify packaging/wastage records, and submit authorized Stock Adjustments.',
            targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
      }
    });

    await AuditService.log(prisma, {
      userId,
      action: 'INVENTORY_AUDIT',
      entityType: 'AUDIT_SESSION',
      entityId: auditSessionId,
      newValues: {
        totalItemsAudited: auditItemsToCreate.length,
        discrepanciesCount: totalDiscrepancies,
        totalVarianceValue,
      },
    });

    return {
      auditSessionId,
      totalItemsAudited: auditItemsToCreate.length,
      discrepanciesCount: totalDiscrepancies,
      totalVarianceValue,
    };
  }

  /**
   * Reconcile/resolve an inventory audit item
   */
  static async resolveAuditItem(
    itemId: string,
    reason: string,
    userId: string
  ) {
    const item = await prisma.inventoryAuditItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new AppError('Audit item not found.', 404);

    const updated = await prisma.inventoryAuditItem.update({
      where: { id: itemId },
      data: {
        status: 'RECONCILED',
        discrepancyReason: reason,
      },
    });

    await AuditService.log(prisma, {
      userId,
      action: 'RESOLVE_DISCREPANCY',
      entityType: 'INVENTORY_AUDIT_ITEM',
      entityId: itemId,
      newValues: { status: 'RECONCILED', reason },
    });

    return updated;
  }
}
