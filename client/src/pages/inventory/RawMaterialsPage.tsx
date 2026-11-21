import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Archive, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const RawMaterialsPage: React.FC = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/summary')
      .then((data) => setMaterials(data.rawMaterials || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Raw Materials Inventory</h1>
        <p className="text-sm text-gray-500">
          Live stock balances reconciled against the immutable StockLedger with reorder level alerts
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Material Code</th>
                <th className="p-3">Material Name</th>
                <th className="p-3">Opening Stock</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Purchase Rate</th>
                <th className="p-3">Inventory Valuation</th>
                <th className="p-3">Stock Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading raw materials...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No raw materials registered.</td>
                </tr>
              ) : (
                materials.map((rm) => (
                  <tr key={rm.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{rm.code}</td>
                    <td className="p-3 font-semibold text-gray-800">{rm.name}</td>
                    <td className="p-3">{rm.openingStock} {rm.uom}</td>
                    <td className="p-3 font-bold text-gray-900 text-sm">
                      {rm.currentStock} {rm.uom}
                    </td>
                    <td className="p-3 text-gray-500">{rm.reorderLevel} {rm.uom}</td>
                    <td className="p-3">₹{rm.unitPrice.toFixed(2)}</td>
                    <td className="p-3 font-bold text-brand-700">₹{rm.stockValue.toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      {rm.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Reorder Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
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
