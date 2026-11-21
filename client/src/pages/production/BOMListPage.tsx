import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Layers, Plus, ChevronRight } from 'lucide-react';

export const BOMListPage: React.FC = () => {
  const [boms, setBoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/master/boms')
      .then(setBoms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bill of Materials (BOM)</h1>
          <p className="text-sm text-gray-500">
            Standard recipes defining raw materials, packaging materials and expected finished goods yield
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading BOM recipes...</div>
        ) : (
          boms.map((bom) => (
            <div key={bom.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">{bom.name}</h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                      {bom.version}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Product: <strong className="text-gray-900">{bom.product?.name}</strong> ({bom.product?.packSize})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Batch Yield</div>
                  <div className="text-sm font-bold text-brand-700">
                    {Number(bom.expectedYield)} {bom.yieldUnit} per {Number(bom.batchSize)} {bom.batchUnit} batch
                  </div>
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
                        <td className="p-2.5 font-medium text-gray-500">{item.itemType}</td>
                        <td className="p-2.5 font-semibold text-gray-900">
                          {item.rawMaterial?.name || item.packagingMaterial?.name}
                        </td>
                        <td className="p-2.5 font-bold text-gray-900">{Number(item.standardQuantity)}</td>
                        <td className="p-2.5">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
