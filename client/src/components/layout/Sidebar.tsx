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
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 font-semibold border-l-4 border-brand-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] flex flex-col p-4 space-y-6">
      {/* 1. Core Section */}
      <div>
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
          Overview
        </div>
        <nav className="space-y-1">
          <NavLink to="/dashboard" className={linkClass}>
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
            <NavLink to="/orders/new" className={linkClass}>
              <PlusCircle className="w-4 h-4 text-brand-600" />
              New Order
            </NavLink>
            <NavLink to="/orders" className={linkClass}>
              <ShoppingCart className="w-4 h-4" />
              My Orders
            </NavLink>
            <NavLink to="/customers" className={linkClass}>
              <Users className="w-4 h-4" />
              My Customers
            </NavLink>
            <NavLink to="/products" className={linkClass}>
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
            <NavLink to="/orders" className={linkClass}>
              <ShoppingCart className="w-4 h-4" />
              Incoming Orders
            </NavLink>
            <NavLink to="/invoices" className={linkClass}>
              <FileText className="w-4 h-4" />
              GST Invoices
            </NavLink>
            <NavLink to="/dispatches" className={linkClass}>
              <Truck className="w-4 h-4" />
              Dispatches
            </NavLink>
            <NavLink to="/purchases" className={linkClass}>
              <Archive className="w-4 h-4" />
              Raw Purchases
            </NavLink>
            <NavLink to="/payments" className={linkClass}>
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
            <NavLink to="/production/new" className={linkClass}>
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              New Production Run
            </NavLink>
            <NavLink to="/production/runs" className={linkClass}>
              <ClipboardList className="w-4 h-4" />
              Production History
            </NavLink>
            <NavLink to="/boms" className={linkClass}>
              <Layers className="w-4 h-4" />
              BOM Recipes
            </NavLink>
            <NavLink to="/inventory/raw" className={linkClass}>
              <Archive className="w-4 h-4" />
              Raw Materials Stock
            </NavLink>
            <NavLink to="/inventory/packaging" className={linkClass}>
              <Package className="w-4 h-4" />
              Packaging Stock
            </NavLink>
            <NavLink to="/purchases" className={linkClass}>
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
            <NavLink to="/reports/sales-register" className={linkClass}>
              <FileText className="w-4 h-4" />
              Sales Register
            </NavLink>
            <NavLink to="/reports/gst-summary" className={linkClass}>
              <TrendingUp className="w-4 h-4" />
              GST (GSTR-1 / 3B)
            </NavLink>
            <NavLink to="/reports/purchase-register" className={linkClass}>
              <Archive className="w-4 h-4" />
              Purchase Register
            </NavLink>
            <NavLink to="/inventory/ledger" className={linkClass}>
              <History className="w-4 h-4" />
              Stock Ledger
            </NavLink>
            <NavLink to="/reports/production" className={linkClass}>
              <ClipboardList className="w-4 h-4" />
              Production Costing
            </NavLink>
            <NavLink to="/reports/ageing" className={linkClass}>
              <DollarSign className="w-4 h-4" />
              Outstanding Ageing
            </NavLink>
            <NavLink to="/reports/export" className={linkClass}>
              <Download className="w-4 h-4" />
              Export Centre
            </NavLink>
            <NavLink to="/audit-logs" className={linkClass}>
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
            <NavLink to="/orders" className={linkClass}>
              <ShoppingCart className="w-4 h-4" />
              Sales & Orders
            </NavLink>
            <NavLink to="/production/runs" className={linkClass}>
              <ClipboardList className="w-4 h-4" />
              Factory Production
            </NavLink>
            <NavLink to="/inventory/ledger" className={linkClass}>
              <History className="w-4 h-4" />
              Stock Ledger
            </NavLink>
            <NavLink to="/reports/production" className={linkClass}>
              <TrendingUp className="w-4 h-4" />
              Cost & Margins
            </NavLink>
            <NavLink to="/reports/ageing" className={linkClass}>
              <DollarSign className="w-4 h-4" />
              Receivables Ageing
            </NavLink>
            <NavLink to="/audit-logs" className={linkClass}>
              <Shield className="w-4 h-4" />
              Audit Trail
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
            <NavLink to="/customers" className={linkClass}>
              <Users className="w-4 h-4" />
              Customers
            </NavLink>
            <NavLink to="/products" className={linkClass}>
              <Package className="w-4 h-4" />
              Products & Rates
            </NavLink>
            <NavLink to="/suppliers" className={linkClass}>
              <Archive className="w-4 h-4" />
              Suppliers
            </NavLink>
            <NavLink to="/boms" className={linkClass}>
              <Layers className="w-4 h-4" />
              Bill of Materials
            </NavLink>
            <NavLink to="/inventory/ledger" className={linkClass}>
              <History className="w-4 h-4" />
              Stock Ledger
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
  );
};
