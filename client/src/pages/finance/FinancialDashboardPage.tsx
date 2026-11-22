import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Building,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  FileText,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

export const FinancialDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = () => {
    setLoading(true);
    api.get('/finance/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
          Loading Financial Metrics...
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const alerts = data?.alerts || [];
  const cashflow = data?.cashflowSeries || [];
  const recent = data?.recentTransactions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Executive cash, bank, receivables, payables and operational margins
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Financial Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-4 rounded-xl border ${
                alert.severity === 'HIGH'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <span className="font-semibold">{alert.title}: </span>
                {alert.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash in Hand */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash on Hand</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ₹{Number(kpis.cashBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Floor register balance</div>
        </div>

        {/* Operating Bank Balance */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Operating Bank</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ₹{Number(kpis.bankBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">SBI Current A/c</div>
        </div>

        {/* Total Accounts Receivable */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Accounts Receivable</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            ₹{Number(kpis.totalReceivables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-rose-600 mt-1">
            Overdue: ₹{Number(kpis.overdueReceivables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Total Accounts Payable */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Accounts Payable</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            ₹{Number(kpis.totalPayables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Pending to suppliers</div>
        </div>
      </div>

      {/* Secondary Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today's Collections</div>
          <div className="text-xl font-bold text-emerald-600 mt-2">
            ₹{Number(kpis.todaysCollections || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Collected from customers today</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Month-to-Date Revenue</div>
          <div className="text-xl font-bold text-brand-600 mt-2">
            ₹{Number(kpis.monthlyRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Net taxable sales billing</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Month-to-Date Expenses</div>
          <div className="text-xl font-bold text-rose-600 mt-2">
            ₹{Number(kpis.monthlyExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Electricity, freight, factory upkeep</div>
        </div>
      </div>

      {/* 7-Day Cashflow Trends & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Cashflow */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4">7-Day Cashflow (Inflow vs Outflow)</h3>
          <div className="space-y-3">
            {cashflow.map((item: any, idx: number) => {
              const maxVal = Math.max(...cashflow.map((c: any) => Math.max(c.inflow, c.outflow, 1000)));
              const inWidth = Math.min(100, Math.round((item.inflow / maxVal) * 100));
              const outWidth = Math.min(100, Math.round((item.outflow / maxVal) * 100));

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span className="font-semibold">{item.day} ({item.date.slice(5)})</span>
                    <span>
                      In: ₹{Number(item.inflow).toLocaleString()} | Out: ₹{Number(item.outflow).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
                    <div style={{ width: `${inWidth}%` }} className="bg-emerald-500 transition-all duration-300" />
                    <div style={{ width: `${outWidth}%` }} className="bg-rose-500 transition-all duration-300" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-4 text-xs text-gray-500 mt-4 pt-3 border-t">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Receipts (Inflow)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Payments/Expenses (Outflow)</span>
          </div>
        </div>

        {/* Recent Financial Transactions */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-4">Recent Financial Activity</h3>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Account</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-400">No transactions recorded yet.</td>
                  </tr>
                ) : (
                  recent.slice(0, 6).map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{t.accountName}</td>
                      <td className="py-2.5 px-3 text-gray-600 truncate max-w-[150px]">{t.description}</td>
                      <td className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                        t.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {t.direction === 'IN' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
