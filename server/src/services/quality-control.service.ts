import { Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface CreateQualityInspectionInput {
  batchNumber: string;
  productionOrderId: string;
  productId: string;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity?: number;
  qualityStatus?: string; // PASSED, FAILED, CONDITIONAL, PENDING
  weightConsistency?: string;
  packagingCondition?: string;
  appearance?: string;
  notes?: string;
  inspectorId: string;
}

export class QualityControlService {
  /**
   * Record a quality inspection for a production batch
   */
  static async recordInspection(params: CreateQualityInspectionInput) {
    if (params.inspectedQuantity <= 0) {
      throw new AppError('Inspected quantity must be greater than zero.');
    }

    const accepted = Number(params.acceptedQuantity);
    const rejected = Number(params.rejectedQuantity || 0);

    if (accepted + rejected > params.inspectedQuantity + 0.0001) {
      throw new AppError('Accepted plus rejected quantities cannot exceed total inspected quantity.');
    }

    const count = await prisma.qualityInspection.count();
    const inspectionNumber = `QC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const status = params.qualityStatus || (rejected > 0 ? 'CONDITIONAL' : 'PASSED');

    const inspection = await prisma.qualityInspection.create({
      data: {
        inspectionNumber,
        batchNumber: params.batchNumber,
        productionOrderId: params.productionOrderId,
        productId: params.productId,
        inspectedQuantity: new Prisma.Decimal(params.inspectedQuantity),
        acceptedQuantity: new Prisma.Decimal(accepted),
        rejectedQuantity: new Prisma.Decimal(rejected),
        qualityStatus: status,
        weightConsistency: params.weightConsistency || 'Within ±2g specification',
        packagingCondition: params.packagingCondition || 'Hermetically sealed, no leakage',
        appearance: params.appearance || 'Uniform golden brown color, crisp texture',
        notes: params.notes || null,
        inspectorId: params.inspectorId,
      },
      include: {
        product: true,
        productionOrder: true,
        inspector: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    await AuditService.log(prisma, {
      userId: params.inspectorId,
      action: 'CREATE',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      newValues: { inspectionNumber, batchNumber: params.batchNumber, status, accepted, rejected },
    });

    return inspection;
  }

  /**
   * List all quality inspections
   */
  static async getInspections(filters?: { batchNumber?: string; qualityStatus?: string }) {
    const where: any = {};
    if (filters?.batchNumber) where.batchNumber = filters.batchNumber;
    if (filters?.qualityStatus && filters.qualityStatus !== 'ALL') where.qualityStatus = filters.qualityStatus;

    return prisma.qualityInspection.findMany({
      where,
      include: {
        product: true,
        productionOrder: true,
        inspector: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { inspectionDate: 'desc' },
    });
  }
}
