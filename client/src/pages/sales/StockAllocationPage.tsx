import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Layers,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  ShoppingCart,
  Search,
  Check,
} from 'lucide-react';

export const StockAllocationPage: React.FC = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allocate modal state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [allocateNotes, setAllocateNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [availRes, allocRes, ordersRes] = await Promise.all([
        api.get('/sales/stock-availability'),
        api.get('/stock-allocations'),
        api.get('/orders?status=APPROVED'),
      ]);

      setAvailability(availRes.data || availRes || []);
      setAllocations(allocRes.data || allocRes || []);
      const ords = Array.isArray(ordersRes) ? ordersRes : ordersRes.data || [];
      setOrders(ords);
    } catch (err: any) {
      setError(err.message || 'Failed to load stock allocation data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateOrder = async (orderId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await api.post(`/orders/${orderId}/allocate`, { notes: allocateNotes });
      setSelectedOrderId(null);
      setAllocateNotes('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Allocation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseAllocation = async (allocationId: string) => {
    if (!window.confirm('Are you sure you want to release this stock allocation?')) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.post(`/stock-allocations/${allocationId}/release`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to release allocation.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading stock availability and allocations...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finished Goods Stock Allocation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reserve finished goods inventory for approved sales orders prior to physical dispatch
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refresh Stock
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stock Availability Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-600" />
            Finished Goods Availability Status
          </h2>
          <span className="text-xs text-gray-500">Live unreserved inventory</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Physical Stock</th>
                <th className="px-4 py-3 text-right">Allocated (Reserved)</th>
                <th className="px-4 py-3 text-right">Available Unreserved</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {availability.map((item) => (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.sku}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">
                    {item.physicalStock} pkts
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">
                    {item.allocatedStock} pkts
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">
                    {item.availableStock} pkts
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${
                        item.status === 'ADEQUATE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'LOW_STOCK'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Waiting Allocation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand-600" />
            Approved Orders Awaiting Stock Allocation ({orders.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Products & Quantities</th>
                <th className="px-4 py-3 text-right">Grand Total</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    No approved orders waiting for allocation
                  </td>
                </tr>
              ) : (
                orders.map((ord: any) => (
                  <tr key={ord.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-brand-600">
                      <Link to={`/orders/${ord.id}`}>{ord.orderNumber}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{ord.customer?.name}</div>
                      <div className="text-[11px] text-gray-400">{ord.customer?.state}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {ord.items?.map((i: any) => (
                          <div key={i.id} className="text-gray-700">
                            {i.product?.name}: <span className="font-bold">{Number(i.quantity)} pkts</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      ₹{Number(ord.grandTotal).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedOrderId(ord.id)}
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs transition-colors"
                      >
                        Allocate Stock
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Stock Allocations List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" />
            Active Stock Allocations ({allocations.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Allocation #</th>
                <th className="px-4 py-3">Sales Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Reserved Items</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No active stock allocations
                  </td>
                </tr>
              ) : (
                allocations.map((alloc: any) => (
                  <tr key={alloc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{alloc.allocationNumber}</td>
                    <td className="px-4 py-3 font-medium text-brand-600">
                      <Link to={`/orders/${alloc.salesOrderId}`}>
                        {alloc.salesOrder?.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{alloc.salesOrder?.customer?.name}</td>
                    <td className="px-4 py-3">
                      {alloc.items?.map((it: any) => (
                        <div key={it.id} className="text-gray-600">
                          {it.product?.name}: <span className="font-bold">{Number(it.allocatedQuantity)} pkts</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(alloc.allocationDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${
                          alloc.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : alloc.status === 'CONSUMED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {alloc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {alloc.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleReleaseAllocation(alloc.id)}
                          className="px-2.5 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded transition-colors"
                        >
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Confirm Finished Goods Stock Allocation</h3>
            <p className="text-xs text-gray-500">
              This will reserve the required finished goods inventory without creating a StockLedger OUT entry. Stock will only be deducted upon dispatch.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Allocation Notes (Optional)
              </label>
              <textarea
                value={allocateNotes}
                onChange={(e) => setAllocateNotes(e.target.value)}
                placeholder="e.g. Reserved from Batch 2026-0001"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAllocateOrder(selectedOrderId)}
                disabled={actionLoading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                {actionLoading ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
