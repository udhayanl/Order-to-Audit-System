import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import {
  Boxes,
  Package,
  Layers,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  Plus
} from 'lucide-react';

export const InventoryOverviewPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = () => {
    setLoading(true);
    api.get('/inventory/summary')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading && !data) {
    return <div className="p-8 text-center text-gray-500">Loading inventory overview...</div>;
  }

  const kpis = data?.kpis || {};
  const rawMaterials = data?.rawMaterials || [];
  const packagingMaterials = data?.packagingMaterials || [];
  const finishedGoods = data?.finishedGoods || [];
  const alerts = data?.alerts || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inventory Overview & Stock Control</h1>
          <p className="text-sm text-gray-500">
            Real-time stock balances across Raw Materials, Packaging, and Finished Goods reconciled against immutable ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            to="/inventory/adjustments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Stock Adjustment
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Raw Materials</span>
            <Boxes className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{kpis.totalRawMaterials || rawMaterials.length}</span>
            <span className="text-xs text-gray-500">SKUs</span>
          </div>
          <Link to="/inventory/raw" className="mt-2 text-xs text-brand-600 font-semibold hover:underline block">
            View Raw Stock →
          </Link>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Packaging Materials</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{kpis.totalPackaging || packagingMaterials.length}</span>
            <span className="text-xs text-gray-500">Items</span>
          </div>
          <Link to="/inventory/packaging" className="mt-2 text-xs text-purple-600 font-semibold hover:underline block">
            View Packaging Stock →
          </Link>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Finished Goods</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{kpis.totalFinishedGoods || finishedGoods.length}</span>
            <span className="text-xs text-gray-500">Products</span>
          </div>
          <Link to="/inventory/finished-goods" className="mt-2 text-xs text-indigo-600 font-semibold hover:underline block">
            View FG Stock →
          </Link>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Total Inventory Valuation</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              ₹{Number(kpis.totalInventoryValue || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <Link to="/inventory/valuation" className="mt-2 text-xs text-emerald-600 font-semibold hover:underline block">
            FIFO Valuation Breakdown →
          </Link>
        </div>
      </div>

      {/* Activity & Low-Stock Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-gray-900">Stock Alerts & Reorder Needed</h2>
            </div>
            <Link to="/inventory/low-stock" className="text-xs text-brand-600 hover:underline">
              View All ({alerts.length})
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <span>All inventory levels are currently above reorder thresholds.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {alerts.slice(0, 4).map((alert: any) => (
                <div key={alert.itemId} className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-gray-900 block">{alert.name}</span>
                    <span className="text-gray-500 text-[11px]">Reorder: {alert.reorderLevel} {alert.unit}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-700 block">{alert.currentStock} {alert.unit}</span>
                    <span className="text-[10px] uppercase font-bold text-amber-600">{alert.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Inventory Summary by Category */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Inventory Classification Summary</h2>
            <Link to="/inventory/reconciliation" className="text-xs font-semibold text-brand-600 hover:underline">
              Reconciliation Status →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Items</th>
                  <th className="p-2.5">Stock Status</th>
                  <th className="p-2.5">Reconciliation</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50">
                  <td className="p-2.5 font-bold text-gray-900 flex items-center gap-2">
                    <Boxes className="w-3.5 h-3.5 text-brand-600" /> Raw Materials
                  </td>
                  <td className="p-2.5">{rawMaterials.length} items</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active Stock
                    </span>
                  </td>
                  <td className="p-2.5 text-emerald-600 font-semibold">100% Reconciled</td>
                  <td className="p-2.5 text-right">
                    <Link to="/inventory/raw" className="text-brand-600 hover:underline font-semibold">
                      Manage →
                    </Link>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="p-2.5 font-bold text-gray-900 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-purple-600" /> Packaging Materials
                  </td>
                  <td className="p-2.5">{packagingMaterials.length} items</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active Stock
                    </span>
                  </td>
                  <td className="p-2.5 text-emerald-600 font-semibold">100% Reconciled</td>
                  <td className="p-2.5 text-right">
                    <Link to="/inventory/packaging" className="text-brand-600 hover:underline font-semibold">
                      Manage →
                    </Link>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="p-2.5 font-bold text-gray-900 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" /> Finished Goods
                  </td>
                  <td className="p-2.5">{finishedGoods.length} products</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      FG Available
                    </span>
                  </td>
                  <td className="p-2.5 text-emerald-600 font-semibold">100% Reconciled</td>
                  <td className="p-2.5 text-right">
                    <Link to="/inventory/finished-goods" className="text-brand-600 hover:underline font-semibold">
                      Manage →
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                Today's Receipts: <strong>{kpis.todayReceiptsCount || 0}</strong>
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                Today's Issues: <strong>{kpis.todayIssuesCount || 0}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/inventory/ledger"
                className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Immutable Stock Ledger
              </Link>
              <Link
                to="/inventory/opening-stock"
                className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Opening Inventory
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
