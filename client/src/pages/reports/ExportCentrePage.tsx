import React from 'react';
import { Download, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';

export const ExportCentrePage: React.FC = () => {
  const exportItems = [
    {
      title: 'Sales Register',
      desc: 'All outward taxable tax invoices, customers, products, tax breakups',
      csvUrl: '/api/reports/sales-register?format=csv',
      excelUrl: '/api/reports/sales-register?format=excel',
    },
    {
      title: 'Purchase Register',
      desc: 'Inward material procurement, vendor GSTIN, quantities and inward taxes',
      csvUrl: '/api/reports/purchase-register?format=csv',
      excelUrl: '/api/reports/purchase-register?format=csv',
    },
    {
      title: 'Stock Ledger History',
      desc: 'Every inventory addition, production issue, finished goods output and dispatch',
      csvUrl: '/api/inventory/ledger',
      excelUrl: '/api/inventory/ledger',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Audit Export Centre</h1>
        <p className="text-sm text-gray-500">
          Download certified factory registers for statutory audit, GST filing and ERP reconciliations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {exportItems.map((item, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">{item.title}</h2>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <a
                href={item.csvUrl}
                download
                className="flex-1 py-2 px-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-gray-500" /> CSV
              </a>
              <a
                href={item.excelUrl}
                download
                className="flex-1 py-2 px-3 text-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
