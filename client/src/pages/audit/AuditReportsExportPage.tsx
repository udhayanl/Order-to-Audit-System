import React, { useState } from 'react';
import api from '../../api/client.js';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  Boxes,
  Factory,
  DollarSign,
  ShieldCheck,
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface ReportCardConfig {
  type: 'inventory' | 'production' | 'sales_financial' | 'compliance' | 'user_activity';
  title: string;
  badge: string;
  badgeColor: string;
  icon: any;
  iconColor: string;
  description: string;
  statutoryBasis: string;
  sampleColumns: string[];
}

const REPORT_CONFIGS: ReportCardConfig[] = [
  {
    type: 'inventory',
    title: 'Inventory Stock Audit Report',
    badge: 'Statutory Physical Stock Count',
    badgeColor: 'bg-amber-100 text-amber-800',
    icon: Boxes,
    iconColor: 'text-amber-600',
    description:
      'Reconciliation of raw materials, packaging supplies, and finished goods comparing physical physical count with system ledger balances, highlighting variance quantity and valuation (₹).',
    statutoryBasis: 'ICAI CARO 2020 Clause (ii) & Companies Act physical inventory verification standard',
    sampleColumns: ['Item Code', 'Item Name', 'Category', 'System Stock', 'Physical Stock', 'Variance Qty', 'Unit Cost (₹)', 'Variance Value (₹)', 'Discrepancy Status'],
  },
  {
    type: 'production',
    title: 'Manufacturing Yield & Scrap Audit Report',
    badge: 'Standard Costing & Yield Variance',
    badgeColor: 'bg-indigo-100 text-indigo-800',
    icon: Factory,
    iconColor: 'text-indigo-600',
    description:
      'Batch-by-batch production audit tracking planned vs actual output, raw material BOM consumption variances, damaged pouch rates, scrap percentage, and total scrap cost.',
    statutoryBasis: 'Cost Accounting Standard CAS-4 & CAS-6 for Manufacturing & Scrap Valuation',
    sampleColumns: ['Run Number', 'Product', 'Planned Qty', 'Actual Good (Pkts)', 'Damaged Pouches', 'Scrap %', 'Scrap Cost (₹)', 'RM Variance %', 'Yield Status'],
  },
  {
    type: 'sales_financial',
    title: 'Sales & Financial Audit Report',
    badge: 'GST & Financial Equilibrium',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    icon: DollarSign,
    iconColor: 'text-emerald-600',
    description:
      'Comprehensive review of GST sales invoices, taxable turnover, CGST/SGST/IGST breakdown, customer payment receipts, operational expenses, and general ledger journal equilibrium.',
    statutoryBasis: 'Section 35(5) of CGST Act 2017 & Indian Accounting Standard (Ind AS) General Ledger Reconciliation',
    sampleColumns: ['Metric / Account', 'Total Invoices', 'Taxable Revenue (₹)', 'GST Collected (₹)', 'Customer Collections (₹)', 'Operating Expenses (₹)', 'Debits vs Credits Balance'],
  },
  {
    type: 'compliance',
    title: 'FSSAI Food Safety & Quality Compliance Report',
    badge: 'FSSAI Statutory Quality Audit',
    badgeColor: 'bg-rose-100 text-rose-800',
    icon: ShieldCheck,
    iconColor: 'text-rose-600',
    description:
      'Log of food safety inspections covering deep frying oil TPM (<= 25%), frying core temperature, finished moisture levels, pest control, allergen controls, and batch shelf-life audits.',
    statutoryBasis: 'Food Safety and Standards (Licensing and Registration of Food Businesses) Regulations, 2011',
    sampleColumns: ['Inspection #', 'Date', 'Category', 'Standard Specification', 'Observed Value', 'Compliance Result', 'Inspector', 'CAPA Resolution'],
  },
  {
    type: 'user_activity',
    title: 'User Activity & Security Audit Trail Report',
    badge: 'Tamper-Evident Access Log',
    badgeColor: 'bg-blue-100 text-blue-800',
    icon: Activity,
    iconColor: 'text-blue-600',
    description:
      'Full chronological record of user sessions, authentication events, record creations, updates, master data modifications, journal entries, and document approvals.',
    statutoryBasis: 'Companies (Accounts) Rules, 2014 Rule 3(1) - Mandatory Audit Trail & Edit Logs in Accounting Software',
    sampleColumns: ['Timestamp', 'Username', 'User Role', 'Action Type', 'Entity / Module', 'Record Identifier', 'IP Address / User Agent', 'Action Details'],
  },
];

