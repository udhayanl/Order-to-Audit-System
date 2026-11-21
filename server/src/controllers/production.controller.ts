import { Response, NextFunction } from 'express';
import prisma from '../db/client.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ProductionService } from '../services/production.service.js';
import { BOMService } from '../services/bom.service.js';
import { ProductionPlanningService } from '../services/production-planning.service.js';
import { ProductionOrderService } from '../services/production-order.service.js';
import { MaterialIssueService } from '../services/material-issue.service.js';
import { ProductionExecutionService } from '../services/production-execution.service.js';
import { QualityControlService } from '../services/quality-control.service.js';
import { BatchTraceabilityService } from '../services/batch-traceability.service.js';

export class ProductionController {
  // ================= PRODUCTION ORDERS =================
  static async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await ProductionOrderService.createOrder(req.body, req.user!.id);
      res.status(201).json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async getOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, productId, supervisorId } = req.query as any;
      const orders = await ProductionOrderService.getOrders({ status, productId, supervisorId });
      res.json({ success: true, data: orders });
    } catch (err) { next(err); }
  }

  static async getOrderById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await ProductionOrderService.getOrderById(id);
      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  }

  static async submitOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await ProductionOrderService.submitOrder(id, req.user!.id);
      res.json({ success: true, message: 'Production order submitted.', data: updated });
    } catch (err) { next(err); }
  }

  static async approveOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { forceShortage } = req.body;
      const updated = await ProductionOrderService.approveOrder(id, req.user!.id, forceShortage);
      res.json({ success: true, message: 'Production order approved.', data: updated });
    } catch (err) { next(err); }
  }

  static async cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const updated = await ProductionOrderService.cancelOrder(id, req.user!.id, reason);
      res.json({ success: true, message: 'Production order cancelled.', data: updated });
    } catch (err) { next(err); }
  }

  static async reserveMaterials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await ProductionOrderService.reserveMaterials(id, req.user!.id);
      res.json({ success: true, message: 'Materials reserved successfully.', data: updated });
    } catch (err) { next(err); }
  }

  static async releaseReservations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await ProductionOrderService.releaseReservations(id, req.user!.id);
      res.json({ success: true, message: 'Reservations released.', data: updated });
    } catch (err) { next(err); }
  }

  static async getMaterialRequirements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await prisma.productionOrder.findUnique({ where: { id } });
      if (!order) throw new AppError('Production order not found.', 404);

      const requirements = await ProductionPlanningService.calculateMaterialRequirements(
        order.bomId,
        Number(order.plannedOutputQuantity)
      );
      res.json({ success: true, data: requirements });
    } catch (err) { next(err); }
  }

  // ================= MATERIAL ISSUES =================
  static async createMaterialIssue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const issue = await MaterialIssueService.createMaterialIssue({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, message: 'Materials issued and stock deducted.', data: issue });
    } catch (err) { next(err); }
  }

  static async getMaterialIssues(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productionOrderId } = req.query as any;
      const issues = await MaterialIssueService.getMaterialIssues({ productionOrderId });
      res.json({ success: true, data: issues });
    } catch (err) { next(err); }
  }

  static async returnUnusedMaterial(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { returnedQuantity, reason } = req.body;
      const updated = await MaterialIssueService.returnUnusedMaterial({
        materialIssueItemId: id,
        returnedQuantity: Number(returnedQuantity),
        reason,
        userId: req.user!.id,
      });
      res.json({ success: true, message: 'Unused material returned to inventory.', data: updated });
    } catch (err) { next(err); }
  }

  // ================= PRODUCTION EXECUTION & OUTPUT =================
  static async startExecution(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const execution = await ProductionExecutionService.startExecution({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: execution });
    } catch (err) { next(err); }
  }

  static async getExecutions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productionOrderId, status } = req.query as any;
      const executions = await ProductionExecutionService.getExecutions({ productionOrderId, status });
      res.json({ success: true, data: executions });
    } catch (err) { next(err); }
  }

  static async pauseExecution(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await ProductionExecutionService.pauseExecution(id);
      res.json({ success: true, message: 'Execution paused.', data: updated });
    } catch (err) { next(err); }
  }

  static async resumeExecution(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await ProductionExecutionService.resumeExecution(id);
      res.json({ success: true, message: 'Execution resumed.', data: updated });
    } catch (err) { next(err); }
  }

  static async postProductionOutput(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await ProductionExecutionService.postProductionOutput({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, message: 'Finished goods posted to inventory.', data: result });
    } catch (err) { next(err); }
  }

  static async getOutputs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const outputs = await prisma.productionOutput.findMany({
        include: {
          product: true,
          productionOrder: true,
        },
        orderBy: { outputDate: 'desc' },
      });
      res.json({ success: true, data: outputs });
    } catch (err) { next(err); }
  }

  // ================= QUALITY CONTROL =================
  static async recordQualityInspection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const inspection = await QualityControlService.recordInspection({
        ...req.body,
        inspectorId: req.user!.id,
      });
      res.status(201).json({ success: true, data: inspection });
    } catch (err) { next(err); }
  }

  static async getQualityInspections(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { batchNumber, qualityStatus } = req.query as any;
      const inspections = await QualityControlService.getInspections({ batchNumber, qualityStatus });
      res.json({ success: true, data: inspections });
    } catch (err) { next(err); }
  }

  // ================= BATCH TRACEABILITY =================
  static async traceBatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { identifier } = req.params;
      const trace = await BatchTraceabilityService.traceBatch(identifier);
      res.json({ success: true, data: trace });
    } catch (err) { next(err); }
  }

  // ================= DASHBOARD & REPORTS =================
  static async getDashboardSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const totalOrders = await prisma.productionOrder.count();
      const draftOrders = await prisma.productionOrder.count({ where: { status: 'DRAFT' } });
      const plannedOrders = await prisma.productionOrder.count({ where: { status: 'PLANNED' } });
      const inProgressOrders = await prisma.productionOrder.count({ where: { status: 'IN_PROGRESS' } });
      const completedOrders = await prisma.productionOrder.count({ where: { status: 'COMPLETED' } });
      const cancelledOrders = await prisma.productionOrder.count({ where: { status: 'CANCELLED' } });

      const outputs = await prisma.productionOutput.findMany();
      const totalGoodPackets = outputs.reduce((sum, o) => sum + Number(o.goodPackets), 0);
      const totalDamagedPackets = outputs.reduce((sum, o) => sum + Number(o.damagedPackets), 0);
      const totalRejectedPackets = outputs.reduce((sum, o) => sum + Number(o.rejectedPackets), 0);

      const recentOrders = await prisma.productionOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          supervisor: { select: { fullName: true } },
        },
      });

      const avgYield = totalGoodPackets + totalDamagedPackets + totalRejectedPackets > 0
        ? Math.round((totalGoodPackets / (totalGoodPackets + totalDamagedPackets + totalRejectedPackets)) * 100 * 10) / 10
        : 94.0;

      res.json({
        success: true,
        data: {
          kpis: {
            totalOrders,
            draftOrders,
            plannedOrders,
            inProgressOrders,
            completedOrders,
            cancelledOrders,
            totalGoodPackets,
            totalWastage: totalDamagedPackets + totalRejectedPackets,
            averageYield: avgYield,
          },
          recentOrders,
        },
      });
    } catch (err) { next(err); }
  }

  // Legacy / Direct helpers for benchmark & test compatibility
  static async calculatePlanned(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { bomId, plannedBatchQuantity } = req.body;
      const bom = await BOMService.getBOMById(bomId);
      const planned = BOMService.calculatePlannedRequirements(bom, Number(plannedBatchQuantity));
      res.json({ success: true, data: planned });
    } catch (err) { next(err); }
  }

  static async createRun(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const run = await ProductionService.postProductionRun({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: run });
    } catch (err) { next(err); }
  }

  static async getRuns(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const runs = await prisma.productionRun.findMany({
        include: {
          product: true,
          bom: true,
          consumptions: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
        orderBy: { runDate: 'desc' },
      });
      res.json({ success: true, data: runs });
    } catch (err) { next(err); }
  }

  static async getRunById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const run = await prisma.productionRun.findUnique({
        where: { id },
        include: {
          product: true,
          bom: true,
          consumptions: {
            include: {
              rawMaterial: true,
              packagingMaterial: true,
            },
          },
        },
      });
      if (!run) throw new AppError('Production run not found.', 404);
      res.json({ success: true, data: run });
    } catch (err) { next(err); }
  }
}
