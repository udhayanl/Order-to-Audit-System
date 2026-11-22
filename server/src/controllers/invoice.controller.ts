import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { InvoiceService } from '../services/invoice.service.js';

export class InvoiceController {
  static async createFromOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.body;
      const invoice = await InvoiceService.createInvoiceFromOrder(orderId, req.user!.id);
      res.status(201).json({ success: true, data: invoice });
    } catch (err) { next(err); }
  }

  static async getInvoices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, customerId, status, startDate, endDate } = req.query;
      const result = await InvoiceService.getInvoices({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search ? String(search) : undefined,
        customerId: customerId ? String(customerId) : undefined,
        status: status ? (String(status) as any) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  static async getInvoiceById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const invoice = await InvoiceService.getInvoiceById(id);
      res.json({ success: true, data: invoice });
    } catch (err) { next(err); }
  }

  static async updateInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await InvoiceService.updateInvoice(id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }

  static async downloadPDF(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const doc = await InvoiceService.generateInvoicePDF(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Invoice-${id}.pdf`);
      doc.pipe(res);
      doc.end();
    } catch (err) { next(err); }
  }

  static async cancelInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await InvoiceService.cancelInvoice(id, reason || 'Cancelled by User', req.user!.id);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}
