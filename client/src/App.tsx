import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Layout } from './components/layout/Layout.js';

// Pages
import { LoginPage } from './pages/auth/LoginPage.js';
import { DashboardRouter } from './pages/dashboard/DashboardRouter.js';
import { OrdersListPage } from './pages/orders/OrdersListPage.js';
import { NewOrderPage } from './pages/orders/NewOrderPage.js';
import { OrderDetailPage } from './pages/orders/OrderDetailPage.js';
import { InvoicesListPage } from './pages/invoices/InvoicesListPage.js';
import { InvoiceDetailPage } from './pages/invoices/InvoiceDetailPage.js';
import { DispatchListPage } from './pages/dispatches/DispatchListPage.js';
import { PurchasesListPage } from './pages/purchases/PurchasesListPage.js';
import { ProductionRunsPage } from './pages/production/ProductionRunsPage.js';
import { NewProductionRunPage } from './pages/production/NewProductionRunPage.js';
import { BOMListPage } from './pages/production/BOMListPage.js';
import { RawMaterialsPage } from './pages/inventory/RawMaterialsPage.js';
import { PackagingMaterialsPage } from './pages/inventory/PackagingMaterialsPage.js';
import { StockLedgerPage } from './pages/inventory/StockLedgerPage.js';
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

            {/* Orders */}
            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/new" element={<NewOrderPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />

            {/* Invoices */}
            <Route path="invoices" element={<InvoicesListPage />} />
            <Route path="invoices/:id" element={<InvoiceDetailPage />} />

            {/* Dispatches */}
            <Route path="dispatches" element={<DispatchListPage />} />

            {/* Purchases */}
            <Route path="purchases" element={<PurchasesListPage />} />

            {/* Production */}
            <Route path="production/runs" element={<ProductionRunsPage />} />
            <Route path="production/new" element={<NewProductionRunPage />} />
            <Route path="boms" element={<BOMListPage />} />

            {/* Inventory */}
            <Route path="inventory/raw" element={<RawMaterialsPage />} />
            <Route path="inventory/packaging" element={<PackagingMaterialsPage />} />
            <Route path="inventory/ledger" element={<StockLedgerPage />} />

            {/* Payments & Ageing */}
            <Route path="payments" element={<PaymentsListPage />} />

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

            {/* Audit Logs */}
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
