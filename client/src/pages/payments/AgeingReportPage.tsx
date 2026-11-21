import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { DollarSign, Clock } from 'lucide-react';

export const AgeingReportPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/ageing')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalAll = data.reduce((sum, c) => sum + c.totalOutstanding, 0);
  const total0_30 = data.reduce((sum, c) => sum + c.bucket0_30, 0);
  const total31_60 = data.reduce((sum, c) => sum + c.bucket31_60, 0);
  const total61_90 = data.reduce((sum, c) => sum + c.bucket61_90, 0);
  const totalAbove90 = data.reduce((sum, c) => sum + c.bucketAbove90, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Outstanding Receivables Ageing Report</h1>
        <p className="text-sm text-gray-500">
          Customer receivables segmented into statutory ageing buckets (0–30, 31–60, 61–90 and &gt;90 days)
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Customer Name</th>
                <th className="p-3">State</th>
                <th className="p-3">Total Outstanding</th>
                <th className="p-3 text-emerald-700">0–30 Days (Current)</th>
                <th className="p-3 text-blue-700">31–60 Days</th>
                <th className="p-3 text-amber-700">61–90 Days</th>
                <th className="p-3 text-rose-700">Above 90 Days (Overdue)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">Loading ageing report...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No outstanding receivables found.</td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.customerId} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{row.customerName}</td>
                    <td className="p-3">{row.state}</td>
                    <td className="p-3 font-extrabold text-gray-900 text-sm">
                      ₹{row.totalOutstanding.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-semibold text-emerald-700">
                      ₹{row.bucket0_30.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-semibold text-blue-700">
                      ₹{row.bucket31_60.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-semibold text-amber-700">
                      ₹{row.bucket61_90.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-bold text-rose-700">
                      ₹{row.bucketAbove90.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-gray-100 font-bold text-gray-900 border-t border-gray-200">
                <tr>
                  <td className="p-3" colSpan={2}>Grand Total</td>
                  <td className="p-3 font-extrabold text-sm">₹{totalAll.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-emerald-800">₹{total0_30.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-blue-800">₹{total31_60.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-amber-800">₹{total61_90.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-rose-800">₹{totalAbove90.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
