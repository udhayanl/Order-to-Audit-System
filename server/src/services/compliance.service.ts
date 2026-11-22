import { FoodSafetyCategory } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface CreateFoodSafetyCheckDto {
  category: FoodSafetyCategory;
  standardRequired: string;
  actualObserved: string;
  isCompliant: boolean;
  remarks?: string;
  correctiveAction?: string;
  inspectorId: string;
  checkDate?: Date | string;
}

export class ComplianceService {
  /**
   * Record a statutory food safety inspection
   */
  static async recordFoodSafetyCheck(dto: CreateFoodSafetyCheckDto) {
    const inspector = await prisma.user.findUnique({ where: { id: dto.inspectorId } });
    if (!inspector) throw new AppError('Inspector user not found.', 404);

    const count = await prisma.foodSafetyCompliance.count();
    const checkNumber = `FSSAI-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const check = await prisma.foodSafetyCompliance.create({
      data: {
        checkNumber,
        category: dto.category,
        standardRequired: dto.standardRequired,
        actualObserved: dto.actualObserved,
        isCompliant: dto.isCompliant,
        remarks: dto.remarks || null,
        correctiveAction: dto.correctiveAction || null,
        inspectorId: dto.inspectorId,
        checkDate: dto.checkDate ? new Date(dto.checkDate) : new Date(),
      },
      include: {
        inspector: { select: { fullName: true, role: true } },
      },
    });

    await AuditService.log(prisma, {
      userId: dto.inspectorId,
      action: 'FOOD_SAFETY_CHECK',
      entityType: 'FOOD_SAFETY_COMPLIANCE',
      entityId: check.id,
      newValues: { checkNumber, category: dto.category, isCompliant: dto.isCompliant },
    });

    return check;
  }

  /**
   * Get Food Safety Inspection records
   */
  static async getFoodSafetyChecks(filter: {
    category?: FoodSafetyCategory;
    isCompliant?: boolean;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    if (filter.category) where.category = filter.category;
    if (filter.isCompliant !== undefined) where.isCompliant = filter.isCompliant;

    if (filter.startDate || filter.endDate) {
      where.checkDate = {};
      if (filter.startDate) where.checkDate.gte = new Date(filter.startDate);
      if (filter.endDate) where.checkDate.lte = new Date(filter.endDate);
    }

    return await prisma.foodSafetyCompliance.findMany({
      where,
      orderBy: { checkDate: 'desc' },
      include: {
        inspector: { select: { fullName: true, role: true } },
      },
    });
  }

  /**
   * Monitor Expiry Dates and Shelf-Life across Batches
   */
  static async getBatchExpiryAudit() {
    const runs = await prisma.productionRun.findMany({
      where: { status: 'POSTED' },
      include: {
        bom: { include: { product: true } },
      },
      orderBy: { runDate: 'desc' },
    });

    const now = new Date();
    const batchAudit: any[] = [];

    for (const run of runs) {
      // Default shelf life for traditional packaged snacks is 90 days from production date
      const mfgDate = new Date(run.runDate);
      const shelfLifeDays = 90;
      const expiryDate = new Date(mfgDate.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);

      const msDiff = expiryDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

      let status = 'GOOD';
      if (daysRemaining <= 0) {
        status = 'EXPIRED';
      } else if (daysRemaining <= 30) {
        status = 'NEAR_EXPIRY';
      }

      batchAudit.push({
        id: run.id,
        batchNumber: run.runNumber,
        productName: run.bom.product.name,
        sku: run.bom.product.sku,
        packSize: `${run.bom.product.packSize} ${run.bom.product.unit || 'pkts'}`,
        productionDate: mfgDate.toISOString().slice(0, 10),
        expiryDate: expiryDate.toISOString().slice(0, 10),
        quantityProduced: Number(run.actualGoodOutput),
        shelfLifeDays,
        daysRemaining,
        status,
        fssaiLicenseNumber: '12423011000456', // Factory FSSAI license
      });
    }

    return batchAudit;
  }

  /**
   * End-to-end Comprehensive Batch Traceability Audit
   */
  static async getFullBatchTraceability(batchNumber: string) {
    const run = await prisma.productionRun.findFirst({
      where: { runNumber: batchNumber },
      include: {
        bom: { include: { product: true } },
        createdBy: { select: { fullName: true, email: true } },
        consumptions: {
          include: {
            rawMaterial: true,
            packagingMaterial: true,
          },
        },
      },
    });

    if (!run) throw new AppError(`Batch ${batchNumber} not found.`, 404);

    const qualityInspections = await prisma.qualityInspection.findMany({
      where: { batchNumber },
      include: { inspector: { select: { fullName: true } } },
    });

    // 1. Raw materials used in this batch
    const rawMaterialsTrace = run.consumptions.map(c => ({
      materialName: c.rawMaterial?.name || c.packagingMaterial?.name || 'Item',
      code: c.rawMaterial?.code || c.packagingMaterial?.code || '-',
      plannedQty: Number(c.plannedQuantity),
      actualQty: Number(c.actualQuantity),
      unit: c.unit,
      cost: Number(c.totalCost),
      variancePercent: Number(c.consumptionVariancePercent),
    }));

    // 2. Dispatches and Invoices associated with this product/batch
    const dispatches = await prisma.dispatch.findMany({
      include: {
        order: {
          include: {
            customer: true,
            invoice: true,
            items: { where: { productId: run.bom.productId } },
          },
        },
        createdBy: { select: { fullName: true } },
      },
    });

    const forwardDistribution = dispatches
      .filter(d => d.order && d.order.items && d.order.items.length > 0)
      .map(d => ({
        dispatchNumber: d.dispatchNumber,
        dispatchDate: d.dispatchDate,
        customerName: d.order.customer.name,
        customerState: d.order.customer.state,
        invoiceNumber: d.order.invoice?.invoiceNumber || 'INV-PENDING',
        quantityDispatched: d.order.items.reduce((s: number, i: any) => s + Number(i.quantity), 0),
        dispatchedBy: d.createdBy?.fullName || 'Dispatch Team',
      }));

    return {
      batchDetails: {
        batchNumber: run.runNumber,
        productName: run.bom.product.name,
        sku: run.bom.product.sku,
        productionDate: run.runDate,
        supervisor: run.createdBy.fullName,
        actualGoodQuantity: Number(run.actualGoodOutput),
        scrapQuantity: Number(run.damagedPouches),
        totalCost: Number(run.totalProductionCost),
        costPerPacket: Number(run.costPerPacket),
        yieldVariancePercent: Number(run.yieldVariancePercent),
      },
      qualityAudit: qualityInspections.map(q => ({
        inspectionNumber: q.inspectionNumber,
        qualityStatus: q.qualityStatus,
        appearance: q.appearance,
        weightConsistency: q.weightConsistency,
        packagingCondition: q.packagingCondition,
        inspectorName: q.inspector.fullName,
      })),
      backwardIngredients: rawMaterialsTrace,
      forwardDistribution,
    };
  }
}
