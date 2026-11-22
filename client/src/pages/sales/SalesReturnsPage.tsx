import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  RotateCcw,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  Search,
  Package,
} from 'lucide-react';

export const SalesReturnsPage: React.FC = () => {
  const { user } = useAuth();
  const [returns, setReturns] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedDispatchId, setSelectedDispatchId] = useState('');
  const [returnReason, setReturnReason] = useState('DAMAGED_GOODS');
  const [condition, setCondition] = useState<'GOOD' | 'DAMAGED' | 'EXPIRED' | 'QUARANTINED'>('GOOD');
  const [returnQty, setReturnQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const [retRes, dspRes] = await Promise.all([
        api.get('/sales/returns'),
        api.get('/dispatches'),
      ]);
      setReturns(retRes.data || retRes || []);
      const dspData = Array.isArray(dspRes) ? dspRes : dspRes.data || [];
      setDispatches(dspData);
      if (dspData.length > 0) {
        setSelectedDispatchId(dspData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sales returns.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDispatch = dispatches.find((d) => d.id === selectedDispatchId);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) {
      setError('Please select a dispatch record.');
      return;
    }

    const firstItem = selectedDispatch.items?.[0];
    if (!firstItem) {
      setError('Selected dispatch has no items.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.post('/sales/returns', {
        customerId: selectedDispatch.order?.customer?.id || selectedDispatch.order?.customerId,
        salesOrderId: selectedDispatch.orderId,
        dispatchId: selectedDispatch.id,
        invoiceId: selectedDispatch.invoiceId,
        returnReason,
        notes,
        items: [
          {
            productId: firstItem.productId,
            returnedQuantity: Number(returnQty),
            condition,
            batchNumber: firstItem.batchNumber || null,
          },
        ],
      });

      setModalOpen(false);
      setReturnQty(1);
      setNotes('');
      fetchReturns();
    } catch (err: any) {
      setError(err.message || 'Failed to create sales return.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading sales returns...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales Returns & Credit Notes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track customer returns, condition inspection, inventory restocking and statutory credit notes
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record Sales Return
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Returns Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Return #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Order / Dispatch</th>
                <th className="px-4 py-3">Return Reason</th>
                <th className="px-4 py-3">Returned Items & Condition</th>
                <th className="px-4 py-3">Stock Restocked</th>
                <th className="px-4 py-3 text-right">Credit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No sales returns recorded
                  </td>
                </tr>
              ) : (
                returns.map((ret: any) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-brand-600">{ret.returnNumber}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{ret.customer?.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{ret.salesOrder?.orderNumber}</div>
                      <div className="text-[11px] text-gray-400">{ret.dispatch?.dispatchNumber}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {ret.returnReason.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      {ret.items?.map((it: any) => (
                        <div key={it.id} className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900">{it.product?.name}</span>
                          <span className="text-gray-500">({Number(it.returnedQuantity)} pkts)</span>
                          <span
                            className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${
                              it.condition === 'GOOD'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {it.condition}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      {ret.items?.[0]?.stockRestocked ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> Restocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Quarantined / Damaged
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {ret.creditNotes?.[0]?.creditNoteNumber || 'Issued'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Return Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateReturn}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-gray-900">Record Sales Return & Credit Note</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Dispatched Shipment</label>
                <select
                  value={selectedDispatchId}
                  onChange={(e) => setSelectedDispatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  {dispatches.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dispatchNumber} — Order: {d.order?.orderNumber} ({d.order?.customer?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Return Reason</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <option value="DAMAGED_GOODS">Damaged Goods</option>
                    <option value="EXPIRED_GOODS">Expired Goods</option>
                    <option value="INCORRECT_PRODUCT">Incorrect Product</option>
                    <option value="QUALITY_COMPLAINT">Quality Complaint</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Physical Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-bold"
                  >
                    <option value="GOOD">GOOD (Restock to FG Inventory)</option>
                    <option value="DAMAGED">DAMAGED (Isolate / Write-off)</option>
                    <option value="EXPIRED">EXPIRED (Disposal)</option>
                    <option value="QUARANTINED">QUARANTINED (Hold for Inspection)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Returned Quantity (Packets)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={returnQty}
                  onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                />
              </div>

              {condition === 'GOOD' ? (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-[11px] leading-relaxed">
                  ✓ <strong>Inventory Rule:</strong> Condition is marked as GOOD. These {returnQty} packet(s) will be automatically restocked into usable Finished Goods inventory via a StockLedger IN entry.
                </div>
              ) : (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-[11px] leading-relaxed">
                  ⚠ <strong>Food Safety Rule:</strong> Condition is marked as {condition}. These goods will NOT be added to usable inventory to prevent contaminated stock from entering fulfillment.
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Audit Notes / Comments</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Returned by retailer due to crushed outer box during transit"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                {submitting ? 'Recording...' : 'Record Return & Issue Credit Note'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
