import { FindingCategory, FindingSeverity, FindingStatus } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface CreateFindingDto {
  auditSessionId?: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  description: string;
  correctiveAction?: string;
  assignedToId?: string;
  targetDate?: Date | string;
  userId: string;
}

export class FindingsService {
  /**
   * Record a new audit finding / compliance issue
   */
  static async createFinding(dto: CreateFindingDto) {
    if (dto.assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw new AppError('Assigned user not found.', 404);
    }

    const count = await prisma.auditFinding.count();
    const findingNumber = `FND-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const finding = await prisma.auditFinding.create({
      data: {
        findingNumber,
        auditSessionId: dto.auditSessionId || null,
        title: dto.title,
        category: dto.category,
        severity: dto.severity,
        status: FindingStatus.OPEN,
        description: dto.description,
        correctiveAction: dto.correctiveAction || null,
        assignedToId: dto.assignedToId || null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      },
      include: {
        auditSession: { select: { title: true, auditNumber: true } },
        assignedTo: { select: { fullName: true, email: true, role: true } },
      },
    });

    await AuditService.log(prisma, {
      userId: dto.userId,
      action: 'CREATE_FINDING',
      entityType: 'AUDIT_FINDING',
      entityId: finding.id,
      newValues: { findingNumber, title: dto.title, severity: dto.severity, category: dto.category },
    });

    return finding;
  }

  /**
   * List audit findings with filters and search
   */
  static async getFindings(filter: {
    auditSessionId?: string;
    category?: FindingCategory;
    severity?: FindingSeverity;
    status?: FindingStatus;
    assignedToId?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filter.auditSessionId) where.auditSessionId = filter.auditSessionId;
    if (filter.category) where.category = filter.category;
    if (filter.severity) where.severity = filter.severity;
    if (filter.status) where.status = filter.status;
    if (filter.assignedToId) where.assignedToId = filter.assignedToId;

    if (filter.search) {
      where.OR = [
        { findingNumber: { contains: filter.search, mode: 'insensitive' } },
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
        { correctiveAction: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return await prisma.auditFinding.findMany({
      where,
      orderBy: [
        { severity: 'asc' }, // CRITICAL first if ordered, but Prisma sorts enum alphabetically
        { createdAt: 'desc' },
      ],
      include: {
        auditSession: { select: { id: true, auditNumber: true, title: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
  }

  /**
   * Get single finding by ID
   */
  static async getFindingById(id: string) {
    const finding = await prisma.auditFinding.findUnique({
      where: { id },
      include: {
        auditSession: true,
        assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    if (!finding) throw new AppError('Audit finding not found.', 404);
    return finding;
  }

  /**
   * Update finding status & CAPA resolution
   */
  static async updateFindingStatus(
    id: string,
    params: {
      status: FindingStatus;
      correctiveAction?: string;
      resolutionNotes?: string;
      userId: string;
    }
  ) {
    const existing = await prisma.auditFinding.findUnique({ where: { id } });
    if (!existing) throw new AppError('Audit finding not found.', 404);

    const data: any = {
      status: params.status,
      updatedAt: new Date(),
    };

    if (params.correctiveAction) data.correctiveAction = params.correctiveAction;
    if (params.resolutionNotes) data.resolutionNotes = params.resolutionNotes;

    if (params.status === FindingStatus.RESOLVED || params.status === FindingStatus.CLOSED) {
      data.resolvedDate = new Date();
    }

    const updated = await prisma.auditFinding.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { fullName: true, role: true } },
      },
    });

    await AuditService.log(prisma, {
      userId: params.userId,
      action: 'UPDATE_FINDING',
      entityType: 'AUDIT_FINDING',
      entityId: id,
      previousValues: { status: existing.status },
      newValues: { status: params.status, resolutionNotes: params.resolutionNotes },
    });

    return updated;
  }
}
