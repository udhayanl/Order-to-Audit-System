import { Response, NextFunction } from 'express';
import { ItemType, StockMovementType, StockAdjustmentStatus, StockAdjustmentType } from '@prisma/client';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { ReportService } from '../services/report.service.js';
import { InventoryService } from '../services/inventory.service.js';
import { OpeningStockService } from '../services/opening-stock.service.js';
import { StockAdjustmentService } from '../services/stock-adjustment.service.js';
import { AppError } from '../middleware/errorHandler.js';

export class InventoryController {
  /**
   * Complete inventory summary with all 3 categories & KPIs
   */
  static async getSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.getStockSummary();
      const lowStockAlerts = await InventoryService.getLowStockAlerts();
      const valuation = await InventoryService.getValuationSummary();

      // Today's receipts & issues
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayReceiptsCount = await prisma.stockLedger.count({
        where: {
          createdAt: { gte: todayStart },
          direction: 'IN',
        },
      });

      const todayIssuesCount = await prisma.stockLedger.count({
        where: {
          createdAt: { gte: todayStart },
          direction: 'OUT',
        },
      });

      res.json({
        success: true,
        data: {
          ...summary,
          kpis: {
            totalRawMaterials: summary.rawMaterials.length,
            totalPackaging: summary.packagingMaterials.length,
            totalFinishedGoods: summary.finishedGoods.length,
            totalInventoryValue: valuation.grandTotalValue,
            lowStockCount: lowStockAlerts.filter(a => a.status === 'LOW_STOCK').length,
            outOfStockCount: lowStockAlerts.filter(a => a.status === 'OUT_OF_STOCK').length,
            todayReceiptsCount,
            todayIssuesCount,
          },
          alerts: lowStockAlerts,
        },
      });
    } catch (err) { next(err); }
  }

  static async getRawMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.getStockSummary();
      res.json({ success: true, data: summary.rawMaterials });
    } catch (err) { next(err); }
  }

  static async getPackagingMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.getStockSummary();
      res.json({ success: true, data: summary.packagingMaterials });
    } catch (err) { next(err); }
  }

  static async getFinishedGoods(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.getStockSummary();
      res.json({ success: true, data: summary.finishedGoods });
    } catch (err) { next(err); }
  }

  static async getItemDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { itemType } = req.query as { itemType?: ItemType };

      let item: any = null;
      let effectiveType = itemType || ItemType.RAW_MATERIAL;

      if (effectiveType === ItemType.RAW_MATERIAL) {
        item = await prisma.rawMaterial.findUnique({ where: { id } });
      } else if (effectiveType === ItemType.PACKAGING) {
        item = await prisma.packagingMaterial.findUnique({ where: { id } });
      } else if (effectiveType === ItemType.FINISHED_GOOD) {
        item = await prisma.product.findUnique({ where: { id } });
      }

      if (!item) throw new AppError('Inventory item not found.', 404);

      const currentStock = await InventoryService.getCurrentStock(effectiveType, id);
      const recentLedger = await prisma.stockLedger.findMany({
        where: { itemId: id, itemType: effectiveType },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { fullName: true, role: true } } },
      });

      res.json({
        success: true,
        data: {
          item,
          itemType: effectiveType,
          currentStock,
          recentLedger,
        },
      });
    } catch (err) { next(err); }
  }

  static async getItemLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { itemType } = req.query as { itemType?: ItemType };
      const ledger = await prisma.stockLedger.findMany({
        where: { itemId: id, ...(itemType ? { itemType } : {}) },
        include: { user: { select: { fullName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: ledger });
    } catch (err) { next(err); }
  }

  static async getLedger(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { itemType, itemId } = req.query as { itemType?: ItemType; itemId?: string };
      const ledger = await ReportService.getStockLedger(itemType, itemId);
      res.json({ success: true, data: ledger });
    } catch (err) { next(err); }
  }

  static async getLowStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const alerts = await InventoryService.getLowStockAlerts();
      res.json({ success: true, data: alerts });
    } catch (err) { next(err); }
  }

  static async getValuation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const valuation = await InventoryService.getValuationSummary();
      res.json({ success: true, data: valuation });
    } catch (err) { next(err); }
  }

  static async getReconciliation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const report = await InventoryService.reconcileInventory();
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  }

  static async autoReconcile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.autoReconcileDiscrepancies(req.user!.id);
      res.json({ success: true, message: 'Inventory reconciled successfully.', data: result });
    } catch (err) { next(err); }
  }

  static async createOpeningStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await OpeningStockService.initializeOpeningStock({
        items: req.body.items,
        notes: req.body.notes,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async getOpeningStockRecords(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const records = await OpeningStockService.getOpeningStockRecords();
      res.json({ success: true, data: records });
    } catch (err) { next(err); }
  }

  static async createAdjustment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { itemId, itemType, adjustmentType, physicalQuantity, reason, notes, autoApprove } = req.body;
      const adjustment = await StockAdjustmentService.createAdjustment(
        {
          itemId,
          itemType: itemType || ItemType.RAW_MATERIAL,
          adjustmentType: adjustmentType || StockAdjustmentType.PHYSICAL_COUNT,
          physicalQuantity: Number(physicalQuantity),
          reason,
          notes,
          autoApprove: Boolean(autoApprove && (req.user!.role === 'ADMIN' || req.user!.role === 'OWNER')),
        },
        req.user!.id
      );
      res.status(201).json({ success: true, data: adjustment });
    } catch (err) { next(err); }
  }

  static async getAdjustments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { itemType, status } = req.query as { itemType?: ItemType; status?: StockAdjustmentStatus };
      const adjustments = await StockAdjustmentService.getAdjustments({ itemType, status });
      res.json({ success: true, data: adjustments });
    } catch (err) { next(err); }
  }

  static async approveAdjustment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await StockAdjustmentService.approveAdjustment(id, req.user!.id);
      res.json({ success: true, message: 'Stock adjustment approved and posted.', data: updated });
    } catch (err) { next(err); }
  }

  static async rejectAdjustment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const updated = await StockAdjustmentService.rejectAdjustment(id, req.user!.id, reason || 'Rejected by authorized supervisor');
      res.json({ success: true, message: 'Stock adjustment rejected.', data: updated });
    } catch (err) { next(err); }
  }
}
