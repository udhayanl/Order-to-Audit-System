import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Layers, TrendingUp } from 'lucide-react';

export const ProductionReportPage: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/production')
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Production Costing & Yield Report</h1>
        <p className="text-sm text-gray-500">
          Planned vs actual raw material consumption, yield variance %, damaged packaging, overhead allocations and cost per packet
        </p>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading production report...</div>
        ) : (
          runs.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">{r.runNumber}</h2>
                    <span className="text-xs text-gray-500">({r.date})</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        r.yieldVarianceStatus === 'EXCEEDS_TOLERANCE'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Yield Variance: {r.yieldVariancePercent}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 font-medium">
                    Product: <strong className="text-gray-900">{r.productName}</strong> | Planned Batch: {r.plannedBatch} pkts | Expected: {r.expectedYield} pkts | Actual Good Output: <strong>{r.actualGoodOutput} pkts</strong>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">Unit Cost (Actual Good Output)</div>
                  <div className="text-lg font-extrabold text-emerald-700">₹{Number(r.costPerPacket).toFixed(2)}/pkt</div>
                </div>
              </div>

              {/* Consumptions Breakdown */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Planned Qty</th>
                      <th className="p-2.5">Actual Qty</th>
                      <th className="p-2.5">Consumption Variance</th>
                      <th className="p-2.5 text-right">FIFO Material Cost (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {r.consumptions?.map((c: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-2.5 font-semibold text-gray-900">{c.materialName}</td>
                        <td className="p-2.5">{c.planned} {c.unit}</td>
                        <td className="p-2.5 font-bold text-gray-900">{c.actual} {c.unit}</td>
                        <td className="p-2.5">
                          <span className={`font-semibold ${c.variancePercent > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                            {c.variancePercent > 0 ? `+${c.variancePercent}` : c.variancePercent}% ({c.varianceStatus})
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-gray-900">₹{Number(c.cost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Overheads breakdown */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-gray-500">Raw & Pkg Material Cost:</span>{' '}
                  <strong className="text-gray-900">₹{Number(r.totalMaterialCost).toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Labour Overhead:</span>{' '}
                  <strong className="text-gray-900">₹{Number(r.labourCost).toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Power / Gas Overhead:</span>{' '}
                  <strong className="text-gray-900">₹{Number(r.powerCost).toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Damaged Pouches:</span>{' '}
                  <strong className="text-rose-700">{r.damagedPouches} pcs</strong>
                </div>
                <div>
                  <span className="text-gray-500">Cartons Used:</span>{' '}
                  <strong className="text-gray-900">{r.cartonsUsed} pcs</strong>
                </div>
                <div className="font-bold text-brand-700">
                  Total Production Cost: ₹{Number(r.totalProductionCost).toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
