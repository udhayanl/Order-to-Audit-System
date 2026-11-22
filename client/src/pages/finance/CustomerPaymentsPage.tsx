import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  DollarSign,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Receipt,
  Eye,
  X,
  FileCheck,
} from 'lucide-react';

export const CustomerPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Record payment form state
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState<number>(3000);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [financialAccountId, setFinancialAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selected invoice allocations
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Receipt modal state
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // Reversal modal state
  const [reversePaymentId, setReversePaymentId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/finance/customer-payments'),
      api.get('/master/customers'),
      api.get('/invoices'),
      api.get('/finance/accounts'),
    ])
      .then(([pmts, custs, invs, accs]) => {
        setPayments(pmts || []);
        setCustomers(custs || []);
        setInvoices(invs || []);
        setAccounts(accs || []);
        if (custs && custs.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(custs[0].id);
        }
        if (accs && accs.length > 0 && !financialAccountId) {
          setFinancialAccountId(accs[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingInvoices = invoices.filter(
    (inv) => inv.customerId === selectedCustomerId && Number(inv.outstandingAmount) > 0
  );

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFormError(null);

    const allocList = Object.entries(allocations)
      .filter(([_, amt]) => amt > 0)
      .map(([invoiceId, amt]) => ({ invoiceId, amount: Number(amt) }));

    try {
      await api.post('/finance/customer-payments', {
        customerId: selectedCustomerId,
        amount: Number(amount),
        paymentMethod,
        financialAccountId: financialAccountId || undefined,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        allocations: allocList.length > 0 ? allocList : undefined,
      });

      setShowModal(false);
      setAllocations({});
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record customer payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversePaymentId) return;
    setActionLoading(true);
    try {
      await api.post(`/finance/customer-payments/${reversePaymentId}/reverse`, {
        reason: reversalReason,
      });
      setReversePaymentId(null);
      setReversalReason('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reverse payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewReceipt = async (id: string) => {
    try {
      const res = await api.get(`/finance/customer-payments/${id}/receipt`);
      setReceiptData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch receipt.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Payments & Receipts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Collections from retailers and distributors with multi-invoice allocation and auto-GL posting
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Record Customer Payment
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-4">Receipt / Payment #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method & Account</th>
                <th className="py-3 px-4">Allocated Invoices</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">Loading customer payments...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">No customer payments recorded yet.</td>
                </tr>
              ) : (
                payments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{pmt.receiptNumber || pmt.paymentNumber}</div>
                      <div className="text-xs text-gray-400">{pmt.paymentNumber}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {new Date(pmt.paymentDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {pmt.customer?.name}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900">
                      ₹{Number(pmt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {Number(pmt.advanceAmount) > 0 && (
                        <span className="block text-[11px] font-normal text-emerald-600">
                          Adv: ₹{Number(pmt.advanceAmount).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {pmt.paymentMethod}
                      </span>
                      {pmt.financialAccount && (
                        <div className="text-xs text-gray-500 mt-0.5">{pmt.financialAccount.accountName}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {pmt.allocations && pmt.allocations.length > 0 ? (
                        <div className="space-y-1">
                          {pmt.allocations.map((a: any) => (
                            <div key={a.id} className="text-xs">
                              <span className="font-semibold text-gray-800">{a.invoiceNumber}:</span>{' '}
                              ₹{Number(a.allocatedAmount).toLocaleString('en-IN')}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Unallocated Advance</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        pmt.status === 'POSTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pmt.status === 'REVERSED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {pmt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleViewReceipt(pmt.id)}
                        className="p-1 text-gray-500 hover:text-brand-600 rounded hover:bg-gray-100"
                        title="View Official Receipt"
                      >
                        <Receipt className="w-4 h-4 inline" />
                      </button>
                      {pmt.status === 'POSTED' && (
                        <button
                          onClick={() => setReversePaymentId(pmt.id)}
                          className="p-1 text-gray-500 hover:text-rose-600 rounded hover:bg-gray-100"
                          title="Reverse Payment"
                        >
                          <RotateCcw className="w-4 h-4 inline" />
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

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Record Customer Payment</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 mt-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {formError}
                </div>
              )}

              {/* Customer Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setAllocations({});
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Financial Account */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deposit To Financial Account</label>
                <select
                  value={financialAccountId}
                  onChange={(e) => setFinancialAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName} (Balance: ₹{Number(a.currentBalance).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              {/* Reference & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">UTR / Cheque / Ref #</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UTR-99882244"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional remarks"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Invoice Allocation Section */}
              <div className="pt-2 border-t">
                <div className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                  Invoice Allocation (Optional – Unallocated balance becomes customer advance)
                </div>
                {pendingInvoices.length === 0 ? (
                  <div className="p-3 bg-gray-50 text-gray-500 text-xs rounded-lg">
                    No outstanding invoices found for this customer. Entire payment will be recorded as advance.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border text-xs">
                        <div>
                          <div className="font-semibold text-gray-900">{inv.invoiceNumber}</div>
                          <div className="text-gray-500">
                            Total: ₹{Number(inv.grandTotal).toLocaleString()} | Outstanding: ₹{Number(inv.outstandingAmount).toLocaleString()}
                          </div>
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            min="0"
                            max={Number(inv.outstandingAmount)}
                            step="0.01"
                            placeholder="₹ Alloc"
                            value={allocations[inv.id] || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAllocations({ ...allocations, [inv.id]: val });
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-right font-medium"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
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
                  {actionLoading ? 'Recording...' : 'Post Customer Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {reversePaymentId && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              Reverse Customer Payment
            </h3>
            <p className="text-xs text-gray-600 mt-2">
              Reversing this payment will restore customer invoice balances, deduct the deposited funds from the financial account, and post reversing journal entries in the General Ledger.
            </p>
            <form onSubmit={handleReverse} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Reversal *</label>
                <input
                  type="text"
                  required
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Cheque returned unpaid / transaction duplicate"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReversePaymentId(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || reversalReason.trim().length < 5}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2 text-brand-700 font-bold">
                <Receipt className="w-5 h-5" />
                Official Payment Receipt
              </div>
              <button onClick={() => setReceiptData(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="flex justify-between border-b pb-3">
                <div>
                  <div className="text-gray-400">Receipt No:</div>
                  <div className="font-bold text-gray-900 text-sm">{receiptData.receiptNumber || receiptData.paymentNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400">Date:</div>
                  <div className="font-semibold text-gray-800">{new Date(receiptData.date).toLocaleDateString()}</div>
                </div>
              </div>

              <div>
                <span className="text-gray-400">Received From:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{receiptData.customer?.name}</div>
                <div className="text-gray-500">GSTIN: {receiptData.customer?.gstin || 'Unregistered'}</div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
                <span className="font-semibold text-emerald-900">Total Amount Received:</span>
                <span className="text-base font-bold text-emerald-800">₹{Number(receiptData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Payment Mode:</span>
                  <div className="font-medium text-gray-800">{receiptData.paymentMethod}</div>
                </div>
                <div>
                  <span className="text-gray-400">Reference / UTR:</span>
                  <div className="font-medium text-gray-800">{receiptData.referenceNumber || 'N/A'}</div>
                </div>
              </div>

              {receiptData.allocations && receiptData.allocations.length > 0 && (
                <div className="border-t pt-2">
                  <div className="font-semibold text-gray-700 mb-1">Invoice Allocations:</div>
                  <div className="space-y-1">
                    {receiptData.allocations.map((a: any) => (
                      <div key={a.id} className="flex justify-between py-1 border-b border-gray-100">
                        <span>{a.invoiceNumber}</span>
                        <span className="font-semibold">₹{Number(a.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t flex justify-end">
                <button
                  onClick={() => setReceiptData(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
