import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  ShoppingCart,
  PlusCircle,
  FileText,
  Truck,
  Package,
  Layers,
  Archive,
  DollarSign,
  TrendingUp,
  Users,
  Settings,
  History,
  ClipboardList,
  Download,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Boxes,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user } = useAuth();
  const role = user?.role;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 font-semibold border-l-4 border-brand-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col p-4 space-y-5 shadow-2xl transition-transform duration-200 ease-in-out md:relative md:translate-x-0 md:min-h-[calc(100vh-4rem)] md:shadow-none md:z-10 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex items-center justify-between md:hidden pb-3 border-b border-gray-100">
          <span className="font-bold text-sm text-gray-900">Navigation Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Core Section */}
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Overview
          </div>
          <nav className="space-y-1">
            <NavLink to="/dashboard" onClick={handleNavClick} className={linkClass}>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </NavLink>
          </nav>
        </div>

      {/* 2. Role-specific workflows */}
      {/* SALESMAN MENU */}
      {role === 'SALESMAN' && (
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Sales Activities
          </div>
          <nav className="space-y-1">
            <NavLink to="/orders/new" onClick={handleNavClick} className={linkClass}>
              <PlusCircle className="w-4 h-4 text-brand-600" />
              New Order
            </NavLink>
            <NavLink to="/orders" onClick={handleNavClick} className={linkClass}>
              <ShoppingCart className="w-4 h-4" />
              My Orders
            </NavLink>
            <NavLink to="/customers" onClick={handleNavClick} className={linkClass}>
              <Users className="w-4 h-4" />
              My Customers
            </NavLink>
            <NavLink to="/products" onClick={handleNavClick} className={linkClass}>
              <Package className="w-4 h-4" />
              Product Catalogue
            </NavLink>
          </nav>
        </div>
      )}

      {/* ADMIN MENU */}
      {role === 'ADMIN' && (
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Order & Dispatch
          </div>
          <nav className="space-y-1">
            <NavLink to="/orders" onClick={handleNavClick} className={linkClass}>
              <ShoppingCart className="w-4 h-4" />
              Incoming Orders
            </NavLink>
            <NavLink to="/invoices" onClick={handleNavClick} className={linkClass}>
              <FileText className="w-4 h-4" />
              GST Invoices
            </NavLink>
            <NavLink to="/dispatches" onClick={handleNavClick} className={linkClass}>
              <Truck className="w-4 h-4" />
              Dispatches
            </NavLink>
            <NavLink to="/purchases" onClick={handleNavClick} className={linkClass}>
              <Archive className="w-4 h-4" />
              Raw Purchases
            </NavLink>
            <NavLink to="/payments" onClick={handleNavClick} className={linkClass}>
              <DollarSign className="w-4 h-4" />
              Payments & Ageing
            </NavLink>
          </nav>
        </div>
      )}

      {/* PRODUCTION SUPERVISOR MENU */}
      {role === 'PRODUCTION_SUPERVISOR' && (
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Manufacturing
          </div>
          <nav className="space-y-1">
            <NavLink to="/production/new" onClick={handleNavClick} className={linkClass}>
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              New Production Run
            </NavLink>
            <NavLink to="/production/runs" onClick={handleNavClick} className={linkClass}>
              <ClipboardList className="w-4 h-4" />
              Production History
            </NavLink>
            <NavLink to="/boms" onClick={handleNavClick} className={linkClass}>
              <Layers className="w-4 h-4" />
              BOM Recipes
            </NavLink>
            <NavLink to="/inventory/raw" onClick={handleNavClick} className={linkClass}>
              <Archive className="w-4 h-4" />
              Raw Materials Stock
            </NavLink>
            <NavLink to="/inventory/packaging" onClick={handleNavClick} className={linkClass}>
              <Package className="w-4 h-4" />
              Packaging Stock
            </NavLink>
            <NavLink to="/purchases" onClick={handleNavClick} className={linkClass}>
              <Archive className="w-4 h-4" />
              Material Receipts
            </NavLink>
          </nav>
        </div>
      )}

      {/* ACCOUNTANT & AUDITOR MENU */}
      {role === 'ACCOUNTANT_AUDITOR' && (
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Audit & Registers
          </div>
          <nav className="space-y-1">
            <NavLink to="/reports/sales-register" onClick={handleNavClick} className={linkClass}>
              <FileText className="w-4 h-4" />
              Sales Register
            </NavLink>
            <NavLink to="/reports/gst-summary" onClick={handleNavClick} className={linkClass}>
              <TrendingUp className="w-4 h-4" />
              GST (GSTR-1 / 3B)
            </NavLink>
            <NavLink to="/reports/purchase-register" onClick={handleNavClick} className={linkClass}>
              <Archive className="w-4 h-4" />
              Purchase Register
            </NavLink>
            <NavLink to="/inventory/ledger" onClick={handleNavClick} className={linkClass}>
              <History className="w-4 h-4" />
              Stock Ledger
            </NavLink>
            <NavLink to="/reports/production" onClick={handleNavClick} className={linkClass}>
              <ClipboardList className="w-4 h-4" />
              Production Costing
            </NavLink>
            <NavLink to="/reports/ageing" onClick={handleNavClick} className={linkClass}>
              <DollarSign className="w-4 h-4" />
              Outstanding Ageing
            </NavLink>
            <NavLink to="/reports/export" onClick={handleNavClick} className={linkClass}>
              <Download className="w-4 h-4" />
              Export Centre
            </NavLink>
            <NavLink to="/audit-logs" onClick={handleNavClick} className={linkClass}>
              <Shield className="w-4 h-4" />
              Audit Log
            </NavLink>
          </nav>
        </div>
      )}

      {/* OWNER MENU */}
      {role === 'OWNER' && (
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Executive Controls
          </div>
          <nav className="space-y-1">
            <NavLink to="/orders" onClick={handleNavClick} className={linkClass}>
              <ShoppingCart className="w-4 h-4" />
              Sales & Orders
            </NavLink>
            <NavLink to="/production/runs" onClick={handleNavClick} className={linkClass}>
              <ClipboardList className="w-4 h-4" />
              Factory Production
            </NavLink>
            <NavLink to="/inventory/ledger" onClick={handleNavClick} className={linkClass}>
              <History className="w-4 h-4" />
              Stock Ledger
            </NavLink>
            <NavLink to="/reports/production" onClick={handleNavClick} className={linkClass}>
              <TrendingUp className="w-4 h-4" />
              Cost & Margins
            </NavLink>
            <NavLink to="/reports/ageing" onClick={handleNavClick} className={linkClass}>
              <DollarSign className="w-4 h-4" />
              Receivables Ageing
            </NavLink>
            <NavLink to="/audit-logs" onClick={handleNavClick} className={linkClass}>
              <Shield className="w-4 h-4" />
              Audit Trail
            </NavLink>
          </nav>
        </div>
      )}

      {/* INVENTORY & STOCK MANAGEMENT */}
      {(role === 'ADMIN' || role === 'OWNER' || role === 'PRODUCTION_SUPERVISOR' || role === 'ACCOUNTANT_AUDITOR') && (
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Inventory & Stock
          </div>
          <nav className="space-y-1">
            <NavLink to="/inventory" onClick={handleNavClick} className={linkClass}>
              <Boxes className="w-4 h-4 text-brand-600" />
              Stock Overview
            </NavLink>
            <NavLink to="/inventory/finished-goods" onClick={handleNavClick} className={linkClass}>
              <Layers className="w-4 h-4 text-indigo-600" />
              Finished Goods
            </NavLink>
            <NavLink to="/inventory/ledger" onClick={handleNavClick} className={linkClass}>
              <History className="w-4 h-4" />
              Stock Ledger
            </NavLink>
            {(role === 'ADMIN' || role === 'OWNER' || role === 'PRODUCTION_SUPERVISOR') && (
              <NavLink to="/inventory/adjustments" onClick={handleNavClick} className={linkClass}>
                <Settings className="w-4 h-4" />
                Stock Adjustments
              </NavLink>
            )}
            <NavLink to="/inventory/valuation" onClick={handleNavClick} className={linkClass}>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              FIFO Valuation
            </NavLink>
            <NavLink to="/inventory/low-stock" onClick={handleNavClick} className={linkClass}>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Low Stock Alerts
            </NavLink>
            <NavLink to="/inventory/reconciliation" onClick={handleNavClick} className={linkClass}>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Reconciliation
            </NavLink>
            <NavLink to="/inventory/opening-stock" onClick={handleNavClick} className={linkClass}>
              <Archive className="w-4 h-4" />
              Opening Stock
            </NavLink>
          </nav>
        </div>
      )}

      {/* MASTER DATA (ADMIN & OWNER) */}
      {(role === 'ADMIN' || role === 'OWNER') && (
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Master Data
          </div>
          <nav className="space-y-1">
            <NavLink to="/products" onClick={handleNavClick} className={linkClass}>
              <Package className="w-4 h-4" />
              Products & Categories
            </NavLink>
            <NavLink to="/customers" onClick={handleNavClick} className={linkClass}>
              <Users className="w-4 h-4" />
              Customers
            </NavLink>
            <NavLink to="/inventory/raw" onClick={handleNavClick} className={linkClass}>
              <Archive className="w-4 h-4" />
              Raw Materials
            </NavLink>
            <NavLink to="/inventory/packaging" onClick={handleNavClick} className={linkClass}>
              <Layers className="w-4 h-4" />
              Packaging Materials
            </NavLink>
            <NavLink to="/suppliers" onClick={handleNavClick} className={linkClass}>
              <Truck className="w-4 h-4" />
              Suppliers
            </NavLink>
            <NavLink to="/boms" onClick={handleNavClick} className={linkClass}>
              <Settings className="w-4 h-4" />
              Bill of Materials (BOM)
            </NavLink>
          </nav>
        </div>
      )}

      {/* System info */}
      <div className="mt-auto pt-4 border-t border-gray-100 text-[11px] text-gray-400">
        <div>FactoryFlow v1.0.0</div>
        <div>NIT Tiruchirappalli Internship</div>
      </div>
    </aside>
  </>
  );
};
