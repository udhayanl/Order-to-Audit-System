import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Layers, Plus, Edit2, Trash2, Search, AlertCircle, CheckCircle2, Calculator } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { UOMConverterModal } from '../../components/common/UOMConverterModal.js';

export const BOMListPage: React.FC = () => {
  const [boms, setBoms] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [uomModalOpen, setUomModalOpen] = useState(false);

  // Modals & Alerts
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBOM, setEditingBOM] = useState<any | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    productId: '',
    name: '',
    version: 'v1.0',
    batchSize: 200,
    batchUnit: 'packets',
    expectedYield: 200,
    yieldUnit: 'packets',
    notes: '',
    items: [
      { itemType: 'RAW_MATERIAL', rawMaterialId: '', packagingMaterialId: '', standardQuantity: 40, unit: 'kg' },
      { itemType: 'RAW_MATERIAL', rawMaterialId: '', packagingMaterialId: '', standardQuantity: 10, unit: 'litre' },
      { itemType: 'PACKAGING', rawMaterialId: '', packagingMaterialId: '', standardQuantity: 200, unit: 'pieces' },
    ],
  });

  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'PRODUCTION_SUPERVISOR';

  const loadData = async () => {
    try {
      setLoading(true);
      const [bData, pData, rmData, pmData] = await Promise.all([
        api.get('/master/boms', { active: 'all' }),
        api.get('/master/products'),
        api.get('/master/raw-materials'),
        api.get('/master/packaging-materials'),
      ]);
      setBoms(bData || []);
      setProducts(pData || []);
      setRawMaterials(rmData || []);
      setPackagingMaterials(pmData || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load BOM recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItemRow = (type: 'RAW_MATERIAL' | 'PACKAGING') => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          itemType: type,
          rawMaterialId: type === 'RAW_MATERIAL' ? (rawMaterials[0]?.id || '') : '',
          packagingMaterialId: type === 'PACKAGING' ? (packagingMaterials[0]?.id || '') : '',
          standardQuantity: 1,
          unit: type === 'RAW_MATERIAL' ? 'kg' : 'pieces',
        },
      ],
    });
  };

  const handleRemoveItemRow = (index: number) => {
    if (formData.items.length <= 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...formData.items];
    (updated[index] as any)[field] = value;
    if (field === 'rawMaterialId' && updated[index].itemType === 'RAW_MATERIAL') {
      const rm = rawMaterials.find((m) => m.id === value);
      if (rm) updated[index].unit = rm.uom;
    }
    if (field === 'packagingMaterialId' && updated[index].itemType === 'PACKAGING') {
      const pm = packagingMaterials.find((m) => m.id === value);
      if (pm) updated[index].unit = pm.uom;
    }
    setFormData({ ...formData, items: updated });
  };

  const handleCreateBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (!formData.productId) throw new Error('Please select a finished product');
      await api.post('/master/boms', {
        ...formData,
        batchSize: Number(formData.batchSize),
        expectedYield: Number(formData.expectedYield),
      });
      setSuccessMsg('BOM recipe created successfully');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create BOM');
    }
  };

  const handleUpdateBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBOM) return;
    setErrorMsg(null);
    try {
      await api.put(`/master/boms/${editingBOM.id}`, {
        name: formData.name,
        version: formData.version,
        batchSize: Number(formData.batchSize),
        batchUnit: formData.batchUnit,
        expectedYield: Number(formData.expectedYield),
        yieldUnit: formData.yieldUnit,
        notes: formData.notes,
        items: formData.items,
      });
      setSuccessMsg('BOM recipe updated successfully');
      setEditingBOM(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update BOM');
    }
  };

  const handleDeleteBOM = async (bom: any) => {
    if (!window.confirm(`Are you sure you want to delete BOM ${bom.name}?`)) return;
    setErrorMsg(null);
    try {
      await api.delete(`/master/boms/${bom.id}`);
      setSuccessMsg(`BOM ${bom.name} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete BOM');
    }
  };

  const filtered = boms.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.product && b.product.name.toLowerCase().includes(search.toLowerCase())) ||
      b.version.toLowerCase().includes(search.toLowerCase());
    const matchesProd = !selectedProduct || b.productId === selectedProduct;
    return matchesSearch && matchesProd;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bill of Materials (BOM)</h1>
          <p className="text-sm text-gray-500">
            Standard recipes defining raw materials, packaging materials and expected finished goods yield
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
                  productId: products[0]?.id || '',
                  name: `${products[0]?.name || 'Standard'} Recipe`,
                  version: 'v1.0',
                  batchSize: 200,
                  batchUnit: 'packets',
                  expectedYield: 200,
                  yieldUnit: 'packets',
                  notes: '',
                  items: [
                    { itemType: 'RAW_MATERIAL', rawMaterialId: rawMaterials[0]?.id || '', packagingMaterialId: '', standardQuantity: 40, unit: rawMaterials[0]?.uom || 'kg' },
                    { itemType: 'PACKAGING', rawMaterialId: '', packagingMaterialId: packagingMaterials[0]?.id || '', standardQuantity: 200, unit: packagingMaterials[0]?.uom || 'pieces' },
                  ],
                });
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Create New BOM
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

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search BOM by recipe or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full"
          />
        </div>

        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white w-full sm:w-auto"
        >
          <option value="">All Finished Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.packSize})</option>
          ))}
        </select>
      </div>

      {/* BOM Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            Loading BOM formulations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No BOM formulations registered.
          </div>
        ) : (
          filtered.map((bom) => (
            <div key={bom.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">{bom.name}</h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                      {bom.version}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${bom.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                      {bom.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Product: <strong className="text-gray-900">{bom.product?.name}</strong> ({bom.product?.packSize})
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Expected Batch Yield</div>
                    <div className="text-sm font-bold text-brand-700">
                      {Number(bom.expectedYield)} {bom.yieldUnit} per {Number(bom.batchSize)} {bom.batchUnit}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                      <button
                        onClick={() => {
                          setEditingBOM(bom);
                          setFormData({
                            productId: bom.productId,
                            name: bom.name,
                            version: bom.version,
                            batchSize: Number(bom.batchSize),
                            batchUnit: bom.batchUnit,
                            expectedYield: Number(bom.expectedYield),
                            yieldUnit: bom.yieldUnit,
                            notes: bom.notes || '',
                            items: bom.items.map((it: any) => ({
                              itemType: it.itemType,
                              rawMaterialId: it.rawMaterialId || '',
                              packagingMaterialId: it.packagingMaterialId || '',
                              standardQuantity: Number(it.standardQuantity),
                              unit: it.unit,
                            })),
                          });
                        }}
                        className="p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-gray-100"
                        title="Edit BOM"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBOM(bom)}
                        className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100"
                        title="Delete BOM"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="p-2.5">Item Classification</th>
                      <th className="p-2.5">Material Name</th>
                      <th className="p-2.5">Standard Quantity</th>
                      <th className="p-2.5">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bom.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-2.5 font-medium text-gray-500">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.itemType === 'RAW_MATERIAL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.itemType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold text-gray-900">
                          {item.rawMaterial?.name || item.packagingMaterial?.name || '—'}
                        </td>
                        <td className="p-2.5 font-bold text-gray-900">{Number(item.standardQuantity)}</td>
                        <td className="p-2.5">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {bom.notes && (
                <div className="text-[11px] text-gray-500 italic bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  Notes: {bom.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create / Edit BOM Modal */}
      {(isCreateOpen || editingBOM) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-bold text-sm text-gray-900">
                {editingBOM ? `Edit BOM: ${editingBOM.name}` : 'Formulate New Bill of Materials (BOM)'}
              </h3>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingBOM(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={editingBOM ? handleUpdateBOM : handleCreateBOM} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Product</label>
                  <select
                    disabled={!!editingBOM}
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white disabled:bg-gray-100"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.packSize})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Recipe Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="e.g. Murukku 200g Standard Batch"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Recipe Version</label>
                  <input
                    type="text"
                    required
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="v1.0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Standard Batch Size</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.batchSize}
                    onChange={(e) => setFormData({ ...formData, batchSize: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expected Yield</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.expectedYield}
                    onChange={(e) => setFormData({ ...formData, expectedYield: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Recipe Items Section */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Recipe Ingredients & Packaging Requirements
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddItemRow('RAW_MATERIAL')}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                    >
                      + Add Raw Material
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddItemRow('PACKAGING')}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
                    >
                      + Add Packaging
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${item.itemType === 'RAW_MATERIAL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {item.itemType === 'RAW_MATERIAL' ? 'Raw Mat' : 'Packing'}
                      </span>

                      {item.itemType === 'RAW_MATERIAL' ? (
                        <select
                          value={item.rawMaterialId}
                          onChange={(e) => handleItemChange(idx, 'rawMaterialId', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                        >
                          <option value="">Select Raw Material</option>
                          {rawMaterials.map((rm) => (
                            <option key={rm.id} value={rm.id}>{rm.name} ({rm.uom})</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={item.packagingMaterialId}
                          onChange={(e) => handleItemChange(idx, 'packagingMaterialId', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                        >
                          <option value="">Select Packaging Material</option>
                          {packagingMaterials.map((pm) => (
                            <option key={pm.id} value={pm.id}>{pm.name} ({pm.uom})</option>
                          ))}
                        </select>
                      )}

                      <div className="w-24">
                        <input
                          type="number"
                          step="any"
                          required
                          value={item.standardQuantity}
                          onChange={(e) => handleItemChange(idx, 'standardQuantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-right"
                          placeholder="Qty"
                        />
                      </div>

                      <div className="w-16 font-semibold text-gray-600 px-1">
                        {item.unit}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Process / Recipe Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="Mixing instructions, frying temperature, cooling guidelines"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingBOM(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
                >
                  {editingBOM ? 'Save BOM' : 'Create BOM Recipe'}
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
