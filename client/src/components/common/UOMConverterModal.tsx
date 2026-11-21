import React, { useState } from 'react';
import api from '../../api/client.js';
import { Calculator, ArrowRightLeft, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface UOMConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UOMConverterModal: React.FC<UOMConverterModalProps> = ({ isOpen, onClose }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [fromUnit, setFromUnit] = useState<string>('kg');
  const [toUnit, setToUnit] = useState<string>('g');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/master/uom/convert', {
        quantity: Number(quantity),
        fromUnit,
        toUnit,
      });
      setResult(res.convertedQuantity);
    } catch (err: any) {
      setError(err.message || 'Incompatible unit conversion');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const units = [
    { code: 'kg', label: 'Kilograms (kg)', category: 'Weight' },
    { code: 'g', label: 'Grams (g)', category: 'Weight' },
    { code: 'litre', label: 'Litres (L)', category: 'Volume' },
    { code: 'ml', label: 'Millilitres (ml)', category: 'Volume' },
    { code: 'pieces', label: 'Pieces (pcs)', category: 'Count' },
    { code: 'packets', label: 'Packets (pkts)', category: 'Count' },
    { code: 'cartons', label: 'Cartons (ctn)', category: 'Count' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="p-2 bg-brand-100 text-brand-700 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Unit Conversion Calculator</h3>
              <p className="text-[11px] text-gray-500">Standard factory recipe & packaging conversion engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConvert} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. 2.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">From Unit</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white"
              >
                {units.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">To Unit</label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white"
              >
                {units.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {loading ? 'Calculating...' : 'Calculate Conversion'}
          </button>

          {result !== null && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <strong>{quantity} {fromUnit}</strong> = <span className="text-sm font-extrabold text-emerald-900">{result} {toUnit}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="p-3 bg-gray-50 border-t border-gray-100 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
