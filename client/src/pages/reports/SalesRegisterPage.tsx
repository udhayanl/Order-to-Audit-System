import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react';

export const SalesRegisterPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/sales-register')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportCSV = () => {
    window.open('/api/reports/sales-register?format=csv', '_blank');
  };

  const handleExportExcel = () => {
    window.open('/api/reports/sales-register?format=excel', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales Register Report</h1>
          <p className="text-sm text-gray-500">
            Comprehensive audit book of outward taxable supplies with GST breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-gray-500" /> Export CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Invoice No</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Product Description</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Taxable Value</th>
                <th className="p-3">CGST</th>
                <th className="p-3">SGST</th>
                <th className="p-3">IGST</th>
                <th className="p-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">Generating sales register...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">No posted sales found.</td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{row.invoiceNumber}</td>
                    <td className="p-3 text-gray-500">{row.date}</td>
                    <td className="p-3 font-semibold text-gray-900">{row.customerName}</td>
                    <td className="p-3">{row.customerGstin}</td>
                    <td className="p-3 font-medium text-gray-800">{row.productName}</td>
                    <td className="p-3 font-bold">{row.quantity} {row.unit}</td>
                    <td className="p-3 font-semibold text-gray-900">₹{Number(row.taxableAmount).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-emerald-700">₹{Number(row.cgstAmount).toFixed(2)}</td>
                    <td className="p-3 text-emerald-700">₹{Number(row.sgstAmount).toFixed(2)}</td>
                    <td className="p-3 text-blue-700">₹{Number(row.igstAmount).toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-gray-900">₹{Number(row.totalAmount).toLocaleString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
