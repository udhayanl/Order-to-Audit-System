import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import {
  Factory,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  PlusCircle,
  TrendingUp,
  Percent,
  Boxes,
  ClipboardList,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { useAuth } from '../../context/AuthContext.js';

export const ProductionDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const isSupervisorOrAdmin = ['PRODUCTION_SUPERVISOR', 'ADMIN', 'OWNER'].includes(user?.role || '');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/production/dashboard/summary');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load production dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpis = data?.kpis || {
    totalOrders: 0,
    draftOrders: 0,
    plannedOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalGoodPackets: 0,
    totalWastage: 0,
    averageYield: 94.0,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Factory className="w-7 h-7 text-indigo-600" />
            Manufacturing Operations Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Real-time batch execution, BOM material reservations, FIFO cost absorption, and quality yield analytics
          </p>
        </div>
        {isSupervisorOrAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/production/orders"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              New Production Order
            </Link>
            <Link
              to="/production/material-issues"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Boxes className="w-4 h-4" />
              Issue Materials
            </Link>
            <Link
              to="/production/traceability"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Search className="w-4 h-4" />
              Trace Batch
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>In-Progress Batches</span>
            <span className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900">{kpis.inProgressOrders}</div>
          <div className="mt-1 text-xs text-amber-600 font-medium">Active line frying & packaging</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Good Finished Packets</span>
            <span className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-700">
            {Number(kpis.totalGoodPackets).toLocaleString('en-IN')} pkts
          </div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">Added to usable finished goods</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Average Production Yield</span>
            <span className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-blue-700">
            {kpis.averageYield}%
          </div>
          <div className="mt-1 text-xs text-gray-500 font-medium">Benchmark Standard: 94.0%</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Total Wastage & Rejection</span>
            <span className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-700">
            {Number(kpis.totalWastage).toLocaleString('en-IN')} pkts
          </div>
          <div className="mt-1 text-xs text-rose-600 font-medium">Damaged pouches & test scrap</div>
        </div>
      </div>

      {/* Manufacturing Execution Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/production/orders"
          className="p-5 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl hover:shadow-md transition-shadow group flex items-start justify-between"
        >
          <div>
            <div className="p-2 bg-indigo-600 text-white rounded-lg inline-block mb-3">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
              Production Orders & Scaling
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              BOM-based requirements calculation, shortage checks, and material reservations.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/production/material-issues"
          className="p-5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-xl hover:shadow-md transition-shadow group flex items-start justify-between"
        >
          <div>
            <div className="p-2 bg-emerald-600 text-white rounded-lg inline-block mb-3">
              <Boxes className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Material Issues & Returns
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              FIFO stock deduction, stock ledger updates, and returning unused leftovers.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/production/quality"
          className="p-5 bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl hover:shadow-md transition-shadow group flex items-start justify-between"
        >
          <div>
            <div className="p-2 bg-purple-600 text-white rounded-lg inline-block mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
              Quality Control (QC)
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Batch inspection, seal hermetic integrity, weight limits, and approval certificates.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Recent Production Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-sm text-gray-900">Recent Production Orders</h2>
          <Link
            to="/production/orders"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View All Orders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Order Number</th>
                <th className="p-3">Product</th>
                <th className="p-3">Planned Qty</th>
                <th className="p-3">Supervisor</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">Loading orders...</td>
                </tr>
              ) : !data?.recentOrders || data.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">No production orders recorded yet.</td>
                </tr>
              ) : (
                data.recentOrders.map((ord: any) => (
                  <tr key={ord.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{ord.orderNumber}</td>
                    <td className="p-3 font-semibold text-gray-800">{ord.product?.name}</td>
                    <td className="p-3 font-medium">{Number(ord.plannedOutputQuantity)} pkts</td>
                    <td className="p-3">{ord.supervisor?.fullName || 'Murugesan'}</td>
                    <td className="p-3">
                      <StatusBadge status={ord.status} />
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/production/orders/${ord.id}`}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-xs font-medium"
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
