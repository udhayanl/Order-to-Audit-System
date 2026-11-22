import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  Wallet,
  Building,
  PlusCircle,
  ArrowRightLeft,
  X,
  History,
  CheckCircle,
} from 'lucide-react';

export const CashBankAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Account Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('CURRENT_ACCOUNT');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(10000);

  // Contra Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(1000);
  const [transferDesc, setTransferDesc] = useState('');

  // Account Statement Modal
  const [statementData, setStatementData] = useState<any | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = () => {
    setLoading(true);
    api.get('/finance/accounts')
      .then((data) => {
        setAccounts(data || []);
        if (data && data.length >= 2) {
          setFromAccountId(data[0].id);
          setToAccountId(data[1].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      await api.post('/finance/accounts', {
        accountName,
        accountType,
        bankName: bankName || undefined,
        accountNumber: accountNumber || undefined,
        ifscCode: ifscCode || undefined,
        branchName: branchName || undefined,
        openingBalance: Number(openingBalance),
      });
      setShowAddModal(false);
      setAccountName('');
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to create financial account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContraTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      await api.post('/finance/accounts/transfer', {
        fromAccountId,
        toAccountId,
        amount: Number(transferAmount),
        description: transferDesc || undefined,
      });
      setShowTransferModal(false);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to complete contra transfer.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewStatement = async (id: string) => {
    try {
      const res = await api.get(`/finance/accounts/${id}`);
      setStatementData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch statement.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash & Bank Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Operating treasury accounts with derived running balances, contra transfers and immutable audit trails
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTransferModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Contra Transfer
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 text-center py-8 text-gray-400">Loading treasury accounts...</div>
        ) : (
          accounts.map((acc) => (
            <div key={acc.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                    acc.accountType === 'CASH'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {acc.accountType === 'CASH' ? <Wallet className="w-3.5 h-3.5" /> : <Building className="w-3.5 h-3.5" />}
                    {acc.accountType}
                  </span>
                  <span className="text-xs text-gray-400">{acc.transactionCount} entries</span>
                </div>

                <h3 className="text-base font-bold text-gray-900 mt-3">{acc.accountName}</h3>
                {acc.accountNumber && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    A/c: <span className="font-mono text-gray-800">{acc.accountNumber}</span> ({acc.bankName})
                  </div>
                )}
                {acc.ifscCode && (
                  <div className="text-xs text-gray-400">IFSC: {acc.ifscCode} - {acc.branchName}</div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-400">Current Balance</div>
                  <div className="text-xl font-bold text-gray-900">
                    ₹{Number(acc.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <button
                  onClick={() => handleViewStatement(acc.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100"
                >
                  Statement
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contra Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-600" />
                Inter-Account Contra Transfer
              </h2>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContraTransfer} className="space-y-4 mt-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Source Account (Debit from)</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName} (Avail: ₹{Number(a.currentBalance).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Destination Account (Credit to)</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName} (Balance: ₹{Number(a.currentBalance).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Transfer Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Transfer Purpose / Description</label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  placeholder="e.g. Cash withdrawal from SBI for petty cash"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Transferring...' : 'Execute Contra Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h2 className="text-lg font-bold text-gray-900">Add Treasury Account</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 mt-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. HDFC Bank Operating A/c"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Account Type *</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="CURRENT_ACCOUNT">Current Account (Bank)</option>
                  <option value="SAVINGS_ACCOUNT">Savings Account (Bank)</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="OTHER">Other Liquidity Account</option>
                </select>
              </div>

              {accountType !== 'CASH' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="e.g. 502000123456"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        placeholder="e.g. HDFC0001234"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="e.g. Main Branch, Trichy"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Statement Modal */}
      {statementData && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-base font-bold text-gray-900">{statementData.accountName} Statement</h3>
                <div className="text-xs text-gray-500 mt-0.5">Current Balance: ₹{Number(statementData.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <button onClick={() => setStatementData(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-600 uppercase font-bold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Inflow (₹)</th>
                    <th className="py-2.5 px-3 text-right">Outflow (₹)</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statementData.transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 whitespace-nowrap">{new Date(tx.transactionDate).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 font-semibold">{tx.transactionType}</td>
                      <td className="py-2.5 px-3 text-gray-600">{tx.description}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                        {tx.direction === 'IN' ? `₹${Number(tx.amount).toLocaleString()}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-rose-600">
                        {tx.direction === 'OUT' ? `₹${Number(tx.amount).toLocaleString()}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                        ₹{Number(tx.balanceAfter).toLocaleString()}
                      </td>
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
