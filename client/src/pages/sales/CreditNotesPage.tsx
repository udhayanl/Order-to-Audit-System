import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { FileText, Clock, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export const CreditNotesPage: React.FC = () => {
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  const fetchCreditNotes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/credit-notes');
      setCreditNotes(Array.isArray(res) ? res : res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load credit notes.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading credit notes register...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Credit Notes Register</h1>
        <p className="text-sm text-gray-500 mt-1">
          Statutory credit notes issued for sales cancellations, price adjustments and verified product returns
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Credit Note #</th>
                <th className="px-4 py-3">Original Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Taxable Reversed</th>
                <th className="px-4 py-3 text-right">GST Reversed</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {creditNotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No credit notes issued
                  </td>
                </tr>
              ) : (
                creditNotes.map((cn) => {
                  const gst =
                    Number(cn.cgstAmount || 0) +
                    Number(cn.sgstAmount || 0) +
                    Number(cn.igstAmount || 0);
                  return (
                    <tr key={cn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-brand-600">{cn.creditNoteNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">
                        {cn.invoice?.invoiceNumber ? (
                          <Link to={`/invoices/${cn.invoiceId}`} className="text-brand-600 hover:underline">
                            {cn.invoice.invoiceNumber}
                          </Link>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{cn.customer?.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(cn.issueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{cn.reason}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        ₹{Number(cn.totalTaxable || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">
                        ₹{gst.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        ₹{Number(cn.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                          {cn.status || 'POSTED'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
