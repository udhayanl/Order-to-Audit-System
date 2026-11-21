import { Response, NextFunction } from 'express';
import { ItemType, StockMovementType, Prisma } from '@prisma/client';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { ReportService } from '../services/report.service.js';
import { InventoryService } from '../services/inventory.service.js';
import { AuditService } from '../services/audit.service.js';

export class InventoryController {
  static async getSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.getStockSummary();
      res.json({ success: true, data: summary });
    } catch (err) { next(err); }
  }

  static async getLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { itemType, itemId } = req.query as { itemType?: ItemType; itemId?: string };
      const ledger = await ReportService.getStockLedger(itemType, itemId);
      res.json({ success: true, data: ledger });
    } catch (err) { next(err); }
  }

  static async createAdjustment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { itemType, itemId, quantity, unit, notes } = req.body;
      const result = await prisma.$transaction(async (tx) => {
        const movement = await InventoryService.recordMovement(tx, {
          itemType,
          itemId,
          movementType: StockMovementType.STOCK_ADJUSTMENT,
          quantity: Number(quantity),
          unit,
          referenceType: 'ADJUSTMENT',
          notes: notes || 'Manual authorized stock adjustment',
          userId: req.user!.id,
        });

        await AuditService.log(tx, {
          userId: req.user!.id,
          action: 'STOCK_ADJUSTMENT',
          entityType: itemType,
          entityId: itemId,
          newValues: { quantity, notes },
        });

        return movement;
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}
