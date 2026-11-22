import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { StockAllocationService } from '../services/stock-allocation.service.js';
import { SalesReturnService } from '../services/sales-return.service.js';
import { SalesDashboardService } from '../services/sales-dashboard.service.js';
import { GSTService } from '../services/gst.service.js';

export class SalesController {
  // ================= STOCK AVAILABILITY & ALLOCATION =================
  static async getStockAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.query;
      const availability = await StockAllocationService.getStockAvailability(
        productId ? String(productId) : undefined
      );
      res.json({ success: true, data: availability });
    } catch (err) { next(err); }
  }

  static async allocateOrderStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { items, notes } = req.body;
      const allocation = await StockAllocationService.allocateStock({
        salesOrderId: id,
        userId: req.user!.id,
        items,
        notes,
      });
      res.status(201).json({ success: true, data: allocation });
    } catch (err) { next(err); }
  }

  static async releaseOrderAllocation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const releasedCount = await StockAllocationService.releaseAllForOrder(id, req.user!.id);
      res.json({ success: true, message: `Released ${releasedCount} active allocation(s).` });
    } catch (err) { next(err); }
  }

  static async releaseSpecificAllocation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const allocation = await StockAllocationService.releaseAllocation(id, req.user!.id);
      res.json({ success: true, data: allocation });
    } catch (err) { next(err); }
  }

  static async getAllocations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { salesOrderId, status } = req.query;
      const where: any = {};
      if (salesOrderId) where.salesOrderId = String(salesOrderId);
      if (status) where.status = String(status);

      const allocations = await prisma.stockAllocation.findMany({
        where,
        orderBy: { allocationDate: 'desc' },
        include: {
          items: { include: { product: true } },
          salesOrder: { include: { customer: true } },
          allocatedBy: { select: { id: true, fullName: true, role: true } },
        },
      });
      res.json({ success: true, data: allocations });
    } catch (err) { next(err); }
  }

  // ================= GST SERVICES =================
  static async calculateGST(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerStateCode, customerState, items } = req.body;
      if (!customerStateCode || !items) {
        throw new AppError('customerStateCode and items are required.', 400);
      }
      const result = await GSTService.calculateGST({
        customerStateCode,
        customerState,
        items,
      });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async getTaxConfiguration(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const config = await GSTService.getTaxConfiguration();
      res.json({ success: true, data: config });
    } catch (err) { next(err); }
  }

  static async updateTaxConfiguration(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const config = await GSTService.updateTaxConfiguration(req.body);
      res.json({ success: true, data: config });
    } catch (err) { next(err); }
  }

  // ================= SALES RETURNS & CREDIT NOTES =================
  static async createReturn(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerId, salesOrderId, invoiceId, dispatchId, returnReason, notes, items } = req.body;
      const result = await SalesReturnService.createReturn({
        customerId,
        salesOrderId,
        invoiceId,
        dispatchId,
        returnReason,
        notes,
        items,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async getReturns(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, customerId, status, startDate, endDate } = req.query;
      const result = await SalesReturnService.getReturns({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        customerId: customerId ? String(customerId) : undefined,
        status: status ? String(status) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  static async getReturnById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await SalesReturnService.getReturnById(id);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async getCreditNotes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const creditNotes = await prisma.creditNote.findMany({
        orderBy: { issueDate: 'desc' },
        include: {
          customer: true,
          invoice: true,
          items: { include: { product: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });
      res.json({ success: true, data: creditNotes });
    } catch (err) { next(err); }
  }

  static async getCreditNoteById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const creditNote = await prisma.creditNote.findFirst({
        where: { OR: [{ id }, { creditNoteNumber: id }] },
        include: {
          customer: true,
          invoice: true,
          items: { include: { product: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });
      if (!creditNote) throw new AppError('Credit note not found.', 404);
      res.json({ success: true, data: creditNote });
    } catch (err) { next(err); }
  }

  // ================= SALES DASHBOARD & REPORTS =================
  static async getDashboardSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await SalesDashboardService.getDashboardSummary(req.user?.id, req.user?.role);
      res.json({ success: true, data: summary });
    } catch (err) { next(err); }
  }

  static async getSalesmanPerformance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const perf = await SalesDashboardService.getSalesmanPerformance();
      res.json({ success: true, data: perf });
    } catch (err) { next(err); }
  }

  static async getGSTR1Report(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { month, year } = req.query;
      const report = await SalesDashboardService.getGSTR1Report({
        month: month !== undefined ? Number(month) : undefined,
        year: year !== undefined ? Number(year) : undefined,
      });
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  }
}
