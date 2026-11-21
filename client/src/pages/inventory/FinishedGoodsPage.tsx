import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Layers, Search, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FinishedGoodsPage: React.FC = () => {
  const [goods, setGoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    api.get('/inventory/finished-goods')
      .then(setGoods)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = goods.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'LOW' && item.isLowStock) ||
      (statusFilter === 'NORMAL' && !item.isLowStock);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finished Goods Stock</h1>
          <p className="text-sm text-gray-500">
            Real-time finished goods stock availability, selling prices, and reorder levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/orders/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4" />
            Create Customer Order
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search SKU or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg p-2 bg-white"
          >
            <option value="ALL">All Stock Levels</option>
            <option value="NORMAL">In Stock</option>
            <option value="LOW">Low Stock / Reorder Needed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Selling Price</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Total Value</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading finished goods stock...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No finished goods found.</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-gray-900">{item.code}</td>
                    <td className="p-3 font-semibold text-gray-800">{item.name}</td>
                    <td className="p-3 text-gray-500">{item.uom}</td>
                    <td className="p-3 font-semibold text-gray-900">₹{item.sellingPrice.toFixed(2)}</td>
                    <td className="p-3 font-bold text-gray-900 text-sm">
                      {item.currentStock} {item.uom}
                    </td>
                    <td className="p-3 text-gray-500">{item.reorderLevel} {item.uom}</td>
                    <td className="p-3 font-semibold text-emerald-700">₹{item.stockValue.toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.currentStock <= 0
                            ? 'bg-rose-100 text-rose-800'
                            : item.isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.currentStock <= 0 ? 'OUT OF STOCK' : item.isLowStock ? 'LOW STOCK' : 'IN STOCK'}
                      </span>
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