export const AuditReportsExportPage: React.FC = () => {
  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Download states
  const [downloading, setDownloading] = useState<string | null>(null);

  // Preview modal states
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    title: string;
    type: string;
    loading: boolean;
    data: any;
    error: string;
  }>({
    open: false,
    title: '',
    type: '',
    loading: false,
    data: null,
    error: '',
  });

  // Apply Quick Date Presets
  const applyPreset = (preset: 'this_month' | 'last_30' | 'fy' | 'all') => {
    const today = new Date();
    if (preset === 'this_month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'last_30') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'fy') {
      // Current FY (1st April)
      const yr = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setStartDate(`${yr}-04-01`);
      setEndDate(today.toISOString().split('T')[0]);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Trigger File Download (PDF or Excel)
  const handleDownload = async (type: string, format: 'pdf' | 'excel') => {
    const key = `${type}_${format}`;
    setDownloading(key);
    try {
      const search = new URLSearchParams();
      search.append('format', format);
      if (startDate) search.append('startDate', startDate);
      if (endDate) search.append('endDate', endDate);

      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const filename = `${type}_audit_report_${new Date().toISOString().split('T')[0]}.${extension}`;
      await api.downloadFile(`/audit/reports/${type}/export?${search.toString()}`, filename);
    } catch (err: any) {
      console.error('Export download failed:', err);
      alert('Failed to generate export file. Please check server logs or date parameters.');
    } finally {
      setDownloading(null);
    }
  };

  // Open Live Preview
  const handlePreview = async (report: ReportCardConfig) => {
    setPreviewModal({
      open: true,
      title: report.title,
      type: report.type,
      loading: true,
      data: null,
      error: '',
    });

    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res: any = await api.get(`/audit/reports/${report.type}`, { params });
      setPreviewModal((prev) => ({
        ...prev,
        loading: false,
        data: res.data || res,
      }));
    } catch (err: any) {
      console.error('Preview load failed:', err);
      setPreviewModal((prev) => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.error || 'Failed to fetch report preview data.',
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-brand-600" />
          Statutory Audit Reports & Export Centre
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate, preview, and download formal compliance audit packages in PDF and Excel formats with official digital sign-off
        </p>
      </div>

      {/* Global Date Range & Filter Bar */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Audit Period:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              title="Start Date"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              title="End Date"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium"
            >
              Clear Dates
            </button>
          )}
        </div>

        {/* Preset Chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Quick Ranges:</span>
          <button
            onClick={() => applyPreset('this_month')}
            className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            This Month
          </button>
          <button
            onClick={() => applyPreset('last_30')}
            className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => applyPreset('fy')}
            className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Current FY
          </button>
          <button
            onClick={() => applyPreset('all')}
            className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            All Time
          </button>
        </div>
      </div>

      {/* 5 Statutory Report Cards */}
      <div className="space-y-4">
        {REPORT_CONFIGS.map((report) => {
          const Icon = report.icon;
          const isPdfDownloading = downloading === `${report.type}_pdf`;
          const isExcelDownloading = downloading === `${report.type}_excel`;

          return (
            <div
              key={report.type}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-brand-300 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left Description */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                      <Icon className={`w-6 h-6 ${report.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{report.title}</h3>
                      <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full mt-0.5 ${report.badgeColor}`}>
                        {report.badge}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed pt-1">
                    {report.description}
                  </p>

                  <div className="text-xs text-gray-400 font-medium pt-1">
                    <span className="font-semibold text-gray-500">Statutory Standard:</span> {report.statutoryBasis}
                  </div>

                  {/* Sample Schema preview tags */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {report.sampleColumns.map((col, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-mono"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-row lg:flex-col sm:flex-row gap-2 lg:min-w-[190px] justify-end">
                  <button
                    onClick={() => handlePreview(report)}
                    className="flex-1 lg:w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-500" />
                    Preview Data
                  </button>

                  <button
                    onClick={() => handleDownload(report.type, 'pdf')}
                    disabled={isPdfDownloading}
                    className="flex-1 lg:w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isPdfDownloading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Download PDF
                  </button>

                  <button
                    onClick={() => handleDownload(report.type, 'excel')}
                    disabled={isExcelDownloading}
                    className="flex-1 lg:w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isExcelDownloading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    )}
                    Download Excel
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================
          PREVIEW MODAL / DRAWER
         ======================================================== */}
      {previewModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  Live Preview: {previewModal.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Real-time PostgreSQL aggregated metrics for the selected audit scope
                </p>
              </div>
              <button
                onClick={() => setPreviewModal({ ...previewModal, open: false })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {previewModal.loading ? (
                <div className="py-16 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                  Generating live audit dataset...
                </div>
              ) : previewModal.error ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
                  {previewModal.error}
                </div>
              ) : previewModal.data ? (
                <div className="space-y-4">
                  {/* Summary Header */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Audit Metadata</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 text-xs">
                      <div>
                        <span className="text-gray-500">Report Scope:</span>{' '}
                        <span className="font-semibold text-gray-900">{previewModal.data.title || previewModal.title}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Generated At:</span>{' '}
                        <span className="font-semibold text-gray-900">
                          {new Date(previewModal.data.generatedAt || Date.now()).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Start Date:</span>{' '}
                        <span className="font-semibold text-gray-900">{previewModal.data.period?.startDate || 'All Time'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">End Date:</span>{' '}
                        <span className="font-semibold text-gray-900">{previewModal.data.period?.endDate || 'Latest'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Structured Summary KPIs */}
                  {previewModal.data.summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(previewModal.data.summary).map(([key, val]: [string, any]) => (
                        <div key={key} className="p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="text-[11px] font-semibold text-gray-500 uppercase truncate">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div className="text-lg font-bold text-brand-600 mt-1">
                            {typeof val === 'number'
                              ? val.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                              : String(val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* JSON data drawer */}
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">
                      Raw Record Stream Preview
                    </div>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono max-h-60 overflow-y-auto">
                      <pre>{JSON.stringify(previewModal.data.items || previewModal.data.records || previewModal.data, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <span className="text-xs text-gray-500">
                Official signature seal included on exported PDF & Excel workbooks
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewModal.type, 'pdf')}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => handleDownload(previewModal.type, 'excel')}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditReportsExportPage;
