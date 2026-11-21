import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
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
      const invoices = await prisma.invoice.findMany({
        include: {
          customer: true,
          order: true,
          allocations: { include: { payment: true } },
          creditNotes: true,
        },
        orderBy: { invoiceDate: 'desc' },
      });
      res.json({ success: true, data: invoices });
    } catch (err) { next(err); }
  }

  static async getInvoiceById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          customer: true,
          order: true,
          items: { include: { product: true } },
          allocations: { include: { payment: true } },
          creditNotes: true,
        },
      });

      if (!invoice) throw new AppError('Invoice not found.', 404);
      res.json({ success: true, data: invoice });
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
