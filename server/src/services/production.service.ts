import { Prisma, ItemType, StockMovementType, VarianceStatus } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';
import { BOMService } from './bom.service.js';

export interface ProductionItemInput {
  itemType: ItemType;
  rawMaterialId?: string;
  packagingMaterialId?: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
}

export interface PostProductionRunParams {
  bomId: string;
  plannedBatchQuantity: number;
  actualGoodOutput: number;
  damagedPouches: number;
  cartonsUsed: number;
  labourCost?: number;
  powerCost?: number;
  otherOverheads?: number;
  consumptions: ProductionItemInput[];
  notes?: string;
  userId: string;
}

export class ProductionService {
  /**
   * Calculate consumption and yield variances
   */
  static calculateVariance(actual: number, expected: number, tolerance = 3.0) {
    if (expected === 0) return { variancePercent: 0, status: VarianceStatus.NORMAL };
    const diff = actual - expected;
    const variancePercent = Math.round(((diff / expected) * 100) * 100) / 100;
    const status = Math.abs(variancePercent) > tolerance ? VarianceStatus.EXCEEDS_TOLERANCE : VarianceStatus.NORMAL;
    return { variancePercent, status, diff };
  }

  /**
   * Post production run atomically:
   * - Deducts raw materials & packaging via FIFO valuation layers and stock ledger
   * - Computes FIFO material costs + overheads
   * - Adds finished goods to inventory & valuation layer
   * - Creates production run and consumption records
   */
  static async postProductionRun(params: PostProductionRunParams) {
    const bom = await BOMService.getBOMById(params.bomId);
    const plannedCalcs = BOMService.calculatePlannedRequirements(bom, params.plannedBatchQuantity);
    const expectedOutput = plannedCalcs.expectedYield;

    const yieldVariance = this.calculateVariance(params.actualGoodOutput, expectedOutput, 3.0);

    const labourCost = params.labourCost || 0;
    const powerCost = params.powerCost || 0;
    const otherOverheads = params.otherOverheads || 0;
    const totalOverheads = labourCost + powerCost + otherOverheads;

    return prisma.$transaction(async (tx) => {
      // Generate unique Run Number e.g. PR-2026-0001
      const count = await tx.productionRun.count();
      const runNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      let totalRawMaterialCost = 0;
      let totalPackagingCost = 0;
      const consumptionRecords = [];

      // 1. Process each consumed raw material
      for (const item of params.consumptions) {
        const itemId = item.rawMaterialId || item.packagingMaterialId;
        if (!itemId) continue;

        const { variancePercent, status } = this.calculateVariance(
          item.actualQuantity,
          item.plannedQuantity,
          3.0
        );

        // Deduct inventory via FIFO layers
        const fifoResult = await InventoryService.consumeFIFOLayers(tx, {
          itemType: item.itemType,
          itemId,
          quantityToConsume: item.actualQuantity,
        });

        // Record stock ledger movement (negative quantity for issue)
        await InventoryService.recordMovement(tx, {
          itemType: item.itemType,
          itemId,
          movementType: StockMovementType.PRODUCTION_ISSUE,
          quantity: -item.actualQuantity,
          unit: item.unit,
          referenceType: 'PRODUCTION_RUN',
          referenceId: runNumber,
          notes: `Issued to ${runNumber}`,
          userId: params.userId,
        });

        if (item.itemType === ItemType.RAW_MATERIAL) {
          totalRawMaterialCost += fifoResult.totalCost;
        } else {
          totalPackagingCost += fifoResult.totalCost;
        }

        const avgUnitCost = item.actualQuantity > 0 ? fifoResult.totalCost / item.actualQuantity : 0;

        consumptionRecords.push({
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId || null,
          packagingMaterialId: item.packagingMaterialId || null,
          plannedQuantity: new Prisma.Decimal(item.plannedQuantity),
          actualQuantity: new Prisma.Decimal(item.actualQuantity),
          unit: item.unit,
          consumptionVariancePercent: new Prisma.Decimal(variancePercent),
          varianceStatus: status,
          unitCost: new Prisma.Decimal(Math.round(avgUnitCost * 100) / 100),
          totalCost: new Prisma.Decimal(fifoResult.totalCost),
        });
      }

      // Calculate total production cost & cost per good packet
      const totalMaterialCost = Math.round((totalRawMaterialCost + totalPackagingCost) * 100) / 100;
      const totalProductionCost = Math.round((totalMaterialCost + totalOverheads) * 100) / 100;
      const costPerPacket = params.actualGoodOutput > 0
        ? Math.round((totalProductionCost / params.actualGoodOutput) * 100) / 100
        : 0;

      // 2. Add finished goods to inventory & StockLedger
      await InventoryService.recordMovement(tx, {
        itemType: ItemType.FINISHED_GOOD,
        itemId: bom.productId,
        movementType: StockMovementType.PRODUCTION_OUTPUT,
        quantity: params.actualGoodOutput,
        unit: bom.yieldUnit,
        referenceType: 'PRODUCTION_RUN',
        referenceId: runNumber,
        notes: `Production output from ${runNumber}`,
        userId: params.userId,
      });

      // 3. Add valuation layer for finished goods
      await InventoryService.addValuationLayer(tx, {
        itemType: ItemType.FINISHED_GOOD,
        itemId: bom.productId,
        originalQuantity: params.actualGoodOutput,
        unitCost: costPerPacket,
        referenceType: 'PRODUCTION_RUN',
        referenceId: runNumber,
      });

      // 4. Create ProductionRun record
      const productionRun = await tx.productionRun.create({
        data: {
          runNumber,
          bomId: params.bomId,
          productId: bom.productId,
          plannedBatchQuantity: new Prisma.Decimal(params.plannedBatchQuantity),
          expectedOutput: new Prisma.Decimal(expectedOutput),
          actualGoodOutput: new Prisma.Decimal(params.actualGoodOutput),
          damagedPouches: new Prisma.Decimal(params.damagedPouches),
          cartonsUsed: new Prisma.Decimal(params.cartonsUsed),
          labourCost: new Prisma.Decimal(labourCost),
          powerCost: new Prisma.Decimal(powerCost),
          otherOverheads: new Prisma.Decimal(otherOverheads),
          totalMaterialCost: new Prisma.Decimal(totalMaterialCost),
          totalProductionCost: new Prisma.Decimal(totalProductionCost),
          costPerPacket: new Prisma.Decimal(costPerPacket),
          yieldVariancePercent: new Prisma.Decimal(yieldVariance.variancePercent),
          yieldVarianceStatus: yieldVariance.status,
          status: 'POSTED',
          notes: params.notes || null,
          createdById: params.userId,
          consumptions: {
            create: consumptionRecords,
          },
        },
        include: {
          consumptions: true,
          product: true,
          bom: true,
        },
      });

      // 5. Audit Log
      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'PRODUCTION_RUN',
        entityId: productionRun.id,
        newValues: {
          runNumber,
          actualGoodOutput: params.actualGoodOutput,
          costPerPacket,
          yieldVariancePercent: yieldVariance.variancePercent,
        },
      });

      return productionRun;
    });
  }
}
