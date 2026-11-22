import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  DollarSign,
  Truck,
  Eye,
  X,
  FileText,
} from 'lucide-react';

export const AccountsPayablePage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [ageing, setAgeing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Statement modal
  const [statementData, setStatementData] = useState<any | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/finance/payables/summary'),
      api.get('/finance/payables/ageing'),
    ])
      .then(([s, a]) => {
        setSummary(s);
        setAgeing(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleViewStatement = (supplierId: string) => {
    setStatementLoading(true);
    api.get(`/finance/payables/suppliers/${supplierId}/statement`)
      .then(setStatementData)
      .catch((err) => alert(err.message || 'Failed to load supplier statement.'))
      .finally(() => setStatementLoading(false));
  };

  const totals = ageing?.totals || {};
  const suppliers = ageing?.suppliers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounts Payable (AP) & Supplier Ageing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vendor payables schedule categorized by payment terms and aging intervals
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Purchases</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            ₹{Number(summary?.totalPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">{summary?.purchaseCount || 0} Total Purchase Invoices</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Disbursements Made</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            ₹{Number(summary?.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Paid to raw material & packaging vendors</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Outstanding Payable</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            ₹{Number(summary?.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Net pending vendor liability</div>
        </div>
      </div>

      {/* Supplier Ageing Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Supplier Ageing Schedule</h2>
          <span className="text-xs text-gray-500">As of {new Date().toLocaleDateString()}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Payment Terms</th>
                <th className="py-3 px-4 text-right">Current (0d)</th>
                <th className="py-3 px-4 text-right">1-30 Days</th>
                <th className="py-3 px-4 text-right">31-60 Days</th>
                <th className="py-3 px-4 text-right">61-90 Days</th>
                <th className="py-3 px-4 text-right">&gt;90 Days</th>
                <th className="py-3 px-4 text-right">Total Payable</th>
                <th className="py-3 px-4 text-right">Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">Loading vendor payables...</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">No pending supplier payables.</td>
                </tr>
              ) : (
                suppliers.map((s: any) => (
                  <tr key={s.supplierId} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {s.supplierName}
                      <span className="block text-[11px] font-normal text-gray-400">
                        GSTIN: {s.gstin || 'Unregistered'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-700">{s.paymentTerms || '30 Days'}</td>
                    <td className="py-3 px-4 text-right font-medium">₹{Number(s.current).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-amber-600">₹{Number(s.days1_30).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-orange-600">₹{Number(s.days31_60).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">₹{Number(s.days61_90).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-700">₹{Number(s.daysAbove90).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      ₹{Number(s.totalOutstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleViewStatement(s.supplierId)}
                        className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100"
                      >
                        Ledger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {suppliers.length > 0 && (
              <tfoot className="bg-gray-100 font-bold text-gray-900 text-xs border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="py-3 px-4 uppercase">Total Payables Portfolio:</td>
                  <td className="py-3 px-4 text-right">₹{Number(totals.current || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-amber-700">₹{Number(totals.days1_30 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-orange-700">₹{Number(totals.days31_60 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-rose-700">₹{Number(totals.days61_90 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-red-800">₹{Number(totals.daysAbove90 || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-amber-800 text-sm">
                    ₹{Number(totals.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Supplier Statement Modal */}
      {statementData && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-base font-bold text-gray-900">Supplier Statement of Account</h3>
                <div className="text-xs text-gray-500 mt-0.5">{statementData.supplier?.name}</div>
              </div>
              <button onClick={() => setStatementData(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3 bg-gray-50 rounded-xl border flex justify-between items-center text-xs">
              <div>
                <span className="text-gray-500">Vendor Address:</span>
                <div className="font-medium text-gray-800">{statementData.supplier?.address}</div>
              </div>
              <div className="text-right">
                <span className="text-gray-500">Current Payable Balance:</span>
                <div className="text-base font-bold text-amber-700">₹{Number(statementData.currentPayableBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 uppercase text-gray-600 font-bold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3 text-right">Debit / Paid (₹)</th>
                    <th className="py-2.5 px-3 text-right">Credit / Bill (₹)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {statementData.statement.map((entry: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 font-semibold">{entry.type}</td>
                      <td className="py-2.5 px-3 text-gray-600">{entry.referenceNumber}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-600">{entry.debit > 0 ? `₹${Number(entry.debit).toLocaleString()}` : '-'}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-amber-700">{entry.credit > 0 ? `₹${Number(entry.credit).toLocaleString()}` : '-'}</td>
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
