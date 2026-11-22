import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  Clock,
  Store,
  ArrowLeft,
  Calendar,
  FileText,
} from 'lucide-react';

export const SalesmanMobileOrderPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNotes, setOrderNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [custRes, prodRes] = await Promise.all([
        api.get('/customers'),
        api.get('/products'),
      ]);

      const custData = Array.isArray(custRes) ? custRes : custRes.data || [];
      const prodData = Array.isArray(prodRes) ? prodRes : prodRes.data || [];

      // If user is salesman, filter to assigned customers if available
      const filteredCust =
        user?.role === 'SALESMAN'
          ? custData.filter((c: any) => !c.salesmanId || c.salesmanId === user.id)
          : custData;

      setCustomers(filteredCust);
      setProducts(prodData.filter((p: any) => p.active));

      if (filteredCust.length > 0) {
        setSelectedCustomerId(filteredCust[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load ordering catalog.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  // Calculations
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const isIntraState = selectedCustomer?.stateCode === '33' || !selectedCustomer?.stateCode;

  let subtotal = 0;
  let estimatedGst = 0;

  Object.entries(cart).forEach(([prodId, qty]) => {
    const prod = products.find((p) => p.id === prodId);
    if (prod && qty > 0) {
      const lineTaxable = Number(prod.sellingPrice) * qty;
      const gstRate = Number(prod.gstRate || 5.0);
      const lineGst = (lineTaxable * gstRate) / 100;
      subtotal += lineTaxable;
      estimatedGst += lineGst;
    }
  });

  const grandTotal = Math.round((subtotal + estimatedGst) * 100) / 100;
  const totalItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError('Please select a customer.');
      return;
    }
    if (totalItemsCount === 0) {
      setError('Please add at least one product to the order cart.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const items = Object.entries(cart).map(([productId, quantity]) => ({
        productId,
        quantity,
      }));

      const res = await api.post('/orders', {
        customerId: selectedCustomerId,
        items,
        orderNotes,
        deliveryDate: new Date(deliveryDate),
        status: 'SUBMITTED',
      });

      const orderData = res.data || res;
      setSuccessOrder(orderData);
      setCart({});
    } catch (err: any) {
      setError(err.message || 'Failed to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading salesman catalog...
      </div>
    );
  }

  if (successOrder) {
    return (
      <div className="max-w-lg mx-auto bg-white p-6 rounded-2xl border border-gray-200 shadow-md text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Order Placed Successfully!</h2>
        <p className="text-sm text-gray-600">
          Order Number: <span className="font-bold text-brand-600">{successOrder.orderNumber}</span>
        </p>
        <div className="bg-gray-50 p-4 rounded-xl text-left text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Customer:</span>
            <span className="font-semibold text-gray-800">{selectedCustomer?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Amount:</span>
            <span className="font-bold text-gray-900">₹{Number(successOrder.grandTotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status:</span>
            <span className="font-semibold text-amber-600">{successOrder.status}</span>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setSuccessOrder(null)}
            className="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl text-sm"
          >
            Create Another Order
          </button>
          <button
            onClick={() => navigate(`/orders/${successOrder.id}`)}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm"
          >
            View Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-900">Salesman Quick Order</h1>
          <p className="text-xs text-gray-500">{user?.fullName} • Field Ordering</p>
        </div>
        <div className="w-8" />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Customer Selector Card */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Store className="w-4 h-4 text-brand-600" />
          Select Customer Shop
        </label>
        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type} • {c.city || 'TN'})
            </option>
          ))}
        </select>
        {selectedCustomer && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg">
            <div><span className="font-medium text-gray-700">GSTIN:</span> {selectedCustomer.gstin || 'Unregistered'}</div>
            <div><span className="font-medium text-gray-700">Address:</span> {selectedCustomer.billingAddress}</div>
            <div><span className="font-medium text-gray-700">Tax Type:</span> {isIntraState ? 'Intra-State (CGST 2.5% + SGST 2.5%)' : 'Inter-State (IGST 5.0%)'}</div>
          </div>
        )}
      </div>

      {/* Product Catalog Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
          Packaged Foods Catalog
        </h2>
        {products.map((prod) => {
          const qty = cart[prod.id] || 0;
          return (
            <div
              key={prod.id}
              className={`bg-white p-3.5 rounded-xl border transition-colors shadow-sm flex items-center justify-between ${
                qty > 0 ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/20' : 'border-gray-200'
              }`}
            >
              <div>
                <div className="font-bold text-sm text-gray-900">{prod.name}</div>
                <div className="text-xs text-gray-500">
                  {prod.packSize} • SKU: {prod.sku}
                </div>
                <div className="text-sm font-bold text-brand-600 mt-1">
                  ₹{Number(prod.sellingPrice).toFixed(2)} / pkt
                </div>
              </div>

              {/* Counter Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQuantity(prod.id, -1)}
                  disabled={qty === 0}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold flex items-center justify-center transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-sm font-bold text-gray-900">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(prod.id, 1)}
                  className="w-8 h-8 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Details */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 text-xs">
        <div>
          <label className="block font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            Expected Delivery Date
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
          />
        </div>
        <div>
          <label className="block font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            Order / Delivery Notes
          </label>
          <input
            type="text"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="e.g. Festival priority dispatch"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Floating Bottom Cart Summary */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl z-20 max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-gray-500">
            {totalItemsCount} packets ({Object.keys(cart).length} items)
          </span>
          <span className="font-semibold text-gray-700">
            Taxable: ₹{subtotal.toFixed(2)} | GST (5%): ₹{estimatedGst.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Payable</div>
            <div className="text-xl font-bold text-gray-900">₹{grandTotal.toFixed(2)}</div>
          </div>
          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={submitting || totalItemsCount === 0}
            className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" /> Confirm & Submit Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
