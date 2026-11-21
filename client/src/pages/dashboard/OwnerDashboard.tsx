import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { DollarSign, TrendingUp, Package, Layers, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const OwnerDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading executive overview...</div>;

  const costing = stats?.costingSummary || [];
  const chartData = costing.map((c: any) => ({
    name: c.productName,
    sellingPrice: c.sellingPrice,
    costPerPacket: c.costPerPacket,
    marginPerPacket: c.marginPerPacket,
  }));

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Executive Factory Overview</h1>
          <p className="text-sm text-gray-500">
            Ownership analytics on revenue, profitability, inventory valuation and margins
          </p>
        </div>
        <div className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> Confidential Owner Console
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Billed Revenue"
          value={`₹${(stats?.totalSales || 0).toLocaleString('en-IN')}`}
          subtitle="Taxable supplies + GST"
          icon={DollarSign}
          color="brand"
        />
        <MetricCard
          title="Outstanding Receivables"
          value={`₹${(stats?.totalReceivables || 0).toLocaleString('en-IN')}`}
          subtitle={`₹${(stats?.overduePayments || 0).toLocaleString('en-IN')} overdue`}
          icon={TrendingUp}
          color="rose"
        />
        <MetricCard
          title="Finished Goods Stock"
          value={`${stats?.totalFgStock || 0} pkts`}
          subtitle="Ready for delivery"
          icon={Package}
          color="blue"
        />
        <MetricCard
          title="Variance Alerts"
          value={stats?.varianceAlertsCount || 0}
          subtitle="Batches exceeding 3% tolerance"
          icon={Layers}
          color="amber"
        />
      </div>

      {/* Product Profitability & Margins Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-600" /> Product Costing & Selling Margins (FIFO Valuation)
          </h2>
          <span className="text-xs text-gray-400">Overheads allocated across actual good packets</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Run Number</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Good Packets</th>
                <th className="p-3">Total Prod Cost</th>
                <th className="p-3">Cost / Packet</th>
                <th className="p-3">Selling Price</th>
                <th className="p-3">Gross Margin (₹)</th>
                <th className="p-3">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costing.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-xs text-gray-400">
                    No production runs available for margin calculation.
                  </td>
                </tr>
              ) : (
                costing.map((c: any) => (
                  <tr key={c.runId} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-900">{c.runNumber}</td>
                    <td className="p-3 font-medium text-gray-800">{c.productName}</td>
                    <td className="p-3">{c.actualGoodOutput} pkts</td>
                    <td className="p-3 font-medium text-gray-900">₹{c.totalProductionCost.toLocaleString('en-IN')}</td>
                    <td className="p-3 font-bold text-emerald-700">₹{c.costPerPacket.toFixed(2)}</td>
                    <td className="p-3 font-bold text-gray-900">₹{c.sellingPrice.toFixed(2)}</td>
                    <td className="p-3 font-bold text-brand-600">₹{c.marginPerPacket.toFixed(2)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                        {c.marginPercent}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart: Product Cost vs Selling Price vs Margin */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Cost vs Selling Price vs Gross Margin (₹ per packet)</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, '']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="costPerPacket" name="Cost per Packet (₹)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="marginPerPacket" name="Gross Margin (₹)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sellingPrice" name="Selling Price (₹)" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
