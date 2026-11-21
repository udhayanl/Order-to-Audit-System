import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { TrendingUp, Layers, RefreshCw, FileText } from 'lucide-react';

export const InventoryValuationPage: React.FC = () => {
  const [valuationData, setValuationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchValuation = () => {
    setLoading(true);
    api.get('/inventory/valuation')
      .then(setValuationData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchValuation();
  }, []);

  const items = valuationData?.items || [];
  const grandTotal = valuationData?.grandTotalValue || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">FIFO Inventory Valuation</h1>
          <p className="text-sm text-gray-500">
            Strict First-In, First-Out (FIFO) layer breakdown preserving batch acquisition dates and unit costs
          </p>
        </div>
        <button
          onClick={fetchValuation}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Valuation KPI Card */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-800 text-white rounded-xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-brand-200 font-bold block">
            Total Inventory Valuation (FIFO)
          </span>
          <span className="text-3xl font-extrabold text-white mt-1 block">
            ₹{Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-brand-200 mt-1 block">
            Valued across {items.length} active inventory items with remaining layers
          </span>
        </div>
        <div className="p-3 bg-white/10 rounded-xl">
          <TrendingUp className="w-10 h-10 text-emerald-400" />
        </div>
      </div>

      {/* Item-wise FIFO Layers Breakdown */}
      <div className="space-y-6">
        {loading ? (
          <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            Loading valuation layers...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No active valuation layers found.
          </div>
        ) : (
          items.map((item: any) => (
            <div key={item.itemId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-gray-900 text-sm">{item.itemName}</span>
                  <span className="text-xs text-gray-500 ml-2">[{item.itemCode}] • {item.itemType}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>Remaining: <strong>{item.totalRemainingQuantity} {item.unit}</strong></span>
                  <span className="text-emerald-700 font-bold text-sm">
                    Total: ₹{Number(item.totalValuation).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-white text-gray-500 uppercase tracking-wider border-b border-gray-100 text-[11px]">
                    <tr>
                      <th className="p-3">Layer Date</th>
                      <th className="p-3">Reference Doc</th>
                      <th className="p-3">Acquired Qty</th>
                      <th className="p-3">Remaining Qty</th>
                      <th className="p-3">Unit Cost</th>
                      <th className="p-3">Layer Valuation</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {item.layers.map((layer: any, idx: number) => (
                      <tr key={layer.layerId || idx} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-500">{new Date(layer.receivedDate).toLocaleDateString()}</td>
                        <td className="p-3 font-mono font-medium text-gray-800">
                          {layer.referenceType}: {layer.referenceId || 'N/A'}
                        </td>
                        <td className="p-3">{layer.originalQuantity} {item.unit}</td>
                        <td className="p-3 font-bold text-gray-900">{layer.remainingQuantity} {item.unit}</td>
                        <td className="p-3 font-semibold text-gray-900">₹{Number(layer.unitCost).toFixed(2)}</td>
                        <td className="p-3 font-bold text-emerald-700">₹{Number(layer.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Layer Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
