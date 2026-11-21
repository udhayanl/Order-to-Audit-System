import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { AlertTriangle, Plus, CheckCircle2, RefreshCw, ShoppingCart } from 'lucide-react';

export const LowStockAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const fetchAlerts = () => {
    setLoading(true);
    api.get('/inventory/low-stock')
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filtered = alerts.filter(a => {
    return categoryFilter === 'ALL' || a.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Low Stock & Replenishment Alerts</h1>
          <p className="text-sm text-gray-500">
            Items currently at or below minimum safety stock thresholds requiring procurement or production
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAlerts}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            to="/purchases"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            Create Purchase Order
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Items Requiring Attention: {filtered.length}</span>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-lg p-2 bg-white"
        >
          <option value="ALL">All Categories</option>
          <option value="RAW_MATERIAL">Raw Materials</option>
          <option value="PACKAGING">Packaging Materials</option>
          <option value="FINISHED_GOOD">Finished Goods</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Item Code</th>
                <th className="p-3">Item Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Reorder Threshold</th>
                <th className="p-3">Replenishment Shortage</th>
                <th className="p-3">Stock Condition</th>
                <th className="p-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Checking stock levels...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <span className="font-semibold text-gray-700">Healthy Stock Levels</span>
                      <span className="text-gray-400 text-[11px]">No items are currently below reorder thresholds.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.itemId} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-gray-900">{item.code}</td>
                    <td className="p-3 font-semibold text-gray-800">{item.name}</td>
                    <td className="p-3 font-medium text-gray-600">{item.category}</td>
                    <td className="p-3 font-bold text-rose-700 text-sm">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="p-3 text-gray-700">{item.reorderLevel} {item.unit}</td>
                    <td className="p-3 font-bold text-amber-700">
                      +{item.shortage} {item.unit}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'OUT_OF_STOCK'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {item.category === 'FINISHED_GOOD' ? (
                        <Link
                          to="/production/new"
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100"
                        >
                          Plan Production Run
                        </Link>
                      ) : (
                        <Link
                          to="/purchases"
                          className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded hover:bg-brand-100"
                        >
                          Order from Supplier
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
