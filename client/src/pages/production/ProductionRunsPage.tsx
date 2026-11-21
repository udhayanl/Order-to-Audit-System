import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Layers, PlusCircle, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const ProductionRunsPage: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    api.get('/production/runs')
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = runs.filter(
    (r) =>
      r.runNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.product?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Production Runs History</h1>
          <p className="text-sm text-gray-500">
            Batch manufacturing logs, raw material issues, yield variances, packaging scrap and FIFO unit costing
          </p>
        </div>
        {(user?.role === 'PRODUCTION_SUPERVISOR' || user?.role === 'ADMIN' || user?.role === 'OWNER') && (
          <Link
            to="/production/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Start Production Run
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Run Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Finished Product</th>
                <th className="p-3">Expected Yield</th>
                <th className="p-3">Actual Output</th>
                <th className="p-3">Yield Variance</th>
                <th className="p-3">Damaged Pouches</th>
                <th className="p-3">Total Cost</th>
                <th className="p-3">Cost / Packet</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">Loading runs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">No production runs found.</td>
                </tr>
              ) : (
                filtered.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{run.runNumber}</td>
                    <td className="p-3 text-gray-500">{new Date(run.runDate).toLocaleDateString()}</td>
                    <td className="p-3 font-semibold text-gray-900">{run.product?.name}</td>
                    <td className="p-3">{Number(run.expectedOutput)} pkts</td>
                    <td className="p-3 font-bold text-gray-900">{Number(run.actualGoodOutput)} pkts</td>
                    <td className="p-3">
                      <span
                        className={`font-bold ${
                          Number(run.yieldVariancePercent) < 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {Number(run.yieldVariancePercent) > 0 ? `+${run.yieldVariancePercent}` : run.yieldVariancePercent}%
                      </span>
                    </td>
                    <td className="p-3 text-rose-700 font-medium">{Number(run.damagedPouches)} pcs</td>
                    <td className="p-3 font-semibold text-gray-900">
                      ₹{Number(run.totalProductionCost).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-bold text-emerald-700 text-sm">
                      ₹{Number(run.costPerPacket).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={run.yieldVarianceStatus} />
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
