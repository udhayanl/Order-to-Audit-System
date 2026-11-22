import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Layout } from './components/layout/Layout.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';

// Pages
import { LoginPage } from './pages/auth/LoginPage.js';
import { DashboardRouter } from './pages/dashboard/DashboardRouter.js';
import { OrdersListPage } from './pages/orders/OrdersListPage.js';
import { NewOrderPage } from './pages/orders/NewOrderPage.js';
import { OrderDetailPage } from './pages/orders/OrderDetailPage.js';
import { SalesDashboardPage } from './pages/sales/SalesDashboardPage.js';
import { SalesmanMobileOrderPage } from './pages/sales/SalesmanMobileOrderPage.js';
import { StockAllocationPage } from './pages/sales/StockAllocationPage.js';
import { SalesReturnsPage } from './pages/sales/SalesReturnsPage.js';
import { CreditNotesPage } from './pages/sales/CreditNotesPage.js';
import { InvoicesListPage } from './pages/invoices/InvoicesListPage.js';
import { InvoiceDetailPage } from './pages/invoices/InvoiceDetailPage.js';
import { DispatchListPage } from './pages/dispatches/DispatchListPage.js';
import { PurchasesListPage } from './pages/purchases/PurchasesListPage.js';
import { ProductionDashboardPage } from './pages/production/ProductionDashboardPage.js';
import { ProductionOrdersPage } from './pages/production/ProductionOrdersPage.js';
import { ProductionOrderDetailPage } from './pages/production/ProductionOrderDetailPage.js';
import { MaterialIssuesPage } from './pages/production/MaterialIssuesPage.js';
import { ProductionExecutionPage } from './pages/production/ProductionExecutionPage.js';
import { QualityControlPage } from './pages/production/QualityControlPage.js';
import { BatchTraceabilityPage } from './pages/production/BatchTraceabilityPage.js';
import { ProductionRunsPage } from './pages/production/ProductionRunsPage.js';
import { NewProductionRunPage } from './pages/production/NewProductionRunPage.js';
import { BOMListPage } from './pages/production/BOMListPage.js';
import { RawMaterialsPage } from './pages/inventory/RawMaterialsPage.js';
import { PackagingMaterialsPage } from './pages/inventory/PackagingMaterialsPage.js';
import { StockLedgerPage } from './pages/inventory/StockLedgerPage.js';
import { InventoryOverviewPage } from './pages/inventory/InventoryOverviewPage.js';
import { FinishedGoodsPage } from './pages/inventory/FinishedGoodsPage.js';
import { StockAdjustmentsPage } from './pages/inventory/StockAdjustmentsPage.js';
import { InventoryValuationPage } from './pages/inventory/InventoryValuationPage.js';
import { LowStockAlertsPage } from './pages/inventory/LowStockAlertsPage.js';
import { StockReconciliationPage } from './pages/inventory/StockReconciliationPage.js';
import { OpeningStockPage } from './pages/inventory/OpeningStockPage.js';
import { PaymentsListPage } from './pages/payments/PaymentsListPage.js';
import { AgeingReportPage } from './pages/payments/AgeingReportPage.js';
import { CustomersPage } from './pages/masters/CustomersPage.js';
import { ProductsPage } from './pages/masters/ProductsPage.js';
import { SuppliersPage } from './pages/masters/SuppliersPage.js';
import { SalesRegisterPage } from './pages/reports/SalesRegisterPage.js';
import { GstSummaryPage } from './pages/reports/GstSummaryPage.js';
import { PurchaseRegisterPage } from './pages/reports/PurchaseRegisterPage.js';
import { ProductionReportPage } from './pages/reports/ProductionReportPage.js';
import { ExportCentrePage } from './pages/reports/ExportCentrePage.js';
import { AuditLogsPage } from './pages/audit/AuditLogsPage.js';

// Phase 7 Audit Management & Compliance Pages
import { AuditDashboardPage } from './pages/audit/AuditDashboardPage.js';
import { AuditTrailPage } from './pages/audit/AuditTrailPage.js';
import { InventoryAuditPage } from './pages/audit/InventoryAuditPage.js';
import { AuditFindingsPage } from './pages/audit/AuditFindingsPage.js';
import { CompliancePage } from './pages/audit/CompliancePage.js';
import { AuditReportsExportPage } from './pages/audit/AuditReportsExportPage.js';

