import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { DispatchService } from '../services/dispatch.service.js';

export class DispatchController {
  static async createDispatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderId, vehicleNumber, driverName, transporter, remarks, items } = req.body;
      const dispatch = await DispatchService.postDispatch({
        orderId,
        vehicleNumber,
        driverName,
        transporter,
        remarks,
        items,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: dispatch });
    } catch (err) { next(err); }
  }

  static async getDispatches(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, deliveryStatus, startDate, endDate } = req.query;
      const result = await DispatchService.getDispatches({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search ? String(search) : undefined,
        deliveryStatus: deliveryStatus ? String(deliveryStatus) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  static async getDispatchById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const dispatch = await DispatchService.getDispatchById(id);
      res.json({ success: true, data: dispatch });
    } catch (err) { next(err); }
  }

  static async updateDeliveryStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, deliveryDate } = req.body;
      const updated = await DispatchService.updateDeliveryStatus(
        id,
        status,
        deliveryDate,
        req.user?.id
      );
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }
}
