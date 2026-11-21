import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Download, FileSpreadsheet, FileText, Archive } from 'lucide-react';

export const PurchaseRegisterPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/purchase-register')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportCSV = () => {
    window.open('/api/reports/purchase-register?format=csv', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Register Report</h1>
          <p className="text-sm text-gray-500">
            Raw material and packaging procurement records with vendor GSTINs and inward tax
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-gray-500" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">PO Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Supplier GSTIN</th>
                <th className="p-3">Material Inwarded</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Unit Purchase Rate</th>
                <th className="p-3">Taxable Value</th>
                <th className="p-3">GST (5%)</th>
                <th className="p-3 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">Loading purchase register...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">No purchases found.</td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{row.purchaseNumber}</td>
                    <td className="p-3 text-gray-500">{row.date}</td>
                    <td className="p-3 font-semibold text-gray-900">{row.supplierName}</td>
                    <td className="p-3">{row.supplierGstin}</td>
                    <td className="p-3 font-medium text-gray-800">{row.itemName}</td>
                    <td className="p-3 font-bold text-gray-900">{row.quantity} {row.unit}</td>
                    <td className="p-3">₹{Number(row.unitPrice).toFixed(2)}</td>
                    <td className="p-3 font-semibold">₹{Number(row.taxableAmount).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-emerald-700">₹{Number(row.gstAmount).toFixed(2)}</td>
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
