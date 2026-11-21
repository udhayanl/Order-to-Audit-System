import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { ArrowLeft, Download, Printer, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    api.get(`/invoices/${id}`)
      .then(setInvoice)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading invoice preview...</div>;
  if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Tax Invoice {invoice.invoiceNumber}
            </h1>
            <p className="text-xs text-gray-500">Financial Year: {invoice.financialYear}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await api.downloadFile(`/invoices/${invoice.id}/pdf`, `Invoice-${invoice.invoiceNumber}.pdf`);
              } catch (err: any) {
                alert(`PDF download failed: ${err.message}`);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Download Official PDF
          </button>
        </div>
      </div>

      {/* Invoice Document Box */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6 text-xs text-gray-700">
        {/* Factory Header */}
        <div className="text-center border-b border-gray-200 pb-5">
          <h2 className="text-xl font-extrabold text-gray-900">FactoryFlow Foods Pvt. Ltd.</h2>
          <p className="text-gray-500 text-xs mt-1">
            Plot 42, Food Processing Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu – 620015
          </p>
          <div className="text-xs font-semibold text-gray-700 mt-1">
            GSTIN: 33AAAAF1234F1Z5 | State: Tamil Nadu (33) | Email: accounts@factoryflow.in
          </div>
          <div className="mt-3 inline-block px-3 py-1 bg-brand-50 border border-brand-200 text-brand-800 font-bold rounded">
            TAX INVOICE
          </div>
        </div>

        {/* Invoice Meta & Customer Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-4 border-b border-gray-100">
          <div className="space-y-1">
            <div><span className="font-semibold text-gray-500">Invoice Number:</span> <strong className="text-gray-900">{invoice.invoiceNumber}</strong></div>
            <div><span className="font-semibold text-gray-500">Invoice Date:</span> {new Date(invoice.invoiceDate).toLocaleDateString()}</div>
            <div><span className="font-semibold text-gray-500">Due Date:</span> {new Date(invoice.dueDate).toLocaleDateString()}</div>
            <div><span className="font-semibold text-gray-500">Place of Supply:</span> {invoice.placeOfSupply}</div>
            <div><span className="font-semibold text-gray-500">Status:</span> <StatusBadge status={invoice.status} /></div>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-gray-900 text-sm">{invoice.customer?.name}</div>
            <div><span className="font-semibold text-gray-500">GSTIN:</span> {invoice.customer?.gstin || 'Unregistered'}</div>
            <div><span className="font-semibold text-gray-500">Billing:</span> {invoice.billingAddress}</div>
            <div><span className="font-semibold text-gray-500">Shipping:</span> {invoice.shippingAddress}</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Item Description</th>
                <th className="p-3">HSN</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Rate</th>
                <th className="p-3">Taxable</th>
                <th className="p-3">CGST</th>
                <th className="p-3">SGST</th>
                <th className="p-3">IGST</th>
                <th className="p-3 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items?.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-900">{item.description}</td>
                  <td className="p-3 text-gray-500">{item.hsnCode}</td>
                  <td className="p-3 font-bold">{Number(item.quantity)} {item.unit}</td>
                  <td className="p-3">₹{Number(item.unitPrice).toFixed(2)}</td>
                  <td className="p-3">₹{Number(item.taxableAmount).toFixed(2)}</td>
                  <td className="p-3 text-emerald-700">₹{Number(item.cgstAmount).toFixed(2)}</td>
                  <td className="p-3 text-emerald-700">₹{Number(item.sgstAmount).toFixed(2)}</td>
                  <td className="p-3 text-blue-700">₹{Number(item.igstAmount).toFixed(2)}</td>
                  <td className="p-3 text-right font-bold text-gray-900">₹{Number(item.totalAmount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="pt-4 border-t border-gray-100 flex flex-col items-end space-y-1.5">
          <div className="flex justify-between w-72 text-gray-600">
            <span>Total Taxable Value:</span>
            <span className="font-semibold">₹{Number(invoice.totalTaxable).toFixed(2)}</span>
          </div>
          {Number(invoice.cgstAmount) > 0 && (
            <div className="flex justify-between w-72 text-gray-600">
              <span>Central Tax (CGST 2.5%):</span>
              <span className="font-semibold text-emerald-700">₹{Number(invoice.cgstAmount).toFixed(2)}</span>
            </div>
          )}
          {Number(invoice.sgstAmount) > 0 && (
            <div className="flex justify-between w-72 text-gray-600">
              <span>State Tax (SGST 2.5%):</span>
              <span className="font-semibold text-emerald-700">₹{Number(invoice.sgstAmount).toFixed(2)}</span>
            </div>
          )}
          {Number(invoice.igstAmount) > 0 && (
            <div className="flex justify-between w-72 text-gray-600">
              <span>Integrated Tax (IGST 5.0%):</span>
              <span className="font-semibold text-blue-700">₹{Number(invoice.igstAmount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between w-72 text-base font-extrabold text-gray-900 pt-2 border-t border-gray-200">
            <span>Invoice Grand Total:</span>
            <span className="text-brand-600">₹{Number(invoice.grandTotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-72 text-xs pt-1">
            <span className="text-emerald-700 font-semibold">Amount Paid:</span>
            <span className="font-bold text-emerald-700">₹{Number(invoice.paidAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-72 text-xs">
            <span className="text-rose-700 font-semibold">Balance Outstanding:</span>
            <span className="font-bold text-rose-700">₹{Number(invoice.outstandingAmount).toFixed(2)}</span>
          </div>
        </div>

        {/* Declaration & Signatures */}
        <div className="pt-8 border-t border-gray-100 flex justify-between items-end text-[11px] text-gray-500">
          <div className="max-w-xs">
            <p className="font-semibold text-gray-700 mb-1">Declaration:</p>
            <p>
              We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900 mb-8">For FactoryFlow Foods Pvt. Ltd.</p>
            <p className="font-bold text-gray-700 border-t border-gray-300 pt-1">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
