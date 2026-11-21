import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateJWT, requireRole } from '../middleware/auth.js';
import { AuthController } from '../controllers/auth.controller.js';
import { MasterController } from '../controllers/master.controller.js';
import { OrderController } from '../controllers/order.controller.js';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { DispatchController } from '../controllers/dispatch.controller.js';
import { ProductionController } from '../controllers/production.controller.js';
import { PurchaseController } from '../controllers/purchase.controller.js';
import { InventoryController } from '../controllers/inventory.controller.js';
import { PaymentController } from '../controllers/payment.controller.js';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { ReportController } from '../controllers/report.controller.js';
import { AuditController } from '../controllers/audit.controller.js';

const router = Router();

// ================= AUTH ROUTES =================
router.post('/auth/login', AuthController.login);
router.get('/auth/me', authenticateJWT, AuthController.getMe);

// ================= MASTER DATA ROUTES =================
router.get('/master/products', authenticateJWT, MasterController.getProducts);
router.post('/master/products', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createProduct);
router.put('/master/products/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateProduct);

router.get('/master/customers', authenticateJWT, MasterController.getCustomers);
router.post('/master/customers', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createCustomer);
router.put('/master/customers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateCustomer);

router.get('/master/suppliers', authenticateJWT, MasterController.getSuppliers);
router.post('/master/suppliers', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createSupplier);
router.put('/master/suppliers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateSupplier);

router.get('/master/raw-materials', authenticateJWT, MasterController.getRawMaterials);
router.post('/master/raw-materials', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createRawMaterial);
router.put('/master/raw-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updateRawMaterial);

router.get('/master/packaging-materials', authenticateJWT, MasterController.getPackagingMaterials);
router.post('/master/packaging-materials', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createPackagingMaterial);
router.put('/master/packaging-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updatePackagingMaterial);

router.get('/master/boms', authenticateJWT, MasterController.getBOMs);
router.post('/master/boms', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createBOM);

// ================= ORDER ROUTES =================
router.post('/orders', authenticateJWT, requireRole(Role.SALESMAN, Role.ADMIN, Role.OWNER), OrderController.createOrder);
router.get('/orders', authenticateJWT, OrderController.getOrders);
router.get('/orders/:id', authenticateJWT, OrderController.getOrderById);
router.put('/orders/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), OrderController.updateOrder);
router.get('/orders/:id/check-stock', authenticateJWT, OrderController.checkStock);
router.post('/orders/:id/approve', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), OrderController.approveOrder);
router.post('/orders/:id/reject', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), OrderController.rejectOrder);

// ================= INVOICE ROUTES =================
router.post('/invoices/create-from-order', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InvoiceController.createFromOrder);
router.get('/invoices', authenticateJWT, InvoiceController.getInvoices);
router.get('/invoices/:id', authenticateJWT, InvoiceController.getInvoiceById);
router.get('/invoices/:id/pdf', authenticateJWT, InvoiceController.downloadPDF);
router.post('/invoices/:id/cancel', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InvoiceController.cancelInvoice);

// ================= DISPATCH ROUTES =================
router.post('/dispatches', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), DispatchController.createDispatch);
router.get('/dispatches', authenticateJWT, DispatchController.getDispatches);

// ================= PRODUCTION ROUTES =================
router.post('/production/calculate-planned', authenticateJWT, requireRole(Role.PRODUCTION_SUPERVISOR, Role.ADMIN, Role.OWNER), ProductionController.calculatePlanned);
router.post('/production/runs', authenticateJWT, requireRole(Role.PRODUCTION_SUPERVISOR, Role.ADMIN, Role.OWNER), ProductionController.createRun);
router.get('/production/runs', authenticateJWT, ProductionController.getRuns);
router.get('/production/runs/:id', authenticateJWT, ProductionController.getRunById);

// ================= PURCHASE ROUTES =================
router.post('/purchases', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), PurchaseController.recordPurchase);
router.get('/purchases', authenticateJWT, PurchaseController.getPurchases);

// ================= INVENTORY ROUTES =================
router.get('/inventory/summary', authenticateJWT, InventoryController.getSummary);
router.get('/inventory/ledger', authenticateJWT, InventoryController.getLedger);
router.post('/inventory/adjust', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InventoryController.createAdjustment);

// ================= PAYMENT ROUTES =================
router.post('/payments', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), PaymentController.recordPayment);
router.get('/payments', authenticateJWT, PaymentController.getPayments);
router.get('/payments/ageing', authenticateJWT, PaymentController.getAgeing);

// ================= DASHBOARD ROUTES =================
router.get('/dashboard/stats', authenticateJWT, DashboardController.getStats);

// ================= REPORT ROUTES (Read-only, Auditor / Admin / Owner) =================
router.get('/reports/sales-register', authenticateJWT, ReportController.getSalesRegister);
router.get('/reports/customer-sales', authenticateJWT, ReportController.getCustomerWiseSales);
router.get('/reports/product-sales', authenticateJWT, ReportController.getProductWiseSales);
router.get('/reports/gst-summary', authenticateJWT, ReportController.getGSTSummary);
router.get('/reports/purchase-register', authenticateJWT, ReportController.getPurchaseRegister);
router.get('/reports/stock-summary', authenticateJWT, ReportController.getStockSummary);
router.get('/reports/production', authenticateJWT, ReportController.getProductionReport);
router.get('/reports/ageing', authenticateJWT, ReportController.getAgeingReport);

// ================= AUDIT LOG ROUTES =================
router.get('/audit/logs', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR), AuditController.getLogs);

export default router;