// Phase 6 Finance & Accounting Pages
import { FinancialDashboardPage } from './pages/finance/FinancialDashboardPage.js';
import { CustomerPaymentsPage } from './pages/finance/CustomerPaymentsPage.js';
import { SupplierPaymentsPage } from './pages/finance/SupplierPaymentsPage.js';
import { AccountsReceivablePage } from './pages/finance/AccountsReceivablePage.js';
import { AccountsPayablePage } from './pages/finance/AccountsPayablePage.js';
import { ExpensesPage } from './pages/finance/ExpensesPage.js';
import { CashBankAccountsPage } from './pages/finance/CashBankAccountsPage.js';
import { CashbookBankbookPage } from './pages/finance/CashbookBankbookPage.js';
import { GeneralLedgerPage } from './pages/finance/GeneralLedgerPage.js';
import { TrialBalancePage } from './pages/finance/TrialBalancePage.js';
import { ProfitLossPage } from './pages/finance/ProfitLossPage.js';
import { BankReconciliationPage } from './pages/finance/BankReconciliationPage.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading FactoryFlow...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardRouter />} />

            {/* Orders & Sales */}
            <Route path="sales/dashboard" element={<SalesDashboardPage />} />
            <Route path="sales/mobile-order" element={<SalesmanMobileOrderPage />} />
            <Route path="sales/allocations" element={<StockAllocationPage />} />
            <Route path="sales/returns" element={<SalesReturnsPage />} />
            <Route path="sales/credit-notes" element={<CreditNotesPage />} />
            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/new" element={<NewOrderPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />

            {/* Invoices */}
            <Route path="invoices" element={<InvoicesListPage />} />
            <Route path="invoices/:id" element={<InvoiceDetailPage />} />

            {/* Dispatches */}
            <Route path="dispatches" element={<DispatchListPage />} />

            {/* Purchases & Goods Receipts */}
            <Route path="purchases" element={<PurchasesListPage />} />
            <Route path="goods-receipts" element={<PurchasesListPage />} />

            {/* Production */}
            <Route path="production" element={<ProductionDashboardPage />} />
            <Route path="production/dashboard" element={<ProductionDashboardPage />} />
            <Route path="production/orders" element={<ProductionOrdersPage />} />
            <Route path="production/orders/:id" element={<ProductionOrderDetailPage />} />
            <Route path="production/material-issues" element={<MaterialIssuesPage />} />
            <Route path="production/executions" element={<ProductionExecutionPage />} />
            <Route path="production/quality" element={<QualityControlPage />} />
            <Route path="production/traceability" element={<BatchTraceabilityPage />} />
            <Route path="production/runs" element={<ProductionRunsPage />} />
            <Route path="production/new" element={<NewProductionRunPage />} />
            <Route path="boms" element={<BOMListPage />} />

            {/* Inventory & Stock Ledger */}
            <Route path="inventory" element={<InventoryOverviewPage />} />
            <Route path="inventory/overview" element={<InventoryOverviewPage />} />
            <Route path="inventory/raw" element={<RawMaterialsPage />} />
            <Route path="inventory/packaging" element={<PackagingMaterialsPage />} />
            <Route path="inventory/finished-goods" element={<FinishedGoodsPage />} />
            <Route path="inventory/ledger" element={<StockLedgerPage />} />
            <Route path="inventory/adjustments" element={<StockAdjustmentsPage />} />
            <Route path="inventory/valuation" element={<InventoryValuationPage />} />
            <Route path="inventory/low-stock" element={<LowStockAlertsPage />} />
            <Route path="inventory/reconciliation" element={<StockReconciliationPage />} />
            <Route path="inventory/opening-stock" element={<OpeningStockPage />} />

            {/* Payments & Ageing */}
            <Route path="payments" element={<PaymentsListPage />} />

            {/* Phase 6 Financial Management & Accounting */}
            <Route path="finance/dashboard" element={<FinancialDashboardPage />} />
            <Route path="finance/accounts" element={<CashBankAccountsPage />} />
            <Route path="finance/cashbook-bankbook" element={<CashbookBankbookPage />} />
            <Route path="finance/customer-payments" element={<CustomerPaymentsPage />} />
            <Route path="finance/receivables" element={<AccountsReceivablePage />} />
            <Route path="finance/supplier-payments" element={<SupplierPaymentsPage />} />
            <Route path="finance/payables" element={<AccountsPayablePage />} />
            <Route path="finance/expenses" element={<ExpensesPage />} />
            <Route path="finance/general-ledger" element={<GeneralLedgerPage />} />
            <Route path="finance/trial-balance" element={<TrialBalancePage />} />
            <Route path="finance/profit-loss" element={<ProfitLossPage />} />
            <Route path="finance/reconciliation" element={<BankReconciliationPage />} />

            {/* Master Data */}
            <Route path="customers" element={<CustomersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />

            {/* Reports */}
            <Route path="reports/sales-register" element={<SalesRegisterPage />} />
            <Route path="reports/gst-summary" element={<GstSummaryPage />} />
            <Route path="reports/purchase-register" element={<PurchaseRegisterPage />} />
            <Route path="reports/production" element={<ProductionReportPage />} />
            <Route path="reports/ageing" element={<AgeingReportPage />} />
            <Route path="reports/export" element={<ExportCentrePage />} />

            {/* Audit Logs & Phase 7 Audit Management */}
            <Route path="audit-logs" element={<AuditTrailPage />} />
            <Route path="audit/dashboard" element={<AuditDashboardPage />} />
            <Route path="audit/trail" element={<AuditTrailPage />} />
            <Route path="audit/inventory" element={<InventoryAuditPage />} />
            <Route path="audit/findings" element={<AuditFindingsPage />} />
            <Route path="audit/compliance" element={<CompliancePage />} />
            <Route path="audit/reports" element={<AuditReportsExportPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
