import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { History, Search, Filter } from 'lucide-react';

export const StockLedgerPage: React.FC = () => {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/inventory/ledger')
      .then(setLedger)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = ledger.filter((entry) => {
    const matchesFilter = filterType === 'ALL' || entry.itemType === filterType;
    const matchesSearch =
      entry.movementType.toLowerCase().includes(search.toLowerCase()) ||
      (entry.notes && entry.notes.toLowerCase().includes(search.toLowerCase())) ||
      (entry.referenceId && entry.referenceId.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Immutable Stock Ledger</h1>
          <p className="text-sm text-gray-500">
            Append-only audit trail of every inventory movement (purchases, production, dispatches & adjustments)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg p-2 bg-white"
          >
            <option value="ALL">All Item Classifications</option>
            <option value="RAW_MATERIAL">Raw Materials</option>
            <option value="PACKAGING">Packaging Materials</option>
            <option value="FINISHED_GOOD">Finished Goods</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Classification</th>
                <th className="p-3">Movement Type</th>
                <th className="p-3">Quantity Delta</th>
                <th className="p-3">Balance After</th>
                <th className="p-3">Reference Doc</th>
                <th className="p-3">Authorized By</th>
                <th className="p-3">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading stock ledger...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No ledger entries found.</td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const qty = Number(entry.quantity);
                  const isPositive = qty > 0;
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{new Date(entry.date).toLocaleString()}</td>
                      <td className="p-3">
                        <span className="font-semibold text-gray-800">{entry.itemType}</span>
                      </td>
                      <td className="p-3 font-semibold text-gray-900">{entry.movementType}</td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${
                            isPositive ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isPositive ? `+${qty}` : qty} {entry.unit}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gray-900">{Number(entry.balanceAfter)} {entry.unit}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-800">
                          {entry.referenceType}: {entry.referenceId || 'N/A'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-700">{entry.userName}</td>
                      <td className="p-3 text-gray-500">{entry.notes || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
