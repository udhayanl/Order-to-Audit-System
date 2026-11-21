import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import {
  Search,
  Factory,
  Layers,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  Percent,
  Calendar,
  User,
  ArrowRight,
  Calculator,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';

export const BatchTraceabilityPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBatch = searchParams.get('batch') || 'BATCH-2026-0001';

  const [identifier, setIdentifier] = useState(initialBatch);
  const [traceData, setTraceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTrace = async (idToSearch: string) => {
    if (!idToSearch) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get(`/production/batches/${encodeURIComponent(idToSearch)}/trace`);
      setTraceData(res);
      setSearchParams({ batch: idToSearch });
    } catch (err: any) {
      setErrorMsg(err.message || 'Audit trail not found for this batch or order.');
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialBatch) {
      fetchTrace(initialBatch);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrace(identifier.trim());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <History className="w-7 h-7 text-indigo-600" />
          End-to-End Batch Traceability Audit Graph
        </h1>
        <p className="text-sm text-gray-500">
          Complete backward & forward audit chain: Finished Packets &rarr; QC &rarr; FIFO Depletion &rarr; Material Issues &rarr; BOM Snapshot &rarr; Production Order
        </p>
      </div>

      {/* Search Bar & Quick Pill Links */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Enter Batch Number (e.g. BATCH-2026-0001) or Order Number..."
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            {loading ? 'Tracing...' : 'Trace Audit Trail'}
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Quick samples:</span>
          {['BATCH-2026-0001', 'MFG-2026-0001'].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setIdentifier(sample);
                fetchTrace(sample);
              }}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-mono text-[11px]"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Audit Graph Timeline */}
      {traceData && (
        <div className="space-y-6">
          {/* Header Overview Card */}
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-2xl p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 bg-white/10 rounded-full text-[11px] font-semibold text-indigo-200 tracking-wider uppercase">
                  Verified Batch Trace
                </span>
                <h2 className="text-2xl font-black mt-2 font-mono">{traceData.batchNumber || traceData.batchIdentifier}</h2>
                <div className="text-sm text-indigo-100 mt-1">
                  Product: <span className="font-bold text-white">{traceData.product?.name}</span> (SKU: {traceData.product?.sku}, Pack: {traceData.product?.packSize})
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-white/5 p-4 rounded-xl border border-white/10">
                <div>
                  <div className="text-indigo-200">Order Number</div>
                  <div className="font-bold text-white mt-0.5">{traceData.order?.orderNumber}</div>
                </div>
                <div>
                  <div className="text-indigo-200">Order Status</div>
                  <div className="font-bold text-emerald-300 mt-0.5">{traceData.order?.status}</div>
                </div>
                <div>
                  <div className="text-indigo-200">Supervisor</div>
                  <div className="font-bold text-white mt-0.5">{traceData.order?.supervisor}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Stages */}
          <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-200 space-y-8">
            {/* Stage 1: Production Order & Plan */}
            <div className="relative">
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full bg-indigo-600 border-4 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
                1
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <Factory className="w-4 h-4 text-indigo-600" />
                    Stage 1: Production Order Planning & Schedule
                  </h3>
                  <StatusBadge status={traceData.order?.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Order Reference:</span>
                    <div className="font-bold text-gray-900">{traceData.order?.orderNumber}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Planned Start:</span>
                    <div className="font-medium text-gray-900">{new Date(traceData.order?.startDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Approved By:</span>
                    <div className="font-medium text-gray-900">{traceData.order?.approvedBy}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Created By:</span>
                    <div className="font-medium text-gray-900">{traceData.order?.createdBy}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 2: Frozen BOM Recipe Snapshot */}
            <div className="relative">
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full bg-indigo-600 border-4 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
                2
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Stage 2: Immutable BOM Recipe Snapshot ({traceData.bomSnapshot?.version})
                  </h3>
                  <span className="text-xs text-gray-500 font-mono">
                    Standard Batch: {Number(traceData.bomSnapshot?.standardBatchSize || 200)} packets
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold uppercase">
                      <tr>
                        <th className="p-2">Material</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 text-right">Standard Qty</th>
                        <th className="p-2 text-right">Scaled Requirement</th>
                        <th className="p-2">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {traceData.bomSnapshot?.items?.map((it: any) => (
                        <tr key={it.id}>
                          <td className="p-2 font-medium text-gray-900">{it.materialName}</td>
                          <td className="p-2">{it.itemType}</td>
                          <td className="p-2 text-right">{Number(it.standardQuantity)}</td>
                          <td className="p-2 text-right font-bold text-indigo-600">{Number(it.scaledQuantity)}</td>
                          <td className="p-2 text-gray-500">{it.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Stage 3: Material Issues & Stock Ledger Depletion */}
            <div className="relative">
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full bg-indigo-600 border-4 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
                3
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    Stage 3: Material Issues & FIFO Layer Depletion
                  </h3>
                  <span className="text-xs font-semibold text-emerald-700">
                    {traceData.materialIssues?.length || 0} Issue Postings
                  </span>
                </div>

                {traceData.materialIssues?.map((issue: any) => (
                  <div key={issue.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>{issue.issueNumber} ({new Date(issue.issueDate).toLocaleDateString()})</span>
                      <span className="text-gray-500">Issued by: {issue.issuedBy?.fullName || 'Supervisor'}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] text-gray-600">
                        <thead className="text-gray-500 font-semibold border-b border-gray-200">
                          <tr>
                            <th className="p-1.5">Material</th>
                            <th className="p-1.5 text-right">Issued</th>
                            <th className="p-1.5 text-right">Returned</th>
                            <th className="p-1.5 text-right">Consumed</th>
                            <th className="p-1.5 text-right">FIFO Unit Rate</th>
                            <th className="p-1.5 text-right">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {issue.items?.map((it: any) => (
                            <tr key={it.id}>
                              <td className="p-1.5 font-medium text-gray-900">
                                {it.rawMaterial?.name || it.packagingMaterial?.name || 'Material Item'}
                              </td>
                              <td className="p-1.5 text-right">{Number(it.issuedQuantity)} {it.unit}</td>
                              <td className="p-1.5 text-right text-rose-600">{Number(it.returnedQuantity || 0)} {it.unit}</td>
                              <td className="p-1.5 text-right font-bold text-gray-900">{Number(it.actualConsumedQuantity)} {it.unit}</td>
                              <td className="p-1.5 text-right font-mono">₹{Number(it.unitCost).toFixed(2)}</td>
                              <td className="p-1.5 text-right font-bold text-emerald-700">₹{Number(it.totalCost).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage 4: Actual Consumption vs BOM Standard Variance */}
            <div className="relative">
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full bg-indigo-600 border-4 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
                4
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Stage 4: Actual Material Consumption vs BOM Standard Variance
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold uppercase">
                      <tr>
                        <th className="p-2.5">Material</th>
                        <th className="p-2.5 text-right">Standard BOM</th>
                        <th className="p-2.5 text-right">Actual Consumed</th>
                        <th className="p-2.5 text-right">Variance Qty</th>
                        <th className="p-2.5 text-right">Variance %</th>
                        <th className="p-2.5 text-center">Tolerance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {traceData.materialVariances?.map((v: any, idx: number) => {
                        const exceeds = Math.abs(v.variancePercent) > 3.0;
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-2.5 font-semibold text-gray-900">{v.materialName}</td>
                            <td className="p-2.5 text-right">{v.standardQuantity} {v.unit}</td>
                            <td className="p-2.5 text-right font-bold text-gray-900">{v.actualConsumedQuantity} {v.unit}</td>
                            <td className="p-2.5 text-right font-medium">
                              {v.variance > 0 ? `+${v.variance}` : v.variance} {v.unit}
                            </td>
                            <td className="p-2.5 text-right font-bold">
                              <span className={v.variancePercent > 0 ? 'text-amber-700' : 'text-gray-900'}>
                                {v.variancePercent > 0 ? `+${v.variancePercent}` : v.variancePercent}%
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                exceeds ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {exceeds ? 'EXCEEDS_TOLERANCE (+5%)' : 'NORMAL (±3%)'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Stage 5: Quality Inspection Certificate */}
            <div className="relative">
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full bg-indigo-600 border-4 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
                5
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    Stage 5: Quality Control (QC) Certificate
                  </h3>
                  {traceData.qualityInspections?.length > 0 && (
                    <StatusBadge status={traceData.qualityInspections[0].qualityStatus} />
                  )}
                </div>

                {(!traceData.qualityInspections || traceData.qualityInspections.length === 0) ? (
                  <p className="text-xs text-gray-400">No QC certificates attached to this batch.</p>
                ) : (
                  traceData.qualityInspections.map((qc: any) => (
                    <div key={qc.id} className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>{qc.inspectionNumber}</span>
                        <span>Date: {new Date(qc.inspectionDate).toLocaleDateString()}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-700">
                        <div>Inspected: <span className="font-bold">{Number(qc.inspectedQuantity)} pkts</span></div>
                        <div>Accepted: <span className="font-bold text-emerald-700">{Number(qc.acceptedQuantity)} pkts</span></div>
                        <div>Rejected: <span className="font-bold text-rose-700">{Number(qc.rejectedQuantity)} pkts</span></div>
                        <div>Inspector: <span className="font-medium">{qc.inspector?.fullName || 'Supervisor'}</span></div>
                      </div>
                      <div className="pt-2 text-[11px] text-gray-600 border-t border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span>Weight: {qc.weightConsistency}</span>
                        <span>Seal: {qc.packagingCondition}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stage 6: Finished Goods Output & Stock Addition */}
            <div className="relative">
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full bg-emerald-600 border-4 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
                6
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Stage 6: Finished Goods Output & Usable Stock Addition
                </h3>

                {(!traceData.productionOutputs || traceData.productionOutputs.length === 0) ? (
                  <p className="text-xs text-gray-400">No finished goods posted yet.</p>
                ) : (
                  traceData.productionOutputs.map((out: any) => (
                    <div key={out.id} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-gray-900">{out.outputNumber}</span>
                        <span className="text-emerald-800 font-semibold">Posted to Inventory Balance</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Good Packets:</span>
                          <div className="text-lg font-extrabold text-emerald-700">+{Number(out.goodPackets)} pkts</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Damaged & Scrap:</span>
                          <div className="text-base font-bold text-rose-600">
                            {Number(out.damagedPackets) + Number(out.rejectedPackets)} pkts
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Cost Per Packet:</span>
                          <div className="text-base font-bold text-gray-900">₹{Number(out.unitCost).toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Batch Value:</span>
                          <div className="text-base font-bold text-emerald-800">
                            ₹{Number(out.totalValue).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stage 7: Financial Costing Summary Card */}
            <div className="relative">
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full bg-gray-900 border-4 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">
                ₹
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  Financial Production Cost Breakdown & Unit Cost Absorption
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Raw Material Cost:</span>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">
                      ₹{traceData.costAnalysis?.rawMaterialCost?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Packaging Cost:</span>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">
                      ₹{traceData.costAnalysis?.packagingCost?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Overheads (Labour/Power):</span>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">
                      ₹{traceData.costAnalysis?.overheadsTotal?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-emerald-800 font-semibold">Cost Per Good Packet:</span>
                    <div className="font-extrabold text-emerald-700 text-base mt-0.5">
                      ₹{traceData.costAnalysis?.costPerPacket?.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
