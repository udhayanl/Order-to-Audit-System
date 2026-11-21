import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileText,
  Truck,
  AlertTriangle,
  Download,
} from 'lucide-react';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [dispatchModal, setDispatchModal] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('TN-45-AZ-9988');
  const [driverName, setDriverName] = useState('Senthil');
  const [remarks, setRemarks] = useState('Dispatched via factory delivery van');
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchOrder = () => {
    if (!id) return;
    setLoading(true);
    api.get(`/orders/${id}`)
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading order details...</div>;
  if (!order) return <div className="p-8 text-center text-red-500">Order not found.</div>;

  const stockCheck = order.stockCheck;
  const hasShortage = stockCheck?.hasShortage;

  const handleApprove = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/orders/${id}/approve`);
      fetchOrder();
    } catch (err: any) {
      setError(err.message || 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/orders/${id}/reject`, { reason: rejectionReason });
      setRejectModal(false);
      fetchOrder();
    } catch (err: any) {
      setError(err.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const inv = await api.post('/invoices/create-from-order', { orderId: order.id });
      navigate(`/invoices/${inv.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate invoice.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      await api.post('/dispatches', {
        orderId: order.id,
        vehicleNumber,
        driverName,
        remarks,
      });
      setDispatchModal(false);
      fetchOrder();
    } catch (err: any) {
      setError(err.message || 'Dispatch failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{order.orderNumber}</h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-gray-500">
              Placed on {new Date(order.orderDate).toLocaleString()} by {order.salesman?.fullName}
            </p>
          </div>
        </div>

        {/* Action Buttons for Admin */}
        {(user?.role === 'ADMIN' || user?.role === 'OWNER') && (
          <div className="flex flex-wrap items-center gap-2">
            {order.status === 'SUBMITTED' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" /> Approve Order
                </button>
                <button
                  onClick={() => setRejectModal(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject Order
                </button>
              </>
            )}

            {order.status === 'APPROVED' && (
              <button
                onClick={handleGenerateInvoice}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4" /> Generate GST Invoice
              </button>
            )}

            {order.status === 'INVOICED' && (
              <button
                onClick={() => setDispatchModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Truck className="w-4 h-4" /> Record Dispatch
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stock Availability Alert Box */}
      {stockCheck && (
        <div
          className={`p-4 rounded-xl border ${
            hasShortage
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {hasShortage ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            )}
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Stock Availability & Shortage Verification
            </h3>
          </div>
          <div className="space-y-1.5 text-xs">
            {stockCheck.stockStatus?.map((st: any) => (
              <div key={st.productId} className="flex justify-between items-center py-1 border-b border-black/5">
                <span className="font-semibold">{st.productName}</span>
                <span>
                  Requested: <strong>{st.requestedQuantity}</strong> | Available in Stock: <strong>{st.availableStock}</strong> |{' '}
                  {st.shortage > 0 ? (
                    <span className="text-red-700 font-bold underline">Shortage: {st.shortage} pkts (Cannot full dispatch!)</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">Stock Available</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer & Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-2 text-xs">
          <h2 className="font-bold uppercase tracking-wider text-gray-500 mb-2">Customer Information</h2>
          <div className="text-sm font-bold text-gray-900">{order.customer?.name}</div>
          <div>Type: <span className="font-semibold">{order.customer?.type}</span></div>
          <div>GSTIN: <span className="font-semibold">{order.customer?.gstin || 'Unregistered'}</span></div>
          <div>State: <span className="font-semibold">{order.customer?.state} ({order.customer?.stateCode})</span></div>
          <div className="text-gray-500 mt-2">Billing: {order.customer?.billingAddress}</div>
          <div className="text-gray-500">Shipping: {order.customer?.shippingAddress}</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-2 text-xs">
          <h2 className="font-bold uppercase tracking-wider text-gray-500 mb-2">Order Summary</h2>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">Order Status:</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">Taxable Value:</span>
            <span className="font-semibold text-gray-900">₹{Number(order.subtotal).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">Estimated GST (5%):</span>
            <span className="font-semibold text-gray-900">₹{Number(order.estimatedGst).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-1 text-sm font-bold text-gray-900">
            <span>Grand Total:</span>
            <span className="text-brand-600">₹{Number(order.grandTotal).toLocaleString('en-IN')}</span>
          </div>
          {order.invoice && (
            <div className="pt-2">
              <Link
                to={`/invoices/${order.invoice.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
              >
                <FileText className="w-4 h-4" /> View Invoice {order.invoice.invoiceNumber} →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Ordered Products</h2>
        <table className="w-full text-left text-xs text-gray-600">
          <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="p-3">Product Name</th>
              <th className="p-3">Pack Size</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Unit Price</th>
              <th className="p-3">Taxable Value</th>
              <th className="p-3">GST Rate</th>
              <th className="p-3 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items?.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-3 font-semibold text-gray-900">{item.product?.name}</td>
                <td className="p-3 text-gray-500">{item.product?.packSize}</td>
                <td className="p-3 font-bold text-gray-900">{Number(item.quantity)} {item.product?.unit}</td>
                <td className="p-3">₹{Number(item.unitPrice).toFixed(2)}</td>
                <td className="p-3">₹{Number(item.taxableAmount).toFixed(2)}</td>
                <td className="p-3">{Number(item.gstRate)}%</td>
                <td className="p-3 text-right font-bold text-gray-900">₹{Number(item.totalAmount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rejection Modal Dialog */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject Sales Order</h3>
            <p className="text-xs text-gray-500">
              Provide a clear reason for rejecting order {order.orderNumber}. The salesman will see this message.
            </p>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Credit limit exceeded or product out of season..."
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded shadow disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal Dialog */}
      {dispatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDispatch} className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Record Dispatch & Stock Deduction</h3>
            <p className="text-xs text-gray-500">
              Posting dispatch will atomically deduct finished goods from the immutable StockLedger.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Vehicle Number</label>
              <input
                type="text"
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Driver Name</label>
              <input
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDispatchModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow disabled:opacity-50"
              >
                Post Dispatch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
