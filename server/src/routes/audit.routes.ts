import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateJWT, requireRole } from '../middleware/auth.js';
import { AuditController } from '../controllers/audit.controller.js';

const router = Router();

// Base Audit Role Guard: ADMIN, OWNER, ACCOUNTANT_AUDITOR
const auditorGuard = [authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR)];

// Dashboard & Metrics
router.get('/dashboard', ...auditorGuard, AuditController.getDashboardMetrics);

// System Audit Trail & User Activity Logs
router.get('/trail', ...auditorGuard, AuditController.getAuditTrail);
router.get('/logs', ...auditorGuard, AuditController.getAuditTrail); // Backwards-compatible
router.get('/user-activity', ...auditorGuard, AuditController.getUserActivity);

// Audit Sessions
router.get('/sessions', ...auditorGuard, AuditController.getSessions);
router.post('/sessions', ...auditorGuard, AuditController.createSession);
router.get('/sessions/:id', ...auditorGuard, AuditController.getSessionById);
router.patch('/sessions/:id/status', ...auditorGuard, AuditController.updateSessionStatus);

// Inventory Audit & Physical Stock Count
router.get('/inventory/worksheet', ...auditorGuard, AuditController.getInventoryWorksheet);
router.post('/inventory/record', ...auditorGuard, AuditController.recordInventoryAudit);
router.post('/inventory/items/:id/resolve', ...auditorGuard, AuditController.resolveInventoryItem);

// Audit Findings & CAPA
router.get('/findings', ...auditorGuard, AuditController.getFindings);
router.post('/findings', ...auditorGuard, AuditController.createFinding);
router.patch('/findings/:id', ...auditorGuard, AuditController.updateFinding);

// Compliance & Food Safety (FSSAI)
router.get('/compliance/food-safety', ...auditorGuard, AuditController.getFoodSafetyChecks);
router.post('/compliance/food-safety', ...auditorGuard, AuditController.recordFoodSafetyCheck);
router.get('/compliance/expiry', ...auditorGuard, AuditController.getBatchExpiry);
router.get('/compliance/traceability/:batchNumber', ...auditorGuard, AuditController.getBatchTraceability);

// Audit Reports & Export
router.get('/reports/:type', ...auditorGuard, AuditController.getReportData);
router.get('/reports/:type/export', ...auditorGuard, AuditController.exportReport);

export default router;
