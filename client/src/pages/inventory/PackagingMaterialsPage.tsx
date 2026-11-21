import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Package } from 'lucide-react';

export const PackagingMaterialsPage: React.FC = () => {
  const [packaging, setPackaging] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/summary')
      .then((data) => setPackaging(data.packagingMaterials || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Packaging Materials Inventory</h1>
        <p className="text-sm text-gray-500">
          Pouches, corrugated cartons and packing consumables tracking
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Packaging Code</th>
                <th className="p-3">Item Description</th>
                <th className="p-3">Opening Stock</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Unit Purchase Rate</th>
                <th className="p-3">Stock Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">Loading packaging materials...</td>
                </tr>
              ) : packaging.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">No packaging materials registered.</td>
                </tr>
              ) : (
                packaging.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{pkg.code}</td>
                    <td className="p-3 font-semibold text-gray-800">{pkg.name}</td>
                    <td className="p-3">{pkg.openingStock} {pkg.uom}</td>
                    <td className="p-3 font-bold text-gray-900 text-sm">
                      {pkg.currentStock} {pkg.uom}
                    </td>
                    <td className="p-3">₹{pkg.unitPrice.toFixed(2)}</td>
                    <td className="p-3 font-bold text-brand-700">₹{pkg.stockValue.toLocaleString('en-IN')}</td>
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
