import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  Scale,
  CheckCircle,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Calendar,
} from 'lucide-react';

interface TrialBalanceRow {
  code: string;
  name: string;
  nature: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalanceData {
  asOfDate: string;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  rows: TrialBalanceRow[];
}

export const TrialBalancePage: React.FC = () => {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [natureFilter, setNatureFilter] = useState('ALL');

  const fetchTrialBalance = () => {
    setLoading(true);
    api.get('/finance/accounting/trial-balance')
      .then((res: any) => {
        setData(res.data || res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  const filteredRows = data?.rows?.filter(row => {
    const matchesSearch =
      !searchQuery ||
      row.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNature = natureFilter === 'ALL' || row.nature === natureFilter;
    return matchesSearch && matchesNature;
  }) || [];

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Account Code,Account Name,Nature,Gross Debit,Gross Credit,Debit Balance,Credit Balance'];
    const lines = filteredRows.map(
      r => `"${r.code}","${r.name}","${r.nature}",${r.totalDebit},${r.totalCredit},${r.debitBalance},${r.creditBalance}`
    );
    const totals = `Total,,,,${data.totalDebit},${data.totalCredit}`;
    const blob = new Blob([[...headers, ...lines, totals].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trial_Balance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-sm text-gray-500 mt-1">
            General ledger equilibrium verification, net account balances, and statutory closing position
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={fetchTrialBalance}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Equilibrium Status Banner */}
      {data && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            data.isBalanced
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {data.isBalanced ? (
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <CheckCircle className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-base">
                {data.isBalanced
                  ? 'Trial Balance is in Complete Equilibrium'
                  : 'Trial Balance Out of Equilibrium'}
              </h3>
              <p className="text-xs opacity-90 mt-0.5">
                {data.isBalanced
                  ? 'All general ledger accounts are perfectly balanced. Total debits equal total credits without variance.'
                  : `Variance detected! Total Debits differ from Total Credits by ₹${data.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold uppercase tracking-wider block">As of Date</span>
            <span className="text-sm font-mono font-bold">
              {new Date(data.asOfDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Debits (₹)</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
            ₹{(data?.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">Assets & Expenses balances</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Credits (₹)</div>
          <div className="mt-2 text-2xl font-bold text-rose-700 font-mono">
            ₹{(data?.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">Liabilities, Equity & Revenue</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Difference</div>
          <div className={`mt-2 text-2xl font-bold font-mono ${data?.difference === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            ₹{(data?.difference || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">Must equal ₹0.00 for audit</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Accounts</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 font-mono">
            {data?.rows?.length || 0}
          </div>
          <div className="text-xs text-gray-400 mt-1">In Chart of Accounts</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search account code or name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Class:</span>
            <select
              value={natureFilter}
              onChange={e => setNatureFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Categories</option>
              <option value="ASSET">Assets (1000s)</option>
              <option value="LIABILITY">Liabilities (2000s)</option>
              <option value="EQUITY">Equity (3000s)</option>
              <option value="REVENUE">Revenue (4000s)</option>
              <option value="EXPENSE">Expenses (5000s)</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-gray-500 font-medium">
          Showing {filteredRows.length} of {data?.rows?.length || 0} accounts
        </span>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Account Title</th>
              <th className="py-3 px-4">Account Nature</th>
              <th className="py-3 px-4 text-right">Gross Debits</th>
              <th className="py-3 px-4 text-right">Gross Credits</th>
              <th className="py-3 px-4 text-right font-bold text-gray-900 bg-emerald-50/40">Debit Balance (Dr)</th>
              <th className="py-3 px-4 text-right font-bold text-gray-900 bg-rose-50/40">Credit Balance (Cr)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                  Generating statutory Trial Balance...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  No accounts found matching filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.code} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-brand-700">{r.code}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">{r.name}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        r.nature === 'ASSET'
                          ? 'bg-blue-100 text-blue-800'
                          : r.nature === 'LIABILITY'
                          ? 'bg-amber-100 text-amber-800'
                          : r.nature === 'EQUITY'
                          ? 'bg-purple-100 text-purple-800'
                          : r.nature === 'REVENUE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.nature}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-gray-600">
                    {r.totalDebit > 0 ? `₹${r.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-gray-600">
                    {r.totalCredit > 0 ? `₹${r.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                    {r.debitBalance > 0 ? `₹${r.debitBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-700 bg-rose-50/20">
                    {r.creditBalance > 0 ? `₹${r.creditBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {data && (
            <tfoot className="bg-gray-100 border-t-2 border-gray-400 font-bold text-gray-900 text-sm">
              <tr>
                <td colSpan={3} className="py-3.5 px-4 uppercase tracking-wider text-right">
                  Trial Balance Totals:
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-xs text-gray-500">
                  ₹{filteredRows.reduce((s, r) => s + r.totalDebit, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-xs text-gray-500">
                  ₹{filteredRows.reduce((s, r) => s + r.totalCredit, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-emerald-800 bg-emerald-100/50">
                  ₹{data.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-rose-800 bg-rose-100/50">
                  ₹{data.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
