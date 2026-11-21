import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { PurchaseService } from '../services/purchase.service.js';

export class PurchaseController {
  static async recordPurchase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.recordPurchase({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: purchase });
    } catch (err) { next(err); }
  }

  static async getPurchases(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const purchases = await prisma.purchase.findMany({
        include: {
          supplier: true,
          items: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
      });
      res.json({ success: true, data: purchases });
    } catch (err) { next(err); }
  }
}
