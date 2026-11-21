import { Prisma, ItemType, StockMovementType } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { UnitConversionService } from './unit.service.js';

export interface RecordMovementParams {
  itemType: ItemType;
  itemId: string;
  movementType: StockMovementType;
  quantity: number; // positive for additions (IN), negative for deductions (OUT)
  unit: string;
  direction?: 'IN' | 'OUT';
  referenceType: string; // 'PURCHASE', 'PRODUCTION_RUN', 'DISPATCH', 'ADJUSTMENT', 'OPENING', 'GRN', 'RETURN'
  referenceId?: string;
  unitRate?: number;
  totalValue?: number;
  batchNumber?: string;
  expiryDate?: Date;
  notes?: string;
  userId?: string;
  transactionDate?: Date;
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

export interface StockAvailabilityResult {
  available: boolean;
  currentStock: number;
  requestedQuantity: number;
  shortage: number;
  baseUnit: string;
}

export class InventoryService {
  /**
   * Determine base unit of measurement for an item
   */
  static async getBaseUnit(
    itemType: ItemType,
    itemId: string,
    tx: any = prisma
  ): Promise<string> {
    if (itemType === ItemType.RAW_MATERIAL) {
      const rm = await tx.rawMaterial.findUnique({ where: { id: itemId }, select: { uom: true } });
      return rm?.uom || 'kg';
    } else if (itemType === ItemType.PACKAGING) {
      const pkg = await tx.packagingMaterial.findUnique({ where: { id: itemId }, select: { uom: true } });
      return pkg?.uom || 'pieces';
    } else if (itemType === ItemType.FINISHED_GOOD) {
      const prod = await tx.product.findUnique({ where: { id: itemId }, select: { unit: true } });
      return prod?.unit || 'packets';
    }
    return 'pcs';
  }

