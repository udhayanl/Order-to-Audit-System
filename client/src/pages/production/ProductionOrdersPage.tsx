import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Boxes,
  ArrowRight,
  ShieldCheck,
  X,
  Play,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { useAuth } from '../../context/AuthContext.js';

export const ProductionOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [boms, setBOMs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [productId, setProductId] = useState('');
  const [bomId, setBOMId] = useState('');
  const [plannedQty, setPlannedQty] = useState<number>(200);
  const [priority, setPriority] = useState('MEDIUM');
  const [notes, setNotes] = useState('');

  // Scaling preview state
  const [previewReqs, setPreviewReqs] = useState<any[]>([]);
  const [calculatingPreview, setCalculatingPreview] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = ['PRODUCTION_SUPERVISOR', 'ADMIN', 'OWNER'].includes(user?.role || '');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/production/orders');
      setOrders(res || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      const [prods, bomList] = await Promise.all([
        api.get('/master/products'),
        api.get('/master/boms'),
      ]);
      setProducts(prods || []);
      setBOMs(bomList || []);
      if (prods && prods.length > 0) {
        setProductId(prods[0].id);
        const relatedBom = bomList?.find((b: any) => b.productId === prods[0].id && b.active);
        if (relatedBom) setBOMId(relatedBom.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadOrders();
    loadMasters();
  }, []);

  // When product changes, auto-select active BOM
  const handleProductChange = (newProdId: string) => {
    setProductId(newProdId);
    const activeBom = boms.find(b => b.productId === newProdId && b.active);
    if (activeBom) {
      setBOMId(activeBom.id);
    } else {
      setBOMId('');
    }
  };

  // Real-time calculation preview when bomId or plannedQty changes
  useEffect(() => {
    if (!bomId || plannedQty <= 0) {
      setPreviewReqs([]);
      return;
    }

    const calculatePreview = async () => {
      try {
        setCalculatingPreview(true);
        const res = await api.post('/production/calculate-planned', {
          bomId,
          plannedBatchQuantity: plannedQty,
        });
        setPreviewReqs(res?.plannedItems || []);
      } catch (err) {
        console.error(err);
      } finally {
        setCalculatingPreview(false);
      }
    };

    const timer = setTimeout(calculatePreview, 300);
    return () => clearTimeout(timer);
  }, [bomId, plannedQty]);

  // Create Order Handler
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !bomId || plannedQty <= 0) {
      setErrorMsg('Please select a product, BOM, and enter a valid planned output quantity.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await api.post('/production/orders', {
        productId,
        bomId,
        plannedOutputQuantity: Number(plannedQty),
        priority,
        notes,
      });
      setSuccessMsg('Production Order created successfully in DRAFT status.');
      setIsModalOpen(false);
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create production order.');
    } finally {
      setSubmitting(false);
    }
  };

  // Actions
  const handleSubmitOrder = async (id: string) => {
    try {
      await api.post(`/production/orders/${id}/submit`);
      setSuccessMsg('Order submitted for approval.');
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit order.');
    }
  };

  const handleApproveOrder = async (id: string) => {
    try {
      await api.post(`/production/orders/${id}/approve`, { forceShortage: false });
      setSuccessMsg('Production order approved.');
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Approval failed.');
    }
  };

  const handleReserveMaterials = async (id: string) => {
    try {
      await api.post(`/production/orders/${id}/reserve-materials`);
      setSuccessMsg('Materials reserved successfully in inventory.');
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Material reservation failed.');
    }
  };

  const handleCancelOrder = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this production order? Any reserved materials will be released.')) {
      return;
    }
    try {
      await api.post(`/production/orders/${id}/cancel`, { reason: 'User requested cancellation' });
      setSuccessMsg('Order cancelled and reservations released.');
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Cancellation failed.');
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.product?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-indigo-600" />
            Production Orders & Batch Planning
          </h1>
          <p className="text-sm text-gray-500">
            Formulate batch production plans, scale active BOM recipes, reserve materials, and track status transitions
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Production Order
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

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {['ALL', 'DRAFT', 'PLANNED', 'APPROVED', 'MATERIALS_RESERVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search order # or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Order Number</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">BOM Version</th>
                <th className="p-3">Planned Qty</th>
                <th className="p-3">Good Output</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading production orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No production orders found matching criteria.</td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">
                      <Link to={`/production/orders/${ord.id}`} className="text-indigo-600 hover:underline">
                        {ord.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3 font-semibold text-gray-900">{ord.product?.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-mono text-[11px]">
                        {ord.bomVersion}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-gray-800">
                      {Number(ord.plannedOutputQuantity)} pkts
                    </td>
                    <td className="p-3 font-bold text-emerald-700">
                      {Number(ord.actualOutputQuantity || 0)} pkts
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                        ord.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {ord.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={ord.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {ord.status === 'DRAFT' && canManage && (
                          <button
                            onClick={() => handleSubmitOrder(ord.id)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs shadow-sm"
                          >
                            Submit
                          </button>
                        )}

                        {ord.status === 'PLANNED' && canManage && (
                          <button
                            onClick={() => handleApproveOrder(ord.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs shadow-sm"
                          >
                            Approve
                          </button>
                        )}

                        {ord.status === 'APPROVED' && canManage && (
                          <button
                            onClick={() => handleReserveMaterials(ord.id)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-xs shadow-sm"
                          >
                            Reserve Materials
                          </button>
                        )}

                        {(ord.status === 'MATERIALS_RESERVED' || ord.status === 'APPROVED') && canManage && (
                          <Link
                            to={`/production/executions?orderId=${ord.id}`}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-xs shadow-sm flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Execute
                          </Link>
                        )}

                        {['DRAFT', 'PLANNED', 'APPROVED', 'MATERIALS_RESERVED'].includes(ord.status) && canManage && (
                          <button
                            onClick={() => handleCancelOrder(ord.id)}
                            className="px-2 py-1 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 rounded font-medium text-xs"
                          >
                            Cancel
                          </button>
                        )}

                        <Link
                          to={`/production/orders/${ord.id}`}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-xs"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-base text-gray-900">Create Production Order</h3>
                <p className="text-xs text-gray-500">Plan batch manufacturing run with scaled BOM requirements</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Finished Product *
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Active BOM Recipe *
                  </label>
                  <select
                    value={bomId}
                    onChange={(e) => setBOMId(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    {boms
                      .filter((b) => b.productId === productId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.version}) - Std {b.batchSize} {b.batchUnit}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Planned Output Quantity (Packets) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(Number(e.target.value))}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Production Notes & Instructions
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Special festive run, verify nitrogen seal calibration..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Scaled Material Requirements Preview */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    BOM Scaled Material Requirements Preview
                  </h4>
                  {calculatingPreview && (
                    <span className="text-[11px] text-gray-500">Calculating scaling...</span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] text-gray-600">
                    <thead className="bg-gray-100 text-gray-700 uppercase font-semibold">
                      <tr>
                        <th className="p-2">Material</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Scaled Requirement</th>
                        <th className="p-2">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewReqs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-3 text-center text-gray-400">
                            Select a BOM recipe to calculate requirements.
                          </td>
                        </tr>
                      ) : (
                        previewReqs.map((it: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium text-gray-900">{it.name}</td>
                            <td className="p-2">{it.itemType}</td>
                            <td className="p-2 font-bold text-indigo-700">{it.plannedQuantity}</td>
                            <td className="p-2 text-gray-500">{it.unit}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Production Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
