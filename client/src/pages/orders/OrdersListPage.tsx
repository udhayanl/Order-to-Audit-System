import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { PlusCircle, ShoppingCart, Search, Eye, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const OrdersListPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/orders')
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredOrders = orders.filter((o) => {
    const matchesFilter = filter === 'ALL' || o.status === filter;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Sales Orders</h1>
          <p className="text-sm text-gray-500">
            Track, verify, approve and dispatch factory orders
          </p>
        </div>
        {(user?.role === 'SALESMAN' || user?.role === 'ADMIN') && (
          <Link
            to="/orders/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Create New Order
          </Link>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {['ALL', 'SUBMITTED', 'APPROVED', 'INVOICED', 'DISPATCHED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === st
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search order or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Order Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Salesman</th>
                <th className="p-3">Items</th>
                <th className="p-3">Taxable Value</th>
                <th className="p-3">Grand Total</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">Loading orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">No orders found.</td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{order.orderNumber}</td>
                    <td className="p-3 text-gray-500">{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">{order.customer?.name}</div>
                      <div className="text-[11px] text-gray-400">{order.customer?.state} ({order.customer?.stateCode})</div>
                    </td>
                    <td className="p-3 font-medium text-gray-700">{order.salesman?.fullName}</td>
                    <td className="p-3">
                      {order.items?.map((it: any) => `${Number(it.quantity)} ${it.product?.unit || 'pkts'}`).join(', ')}
                    </td>
                    <td className="p-3 font-medium text-gray-900">₹{Number(order.subtotal).toLocaleString('en-IN')}</td>
                    <td className="p-3 font-bold text-gray-900">₹{Number(order.grandTotal).toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-semibold text-[11px] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </Link>
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
