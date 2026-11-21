import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { TrendingUp, FileText, CheckCircle2 } from 'lucide-react';

export const GstSummaryPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/gst-summary')
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Statutory GST Summary Report</h1>
        <p className="text-sm text-gray-500">
          Reconciliation report mapped to official Goods and Services Tax Portal schemas (GSTR-1 & GSTR-3B)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GSTR-1 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> GSTR-1: Outward Supplies
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
              Taxable Turnover
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Table 4: B2B Invoices (Registered Customers)</span>
              <span className="font-bold text-gray-900 text-sm">
                ₹{(summary?.gstr1?.table4_B2B || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Table 7: B2C Small Supplies (Unregistered)</span>
              <span className="font-bold text-gray-900 text-sm">
                ₹{(summary?.gstr1?.table7_B2C || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Intra-State Supplies (Tamil Nadu State Code 33)</span>
              <span className="font-bold text-emerald-700 text-sm">
                ₹{(summary?.gstr1?.intraStateSupplies || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Inter-State Supplies (Karnataka & other states)</span>
              <span className="font-bold text-blue-700 text-sm">
                ₹{(summary?.gstr1?.interStateSupplies || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* GSTR-3B */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> GSTR-3B: Monthly Tax Liability
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              Net Tax Payable
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">3.1(a) Total Outward Taxable Value</span>
              <span className="font-bold text-gray-900 text-sm">
                ₹{(summary?.gstr3b?.outwardTaxableSupplies || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Central Tax (CGST 2.5%)</span>
              <span className="font-bold text-emerald-700 text-sm">
                ₹{(summary?.gstr3b?.centralTax || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">State / UT Tax (SGST 2.5%)</span>
              <span className="font-bold text-emerald-700 text-sm">
                ₹{(summary?.gstr3b?.stateUtTax || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Integrated Tax (IGST 5.0%)</span>
              <span className="font-bold text-blue-700 text-sm">
                ₹{(summary?.gstr3b?.integratedTax || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2 font-bold text-gray-900 text-sm pt-2">
              <span>Total Statutory Tax Liability</span>
              <span className="text-brand-600">
                ₹{(summary?.gstr3b?.totalTaxLiability || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
