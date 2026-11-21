import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Package, Search, Plus, Edit2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const PackagingMaterialsPage: React.FC = () => {
  const [packaging, setPackaging] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals & Alerts
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    uom: 'pieces',
    openingStock: 0,
    purchasePrice: 0,
  });

  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'PRODUCTION_SUPERVISOR';

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.get('/master/packaging-materials');
      setPackaging(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load packaging materials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await api.post('/master/packaging-materials', {
        ...formData,
        openingStock: Number(formData.openingStock),
        purchasePrice: Number(formData.purchasePrice),
      });
      setSuccessMsg('Packaging item registered and stock ledger initialized');
      setIsCreateOpen(false);
      setFormData({
        code: '',
        name: '',
        uom: 'pieces',
        openingStock: 0,
        purchasePrice: 0,
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create packaging material');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMsg(null);
    try {
      await api.put(`/master/packaging-materials/${editingItem.id}`, {
        name: formData.name,
        uom: formData.uom,
        purchasePrice: Number(formData.purchasePrice),
      });
      setSuccessMsg('Packaging item updated successfully');
      setEditingItem(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update packaging material');
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Are you sure you want to delete packaging item ${item.name}?`)) return;
    setErrorMsg(null);
    try {
      await api.delete(`/master/packaging-materials/${item.id}`);
      setSuccessMsg(`Packaging item ${item.name} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete packaging material');
    }
  };

  const filtered = packaging.filter((pkg) => {
    return (
      pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.code.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Packaging Materials Inventory</h1>
          <p className="text-sm text-gray-500">
            Pouches, corrugated cartons and packing consumables tracking
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setFormData({
                code: '',
                name: '',
                uom: 'pieces',
                openingStock: 0,
                purchasePrice: 0,
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Packaging Material
          </button>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900 font-bold">×</button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search packaging by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Packaging Code</th>
                <th className="p-3">Item Description</th>
                <th className="p-3">Opening Stock</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Unit Purchase Rate</th>
                <th className="p-3">Stock Valuation</th>
                {canEdit && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="p-8 text-center text-gray-400">Loading packaging materials...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="p-8 text-center text-gray-400">No packaging materials registered.</td>
                </tr>
              ) : (
                filtered.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{pkg.code}</td>
                    <td className="p-3 font-semibold text-gray-800">{pkg.name}</td>
                    <td className="p-3">{Number(pkg.openingStock)} {pkg.uom}</td>
                    <td className="p-3 font-bold text-gray-900 text-sm">
                      {pkg.currentStock !== undefined ? `${pkg.currentStock} ${pkg.uom}` : '—'}
                    </td>
                    <td className="p-3">₹{Number(pkg.purchasePrice).toFixed(2)}</td>
                    <td className="p-3 font-bold text-brand-700">₹{(pkg.stockValue || 0).toLocaleString('en-IN')}</td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingItem(pkg);
                              setFormData({
                                code: pkg.code,
                                name: pkg.name,
                                uom: pkg.uom,
                                openingStock: Number(pkg.openingStock),
                                purchasePrice: Number(pkg.purchasePrice),
                              });
                            }}
                            className="p-1 rounded text-gray-500 hover:text-brand-600 hover:bg-gray-100"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(pkg)}
                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(isCreateOpen || editingItem) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-gray-900">
                {editingItem ? `Edit Packaging: ${editingItem.code}` : 'Register New Packaging Material'}
              </h3>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingItem(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={editingItem ? handleUpdate : handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100"
                    placeholder="PM-POUCH-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit of Measure</label>
                  <select
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="pieces">pieces</option>
                    <option value="cartons">cartons</option>
                    <option value="packets">packets</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Description</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g. 200g Printed Nitrogen Pouch"
                />
              </div>

              {!editingItem && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Opening Stock Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.openingStock}
                    onChange={(e) => setFormData({ ...formData, openingStock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Automatically logs to StockLedger and initializes FIFO layer</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Purchase Rate per Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
                >
                  {editingItem ? 'Save Changes' : 'Create Packaging Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
