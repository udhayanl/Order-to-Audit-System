import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Truck, Search, Calendar, User, Package } from 'lucide-react';

export const DispatchListPage: React.FC = () => {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/dispatches')
      .then(setDispatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = dispatches.filter(d =>
    d.dispatchNumber.toLowerCase().includes(search.toLowerCase()) ||
    d.order?.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.vehicleNumber && d.vehicleNumber.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Factory Dispatches</h1>
          <p className="text-sm text-gray-500">
            Realized stock deductions, delivery vehicles, driver assignments & transport notes
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search dispatch, customer, vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Dispatch No</th>
                <th className="p-3">Date</th>
                <th className="p-3">Order Ref</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Vehicle Number</th>
                <th className="p-3">Driver Name</th>
                <th className="p-3">Dispatched Items</th>
                <th className="p-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading dispatches...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No dispatches recorded yet.</td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{d.dispatchNumber}</td>
                    <td className="p-3 text-gray-500">{new Date(d.dispatchDate).toLocaleDateString()}</td>
                    <td className="p-3 font-semibold text-gray-800">{d.order?.orderNumber}</td>
                    <td className="p-3 font-medium text-gray-900">{d.order?.customer?.name}</td>
                    <td className="p-3 font-semibold text-gray-800">{d.vehicleNumber || '—'}</td>
                    <td className="p-3">{d.driverName || '—'}</td>
                    <td className="p-3 font-medium text-brand-700">
                      {d.items?.map((it: any) => `${Number(it.quantity)} ${it.product?.unit || 'pkts'}`).join(', ')}
                    </td>
                    <td className="p-3 text-gray-500">{d.remarks || '—'}</td>
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
