import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { PaymentService } from '../services/payment.service.js';

export class PaymentController {
  static async recordPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentService.recordPayment({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: payment });
    } catch (err) { next(err); }
  }

  static async getPayments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payments = await prisma.payment.findMany({
        include: {
          customer: true,
          allocations: { include: { invoice: true } },
        },
        orderBy: { paymentDate: 'desc' },
      });
      res.json({ success: true, data: payments });
    } catch (err) { next(err); }
  }

  static async getAgeing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ageing = await PaymentService.getCustomerAgeing();
      res.json({ success: true, data: ageing });
    } catch (err) { next(err); }
  }
}
