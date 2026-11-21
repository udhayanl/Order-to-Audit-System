import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ReportService } from '../services/report.service.js';
import { PaymentService } from '../services/payment.service.js';

export class ReportController {
  static async getSalesRegister(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { format } = req.query;
      const data = await ReportService.getSalesRegister();

      if (format === 'csv') {
        const cols = [
          { header: 'Invoice Number', key: 'invoiceNumber' },
          { header: 'Date', key: 'date' },
          { header: 'Customer', key: 'customerName' },
          { header: 'Product', key: 'productName' },
          { header: 'HSN', key: 'hsnCode' },
          { header: 'Quantity', key: 'quantity' },
          { header: 'Unit Price', key: 'unitPrice' },
          { header: 'Taxable Amount', key: 'taxableAmount' },
          { header: 'CGST', key: 'cgstAmount' },
          { header: 'SGST', key: 'sgstAmount' },
          { header: 'IGST', key: 'igstAmount' },
          { header: 'Total Amount', key: 'totalAmount' },
        ];
        const csv = ReportService.exportToCSV(cols, data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="sales-register.csv"');
        return res.send(csv);
      }

      if (format === 'excel') {
        const cols = [
          { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Customer', key: 'customerName', width: 22 },
          { header: 'Product', key: 'productName', width: 20 },
          { header: 'HSN', key: 'hsnCode', width: 10 },
          { header: 'Quantity', key: 'quantity', width: 12 },
          { header: 'Unit Price', key: 'unitPrice', width: 12 },
          { header: 'Taxable Amount', key: 'taxableAmount', width: 16 },
          { header: 'CGST', key: 'cgstAmount', width: 12 },
          { header: 'SGST', key: 'sgstAmount', width: 12 },
          { header: 'IGST', key: 'igstAmount', width: 12 },
          { header: 'Total Amount', key: 'totalAmount', width: 16 },
        ];
        const buffer = await ReportService.exportToExcel('Sales Register', cols, data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="sales-register.xlsx"');
        return res.send(buffer);
      }

      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getCustomerWiseSales(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getCustomerWiseSales();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getProductWiseSales(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getProductWiseSales();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getGSTSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getGSTSummary();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getPurchaseRegister(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { format } = req.query;
      const data = await ReportService.getPurchaseRegister();

      if (format === 'csv') {
        const cols = [
          { header: 'PO Number', key: 'purchaseNumber' },
          { header: 'Date', key: 'date' },
          { header: 'Supplier', key: 'supplierName' },
          { header: 'Item', key: 'itemName' },
          { header: 'Quantity', key: 'quantity' },
          { header: 'Unit', key: 'unit' },
          { header: 'Unit Price', key: 'unitPrice' },
          { header: 'Taxable Amount', key: 'taxableAmount' },
          { header: 'GST Amount', key: 'gstAmount' },
          { header: 'Total Amount', key: 'totalAmount' },
        ];
        const csv = ReportService.exportToCSV(cols, data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="purchase-register.csv"');
        return res.send(csv);
      }

      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getStockSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getStockSummary();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getProductionReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getProductionReport();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getAgeingReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await PaymentService.getCustomerAgeing();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}
