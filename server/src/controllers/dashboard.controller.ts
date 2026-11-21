import { Response, NextFunction } from 'express';
import { ItemType, OrderStatus } from '@prisma/client';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { InventoryService } from '../services/inventory.service.js';
import { CostingService } from '../services/costing.service.js';

export class DashboardController {
  static async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Orders today
      const todayOrdersCount = await prisma.salesOrder.count({
        where: { orderDate: { gte: startOfDay } },
      });

      // Pending orders (submitted or approved but not dispatched)
      const pendingOrdersCount = await prisma.salesOrder.count({
        where: { status: { in: [OrderStatus.SUBMITTED, OrderStatus.APPROVED, OrderStatus.INVOICED] } },
      });

      // Total sales (from posted invoices)
      const invoices = await prisma.invoice.findMany({
        where: { status: 'POSTED' },
        select: { grandTotal: true, paidAmount: true, outstandingAmount: true, dueDate: true },
      });

      const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
      const totalReceivables = invoices.reduce((sum, inv) => sum + Number(inv.outstandingAmount), 0);

      const now = new Date();
      const overduePayments = invoices
        .filter(inv => Number(inv.outstandingAmount) > 0 && new Date(inv.dueDate) < now)
        .reduce((sum, inv) => sum + Number(inv.outstandingAmount), 0);

      // Production runs count & variance alerts count
      const productionRunsCount = await prisma.productionRun.count();
      const varianceAlertsCount = await prisma.productionRun.count({
        where: { yieldVarianceStatus: 'EXCEEDS_TOLERANCE' },
      });

      // Finished goods stock summary
      const products = await prisma.product.findMany();
      let totalFgStock = 0;
      for (const p of products) {
        const stock = await InventoryService.getCurrentStock(ItemType.FINISHED_GOOD, p.id);
        totalFgStock += stock;
      }

      // Raw material stock summary
      const rawMaterials = await prisma.rawMaterial.findMany();
      let totalRmStock = 0;
      let lowStockAlertsCount = 0;
      for (const rm of rawMaterials) {
        const stock = await InventoryService.getCurrentStock(ItemType.RAW_MATERIAL, rm.id);
        totalRmStock += stock;
        if (stock <= Number(rm.reorderLevel)) {
          lowStockAlertsCount++;
        }
      }

      // Product cost and margin summaries
      const costingSummary = await CostingService.getProductCostingSummary();

      // Recent 5 production runs
      const recentRuns = await prisma.productionRun.findMany({
        take: 5,
        orderBy: { runDate: 'desc' },
        include: { product: true },
      });

      // Recent 5 sales orders
      const recentOrders = await prisma.salesOrder.findMany({
        take: 5,
        orderBy: { orderDate: 'desc' },
        include: { customer: true, salesman: { select: { fullName: true } } },
      });

      res.json({
        success: true,
        data: {
          todayOrdersCount,
          pendingOrdersCount,
          totalSales: Math.round(totalSales * 100) / 100,
          totalReceivables: Math.round(totalReceivables * 100) / 100,
          overduePayments: Math.round(overduePayments * 100) / 100,
          totalFgStock,
          totalRmStock,
          lowStockAlertsCount,
          productionRunsCount,
          varianceAlertsCount,
          costingSummary,
          recentRuns,
          recentOrders,
        },
      });
    } catch (err) { next(err); }
  }
}
