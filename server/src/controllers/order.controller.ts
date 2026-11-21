import { Response, NextFunction } from 'express';
import { Role, OrderStatus } from '@prisma/client';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { OrderService } from '../services/order.service.js';

export class OrderController {
  static async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const callerRole = req.user!.role;
      const { customerId, items, orderNotes } = req.body;
      const order = await OrderService.createOrder({
        customerId,
        salesmanId: userId,
        callerRole,
        items,
        orderNotes,
      });
      res.status(201).json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async updateOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { items, orderNotes } = req.body;
      const order = await OrderService.updateOrder({
        orderId: id,
        items,
        orderNotes,
        adminUserId: req.user!.id,
      });
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async getOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const where: any = {};
      if (req.user?.role === Role.SALESMAN) {
        where.salesmanId = req.user.id;
      }

      const orders = await prisma.salesOrder.findMany({
        where,
        include: {
          customer: true,
          salesman: { select: { id: true, fullName: true, email: true } },
          items: { include: { product: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
        },
        orderBy: { orderDate: 'desc' },
      });

      res.json({ success: true, data: orders });
    } catch (err) { next(err); }
  }

  static async getOrderById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
          customer: true,
          salesman: { select: { id: true, fullName: true, email: true } },
          items: { include: { product: true } },
          invoice: true,
          dispatch: true,
        },
      });

      if (!order) throw new AppError('Order not found.', 404);

      if (req.user?.role === Role.SALESMAN && order.salesmanId !== req.user.id) {
        throw new AppError('Forbidden: You can only view your own orders.', 403);
      }

      const stockCheck = await OrderService.checkStockAvailability(order.id);

      res.json({ success: true, data: { ...order, stockCheck } });
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
      const order = await OrderService.approveOrder(id, req.user!.id);
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
}
