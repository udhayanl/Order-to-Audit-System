import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  DollarSign,
  Search,
  Eye,
  X,
  FileText,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export const AccountsReceivablePage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [ageing, setAgeing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Statement modal
  const [statementData, setStatementData] = useState<any | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/finance/receivables/summary'),
      api.get('/finance/receivables/ageing'),
    ])
      .then(([s, a]) => {
        setSummary(s);
        setAgeing(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleViewStatement = (customerId: string) => {
    setStatementLoading(true);
    api.get(`/finance/receivables/customers/${customerId}/statement`)
      .then(setStatementData)
      .catch((err) => alert(err.message || 'Failed to load customer statement.'))
      .finally(() => setStatementLoading(false));
  };

  const totals = ageing?.totals || {};
  const customers = ageing?.customers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounts Receivable (AR) & Customer Ageing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Detailed schedule of outstanding customer credit with aging intervals (Current, 1-30, 31-60, 61-90, &gt;90 days)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Invoiced</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            ₹{Number(summary?.totalInvoiced || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">{summary?.invoiceCount || 0} Total Invoices</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Collections</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            ₹{Number(summary?.totalCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Realized into Cash/Bank</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Outstanding</div>
          <div className="text-2xl font-bold text-brand-600 mt-1">
            ₹{Number(summary?.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Pending payment collection</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Overdue Invoices</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            ₹{Number(summary?.totalOverdue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-rose-600 mt-1">Past stipulated credit terms</div>
        </div>
      </div>

      {/* Ageing Schedule Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Customer Ageing Schedule</h2>
          <span className="text-xs text-gray-500">As of {new Date().toLocaleDateString()}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Type & State</th>
                <th className="py-3 px-4 text-right">Current (0d)</th>
                <th className="py-3 px-4 text-right">1-30 Days</th>
                <th className="py-3 px-4 text-right">31-60 Days</th>
                <th className="py-3 px-4 text-right">61-90 Days</th>
                <th className="py-3 px-4 text-right">&gt;90 Days</th>
                <th className="py-3 px-4 text-right">Total Outstanding</th>
                <th className="py-3 px-4 text-right">Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">Loading ageing analysis...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">No outstanding customer balances.</td>
                </tr>
              ) : (
                customers.map((c: any) => (
                  <tr key={c.customerId} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {c.customerName}
                      <span className="block text-[11px] font-normal text-gray-400">
                        GSTIN: {c.gstin || 'Unregistered'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium text-gray-800">{c.customerType}</span>
                      <span className="block text-gray-400">{c.state}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">₹{Number(c.current).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-amber-600">₹{Number(c.days1_30).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-orange-600">₹{Number(c.days31_60).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">₹{Number(c.days61_90).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-700">₹{Number(c.daysAbove90).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      ₹{Number(c.totalOutstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleViewStatement(c.customerId)}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100"
                      >
                        Ledger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {customers.length > 0 && (
              <tfoot className="bg-gray-100 font-bold text-gray-900 text-xs border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="py-3 px-4 uppercase">Total Portfolio Aging:</td>
                  <td className="py-3 px-4 text-right">₹{Number(totals.current || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-amber-700">₹{Number(totals.days1_30 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-orange-700">₹{Number(totals.days31_60 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-rose-700">₹{Number(totals.days61_90 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-red-800">₹{Number(totals.daysAbove90 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-brand-700 text-sm">
                    ₹{Number(totals.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Customer Statement Modal */}
      {statementData && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-base font-bold text-gray-900">Statement of Account (Debtors Ledger)</h3>
                <div className="text-xs text-gray-500 mt-0.5">{statementData.customer?.name} ({statementData.customer?.type})</div>
              </div>
              <button onClick={() => setStatementData(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3 bg-gray-50 rounded-xl border flex justify-between items-center text-xs">
              <div>
                <span className="text-gray-500">Billing Address:</span>
                <div className="font-medium text-gray-800">{statementData.customer?.billingAddress}</div>
              </div>
              <div className="text-right">
                <span className="text-gray-500">Current Balance:</span>
                <div className="text-base font-bold text-brand-700">₹{Number(statementData.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 uppercase text-gray-600 font-bold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {statementData.statement.map((entry: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 font-semibold">{entry.type}</td>
                      <td className="py-2.5 px-3 text-gray-600">{entry.referenceNumber}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{entry.debit > 0 ? `₹${Number(entry.debit).toLocaleString()}` : '-'}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-600">{entry.credit > 0 ? `₹${Number(entry.credit).toLocaleString()}` : '-'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">₹{Number(entry.runningBalance).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t flex justify-end mt-4">
              <button
                onClick={() => setStatementData(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
