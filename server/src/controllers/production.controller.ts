import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ProductionService } from '../services/production.service.js';
import { BOMService } from '../services/bom.service.js';

export class ProductionController {
  static async calculatePlanned(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { bomId, plannedBatchQuantity } = req.body;
      const bom = await BOMService.getBOMById(bomId);
      const planned = BOMService.calculatePlannedRequirements(bom, Number(plannedBatchQuantity));
      res.json({ success: true, data: planned });
    } catch (err) { next(err); }
  }

  static async createRun(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const run = await ProductionService.postProductionRun({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: run });
    } catch (err) { next(err); }
  }

  static async getRuns(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const runs = await prisma.productionRun.findMany({
        include: {
          product: true,
          bom: true,
          consumptions: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
        orderBy: { runDate: 'desc' },
      });
      res.json({ success: true, data: runs });
    } catch (err) { next(err); }
  }

  static async getRunById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const run = await prisma.productionRun.findUnique({
        where: { id },
        include: {
          product: true,
          bom: true,
          consumptions: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
      });
      if (!run) throw new AppError('Production run not found.', 404);
      res.json({ success: true, data: run });
    } catch (err) { next(err); }
  }
}
