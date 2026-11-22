import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  DollarSign,
  PlusCircle,
  Truck,
  RotateCcw,
  FileText,
  X,
  AlertTriangle,
} from 'lucide-react';

export const SupplierPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [amount, setAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [financialAccountId, setFinancialAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Allocations
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Voucher modal state
  const [voucherData, setVoucherData] = useState<any | null>(null);

  // Reversal modal state
  const [reversePaymentId, setReversePaymentId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/finance/supplier-payments'),
      api.get('/master/suppliers'),
      api.get('/purchases'),
      api.get('/finance/accounts'),
    ])
      .then(([pmts, sups, purs, accs]) => {
        setPayments(pmts || []);
        setSuppliers(sups || []);
        setPurchases(purs || []);
        setAccounts(accs || []);
        if (sups && sups.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(sups[0].id);
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

  const pendingPurchases = purchases.filter(
    (p) => p.supplierId === selectedSupplierId && (p.outstandingAmount === null || Number(p.outstandingAmount) > 0)
  );

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFormError(null);

    const allocList = Object.entries(allocations)
      .filter(([_, amt]) => amt > 0)
      .map(([purchaseId, amt]) => ({ purchaseId, amount: Number(amt) }));

    try {
      await api.post('/finance/supplier-payments', {
        supplierId: selectedSupplierId,
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
      setFormError(err.message || 'Failed to record supplier payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversePaymentId) return;
    setActionLoading(true);
    try {
      await api.post(`/finance/supplier-payments/${reversePaymentId}/reverse`, {
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

  const handleViewVoucher = async (id: string) => {
    try {
      const res = await api.get(`/finance/supplier-payments/${id}/voucher`);
      setVoucherData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch voucher.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Payments & Disbursements</h1>
          <p className="text-sm text-gray-500 mt-1">
            Accounts payable disbursements to raw material and packaging vendors with voucher generation
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Disburse Supplier Payment
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-4">Voucher / Payment #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method & Account</th>
                <th className="py-3 px-4">Allocated Purchases</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">Loading supplier disbursements...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">No supplier payments recorded yet.</td>
                </tr>
              ) : (
                payments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{pmt.voucherNumber || pmt.paymentNumber}</div>
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
                      {pmt.supplier?.name}
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
                              <span className="font-semibold text-gray-800">{a.purchaseNumber}:</span>{' '}
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
                        onClick={() => handleViewVoucher(pmt.id)}
                        className="p-1 text-gray-500 hover:text-brand-600 rounded hover:bg-gray-100"
                        title="View Payment Voucher"
                      >
                        <FileText className="w-4 h-4 inline" />
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
              <h2 className="text-lg font-bold text-gray-900">Disburse Supplier Payment</h2>
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

              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier / Vendor</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    setAllocations({});
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.city || s.state})</option>
                  ))}
                </select>
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Disbursement Amount (₹)</label>
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
                    <option value="BANK_TRANSFER">Bank Transfer (RTGS / NEFT / IMPS)</option>
                    <option value="UPI">UPI Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Disburse From Financial Account</label>
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

              {/* Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Bank UTR / Cheque #</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UTR-SBI-5544"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Disbursement remarks"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Allocations */}
              <div className="pt-2 border-t">
                <div className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                  Purchase Invoice Allocations (Optional)
                </div>
                {pendingPurchases.length === 0 ? (
                  <div className="p-3 bg-gray-50 text-gray-500 text-xs rounded-lg">
                    No outstanding purchase invoices found for this vendor. Entire payment will be recorded as advance.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingPurchases.map((pur) => {
                      const grandTotal = Number(pur.grandTotal);
                      const paid = Number(pur.paidAmount || 0);
                      const outstanding = pur.outstandingAmount !== null ? Number(pur.outstandingAmount) : Math.max(0, grandTotal - paid);

                      return (
                        <div key={pur.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border text-xs">
                          <div>
                            <div className="font-semibold text-gray-900">{pur.purchaseNumber}</div>
                            <div className="text-gray-500">
                              Total: ₹{grandTotal.toLocaleString()} | Outstanding: ₹{outstanding.toLocaleString()}
                            </div>
                          </div>
                          <div className="w-32">
                            <input
                              type="number"
                              min="0"
                              max={outstanding}
                              step="0.01"
                              placeholder="₹ Alloc"
                              value={allocations[pur.id] || ''}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setAllocations({ ...allocations, [pur.id]: val });
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right font-medium"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
                  {actionLoading ? 'Disbursing...' : 'Disburse Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {voucherData && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2 text-brand-700 font-bold">
                <FileText className="w-5 h-5" />
                Payment Voucher
              </div>
              <button onClick={() => setVoucherData(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="flex justify-between border-b pb-3">
                <div>
                  <div className="text-gray-400">Voucher No:</div>
                  <div className="font-bold text-gray-900 text-sm">{voucherData.voucherNumber || voucherData.paymentNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400">Date:</div>
                  <div className="font-semibold text-gray-800">{new Date(voucherData.date).toLocaleDateString()}</div>
                </div>
              </div>

              <div>
                <span className="text-gray-400">Paid To:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{voucherData.supplier?.name}</div>
                <div className="text-gray-500">GSTIN: {voucherData.supplier?.gstin || 'Unregistered'}</div>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex justify-between items-center">
                <span className="font-semibold text-amber-900">Total Disbursement Amount:</span>
                <span className="text-base font-bold text-amber-800">₹{Number(voucherData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Payment Mode:</span>
                  <div className="font-medium text-gray-800">{voucherData.paymentMethod}</div>
                </div>
                <div>
                  <span className="text-gray-400">UTR / Ref #:</span>
                  <div className="font-medium text-gray-800">{voucherData.referenceNumber || 'N/A'}</div>
                </div>
              </div>

              {voucherData.allocations && voucherData.allocations.length > 0 && (
                <div className="border-t pt-2">
                  <div className="font-semibold text-gray-700 mb-1">Purchase Invoice Allocations:</div>
                  <div className="space-y-1">
                    {voucherData.allocations.map((a: any) => (
                      <div key={a.id} className="flex justify-between py-1 border-b border-gray-100">
                        <span>{a.purchaseNumber}</span>
                        <span className="font-semibold">₹{Number(a.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t flex justify-end">
                <button
                  onClick={() => setVoucherData(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
                >
                  Close Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {reversePaymentId && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              Reverse Supplier Payment
            </h3>
            <p className="text-xs text-gray-600 mt-2">
              Reversing this payment will restore supplier purchase invoice balances, restore the deducted funds back to the financial account, and post reversing entries in the General Ledger.
            </p>
            <form onSubmit={handleReverse} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Reversal *</label>
                <input
                  type="text"
                  required
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Duplicate bank transfer reversed"
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
    </div>
  );
};
