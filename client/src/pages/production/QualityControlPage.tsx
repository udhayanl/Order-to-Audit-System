import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Award,
  X,
  Printer,
  Calendar,
  User,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { useAuth } from '../../context/AuthContext.js';

export const QualityControlPage: React.FC = () => {
  const [inspections, setInspections] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);

  // Form State
  const [batchNumber, setBatchNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [productId, setProductId] = useState('');
  const [inspectedQty, setInspectedQty] = useState<number>(188);
  const [acceptedQty, setAcceptedQty] = useState<number>(188);
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [qualityStatus, setQualityStatus] = useState('PASSED');
  const [weightConsistency, setWeightConsistency] = useState('199.5g - 201.2g (Within ±2g specification)');
  const [packagingCondition, setPackagingCondition] = useState('Hermetically sealed, nitrogen flushed');
  const [appearance, setAppearance] = useState('Uniform golden brown color, crisp texture');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { user } = useAuth();
  const canInspect = ['PRODUCTION_SUPERVISOR', 'ADMIN', 'OWNER'].includes(user?.role || '');

  const loadData = async () => {
    try {
      setLoading(true);
      const [qcList, orderList, execList] = await Promise.all([
        api.get('/production/quality-inspections'),
        api.get('/production/orders'),
        api.get('/production/executions'),
      ]);
      setInspections(qcList || []);
      setOrders(orderList || []);
      setExecutions(execList || []);
      if (execList && execList.length > 0) {
        setBatchNumber(execList[0].batchNumber);
        setOrderId(execList[0].productionOrderId);
        setProductId(execList[0].productionOrder?.productId || '');
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

  const handleBatchSelect = (selectedBatch: string) => {
    setBatchNumber(selectedBatch);
    const exec = executions.find((e) => e.batchNumber === selectedBatch);
    if (exec) {
      setOrderId(exec.productionOrderId);
      setProductId(exec.productionOrder?.productId || '');
      const goodOut = Number(exec.goodOutput || exec.plannedOutput);
      setInspectedQty(goodOut);
      setAcceptedQty(goodOut);
      setRejectedQty(0);
    }
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNumber || !orderId || inspectedQty <= 0) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await api.post('/production/quality-inspections', {
        batchNumber,
        productionOrderId: orderId,
        productId,
        inspectedQuantity: Number(inspectedQty),
        acceptedQuantity: Number(acceptedQty),
        rejectedQuantity: Number(rejectedQty),
        qualityStatus,
        weightConsistency,
        packagingCondition,
        appearance,
        notes,
      });

      setSuccessMsg(`Quality Inspection certificate generated for batch ${batchNumber}.`);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record QC inspection.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInspections = inspections.filter((qc) => {
    const matchesSearch =
      qc.inspectionNumber.toLowerCase().includes(search.toLowerCase()) ||
      qc.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
      qc.product?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || qc.qualityStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-purple-600" />
            Quality Control & Inspection Certificates
          </h1>
          <p className="text-sm text-gray-500">
            FSSAI food quality assurance, seal integrity testing, weight consistency verification, and batch release certificates
          </p>
        </div>
        {canInspect && (
          <button
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New QC Inspection
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

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {['ALL', 'PASSED', 'FAILED', 'CONDITIONAL'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search certificate # or batch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* QC Certificates Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="p-3">Certificate #</th>
                <th className="p-3">Batch Number</th>
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Inspected</th>
                <th className="p-3 text-right">Accepted</th>
                <th className="p-3 text-right">Rejected</th>
                <th className="p-3">Inspector</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">Loading QC inspection logs...</td>
                </tr>
              ) : filteredInspections.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">No QC inspections found.</td>
                </tr>
              ) : (
                filteredInspections.map((qc) => (
                  <tr key={qc.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{qc.inspectionNumber}</td>
                    <td className="p-3 font-mono font-medium text-indigo-700">{qc.batchNumber}</td>
                    <td className="p-3 font-semibold text-gray-800">{qc.product?.name}</td>
                    <td className="p-3 text-right font-medium">{Number(qc.inspectedQuantity)}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{Number(qc.acceptedQuantity)}</td>
                    <td className="p-3 text-right font-bold text-rose-600">{Number(qc.rejectedQuantity)}</td>
                    <td className="p-3 text-gray-700">{qc.inspector?.fullName || 'Supervisor'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        qc.qualityStatus === 'PASSED' ? 'bg-emerald-100 text-emerald-800' :
                        qc.qualityStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {qc.qualityStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedInspection(qc);
                          setCertModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded font-semibold text-xs inline-flex items-center gap-1 shadow-sm"
                      >
                        <Award className="w-3.5 h-3.5" /> Certificate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW INSPECTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                Record Quality Control Inspection
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInspection} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Production Batch *
                </label>
                <select
                  value={batchNumber}
                  onChange={(e) => handleBatchSelect(e.target.value)}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Choose Batch --</option>
                  {executions.map((ex) => (
                    <option key={ex.id} value={ex.batchNumber}>
                      {ex.batchNumber} - {ex.productionOrder?.product?.name} (Order: {ex.productionOrder?.orderNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Inspected Qty *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={inspectedQty}
                    onChange={(e) => setInspectedQty(Number(e.target.value))}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Accepted Qty *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={acceptedQty}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAcceptedQty(val);
                      setRejectedQty(Math.max(0, inspectedQty - val));
                      setQualityStatus(val === inspectedQty ? 'PASSED' : val === 0 ? 'FAILED' : 'CONDITIONAL');
                    }}
                    required
                    className="w-full p-2 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Rejected Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rejectedQty}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRejectedQty(val);
                      setAcceptedQty(Math.max(0, inspectedQty - val));
                      setQualityStatus(val === 0 ? 'PASSED' : val === inspectedQty ? 'FAILED' : 'CONDITIONAL');
                    }}
                    className="w-full p-2 border border-rose-300 rounded-lg text-xs font-bold text-rose-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Quality Verdict</label>
                <select
                  value={qualityStatus}
                  onChange={(e) => setQualityStatus(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500"
                >
                  <option value="PASSED">PASSED (Approved for dispatch)</option>
                  <option value="CONDITIONAL">CONDITIONAL (Partial acceptance)</option>
                  <option value="FAILED">FAILED (Batch rejected / quarantined)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Weight Specification</label>
                <input
                  type="text"
                  value={weightConsistency}
                  onChange={(e) => setWeightConsistency(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Packaging Condition</label>
                <input
                  type="text"
                  value={packagingCondition}
                  onChange={(e) => setPackagingCondition(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Appearance & Organoleptic</label>
                <input
                  type="text"
                  value={appearance}
                  onChange={(e) => setAppearance(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Inspector Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. FSSAI regulatory compliance verified..."
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !batchNumber}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Issue QC Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC CERTIFICATE MODAL */}
      {certModalOpen && selectedInspection && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-xl w-full overflow-hidden p-8 space-y-6">
            <div className="border-b-2 border-purple-600 pb-4 flex items-center justify-between">
              <div>
                <div className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Award className="w-6 h-6 text-purple-600" />
                  QUALITY ASSURANCE CERTIFICATE
                </div>
                <div className="text-xs text-gray-500">FactoryFlow Food Manufacturing • FSSAI Compliance</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-gray-900">{selectedInspection.inspectionNumber}</div>
                <div className="text-[11px] text-gray-500">{new Date(selectedInspection.inspectionDate).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Product:</span>
                <div className="font-bold text-gray-900">{selectedInspection.product?.name}</div>
              </div>
              <div>
                <span className="text-gray-500">Batch Number:</span>
                <div className="font-mono font-bold text-indigo-700">{selectedInspection.batchNumber}</div>
              </div>
              <div>
                <span className="text-gray-500">Inspected / Accepted:</span>
                <div className="font-semibold text-gray-900">
                  {Number(selectedInspection.inspectedQuantity)} / {Number(selectedInspection.acceptedQuantity)} pkts
                </div>
              </div>
              <div>
                <span className="text-gray-500">Quality Verdict:</span>
                <div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedInspection.qualityStatus === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedInspection.qualityStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Weight Specification:</span>
                <span className="font-medium text-gray-900">{selectedInspection.weightConsistency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seal & Packaging Condition:</span>
                <span className="font-medium text-gray-900">{selectedInspection.packagingCondition}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Color, Crispness & Appearance:</span>
                <span className="font-medium text-gray-900">{selectedInspection.appearance}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-xs">
                <span className="text-gray-500">Certified by QA Inspector:</span>
                <div className="font-bold text-gray-900">{selectedInspection.inspector?.fullName || 'Murugesan (QA)'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setCertModalOpen(false)}
                  className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
