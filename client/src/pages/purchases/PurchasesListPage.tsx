import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Archive, PlusCircle, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const PurchasesListPage: React.FC = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedRM, setSelectedRM] = useState('');
  const [qty, setQty] = useState(60);
  const [rate, setRate] = useState(45);
  const [notes, setNotes] = useState('Benchmark procurement: 60 kg flour at ₹45/kg');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/purchases'),
      api.get('/master/suppliers'),
      api.get('/master/raw-materials'),
    ])
      .then(([pData, sData, rmData]) => {
        setPurchases(pData);
        setSuppliers(sData);
        setRawMaterials(rmData);
        if (sData.length > 0) setSelectedSupplier(sData[0].id);
        if (rmData.length > 0) setSelectedRM(rmData[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      const rm = rawMaterials.find((r) => r.id === selectedRM);
      await api.post('/purchases', {
        supplierId: selectedSupplier,
        items: [
          {
            itemType: 'RAW_MATERIAL',
            rawMaterialId: selectedRM,
            quantity: Number(qty),
            unit: rm ? rm.uom : 'kg',
            unitPrice: Number(rate),
            gstRate: 5.0,
          },
        ],
        notes,
      });

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to record purchase receipt.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Material Purchases & Receipts</h1>
          <p className="text-sm text-gray-500">
            Supplier procurement receipts, stock additions & FIFO inventory valuation layer creation
          </p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'PRODUCTION_SUPERVISOR' || user?.role === 'OWNER') && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Record Purchase Receipt
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">PO Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Purchased Items</th>
                <th className="p-3">Taxable Value</th>
                <th className="p-3">GST (5%)</th>
                <th className="p-3">Grand Total</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">Loading purchases...</td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">No purchases recorded yet.</td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{p.purchaseNumber}</td>
                    <td className="p-3 text-gray-500">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                    <td className="p-3 font-semibold text-gray-900">{p.supplier?.name}</td>
                    <td className="p-3 font-medium text-brand-700">
                      {p.items?.map((it: any) => `${it.rawMaterial?.name || it.packagingMaterial?.name}: ${Number(it.quantity)} ${it.unit} @ ₹${Number(it.unitPrice)}`).join(', ')}
                    </td>
                    <td className="p-3">₹{Number(p.totalTaxable).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-emerald-700">₹{Number(p.totalGst).toLocaleString('en-IN')}</td>
                    <td className="p-3 font-bold text-gray-900">₹{Number(p.grandTotal).toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{p.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreatePurchase} className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Record Material Purchase Receipt</h3>
            <p className="text-xs text-gray-500">
              Receipt increases inventory in the StockLedger and creates a new FIFO valuation layer.
            </p>
            {error && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
                required
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.address})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Raw Material</label>
              <select
                value={selectedRM}
                onChange={(e) => setSelectedRM(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
                required
              >
                {rawMaterials.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.name} [{rm.code}]
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full text-xs border border-gray-300 rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Rate (₹)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full text-xs border border-gray-300 rounded p-2"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow disabled:opacity-50"
              >
                Confirm Receipt
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
