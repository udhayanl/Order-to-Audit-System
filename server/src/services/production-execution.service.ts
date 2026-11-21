import { Prisma, ItemType, StockMovementType, VarianceStatus } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { InventoryService } from './inventory.service.js';
import { AuditService } from './audit.service.js';
import { ProductionService } from './production.service.js';

export interface StartExecutionInput {
  productionOrderId: string;
  batchNumber?: string;
  lineOrWorkstation?: string;
  supervisorId?: string;
  notes?: string;
  userId: string;
}

export interface PostProductionOutputInput {
  productionOrderId: string;
  productionExecutionId?: string;
  batchNumber?: string;
  goodPackets: number;
  rejectedPackets?: number;
  damagedPackets?: number;
  labourCost?: number;
  powerCost?: number;
  otherOverheads?: number;
  manufacturingDate?: Date;
  expiryDate?: Date;
  notes?: string;
  userId: string;
}

export class ProductionExecutionService {
  /**
   * Start a manufacturing execution batch
   */
  static async startExecution(params: StartExecutionInput) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: params.productionOrderId },
      include: { product: true },
    });

    if (!order) throw new AppError('Production order not found.', 404);
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new AppError(`Cannot execute order with status '${order.status}'.`);
    }

    const count = await prisma.productionExecution.count();
    const batchNumber = params.batchNumber || `BATCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const execution = await prisma.productionExecution.create({
      data: {
        productionOrderId: order.id,
        batchNumber,
        productionDate: new Date(),
        startTime: new Date(),
        supervisorId: params.supervisorId || order.supervisorId || params.userId,
        lineOrWorkstation: params.lineOrWorkstation || 'Line 1 - Frying & Packing',
        plannedOutput: order.plannedOutputQuantity,
        actualOutput: new Prisma.Decimal(0.0),
        goodOutput: new Prisma.Decimal(0.0),
        rejectedOutput: new Prisma.Decimal(0.0),
        wastageQuantity: new Prisma.Decimal(0.0),
        status: 'IN_PROGRESS',
        notes: params.notes || null,
      },
    });

    if (order.status !== 'IN_PROGRESS') {
      await prisma.productionOrder.update({
        where: { id: order.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return execution;
  }

  /**
   * Pause execution
   */
  static async pauseExecution(executionId: string) {
    return prisma.productionExecution.update({
      where: { id: executionId },
      data: { status: 'PAUSED' },
    });
  }

  /**
   * Resume execution
   */
  static async resumeExecution(executionId: string) {
    return prisma.productionExecution.update({
      where: { id: executionId },
      data: { status: 'IN_PROGRESS' },
    });
  }

  /**
   * Post production output:
   * - Good packets added to Finished Goods inventory via InventoryService
   * - Computes actual yield % and loss %
   * - Computes total production cost & cost per packet from actual FIFO consumption
   * - Rejected / damaged packets are excluded from usable inventory
   * - Updates order & execution to COMPLETED
   */
  static async postProductionOutput(params: PostProductionOutputInput) {
    if (params.goodPackets < 0) {
      throw new AppError('Good packets quantity cannot be negative.');
    }

    const order = await prisma.productionOrder.findUnique({
      where: { id: params.productionOrderId },
      include: {
        product: true,
        bom: true,
        bomSnapshot: { include: { items: true } },
        materialIssues: { include: { items: true } },
      },
    });

    if (!order) throw new AppError('Production order not found.', 404);
    if (order.status === 'COMPLETED') {
      throw new AppError('Production order is already completed.');
    }

    const plannedOutput = Number(order.plannedOutputQuantity);
    const goodPackets = Number(params.goodPackets);
    const rejectedPackets = Number(params.rejectedPackets || 0);
    const damagedPackets = Number(params.damagedPackets || 0);
    const totalActualOutput = goodPackets + rejectedPackets + damagedPackets;
    const productionLoss = plannedOutput - goodPackets;

    // Yield & Loss calculation
    const yieldPercentage = plannedOutput > 0 ? Math.round(((goodPackets / plannedOutput) * 100) * 100) / 100 : 0;
    const lossPercentage = plannedOutput > 0 ? Math.round(((productionLoss / plannedOutput) * 100) * 100) / 100 : 0;

    // Compute actual material consumption costs from material issues
    let actualMaterialCost = 0;
    const consumptionsForRun: any[] = [];

    for (const issue of order.materialIssues) {
      for (const item of issue.items) {
        const itemConsumed = Number(item.actualConsumedQuantity);
        const itemCost = Number(item.totalCost);
        actualMaterialCost += itemCost;

        // Find standard quantity in BOM snapshot
        const snapshotItem = order.bomSnapshot?.items.find(
          s => (s.rawMaterialId && s.rawMaterialId === item.rawMaterialId) ||
               (s.packagingMaterialId && s.packagingMaterialId === item.packagingMaterialId)
        );

        consumptionsForRun.push({
          itemType: item.itemType,
          rawMaterialId: item.rawMaterialId,
          packagingMaterialId: item.packagingMaterialId,
          plannedQuantity: snapshotItem ? Number(snapshotItem.scaledQuantity) : itemConsumed,
          actualQuantity: itemConsumed,
          unit: item.unit,
        });
      }
    }

    const labourCost = params.labourCost || 0;
    const powerCost = params.powerCost || 0;
    const otherOverheads = params.otherOverheads || 0;
    const totalOverheads = labourCost + powerCost + otherOverheads;

    const totalProductionCost = Math.round((actualMaterialCost + totalOverheads) * 100) / 100;
    const costPerPacket = goodPackets > 0
      ? Math.round((totalProductionCost / goodPackets) * 100) / 100
      : 0;

    return prisma.$transaction(async (tx) => {
      const count = await tx.productionOutput.count();
      const outputNumber = `OUT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const batchNumber = params.batchNumber || `BATCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // 1. Post good finished goods to inventory & FIFO valuation layer
      if (goodPackets > 0) {
        await InventoryService.receiveStock(tx, {
          itemType: ItemType.FINISHED_GOOD,
          itemId: order.productId,
          movementType: StockMovementType.PRODUCTION_OUTPUT,
          quantity: goodPackets,
          unit: order.product.unit,
          unitCost: costPerPacket,
          referenceType: 'PRODUCTION_OUTPUT',
          referenceId: outputNumber,
          batchNumber,
          notes: `Output from order ${order.orderNumber} (Batch ${batchNumber})`,
          userId: params.userId,
        });
      }

      // 2. Create ProductionOutput record
      const productionOutput = await tx.productionOutput.create({
        data: {
          outputNumber,
          productionOrderId: order.id,
          productionExecutionId: params.productionExecutionId || null,
          batchNumber,
          productId: order.productId,
          plannedOutput: new Prisma.Decimal(plannedOutput),
          actualOutput: new Prisma.Decimal(totalActualOutput),
          goodPackets: new Prisma.Decimal(goodPackets),
          rejectedPackets: new Prisma.Decimal(rejectedPackets),
          damagedPackets: new Prisma.Decimal(damagedPackets),
          outputDate: new Date(),
          manufacturingDate: params.manufacturingDate || new Date(),
          expiryDate: params.expiryDate || null,
          status: 'POSTED',
          unitCost: new Prisma.Decimal(costPerPacket),
          totalValue: new Prisma.Decimal(totalProductionCost),
          recordedById: params.userId,
        },
      });

      // 3. Update execution if specified
      if (params.productionExecutionId) {
        await tx.productionExecution.update({
          where: { id: params.productionExecutionId },
          data: {
            actualOutput: new Prisma.Decimal(totalActualOutput),
            goodOutput: new Prisma.Decimal(goodPackets),
            rejectedOutput: new Prisma.Decimal(rejectedPackets),
            wastageQuantity: new Prisma.Decimal(damagedPackets),
            status: 'COMPLETED',
            endTime: new Date(),
          },
        });
      }

      // 4. Update order to COMPLETED
      await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          actualOutputQuantity: new Prisma.Decimal(goodPackets),
          actualCompletionDate: new Date(),
          status: 'COMPLETED',
        },
      });

      // 5. Also synchronize ProductionRun record for benchmark & evaluators
      const runNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const yieldVariance = ProductionService.calculateVariance(goodPackets, plannedOutput, 3.0);

      await tx.productionRun.create({
        data: {
          runNumber,
          bomId: order.bomId,
          productId: order.productId,
          productionOrderId: order.id,
          plannedBatchQuantity: new Prisma.Decimal(plannedOutput),
          expectedOutput: new Prisma.Decimal(plannedOutput),
          actualGoodOutput: new Prisma.Decimal(goodPackets),
          damagedPouches: new Prisma.Decimal(damagedPackets),
          cartonsUsed: new Prisma.Decimal(0),
          labourCost: new Prisma.Decimal(labourCost),
          powerCost: new Prisma.Decimal(powerCost),
          otherOverheads: new Prisma.Decimal(otherOverheads),
          totalMaterialCost: new Prisma.Decimal(actualMaterialCost),
          totalProductionCost: new Prisma.Decimal(totalProductionCost),
          costPerPacket: new Prisma.Decimal(costPerPacket),
          yieldVariancePercent: new Prisma.Decimal(yieldVariance.variancePercent),
          yieldVarianceStatus: yieldVariance.status,
          status: 'POSTED',
          notes: `Posted from Order ${order.orderNumber} (Batch ${batchNumber})`,
          createdById: params.userId,
        },
      });

      await AuditService.log(tx, {
        userId: params.userId,
        action: 'CREATE',
        entityType: 'PRODUCTION_OUTPUT',
        entityId: productionOutput.id,
        newValues: {
          outputNumber,
          batchNumber,
          goodPackets,
          yieldPercentage,
          costPerPacket,
          totalProductionCost,
        },
      });

      return {
        productionOutput,
        yieldPercentage,
        lossPercentage,
        productionLoss,
        totalProductionCost,
        costPerPacket,
      };
    });
  }

  /**
   * Get executions list
   */
  static async getExecutions(filters?: { productionOrderId?: string; status?: string }) {
    const where: any = {};
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;

    return prisma.productionExecution.findMany({
      where,
      include: {
        productionOrder: { include: { product: true } },
        outputs: true,
      },
      orderBy: { productionDate: 'desc' },
    });
  }
}
