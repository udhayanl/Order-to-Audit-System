import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Plus, Search, ShoppingBag, Truck, CheckCircle2, AlertCircle, FileText, Check, PackageCheck } from 'lucide-react';

export const PurchasesListPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrSupervisor = user?.role === 'ADMIN' || user?.role === 'PRODUCTION_SUPERVISOR' || user?.role === 'OWNER';

  const [activeTab, setActiveTab] = useState<'POS' | 'GRNS'>('POS');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create PO Modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [poStatus, setPoStatus] = useState('CONFIRMED');
  const [lineItems, setLineItems] = useState<any[]>([
    { itemType: 'RAW_MATERIAL', itemId: '', quantity: 10, unitPrice: 45, unit: 'kg', gstRate: 5 },
  ]);
  const [poNotes, setPoNotes] = useState('');
  const [poSubmitting, setPoSubmitting] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);

  // GRN Receipt Modal
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);
  const [challanNumber, setChallanNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [grnSubmitting, setGrnSubmitting] = useState(false);
  const [grnError, setGrnError] = useState<string | null>(null);

  const fetchPurchasesAndGRNs = () => {
    setLoading(true);
    Promise.all([
      api.get('/purchases'),
      api.get('/goods-receipts'),
      api.get('/suppliers'),
      api.get('/inventory/raw-materials'),
      api.get('/inventory/packaging-materials'),
    ])
      .then(([poData, grnData, supData, rmData, pkgData]: any) => {
        setPurchases(poData || []);
        setGrns(grnData || []);
        setSuppliers(supData || []);
        setRawMaterials(rmData || []);
        setPackagingMaterials(pkgData || []);

        if (supData && supData.length > 0 && !supplierId) {
          setSupplierId(supData[0].id);
        }
        if (rmData && rmData.length > 0 && !lineItems[0].itemId) {
          setLineItems([
            {
              itemType: 'RAW_MATERIAL',
              itemId: rmData[0].id,
              quantity: 60,
              unitPrice: Number(rmData[0].unitPrice || 45),
              unit: rmData[0].uom || 'kg',
              gstRate: 5,
            },
          ]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPurchasesAndGRNs();
  }, []);

  // Line item manipulation for Create PO
  const handleAddLineItem = () => {
    const defaultRM = rawMaterials[0];
    setLineItems([
      ...lineItems,
      {
        itemType: 'RAW_MATERIAL',
        itemId: defaultRM ? defaultRM.id : '',
        quantity: 10,
        unitPrice: defaultRM ? Number(defaultRM.unitPrice || 40) : 40,
        unit: defaultRM ? defaultRM.uom : 'kg',
        gstRate: 5,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index][field] = value;

    if (field === 'itemType') {
      if (value === 'RAW_MATERIAL' && rawMaterials.length > 0) {
        updated[index].itemId = rawMaterials[0].id;
        updated[index].unit = rawMaterials[0].uom;
        updated[index].unitPrice = Number(rawMaterials[0].unitPrice || 40);
      } else if (value === 'PACKAGING' && packagingMaterials.length > 0) {
        updated[index].itemId = packagingMaterials[0].id;
        updated[index].unit = packagingMaterials[0].uom;
        updated[index].unitPrice = Number(packagingMaterials[0].unitPrice || 2.5);
      }
    } else if (field === 'itemId') {
      const list = updated[index].itemType === 'RAW_MATERIAL' ? rawMaterials : packagingMaterials;
      const found = list.find((it) => it.id === value);
      if (found) {
        updated[index].unit = found.uom;
        updated[index].unitPrice = Number(found.unitPrice || 10);
      }
    }

    setLineItems(updated);
  };

  const calculateTotals = () => {
    let taxable = 0;
    let gst = 0;
    lineItems.forEach((item) => {
      const lineTaxable = Number(item.quantity) * Number(item.unitPrice);
      const lineGst = lineTaxable * (Number(item.gstRate) / 100);
      taxable += lineTaxable;
      gst += lineGst;
    });
    return {
      taxable: Math.round(taxable * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      grandTotal: Math.round((taxable + gst) * 100) / 100,
    };
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoError(null);
    setPoSubmitting(true);

    try {
      const itemsPayload = lineItems.map((item) => ({
        itemType: item.itemType,
        rawMaterialId: item.itemType === 'RAW_MATERIAL' ? item.itemId : undefined,
        packagingMaterialId: item.itemType === 'PACKAGING' ? item.itemId : undefined,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        gstRate: Number(item.gstRate),
      }));

      await api.post('/purchases', {
        supplierId,
        items: itemsPayload,
        status: poStatus,
        notes: poNotes,
      });

      setShowPOModal(false);
      setPoNotes('');
      fetchPurchasesAndGRNs();
    } catch (err: any) {
      setPoError(err.message || 'Failed to create purchase order');
    } finally {
      setPoSubmitting(false);
    }
  };

  const handleConfirmPO = async (id: string) => {
    try {
      await api.post(`/purchases/${id}/confirm`, {});
      fetchPurchasesAndGRNs();
    } catch (err: any) {
      alert(err.message || 'Confirmation failed');
    }
  };

  const openGRNModal = (po: any) => {
    setSelectedPO(po);
    const initialReceipts = (po.items || []).map((item: any) => {
      const ordered = Number(item.quantity);
      const received = Number(item.receivedQuantity || 0);
      const outstanding = Math.max(0, ordered - received);
      return {
        purchaseItemId: item.id,
        itemName: item.rawMaterial?.name || item.packagingMaterial?.name || 'Material Item',
        orderedQuantity: ordered,
        alreadyReceived: received,
        outstandingQuantity: outstanding,
        acceptedQuantity: outstanding,
        rejectedQuantity: 0,
        batchNumber: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
        rejectionReason: '',
        unit: item.unit,
      };
    });
    setReceiptItems(initialReceipts);
    setChallanNumber(`DC-${Math.floor(1000 + Math.random() * 9000)}`);
    setVehicleNumber('TN-45-AQ-2026');
    setShowGRNModal(true);
  };

  const handlePostGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    setGrnError(null);
    setGrnSubmitting(true);

    try {
      const itemsPayload = receiptItems.map((r) => ({
        purchaseItemId: r.purchaseItemId,
        receivedQuantity: Number(r.acceptedQuantity) + Number(r.rejectedQuantity || 0),
        acceptedQuantity: Number(r.acceptedQuantity),
        rejectedQuantity: Number(r.rejectedQuantity || 0),
        batchNumber: r.batchNumber,
        rejectionReason: r.rejectionReason,
      }));

      await api.post('/goods-receipts', {
        purchaseId: selectedPO.id,
        challanNumber,
        vehicleNumber,
        items: itemsPayload,
        notes: grnNotes,
      });

      setShowGRNModal(false);
      setSelectedPO(null);
      fetchPurchasesAndGRNs();
      setActiveTab('GRNS');
    } catch (err: any) {
      setGrnError(err.message || 'Failed to post Goods Receipt Note');
    } finally {
      setGrnSubmitting(false);
    }
  };

  const filteredPOs = purchases.filter((p) => {
    return (
      p.purchaseNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.name.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase & Goods Receipt Management</h1>
          <p className="text-sm text-gray-500">
            Procurement workflow from purchase orders to physical Goods Receipt Notes (GRN) and FIFO stock ledger entry
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminOrSupervisor && (
            <button
              onClick={() => setShowPOModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200">
        <button
          onClick={() => setActiveTab('POS')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 ${
            activeTab === 'POS'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Purchase Orders ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('GRNS')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 ${
            activeTab === 'GRNS'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          Goods Receipt Notes (GRN) ({grns.length})
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search PO # or supplier name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <span className="text-xs text-gray-500">
          Showing {activeTab === 'POS' ? filteredPOs.length : grns.length} records
        </span>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'POS' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="p-3">PO Number</th>
                  <th className="p-3">Order Date</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Materials Ordered</th>
                  <th className="p-3">Taxable Value</th>
                  <th className="p-3">GST</th>
                  <th className="p-3">Grand Total</th>
                  <th className="p-3">PO Status</th>
                  {isAdminOrSupervisor && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">Loading purchase orders...</td>
                  </tr>
                ) : filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">No purchase orders found.</td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    const isDraft = po.status === 'DRAFT';
                    const isConfirmed = po.status === 'CONFIRMED';
                    const isPartial = po.status === 'PARTIALLY_RECEIVED';
                    const isReceived = po.status === 'RECEIVED';
                    return (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="p-3 font-mono font-bold text-gray-900">{po.purchaseNumber}</td>
                        <td className="p-3 text-gray-500">{new Date(po.purchaseDate).toLocaleDateString()}</td>
                        <td className="p-3 font-semibold text-gray-800">{po.supplier?.name}</td>
                        <td className="p-3 max-w-xs truncate text-gray-600">
                          {po.items?.map((it: any) => `${it.rawMaterial?.name || it.packagingMaterial?.name}: ${Number(it.quantity)} ${it.unit} @ ₹${Number(it.unitPrice)}`).join(', ')}
                        </td>
                        <td className="p-3 font-medium">₹{Number(po.totalTaxable).toLocaleString('en-IN')}</td>
                        <td className="p-3 text-emerald-700 font-medium">₹{Number(po.totalGst).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-bold text-gray-900">₹{Number(po.grandTotal).toLocaleString('en-IN')}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isReceived
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPartial
                                ? 'bg-indigo-100 text-indigo-800'
                                : isConfirmed
                                ? 'bg-brand-100 text-brand-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {po.status}
                          </span>
                        </td>
                        {isAdminOrSupervisor && (
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isDraft && (
                                <button
                                  onClick={() => handleConfirmPO(po.id)}
                                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold"
                                >
                                  Confirm PO
                                </button>
                              )}
                              {(isConfirmed || isPartial) && (
                                <button
                                  onClick={() => openGRNModal(po)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center gap-1"
                                >
                                  <Truck className="w-3 h-3" />
                                  Receive GRN
                                </button>
                              )}
                              {isReceived && (
                                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Received
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GOODS RECEIPT NOTES (GRN) */}
      {activeTab === 'GRNS' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="p-3">GRN #</th>
                  <th className="p-3">Receipt Date</th>
                  <th className="p-3">Purchase Order</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Challan / Vehicle</th>
                  <th className="p-3">Materials Accepted</th>
                  <th className="p-3">Rejected Qty</th>
                  <th className="p-3">Received By</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">No Goods Receipt Notes posted yet.</td>
                  </tr>
                ) : (
                  grns.map((grn) => (
                    <tr key={grn.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-gray-900">{grn.grnNumber}</td>
                      <td className="p-3 text-gray-500">{new Date(grn.receiptDate).toLocaleDateString()}</td>
                      <td className="p-3 font-mono text-brand-700 font-semibold">{grn.purchase?.purchaseNumber}</td>
                      <td className="p-3 font-medium text-gray-800">{grn.purchase?.supplier?.name}</td>
                      <td className="p-3 text-gray-600">
                        {grn.challanNumber || 'N/A'} {grn.vehicleNumber ? `• ${grn.vehicleNumber}` : ''}
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        {grn.items?.map((it: any) => `${it.rawMaterial?.name || it.packagingMaterial?.name}: ${Number(it.acceptedQuantity)} ${it.unit}`).join(', ')}
                      </td>
                      <td className="p-3 font-bold text-rose-700">
                        {grn.items?.reduce((sum: number, it: any) => sum + Number(it.rejectedQuantity || 0), 0) > 0
                          ? `${grn.items?.reduce((sum: number, it: any) => sum + Number(it.rejectedQuantity || 0), 0)} rejected`
                          : '0'}
                      </td>
                      <td className="p-3 text-gray-700">{grn.receivedBy?.fullName || 'Store Keeper'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {grn.status}
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

      {/* CREATE PO MODAL */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreatePO} className="bg-white rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Create Material Purchase Order</h3>
            <p className="text-xs text-gray-500">
              Draft or confirmed purchase order with itemized raw/packaging materials and statutory GST calculations.
            </p>

            {poError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
                {poError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                  required
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city || 'Tamil Nadu'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Status</label>
                <select
                  value={poStatus}
                  onChange={(e) => setPoStatus(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                >
                  <option value="CONFIRMED">CONFIRMED (Ready for Goods Receipt)</option>
                  <option value="DRAFT">DRAFT (Requires Confirmation)</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Line Items</span>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Material
                </button>
              </div>

              {lineItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <label className="block text-[10px] font-medium text-gray-500">Type</label>
                      <select
                        value={item.itemType}
                        onChange={(e) => handleLineItemChange(idx, 'itemType', e.target.value)}
                        className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white"
                      >
                        <option value="RAW_MATERIAL">Raw Material</option>
                        <option value="PACKAGING">Packaging</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className="block text-[10px] font-medium text-gray-500">Item</label>
                      <select
                        value={item.itemId}
                        onChange={(e) => handleLineItemChange(idx, 'itemId', e.target.value)}
                        className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white"
                        required
                      >
                        {(item.itemType === 'RAW_MATERIAL' ? rawMaterials : packagingMaterials).map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} [{it.code}]
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-medium text-gray-500">Qty ({item.unit})</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(idx, 'quantity', Number(e.target.value))}
                        className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white font-bold"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-medium text-gray-500">Rate (₹)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(idx, 'unitPrice', Number(e.target.value))}
                        className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white font-bold"
                        required
                      />
                    </div>
                    <div className="col-span-1 pt-4 text-right">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations Banner */}
            <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-xs flex items-center justify-between font-medium text-brand-900">
              <span>Taxable: <strong>₹{totals.taxable.toLocaleString('en-IN')}</strong></span>
              <span>GST (5%): <strong>₹{totals.gst.toLocaleString('en-IN')}</strong></span>
              <span className="text-sm font-bold text-brand-950">
                Grand Total: ₹{totals.grandTotal.toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Terms</label>
              <input
                type="text"
                placeholder="e.g. Delivery within 3 business days..."
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowPOModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={poSubmitting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow disabled:opacity-50"
              >
                {poSubmitting ? 'Creating...' : 'Create Purchase Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GOODS RECEIPT NOTE (GRN) MODAL */}
      {showGRNModal && selectedPO && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePostGRN} className="bg-white rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">
              Goods Receipt Note (GRN) for {selectedPO.purchaseNumber}
            </h3>
            <p className="text-xs text-gray-500">
              Supplier: <strong>{selectedPO.supplier?.name}</strong>. Only accepted quantities will increase inventory and create FIFO valuation layers.
            </p>

            {grnError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
                {grnError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Challan / DC #</label>
                <input
                  type="text"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vehicle Number</label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2"
                />
              </div>
            </div>

            {/* Receipt Items Breakdown */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                Verification & Acceptance of Received Quantities
              </span>

              {receiptItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2 text-xs">
                  <div className="font-bold text-gray-900 flex justify-between">
                    <span>{item.itemName}</span>
                    <span className="text-gray-500">
                      Ordered: {item.orderedQuantity} {item.unit} | Outstanding: {item.outstandingQuantity} {item.unit}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-emerald-800 mb-0.5">
                        Accepted Qty ({item.unit})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={item.outstandingQuantity}
                        step="0.01"
                        value={item.acceptedQuantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const updated = [...receiptItems];
                          updated[idx].acceptedQuantity = val;
                          setReceiptItems(updated);
                        }}
                        className="w-full text-xs border border-emerald-300 bg-emerald-50 rounded p-1.5 font-bold text-emerald-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-rose-800 mb-0.5">
                        Rejected / Damaged Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rejectedQuantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const updated = [...receiptItems];
                          updated[idx].rejectedQuantity = val;
                          setReceiptItems(updated);
                        }}
                        className="w-full text-xs border border-rose-300 bg-rose-50 rounded p-1.5 font-bold text-rose-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                        Batch Number
                      </label>
                      <input
                        type="text"
                        value={item.batchNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...receiptItems];
                          updated[idx].batchNumber = val;
                          setReceiptItems(updated);
                        }}
                        className="w-full text-xs border border-gray-300 rounded p-1.5 bg-white font-mono"
                      />
                    </div>
                  </div>

                  {item.rejectedQuantity > 0 && (
                    <div>
                      <label className="block text-[10px] font-medium text-rose-700 mb-0.5">
                        Rejection Reason (Mandatory when rejected &gt; 0)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Torn bag, moisture contamination..."
                        value={item.rejectionReason}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...receiptItems];
                          updated[idx].rejectionReason = val;
                          setReceiptItems(updated);
                        }}
                        className="w-full text-xs border border-rose-200 rounded p-1 bg-white"
                        required
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Receipt Inspection Notes</label>
              <input
                type="text"
                placeholder="e.g. Weighbridge verified, physical seal intact..."
                value={grnNotes}
                onChange={(e) => setGrnNotes(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowGRNModal(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={grnSubmitting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow disabled:opacity-50"
              >
                {grnSubmitting ? 'Posting...' : 'Post Goods Receipt Note (GRN)'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
