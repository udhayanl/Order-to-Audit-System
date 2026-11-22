import { AuditStatus, AuditType, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface CreateAuditSessionDto {
  title: string;
  auditType: AuditType;
  scheduledDate: Date | string;
  auditorId: string;
  scope?: string;
  summary?: string;
}

export class AuditSessionService {
  /**
   * Schedule a new formal audit session
   */
  static async createSession(dto: CreateAuditSessionDto) {
    const auditor = await prisma.user.findUnique({
      where: { id: dto.auditorId },
    });
    if (!auditor) throw new AppError('Auditor not found.', 404);

    const count = await prisma.auditSession.count();
    const auditNumber = `AUD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const session = await prisma.auditSession.create({
      data: {
        auditNumber,
        title: dto.title,
        auditType: dto.auditType,
        status: AuditStatus.SCHEDULED,
        scheduledDate: new Date(dto.scheduledDate),
        auditorId: dto.auditorId,
        scope: dto.scope || null,
        summary: dto.summary || null,
      },
      include: {
        auditor: { select: { fullName: true, email: true, role: true } },
      },
    });

    await AuditService.log(prisma, {
      userId: dto.auditorId,
      action: 'CREATE',
      entityType: 'AUDIT_SESSION',
      entityId: session.id,
      newValues: { auditNumber, title: dto.title, auditType: dto.auditType },
    });

    return session;
  }

  /**
   * List audit sessions with filters
   */
  static async getSessions(filter: {
    status?: AuditStatus;
    auditType?: AuditType;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    if (filter.status) where.status = filter.status;
    if (filter.auditType) where.auditType = filter.auditType;

    if (filter.startDate || filter.endDate) {
      where.scheduledDate = {};
      if (filter.startDate) where.scheduledDate.gte = new Date(filter.startDate);
      if (filter.endDate) where.scheduledDate.lte = new Date(filter.endDate);
    }

    if (filter.search) {
      where.OR = [
        { auditNumber: { contains: filter.search, mode: 'insensitive' } },
        { title: { contains: filter.search, mode: 'insensitive' } },
        { scope: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const sessions = await prisma.auditSession.findMany({
      where,
      orderBy: { scheduledDate: 'desc' },
      include: {
        auditor: { select: { fullName: true, role: true } },
        _count: {
          select: { findings: true, inventoryItems: true },
        },
      },
    });

    return sessions.map(s => ({
      id: s.id,
      auditNumber: s.auditNumber,
      title: s.title,
      auditType: s.auditType,
      status: s.status,
      scheduledDate: s.scheduledDate,
      completedDate: s.completedDate,
      auditorName: s.auditor.fullName,
      scope: s.scope,
      summary: s.summary,
      complianceScore: s.complianceScore ? Number(s.complianceScore) : null,
      findingsCount: s._count.findings,
      inventoryItemsCount: s._count.inventoryItems,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Get single audit session by ID with all findings and inventory audit records
   */
  static async getSessionById(id: string) {
    const session = await prisma.auditSession.findUnique({
      where: { id },
      include: {
        auditor: { select: { fullName: true, email: true, role: true } },
        findings: {
          include: {
            assignedTo: { select: { fullName: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        inventoryItems: {
          orderBy: { itemName: 'asc' },
        },
      },
    });

    if (!session) throw new AppError('Audit session not found.', 404);

    return {
      ...session,
      complianceScore: session.complianceScore ? Number(session.complianceScore) : null,
      inventoryItems: session.inventoryItems.map(item => ({
        ...item,
        systemStock: Number(item.systemStock),
        physicalStock: Number(item.physicalStock),
        varianceQuantity: Number(item.varianceQuantity),
        unitCost: Number(item.unitCost),
        varianceValue: Number(item.varianceValue),
      })),
    };
  }

  /**
   * Transition audit session status (IN_PROGRESS, COMPLETED, CLOSED)
   */
  static async updateSessionStatus(
    id: string,
    params: {
      status: AuditStatus;
      summary?: string;
      complianceScore?: number;
      userId: string;
    }
  ) {
    const existing = await prisma.auditSession.findUnique({
      where: { id },
      include: { findings: true, inventoryItems: true },
    });
    if (!existing) throw new AppError('Audit session not found.', 404);

    const data: any = {
      status: params.status,
      updatedAt: new Date(),
    };

    if (params.summary) data.summary = params.summary;

    if (params.status === AuditStatus.COMPLETED) {
      data.completedDate = new Date();

      // Automatically calculate compliance score if not explicitly passed
      if (params.complianceScore !== undefined) {
        data.complianceScore = new Prisma.Decimal(params.complianceScore);
      } else {
        // Derive compliance score from findings and discrepancies
        let score = 100.0;
        const criticalCount = existing.findings.filter(f => f.severity === 'CRITICAL').length;
        const majorCount = existing.findings.filter(f => f.severity === 'MAJOR').length;
        const minorCount = existing.findings.filter(f => f.severity === 'MINOR').length;
        const discrepancyCount = existing.inventoryItems.filter(i => i.status === 'DISCREPANCY_FLAGGED').length;

        score -= criticalCount * 10;
        score -= majorCount * 5;
        score -= minorCount * 2;
        score -= discrepancyCount * 3;

        score = Math.max(0, Math.min(100, score));
        data.complianceScore = new Prisma.Decimal(score);
      }
    }

    const updated = await prisma.auditSession.update({
      where: { id },
      data,
      include: { auditor: true },
    });

    await AuditService.log(prisma, {
      userId: params.userId,
      action: 'UPDATE_STATUS',
      entityType: 'AUDIT_SESSION',
      entityId: id,
      previousValues: { status: existing.status },
      newValues: { status: params.status, complianceScore: data.complianceScore },
    });

    return updated;
  }
}
