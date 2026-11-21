import { PrismaClient } from '@prisma/client';
import prisma from '../db/client.js';

export class AuditService {
  static async log(
    tx: any,
    params: {
      userId?: string;
      action: string;
      entityType: string;
      entityId: string;
      previousValues?: any;
      newValues?: any;
      ipAddress?: string;
    }
  ) {
    const client = tx || prisma;
    try {
      return await client.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          previousValues: params.previousValues ? JSON.stringify(params.previousValues) : null,
          newValues: params.newValues ? JSON.stringify(params.newValues) : null,
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (err) {
      console.error('[Audit Log Error]', err);
    }
  }
}
