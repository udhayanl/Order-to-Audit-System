import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Plus, Check, X, AlertCircle, RefreshCw, Filter } from 'lucide-react';

export const StockAdjustmentsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form states
  const [itemType, setItemType] = useState('RAW_MATERIAL');
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [systemQuantity, setSystemQuantity] = useState(0);
  const [unit, setUnit] = useState('kg');
  const [physicalQuantity, setPhysicalQuantity] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState('PHYSICAL_COUNT');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAdjustments = () => {
    setLoading(true);
    api.get('/inventory/adjustments')
      .then(setAdjustments)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  // Fetch items based on selected itemType
  useEffect(() => {
    if (!showModal) return;
    api.get('/inventory/summary')
      .then((data: any) => {
        let list: any[] = [];
        if (itemType === 'RAW_MATERIAL') list = data.rawMaterials || [];
        else if (itemType === 'PACKAGING') list = data.packagingMaterials || [];
        else if (itemType === 'FINISHED_GOOD') list = data.finishedGoods || [];

        setItemsList(list);
        if (list.length > 0) {
          setSelectedItemId(list[0].id);
          setSystemQuantity(list[0].currentStock);
          setUnit(list[0].uom);
          setPhysicalQuantity(list[0].currentStock);
        }
      })
      .catch(console.error);
  }, [itemType, showModal]);

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedItemId(id);
    const found = itemsList.find(i => i.id === id);
    if (found) {
      setSystemQuantity(found.currentStock);
      setUnit(found.uom);
      setPhysicalQuantity(found.currentStock);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a mandatory reason for this stock adjustment.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      await api.post('/inventory/adjustments', {
        itemId: selectedItemId,
        itemType,
        adjustmentType,
        physicalQuantity: Number(physicalQuantity),
        reason,
        notes,
        autoApprove: isAdminOrOwner && autoApprove,
      });

      setShowModal(false);
      setReason('');
      setNotes('');
      fetchAdjustments();
    } catch (err: any) {
      setError(err.message || 'Failed to create stock adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/inventory/adjustments/${id}/approve`, {});
      fetchAdjustments();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/inventory/adjustments/${id}/reject`, { reason });
      fetchAdjustments();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    }
  };

  const filtered = adjustments.filter(adj => {
    return statusFilter === 'ALL' || adj.status === statusFilter;
  });

  const difference = Math.round((Number(physicalQuantity) - Number(systemQuantity)) * 1000) / 1000;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Stock Adjustments & Physical Audits</h1>
          <p className="text-sm text-gray-500">
            Authorized cycle count adjustments, wastage, damage recording and reconciliation audit logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdjustments}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Stock Adjustment
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Total Records: {filtered.length}</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-lg p-2 bg-white"
        >
          <option value="ALL">All Statuses</option>
          <option value="POSTED">Posted to Ledger</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Adjustment #</th>
                <th className="p-3">Created Date</th>
                <th className="p-3">Category</th>
                <th className="p-3">Type</th>
                <th className="p-3">System Qty</th>
                <th className="p-3">Physical Qty</th>
                <th className="p-3">Difference</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created By</th>
                {isAdminOrOwner && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">Loading adjustments...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">No stock adjustments found.</td>
                </tr>
              ) : (
                filtered.map((adj) => {
                  const diff = Number(adj.difference);
                  const isPos = diff > 0;
                  return (
                    <tr key={adj.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-gray-900">{adj.adjustmentNumber}</td>
                      <td className="p-3 text-gray-500">{new Date(adj.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 font-medium text-gray-800">{adj.itemType}</td>
                      <td className="p-3">{adj.adjustmentType}</td>
                      <td className="p-3">{Number(adj.systemQuantity)} {adj.unit}</td>
                      <td className="p-3 font-semibold text-gray-900">{Number(adj.physicalQuantity)} {adj.unit}</td>
                      <td className="p-3 font-bold">
                        <span className={isPos ? 'text-emerald-700' : diff < 0 ? 'text-rose-700' : 'text-gray-600'}>
                          {isPos ? `+${diff}` : diff} {adj.unit}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{adj.reason}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            adj.status === 'POSTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : adj.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {adj.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{adj.createdBy?.fullName || 'User'}</td>
                      {isAdminOrOwner && (
                        <td className="p-3 text-right">
                          {adj.status === 'PENDING_APPROVAL' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApprove(adj.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                                title="Approve & Post to Ledger"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(adj.id)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold"
                                title="Reject"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAdjustment} className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Record Stock Adjustment</h3>
            <p className="text-xs text-gray-500">
              Adjusts physical inventory to reconcile cycle counts, spoilage or damage. Automatically updates immutable ledger.
            </p>

            {error && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Category</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                >
                  <option value="RAW_MATERIAL">Raw Material</option>
                  <option value="PACKAGING">Packaging Material</option>
                  <option value="FINISHED_GOOD">Finished Good</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                >
                  <option value="PHYSICAL_COUNT">Physical Cycle Count</option>
                  <option value="DAMAGE">Damaged Goods</option>
                  <option value="WASTAGE">Production Wastage</option>
                  <option value="EXPIRY">Expired Materials</option>
                  <option value="INCREASE">Manual Increase</option>
                  <option value="DECREASE">Manual Decrease</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Item</label>
              <select
                value={selectedItemId}
                onChange={handleItemChange}
                className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                required
              >
                {itemsList.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code}) — Current: {item.currentStock} {item.uom}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-0.5">System Quantity</label>
                <span className="text-sm font-bold text-gray-800">{systemQuantity} {unit}</span>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Physical Count</label>
                <input
                  type="number"
                  step="0.01"
                  value={physicalQuantity}
                  onChange={(e) => setPhysicalQuantity(Number(e.target.value))}
                  className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Calculated Delta</label>
                <span className={`text-sm font-bold ${difference > 0 ? 'text-emerald-700' : difference < 0 ? 'text-rose-700' : 'text-gray-700'}`}>
                  {difference > 0 ? `+${difference}` : difference} {unit}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Mandatory Reason</label>
              <input
                type="text"
                placeholder="e.g. Month-end physical audit variance..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
                required
              />
            </div>

            {isAdminOrOwner && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="autoApprove" className="text-xs font-semibold text-gray-700">
                  Immediately approve and post adjustment to StockLedger
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Record Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
