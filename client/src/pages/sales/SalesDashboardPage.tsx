import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Truck,
  DollarSign,
  AlertCircle,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  Store,
  Layers,
} from 'lucide-react';

export const SalesDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sales/dashboard/summary');
      setData(res.data || res);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading sales dashboard metrics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {error || 'No sales metrics available.'}
      </div>
    );
  }

  const { kpis, productSales, customerTypeSales, recentOrders } = data;

  return (
    <div className="space-y-6">
      {/* Page Title & Fast Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales & GST Billing Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time finished goods demand, GST billing, dispatches and receivables tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            New Sales Order
          </Link>
          <Link
            to="/sales/mobile-order"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Store className="w-4 h-4" />
            Salesman Mobile App
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Today Sales</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">₹{kpis.todaySalesRevenue.toLocaleString('en-IN')}</div>
            <div className="text-xs text-gray-500 mt-1">{kpis.todayOrdersCount} orders placed today</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Month Sales</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">₹{kpis.monthSalesRevenue.toLocaleString('en-IN')}</div>
            <div className="text-xs text-gray-500 mt-1">{kpis.monthOrdersCount} orders this month</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Orders</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">{kpis.pendingApprovalCount}</div>
            <div className="text-xs text-amber-600 mt-1">{kpis.approvedCount} approved waiting allocation</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dispatches Today</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900">{kpis.dispatchesTodayCount}</div>
            <div className="text-xs text-gray-500 mt-1">₹{kpis.totalOutstandingReceivables.toLocaleString('en-IN')} receivables</div>
          </div>
        </div>
      </div>

      {/* Customer Segments & Allocation Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retailer vs Distributor Channel Split */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-brand-600" />
            Sales Channel Breakdown
          </h2>
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                <span>Retailers (Direct Shops)</span>
                <span>₹{customerTypeSales.retailer.toLocaleString('en-IN')}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-brand-600 h-2 rounded-full"
                  style={{
                    width: `${
                      customerTypeSales.retailer + customerTypeSales.distributor > 0
                        ? (customerTypeSales.retailer /
                            (customerTypeSales.retailer + customerTypeSales.distributor)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                <span>Distributors (Wholesale)</span>
                <span>₹{customerTypeSales.distributor.toLocaleString('en-IN')}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{
                    width: `${
                      customerTypeSales.retailer + customerTypeSales.distributor > 0
                        ? (customerTypeSales.distributor /
                            (customerTypeSales.retailer + customerTypeSales.distributor)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Total Invoiced Revenue:</span>
            <span className="font-bold text-gray-900">₹{kpis.totalInvoicedRevenue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Product Revenue Leaderboard */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              Top Selling Products by Revenue
            </h2>
            <Link to="/sales/allocations" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Check FG Allocations <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 uppercase tracking-wider">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-right">Units Sold</th>
                  <th className="pb-2 text-right">Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-400">
                      No product sales recorded yet
                    </td>
                  </tr>
                ) : (
                  productSales.slice(0, 5).map((prod: any) => (
                    <tr key={prod.productId} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">{prod.name}</td>
                      <td className="py-2.5 text-gray-500">{prod.sku}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-700">
                        {prod.totalQuantity.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-right font-bold text-brand-600">
                        ₹{prod.totalRevenue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Orders List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-gray-900">Recent Sales Activity</h2>
          </div>
          <Link to="/orders" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
            View All Orders <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Salesman</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Grand Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No recent sales orders
                  </td>
                </tr>
              ) : (
                recentOrders.map((ord: any) => (
                  <tr key={ord.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-brand-600">
                      <Link to={`/orders/${ord.id}`}>{ord.orderNumber}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{ord.customerName}</div>
                      <div className="text-[11px] text-gray-400">
                        {ord.customerType} • {ord.city || 'Tamil Nadu'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ord.salesmanName}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(ord.orderDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      ₹{ord.grandTotal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ord.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/orders/${ord.id}`}
                        className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                      >
                        Details
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
