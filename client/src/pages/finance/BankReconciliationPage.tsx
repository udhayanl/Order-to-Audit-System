import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  Building,
  Upload,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  PlusCircle,
  X,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface BankStatement {
  id: string;
  statementNumber: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  status: string;
  financialAccount: {
    id: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
  };
  lines: Array<{
    id: string;
    transactionDate: string;
    description: string;
    referenceNumber: string | null;
    withdrawal: number;
    deposit: number;
    status: string;
    matchedTransactionId: string | null;
  }>;
}

export const BankReconciliationPage: React.FC = () => {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [reconciliationReports, setReconciliationReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'workspace' | 'history'>('workspace');
  const [accounts, setAccounts] = useState<any[]>([]);

  // Import Statement Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importAccountId, setImportAccountId] = useState('');
  const [importStmtNumber, setImportStmtNumber] = useState('');
  const [importStartDate, setImportStartDate] = useState('');
  const [importEndDate, setImportEndDate] = useState('');
  const [importOpeningBal, setImportOpeningBal] = useState('');
  const [importClosingBal, setImportClosingBal] = useState('');
  const [importLines, setImportLines] = useState<Array<{
    transactionDate: string;
    description: string;
    referenceNumber: string;
    withdrawal: number;
    deposit: number;
  }>>([
    { transactionDate: new Date().toISOString().slice(0, 10), description: '', referenceNumber: '', withdrawal: 0, deposit: 0 },
  ]);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Manual Match State
  const [isManualMatchModalOpen, setIsManualMatchModalOpen] = useState(false);
  const [selectedLineForMatch, setSelectedLineForMatch] = useState<any | null>(null);
  const [manualMatchTxId, setManualMatchTxId] = useState('');
  const [bookTransactions, setBookTransactions] = useState<any[]>([]);

  // Finalize State
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizeNotes, setFinalizeNotes] = useState('');

  const fetchStatements = () => {
    setLoading(true);
    api.get('/finance/reconciliation/statements')
      .then((res: any) => {
        const list = res.data || res || [];
        setStatements(list);
        if (list.length > 0 && !selectedStatement) {
          setSelectedStatement(list[0]);
        } else if (selectedStatement) {
          const fresh = list.find((s: any) => s.id === selectedStatement.id);
          if (fresh) setSelectedStatement(fresh);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchAccounts = () => {
    api.get('/finance/accounts')
      .then((res: any) => {
        const accs = res.data || res || [];
        const bankAccounts = accs.filter((a: any) => a.accountType !== 'CASH');
        setAccounts(bankAccounts);
        if (bankAccounts.length > 0 && !importAccountId) {
          setImportAccountId(bankAccounts[0].id);
        }
      })
      .catch(console.error);
  };

  const fetchReports = () => {
    api.get('/finance/reconciliation/reports')
      .then((res: any) => {
        setReconciliationReports(res.data || res || []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchStatements();
    fetchAccounts();
    fetchReports();
  }, []);

  // Fetch book transactions when opening manual match modal
  const openManualMatch = (line: any) => {
    setSelectedLineForMatch(line);
    setIsManualMatchModalOpen(true);
    if (selectedStatement) {
      api.get(`/finance/accounts/${selectedStatement.financialAccount.id}`)
        .then((res: any) => {
          const acc = res.data || res;
          setBookTransactions(acc.transactions || []);
        })
        .catch(console.error);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportSuccess('');

    if (!importAccountId) {
      setImportError('Please select a bank account.');
      return;
    }
    if (importLines.length === 0) {
      setImportError('Please include at least one bank transaction line.');
      return;
    }

    setImportLoading(true);
    try {
      await api.post('/finance/reconciliation/import', {
        financialAccountId: importAccountId,
        statementNumber: importStmtNumber || undefined,
        startDate: importStartDate,
        endDate: importEndDate,
        openingBalance: parseFloat(importOpeningBal) || 0,
        closingBalance: parseFloat(importClosingBal) || 0,
        lines: importLines.map(l => ({
          transactionDate: l.transactionDate,
          description: l.description,
          referenceNumber: l.referenceNumber || undefined,
          withdrawal: Number(l.withdrawal) || 0,
          deposit: Number(l.deposit) || 0,
        })),
      });

      setImportSuccess('Bank statement imported successfully!');
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess('');
        fetchStatements();
      }, 1200);
    } catch (err: any) {
      setImportError(err?.response?.data?.message || err?.message || 'Failed to import bank statement.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedStatement) return;
    try {
      const res: any = await api.post(`/finance/reconciliation/${selectedStatement.id}/auto-match`, {});
      alert(`Auto-match complete! Matched: ${res.data?.matchedCount || res?.matchedCount || 0} transaction(s).`);
      fetchStatements();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Auto-match failed.');
    }
  };

  const handleManualMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLineForMatch || !manualMatchTxId) return;

    try {
      await api.post('/finance/reconciliation/manual-match', {
        lineId: selectedLineForMatch.id,
        transactionId: manualMatchTxId,
      });
      setIsManualMatchModalOpen(false);
      setSelectedLineForMatch(null);
      setManualMatchTxId('');
      fetchStatements();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Manual match failed.');
    }
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatement) return;

    try {
      await api.post(`/finance/reconciliation/${selectedStatement.id}/finalize`, {
        notes: finalizeNotes,
      });
      setIsFinalizeModalOpen(false);
      setFinalizeNotes('');
      fetchStatements();
      fetchReports();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to finalize reconciliation.');
    }
  };

  // Add line to import state
  const addImportLine = () => {
    setImportLines([
      ...importLines,
      { transactionDate: new Date().toISOString().slice(0, 10), description: '', referenceNumber: '', withdrawal: 0, deposit: 0 },
    ]);
  };

  const updateImportLine = (idx: number, field: string, val: any) => {
    const updated = [...importLines];
    (updated[idx] as any)[field] = val;
    setImportLines(updated);
  };

  const removeImportLine = (idx: number) => {
    if (importLines.length <= 1) return;
    setImportLines(importLines.filter((_, i) => i !== idx));
  };

  const reconciledCount = selectedStatement?.lines.filter(l => l.status === 'RECONCILED').length || 0;
  const totalCount = selectedStatement?.lines.length || 0;
  const reconciledPercent = totalCount > 0 ? Math.round((reconciledCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliation (BRS)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automated statement matching, cheque clearance audit, and book-to-bank balance reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Bank Statement
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'workspace'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building className="w-4 h-4" />
            Reconciliation Workspace
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Audit Reports History ({reconciliationReports.length})
          </button>
        </nav>
      </div>

      {activeTab === 'workspace' && (
        <div className="space-y-6">
          {/* Statement Selector & Summary Bar */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Active Statement
                </label>
                <select
                  value={selectedStatement?.id || ''}
                  onChange={e => {
                    const st = statements.find(s => s.id === e.target.value);
                    if (st) setSelectedStatement(st);
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-brand-500 min-w-[260px]"
                >
                  {statements.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.statementNumber} - {s.financialAccount?.bankName} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {selectedStatement && (
                <div className="hidden sm:block border-l border-gray-200 pl-4 space-y-0.5 text-xs text-gray-600">
                  <div>
                    <span className="font-semibold text-gray-800">Period: </span>
                    {new Date(selectedStatement.startDate).toLocaleDateString('en-IN')} to{' '}
                    {new Date(selectedStatement.endDate).toLocaleDateString('en-IN')}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-800">Account: </span>
                    {selectedStatement.financialAccount?.accountName} ({selectedStatement.financialAccount?.accountNumber})
                  </div>
                </div>
              )}
            </div>

            {selectedStatement && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAutoMatch}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Auto-Match Rules
                </button>
                {selectedStatement.status !== 'RECONCILED' && (
                  <button
                    onClick={() => setIsFinalizeModalOpen(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Finalize BRS
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Reconciliation Progress Cards */}
          {selectedStatement && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Statement Opening</div>
                <div className="mt-2 text-2xl font-bold text-gray-900 font-mono">
                  ₹{Number(selectedStatement.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-gray-400 mt-1">Starting balance</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Statement Closing</div>
                <div className="mt-2 text-2xl font-bold text-blue-700 font-mono">
                  ₹{Number(selectedStatement.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-gray-400 mt-1">Bank confirmed balance</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reconciliation Status</div>
                <div className="mt-2 text-2xl font-bold font-mono flex items-center gap-2">
                  <span className={reconciledPercent === 100 ? 'text-emerald-600' : 'text-amber-600'}>
                    {reconciledCount} / {totalCount}
                  </span>
                  <span className="text-sm font-semibold text-gray-500">({reconciledPercent}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full"
                    style={{ width: `${reconciledPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Statement State</div>
                <div className="mt-2 text-xl font-bold">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      selectedStatement.status === 'RECONCILED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedStatement.status === 'RECONCILED' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {selectedStatement.status}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-2">Audit lock status</div>
              </div>
            </div>
          )}

          {/* Statement Lines Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">
                Bank Statement Transaction Lines ({selectedStatement?.lines?.length || 0})
              </h3>
              <span className="text-xs text-gray-500">
                Match each line with internal company cashbook/bankbook vouchers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Tx Date</th>
                    <th className="py-3 px-4">Description / Particulars</th>
                    <th className="py-3 px-4">Reference / Cheque</th>
                    <th className="py-3 px-4 text-right">Withdrawal (Dr)</th>
                    <th className="py-3 px-4 text-right">Deposit (Cr)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {!selectedStatement || selectedStatement.lines?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        No bank statement loaded. Click "Import Bank Statement" to get started.
                      </td>
                    </tr>
                  ) : (
                    selectedStatement.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-xs font-mono text-gray-700 whitespace-nowrap">
                          {new Date(l.transactionDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{l.description}</td>
                        <td className="py-3 px-4 text-xs font-mono text-brand-700">{l.referenceNumber || '-'}</td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600">
                          {Number(l.withdrawal) > 0 ? `₹${Number(l.withdrawal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {Number(l.deposit) > 0 ? `₹${Number(l.deposit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              l.status === 'RECONCILED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {l.status === 'RECONCILED' ? (
                            <span className="text-xs text-emerald-600 font-medium flex items-center justify-end gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Matched
                            </span>
                          ) : (
                            <button
                              onClick={() => openManualMatch(l)}
                              className="text-xs text-brand-600 hover:text-brand-800 font-semibold underline"
                            >
                              Match Book Tx
                            </button>
                          )}
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

      {/* TAB 2: AUDIT REPORTS HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Finalized Bank Reconciliation Statements</h3>
            <span className="text-xs text-gray-500">Statutory audit trail of confirmed bank balances</span>
          </div>

          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Statement Number</th>
                <th className="py-3 px-4">Bank Account</th>
                <th className="py-3 px-4">Reconciled Date</th>
                <th className="py-3 px-4 text-right">Bank Balance</th>
                <th className="py-3 px-4 text-right">Book Balance</th>
                <th className="py-3 px-4 text-right">Variance</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reconciliationReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No finalized bank reconciliation reports found.
                  </td>
                </tr>
              ) : (
                reconciliationReports.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700">
                      {r.statement?.statementNumber || r.statementNumber || r.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {r.statement?.financialAccount?.bankName || 'SBI Current A/c'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      {new Date(r.reconciledAt || r.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-gray-900">
                      ₹{Number(r.bankBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-gray-900">
                      ₹{Number(r.bookBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      ₹{Number(r.difference || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Confirmed
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* IMPORT BANK STATEMENT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-gray-900">Import Bank Statement</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
              {importSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Bank Account</label>
                  <select
                    value={importAccountId}
                    onChange={e => setImportAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} - {a.accountNumber} ({a.accountName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Statement Reference #</label>
                  <input
                    type="text"
                    placeholder="e.g. STMT-2026-NOV"
                    value={importStmtNumber}
                    onChange={e => setImportStmtNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={importStartDate}
                    onChange={e => setImportStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={importEndDate}
                    onChange={e => setImportEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 50000"
                    value={importOpeningBal}
                    onChange={e => setImportOpeningBal(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Closing Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 45125"
                    value={importClosingBal}
                    onChange={e => setImportClosingBal(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Statement Lines Table in Import Modal */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Statement Line Items</span>
                  <button
                    type="button"
                    onClick={addImportLine}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Line
                  </button>
                </div>

                <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50 max-h-56 overflow-y-auto">
                  {importLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="date"
                        required
                        value={line.transactionDate}
                        onChange={e => updateImportLine(idx, 'transactionDate', e.target.value)}
                        className="w-32 px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Description"
                        value={line.description}
                        onChange={e => updateImportLine(idx, 'description', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="Ref / Chq #"
                        value={line.referenceNumber}
                        onChange={e => updateImportLine(idx, 'referenceNumber', e.target.value)}
                        className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-md font-mono"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Withdrawal"
                        value={line.withdrawal || ''}
                        onChange={e => updateImportLine(idx, 'withdrawal', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-md text-right font-mono"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Deposit"
                        value={line.deposit || ''}
                        onChange={e => updateImportLine(idx, 'deposit', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-md text-right font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removeImportLine(idx)}
                        disabled={importLines.length <= 1}
                        className="p-1 text-gray-400 hover:text-rose-600 disabled:opacity-20"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Import Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL MATCH MODAL */}
      {isManualMatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900">Match Statement Line with Book Voucher</h3>
              <button
                onClick={() => setIsManualMatchModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualMatchSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-gray-700">Bank Statement Line:</div>
                <div className="text-gray-900 font-medium">{selectedLineForMatch?.description}</div>
                <div className="text-gray-600">
                  Amount:{' '}
                  <span className="font-bold font-mono">
                    ₹{Number(selectedLineForMatch?.deposit > 0 ? selectedLineForMatch.deposit : selectedLineForMatch?.withdrawal || 0).toLocaleString('en-IN')}
                  </span>{' '}
                  ({selectedLineForMatch?.deposit > 0 ? 'Credit / Deposit' : 'Debit / Withdrawal'})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Matching Book Transaction
                </label>
                <select
                  required
                  value={manualMatchTxId}
                  onChange={e => setManualMatchTxId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-mono"
                >
                  <option value="">-- Choose Book Transaction --</option>
                  {bookTransactions.map(tx => (
                    <option key={tx.id} value={tx.id}>
                      {new Date(tx.transactionDate).toLocaleDateString('en-IN')} - {tx.referenceNumber || tx.transactionType} - ₹{tx.amount} ({tx.direction}) - {tx.description?.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsManualMatchModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualMatchTxId}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40"
                >
                  Confirm Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINALIZE RECONCILIATION MODAL */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900">Finalize Bank Reconciliation</h3>
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFinalize} className="p-6 space-y-4">
              <p className="text-xs text-gray-600">
                Finalizing will mark this statement as officially reconciled and create an audit log snapshot of all book vs bank variances.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reconciliation Audit Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. All receipts matched. No unrepresented cheques at period end."
                  value={finalizeNotes}
                  onChange={e => setFinalizeNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFinalizeModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700"
                >
                  Finalize & Lock Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
