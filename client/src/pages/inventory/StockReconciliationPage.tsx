import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck, History } from 'lucide-react';

export const StockReconciliationPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);

  const fetchReconciliation = () => {
    setLoading(true);
    api.get('/inventory/reconciliation')
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReconciliation();
  }, []);

  const handleAutoReconcile = async () => {
    if (!confirm('Reconcile all detected balance discrepancies to match the authoritative immutable StockLedger?')) {
      return;
    }
    setReconciling(true);
    try {
      const res: any = await api.post('/inventory/reconcile', {});
      setReconcileResult(`Successfully synchronized ${res.data?.synced?.length || 0} discrepancy records.`);
      fetchReconciliation();
    } catch (err: any) {
      alert(err.message || 'Auto reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const totalDiscrepancies = items.filter(i => i.status === 'DISCREPANCY').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Stock Balance Reconciliation Engine</h1>
          <p className="text-sm text-gray-500">
            Authoritative verification comparing transactional InventoryBalance against the sum of the immutable StockLedger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReconciliation}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-run Audit Check
          </button>
          {isAdminOrOwner && totalDiscrepancies > 0 && (
            <button
              onClick={handleAutoReconcile}
              disabled={reconciling}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 shadow-sm disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {reconciling ? 'Reconciling...' : 'Auto-Reconcile Discrepancies'}
            </button>
          )}
        </div>
      </div>

      {reconcileResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span>{reconcileResult}</span>
          <button onClick={() => setReconcileResult(null)} className="text-emerald-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-medium text-gray-500 block">Audited Inventory Records</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{items.length} items</span>
          <span className="text-xs text-gray-400 mt-1 block">Full coverage across RM, Packaging & FG</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-medium text-gray-500 block">Matched / Zero Discrepancy</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {items.filter(i => i.status === 'MATCHED').length} items
          </span>
          <span className="text-xs text-emerald-600 font-medium mt-1 block">100% mathematical integrity</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-medium text-gray-500 block">Discrepancies Flagged</span>
          <span className={`text-2xl font-bold mt-1 block ${totalDiscrepancies > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
            {totalDiscrepancies} items
          </span>
          <span className="text-xs text-gray-400 mt-1 block">Requires authorized synchronization</span>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Item Code</th>
                <th className="p-3">Item Name</th>
                <th className="p-3">Classification</th>
                <th className="p-3">InventoryBalance Qty</th>
                <th className="p-3">StockLedger Sum</th>
                <th className="p-3">Discrepancy Delta</th>
                <th className="p-3">Audit Status</th>
                <th className="p-3 text-right">Recent Ledger Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Verifying ledger and balance records...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No items available for reconciliation.</td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.itemId} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-gray-900">{row.itemCode}</td>
                    <td className="p-3 font-semibold text-gray-800">{row.itemName}</td>
                    <td className="p-3 text-gray-500">{row.itemType}</td>
                    <td className="p-3 font-mono text-gray-900 font-medium">
                      {row.inventoryBalance} {row.unit}
                    </td>
                    <td className="p-3 font-mono text-gray-900 font-bold">
                      {row.ledgerCalculatedStock} {row.unit}
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <span className={row.discrepancy === 0 ? 'text-gray-500' : 'text-rose-700'}>
                        {row.discrepancy > 0 ? `+${row.discrepancy}` : row.discrepancy} {row.unit}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'MATCHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {row.status === 'MATCHED' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3 text-rose-600" />}
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-[11px] text-gray-500">
                      {row.recentMovements && row.recentMovements.length > 0 ? (
                        <span>
                          {row.recentMovements[0].movementType} ({row.recentMovements[0].quantity > 0 ? `+${row.recentMovements[0].quantity}` : row.recentMovements[0].quantity})
                        </span>
                      ) : (
                        <span>No movements</span>
                      )}
                    </td>
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
