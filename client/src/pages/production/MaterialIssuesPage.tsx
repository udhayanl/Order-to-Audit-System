import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import {
  Boxes,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  ArrowRight,
  Layers,
  FileText,
  X,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { useAuth } from '../../context/AuthContext.js';

export const MaterialIssuesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId') || '';

  const [issues, setIssues] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedIssueItem, setSelectedIssueItem] = useState<any>(null);

  // Issue Form State
  const [selectedOrderId, setSelectedOrderId] = useState(preselectedOrderId);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [issueItems, setIssueItems] = useState<any[]>([]);
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Return Form State
  const [returnQty, setReturnQty] = useState<number>(0);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { user } = useAuth();
  const canIssue = ['PRODUCTION_SUPERVISOR', 'ADMIN', 'OWNER'].includes(user?.role || '');

  const loadData = async () => {
    try {
      setLoading(true);
      const [issueList, orderList] = await Promise.all([
        api.get('/production/material-issues'),
        api.get('/production/orders'),
      ]);
      setIssues(issueList || []);
      setOrders(orderList || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When order changes in modal, load its material requirements
  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrderDetails(null);
      setIssueItems([]);
      return;
    }

    const loadReqs = async () => {
      try {
        const orderData = await api.get(`/production/orders/${selectedOrderId}`);
        setSelectedOrderDetails(orderData);

        // Prepopulate issue items from BOM snapshot or requirements
        const reqs = await api.get(`/production/orders/${selectedOrderId}/material-requirements`);
        if (reqs?.items) {
          setIssueItems(
            reqs.items.map((it: any) => ({
              itemType: it.itemType,
              rawMaterialId: it.itemType === 'RAW_MATERIAL' ? it.itemId : undefined,
              packagingMaterialId: it.itemType === 'PACKAGING' ? it.itemId : undefined,
              name: it.name,
              code: it.code,
              unit: it.unit,
              requestedQuantity: it.scaledQuantity,
              issuedQuantity: it.scaledQuantity,
              availableStock: it.availableStock,
            }))
          );
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadReqs();
  }, [selectedOrderId]);

  // Submit Issue Handler
  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || issueItems.length === 0) return;

    try {
      setSubmittingIssue(true);
      setErrorMsg(null);
      await api.post('/production/material-issues', {
        productionOrderId: selectedOrderId,
        items: issueItems.map((it) => ({
          itemType: it.itemType,
          rawMaterialId: it.rawMaterialId,
          packagingMaterialId: it.packagingMaterialId,
          requestedQuantity: Number(it.requestedQuantity),
          issuedQuantity: Number(it.issuedQuantity),
          unit: it.unit,
        })),
      });

      setSuccessMsg('Materials issued successfully. Stock deducted from inventory via FIFO layers.');
      setIsIssueModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to issue materials.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  // Submit Return Handler
  const handleReturnUnused = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueItem || returnQty <= 0) return;

    try {
      setSubmittingReturn(true);
      setErrorMsg(null);
      await api.post(`/production/material-issues/${selectedIssueItem.id}/return`, {
        returnedQuantity: Number(returnQty),
        reason: returnReason,
      });

      setSuccessMsg(`Successfully returned ${returnQty} ${selectedIssueItem.unit} to store inventory.`);
      setIsReturnModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to return material.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const filteredIssues = issues.filter(
    (i) =>
      i.issueNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.productionOrder?.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.productionOrder?.product?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-7 h-7 text-emerald-600" />
            Material Issues & FIFO Consumption
          </h1>
          <p className="text-sm text-gray-500">
            Issue recipe raw materials and packaging from inventory, deplete FIFO valuation layers, and process unused returns
          </p>
        </div>
        {canIssue && (
          <button
            onClick={() => {
              if (orders.length > 0) setSelectedOrderId(orders[0].id);
              setIsIssueModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Issue Materials
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by issue #, order #, or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="text-xs text-gray-500">
          Total Issues: <span className="font-bold text-gray-900">{filteredIssues.length}</span>
        </div>
      </div>

      {/* Material Issues List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 text-center text-gray-400 rounded-xl border border-gray-200">
            Loading material issues...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="bg-white p-12 text-center text-gray-400 rounded-xl border border-gray-200">
            No material issues found.
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-sm text-gray-900">{issue.issueNumber}</span>
                  <span className="text-xs text-gray-500">
                    Order: <Link to={`/production/orders/${issue.productionOrderId}`} className="font-semibold text-indigo-600 hover:underline">{issue.productionOrder?.orderNumber}</Link>
                  </span>
                  <span className="text-xs text-gray-500">
                    Product: <span className="font-semibold text-gray-800">{issue.productionOrder?.product?.name}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    Date: {new Date(issue.issueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Issued by: <span className="font-medium text-gray-700">{issue.issuedBy?.fullName || 'Supervisor'}</span>
                  </span>
                  <StatusBadge status={issue.status} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-white text-gray-700 uppercase font-semibold border-b border-gray-100">
                    <tr>
                      <th className="p-3">Material</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Requested</th>
                      <th className="p-3 text-right">Issued Qty</th>
                      <th className="p-3 text-right">Returned</th>
                      <th className="p-3 text-right">Actual Consumed</th>
                      <th className="p-3 text-right">FIFO Unit Rate</th>
                      <th className="p-3 text-right">Total Cost</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {issue.items?.map((it: any) => {
                      const matName = it.rawMaterial?.name || it.packagingMaterial?.name || 'Material Item';
                      const issued = Number(it.issuedQuantity);
                      const returned = Number(it.returnedQuantity || 0);
                      const actual = Number(it.actualConsumedQuantity);

                      return (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="p-3 font-semibold text-gray-900">{matName}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {it.itemType}
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium">{Number(it.requestedQuantity)} {it.unit}</td>
                          <td className="p-3 text-right font-bold text-gray-900">{issued} {it.unit}</td>
                          <td className="p-3 text-right text-rose-600 font-medium">{returned} {it.unit}</td>
                          <td className="p-3 text-right font-bold text-indigo-700">{actual} {it.unit}</td>
                          <td className="p-3 text-right font-mono">₹{Number(it.unitCost).toFixed(2)}</td>
                          <td className="p-3 text-right font-bold text-emerald-700">₹{Number(it.totalCost).toFixed(2)}</td>
                          <td className="p-3 text-right">
                            {canIssue && actual > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedIssueItem({ ...it, materialName: matName });
                                  setReturnQty(0);
                                  setReturnReason('');
                                  setIsReturnModalOpen(true);
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm"
                              >
                                <RotateCcw className="w-3 h-3" /> Return
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ISSUE MATERIALS MODAL */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-base text-gray-900">Post Material Issue</h3>
                <p className="text-xs text-gray-500">Atomic FIFO stock deduction and stock ledger recording</p>
              </div>
              <button onClick={() => setIsIssueModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Production Order *
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose Order --</option>
                  {orders
                    .filter((o) => ['APPROVED', 'MATERIALS_RESERVED', 'IN_PROGRESS'].includes(o.status))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} - {o.product?.name} ({Number(o.plannedOutputQuantity)} pkts) [{o.status}]
                      </option>
                    ))}
                </select>
              </div>

              {/* Items List to Issue */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-100 text-gray-700 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Material</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Standard Req</th>
                      <th className="p-3 text-right">Available Stock</th>
                      <th className="p-3 text-right">Issue Qty *</th>
                      <th className="p-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {issueItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-400">
                          Select an approved production order to load required materials.
                        </td>
                      </tr>
                    ) : (
                      issueItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-3 font-semibold text-gray-900">{item.name}</td>
                          <td className="p-3">{item.itemType}</td>
                          <td className="p-3 text-right font-medium">{item.requestedQuantity}</td>
                          <td className="p-3 text-right font-bold text-gray-700">{item.availableStock}</td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={item.issuedQuantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setIssueItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, issuedQuantity: val } : it))
                                );
                              }}
                              required
                              className="w-24 p-1.5 border border-gray-300 rounded text-right font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-3 text-gray-500">{item.unit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue || issueItems.length === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submittingIssue ? 'Issuing...' : 'Confirm Issue & Deduct Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN UNUSED MATERIAL MODAL */}
      {isReturnModalOpen && selectedIssueItem && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Return Unused Material to Stores
              </h3>
              <button onClick={() => setIsReturnModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnUnused} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Material</label>
                <div className="text-sm font-bold text-gray-900">{selectedIssueItem.materialName}</div>
                <div className="text-xs text-gray-500">
                  Actual Consumed: {Number(selectedIssueItem.actualConsumedQuantity)} {selectedIssueItem.unit}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Quantity to Return ({selectedIssueItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedIssueItem.actualConsumedQuantity)}
                  value={returnQty}
                  onChange={(e) => setReturnQty(Number(e.target.value))}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Returned to stores due to recipe balance"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn || returnQty <= 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {submittingReturn ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
