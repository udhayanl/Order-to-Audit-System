import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Users, Search, PlusCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    api.get('/master/customers')
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase())) ||
      c.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Master Registry</h1>
          <p className="text-sm text-gray-500">
            Retailers, distributors, GSTIN compliance, state codes and assigned sales representatives
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
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
                <th className="p-3">Customer Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">State & Code</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Assigned Salesman</th>
                <th className="p-3">Credit Limit</th>
                <th className="p-3">Billing Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No customers found.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{c.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800">
                        {c.type}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-800">{c.gstin || 'Unregistered'}</td>
                    <td className="p-3">
                      {c.state} <span className="font-bold text-gray-700">({c.stateCode})</span>
                    </td>
                    <td className="p-3">{c.contactNumber}</td>
                    <td className="p-3 font-medium text-brand-700">{c.salesman?.fullName || 'Unassigned'}</td>
                    <td className="p-3 font-bold text-gray-900">₹{Number(c.creditLimit).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-gray-500 max-w-xs truncate">{c.billingAddress}</td>
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
