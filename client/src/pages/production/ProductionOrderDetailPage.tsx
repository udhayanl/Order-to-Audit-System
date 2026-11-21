import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import {
  ClipboardList,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Boxes,
  ShieldCheck,
  Play,
  RotateCcw,
  Layers,
  Calendar,
  User,
  X,
  FileText,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { useAuth } from '../../context/AuthContext.js';

export const ProductionOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'BOM_SNAPSHOT' | 'RESERVATIONS' | 'ISSUES' | 'OUTPUTS' | 'QC'>('BOM_SNAPSHOT');

  // Return Unused Material Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedIssueItem, setSelectedIssueItem] = useState<any>(null);
  const [returnQty, setReturnQty] = useState<number>(0);
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = ['PRODUCTION_SUPERVISOR', 'ADMIN', 'OWNER'].includes(user?.role || '');

  const loadOrder = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get(`/production/orders/${id}`);
      setOrder(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load production order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadOrder();
  }, [id]);

  // Actions
  const handleSubmit = async () => {
    try {
      await api.post(`/production/orders/${id}/submit`);
      setSuccessMsg('Order submitted for approval.');
      loadOrder();
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed.');
    }
  };

  const handleApprove = async () => {
    try {
      await api.post(`/production/orders/${id}/approve`, { forceShortage: false });
      setSuccessMsg('Order approved.');
      loadOrder();
    } catch (err: any) {
      setErrorMsg(err.message || 'Approval failed.');
    }
  };

  const handleReserve = async () => {
    try {
      await api.post(`/production/orders/${id}/reserve-materials`);
      setSuccessMsg('Materials reserved in inventory.');
      loadOrder();
    } catch (err: any) {
      setErrorMsg(err.message || 'Reservation failed.');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this production order? Any active reservations will be released.')) return;
    try {
      await api.post(`/production/orders/${id}/cancel`, { reason: 'User cancellation' });
      setSuccessMsg('Order cancelled and reservations released.');
      loadOrder();
    } catch (err: any) {
      setErrorMsg(err.message || 'Cancellation failed.');
    }
  };

  // Return Unused Material Handler
  const handleReturnUnused = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueItem || returnQty <= 0) return;

    try {
      setReturning(true);
      await api.post(`/production/material-issues/${selectedIssueItem.id}/return`, {
        returnedQuantity: Number(returnQty),
        reason: returnReason,
      });
      setSuccessMsg(`Returned ${returnQty} ${selectedIssueItem.unit} to store inventory.`);
      setReturnModalOpen(false);
      loadOrder();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to return material.');
    } finally {
      setReturning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center space-y-3">
        <Clock className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Loading Production Order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-gray-900">Production Order Not Found</h2>
        <p className="text-sm text-gray-500 mb-4">The requested order does not exist.</p>
        <Link to="/production/orders" className="text-xs font-semibold text-indigo-600 hover:underline">
          &larr; Back to Orders List
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/production/orders"
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{order.orderNumber}</h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Production Order for <span className="font-semibold text-gray-800">{order.product?.name}</span> (SKU: {order.product?.sku})
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {order.status === 'DRAFT' && (
              <button
                onClick={handleSubmit}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Submit for Approval
              </button>
            )}

            {order.status === 'PLANNED' && (
              <button
                onClick={handleApprove}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Approve Order
              </button>
            )}

            {order.status === 'APPROVED' && (
              <button
                onClick={handleReserve}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Reserve Materials
              </button>
            )}

            {(order.status === 'MATERIALS_RESERVED' || order.status === 'APPROVED' || order.status === 'IN_PROGRESS') && (
              <>
                <Link
                  to={`/production/material-issues?orderId=${order.id}`}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Boxes className="w-4 h-4" /> Issue Materials
                </Link>
                <Link
                  to={`/production/executions?orderId=${order.id}`}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4" /> Execute Batch
                </Link>
              </>
            )}

            {['DRAFT', 'PLANNED', 'APPROVED', 'MATERIALS_RESERVED'].includes(order.status) && (
              <button
                onClick={handleCancel}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold"
              >
                Cancel Order
              </button>
            )}
          </div>
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

      {/* Key Order Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Planned Output</div>
          <div className="mt-1 text-xl font-bold text-gray-900">
            {Number(order.plannedOutputQuantity)} {order.product?.unit || 'packets'}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">Pack size: {order.product?.packSize}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Actual Good Output</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">
            {Number(order.actualOutputQuantity || 0)} {order.product?.unit || 'packets'}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {order.status === 'COMPLETED' ? 'Production Completed' : 'In Progress'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Production Supervisor</div>
          <div className="mt-1 text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <User className="w-4 h-4 text-indigo-600" />
            {order.supervisor?.fullName || 'Murugesan (Supervisor)'}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">Priority: {order.priority}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Planned Start Date</div>
          <div className="mt-1 text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-500" />
            {new Date(order.startDate).toLocaleDateString()}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            Created by: {order.createdBy?.fullName || 'Admin'}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('BOM_SNAPSHOT')}
            className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'BOM_SNAPSHOT'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Immutable BOM Snapshot ({order.bomSnapshot?.items?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('RESERVATIONS')}
            className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'RESERVATIONS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Material Reservations ({order.reservations?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('ISSUES')}
            className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'ISSUES'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Material Issues ({order.materialIssues?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('OUTPUTS')}
            className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'OUTPUTS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Finished Goods Outputs ({order.outputs?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('QC')}
            className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'QC'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Quality Control ({order.qualityInspections?.length || 0})
          </button>
        </nav>
      </div>

      {/* Tab 1: IMMUTABLE BOM SNAPSHOT */}
      {activeTab === 'BOM_SNAPSHOT' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-gray-900">
                Frozen BOM Recipe Snapshot ({order.bomSnapshot?.bomName || 'Standard Recipe'})
              </h3>
              <p className="text-xs text-gray-500">
                Preserved version <span className="font-mono font-semibold">{order.bomSnapshot?.version}</span> captured at order creation.
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="text-gray-500">Standard Batch: </span>
              <span className="font-bold text-gray-900">{Number(order.bomSnapshot?.standardBatchSize || 200)} packets</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Material Code</th>
                  <th className="p-3">Material Name</th>
                  <th className="p-3">Item Type</th>
                  <th className="p-3 text-right">Standard Qty</th>
                  <th className="p-3 text-right">Scaled Requirement</th>
                  <th className="p-3">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.bomSnapshot?.items?.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-medium text-gray-900">{item.materialCode}</td>
                    <td className="p-3 font-semibold text-gray-800">{item.materialName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {item.itemType}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium">{Number(item.standardQuantity)}</td>
                    <td className="p-3 text-right font-bold text-indigo-600">{Number(item.scaledQuantity)}</td>
                    <td className="p-3 text-gray-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: MATERIAL RESERVATIONS */}
      {activeTab === 'RESERVATIONS' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Inventory Material Reservations</h3>
              <p className="text-xs text-gray-500">Reserved quantities safely protect materials from being overdrawn by other orders.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Item Type</th>
                  <th className="p-3">Reserved Quantity</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3">Reservation Date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!order.reservations || order.reservations.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400">No active material reservations for this order.</td>
                  </tr>
                ) : (
                  order.reservations.map((res: any) => (
                    <tr key={res.id} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{res.itemType}</td>
                      <td className="p-3 font-bold text-gray-900">{Number(res.reservedQuantity)}</td>
                      <td className="p-3 text-gray-500">{res.unit}</td>
                      <td className="p-3 text-gray-500">{new Date(res.reservationDate).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          res.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                          res.status === 'CONSUMED' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: MATERIAL ISSUES */}
      {activeTab === 'ISSUES' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Material Issues & FIFO Consumption</h3>
              <p className="text-xs text-gray-500">Actual material issues deduct inventory and register immutable stock OUT ledger records.</p>
            </div>
            {canManage && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
              <Link
                to={`/production/material-issues?orderId=${order.id}`}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                <Boxes className="w-3.5 h-3.5" /> New Issue
              </Link>
            )}
          </div>

          {(!order.materialIssues || order.materialIssues.length === 0) ? (
            <div className="p-8 text-center text-gray-400">No material issues recorded yet.</div>
          ) : (
            order.materialIssues.map((issue: any) => (
              <div key={issue.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs text-gray-900">{issue.issueNumber}</span>
                    <span className="text-[11px] text-gray-500">
                      Date: {new Date(issue.issueDate).toLocaleDateString()}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Issued by: {issue.issuedBy?.fullName || 'Supervisor'}
                    </span>
                  </div>
                  <StatusBadge status={issue.status} />
                </div>

                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5 text-right">Issued Qty</th>
                      <th className="p-2.5 text-right">Returned Qty</th>
                      <th className="p-2.5 text-right">Actual Consumed</th>
                      <th className="p-2.5 text-right">FIFO Unit Rate</th>
                      <th className="p-2.5 text-right">Total Cost</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {issue.items?.map((it: any) => {
                      const matName = it.rawMaterial?.name || it.packagingMaterial?.name || 'Material Item';
                      const issued = Number(it.issuedQuantity);
                      const returned = Number(it.returnedQuantity || 0);
                      const consumed = Number(it.actualConsumedQuantity);

                      return (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="p-2.5 font-semibold text-gray-900">{matName}</td>
                          <td className="p-2.5">{it.itemType}</td>
                          <td className="p-2.5 text-right font-medium">{issued} {it.unit}</td>
                          <td className="p-2.5 text-right text-rose-600 font-medium">{returned} {it.unit}</td>
                          <td className="p-2.5 text-right font-bold text-gray-900">{consumed} {it.unit}</td>
                          <td className="p-2.5 text-right font-mono">₹{Number(it.unitCost).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-700">₹{Number(it.totalCost).toFixed(2)}</td>
                          <td className="p-2.5 text-right">
                            {canManage && consumed > 0 && order.status !== 'COMPLETED' && (
                              <button
                                onClick={() => {
                                  setSelectedIssueItem({ ...it, materialName: matName });
                                  setReturnQty(0);
                                  setReturnReason('');
                                  setReturnModalOpen(true);
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" /> Return Unused
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: FINISHED GOODS OUTPUTS */}
      {activeTab === 'OUTPUTS' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Finished Goods Production Output</h3>
              <p className="text-xs text-gray-500">Packets posted directly into finished goods inventory and new FIFO valuation layer.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Output #</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3 text-right">Planned Qty</th>
                  <th className="p-3 text-right">Good Packets</th>
                  <th className="p-3 text-right">Damaged</th>
                  <th className="p-3 text-right">Rejected</th>
                  <th className="p-3 text-right">FIFO Unit Cost</th>
                  <th className="p-3 text-right">Total Batch Cost</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!order.outputs || order.outputs.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">No output posted yet. Start execution to produce finished goods.</td>
                  </tr>
                ) : (
                  order.outputs.map((out: any) => (
                    <tr key={out.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-900">{out.outputNumber}</td>
                      <td className="p-3 font-mono font-medium text-indigo-700">{out.batchNumber}</td>
                      <td className="p-3 text-right">{Number(out.plannedOutput)} pkts</td>
                      <td className="p-3 text-right font-bold text-emerald-700">{Number(out.goodPackets)} pkts</td>
                      <td className="p-3 text-right text-rose-600">{Number(out.damagedPackets)}</td>
                      <td className="p-3 text-right text-rose-600">{Number(out.rejectedPackets)}</td>
                      <td className="p-3 text-right font-bold text-gray-900">₹{Number(out.unitCost).toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-emerald-800">₹{Number(out.totalValue).toLocaleString('en-IN')}</td>
                      <td className="p-3"><StatusBadge status={out.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: QUALITY CONTROL */}
      {activeTab === 'QC' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Quality Control (QC) Inspections</h3>
              <p className="text-xs text-gray-500">Inspections verifying seal hermetic integrity, appearance, and standard packet weight.</p>
            </div>
            {canManage && (
              <Link
                to="/production/quality"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Record Inspection
              </Link>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Inspection #</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3 text-right">Inspected</th>
                  <th className="p-3 text-right">Accepted</th>
                  <th className="p-3 text-right">Rejected</th>
                  <th className="p-3">Weight Consistency</th>
                  <th className="p-3">Packaging Condition</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!order.qualityInspections || order.qualityInspections.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">No QC inspections performed for this order yet.</td>
                  </tr>
                ) : (
                  order.qualityInspections.map((qc: any) => (
                    <tr key={qc.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-900">{qc.inspectionNumber}</td>
                      <td className="p-3 font-mono font-medium text-indigo-700">{qc.batchNumber}</td>
                      <td className="p-3 text-right font-medium">{Number(qc.inspectedQuantity)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">{Number(qc.acceptedQuantity)}</td>
                      <td className="p-3 text-right font-bold text-rose-600">{Number(qc.rejectedQuantity)}</td>
                      <td className="p-3 text-gray-700">{qc.weightConsistency}</td>
                      <td className="p-3 text-gray-700">{qc.packagingCondition}</td>
                      <td className="p-3"><StatusBadge status={qc.qualityStatus} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RETURN UNUSED MATERIAL MODAL */}
      {returnModalOpen && selectedIssueItem && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Return Unused Material
              </h3>
              <button onClick={() => setReturnModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnUnused} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Material</label>
                <div className="text-sm font-bold text-gray-900">{selectedIssueItem.materialName}</div>
                <div className="text-xs text-gray-500">
                  Currently Consumed: {Number(selectedIssueItem.actualConsumedQuantity)} {selectedIssueItem.unit} (Issued: {Number(selectedIssueItem.issuedQuantity)})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Quantity to Return ({selectedIssueItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedIssueItem.actualConsumedQuantity)}
                  value={returnQty}
                  onChange={(e) => setReturnQty(Number(e.target.value))}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Return</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Unused batch leftover returned to main store"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returning || returnQty <= 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {returning ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
