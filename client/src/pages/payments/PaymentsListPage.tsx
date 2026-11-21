import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { DollarSign, PlusCircle, Search, CheckCircle2 } from 'lucide-react';

export const PaymentsListPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [amount, setAmount] = useState(4000);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('NEFT-SBI-99228811');
  const [notes, setNotes] = useState('Part-payment against invoice');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/payments'),
      api.get('/master/customers'),
      api.get('/invoices'),
    ])
      .then(([pmts, custs, invs]) => {
        setPayments(pmts);
        setCustomers(custs);
        setInvoices(invs);
        if (custs.length > 0) setSelectedCustomer(custs[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const customerInvoices = invoices.filter(
    (inv) => inv.customerId === selectedCustomer && Number(inv.outstandingAmount) > 0
  );

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      await api.post('/payments', {
        customerId: selectedCustomer,
        invoiceId: selectedInvoice || undefined,
        amount: Number(amount),
        paymentMethod,
        referenceNumber,
        notes,
      });
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Payment recording failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Payments & Collections</h1>
          <p className="text-sm text-gray-500">
            Record payments, partial settlement allocation and live outstanding tracking
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> Record Customer Payment
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Payment No</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Amount Received</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Reference / UTR</th>
                <th className="p-3">Allocated Invoice</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading payments...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No payments recorded yet.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{p.paymentNumber}</td>
                    <td className="p-3 text-gray-500">{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="p-3 font-semibold text-gray-900">{p.customer?.name}</td>
                    <td className="p-3 font-bold text-emerald-700 text-sm">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-medium text-gray-700">{p.paymentMethod}</td>
                    <td className="p-3 text-gray-500">{p.referenceNumber || '—'}</td>
                    <td className="p-3">
                      {p.allocations?.map((a: any) => a.invoice?.invoiceNumber).join(', ') || 'On Account'}
                    </td>
                    <td className="p-3 text-gray-500">{p.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRecordPayment} className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Record Customer Payment</h3>
            {error && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Link to Invoice (Optional)</label>
              <select
                value={selectedInvoice}
                onChange={(e) => setSelectedInvoice(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
              >
                <option value="">-- On Account / Unallocated --</option>
                {customerInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} (Outstanding: ₹{Number(inv.outstandingAmount).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
              >
                <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reference / UTR Number</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow disabled:opacity-50"
              >
                Save Payment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
