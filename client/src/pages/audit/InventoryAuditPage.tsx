import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  Boxes,
  AlertTriangle,
  CheckCircle,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  PlusCircle,
  X,
  FileText,
  DollarSign,
  ClipboardList,
} from 'lucide-react';

interface AuditWorksheetItem {
  itemType: 'RAW_MATERIAL' | 'PACKAGING' | 'FINISHED_GOODS';
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  unitCost: number;
  systemStock: number;
}

export const InventoryAuditPage: React.FC = () => {
  const [worksheet, setWorksheet] = useState<AuditWorksheetItem[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [recordedItems, setRecordedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Count Modal
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [countFormSessionId, setCountFormSessionId] = useState('');
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [countReasons, setCountReasons] = useState<Record<string, string>>({});
  const [countSubmitting, setCountSubmitting] = useState(false);

  // Resolve Modal
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedItemToResolve, setSelectedItemToResolve] = useState<any | null>(null);
  const [resolveReason, setResolveReason] = useState('');

  const fetchWorksheetAndSessions = () => {
    setLoading(true);
    Promise.all([
      api.get('/audit/inventory/worksheet'),
      api.get('/audit/sessions?auditType=INVENTORY'),
    ])
      .then(([wsRes, sessRes]: [any, any]) => {
        const ws = wsRes.data || wsRes || [];
        const sessList = sessRes.data || sessRes || [];
        setWorksheet(ws);
        setSessions(sessList);

        const initialCounts: Record<string, number> = {};
        ws.forEach((item: AuditWorksheetItem) => {
          initialCounts[`${item.itemType}_${item.itemId}`] = item.systemStock;
        });
        setPhysicalCounts(initialCounts);

        if (sessList.length > 0 && !selectedSessionId) {
          setSelectedSessionId(sessList[0].id);
          setCountFormSessionId(sessList[0].id);
          fetchSessionItems(sessList[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchSessionItems = (sessionId: string) => {
    if (!sessionId) return;
    api.get(`/audit/sessions/${sessionId}`)
      .then((res: any) => {
        const data = res.data || res;
        setRecordedItems(data.inventoryItems || []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchWorksheetAndSessions();
  }, []);

  const handleSessionChange = (id: string) => {
    setSelectedSessionId(id);
    fetchSessionItems(id);
  };

  const handleRecordCounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countFormSessionId) {
      alert('Please select or create an audit session.');
      return;
    }

    setCountSubmitting(true);
    try {
      const countsPayload = worksheet.map(item => {
        const key = `${item.itemType}_${item.itemId}`;
        return {
          itemType: item.itemType,
          itemId: item.itemId,
          physicalStock: physicalCounts[key] !== undefined ? physicalCounts[key] : item.systemStock,
          discrepancyReason: countReasons[key] || undefined,
        };
      });

      await api.post('/audit/inventory/record', {
        auditSessionId: countFormSessionId,
        physicalCounts: countsPayload,
      });

      setIsCountModalOpen(false);
      setSelectedSessionId(countFormSessionId);
      fetchSessionItems(countFormSessionId);
      alert('Physical stock counts recorded and variances computed successfully!');
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to record counts.');
    } finally {
      setCountSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemToResolve || !resolveReason) return;

    try {
      await api.post(`/audit/inventory/items/${selectedItemToResolve.id}/resolve`, {
        reason: resolveReason,
      });
      setIsResolveModalOpen(false);
      setSelectedItemToResolve(null);
      setResolveReason('');
      fetchSessionItems(selectedSessionId);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to resolve item.');
    }
  };

  // Merge worksheet and recorded items if available
  const displayItems = recordedItems.length > 0 ? recordedItems : worksheet.map(w => ({
    id: `ws_${w.itemId}`,
    itemType: w.itemType,
    itemId: w.itemId,
    itemName: w.itemName,
    itemCode: w.itemCode,
    systemStock: w.systemStock,
    physicalStock: w.systemStock,
    varianceQuantity: 0,
    unitCost: w.unitCost,
    varianceValue: 0,
    status: 'MATCHED',
    discrepancyReason: '-',
  }));

  const filteredItems = displayItems.filter(item => {
    const matchesSearch =
      !search ||
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      item.itemCode?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || item.itemType === typeFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'DISCREPANCIES_ONLY' && (item.status === 'DISCREPANCY_FLAGGED' || item.varianceQuantity !== 0)) ||
      (statusFilter === 'MATCHED_ONLY' && item.status === 'MATCHED');
    return matchesSearch && matchesType && matchesStatus;
  });

  const discrepanciesCount = displayItems.filter(i => i.status === 'DISCREPANCY_FLAGGED' || Number(i.varianceQuantity) !== 0).length;
  const totalVarianceValue = displayItems.reduce((s, i) => s + Math.abs(Number(i.varianceValue || 0)), 0);

  const exportCSV = () => {
    const headers = ['Item Type,Item Code,Item Name,System Stock,Physical Stock,Variance Qty,Unit Cost,Variance Value,Status,Reason'];
    const rows = filteredItems.map(i =>
      `"${i.itemType}","${i.itemCode || ''}","${i.itemName}",${i.systemStock},${i.physicalStock},${i.varianceQuantity},${i.unitCost},${i.varianceValue},"${i.status}","${(i.discrepancyReason || '').replace(/"/g, '""')}"`
    );
    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_Stock_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-brand-600" />
            Inventory & Stock Reconciliation Audit
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare physical counted warehouse inventory against immutable StockLedger balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCountModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Conduct Stock Count
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Items Audited</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 font-mono">
            {displayItems.length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Raw, Packaging & Finished Goods</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Matched & Verified</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
            {displayItems.length - discrepanciesCount}
          </div>
          <div className="text-xs text-emerald-700/80 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> 100% Ledger Accordance
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm bg-rose-50/20">
          <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Discrepancies Flagged</div>
          <div className="mt-2 text-2xl font-bold text-rose-700 font-mono">
            {discrepanciesCount}
          </div>
          <div className="text-xs text-rose-700/80 mt-1">
            Requiring auditor justification
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Variance Value</div>
          <div className={`mt-2 text-2xl font-bold font-mono ${totalVarianceValue === 0 ? 'text-gray-900' : 'text-rose-600'}`}>
            ₹{totalVarianceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">Computed via standard cost</div>
        </div>
      </div>

      {/* Audit Session Selector & Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {sessions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">Audit Session:</span>
              <select
                value={selectedSessionId}
                onChange={e => handleSessionChange(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-brand-500"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.auditNumber} - {s.title} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search item name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 w-52"
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
          >
            <option value="ALL">All Categories</option>
            <option value="RAW_MATERIAL">Raw Materials</option>
            <option value="PACKAGING">Packaging Materials</option>
            <option value="FINISHED_GOODS">Finished Goods</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
          >
            <option value="ALL">All Statuses</option>
            <option value="DISCREPANCIES_ONLY">Discrepancies Only</option>
            <option value="MATCHED_ONLY">Matched Only</option>
          </select>
        </div>

        <button
          onClick={fetchWorksheetAndSessions}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Inventory Audit Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Physical vs System Stock Ledger Comparison ({filteredItems.length} items)
          </h2>
          <span className="text-xs text-gray-500">Live PostgreSQL Inventory Engine</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Item Type</th>
                <th className="py-3 px-4">Item Code</th>
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-4 text-right">System Stock</th>
                <th className="py-3 px-4 text-right">Physical Count</th>
                <th className="py-3 px-4 text-right">Variance Qty</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">Variance Value</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading inventory audit data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    No items match the current filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const varQty = Number(item.varianceQuantity || 0);
                  const isDiscrepant = Math.abs(varQty) > 0.001;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.itemType === 'RAW_MATERIAL'
                              ? 'bg-blue-100 text-blue-800'
                              : item.itemType === 'PACKAGING'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {item.itemType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-700">{item.itemCode || '-'}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{item.itemName}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-gray-800">
                        {Number(item.systemStock).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        {Number(item.physicalStock).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${varQty < 0 ? 'text-rose-600' : varQty > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {varQty !== 0 ? (varQty > 0 ? `+${varQty}` : varQty) : '0.000'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        ₹{Number(item.unitCost).toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${Number(item.varianceValue) !== 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {Number(item.varianceValue) !== 0 ? `₹${Math.abs(Number(item.varianceValue)).toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'MATCHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'RECONCILED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.status === 'MATCHED' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isDiscrepant && item.status !== 'RECONCILED' ? (
                          <button
                            onClick={() => {
                              setSelectedItemToResolve(item);
                              setIsResolveModalOpen(true);
                            }}
                            className="text-xs text-brand-600 hover:text-brand-800 font-semibold underline"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[11px]">{item.discrepancyReason || '-'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONDUCT STOCK COUNT MODAL */}
      {isCountModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-gray-900 text-sm">Conduct Physical Stock Count Worksheet</h3>
              </div>
              <button
                onClick={() => setIsCountModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordCounts} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Audit Session</label>
                <select
                  required
                  value={countFormSessionId}
                  onChange={e => setCountFormSessionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-medium"
                >
                  <option value="">Select Audit Session</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.auditNumber} - {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Enter Counted Physical Stock for Active Inventory
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                      <tr>
                        <th className="p-2.5">Item Name</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-right">System Stock</th>
                        <th className="p-2.5 text-right">Physical Count</th>
                        <th className="p-2.5">Justification Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {worksheet.map(item => {
                        const key = `${item.itemType}_${item.itemId}`;
                        return (
                          <tr key={key}>
                            <td className="p-2.5 font-medium text-gray-900">{item.itemName}</td>
                            <td className="p-2.5 text-gray-500 text-[10px]">{item.itemType}</td>
                            <td className="p-2.5 text-right font-mono text-gray-600">
                              {item.systemStock} {item.unit}
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                step="0.001"
                                required
                                value={physicalCounts[key] !== undefined ? physicalCounts[key] : item.systemStock}
                                onChange={e =>
                                  setPhysicalCounts({
                                    ...physicalCounts,
                                    [key]: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24 px-2 py-1 text-right text-xs border border-gray-300 rounded font-mono font-bold"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                placeholder="Variance note"
                                value={countReasons[key] || ''}
                                onChange={e =>
                                  setCountReasons({
                                    ...countReasons,
                                    [key]: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCountModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={countSubmitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {countSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  Submit Audit Counts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE DISCREPANCY MODAL */}
      {isResolveModalOpen && selectedItemToResolve && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900 text-sm">Resolve Inventory Discrepancy</h3>
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 rounded-lg text-xs space-y-1">
                <div className="font-bold text-rose-900">{selectedItemToResolve.itemName}</div>
                <div className="text-rose-800">
                  System: {selectedItemToResolve.systemStock} | Physical: {selectedItemToResolve.physicalStock}
                </div>
                <div className="text-rose-700 font-bold">
                  Variance: {selectedItemToResolve.varianceQuantity} (₹{Math.abs(selectedItemToResolve.varianceValue).toFixed(2)})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Auditor Justification / Resolution Protocol
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Physical recount verified handling loss; authorized written-off."
                  value={resolveReason}
                  onChange={e => setResolveReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  Confirm & Reconcile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
