import { Prisma, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

export interface RecordMovementParams {
  itemType: ItemType;
  itemId: string;
  movementType: StockMovementType;
  quantity: number; // positive for additions, negative for deductions
  unit: string;
  referenceType: string;
  referenceId?: string;
  notes?: string;
  userId?: string;
}

export interface FIFOConsumptionResult {
  totalCost: number;
  layersConsumed: {
    layerId: string;
    quantity: number;
    unitCost: number;
    cost: number;
  }[];
}

export class InventoryService {
  /**
   * Get current stock of an item by querying the latest stock ledger balance
   */
  static async getCurrentStock(
    itemType: ItemType,
    itemId: string,
    tx: any = prisma
  ): Promise<number> {
    const latestEntry = await tx.stockLedger.findFirst({
      where: { itemType, itemId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    if (latestEntry) {
      return Number(latestEntry.balanceAfter);
    }

    // If no ledger entry yet, check openingStock in master table
    if (itemType === ItemType.RAW_MATERIAL) {
      const rm = await tx.rawMaterial.findUnique({ where: { id: itemId } });
      return rm ? Number(rm.openingStock) : 0;
    } else if (itemType === ItemType.PACKAGING) {
      const pkg = await tx.packagingMaterial.findUnique({ where: { id: itemId } });
      return pkg ? Number(pkg.openingStock) : 0;
    } else if (itemType === ItemType.FINISHED_GOOD) {
      return 0;
    }

    return 0;
  }

  /**
   * Record a stock movement in the immutable StockLedger
   */
  static async recordMovement(
    tx: any,
    params: RecordMovementParams
  ) {
    const currentStock = await this.getCurrentStock(params.itemType, params.itemId, tx);
    const newBalance = currentStock + params.quantity;

    // Prevent negative inventory unless authorized STOCK_ADJUSTMENT
    if (newBalance < -0.0001 && params.movementType !== StockMovementType.STOCK_ADJUSTMENT) {
      throw new AppError(
        `Insufficient inventory for item ${params.itemId}. Current: ${currentStock.toFixed(2)}, Requested deduction: ${Math.abs(params.quantity).toFixed(2)}`
      );
    }

    const ledgerEntry = await tx.stockLedger.create({
      data: {
        itemType: params.itemType,
        itemId: params.itemId,
        movementType: params.movementType,
        quantity: new Prisma.Decimal(params.quantity),
        balanceAfter: new Prisma.Decimal(newBalance),
        unit: params.unit,
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
        notes: params.notes || null,
        userId: params.userId || null,
      },
    });

    return { ledgerEntry, newBalance };
  }

  /**
   * Add a FIFO valuation layer upon purchase receipt or opening balance
   */
  static async addValuationLayer(
    tx: any,
    params: {
      itemType: ItemType;
      itemId: string;
      originalQuantity: number;
      unitCost: number;
      referenceType: string;
      referenceId?: string;
    }
  ) {
    return tx.inventoryValuationLayer.create({
      data: {
        itemType: params.itemType,
        itemId: params.itemId,
        originalQuantity: new Prisma.Decimal(params.originalQuantity),
        remainingQuantity: new Prisma.Decimal(params.originalQuantity),
        unitCost: new Prisma.Decimal(params.unitCost),
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
      },
    });
  }

  /**
   * Consume inventory layers strictly using FIFO
   */
  static async consumeFIFOLayers(
    tx: any,
    params: {
      itemType: ItemType;
      itemId: string;
      quantityToConsume: number;
    }
  ): Promise<FIFOConsumptionResult> {
    const layers = await tx.inventoryValuationLayer.findMany({
      where: {
        itemType: params.itemType,
        itemId: params.itemId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { receivedDate: 'asc' },
    });

    let needed = params.quantityToConsume;
    let totalCost = 0;
    const layersConsumed = [];

    for (const layer of layers) {
      if (needed <= 0.00001) break;

      const layerRemaining = Number(layer.remainingQuantity);
      const layerUnitCost = Number(layer.unitCost);
      const consumeFromThisLayer = Math.min(layerRemaining, needed);
      const layerCost = consumeFromThisLayer * layerUnitCost;

      totalCost += layerCost;
      needed -= consumeFromThisLayer;

      layersConsumed.push({
        layerId: layer.id,
        quantity: consumeFromThisLayer,
        unitCost: layerUnitCost,
        cost: layerCost,
      });

      const updatedRemaining = layerRemaining - consumeFromThisLayer;
      await tx.inventoryValuationLayer.update({
        where: { id: layer.id },
        data: {
          remainingQuantity: new Prisma.Decimal(updatedRemaining),
        },
      });
    }

    if (needed > 0.0001) {
      throw new AppError(
        `FIFO layer depletion: Insufficient valuation layers for item ${params.itemId}. Shortfall: ${needed.toFixed(2)} units.`
      );
    }

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      layersConsumed,
    };
  }
}
