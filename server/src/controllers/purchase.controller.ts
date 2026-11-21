import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { PurchaseService } from '../services/purchase.service.js';

export class PurchaseController {
  /**
   * One-shot purchase & goods receipt (Backwards-compatible with benchmark)
   */
  static async recordPurchase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.recordPurchase({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: purchase });
    } catch (err) { next(err); }
  }

  /**
   * Create a purchase order (DRAFT or CONFIRMED)
   */
  static async createPurchase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.createPurchase({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: purchase });
    } catch (err) { next(err); }
  }

  /**
   * Get all purchase orders with optional filtering
   */
  static async getPurchases(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { supplierId, status } = req.query as { supplierId?: string; status?: string };
      const purchases = await PurchaseService.getPurchases({ supplierId, status });
      res.json({ success: true, data: purchases });
    } catch (err) { next(err); }
  }

  /**
   * Get purchase order by ID
   */
  static async getPurchaseById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const purchase = await PurchaseService.getPurchaseById(id);
      res.json({ success: true, data: purchase });
    } catch (err) { next(err); }
  }

  /**
   * Confirm a draft purchase order
   */
  static async confirmPurchase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const purchase = await PurchaseService.confirmPurchase(id, req.user!.id);
      res.json({ success: true, message: 'Purchase order confirmed.', data: purchase });
    } catch (err) { next(err); }
  }

  /**
   * Post a Goods Receipt Note against a confirmed purchase order
   */
  static async postGoodsReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const receipt = await PurchaseService.postGoodsReceipt({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, message: 'Goods Receipt Note posted and inventory updated.', data: receipt });
    } catch (err) { next(err); }
  }

  /**
   * Receive purchase (alias for postGoodsReceipt matching POST /api/purchases/:id/receive)
   */
  static async receivePurchase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const receipt = await PurchaseService.postGoodsReceipt({
        purchaseId: id,
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, message: 'Purchase received successfully.', data: receipt });
    } catch (err) { next(err); }
  }

  /**
   * List all Goods Receipt Notes
   */
  static async getGoodsReceipts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { purchaseId } = req.query as { purchaseId?: string };
      const receipts = await PurchaseService.getGoodsReceipts({ purchaseId });
      res.json({ success: true, data: receipts });
    } catch (err) { next(err); }
  }

  /**
   * Get single Goods Receipt Note by ID
   */
  static async getGoodsReceiptById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const receipt = await PurchaseService.getGoodsReceiptById(id);
      res.json({ success: true, data: receipt });
    } catch (err) { next(err); }
  }
}
