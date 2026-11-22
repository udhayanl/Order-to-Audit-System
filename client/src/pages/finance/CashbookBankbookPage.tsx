import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  Wallet,
  Building,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  PlusCircle,
  FileText,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  X,
  ArrowRightLeft,
} from 'lucide-react';

interface BookReport {
  accountName: string;
  accountType: string;
  openingBalance: number;
  currentBalance: number;
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
  transactions: Array<{
    id: string;
    date: string;
    type: string;
    direction: 'IN' | 'OUT';
    receipt: number;
    payment: number;
    balanceAfter: number;
    referenceType: string;
    referenceNumber: string | null;
    description: string | null;
    performedBy: string | null;
  }>;
}

export const CashbookBankbookPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cash' | 'bank'>('cash');
  const [data, setData] = useState<BookReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isContraModalOpen, setIsContraModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Contra form state
  const [contraFromId, setContraFromId] = useState('');
  const [contraToId, setContraToId] = useState('');
  const [contraAmount, setContraAmount] = useState('');
  const [contraDesc, setContraDesc] = useState('');
  const [contraLoading, setContraLoading] = useState(false);
  const [contraError, setContraError] = useState('');
  const [contraSuccess, setContraSuccess] = useState('');

  const fetchBook = () => {
    setLoading(true);
    const endpoint = activeTab === 'cash' ? '/finance/cashbook' : '/finance/bankbook';
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    api.get(endpoint, { params })
      .then((res: any) => {
        setData(res.data || res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchAccounts = () => {
    api.get('/finance/accounts')
      .then((res: any) => {
        const accs = res.data || res;
        setAccounts(accs);
        if (accs.length >= 2) {
          const cash = accs.find((a: any) => a.accountType === 'CASH');
          const bank = accs.find((a: any) => a.accountType === 'CURRENT_ACCOUNT' || a.accountType === 'SAVINGS_ACCOUNT');
          if (cash && bank) {
            setContraFromId(cash.id);
            setContraToId(bank.id);
          }
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchBook();
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleContraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContraError('');
    setContraSuccess('');
    const amt = parseFloat(contraAmount);
    if (!amt || amt <= 0) {
      setContraError('Please enter a valid transfer amount.');
      return;
    }
    if (contraFromId === contraToId) {
      setContraError('Source and destination accounts must be different.');
      return;
    }

    setContraLoading(true);
    try {
      await api.post('/finance/accounts/transfer', {
        fromAccountId: contraFromId,
        toAccountId: contraToId,
        amount: amt,
        description: contraDesc || (activeTab === 'cash' ? 'Cash deposited into bank' : 'Cash withdrawn from bank'),
      });
      setContraSuccess('Contra voucher posted and double-entry journal recorded successfully!');
      setTimeout(() => {
        setIsContraModalOpen(false);
        setContraAmount('');
        setContraDesc('');
        setContraSuccess('');
        fetchBook();
        fetchAccounts();
      }, 1200);
    } catch (err: any) {
      setContraError(err?.response?.data?.message || err?.message || 'Contra transfer failed.');
    } finally {
      setContraLoading(false);
    }
  };

  const filteredTransactions = data?.transactions?.filter(tx => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.referenceNumber?.toLowerCase().includes(q) ||
      tx.description?.toLowerCase().includes(q) ||
      tx.type.toLowerCase().includes(q) ||
      tx.performedBy?.toLowerCase().includes(q)
    );
  }) || [];

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Date,Voucher/Ref,Type,Description,Receipt (Dr),Payment (Cr),Balance,Logged By'];
    const rows = filteredTransactions.map(tx =>
      `"${new Date(tx.date).toLocaleDateString('en-IN')}","${tx.referenceNumber || ''}","${tx.type}","${(tx.description || '').replace(/"/g, '""')}",${tx.receipt},${tx.payment},${tx.balanceAfter},"${tx.performedBy || ''}"`
    );
    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab === 'cash' ? 'Cashbook' : 'Bankbook'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashbook & Bankbook</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time chronological receipts, disbursements, contra vouchers, and running balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsContraModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Contra Transfer
          </button>
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
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('cash')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'cash'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Cash Book (Cash-in-Hand)
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'bank'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building className="w-4 h-4" />
            Bank Book (SBI Current A/c)
          </button>
        </nav>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Opening Balance</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            ₹{(data?.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">Initial book balance</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Total Receipts (Inflows)</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            ₹{(data?.totalReceipts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-700/80 mt-1">Customer & contra credits</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Total Payments (Outflows)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">
            ₹{(data?.totalPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-rose-700/80 mt-1">Suppliers, expenses & debits</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm bg-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Closing Balance</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">
            ₹{(data?.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-blue-600/80 mt-1">Available liquid balance</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search reference, narration..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              Clear Dates
            </button>
          )}
        </div>

        <button
          onClick={fetchBook}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-base font-semibold text-gray-900">
            {activeTab === 'cash' ? 'Cash Book Ledger' : 'Bank Book Statement'} ({filteredTransactions.length} entries)
          </h2>
          <span className="text-xs font-medium px-2.5 py-1 bg-brand-100 text-brand-800 rounded-full">
            Account: {data?.accountName || 'Loading...'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Voucher / Ref</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Narration / Description</th>
                <th className="py-3 px-4 text-right">Receipt (Dr)</th>
                <th className="py-3 px-4 text-right">Payment (Cr)</th>
                <th className="py-3 px-4 text-right font-semibold">Balance</th>
                <th className="py-3 px-4">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading register transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No transactions recorded for the selected period.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-gray-700 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-medium text-brand-700">
                      {tx.referenceNumber || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          tx.type === 'RECEIPT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.type === 'DISBURSEMENT'
                            ? 'bg-rose-100 text-rose-800'
                            : tx.type === 'EXPENSE'
                            ? 'bg-amber-100 text-amber-800'
                            : tx.type === 'TRANSFER'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-800 font-medium max-w-xs truncate" title={tx.description || ''}>
                      {tx.description || tx.referenceType}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">
                      {tx.receipt > 0 ? `₹${tx.receipt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">
                      {tx.payment > 0 ? `₹${tx.payment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900 font-mono">
                      ₹{tx.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                      {tx.performedBy || 'System'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredTransactions.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900 text-xs">
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider">
                    Period Totals:
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-mono text-sm">
                    ₹{(data?.totalReceipts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-700 font-mono text-sm">
                    ₹{(data?.totalPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-800 font-mono text-sm">
                    ₹{(data?.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Contra Transfer Modal */}
      {isContraModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-gray-900">Contra Voucher (Fund Transfer)</h3>
              </div>
              <button
                onClick={() => setIsContraModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContraSubmit} className="p-6 space-y-4">
              {contraError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{contraError}</span>
                </div>
              )}
              {contraSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{contraSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  From Account (Source - Debit)
                </label>
                <select
                  value={contraFromId}
                  onChange={e => setContraFromId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select source account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} (Balance: ₹{a.currentBalance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  To Account (Destination - Credit)
                </label>
                <select
                  value={contraToId}
                  onChange={e => setContraToId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select destination account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} (Balance: ₹{a.currentBalance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Transfer Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={contraAmount}
                  onChange={e => setContraAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Narration / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash deposit from retail sales collections"
                  value={contraDesc}
                  onChange={e => setContraDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsContraModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contraLoading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {contraLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Record Contra Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
