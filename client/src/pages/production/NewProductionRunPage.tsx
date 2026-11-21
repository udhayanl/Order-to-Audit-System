import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { ArrowLeft, Layers, AlertTriangle, CheckCircle, Calculator } from 'lucide-react';

export const NewProductionRunPage: React.FC = () => {
  const [boms, setBoms] = useState<any[]>([]);
  const [selectedBomId, setSelectedBomId] = useState('');
  const [plannedBatchQty, setPlannedBatchQty] = useState(200);
  const [expectedOutput, setExpectedOutput] = useState(200);
  const [actualGoodOutput, setActualGoodOutput] = useState(188);
  const [damagedPouches, setDamagedPouches] = useState(6);
  const [cartonsUsed, setCartonsUsed] = useState(9);
  const [labourCost, setLabourCost] = useState(1200);
  const [powerCost, setPowerCost] = useState(600);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/master/boms').then((data) => {
      setBoms(data);
      if (data.length > 0) {
        setSelectedBomId(data[0].id);
      }
    });
  }, []);

  // When BOM or plannedBatchQty changes, fetch planned calculations
  useEffect(() => {
    if (!selectedBomId) return;
    api.post('/production/calculate-planned', {
      bomId: selectedBomId,
      plannedBatchQuantity: plannedBatchQty,
    }).then((res) => {
      setExpectedOutput(res.expectedYield);

      // Pre-fill default actual quantities matching planned or benchmark
      const items = res.plannedItems.map((it: any) => {
        let actual = it.plannedQuantity;
        if (it.name.includes('Oil')) actual = 10.5; // Benchmark scenario
        if (it.name.includes('Pouch')) actual = 194; // 188 good + 6 damaged
        if (it.name.includes('Carton')) actual = 9;   // 9 cartons used
        return {
          ...it,
          actualQuantity: actual,
        };
      });
      setConsumptions(items);
    }).catch(console.error);
  }, [selectedBomId, plannedBatchQty]);

  const handleActualQtyChange = (idx: number, val: number) => {
    const updated = [...consumptions];
    updated[idx].actualQuantity = val;
    setConsumptions(updated);
  };

  // Yield variance calculation
  const yieldDiff = actualGoodOutput - expectedOutput;
  const yieldVariancePercent = expectedOutput > 0
    ? Math.round(((yieldDiff / expectedOutput) * 100) * 100) / 100
    : 0;
  const yieldExceeds = Math.abs(yieldVariancePercent) > 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        bomId: selectedBomId,
        plannedBatchQuantity: Number(plannedBatchQty),
        actualGoodOutput: Number(actualGoodOutput),
        damagedPouches: Number(damagedPouches),
        cartonsUsed: Number(cartonsUsed),
        labourCost: Number(labourCost),
        powerCost: Number(powerCost),
        otherOverheads: 0,
        consumptions: consumptions.map((c) => ({
          itemType: c.itemType,
          rawMaterialId: c.rawMaterialId,
          packagingMaterialId: c.packagingMaterialId,
          plannedQuantity: Number(c.plannedQuantity),
          actualQuantity: Number(c.actualQuantity),
          unit: c.unit,
        })),
        notes: `Batch run for ${plannedBatchQty} pkts`,
      };

      await api.post('/production/runs', payload);
      navigate('/production/runs');
    } catch (err: any) {
      setError(err.message || 'Production run posting failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/production/runs')}
          className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Record Production Batch Run</h1>
          <p className="text-xs text-gray-500">
            Issue materials from FIFO inventory, track yield variance & packaging scrap, post finished goods
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Recipe & Batch Size */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            1. Select Recipe & Planned Batch Size
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Bill of Materials (BOM)</label>
              <select
                value={selectedBomId}
                onChange={(e) => setSelectedBomId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2.5 bg-white"
                required
              >
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.product?.name}) – Batch: {Number(b.batchSize)} {b.batchUnit}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Planned Batch Quantity (packets)
              </label>
              <input
                type="number"
                min="1"
                value={plannedBatchQty}
                onChange={(e) => setPlannedBatchQty(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2.5 bg-white"
                required
              />
            </div>
          </div>
        </div>

        {/* 2. Material Consumption Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              2. Material Consumption & Variance (Raw & Packaging)
            </h2>
            <span className="text-[11px] text-gray-400">Tolerance configured: ±3%</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="p-3">Material Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Standard / Batch</th>
                  <th className="p-3">Planned Qty</th>
                  <th className="p-3">Actual Consumed</th>
                  <th className="p-3">Variance %</th>
                  <th className="p-3">Tolerance Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consumptions.map((c, idx) => {
                  const planned = Number(c.plannedQuantity);
                  const actual = Number(c.actualQuantity);
                  const diff = actual - planned;
                  const variancePercent = planned > 0 ? Math.round(((diff / planned) * 100) * 100) / 100 : 0;
                  const exceeds = Math.abs(variancePercent) > 3;

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-900">{c.name}</td>
                      <td className="p-3 text-gray-500">{c.itemType}</td>
                      <td className="p-3">{c.standardQuantity} {c.unit}</td>
                      <td className="p-3 font-medium">{planned} {c.unit}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={actual}
                          onChange={(e) => handleActualQtyChange(idx, Number(e.target.value))}
                          className="w-28 text-xs border border-gray-300 rounded p-1.5 font-bold text-gray-900 bg-white"
                          required
                        />
                      </td>
                      <td className="p-3">
                        <span className={`font-bold ${variancePercent > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                          {variancePercent > 0 ? `+${variancePercent}` : variancePercent}%
                        </span>
                      </td>
                      <td className="p-3">
                        {exceeds ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Exceeds 3%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Output, Packaging Scrap & Overheads */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            3. Actual Production Output & Manufacturing Overheads
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Expected Output (packets)
              </label>
              <input
                type="number"
                disabled
                value={expectedOutput}
                className="w-full text-xs border border-gray-200 rounded p-2.5 bg-gray-50 text-gray-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Actual Good Output (packets)
              </label>
              <input
                type="number"
                min="1"
                value={actualGoodOutput}
                onChange={(e) => setActualGoodOutput(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2.5 bg-white font-bold text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Yield Variance (%)
              </label>
              <div
                className={`p-2.5 rounded border text-xs font-bold flex items-center justify-between ${
                  yieldExceeds
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <span>{yieldVariancePercent}%</span>
                <span>{yieldExceeds ? 'Alert: >3%' : 'Acceptable'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Damaged Pouches (pcs)</label>
              <input
                type="number"
                min="0"
                value={damagedPouches}
                onChange={(e) => setDamagedPouches(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cartons Used (pcs)</label>
              <input
                type="number"
                min="0"
                value={cartonsUsed}
                onChange={(e) => setCartonsUsed(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Labour Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={labourCost}
                onChange={(e) => setLabourCost(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Power / Gas Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={powerCost}
                onChange={(e) => setPowerCost(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2.5"
                required
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Posting Production Run to Ledger...' : 'Post Production Run (Atomically Update Inventory)'}
          <CheckCircle className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
