import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';
import { OrderService } from '../services/order.service.js';

export class OrderController {
  static async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const callerRole = req.user!.role;
      const { customerId, items, orderNotes, deliveryDate, paymentTerms, status } = req.body;
      const order = await OrderService.createOrder({
        customerId,
        salesmanId: userId,
        callerRole,
        items,
        orderNotes,
        deliveryDate,
        paymentTerms,
        status,
      });
      res.status(201).json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async submitOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await OrderService.submitOrder(id, req.user!.id);
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async updateOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { items, orderNotes, deliveryDate, paymentTerms } = req.body;
      const order = await OrderService.updateOrder({
        orderId: id,
        items,
        orderNotes,
        deliveryDate,
        paymentTerms,
        adminUserId: req.user!.id,
        callerRole: req.user!.role,
      });
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async getOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, customerId, search, startDate, endDate } = req.query;
      const orders = await OrderService.getOrders({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status ? (String(status) as any) : undefined,
        customerId: customerId ? String(customerId) : undefined,
        search: search ? String(search) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        callerRole: req.user?.role,
        callerUserId: req.user?.id,
      });
      res.json({ success: true, ...orders });
    } catch (err) { next(err); }
  }

  static async getOrderById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await OrderService.getOrderById(id, req.user?.role, req.user?.id);
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async checkStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stockCheck = await OrderService.checkStockAvailability(id);
      res.json({ success: true, data: stockCheck });
    } catch (err) { next(err); }
  }

  static async approveOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await OrderService.approveOrder(id, req.user!.id, req.user?.role);
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async rejectOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await OrderService.rejectOrder(id, reason || 'Rejected by Admin', req.user!.id);
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await OrderService.cancelOrder(id, req.user!.id, reason);
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }
}
