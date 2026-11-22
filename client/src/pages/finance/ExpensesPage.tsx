import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  DollarSign,
  PlusCircle,
  CheckCircle,
  XCircle,
  Filter,
  X,
  PieChart,
  Zap,
} from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Record modal state
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('ELECTRICITY');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(2000);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [financialAccountId, setFinancialAccountId] = useState('');
  const [vendor, setVendor] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchExpenses = () => {
    setLoading(true);
    const params: any = {};
    if (selectedCategory) params.category = selectedCategory;
    if (selectedStatus) params.status = selectedStatus;

    Promise.all([
      api.get('/finance/expenses', params),
      api.get('/finance/expenses/summary'),
      api.get('/finance/accounts'),
    ])
      .then(([exps, sum, accs]) => {
        setExpenses(exps || []);
        setSummary(sum || null);
        setAccounts(accs || []);
        if (accs && accs.length > 0 && !financialAccountId) {
          setFinancialAccountId(accs[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCategory, selectedStatus]);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFormError(null);

    try {
      await api.post('/finance/expenses', {
        category,
        description,
        amount: Number(amount),
        taxAmount: Number(taxAmount),
        vendor: vendor || undefined,
        paymentMethod,
        financialAccountId: financialAccountId || undefined,
        referenceNumber: referenceNumber || undefined,
        autoApprove,
      });

      setShowModal(false);
      setDescription('');
      setAmount(1000);
      setTaxAmount(0);
      fetchExpenses();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record operational expense.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm('Approve and post this expense to ledger and deduct cash/bank balance?')) return;
    try {
      await api.post(`/finance/expenses/${id}/approve`, {});
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to approve expense.');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter the reason for rejection:');
    if (!reason) return;
    try {
      await api.post(`/finance/expenses/${id}/reject`, { reason });
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to reject expense.');
    }
  };

  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operational Expenses & Overhead Costing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Factory electricity, freight, machinery maintenance, and packaging supplies with approval control
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Operational Expenses</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            ₹{Number(summary?.totalAllExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">{summary?.totalExpenseCount || 0} Posted Vouchers</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Category Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {summary?.breakdown?.slice(0, 6).map((b: any) => (
              <span key={b.category} className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border rounded-lg text-xs">
                <span className="font-semibold text-gray-800">{b.category}:</span>
                <span className="text-rose-600 font-bold">₹{Number(b.total).toLocaleString()}</span>
                <span className="text-gray-400">({b.percentage}%)</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          <Filter className="w-4 h-4 text-brand-600" /> Filters:
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
        >
          <option value="">All Categories</option>
          <option value="ELECTRICITY">Electricity</option>
          <option value="TRANSPORTATION">Transportation / Freight</option>
          <option value="MAINTENANCE">Maintenance & Repairs</option>
          <option value="LABOUR">Wages / Labour</option>
          <option value="PACKAGING">Packaging Materials</option>
          <option value="WATER">Water</option>
          <option value="RENT">Factory Rent</option>
          <option value="OTHER">Other Operational</option>
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
        >
          <option value="">All Statuses</option>
          <option value="POSTED">POSTED</option>
          <option value="SUBMITTED">SUBMITTED (Pending)</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-4">Expense #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Account & Method</th>
                <th className="py-3 px-4">Status</th>
                {isAdminOrOwner && <th className="py-3 px-4 text-right">Approval Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">Loading expenses...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">No expenses recorded for selected filters.</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold text-gray-900">{e.expenseNumber}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {new Date(e.expenseDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 rounded">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      <div>{e.description}</div>
                      {e.vendor && <div className="text-xs text-gray-400">Vendor: {e.vendor}</div>}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600 whitespace-nowrap">
                      ₹{Number(e.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {Number(e.taxAmount) > 0 && (
                        <span className="block text-[11px] font-normal text-gray-400">
                          (Tax: ₹{Number(e.taxAmount).toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-gray-800">{e.financialAccount?.accountName || 'Cash Register'}</div>
                      <div className="text-gray-400">{e.paymentMethod}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        e.status === 'POSTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : e.status === 'SUBMITTED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    {isAdminOrOwner && (
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {e.status === 'SUBMITTED' && (
                          <>
                            <button
                              onClick={() => handleApprove(e.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(e.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h2 className="text-lg font-bold text-gray-900">Record Operational Expense</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-4 mt-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expense Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="ELECTRICITY">Electricity (TNEB Power)</option>
                    <option value="TRANSPORTATION">Transportation / Freight</option>
                    <option value="MAINTENANCE">Maintenance & Repairs</option>
                    <option value="LABOUR">Wages & Factory Labour</option>
                    <option value="PACKAGING">Packaging & Supplies</option>
                    <option value="WATER">Water Charges</option>
                    <option value="RENT">Factory Rent</option>
                    <option value="OFFICE_SUPPLIES">Office Supplies</option>
                    <option value="OTHER">Other Operational Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor / Payee</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. TNEB Trichy / Murugan Transports"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Factory floor power charges for April 2026"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">GST / Tax Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">UPI Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Paid From Account</label>
                  <select
                    value={financialAccountId}
                    onChange={(e) => setFinancialAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.accountName} (₹{Number(a.currentBalance).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              </div>

              {isAdminOrOwner && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="autoApprove"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded"
                  />
                  <label htmlFor="autoApprove" className="text-xs text-gray-700 font-medium">
                    Approve and post immediately (deducts funds & posts GL entry)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
