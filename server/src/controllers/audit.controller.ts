import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { AuditService } from '../services/audit.service.js';
import { AuditSessionService } from '../services/audit-session.service.js';
import { InventoryAuditService } from '../services/inventory-audit.service.js';
import { FindingsService } from '../services/findings.service.js';
import { ComplianceService } from '../services/compliance.service.js';
import { AuditReportService } from '../services/audit-report.service.js';

export class AuditController {
  /**
   * 1. Dashboard Metrics
   */
  static async getDashboardMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await AuditService.getAuditDashboardMetrics();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /**
   * 2. Immutable System Audit Trail
   */
  static async getAuditTrail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { entityType, action, userId, search, startDate, endDate, take, skip } = req.query;
      const data = await AuditService.getAuditTrail({
        entityType: entityType as string,
        action: action as string,
        userId: userId as string,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
        take: take ? parseInt(take as string) : 100,
        skip: skip ? parseInt(skip as string) : 0,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /**
   * Backwards-compatible alias for existing getLogs
   */
  static async getLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { entityType, action, search } = req.query;
      const { logs } = await AuditService.getAuditTrail({
        entityType: entityType as string,
        action: action as string,
        search: search as string,
        take: 100,
      });
      res.json({ success: true, data: logs });
    } catch (err) { next(err); }
  }

  /**
   * 3. User Activity Logs
   */
  static async getUserActivity(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId, action, entityType, search, startDate, endDate, take, skip } = req.query;
      const data = await AuditService.getUserActivityLogs({
        userId: userId as string,
        action: action as string,
        entityType: entityType as string,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
        take: take ? parseInt(take as string) : 100,
        skip: skip ? parseInt(skip as string) : 0,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  /**
   * 4. Audit Sessions
   */
  static async getSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, auditType, search, startDate, endDate } = req.query;
      const sessions = await AuditSessionService.getSessions({
        status: status as any,
        auditType: auditType as any,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data: sessions });
    } catch (err) { next(err); }
  }

  static async createSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const session = await AuditSessionService.createSession({
        ...req.body,
        auditorId: req.user!.id,
      });
      res.status(201).json({ success: true, data: session });
    } catch (err) { next(err); }
  }

  static async getSessionById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const session = await AuditSessionService.getSessionById(req.params.id);
      res.json({ success: true, data: session });
    } catch (err) { next(err); }
  }

  static async updateSessionStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const session = await AuditSessionService.updateSessionStatus(req.params.id, {
        ...req.body,
        userId: req.user!.id,
      });
      res.json({ success: true, data: session });
    } catch (err) { next(err); }
  }

  /**
   * 5. Inventory Audits
   */
  static async getInventoryWorksheet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const worksheet = await InventoryAuditService.getAuditWorksheet();
      res.json({ success: true, data: worksheet });
    } catch (err) { next(err); }
  }

  static async recordInventoryAudit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { auditSessionId, physicalCounts } = req.body;
      const result = await InventoryAuditService.recordInventoryAudit(
        auditSessionId,
        physicalCounts,
        req.user!.id
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  static async resolveInventoryItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      const result = await InventoryAuditService.resolveAuditItem(
        req.params.id,
        reason,
        req.user!.id
      );
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /**
   * 6. Audit Findings & CAPA
   */
  static async getFindings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { auditSessionId, category, severity, status, assignedToId, search } = req.query;
      const findings = await FindingsService.getFindings({
        auditSessionId: auditSessionId as string,
        category: category as any,
        severity: severity as any,
        status: status as any,
        assignedToId: assignedToId as string,
        search: search as string,
      });
      res.json({ success: true, data: findings });
    } catch (err) { next(err); }
  }

  static async createFinding(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const finding = await FindingsService.createFinding({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: finding });
    } catch (err) { next(err); }
  }

  static async updateFinding(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const finding = await FindingsService.updateFindingStatus(req.params.id, {
        ...req.body,
        userId: req.user!.id,
      });
      res.json({ success: true, data: finding });
    } catch (err) { next(err); }
  }

  /**
   * 7. Compliance & Food Safety
   */
  static async getFoodSafetyChecks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { category, isCompliant, startDate, endDate } = req.query;
      const checks = await ComplianceService.getFoodSafetyChecks({
        category: category as any,
        isCompliant: isCompliant !== undefined ? isCompliant === 'true' : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data: checks });
    } catch (err) { next(err); }
  }

  static async recordFoodSafetyCheck(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const check = await ComplianceService.recordFoodSafetyCheck({
        ...req.body,
        inspectorId: req.user!.id,
      });
      res.status(201).json({ success: true, data: check });
    } catch (err) { next(err); }
  }

  static async getBatchExpiry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expiryData = await ComplianceService.getBatchExpiryAudit();
      res.json({ success: true, data: expiryData });
    } catch (err) { next(err); }
  }

  static async getBatchTraceability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trace = await ComplianceService.getFullBatchTraceability(req.params.batchNumber);
      res.json({ success: true, data: trace });
    } catch (err) { next(err); }
  }

  /**
   * 8. Reports & Document Export (PDF / Excel)
   */
  static async getReportData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      let data: any;

      if (type === 'inventory') {
        data = await AuditReportService.getInventoryAuditReport();
      } else if (type === 'production') {
        data = await AuditReportService.getProductionAuditReport();
      } else if (type === 'financial') {
        data = await AuditReportService.getSalesFinancialAuditReport();
      } else if (type === 'compliance') {
        data = await AuditReportService.getComplianceReport();
      } else {
        data = await AuditReportService.getUserActivityReport();
      }

      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async exportReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;
      const { format } = req.query;

      if (format === 'pdf') {
        const pdfBuffer = await AuditReportService.generateAuditReportPDF(type);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="audit-report-${type}-${new Date().toISOString().slice(0, 10)}.pdf"`);
        return res.send(pdfBuffer);
      }

      // Default to Excel (.xlsx)
      const excelBuffer = await AuditReportService.generateAuditReportExcel(type);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="audit-report-${type}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      return res.send(excelBuffer);
    } catch (err) { next(err); }
  }
}
