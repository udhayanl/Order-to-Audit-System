import { Prisma, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface PurchaseItemInput {
  itemType: ItemType;
  rawMaterialId?: string;
  packagingMaterialId?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate?: number;
}

export class PurchaseService {
  /**
   * Record a purchase / goods receipt
   */
  static async recordPurchase(params: {
    supplierId: string;
    purchaseDate?: Date;
    items: PurchaseItemInput[];
    notes?: string;
    userId: string;
  }) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Purchase must contain at least one item.');
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: params.supplierId },
    });
    if (!supplier) throw new AppError('Supplier not found.', 404);

    return prisma.$transaction(async (tx) => {
      const count = await tx.purchase.count();
      const purchaseNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      let totalTaxable = 0;
      let totalGst = 0;
      const purchaseItemsData = [];

      for (const item of params.items) {
        const itemId = item.rawMaterialId || item.packagingMaterialId;
        if (!itemId) throw new AppError('Each purchase item must reference a raw material or packaging item.');

        const qty = item.quantity;
        const rate = item.unitPrice;
        if (qty <= 0) throw new AppError('Purchase item quantity must be greater than zero.');
        if (rate < 0) throw new AppError('Purchase item unit price cannot be negative.');
        const gstRate = item.gstRate !== undefined ? item.gstRate : 5.0;
        const taxable = Math.round(qty * rate * 100) / 100;
        const gst = Math.round((taxable * (gstRate / 100)) * 100) / 100;
        const total = Math.round((taxable + gst) * 100) / 100;

        totalTaxable += taxable;
        totalGst += gst;

        // 1. Record stock addition in StockLedger
        await InventoryService.recordMovement(tx, {
          itemType: item.itemType,
          itemId,
          movementType: StockMovementType.PURCHASE_RECEIPT,
          quantity: qty, // positive addition
          unit: item.unit,
          referenceType: 'PURCHASE',
          referenceId: purchaseNumber,
          notes: `Receipt from ${supplier.name}`,
          userId: params.userId,
        });

        // 2. Add FIFO inventory valuation layer
        await InventoryService.addValuationLayer(tx, {
          itemType: item.itemType,
          itemId,
          originalQuantity: qty,
          unitCost: rate,
          referenceType: 'PURCHASE',
          referenceId: purchaseNumber,
        });

        purchaseItemsData.push({
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId || null,
          packagingMaterialId: item.packagingMaterialId || null,
          quantity: new Prisma.Decimal(qty),
          unit: item.unit,
          unitPrice: new Prisma.Decimal(rate),
          gstRate: new Prisma.Decimal(gstRate),
          taxableAmount: new Prisma.Decimal(taxable),
          gstAmount: new Prisma.Decimal(gst),
          totalAmount: new Prisma.Decimal(total),
        });
      }

      const grandTotal = Math.round((totalTaxable + totalGst) * 100) / 100;

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: params.supplierId,
          purchaseDate: params.purchaseDate || new Date(),
          totalTaxable: new Prisma.Decimal(totalTaxable),
          totalGst: new Prisma.Decimal(totalGst),
          grandTotal: new Prisma.Decimal(grandTotal),
          status: 'RECEIVED',
          notes: params.notes || null,
          createdById: params.userId,
          items: {
            create: purchaseItemsData,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'PURCHASE',
        entityId: purchase.id,
        newValues: { purchaseNumber, supplierId: params.supplierId, grandTotal },
      });

      return purchase;
    });
  }
}
