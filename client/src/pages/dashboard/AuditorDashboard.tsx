import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { Shield, FileText, TrendingUp, DollarSign, Download, Archive, CheckCircle2 } from 'lucide-react';

export const AuditorDashboard: React.FC = () => {
  const [gst, setGst] = useState<any>(null);
  const [ageing, setAgeing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/reports/gst-summary'), api.get('/reports/ageing')])
      .then(([gstData, ageingData]) => {
        setGst(gstData);
        setAgeing(ageingData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalOutstanding = ageing.reduce((sum, c) => sum + Number(c.totalOutstanding), 0);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Accountant & Auditor Control Console</h1>
          <p className="text-sm text-gray-500">
            Read-only financial audit, GST statutory compliance (GSTR-1 / 3B) and export center
          </p>
        </div>
        <div className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
          <Shield className="w-4 h-4" /> Read-Only Audit Mode
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Taxable Outward Supplies"
          value={`₹${(gst?.gstr3b?.outwardTaxableSupplies || 0).toLocaleString('en-IN')}`}
          subtitle="GSTR-3B Table 3.1(a)"
          icon={FileText}
          color="purple"
        />
        <MetricCard
          title="Total Tax Liability"
          value={`₹${(gst?.gstr3b?.totalTaxLiability || 0).toLocaleString('en-IN')}`}
          subtitle={`CGST: ₹${gst?.gstr3b?.centralTax || 0} | SGST: ₹${gst?.gstr3b?.stateUtTax || 0}`}
          icon={TrendingUp}
          color="brand"
        />
        <MetricCard
          title="Integrated Tax (IGST)"
          value={`₹${(gst?.gstr3b?.integratedTax || 0).toLocaleString('en-IN')}`}
          subtitle="Inter-state supplies"
          icon={DollarSign}
          color="blue"
        />
        <MetricCard
          title="Total Receivables"
          value={`₹${totalOutstanding.toLocaleString('en-IN')}`}
          subtitle="Across all customer ledgers"
          icon={Archive}
          color="rose"
        />
      </div>

      {/* Statutory GST Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-600" /> GST Compliance Summary (Mapped to GST Portal)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GSTR-1 */}
          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-3">
              GSTR-1: Outward Supplies
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Table 4: B2B Invoices (Taxable)</span>
                <span className="font-bold text-gray-900">₹{(gst?.gstr1?.table4_B2B || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Table 7: B2C Small Supplies</span>
                <span className="font-bold text-gray-900">₹{(gst?.gstr1?.table7_B2C || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Intra-State Supplies (Tamil Nadu)</span>
                <span className="font-bold text-gray-900">₹{(gst?.gstr1?.intraStateSupplies || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Inter-State Supplies (Outside TN)</span>
                <span className="font-bold text-gray-900">₹{(gst?.gstr1?.interStateSupplies || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* GSTR-3B */}
          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-3">
              GSTR-3B: Monthly Tax Liability
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Central Tax (CGST 2.5%)</span>
                <span className="font-bold text-emerald-700">₹{(gst?.gstr3b?.centralTax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">State / UT Tax (SGST 2.5%)</span>
                <span className="font-bold text-emerald-700">₹{(gst?.gstr3b?.stateUtTax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Integrated Tax (IGST 5.0%)</span>
                <span className="font-bold text-blue-700">₹{(gst?.gstr3b?.integratedTax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-gray-900">
                <span>Total Tax Payable</span>
                <span className="text-brand-600">₹{(gst?.gstr3b?.totalTaxLiability || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Report Export Links */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-brand-600" /> Export Statutory Registers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/reports/sales-register"
            className="p-3 rounded-lg border border-gray-200 hover:border-brand-500 hover:bg-brand-50/40 text-xs font-semibold text-gray-800 transition-colors block"
          >
            📊 Sales Register →
          </Link>
          <Link
            to="/reports/purchase-register"
            className="p-3 rounded-lg border border-gray-200 hover:border-brand-500 hover:bg-brand-50/40 text-xs font-semibold text-gray-800 transition-colors block"
          >
            📦 Purchase Register →
          </Link>
          <Link
            to="/inventory/ledger"
            className="p-3 rounded-lg border border-gray-200 hover:border-brand-500 hover:bg-brand-50/40 text-xs font-semibold text-gray-800 transition-colors block"
          >
            📜 Immutable Stock Ledger →
          </Link>
          <Link
            to="/reports/ageing"
            className="p-3 rounded-lg border border-gray-200 hover:border-brand-500 hover:bg-brand-50/40 text-xs font-semibold text-gray-800 transition-colors block"
          >
            ⏳ Outstanding Ageing Buckets →
          </Link>
        </div>
      </div>
    </div>
  );
};
