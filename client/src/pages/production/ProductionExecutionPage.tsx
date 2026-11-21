import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import {
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Boxes,
  Plus,
  Percent,
  Calculator,
  Search,
  Factory,
  X,
  FileCheck,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { useAuth } from '../../context/AuthContext.js';

export const ProductionExecutionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId') || '';

  const [executions, setExecutions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);

  // Start Execution Form
  const [startOrderId, setStartOrderId] = useState(preselectedOrderId);
  const [workstation, setWorkstation] = useState('Line 1 - Frying & Packing');
  const [startNotes, setStartNotes] = useState('');
  const [starting, setStarting] = useState(false);

  // Output Form State
  const [goodPackets, setGoodPackets] = useState<number>(188);
  const [damagedPackets, setDamagedPackets] = useState<number>(6);
  const [rejectedPackets, setRejectedPackets] = useState<number>(6);
  const [labourCost, setLabourCost] = useState<number>(300);
  const [powerCost, setPowerCost] = useState<number>(150);
  const [otherOverheads, setOtherOverheads] = useState<number>(50);
  const [outputNotes, setOutputNotes] = useState('');
  const [submittingOutput, setSubmittingOutput] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { user } = useAuth();
  const canManage = ['PRODUCTION_SUPERVISOR', 'ADMIN', 'OWNER'].includes(user?.role || '');

  const loadData = async () => {
    try {
      setLoading(true);
      const [execList, orderList] = await Promise.all([
        api.get('/production/executions'),
        api.get('/production/orders'),
      ]);
      setExecutions(execList || []);
      setOrders(orderList || []);
      if (!startOrderId && orderList && orderList.length > 0) {
        const firstAvailable = orderList.find((o: any) =>
          ['MATERIALS_RESERVED', 'APPROVED', 'IN_PROGRESS'].includes(o.status)
        );
        if (firstAvailable) setStartOrderId(firstAvailable.id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pause Execution
  const handlePause = async (id: string) => {
    try {
      await api.post(`/production/executions/${id}/pause`);
      setSuccessMsg('Production execution paused.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to pause execution.');
    }
  };

  // Resume Execution
  const handleResume = async (id: string) => {
    try {
      await api.post(`/production/executions/${id}/resume`);
      setSuccessMsg('Production execution resumed.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resume execution.');
    }
  };

  // Start Execution Handler
  const handleStartExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startOrderId) return;

    try {
      setStarting(true);
      setErrorMsg(null);
      await api.post('/production/executions', {
        productionOrderId: startOrderId,
        lineOrWorkstation: workstation,
        notes: startNotes,
      });

      setSuccessMsg('Batch execution started successfully.');
      setIsStartModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start execution.');
    } finally {
      setStarting(false);
    }
  };

  // Output Posting Handler
  const handlePostOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExecution || goodPackets < 0) return;

    try {
      setSubmittingOutput(true);
      setErrorMsg(null);
      await api.post('/production/outputs', {
        productionOrderId: selectedExecution.productionOrderId,
        productionExecutionId: selectedExecution.id,
        batchNumber: selectedExecution.batchNumber,
        goodPackets: Number(goodPackets),
        damagedPackets: Number(damagedPackets),
        rejectedPackets: Number(rejectedPackets),
        labourCost: Number(labourCost),
        powerCost: Number(powerCost),
        otherOverheads: Number(otherOverheads),
        notes: outputNotes,
      });

      setSuccessMsg(`Successfully posted ${goodPackets} packets to Finished Goods inventory and created FIFO valuation layer!`);
      setIsOutputModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post production output.');
    } finally {
      setSubmittingOutput(false);
    }
  };

  // Live calculations for output modal
  const plannedOutput = selectedExecution ? Number(selectedExecution.plannedOutput) : 200;
  const totalProduced = Number(goodPackets) + Number(damagedPackets) + Number(rejectedPackets);
  const liveYield = plannedOutput > 0 ? Math.round(((Number(goodPackets) / plannedOutput) * 100) * 10) / 10 : 0;
  const liveLoss = plannedOutput > 0 ? Math.round((((plannedOutput - Number(goodPackets)) / plannedOutput) * 100) * 10) / 10 : 0;

  const filteredExecutions = executions.filter(
    (ex) =>
      ex.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
      ex.productionOrder?.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      ex.productionOrder?.product?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Factory className="w-7 h-7 text-amber-600" />
            Manufacturing Execution & Batch Output
          </h1>
          <p className="text-sm text-gray-500">
            Real-time shopfloor line execution, batch status tracking, yield & wastage calculation, and finished goods posting
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setErrorMsg(null);
              setIsStartModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Play className="w-4 h-4" /> Start New Batch
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by batch #, order #, or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="text-xs text-gray-500">
          Total Batches: <span className="font-bold text-gray-900">{filteredExecutions.length}</span>
        </div>
      </div>

      {/* Execution Batches Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="p-3">Batch Number</th>
                <th className="p-3">Order Number</th>
                <th className="p-3">Product</th>
                <th className="p-3">Workstation Line</th>
                <th className="p-3 text-right">Planned Output</th>
                <th className="p-3 text-right">Good Output</th>
                <th className="p-3 text-right">Wastage</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">Loading batch executions...</td>
                </tr>
              ) : filteredExecutions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">No manufacturing executions found.</td>
                </tr>
              ) : (
                filteredExecutions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-indigo-700">
                      <Link to={`/production/traceability?batch=${exec.batchNumber}`} className="hover:underline">
                        {exec.batchNumber}
                      </Link>
                    </td>
                    <td className="p-3 font-medium text-gray-900">
                      <Link to={`/production/orders/${exec.productionOrderId}`} className="text-indigo-600 hover:underline">
                        {exec.productionOrder?.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3 font-semibold text-gray-800">{exec.productionOrder?.product?.name}</td>
                    <td className="p-3 text-gray-500">{exec.lineOrWorkstation}</td>
                    <td className="p-3 text-right font-medium">{Number(exec.plannedOutput)} pkts</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{Number(exec.goodOutput || 0)} pkts</td>
                    <td className="p-3 text-right text-rose-600 font-medium">
                      {Number(exec.wastageQuantity || 0) + Number(exec.rejectedOutput || 0)} pkts
                    </td>
                    <td className="p-3">
                      <StatusBadge status={exec.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {exec.status === 'IN_PROGRESS' && canManage && (
                          <>
                            <button
                              onClick={() => handlePause(exec.id)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <Pause className="w-3 h-3" /> Pause
                            </button>

                            <button
                              onClick={() => {
                                setSelectedExecution(exec);
                                setGoodPackets(Number(exec.plannedOutput) * 0.94);
                                setDamagedPackets(6);
                                setRejectedPackets(6);
                                setIsOutputModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] inline-flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Post Output
                            </button>
                          </>
                        )}

                        {exec.status === 'PAUSED' && canManage && (
                          <button
                            onClick={() => handleResume(exec.id)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Resume
                          </button>
                        )}

                        <Link
                          to={`/production/traceability?batch=${exec.batchNumber}`}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-xs"
                        >
                          Trace
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* START EXECUTION MODAL */}
      {isStartModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <Play className="w-4 h-4 text-amber-600" />
                Start Production Execution Batch
              </h3>
              <button onClick={() => setIsStartModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartExecution} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Production Order *
                </label>
                <select
                  value={startOrderId}
                  onChange={(e) => setStartOrderId(e.target.value)}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Choose Order --</option>
                  {orders
                    .filter((o) => ['APPROVED', 'MATERIALS_RESERVED', 'IN_PROGRESS'].includes(o.status))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} - {o.product?.name} ({Number(o.plannedOutputQuantity)} pkts)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Workstation / Line Name
                </label>
                <input
                  type="text"
                  value={workstation}
                  onChange={(e) => setWorkstation(e.target.value)}
                  placeholder="Line 1 - Frying & Packing"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Batch Remarks / Operator Notes
                </label>
                <textarea
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Temperature checked at 180°C..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={starting || !startOrderId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {starting ? 'Starting...' : 'Start Execution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PRODUCTION OUTPUT MODAL */}
      {isOutputModalOpen && selectedExecution && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-base text-gray-900">Record Production Output</h3>
                <p className="text-xs text-gray-500">
                  Batch: <span className="font-mono font-bold text-indigo-700">{selectedExecution.batchNumber}</span> | Order: {selectedExecution.productionOrder?.orderNumber}
                </p>
              </div>
              <button onClick={() => setIsOutputModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostOutput} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Output Quantities Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">
                    Good Packets *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={goodPackets}
                    onChange={(e) => setGoodPackets(Number(e.target.value))}
                    required
                    className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-emerald-700">Added to usable stock</span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                    Damaged Pouches
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={damagedPackets}
                    onChange={(e) => setDamagedPackets(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-sm font-bold text-amber-700 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-amber-700">Packaging seal scrap</span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <label className="block text-[11px] font-bold text-rose-900 uppercase mb-1">
                    Rejected / Burnt
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rejectedPackets}
                    onChange={(e) => setRejectedPackets(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-rose-300 rounded-lg text-sm font-bold text-rose-700 focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="text-[10px] text-rose-700">Excluded from stock</span>
                </div>
              </div>

              {/* Overheads Section */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  Manufacturing Overheads Absorption
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Labour Cost (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={labourCost}
                      onChange={(e) => setLabourCost(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Power / Fuel Cost (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={powerCost}
                      onChange={(e) => setPowerCost(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Other Overheads (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={otherOverheads}
                      onChange={(e) => setOtherOverheads(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Live Yield & Variance Banner */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-indigo-900">Yield & Scrap Analysis</div>
                  <div className="text-xs text-indigo-700 mt-0.5">
                    Planned: <span className="font-bold">{plannedOutput} pkts</span> | Good Output: <span className="font-bold">{goodPackets} pkts</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-indigo-800">Actual Yield</div>
                    <div className="text-lg font-extrabold text-indigo-700">{liveYield}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-rose-800">Production Loss</div>
                    <div className="text-lg font-extrabold text-rose-700">{liveLoss}%</div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOutputModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutput || goodPackets < 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submittingOutput ? 'Posting...' : 'Confirm Output & Post to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
