import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Printer,
  RefreshCw,
  PieChart,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
} from 'lucide-react';

interface ProfitLossData {
  period: string;
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: number;
  netOperatingProfit: number;
  netProfitMarginPercent: number;
  expenseBreakdown: Record<string, number>;
  revenueAccounts: Array<{ code: string; name: string; balance: number }>;
  expenseAccounts: Array<{ code: string; name: string; balance: number }>;
}

export const ProfitLossPage: React.FC = () => {
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchProfitLoss = () => {
    setLoading(true);
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    api.get('/finance/accounting/profit-loss', { params })
      .then((res: any) => {
        setData(res.data || res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfitLoss();
  }, [startDate, endDate]);

  const exportCSV = () => {
    if (!data) return;
    const lines = [
      'FACTORYFLOW PROFIT & LOSS STATEMENT',
      `Period:,"${data.period}"`,
      '',
      'Particulars,Amount (INR),Percentage of Revenue',
      `Revenue from Operations,${data.totalRevenue},100.00%`,
      `Cost of Goods Sold (COGS),${data.cogs},${data.totalRevenue > 0 ? ((data.cogs / data.totalRevenue) * 100).toFixed(2) : '0'}%`,
      `Gross Profit,${data.grossProfit},${data.grossMarginPercent}%`,
      `Operating Expenses,${data.operatingExpenses},${data.totalRevenue > 0 ? ((data.operatingExpenses / data.totalRevenue) * 100).toFixed(2) : '0'}%`,
      `Net Operating Profit (EBITDA),${data.netOperatingProfit},${data.netProfitMarginPercent}%`,
      '',
      'EXPENSES BREAKDOWN',
      ...Object.entries(data.expenseBreakdown).map(
        ([cat, amt]) => `"${cat}",${amt},${data.totalRevenue > 0 ? ((amt / data.totalRevenue) * 100).toFixed(2) : '0'}%`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Profit_and_Loss_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manufacturing income statement: Net Revenue, direct COGS, Gross Profit, OPEX, and EBITDA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={fetchProfitLoss}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Filter & Period Banner */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Financial Period:</span>
          <span className="px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-sm font-bold">
            {data?.period || 'Financial Year 2026-27'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Sales Revenue</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 font-mono">
            ₹{(data?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> 100% of top-line
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direct COGS</div>
          <div className="mt-2 text-2xl font-bold text-gray-700 font-mono">
            ₹{(data?.cogs || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data?.totalRevenue ? `${((data.cogs / data.totalRevenue) * 100).toFixed(1)}% of revenue` : '0%'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm bg-emerald-50/20">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Gross Profit</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 font-mono">
            ₹{(data?.grossProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-bold text-emerald-700 mt-1">
            Margin: {data?.grossMarginPercent || 0}%
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm bg-rose-50/20">
          <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Operating Expenses</div>
          <div className="mt-2 text-2xl font-bold text-rose-600 font-mono">
            ₹{(data?.operatingExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-rose-700 mt-1">
            {data?.totalRevenue ? `${((data.operatingExpenses / data.totalRevenue) * 100).toFixed(1)}% of revenue` : '0%'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-sm bg-brand-50/20">
          <div className="text-xs font-semibold text-brand-800 uppercase tracking-wider">Net Operating Profit</div>
          <div className={`mt-2 text-2xl font-bold font-mono ${(data?.netOperatingProfit || 0) >= 0 ? 'text-brand-700' : 'text-rose-600'}`}>
            ₹{(data?.netOperatingProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs font-bold text-brand-700 mt-1">
            EBITDA Margin: {data?.netProfitMarginPercent || 0}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main P&L Statement (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-base">Manufacturing Income Statement</h2>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">INR (₹)</span>
          </div>

          <div className="divide-y divide-gray-100 text-sm">
            {/* 1. REVENUE */}
            <div className="p-5">
              <div className="flex items-center justify-between font-bold text-gray-900 text-base mb-3">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-bold">1</span>
                  Revenue from Operations
                </span>
                <span className="font-mono text-emerald-700">
                  ₹{(data?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="space-y-1.5 pl-8 text-xs text-gray-600">
                <div className="flex justify-between py-1">
                  <span>Finished Goods Sales (4010)</span>
                  <span className="font-mono font-medium text-gray-900">
                    ₹{(data?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-400">
                  <span>Less: GST & Deductions (recorded in statutory liability 2020)</span>
                  <span className="font-mono">₹0.00</span>
                </div>
              </div>
            </div>

            {/* 2. COGS */}
            <div className="p-5">
              <div className="flex items-center justify-between font-bold text-gray-900 text-base mb-3">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">2</span>
                  Cost of Goods Sold (COGS)
                </span>
                <span className="font-mono text-rose-600">
                  (₹{(data?.cogs || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                </span>
              </div>
              <div className="space-y-1.5 pl-8 text-xs text-gray-600">
                <div className="flex justify-between py-1">
                  <span>Raw & Packaging Materials Consumed (BOM Actuals)</span>
                  <span className="font-mono font-medium text-gray-900">
                    ₹{(data?.cogs || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-gray-400">
                  <span>Direct Factory Labour & Electricity (Absorbed in runs)</span>
                  <span className="font-mono">Included</span>
                </div>
              </div>
            </div>

            {/* 3. GROSS PROFIT */}
            <div className="p-5 bg-emerald-50/30">
              <div className="flex items-center justify-between font-bold text-base text-gray-900">
                <span className="uppercase tracking-wider text-xs text-emerald-800 font-extrabold">
                  Gross Profit (Revenue - COGS)
                </span>
                <span className="font-mono text-emerald-700 text-lg">
                  ₹{(data?.grossProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-emerald-700 font-medium">
                <span>Gross Margin Percentage</span>
                <span className="font-bold">{data?.grossMarginPercent || 0}%</span>
              </div>
            </div>

            {/* 4. OPERATING EXPENSES */}
            <div className="p-5">
              <div className="flex items-center justify-between font-bold text-gray-900 text-base mb-3">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs flex items-center justify-center font-bold">3</span>
                  Operating Expenses (OPEX)
                </span>
                <span className="font-mono text-rose-600">
                  (₹{(data?.operatingExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                </span>
              </div>
              <div className="space-y-1.5 pl-8 text-xs text-gray-600">
                {Object.entries(data?.expenseBreakdown || {}).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                    <span className="capitalize">{cat.toLowerCase().replace(/_/g, ' ')} Expenses</span>
                    <span className="font-mono font-medium text-gray-900">
                      ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. NET PROFIT */}
            <div className="p-5 bg-brand-50/40">
              <div className="flex items-center justify-between font-bold text-lg text-gray-900">
                <span className="uppercase tracking-wider text-xs text-brand-800 font-extrabold">
                  Net Operating Profit (EBITDA)
                </span>
                <span className={`font-mono text-xl ${(data?.netOperatingProfit || 0) >= 0 ? 'text-brand-800' : 'text-rose-600'}`}>
                  ₹{(data?.netOperatingProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-brand-800 font-medium">
                <span>Net Profit Margin Percentage</span>
                <span className="font-bold">{data?.netProfitMarginPercent || 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operating Expense Distribution Breakdown (1 col) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-gray-900">Operational Cost Structure</h3>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Distribution of fixed and variable operational expenses incurred during manufacturing and distribution.
            </p>

            <div className="space-y-4">
              {Object.entries(data?.expenseBreakdown || {}).map(([cat, amt]) => {
                const total = data?.operatingExpenses || 1;
                const pct = Math.round((amt / total) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-gray-700 capitalize">{cat.toLowerCase().replace(/_/g, ' ')}</span>
                      <span className="font-mono text-gray-900 font-semibold">
                        ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 mt-6">
            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 space-y-1">
              <div className="font-semibold text-gray-800">Accounting Convention:</div>
              <div>• All figures are dynamically computed from double-entry general ledger lines and verified posted vouchers.</div>
              <div>• COGS is reconciled against FIFO batches and actual material issuances.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
