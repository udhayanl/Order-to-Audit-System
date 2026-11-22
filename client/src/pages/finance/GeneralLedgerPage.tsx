import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  BookOpen,
  PlusCircle,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  Download,
  Printer,
  ChevronDown,
  Layers,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export const GeneralLedgerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'accounts' | 'journals'>('ledger');
  const [loading, setLoading] = useState(false);

  // Chart of Accounts State
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    nature: 'EXPENSE',
    description: '',
  });

  // General Ledger State
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('ALL');
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Journals State
  const [journals, setJournals] = useState<any[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<any | null>(null);
  const [isNewJournalModalOpen, setIsNewJournalModalOpen] = useState(false);
  const [journalLines, setJournalLines] = useState<Array<{ accountCode: string; debit: number; credit: number; description: string }>>([
    { accountCode: '', debit: 0, credit: 0, description: '' },
    { accountCode: '', debit: 0, credit: 0, description: '' },
  ]);
  const [journalNarration, setJournalNarration] = useState('');
  const [journalType, setJournalType] = useState('MANUAL');
  const [journalError, setJournalError] = useState('');
  const [journalSuccess, setJournalSuccess] = useState('');

  const fetchChartOfAccounts = () => {
    api.get('/finance/accounting/chart-of-accounts')
      .then((res: any) => {
        setChartOfAccounts(res.data || res || []);
      })
      .catch(console.error);
  };

  const fetchLedger = () => {
    setLoading(true);
    const params: any = {};
    if (selectedAccountCode && selectedAccountCode !== 'ALL') {
      params.accountCode = selectedAccountCode;
    }
    if (ledgerStartDate) params.startDate = ledgerStartDate;
    if (ledgerEndDate) params.endDate = ledgerEndDate;

    api.get('/finance/accounting/general-ledger', { params })
      .then((res: any) => {
        const payload = res.data || res;
        setLedgerEntries(payload.entries || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchJournals = () => {
    setLoading(true);
    api.get('/finance/accounting/journals')
      .then((res: any) => {
        setJournals(res.data || res || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChartOfAccounts();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger();
    } else if (activeTab === 'journals') {
      fetchJournals();
    }
  }, [activeTab, selectedAccountCode, ledgerStartDate, ledgerEndDate]);

  // Handle New Account Submit
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/finance/accounting/chart-of-accounts', newAccount);
      setIsAddAccountModalOpen(false);
      setNewAccount({ code: '', name: '', nature: 'EXPENSE', description: '' });
      fetchChartOfAccounts();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to create account');
    }
  };

  // Dynamic Journal Line Management
  const addJournalLine = () => {
    setJournalLines([...journalLines, { accountCode: '', debit: 0, credit: 0, description: '' }]);
  };

  const removeJournalLine = (index: number) => {
    if (journalLines.length <= 2) return;
    setJournalLines(journalLines.filter((_, i) => i !== index));
  };

  const updateJournalLine = (index: number, field: string, value: any) => {
    const updated = [...journalLines];
    if (field === 'debit' && value > 0) {
      updated[index] = { ...updated[index], debit: parseFloat(value) || 0, credit: 0 };
    } else if (field === 'credit' && value > 0) {
      updated[index] = { ...updated[index], credit: parseFloat(value) || 0, debit: 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setJournalLines(updated);
  };

  const totalDebit = Math.round(journalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
  const totalCredit = Math.round(journalLines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const isBalanced = totalDebit > 0 && difference === 0;

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setJournalError('');
    setJournalSuccess('');

    if (!isBalanced) {
      setJournalError(`Journal is not balanced! Difference is ₹${difference.toFixed(2)}.`);
      return;
    }

    try {
      await api.post('/finance/accounting/journals', {
        entryType: journalType,
        narration: journalNarration,
        lines: journalLines.map(l => ({
          accountCode: l.accountCode,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || journalNarration,
        })),
      });

      setJournalSuccess('Journal entry posted successfully!');
      setTimeout(() => {
        setIsNewJournalModalOpen(false);
        setJournalNarration('');
        setJournalLines([
          { accountCode: '', debit: 0, credit: 0, description: '' },
          { accountCode: '', debit: 0, credit: 0, description: '' },
        ]);
        setJournalSuccess('');
        fetchJournals();
        fetchLedger();
        fetchChartOfAccounts();
      }, 1200);
    } catch (err: any) {
      setJournalError(err?.response?.data?.message || err?.message || 'Failed to post journal entry.');
    }
  };

  const filteredLedger = ledgerEntries.filter(entry => {
    if (!ledgerSearch) return true;
    const q = ledgerSearch.toLowerCase();
    return (
      entry.entryNumber?.toLowerCase().includes(q) ||
      entry.narration?.toLowerCase().includes(q) ||
      entry.accountName?.toLowerCase().includes(q) ||
      entry.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Ledger & Accounting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Indian standard double-entry general ledger, chart of accounts, and balanced journal entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewJournalModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            New Journal Entry
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            General Ledger Drilldown
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'accounts'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            Chart of Accounts ({chartOfAccounts.length})
          </button>
          <button
            onClick={() => setActiveTab('journals')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'journals'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Journal Entries Register
          </button>
        </nav>
      </div>

      {/* TAB 1: GENERAL LEDGER DRILLDOWN */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-64">
                <select
                  value={selectedAccountCode}
                  onChange={e => setSelectedAccountCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-medium"
                >
                  <option value="ALL">All Accounts (Consolidated GL)</option>
                  {chartOfAccounts.map(a => (
                    <option key={a.code} value={a.code}>
                      {a.code} - {a.name} ({a.nature})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filter narration, ref..."
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 w-52"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">From:</span>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={e => setLedgerStartDate(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">To:</span>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={e => setLedgerEndDate(e.target.value)}
                  className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={fetchLedger}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Entry #</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Narration / Particulars</th>
                    <th className="py-3 px-4 text-right">Debit (Dr)</th>
                    <th className="py-3 px-4 text-right">Credit (Cr)</th>
                    <th className="py-3 px-4 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                        Loading General Ledger...
                      </td>
                    </tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        No ledger entries found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono text-gray-600 whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-brand-700">
                          {row.entryNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded mr-1.5">
                            {row.accountCode}
                          </span>
                          <span className="text-xs font-medium text-gray-700">{row.accountName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                            {row.entryType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-800 max-w-xs truncate" title={row.narration}>
                          <div className="font-medium text-xs text-gray-900">{row.narration}</div>
                          {row.description && row.description !== row.narration && (
                            <div className="text-[11px] text-gray-500 italic">{row.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600">
                          {row.debit > 0 ? `₹${row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-rose-600">
                          {row.credit > 0 ? `₹${row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900 font-mono">
                          ₹{row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Complete Chart of Accounts covering Assets (1000s), Liabilities (2000s), Equity (3000s), Revenue (4000s), and Expenses (5000s)
            </p>
            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700"
            >
              <PlusCircle className="w-4 h-4" />
              Add Account
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Nature</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit Balance</th>
                  <th className="py-3 px-4 text-right">Credit Balance</th>
                  <th className="py-3 px-4 text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {chartOfAccounts.map(acc => {
                  const debit = Number(acc.currentDebit || 0);
                  const credit = Number(acc.currentCredit || 0);
                  const balance = Number(acc.currentBalance || 0);
                  return (
                    <tr key={acc.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono font-bold text-brand-700">{acc.code}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{acc.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            acc.nature === 'ASSET'
                              ? 'bg-blue-100 text-blue-800'
                              : acc.nature === 'LIABILITY'
                              ? 'bg-amber-100 text-amber-800'
                              : acc.nature === 'EQUITY'
                              ? 'bg-purple-100 text-purple-800'
                              : acc.nature === 'REVENUE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {acc.nature}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">{acc.description || '-'}</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        ₹{debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600">
                        ₹{credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: JOURNAL ENTRIES REGISTER */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Entry Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Narration</th>
                  <th className="py-3 px-4 text-right">Debit Sum</th>
                  <th className="py-3 px-4 text-right">Credit Sum</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {journals.map((j) => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700">{j.entryNumber}</td>
                    <td className="py-3 px-4 text-xs font-mono">
                      {new Date(j.entryDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {j.entryType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{j.narration}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-emerald-600">
                      ₹{Number(j.totalDebit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-rose-600">
                      ₹{Number(j.totalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Balanced
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedJournal(j)}
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                      >
                        View Lines ({j.lines?.length || 0})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW JOURNAL ENTRY MODAL */}
      {isNewJournalModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-gray-900">Post Double-Entry Journal Voucher</h3>
              </div>
              <button
                onClick={() => setIsNewJournalModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostJournal} className="p-6 space-y-4 overflow-y-auto flex-1">
              {journalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{journalError}</span>
                </div>
              )}
              {journalSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{journalSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Entry Type</label>
                  <select
                    value={journalType}
                    onChange={e => setJournalType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="MANUAL">Manual Journal</option>
                    <option value="ADJUSTMENT">Adjustment Entry</option>
                    <option value="CONTRA">Contra Entry</option>
                    <option value="CLOSING">Period Closing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Narration (Voucher Note)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Month-end depreciation adjustment"
                    value={journalNarration}
                    onChange={e => setJournalNarration(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Debit & Credit Lines</span>
                  <button
                    type="button"
                    onClick={addJournalLine}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Line
                  </button>
                </div>

                <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                  {journalLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-1/3">
                        <select
                          required
                          value={line.accountCode}
                          onChange={e => updateJournalLine(idx, 'accountCode', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md font-medium"
                        >
                          <option value="">Select Account</option>
                          {chartOfAccounts.map(a => (
                            <option key={a.code} value={a.code}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-1/4">
                        <input
                          type="text"
                          placeholder="Particulars"
                          value={line.description}
                          onChange={e => updateJournalLine(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                        />
                      </div>

                      <div className="w-1/5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Debit (₹)"
                          value={line.debit || ''}
                          onChange={e => updateJournalLine(idx, 'debit', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md text-right font-mono"
                        />
                      </div>

                      <div className="w-1/5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Credit (₹)"
                          value={line.credit || ''}
                          onChange={e => updateJournalLine(idx, 'credit', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md text-right font-mono"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeJournalLine(idx)}
                        disabled={journalLines.length <= 2}
                        className="p-1 text-gray-400 hover:text-rose-600 disabled:opacity-20"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Equilibrium Verification Bar */}
              <div className="p-4 bg-gray-100 rounded-lg flex items-center justify-between text-xs font-semibold">
                <div>
                  <span>Total Debit: </span>
                  <span className="font-mono text-emerald-700 font-bold">₹{totalDebit.toFixed(2)}</span>
                  <span className="mx-3 text-gray-400">|</span>
                  <span>Total Credit: </span>
                  <span className="font-mono text-rose-700 font-bold">₹{totalCredit.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Difference: </span>
                  <span className={`font-mono font-bold ${difference === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    ₹{difference.toFixed(2)}
                  </span>
                  {isBalanced ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                      BALANCED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                      UNBALANCED
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewJournalModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-40"
                >
                  Post Journal Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW JOURNAL LINES MODAL */}
      {selectedJournal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900">Journal Voucher #{selectedJournal.entryNumber}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedJournal.narration}</p>
              </div>
              <button
                onClick={() => setSelectedJournal(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Account</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (Dr)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedJournal.lines?.map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-2.5 px-3 font-medium text-gray-900">
                        <span className="font-mono text-xs text-brand-700 mr-2">{l.accountCode}</span>
                        {l.account?.name || ''}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{l.description || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                        {Number(l.debit) > 0 ? `₹${Number(l.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                        {Number(l.credit) > 0 ? `₹${Number(l.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD ACCOUNT MODAL */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900">Add Chart of Account</h3>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Account Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5080"
                  value={newAccount.code}
                  onChange={e => setNewAccount({ ...newAccount, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Printing & Stationery"
                  value={newAccount.name}
                  onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nature</label>
                <select
                  value={newAccount.nature}
                  onChange={e => setNewAccount({ ...newAccount, nature: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="ASSET">ASSET (1000s)</option>
                  <option value="LIABILITY">LIABILITY (2000s)</option>
                  <option value="EQUITY">EQUITY (3000s)</option>
                  <option value="REVENUE">REVENUE (4000s)</option>
                  <option value="EXPENSE">EXPENSE (5000s)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief account usage notes"
                  value={newAccount.description}
                  onChange={e => setNewAccount({ ...newAccount, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
