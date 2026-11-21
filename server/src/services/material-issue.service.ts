import { Prisma, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface IssueItemInput {
  itemType: ItemType;
  rawMaterialId?: string;
  packagingMaterialId?: string;
  requestedQuantity: number;
  issuedQuantity: number;
  unit: string;
}

export interface CreateMaterialIssueInput {
  productionOrderId: string;
  issueDate?: Date;
  items: IssueItemInput[];
  notes?: string;
  userId: string;
}

export class MaterialIssueService {
  /**
   * Post production material issue:
   * - Deducts stock using FIFO layers through InventoryService
   * - Appends to StockLedger
   * - Updates material reservations to CONSUMED
   */
  static async createMaterialIssue(params: CreateMaterialIssueInput) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Material issue must contain at least one item.');
    }

    const order = await prisma.productionOrder.findUnique({
      where: { id: params.productionOrderId },
      include: { product: true },
    });

    if (!order) throw new AppError('Production order not found.', 404);
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new AppError(`Cannot issue materials for production order with status '${order.status}'.`);
    }

    return prisma.$transaction(async (tx) => {
      const count = await tx.materialIssue.count();
      const issueNumber = `ISSUE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const issueItemsData = [];

      for (const item of params.items) {
        const itemId = item.rawMaterialId || item.packagingMaterialId;
        if (!itemId) throw new AppError('Each material item must reference a raw material or packaging item.');

        const issuedQty = Number(item.issuedQuantity);
        if (issuedQty <= 0) throw new AppError('Issued quantity must be greater than zero.');

        // 1. Consume FIFO valuation layer
        const fifoResult = await InventoryService.consumeFIFOLayers(tx, {
          itemType: item.itemType,
          itemId,
          quantityToConsume: issuedQty,
        });

        const totalCost = fifoResult.totalCost;
        const avgUnitCost = issuedQty > 0 ? Math.round((totalCost / issuedQty) * 100) / 100 : 0;

        // 2. Record stock OUT movement in StockLedger & InventoryBalance
        const { ledgerEntry } = await InventoryService.recordMovement(tx, {
          itemType: item.itemType,
          itemId,
          movementType: StockMovementType.PRODUCTION_ISSUE,
          quantity: -issuedQty,
          unit: item.unit,
          direction: 'OUT',
          unitRate: avgUnitCost,
          totalValue: totalCost,
          referenceType: 'MATERIAL_ISSUE',
          referenceId: issueNumber,
          notes: `Material issue for Order ${order.orderNumber}`,
          userId: params.userId,
        });

        // 3. Update active reservation for this item & order to CONSUMED
        await tx.materialReservation.updateMany({
          where: {
            productionOrderId: order.id,
            itemId,
            itemType: item.itemType,
            status: 'ACTIVE',
          },
          data: { status: 'CONSUMED' },
        });

        issueItemsData.push({
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId || null,
          packagingMaterialId: item.packagingMaterialId || null,
          requestedQuantity: new Prisma.Decimal(item.requestedQuantity),
          issuedQuantity: new Prisma.Decimal(issuedQty),
          returnedQuantity: new Prisma.Decimal(0.0),
          actualConsumedQuantity: new Prisma.Decimal(issuedQty), // Initialized to issuedQty
          unit: item.unit,
          unitCost: new Prisma.Decimal(avgUnitCost),
          totalCost: new Prisma.Decimal(totalCost),
          stockLedgerId: ledgerEntry.id,
        });
      }

      // 4. Create MaterialIssue header
      const materialIssue = await tx.materialIssue.create({
        data: {
          issueNumber,
          productionOrderId: order.id,
          issueDate: params.issueDate || new Date(),
          issuedById: params.userId,
          status: 'POSTED',
          notes: params.notes || null,
          items: {
            create: issueItemsData,
          },
        },
        include: {
          items: true,
          productionOrder: true,
          issuedBy: {
            select: { id: true, fullName: true, role: true },
          },
        },
      });

      // 5. Update production order status to IN_PROGRESS if not already
      if (order.status !== 'IN_PROGRESS') {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS' },
        });
      }

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'MATERIAL_ISSUE',
        entityId: materialIssue.id,
        newValues: { issueNumber, orderNumber: order.orderNumber, itemCount: params.items.length },
      });

      return materialIssue;
    });
  }

  /**
   * Return unused materials to inventory (increases stock & updates consumed quantity)
   */
  static async returnUnusedMaterial(params: {
    materialIssueItemId: string;
    returnedQuantity: number;
    reason?: string;
    userId: string;
  }) {
    if (params.returnedQuantity <= 0) {
      throw new AppError('Returned quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      const issueItem = await tx.materialIssueItem.findUnique({
        where: { id: params.materialIssueItemId },
        include: { materialIssue: { include: { productionOrder: true } } },
      });

      if (!issueItem) throw new AppError('Material issue item not found.', 404);

      const issued = Number(issueItem.issuedQuantity);
      const prevReturned = Number(issueItem.returnedQuantity || 0);
      const newTotalReturned = prevReturned + params.returnedQuantity;

      if (newTotalReturned > issued + 0.0001) {
        throw new AppError(
          `Returned quantity (${newTotalReturned}) cannot exceed issued quantity (${issued}).`
        );
      }

      const itemId = issueItem.rawMaterialId || issueItem.packagingMaterialId;
      if (!itemId) throw new AppError('Material reference missing.');

      const unitCost = Number(issueItem.unitCost);
      const actualConsumed = issued - newTotalReturned;

      // 1. Put returned stock back into inventory via InventoryService
      await InventoryService.receiveStock(tx, {
        itemType: issueItem.itemType,
        itemId,
        movementType: StockMovementType.PRODUCTION_ISSUE, // Compensatory positive adjustment
        quantity: params.returnedQuantity,
        unit: issueItem.unit,
        unitCost,
        referenceType: 'MATERIAL_RETURN',
        referenceId: issueItem.materialIssue.issueNumber,
        notes: `Returned unused from ${issueItem.materialIssue.issueNumber}: ${params.reason || 'Excess returned'}`,
        userId: params.userId,
      });

      // 2. Update issue item returned & actualConsumed quantities
      const updated = await tx.materialIssueItem.update({
        where: { id: issueItem.id },
        data: {
          returnedQuantity: new Prisma.Decimal(newTotalReturned),
          actualConsumedQuantity: new Prisma.Decimal(actualConsumed),
          totalCost: new Prisma.Decimal(Math.round(actualConsumed * unitCost * 100) / 100),
        },
      });

      return updated;
    });
  }

  /**
   * List all material issues with optional filters
   */
  static async getMaterialIssues(filters?: { productionOrderId?: string }) {
    const where: any = {};
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;

    return prisma.materialIssue.findMany({
      where,
      include: {
        productionOrder: {
          include: { product: true },
        },
        items: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
        issuedBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  }
}
