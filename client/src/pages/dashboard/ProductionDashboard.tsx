import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Layers, PlusCircle, Archive, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export const ProductionDashboard: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [stock, setStock] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/production/runs'), api.get('/inventory/summary')])
      .then(([runsData, stockData]) => {
        setRuns(runsData);
        setStock(stockData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalGoodOutput = runs.reduce((sum, r) => sum + Number(r.actualGoodOutput), 0);
  const totalDamagedPouches = runs.reduce((sum, r) => sum + Number(r.damagedPouches), 0);
  const varianceCount = runs.filter((r) => r.yieldVarianceStatus === 'EXCEEDS_TOLERANCE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Production Management</h1>
          <p className="text-sm text-gray-500">
            Batch recipes, raw material consumption, yield and packaging scrap tracking
          </p>
        </div>
        <Link
          to="/production/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> New Production Run
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Production Runs"
          value={runs.length}
          subtitle="Batches manufactured"
          icon={Layers}
          color="brand"
        />
        <MetricCard
          title="Finished Goods Output"
          value={`${totalGoodOutput} pkts`}
          subtitle="Good packaged units"
          icon={CheckCircle2}
          color="blue"
        />
        <MetricCard
          title="Packaging Scrap / Damaged"
          value={`${totalDamagedPouches} pouches`}
          subtitle="Scrap pouches recorded"
          icon={AlertTriangle}
          color="rose"
        />
        <MetricCard
          title="Yield Variance Alerts"
          value={varianceCount}
          subtitle="Exceeding 3% tolerance"
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Raw Materials Live Stock Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Archive className="w-4 h-4 text-emerald-600" /> Current Raw Material Stock Levels
          </h2>
          <Link to="/inventory/raw" className="text-xs font-semibold text-brand-600 hover:underline">
            View Ledger →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Material Code</th>
                <th className="p-3">Material Name</th>
                <th className="p-3">Opening Stock</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stock?.rawMaterials?.map((rm: any) => (
                <tr key={rm.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-900">{rm.code}</td>
                  <td className="p-3 font-medium text-gray-800">{rm.name}</td>
                  <td className="p-3">{rm.openingStock} {rm.uom}</td>
                  <td className="p-3 font-bold text-gray-900">{rm.currentStock} {rm.uom}</td>
                  <td className="p-3 text-gray-500">{rm.reorderLevel} {rm.uom}</td>
                  <td className="p-3">
                    {rm.isLowStock ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                        Low Stock
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Sufficient
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Run History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" /> Recent Production Runs
          </h2>
          <Link to="/production/runs" className="text-xs font-semibold text-brand-600 hover:underline">
            View All Runs →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {runs.map((run) => (
            <div key={run.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-900">{run.runNumber}</span>
                  <StatusBadge status={run.yieldVarianceStatus} />
                </div>
                <div className="text-xs font-medium text-gray-700 mt-1">{run.product?.name}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Expected: {Number(run.expectedOutput)} pkts | Actual Good: {Number(run.actualGoodOutput)} pkts | Yield Variance: {Number(run.yieldVariancePercent)}%
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-gray-900">₹{Number(run.costPerPacket).toFixed(2)}/pkt</div>
                <div className="text-xs text-gray-500">Total: ₹{Number(run.totalProductionCost).toLocaleString('en-IN')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
