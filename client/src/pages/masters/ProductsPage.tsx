import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Package, Search } from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/master/products')
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Product Catalogue & Price List</h1>
        <p className="text-sm text-gray-500">
          Finished food packaged goods, HSN codes, statutory GST rates and standard wholesale selling prices
        </p>
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">Loading products...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">No products found.</td>
                </tr>
              ) : (
                products.map((p) => (
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
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
