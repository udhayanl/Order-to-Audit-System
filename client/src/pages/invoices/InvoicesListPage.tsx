import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { FileText, Download, Eye, Ban, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const InvoicesListPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();

  const fetchInvoices = () => {
    setLoading(true);
    api.get('/invoices')
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDownloadPDF = (id: string, invoiceNumber: string) => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  const handleCancelInvoice = async () => {
    if (!cancelModal) return;
    setActionLoading(true);
    try {
      await api.post(`/invoices/${cancelModal.id}/cancel`, { reason: cancelReason });
      setCancelModal(null);
      setCancelReason('');
      fetchInvoices();
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">GST Tax Invoices</h1>
          <p className="text-sm text-gray-500">
            Immutable tax invoices with statutory CGST, SGST & IGST breakdown and PDFKit downloads
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Invoice No</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Taxable Value</th>
                <th className="p-3">CGST</th>
                <th className="p-3">SGST</th>
                <th className="p-3">IGST</th>
                <th className="p-3">Grand Total</th>
                <th className="p-3">Paid / Outstanding</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">Loading invoices...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">No invoices generated yet.</td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{inv.invoiceNumber}</td>
                    <td className="p-3 text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">{inv.customer?.name}</div>
                      <div className="text-[11px] text-gray-400">{inv.placeOfSupply}</div>
                    </td>
                    <td className="p-3 font-medium text-gray-900">₹{Number(inv.totalTaxable).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-emerald-700">₹{Number(inv.cgstAmount).toFixed(2)}</td>
                    <td className="p-3 text-emerald-700">₹{Number(inv.sgstAmount).toFixed(2)}</td>
                    <td className="p-3 text-blue-700">₹{Number(inv.igstAmount).toFixed(2)}</td>
                    <td className="p-3 font-bold text-gray-900">₹{Number(inv.grandTotal).toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <div className="text-emerald-700 font-semibold">Paid: ₹{Number(inv.paidAmount).toLocaleString('en-IN')}</div>
                      <div className="text-rose-700 font-bold">Due: ₹{Number(inv.outstandingAmount).toLocaleString('en-IN')}</div>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="p-1 text-gray-600 hover:text-brand-600"
                          title="View Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDownloadPDF(inv.id, inv.invoiceNumber)}
                          className="p-1 text-gray-600 hover:text-indigo-600"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {user?.role === 'ADMIN' && inv.status === 'POSTED' && Number(inv.paidAmount) === 0 && (
                          <button
                            onClick={() => setCancelModal(inv)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Cancel Invoice (Credit Note)"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Note Cancellation Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Cancel Invoice with Credit Note</h3>
            <p className="text-xs text-gray-500">
              Per statutory rules, posted invoices cannot be silently deleted. A reverse Credit Note will be generated.
            </p>
            <textarea
              required
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (e.g. wrong quantity billed)..."
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCancelInvoice}
                disabled={actionLoading || !cancelReason.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded shadow disabled:opacity-50"
              >
                Issue Credit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
