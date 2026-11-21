import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Package, Search, Plus, Edit2, Trash2, AlertCircle, CheckCircle2, Calculator, Layers, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { UOMConverterModal } from '../../components/common/UOMConverterModal.js';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('true');
  const [uomModalOpen, setUomModalOpen] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    categoryId: '',
    packSize: '200 g',
    unit: 'packets',
    sellingPrice: 50.0,
    gstRate: 5.0,
    hsnCode: '1905',
    reorderLevel: 100,
  });

  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        api.get('/master/products', { active: filterActive === 'all' ? 'all' : undefined }),
        api.get('/master/categories'),
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterActive]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await api.post('/master/products', formData);
      setSuccessMsg('Product created successfully');
      setIsCreateOpen(false);
      setFormData({
        sku: '',
        name: '',
        categoryId: categories[0]?.id || '',
        packSize: '200 g',
        unit: 'packets',
        sellingPrice: 50.0,
        gstRate: 5.0,
        hsnCode: '1905',
        reorderLevel: 100,
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create product');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setErrorMsg(null);
    try {
      await api.put(`/master/products/${editingProduct.id}`, {
        name: formData.name,
        categoryId: formData.categoryId,
        packSize: formData.packSize,
        unit: formData.unit,
        sellingPrice: Number(formData.sellingPrice),
        gstRate: Number(formData.gstRate),
        hsnCode: formData.hsnCode,
        reorderLevel: Number(formData.reorderLevel),
      });
      setSuccessMsg('Product updated successfully');
      setEditingProduct(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (product: any) => {
    if (!window.confirm(`Are you sure you want to delete ${product.name}?`)) return;
    setErrorMsg(null);
    try {
      await api.delete(`/master/products/${product.id}`);
      setSuccessMsg(`Product ${product.name} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete product');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('/master/categories', { name: newCatName, description: newCatDesc });
      setNewCatName('');
      setNewCatDesc('');
      setIsCategoryModalOpen(false);
      setSuccessMsg('Category created successfully');
      const cats = await api.get('/master/categories');
      setCategories(cats || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category');
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.hsnCode.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCategory || p.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Product Catalogue & Price List</h1>
          <p className="text-sm text-gray-500">
            Finished food packaged goods, HSN codes, statutory GST rates and standard wholesale selling prices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUomModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-gray-500" /> UOM Converter
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-gray-500" /> Categories
              </button>
              <button
                onClick={() => {
                  setFormData({
                    sku: '',
                    name: '',
                    categoryId: categories[0]?.id || '',
                    packSize: '200 g',
                    unit: 'packets',
                    sellingPrice: 50.0,
                    gstRate: 5.0,
                    hsnCode: '1905',
                    reorderLevel: 100,
                  });
                  setIsCreateOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </>
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

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU or HSN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
          >
            <option value="true">Active Only</option>
            <option value="all">All Products</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Pack Size</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Selling Price (Excl. Tax)</th>
                <th className="p-3">HSN Code</th>
                <th className="p-3">GST Rate</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Status</th>
                {canEdit && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 12 : 11} className="p-8 text-center text-gray-400">Loading products...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 12 : 11} className="p-8 text-center text-gray-400">No products found.</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{p.sku}</td>
                    <td className="p-3 font-semibold text-gray-900 text-sm">{p.name}</td>
                    <td className="p-3 text-gray-600">{p.category?.name || 'General'}</td>
                    <td className="p-3 font-medium text-gray-700">{p.packSize}</td>
                    <td className="p-3">{p.unit}</td>
                    <td className="p-3 font-bold text-brand-700 text-sm">
                      ₹{Number(p.sellingPrice).toFixed(2)}
                    </td>
                    <td className="p-3 font-semibold text-gray-800">{p.hsnCode}</td>
                    <td className="p-3 font-medium text-gray-700">{Number(p.gstRate)}%</td>
                    <td className="p-3 font-bold text-gray-900">
                      {p.currentStock !== undefined ? `${p.currentStock} ${p.unit}` : '—'}
                    </td>
                    <td className="p-3">{Number(p.reorderLevel)} pkts</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setFormData({
                                sku: p.sku,
                                name: p.name,
                                categoryId: p.categoryId || '',
                                packSize: p.packSize,
                                unit: p.unit,
                                sellingPrice: Number(p.sellingPrice),
                                gstRate: Number(p.gstRate),
                                hsnCode: p.hsnCode,
                                reorderLevel: Number(p.reorderLevel),
                              });
                            }}
                            className="p-1 rounded text-gray-500 hover:text-brand-600 hover:bg-gray-100"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100"
                            title="Delete Product"
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

      {/* Create / Edit Product Modal */}
      {(isCreateOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-gray-900">
                {editingProduct ? `Edit Product: ${editingProduct.sku}` : 'Register New Finished Product'}
              </h3>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100"
                    placeholder="e.g. MRK-200G"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g. Traditional Murukku 200 g"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pack Size</label>
                  <input
                    type="text"
                    required
                    value={formData.packSize}
                    onChange={(e) => setFormData({ ...formData, packSize: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="e.g. 200 g, 500 g, 1 kg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Unit of Inventory</label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="packets"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Wholesale Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.gstRate}
                    onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    required
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reorder Level (Alert Threshold)</label>
                <input
                  type="number"
                  required
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-gray-900">Manage Product Categories</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="p-5 space-y-4">
              <form onSubmit={handleCreateCategory} className="space-y-3 pb-4 border-b border-gray-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Add New Category</label>
                <input
                  type="text"
                  required
                  placeholder="Category Name (e.g. Traditional Sweets)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="text"
                  placeholder="Description (Optional)"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Save Category
                </button>
              </form>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Existing Categories</label>
                <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {categories.map((c) => (
                    <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-gray-800">{c.name}</div>
                        <div className="text-[11px] text-gray-400">{c.description || 'No description'}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium">
                        {c._count?.products || 0} products
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UOM Converter Modal */}
      <UOMConverterModal isOpen={uomModalOpen} onClose={() => setUomModalOpen(false)} />
    </div>
  );
};
