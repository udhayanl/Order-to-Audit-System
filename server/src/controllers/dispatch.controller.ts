import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { DispatchService } from '../services/dispatch.service.js';

export class DispatchController {
  static async createDispatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderId, vehicleNumber, driverName, remarks } = req.body;
      const dispatch = await DispatchService.postDispatch({
        orderId,
        vehicleNumber,
        driverName,
        remarks,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: dispatch });
    } catch (err) { next(err); }
  }

  static async getDispatches(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dispatches = await prisma.dispatch.findMany({
        include: {
          order: { include: { customer: true } },
          invoice: true,
          items: { include: { product: true } },
        },
        orderBy: { dispatchDate: 'desc' },
      });
      res.json({ success: true, data: dispatches });
    } catch (err) { next(err); }
  }
}