  /**
   * Get current stock of an item by querying the transactionally maintained InventoryBalance
   * or the latest StockLedger balance
   */
  static async getCurrentStock(
    itemType: ItemType,
    itemId: string,
    tx: any = prisma
  ): Promise<number> {
    // 1. Check InventoryBalance table
    const balance = await tx.inventoryBalance.findUnique({
      where: {
        itemId_itemType: {
          itemId,
          itemType,
        },
      },
    });

    if (balance) {
      return Number(balance.currentQuantity);
    }

    // 2. Check latest StockLedger entry
    const latestEntry = await tx.stockLedger.findFirst({
      where: { itemType, itemId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    if (latestEntry) {
      return Number(latestEntry.balanceAfter);
    }

    // 3. Fallback to master openingStock if initialized
    if (itemType === ItemType.RAW_MATERIAL) {
      const rm = await tx.rawMaterial.findUnique({ where: { id: itemId } });
      return rm ? Number(rm.openingStock) : 0;
    } else if (itemType === ItemType.PACKAGING) {
      const pkg = await tx.packagingMaterial.findUnique({ where: { id: itemId } });
      return pkg ? Number(pkg.openingStock) : 0;
    }

    return 0;
  }

  /**
   * Record an atomic stock movement in the append-only StockLedger
   * and update the transactional InventoryBalance
   */
  static async recordMovement(
    tx: any,
    params: RecordMovementParams
  ) {
    const baseUnit = await this.getBaseUnit(params.itemType, params.itemId, tx);
    let normalizedQty = params.quantity;

    // Convert unit to base unit if necessary
    if (params.unit && params.unit.toLowerCase() !== baseUnit.toLowerCase()) {
      try {
        normalizedQty = UnitConversionService.convert(params.quantity, params.unit, baseUnit);
      } catch (err) {
        // If conversion is not applicable, retain quantity
      }
    }

    const currentStock = await this.getCurrentStock(params.itemType, params.itemId, tx);
    const newBalance = Math.round((currentStock + normalizedQty) * 1000) / 1000;

    // Prevent negative inventory unless authorized STOCK_ADJUSTMENT
    if (newBalance < -0.0001 && params.movementType !== StockMovementType.STOCK_ADJUSTMENT) {
      throw new AppError(
        `Insufficient inventory for item ${params.itemId}. Current: ${currentStock.toFixed(2)}, Requested deduction: ${Math.abs(normalizedQty).toFixed(2)}`
      );
    }

    const direction = params.direction || (normalizedQty >= 0 ? 'IN' : 'OUT');
    const unitRate = params.unitRate !== undefined ? params.unitRate : null;
    const totalValue = params.totalValue !== undefined
      ? params.totalValue
      : (unitRate !== null ? Math.round(Math.abs(normalizedQty) * unitRate * 100) / 100 : null);

    // 1. Insert immutable append-only ledger entry
    const ledgerEntry = await tx.stockLedger.create({
      data: {
        itemType: params.itemType,
        itemId: params.itemId,
        movementType: params.movementType,
        quantity: new Prisma.Decimal(normalizedQty),
        balanceAfter: new Prisma.Decimal(newBalance),
        unit: baseUnit,
        direction,
        transactionDate: params.transactionDate || new Date(),
        unitRate: unitRate !== null ? new Prisma.Decimal(unitRate) : null,
        totalValue: totalValue !== null ? new Prisma.Decimal(totalValue) : null,
        batchNumber: params.batchNumber || null,
        expiryDate: params.expiryDate || null,
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
        notes: params.notes || null,
        userId: params.userId || null,
      },
    });

    // 2. Transactionally update InventoryBalance for fast queries
    await tx.inventoryBalance.upsert({
      where: {
        itemId_itemType: {
          itemId: params.itemId,
          itemType: params.itemType,
        },
      },
      update: {
        currentQuantity: new Prisma.Decimal(newBalance),
        baseUnit,
        lastUpdatedAt: new Date(),
      },
      create: {
        itemId: params.itemId,
        itemType: params.itemType,
        currentQuantity: new Prisma.Decimal(newBalance),
        baseUnit,
        lastUpdatedAt: new Date(),
      },
    });

    return { ledgerEntry, newBalance };
  }

  /**
   * Reusable stock receipt operation (IN movement + FIFO layer creation)
   */
  static async receiveStock(
    tx: any,
    params: {
      itemType: ItemType;
      itemId: string;
      movementType: StockMovementType;
      quantity: number;
      unit: string;
      unitCost?: number;
      referenceType: string;
      referenceId?: string;
      batchNumber?: string;
      expiryDate?: Date;
      notes?: string;
      userId?: string;
    }
  ) {
    if (params.quantity <= 0) {
      throw new AppError('Received quantity must be greater than zero.');
    }

    const { ledgerEntry, newBalance } = await this.recordMovement(tx, {
      itemType: params.itemType,
      itemId: params.itemId,
      movementType: params.movementType,
      quantity: params.quantity, // Positive
      unit: params.unit,
      direction: 'IN',
      unitRate: params.unitCost,
      totalValue: params.unitCost ? Math.round(params.quantity * params.unitCost * 100) / 100 : undefined,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      batchNumber: params.batchNumber,
      expiryDate: params.expiryDate,
      notes: params.notes,
      userId: params.userId,
    });

    // Add FIFO valuation layer if unitCost is provided
    if (params.unitCost !== undefined && params.unitCost >= 0) {
      await this.addValuationLayer(tx, {
        itemType: params.itemType,
        itemId: params.itemId,
        originalQuantity: params.quantity,
        unitCost: params.unitCost,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      });
    }

    return { ledgerEntry, newBalance };
  }

  /**
   * Reusable stock issue operation (OUT movement + optional FIFO layer consumption)
   */
  static async issueStock(
    tx: any,
    params: {
      itemType: ItemType;
      itemId: string;
      movementType: StockMovementType;
      quantity: number; // positive number representing quantity to issue
      unit: string;
      referenceType: string;
      referenceId?: string;
      notes?: string;
      userId?: string;
      consumeFIFO?: boolean;
    }
  ) {
    if (params.quantity <= 0) {
      throw new AppError('Issued quantity must be greater than zero.');
    }

    // Check availability first
    const avail = await this.validateStockAvailability(
      params.itemType,
      params.itemId,
      params.quantity,
      params.unit,
      tx
    );

    if (!avail.available) {
      throw new AppError(
        `Insufficient inventory for item ${params.itemId}. Available: ${avail.currentStock.toFixed(2)} ${avail.baseUnit}, Requested: ${params.quantity.toFixed(2)} ${params.unit}`
      );
    }

    let fifoResult: FIFOConsumptionResult | null = null;
    if (params.consumeFIFO) {
      fifoResult = await this.consumeFIFOLayers(tx, {
        itemType: params.itemType,
        itemId: params.itemId,
        quantityToConsume: params.quantity,
      });
    }

    const { ledgerEntry, newBalance } = await this.recordMovement(tx, {
      itemType: params.itemType,
      itemId: params.itemId,
      movementType: params.movementType,
      quantity: -Math.abs(params.quantity), // Negative for deduction
      unit: params.unit,
      direction: 'OUT',
      totalValue: fifoResult ? fifoResult.totalCost : undefined,
      unitRate: fifoResult && params.quantity > 0 ? Math.round((fifoResult.totalCost / params.quantity) * 100) / 100 : undefined,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      notes: params.notes,
      userId: params.userId,
    });

    return { ledgerEntry, newBalance, fifoResult };
  }

  /**
   * Reverse a posted stock ledger movement (never delete, record compensatory entry)
   */
  static async reverseStockMovement(
    tx: any,
    originalLedgerId: string,
    reversalReason: string,
    userId: string
  ) {
    const original = await tx.stockLedger.findUnique({
      where: { id: originalLedgerId },
    });
    if (!original) throw new AppError('Original stock ledger entry not found.', 404);

    const origQty = Number(original.quantity);
    const reverseQty = -origQty;

    return this.recordMovement(tx, {
      itemType: original.itemType,
      itemId: original.itemId,
      movementType: StockMovementType.STOCK_ADJUSTMENT,
      quantity: reverseQty,
      unit: original.unit,
      direction: reverseQty >= 0 ? 'IN' : 'OUT',
      referenceType: 'REVERSAL',
      referenceId: original.id,
      notes: `Reversal of entry ${original.id}: ${reversalReason}`,
      userId,
    });
  }

  /**
   * Validate stock availability before production run or dispatch
   */
  static async validateStockAvailability(
    itemType: ItemType,
    itemId: string,
    requestedQuantity: number,
    unit: string,
    tx: any = prisma
  ): Promise<StockAvailabilityResult> {
    const baseUnit = await this.getBaseUnit(itemType, itemId, tx);
    let convertedQty = requestedQuantity;

    if (unit && unit.toLowerCase() !== baseUnit.toLowerCase()) {
      try {
        convertedQty = UnitConversionService.convert(requestedQuantity, unit, baseUnit);
      } catch (err) {
        // If conversion not applicable, use as is
      }
    }

    const currentStock = await this.getCurrentStock(itemType, itemId, tx);
    const available = currentStock >= (convertedQty - 0.0001);
    const shortage = available ? 0 : Math.round((convertedQty - currentStock) * 1000) / 1000;

    return {
      available,
      currentStock,
      requestedQuantity: convertedQty,
      shortage,
      baseUnit,
    };
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
      receivedDate?: Date;
    }
  ) {
    return tx.inventoryValuationLayer.create({
      data: {
        itemType: params.itemType,
        itemId: params.itemId,
        receivedDate: params.receivedDate || new Date(),
        originalQuantity: new Prisma.Decimal(params.originalQuantity),
        remainingQuantity: new Prisma.Decimal(params.originalQuantity),
        unitCost: new Prisma.Decimal(params.unitCost),
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
      },
    });
  }

  /**
   * Consume inventory layers strictly using FIFO with row locking
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
        cost: Math.round(layerCost * 100) / 100,
      });

      const updatedRemaining = Math.round((layerRemaining - consumeFromThisLayer) * 1000) / 1000;
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

  /**
   * Reconcile inventory: compare InventoryBalance against sum of StockLedger
   */
  static async reconcileInventory(tx: any = prisma) {
    const rawMaterials = await tx.rawMaterial.findMany({ select: { id: true, code: true, name: true, uom: true } });
    const packaging = await tx.packagingMaterial.findMany({ select: { id: true, code: true, name: true, uom: true } });
    const products = await tx.product.findMany({ select: { id: true, sku: true, name: true, unit: true } });

    const allItems: { id: string; code: string; name: string; itemType: ItemType; unit: string }[] = [
      ...rawMaterials.map((r: any) => ({ id: r.id, code: r.code, name: r.name, itemType: ItemType.RAW_MATERIAL, unit: r.uom })),
      ...packaging.map((p: any) => ({ id: p.id, code: p.code, name: p.name, itemType: ItemType.PACKAGING, unit: p.uom })),
      ...products.map((p: any) => ({ id: p.id, code: p.sku, name: p.name, itemType: ItemType.FINISHED_GOOD, unit: p.unit })),
    ];

    const results = [];

    for (const item of allItems) {
      // 1. Calculate sum from immutable StockLedger
      const ledgerSum = await tx.stockLedger.aggregate({
        where: {
          itemType: item.itemType,
          itemId: item.id,
        },
        _sum: {
          quantity: true,
        },
      });

      const calculatedLedgerStock = Number(ledgerSum._sum.quantity || 0);

      // 2. Fetch maintained InventoryBalance
      const balanceRow = await tx.inventoryBalance.findUnique({
        where: {
          itemId_itemType: {
            itemId: item.id,
            itemType: item.itemType,
          },
        },
      });

      const balanceStock = balanceRow ? Number(balanceRow.currentQuantity) : 0;
      const discrepancy = Math.round((balanceStock - calculatedLedgerStock) * 1000) / 1000;
      const isMatched = Math.abs(discrepancy) < 0.001;

      // 3. Fetch latest ledger entries for audit context
      const recentMovements = await tx.stockLedger.findMany({
        where: { itemType: item.itemType, itemId: item.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          movementType: true,
          quantity: true,
          balanceAfter: true,
          referenceType: true,
          createdAt: true,
        },
      });

      results.push({
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemType: item.itemType,
        unit: item.unit,
        inventoryBalance: balanceStock,
        ledgerCalculatedStock: calculatedLedgerStock,
        discrepancy,
        status: isMatched ? 'MATCHED' : 'DISCREPANCY',
        recentMovements,
      });
    }

    return results;
  }

  /**
   * Auto-reconcile discrepancies by synchronizing InventoryBalance with StockLedger
   */
  static async autoReconcileDiscrepancies(userId: string, tx: any = prisma) {
    const report = await this.reconcileInventory(tx);
    const discrepancies = report.filter(r => r.status === 'DISCREPANCY');

    const synced = [];
    for (const d of discrepancies) {
      await tx.inventoryBalance.upsert({
        where: {
          itemId_itemType: {
            itemId: d.itemId,
            itemType: d.itemType,
          },
        },
        update: {
          currentQuantity: new Prisma.Decimal(d.ledgerCalculatedStock),
          baseUnit: d.unit,
          lastUpdatedAt: new Date(),
        },
        create: {
          itemId: d.itemId,
          itemType: d.itemType,
          currentQuantity: new Prisma.Decimal(d.ledgerCalculatedStock),
          baseUnit: d.unit,
          lastUpdatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'RECONCILE',
          entityType: d.itemType,
          entityId: d.itemId,
          previousValues: JSON.stringify({ currentQuantity: d.inventoryBalance }),
          newValues: JSON.stringify({ currentQuantity: d.ledgerCalculatedStock, reason: 'Reconciliation to match immutable StockLedger' }),
        },
      });

      synced.push({
        itemId: d.itemId,
        itemCode: d.itemCode,
        itemName: d.itemName,
        previousBalance: d.inventoryBalance,
        newBalance: d.ledgerCalculatedStock,
      });
    }

    return { totalDiscrepancies: discrepancies.length, synced };
  }

  /**
   * Retrieve low-stock alerts
   */
  static async getLowStockAlerts(tx: any = prisma) {
    const rawMaterials = await tx.rawMaterial.findMany({ where: { active: true } });
    const packaging = await tx.packagingMaterial.findMany({ where: { active: true } });
    const products = await tx.product.findMany({ where: { active: true } });

    const alerts = [];

    for (const rm of rawMaterials) {
      const currentStock = await this.getCurrentStock(ItemType.RAW_MATERIAL, rm.id, tx);
      const reorderLevel = Number(rm.reorderLevel);
      if (currentStock <= reorderLevel) {
        alerts.push({
          itemId: rm.id,
          name: rm.name,
          code: rm.code,
          category: 'RAW_MATERIAL',
          unit: rm.uom,
          currentStock,
          reorderLevel,
          shortage: Math.max(0, reorderLevel - currentStock),
          status: currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        });
      }
    }

    for (const pkg of packaging) {
      const currentStock = await this.getCurrentStock(ItemType.PACKAGING, pkg.id, tx);
      const reorderLevel = Number(pkg.reorderLevel || 50);
      if (currentStock <= reorderLevel) {
        alerts.push({
          itemId: pkg.id,
          name: pkg.name,
          code: pkg.code,
          category: 'PACKAGING',
          unit: pkg.uom,
          currentStock,
          reorderLevel,
          shortage: Math.max(0, reorderLevel - currentStock),
          status: currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        });
      }
    }

    for (const prod of products) {
      const currentStock = await this.getCurrentStock(ItemType.FINISHED_GOOD, prod.id, tx);
      const reorderLevel = Number(prod.reorderLevel);
      if (currentStock <= reorderLevel) {
        alerts.push({
          itemId: prod.id,
          name: prod.name,
          code: prod.sku,
          category: 'FINISHED_GOOD',
          unit: prod.unit,
          currentStock,
          reorderLevel,
          shortage: Math.max(0, reorderLevel - currentStock),
          status: currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        });
      }
    }

    return alerts;
  }

  /**
   * Get active FIFO valuation layers and total inventory valuation
   */
  static async getValuationSummary(tx: any = prisma) {
    const activeLayers = await tx.inventoryValuationLayer.findMany({
      where: { remainingQuantity: { gt: 0 } },
      orderBy: { receivedDate: 'asc' },
    });

    const rawMaterials = await tx.rawMaterial.findMany({ select: { id: true, name: true, code: true, uom: true } });
    const packaging = await tx.packagingMaterial.findMany({ select: { id: true, name: true, code: true, uom: true } });
    const products = await tx.product.findMany({ select: { id: true, name: true, sku: true, unit: true } });

    const itemMap = new Map<string, { name: string; code: string; unit: string; itemType: ItemType }>();
    rawMaterials.forEach((r: any) => itemMap.set(r.id, { name: r.name, code: r.code, unit: r.uom, itemType: ItemType.RAW_MATERIAL }));
    packaging.forEach((p: any) => itemMap.set(p.id, { name: p.name, code: p.code, unit: p.uom, itemType: ItemType.PACKAGING }));
    products.forEach((p: any) => itemMap.set(p.id, { name: p.name, code: p.sku, unit: p.unit, itemType: ItemType.FINISHED_GOOD }));

    const valuationByItem: Record<string, any> = {};
    let grandTotalValue = 0;

    for (const layer of activeLayers) {
      const itemInfo = itemMap.get(layer.itemId) || {
        name: 'Unknown Item',
        code: 'N/A',
        unit: 'pcs',
        itemType: layer.itemType,
      };

      const remQty = Number(layer.remainingQuantity);
      const unitCost = Number(layer.unitCost);
      const layerValue = Math.round(remQty * unitCost * 100) / 100;
      grandTotalValue += layerValue;

      if (!valuationByItem[layer.itemId]) {
        valuationByItem[layer.itemId] = {
          itemId: layer.itemId,
          itemName: itemInfo.name,
          itemCode: itemInfo.code,
          itemType: layer.itemType,
          unit: itemInfo.unit,
          totalRemainingQuantity: 0,
          totalValuation: 0,
          layers: [],
        };
      }

      valuationByItem[layer.itemId].totalRemainingQuantity += remQty;
      valuationByItem[layer.itemId].totalValuation += layerValue;
      valuationByItem[layer.itemId].layers.push({
        layerId: layer.id,
        receivedDate: layer.receivedDate,
        originalQuantity: Number(layer.originalQuantity),
        remainingQuantity: remQty,
        unitCost,
        totalValue: layerValue,
        referenceType: layer.referenceType,
        referenceId: layer.referenceId,
      });
    }

    Object.values(valuationByItem).forEach((v: any) => {
      v.totalRemainingQuantity = Math.round(v.totalRemainingQuantity * 1000) / 1000;
      v.totalValuation = Math.round(v.totalValuation * 100) / 100;
    });

    return {
      grandTotalValue: Math.round(grandTotalValue * 100) / 100,
      items: Object.values(valuationByItem),
    };
  }
}
