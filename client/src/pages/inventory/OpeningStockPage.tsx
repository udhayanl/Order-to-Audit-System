import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { ShieldCheck, History, CheckCircle2, Lock } from 'lucide-react';

export const OpeningStockPage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/opening-stock')
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const benchmarkItems = [
    { name: 'Flour (Rice & Urad Dhal)', category: 'RAW_MATERIAL', qty: '100 kg', rate: '₹42.00/kg', val: '₹4,200.00' },
    { name: 'Cooking Oil (Groundnut & Sesame)', category: 'RAW_MATERIAL', qty: '30 litres', rate: '₹140.00/litre', val: '₹4,200.00' },
    { name: 'Salt & Spice Mix', category: 'RAW_MATERIAL', qty: '5 kg', rate: '₹200.00/kg', val: '₹1,000.00' },
    { name: '200 g Food-Grade Pouches', category: 'PACKAGING', qty: '500 pieces', rate: '₹2.50/pc', val: '₹1,250.00' },
    { name: 'Corrugated Master Cartons', category: 'PACKAGING', qty: '30 pieces', rate: '₹15.00/pc', val: '₹450.00' },
    { name: 'Murukku 200 g (Finished Goods)', category: 'FINISHED_GOOD', qty: '50 packets', rate: '₹30.00/pkt', val: '₹1,500.00' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Opening Stock Audit & Master Setup</h1>
          <p className="text-sm text-gray-500">
            Immutable benchmark opening inventory setup with FIFO valuation layer initialization and duplicate prevention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            Locked & Traceable
          </span>
        </div>
      </div>

      {/* Benchmark Reference Banner */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 text-xs text-brand-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-brand-950">
          <ShieldCheck className="w-4 h-4 text-brand-700" />
          NIT Tiruchirappalli Mandated Benchmark Baseline
        </div>
        <p className="text-brand-800 leading-relaxed">
          The opening stock represents the audited physical inventory at system commissioning. Every item has an authoritative entry in the append-only <strong>StockLedger</strong> and an initial FIFO valuation layer. Once posted, opening balances cannot be deleted or re-initialized. All future discrepancies must follow authorized <strong>Stock Adjustments</strong>.
        </p>
      </div>

      {/* Benchmark Opening Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Benchmark Opening Inventory Items & Valuation Rates
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200 text-[11px]">
              <tr>
                <th className="p-3">Item Description</th>
                <th className="p-3">Category</th>
                <th className="p-3">Opening Quantity</th>
                <th className="p-3">Valuation Rate</th>
                <th className="p-3">Initial Layer Value</th>
                <th className="p-3">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {benchmarkItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-900">{item.name}</td>
                  <td className="p-3 text-gray-500">{item.category}</td>
                  <td className="p-3 font-bold text-gray-900">{item.qty}</td>
                  <td className="p-3 font-medium text-gray-800">{item.rate}</td>
                  <td className="p-3 font-bold text-emerald-700">{item.val}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Audited & Posted
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Posted Opening Stock Documents History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Posted Opening Stock Record Documents
          </h2>
          <span className="text-xs text-gray-500">Total Records: {records.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200 text-[11px]">
              <tr>
                <th className="p-3">Document Number</th>
                <th className="p-3">Setup Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Authorized Administrator</th>
                <th className="p-3">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">Loading opening records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">No opening stock documents recorded.</td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-gray-900">{rec.recordNumber}</td>
                    <td className="p-3 text-gray-500">{new Date(rec.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-gray-800">
                      {rec.createdBy?.fullName || 'System Administrator'}
                    </td>
                    <td className="p-3 text-gray-500">{rec.notes || '—'}</td>
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
