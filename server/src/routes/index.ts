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

// ================= SYSTEM HEALTH ROUTE =================
router.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// ================= AUTH ROUTES =================
router.post('/auth/login', AuthController.login);
router.get('/auth/me', authenticateJWT, AuthController.getMe);

// ================= MASTER DATA ROUTES =================
// Product Categories
router.get('/master/categories', authenticateJWT, MasterController.getCategories);
router.get('/categories', authenticateJWT, MasterController.getCategories);
router.post('/master/categories', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createCategory);
router.post('/categories', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createCategory);
router.put('/master/categories/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateCategory);
router.put('/categories/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateCategory);
router.delete('/master/categories/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteCategory);
router.delete('/categories/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteCategory);

// Products
router.get('/master/products', authenticateJWT, MasterController.getProducts);
router.get('/products', authenticateJWT, MasterController.getProducts);
router.get('/master/products/:id', authenticateJWT, MasterController.getProductById);
router.get('/products/:id', authenticateJWT, MasterController.getProductById);
router.post('/master/products', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createProduct);
router.post('/products', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createProduct);
router.put('/master/products/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateProduct);
router.put('/products/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateProduct);
router.patch('/master/products/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.patchProductStatus);
router.patch('/products/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.patchProductStatus);
router.delete('/master/products/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteProduct);
router.delete('/products/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteProduct);
router.get('/products/:id/boms', authenticateJWT, MasterController.getProductBOMs);

// Customers
router.get('/master/customers', authenticateJWT, MasterController.getCustomers);
router.get('/customers', authenticateJWT, MasterController.getCustomers);
router.get('/master/customers/:id', authenticateJWT, MasterController.getCustomerById);
router.get('/customers/:id', authenticateJWT, MasterController.getCustomerById);
router.post('/master/customers', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createCustomer);
router.post('/customers', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createCustomer);
router.put('/master/customers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateCustomer);
router.put('/customers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateCustomer);
router.patch('/master/customers/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.patchCustomerStatus);
router.patch('/customers/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.patchCustomerStatus);
router.delete('/master/customers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteCustomer);
router.delete('/customers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteCustomer);

// Suppliers
router.get('/master/suppliers', authenticateJWT, MasterController.getSuppliers);
router.get('/suppliers', authenticateJWT, MasterController.getSuppliers);
router.get('/master/suppliers/:id', authenticateJWT, MasterController.getSupplierById);
router.get('/suppliers/:id', authenticateJWT, MasterController.getSupplierById);
router.post('/master/suppliers', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createSupplier);
router.post('/suppliers', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createSupplier);
router.put('/master/suppliers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateSupplier);
router.put('/suppliers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.updateSupplier);
router.patch('/master/suppliers/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.patchSupplierStatus);
router.patch('/suppliers/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.patchSupplierStatus);
router.delete('/master/suppliers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteSupplier);
router.delete('/suppliers/:id', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.deleteSupplier);

// Raw Materials
router.get('/master/raw-materials', authenticateJWT, MasterController.getRawMaterials);
router.get('/raw-materials', authenticateJWT, MasterController.getRawMaterials);
router.get('/master/raw-materials/:id', authenticateJWT, MasterController.getRawMaterialById);
router.get('/raw-materials/:id', authenticateJWT, MasterController.getRawMaterialById);
router.post('/master/raw-materials', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createRawMaterial);
router.post('/raw-materials', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createRawMaterial);
router.put('/master/raw-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updateRawMaterial);
router.put('/raw-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updateRawMaterial);
router.patch('/master/raw-materials/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.patchRawMaterialStatus);
router.patch('/raw-materials/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.patchRawMaterialStatus);
router.delete('/master/raw-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.deleteRawMaterial);
router.delete('/raw-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.deleteRawMaterial);

// Packaging Materials
router.get('/master/packaging-materials', authenticateJWT, MasterController.getPackagingMaterials);
router.get('/packaging-materials', authenticateJWT, MasterController.getPackagingMaterials);
router.get('/master/packaging-materials/:id', authenticateJWT, MasterController.getPackagingMaterialById);
router.get('/packaging-materials/:id', authenticateJWT, MasterController.getPackagingMaterialById);
router.post('/master/packaging-materials', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createPackagingMaterial);
router.post('/packaging-materials', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createPackagingMaterial);
router.put('/master/packaging-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updatePackagingMaterial);
router.put('/packaging-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updatePackagingMaterial);
router.patch('/master/packaging-materials/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.patchPackagingStatus);
router.patch('/packaging-materials/:id/status', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.patchPackagingStatus);
router.delete('/master/packaging-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.deletePackagingMaterial);
router.delete('/packaging-materials/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.deletePackagingMaterial);

// Bill of Materials (BOM)
router.get('/master/boms', authenticateJWT, MasterController.getBOMs);
router.get('/boms', authenticateJWT, MasterController.getBOMs);
router.get('/master/boms/:id', authenticateJWT, MasterController.getBOMById);
router.get('/boms/:id', authenticateJWT, MasterController.getBOMById);
router.post('/master/boms', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createBOM);
router.post('/boms', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.createBOM);
router.put('/master/boms/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updateBOM);
router.put('/boms/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.updateBOM);
router.post('/master/boms/:id/activate', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.activateBOM);
router.post('/boms/:id/activate', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.activateBOM);
router.delete('/master/boms/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.deleteBOM);
router.delete('/boms/:id', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), MasterController.deleteBOM);

// Units of Measure & Conversions
router.get('/master/uom', authenticateJWT, MasterController.getUOMs);
router.get('/units', authenticateJWT, MasterController.getUnits);
router.post('/units', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createUnit);
router.post('/master/uom/convert', authenticateJWT, MasterController.convertUOM);
router.get('/unit-conversions', authenticateJWT, MasterController.getUnitConversions);
router.post('/unit-conversions', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), MasterController.createUnitConversion);

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
router.post('/purchases', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), PurchaseController.createPurchase);
router.post('/purchases/record', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), PurchaseController.recordPurchase);
router.get('/purchases', authenticateJWT, PurchaseController.getPurchases);
router.get('/purchases/:id', authenticateJWT, PurchaseController.getPurchaseById);
router.post('/purchases/:id/confirm', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), PurchaseController.confirmPurchase);
router.post('/purchases/:id/receive', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), PurchaseController.receivePurchase);

// Goods Receipt Note (GRN) Routes
router.get('/goods-receipts', authenticateJWT, PurchaseController.getGoodsReceipts);
router.get('/goods-receipts/:id', authenticateJWT, PurchaseController.getGoodsReceiptById);
router.post('/goods-receipts', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), PurchaseController.postGoodsReceipt);
router.post('/goods-receipts/:id/post', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), PurchaseController.postGoodsReceipt);

// ================= INVENTORY ROUTES =================
router.get('/inventory/summary', authenticateJWT, InventoryController.getSummary);
router.get('/inventory/raw-materials', authenticateJWT, InventoryController.getRawMaterials);
router.get('/inventory/packaging-materials', authenticateJWT, InventoryController.getPackagingMaterials);
router.get('/inventory/finished-goods', authenticateJWT, InventoryController.getFinishedGoods);
router.get('/inventory/items/:id', authenticateJWT, InventoryController.getItemDetails);
router.get('/inventory/items/:id/ledger', authenticateJWT, InventoryController.getItemLedger);
router.get('/inventory/ledger', authenticateJWT, InventoryController.getLedger);
router.get('/inventory/low-stock', authenticateJWT, InventoryController.getLowStock);
router.get('/inventory/valuation', authenticateJWT, InventoryController.getValuation);
router.get('/inventory/reconciliation', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR), InventoryController.getReconciliation);
router.post('/inventory/reconcile', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InventoryController.autoReconcile);

// Opening stock setup
router.post('/inventory/opening-stock', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InventoryController.createOpeningStock);
router.get('/inventory/opening-stock', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER, Role.ACCOUNTANT_AUDITOR), InventoryController.getOpeningStockRecords);

// Stock adjustments
router.post('/inventory/adjustments', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER), InventoryController.createAdjustment);
router.post('/inventory/adjust', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InventoryController.createAdjustment);
router.get('/inventory/adjustments', authenticateJWT, requireRole(Role.ADMIN, Role.PRODUCTION_SUPERVISOR, Role.OWNER, Role.ACCOUNTANT_AUDITOR), InventoryController.getAdjustments);
router.post('/inventory/adjustments/:id/approve', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InventoryController.approveAdjustment);
router.post('/inventory/adjustments/:id/reject', authenticateJWT, requireRole(Role.ADMIN, Role.OWNER), InventoryController.rejectAdjustment);

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
