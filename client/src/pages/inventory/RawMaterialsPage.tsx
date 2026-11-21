import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Archive, AlertTriangle, CheckCircle2, Plus, Edit2, Trash2, Search, Calculator, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { UOMConverterModal } from '../../components/common/UOMConverterModal.js';

export const RawMaterialsPage: React.FC = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uomModalOpen, setUomModalOpen] = useState(false);

  // Modals & Alerts
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    uom: 'kg',
    openingStock: 0,
    reorderLevel: 10,
    purchasePrice: 0,
  });

  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'PRODUCTION_SUPERVISOR';

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.get('/master/raw-materials');
      setMaterials(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load raw materials');
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
      await api.post('/master/raw-materials', {
        ...formData,
        openingStock: Number(formData.openingStock),
        reorderLevel: Number(formData.reorderLevel),
        purchasePrice: Number(formData.purchasePrice),
      });
      setSuccessMsg('Raw material registered and stock ledger initialized');
      setIsCreateOpen(false);
      setFormData({
        code: '',
        name: '',
        uom: 'kg',
        openingStock: 0,
        reorderLevel: 10,
        purchasePrice: 0,
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create raw material');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMsg(null);
    try {
      await api.put(`/master/raw-materials/${editingItem.id}`, {
        name: formData.name,
        uom: formData.uom,
        reorderLevel: Number(formData.reorderLevel),
        purchasePrice: Number(formData.purchasePrice),
      });
      setSuccessMsg('Raw material updated successfully');
      setEditingItem(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update raw material');
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Are you sure you want to delete raw material ${item.name}?`)) return;
    setErrorMsg(null);
    try {
      await api.delete(`/master/raw-materials/${item.id}`);
      setSuccessMsg(`Raw material ${item.name} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete raw material');
    }
  };

  const filtered = materials.filter((rm) => {
    return (
      rm.name.toLowerCase().includes(search.toLowerCase()) ||
      rm.code.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Raw Materials Inventory</h1>
          <p className="text-sm text-gray-500">
            Live stock balances reconciled against the immutable StockLedger with reorder level alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUomModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-gray-500" /> UOM Calculator
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setFormData({
                  code: '',
                  name: '',
                  uom: 'kg',
                  openingStock: 0,
                  reorderLevel: 10,
                  purchasePrice: 0,
                });
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Raw Material
            </button>
          )}
        </div>
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
            placeholder="Search raw materials by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full"
          />
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Material Code</th>
                <th className="p-3">Material Name</th>
                <th className="p-3">Opening Stock</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Purchase Rate</th>
                <th className="p-3">Inventory Valuation</th>
                <th className="p-3">Stock Health</th>
                {canEdit && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-gray-400">Loading raw materials...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-gray-400">No raw materials registered.</td>
                </tr>
              ) : (
                filtered.map((rm) => (
                  <tr key={rm.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{rm.code}</td>
                    <td className="p-3 font-semibold text-gray-800">{rm.name}</td>
                    <td className="p-3">{Number(rm.openingStock)} {rm.uom}</td>
                    <td className="p-3 font-bold text-gray-900 text-sm">
                      {rm.currentStock !== undefined ? `${rm.currentStock} ${rm.uom}` : '—'}
                    </td>
                    <td className="p-3 text-gray-500">{Number(rm.reorderLevel)} {rm.uom}</td>
                    <td className="p-3">₹{Number(rm.purchasePrice).toFixed(2)}</td>
                    <td className="p-3 font-bold text-brand-700">₹{(rm.stockValue || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      {rm.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Reorder Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingItem(rm);
                              setFormData({
                                code: rm.code,
                                name: rm.name,
                                uom: rm.uom,
                                openingStock: Number(rm.openingStock),
                                reorderLevel: Number(rm.reorderLevel),
                                purchasePrice: Number(rm.purchasePrice),
                              });
                            }}
                            className="p-1 rounded text-gray-500 hover:text-brand-600 hover:bg-gray-100"
                            title="Edit Material"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rm)}
                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100"
                            title="Delete Material"
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
                {editingItem ? `Edit Material: ${editingItem.code}` : 'Register New Raw Material'}
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
                    placeholder="RM-FLOUR-01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit of Measure</label>
                  <select
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="litre">litre (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Material Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g. Refined Cooking Oil"
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
                  <p className="text-[10px] text-gray-400 mt-1">Automatically logs to StockLedger and creates FIFO valuation layer</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Purchase Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
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
                  {editingItem ? 'Save Changes' : 'Create Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UOM Converter Modal */}
      <UOMConverterModal isOpen={uomModalOpen} onClose={() => setUomModalOpen(false)} />
    </div>
  );
};
