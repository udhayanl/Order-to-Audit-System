import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Layers,
  AlertTriangle,
  FileText,
  Truck,
  ArrowRight,
  PlusCircle,
  Archive,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading factory dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Factory Admin Dashboard</h1>
          <p className="text-sm text-gray-500">
            Real-time operations overview for packaged food manufacturing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/orders/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> New Order
          </Link>
          <Link
            to="/production/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Layers className="w-4 h-4" /> Production Run
          </Link>
          <Link
            to="/purchases"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Archive className="w-4 h-4" /> Record Purchase
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Orders"
          value={stats?.todayOrdersCount || 0}
          subtitle={`${stats?.pendingOrdersCount || 0} orders pending action`}
          icon={ShoppingCart}
          color="blue"
        />
        <MetricCard
          title="Total Billed Sales"
          value={`₹${(stats?.totalSales || 0).toLocaleString('en-IN')}`}
          subtitle="Taxable + GST invoiced"
          icon={DollarSign}
          color="brand"
        />
        <MetricCard
          title="Finished Goods Stock"
          value={`${stats?.totalFgStock || 0} pkts`}
          subtitle="Available for dispatch"
          icon={Package}
          color="amber"
        />
        <MetricCard
          title="Outstanding Receivables"
          value={`₹${(stats?.totalReceivables || 0).toLocaleString('en-IN')}`}
          subtitle={`₹${(stats?.overduePayments || 0).toLocaleString('en-IN')} overdue`}
          icon={FileText}
          color="rose"
        />
      </div>

      {/* Low stock alerts if any */}
      {stats?.lowStockAlertsCount > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Low Stock Alert ({stats.lowStockAlertsCount} items below reorder level)
              </div>
              <div className="text-xs text-amber-700">
                Procure raw materials immediately to avoid production stoppage.
              </div>
            </div>
          </div>
          <Link
            to="/inventory/raw"
            className="text-xs font-semibold text-amber-900 underline hover:text-amber-800"
          >
            View Inventory →
          </Link>
        </div>
      )}

      {/* 2-Column Section: Recent Orders & Recent Production Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-brand-600" /> Recent Sales Orders
            </h2>
            <Link to="/orders" className="text-xs font-semibold text-brand-600 hover:underline">
              View All Orders →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats?.recentOrders?.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">No orders recorded yet.</div>
            ) : (
              stats?.recentOrders?.map((order: any) => (
                <div key={order.id} className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-gray-900">{order.orderNumber}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{order.customer?.name}</div>
                    <div className="text-[11px] text-gray-400">Salesman: {order.salesman?.fullName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs text-gray-900">
                      ₹{Number(order.grandTotal).toLocaleString('en-IN')}
                    </div>
                    <Link
                      to={`/orders/${order.id}`}
                      className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-0.5 mt-1"
                    >
                      Inspect <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Production Runs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" /> Recent Production Runs
            </h2>
            <Link to="/production/runs" className="text-xs font-semibold text-brand-600 hover:underline">
              View All Runs →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats?.recentRuns?.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">No production runs posted yet.</div>
            ) : (
              stats?.recentRuns?.map((run: any) => (
                <div key={run.id} className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-gray-900">{run.runNumber}</span>
                      <StatusBadge status={run.yieldVarianceStatus} />
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{run.product?.name}</div>
                    <div className="text-[11px] text-gray-400">
                      Output: {Number(run.actualGoodOutput)} pkts | Variance: {Number(run.yieldVariancePercent)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs text-gray-900">
                      ₹{Number(run.costPerPacket).toFixed(2)}/pkt
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Total: ₹{Number(run.totalProductionCost).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
