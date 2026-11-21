import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { Plus, Trash2, ArrowLeft, ShoppingCart, Check } from 'lucide-react';

export const NewOrderPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: '', quantity: 150 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/master/customers'), api.get('/master/products')])
      .then(([custData, prodData]) => {
        setCustomers(custData);
        setProducts(prodData);
        if (custData.length > 0) setSelectedCustomer(custData[0].id);
        if (prodData.length > 0) setItems([{ productId: prodData[0].id, quantity: 150 }]);
      })
      .catch(console.error);
  }, []);

  const handleAddItem = () => {
    if (products.length > 0) {
      setItems([...items, { productId: products[0].id, quantity: 10 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  // Calculations
  const calculatedItems = items.map((it) => {
    const prod = products.find((p) => p.id === it.productId);
    const price = prod ? Number(prod.sellingPrice) : 0;
    const gstRate = prod ? Number(prod.gstRate) : 5.0;
    const taxable = Math.round(it.quantity * price * 100) / 100;
    const gst = Math.round((taxable * (gstRate / 100)) * 100) / 100;
    const total = Math.round((taxable + gst) * 100) / 100;
    return { ...it, price, gstRate, taxable, gst, total, product: prod };
  });

  const subtotal = calculatedItems.reduce((sum, it) => sum + it.taxable, 0);
  const estimatedGst = calculatedItems.reduce((sum, it) => sum + it.gst, 0);
  const grandTotal = Math.round((subtotal + estimatedGst) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedCustomer) {
      setError('Please select a customer.');
      return;
    }
    if (items.some((it) => it.quantity <= 0)) {
      setError('Item quantities must be greater than zero.');
      return;
    }

    setLoading(true);
    try {
      const order = await api.post('/orders', {
        customerId: selectedCustomer,
        orderNotes,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
        })),
      });

      navigate(`/orders/${order.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/orders')}
          className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Customer Order</h1>
          <p className="text-xs text-gray-500">Capture field orders with automatic price list lookup & GST</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Customer Select */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Customer Details</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Select Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-brand-500"
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type}) – {c.state} [{c.gstin || 'Unregistered'}]
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Order Items</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => {
              const calc = calculatedItems[idx];
              return (
                <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Product</label>
                    <select
                      value={it.productId}
                      onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                      required
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.packSize}) – ₹{Number(p.sellingPrice).toFixed(2)}/pkt
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-32">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Quantity (pkts)</label>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                      className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                      required
                    />
                  </div>

                  <div className="w-full sm:w-28 text-right">
                    <span className="text-[11px] text-gray-500 block">Rate</span>
                    <span className="text-xs font-bold text-gray-900">₹{calc?.price?.toFixed(2)}</span>
                  </div>

                  <div className="w-full sm:w-32 text-right">
                    <span className="text-[11px] text-gray-500 block">Total (+5% GST)</span>
                    <span className="text-xs font-bold text-brand-700">₹{calc?.total?.toFixed(2)}</span>
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals Summary */}
          <div className="pt-4 border-t border-gray-100 flex flex-col items-end space-y-1 text-xs">
            <div className="flex justify-between w-64 text-gray-600">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-64 text-gray-600">
              <span>Estimated GST (5%):</span>
              <span className="font-semibold">₹{estimatedGst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between w-64 text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Grand Total:</span>
              <span className="text-brand-600">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Submit */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <label className="block text-xs font-semibold text-gray-700">Optional Order Notes</label>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Special delivery instructions, preferred transport..."
            rows={2}
            className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-brand-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Submitting Order...' : 'Submit Order to Factory Admin'}
            <Check className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
