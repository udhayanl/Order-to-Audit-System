import { ItemType, StockMovementType, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';

export interface OpeningStockItemInput {
  itemType: ItemType;
  itemId: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  notes?: string;
}

export class OpeningStockService {
  /**
   * Initialize opening stock for a set of items (idempotent check)
   */
  static async initializeOpeningStock(params: {
    items: OpeningStockItemInput[];
    notes?: string;
    userId: string;
  }) {
    if (!params.items || params.items.length === 0) {
      throw new AppError('Opening stock initialization must contain at least one item.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Generate unique OpeningStockRecord number
      const count = await tx.openingStockRecord.count();
      const recordNumber = `OPN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // 2. Check for duplicate opening stock initialization
      for (const item of params.items) {
        const existingOpening = await tx.stockLedger.findFirst({
          where: {
            itemType: item.itemType,
            itemId: item.itemId,
            movementType: StockMovementType.OPENING_BALANCE,
          },
        });

        if (existingOpening) {
          throw new AppError(
            `Opening stock has already been initialized for ${item.itemType} item '${item.itemId}'. Duplicate initialization is prevented.`
          );
        }
      }

      // 3. Create document record
      const openingRecord = await tx.openingStockRecord.create({
        data: {
          recordNumber,
          notes: params.notes || 'Master opening inventory setup',
          status: 'POSTED',
          createdById: params.userId,
        },
      });

      const initializedItems = [];

      // 4. Record stock movements and FIFO valuation layers
      for (const item of params.items) {
        if (item.quantity <= 0) {
          throw new AppError('Opening stock quantity must be greater than zero.');
        }

        const { ledgerEntry, newBalance } = await InventoryService.receiveStock(tx, {
          itemType: item.itemType,
          itemId: item.itemId,
          movementType: StockMovementType.OPENING_BALANCE,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          referenceType: 'OPENING',
          referenceId: recordNumber,
          notes: item.notes || `Initial opening stock (${recordNumber})`,
          userId: params.userId,
        });

        // Also update master openingStock field for consistency
        if (item.itemType === ItemType.RAW_MATERIAL) {
          await tx.rawMaterial.update({
            where: { id: item.itemId },
            data: { openingStock: new Prisma.Decimal(item.quantity) },
          });
        } else if (item.itemType === ItemType.PACKAGING) {
          await tx.packagingMaterial.update({
            where: { id: item.itemId },
            data: { openingStock: new Prisma.Decimal(item.quantity) },
          });
        }

        initializedItems.push({
          itemId: item.itemId,
          itemType: item.itemType,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          balanceAfter: newBalance,
          ledgerId: ledgerEntry.id,
        });
      }

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'OPENING_STOCK',
        entityId: openingRecord.id,
        newValues: { recordNumber, itemCount: params.items.length },
      });

      return {
        openingRecord,
        items: initializedItems,
      };
    });
  }

  /**
   * Get all opening stock records
   */
  static async getOpeningStockRecords() {
    return prisma.openingStockRecord.findMany({
      include: {
        createdBy: {
          select: { id: true, fullName: true, role: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
