import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';

export class AuditController {
  static async getLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const logs = await prisma.auditLog.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { fullName: true, email: true, role: true } },
        },
      });
      res.json({ success: true, data: logs });
    } catch (err) { next(err); }
  }
}
