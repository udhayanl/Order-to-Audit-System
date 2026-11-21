import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Archive } from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/master/suppliers')
      .then(setSuppliers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Suppliers Registry</h1>
        <p className="text-sm text-gray-500">
          Raw ingredient mills, edible oil refiners, spice merchants and packaging manufacturers
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Address</th>
                <th className="p-3">State & Code</th>
                <th className="p-3">Contact Person</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">Loading suppliers...</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No suppliers registered.</td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{s.name}</td>
                    <td className="p-3 font-semibold text-gray-800">{s.gstin || 'Unregistered'}</td>
                    <td className="p-3 text-gray-600">{s.address}</td>
                    <td className="p-3">{s.state} ({s.stateCode})</td>
                    <td className="p-3 font-medium text-gray-700">{s.contactPerson || '—'}</td>
                    <td className="p-3">{s.contactNumber}</td>
                    <td className="p-3 text-gray-500">{s.email || '—'}</td>
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
