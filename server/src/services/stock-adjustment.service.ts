import { ItemType, StockMovementType, StockAdjustmentType, StockAdjustmentStatus, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface CreateAdjustmentInput {
  itemId: string;
  itemType: ItemType;
  adjustmentType: StockAdjustmentType;
  physicalQuantity: number;
  reason: string;
  notes?: string;
  autoApprove?: boolean;
}

export class StockAdjustmentService {
  /**
   * Create a new stock adjustment request
   */
  static async createAdjustment(params: CreateAdjustmentInput, userId: string) {
    const systemQuantity = await InventoryService.getCurrentStock(params.itemType, params.itemId);
    const unit = await InventoryService.getBaseUnit(params.itemType, params.itemId);
    const difference = Math.round((params.physicalQuantity - systemQuantity) * 1000) / 1000;

    if (Math.abs(difference) < 0.0001) {
      throw new AppError('Physical quantity equals system quantity. No adjustment difference detected.');
    }

    return prisma.$transaction(async (tx) => {
      const count = await tx.stockAdjustment.count();
      const adjustmentNumber = `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const status = params.autoApprove ? StockAdjustmentStatus.POSTED : StockAdjustmentStatus.PENDING_APPROVAL;
      const approvedAt = params.autoApprove ? new Date() : null;
      const postedAt = params.autoApprove ? new Date() : null;
      const approvedById = params.autoApprove ? userId : null;

      const adjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          itemId: params.itemId,
          itemType: params.itemType,
          adjustmentType: params.adjustmentType,
          systemQuantity: new Prisma.Decimal(systemQuantity),
          physicalQuantity: new Prisma.Decimal(params.physicalQuantity),
          difference: new Prisma.Decimal(difference),
          unit,
          reason: params.reason,
          status,
          createdById: userId,
          approvedById,
          approvedAt,
          postedAt,
          notes: params.notes || null,
        },
      });

      // If auto-approved, immediately post stock ledger entry
      if (params.autoApprove) {
        await InventoryService.recordMovement(tx, {
          itemType: params.itemType,
          itemId: params.itemId,
          movementType: StockMovementType.STOCK_ADJUSTMENT,
          quantity: difference,
          unit,
          referenceType: 'ADJUSTMENT',
          referenceId: adjustmentNumber,
          notes: `Stock adjustment: ${params.reason}`,
          userId,
        });
      }

      await AuditService.log(tx, {
        userId,
        action: params.autoApprove ? 'APPROVE_ADJUSTMENT' : 'CREATE_ADJUSTMENT',
        entityType: 'STOCK_ADJUSTMENT',
        entityId: adjustment.id,
        newValues: { adjustmentNumber, systemQuantity, physicalQuantity: params.physicalQuantity, difference, status },
      });

      return adjustment;
    });
  }

  /**
   * Approve and post a pending stock adjustment
   */
  static async approveAdjustment(adjustmentId: string, approvedById: string) {
    return prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.findUnique({
        where: { id: adjustmentId },
      });

      if (!adjustment) {
        throw new AppError('Stock adjustment not found.', 404);
      }

      if (adjustment.status !== StockAdjustmentStatus.PENDING_APPROVAL) {
        throw new AppError(`Cannot approve adjustment with status '${adjustment.status}'.`);
      }

      const difference = Number(adjustment.difference);

      // Post to StockLedger
      await InventoryService.recordMovement(tx, {
        itemType: adjustment.itemType,
        itemId: adjustment.itemId,
        movementType: StockMovementType.STOCK_ADJUSTMENT,
        quantity: difference,
        unit: adjustment.unit,
        referenceType: 'ADJUSTMENT',
        referenceId: adjustment.adjustmentNumber,
        notes: `Approved adjustment: ${adjustment.reason}`,
        userId: approvedById,
      });

      const updated = await tx.stockAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: StockAdjustmentStatus.POSTED,
          approvedById,
          approvedAt: new Date(),
          postedAt: new Date(),
        },
      });

      await AuditService.log(tx, {
        userId: approvedById,
        action: 'APPROVE_ADJUSTMENT',
        entityType: 'STOCK_ADJUSTMENT',
        entityId: adjustment.id,
        newValues: { status: StockAdjustmentStatus.POSTED, approvedById, difference },
      });

      return updated;
    });
  }

  /**
   * Reject a pending stock adjustment
   */
  static async rejectAdjustment(adjustmentId: string, rejectedById: string, reason: string) {
    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id: adjustmentId },
    });

    if (!adjustment) throw new AppError('Stock adjustment not found.', 404);
    if (adjustment.status !== StockAdjustmentStatus.PENDING_APPROVAL) {
      throw new AppError(`Cannot reject adjustment with status '${adjustment.status}'.`);
    }

    return prisma.stockAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: StockAdjustmentStatus.REJECTED,
        approvedById: rejectedById,
        notes: adjustment.notes ? `${adjustment.notes} | Rejected: ${reason}` : `Rejected: ${reason}`,
      },
    });
  }

  /**
   * List all adjustments
   */
  static async getAdjustments(filters?: { itemType?: ItemType; status?: StockAdjustmentStatus }) {
    const where: any = {};
    if (filters?.itemType) where.itemType = filters.itemType;
    if (filters?.status) where.status = filters.status;

    return prisma.stockAdjustment.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true, role: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, role: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
