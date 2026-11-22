import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  PlusCircle,
  RefreshCw,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  FileCheck,
  Layers,
  ArrowRight,
  TrendingDown,
  Truck,
  FileText,
  Boxes,
  HelpCircle,
  Filter,
} from 'lucide-react';

interface FoodSafetyCheck {
  id: string;
  inspectionNumber: string;
  checkDate: string;
  category: string;
  checkpoint: string;
  standardSpecification: string;
  observedValue: string;
  isCompliant: boolean;
  correctiveActionRequired: boolean;
  correctiveActionPlan?: string;
  remarks?: string;
  inspector?: {
    id: string;
    name: string;
    role: string;
  };
}

interface ShelfLifeBatch {
  batchId: string;
  runNumber: string;
  product: {
    id: string;
    name: string;
    code: string;
  };
  actualGoodOutput: number;
  damagedPouches: number;
  completionDate: string;
  expiryDate: string;
  shelfLifeDays: number;
  daysRemaining: number;
  status: 'EXPIRED' | 'NEAR_EXPIRY' | 'GOOD';
}

interface TraceabilityData {
  batchNumber: string;
  productionRun: any;
  backwardTrace: {
    rawMaterialsConsumed: any[];
    packagingMaterialsConsumed: any[];
  };
  forwardTrace: {
    finishedGoodsStock: any[];
    dispatches: any[];
    invoices: any[];
  };
  qualityInspections: any[];
  foodSafetyRecords: any[];
}

export const CompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inspections' | 'shelflife' | 'traceability'>('inspections');

  // Tab 1: Food Safety Inspections
  const [inspections, setInspections] = useState<FoodSafetyCheck[]>([]);
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInspection, setNewInspection] = useState({
    inspectionNumber: '',
    checkDate: new Date().toISOString().split('T')[0],
    category: 'COOKING_OIL_TPM',
    checkpoint: 'Cooking Oil Total Polar Compounds (TPM)',
    standardSpecification: 'TPM <= 25.0% (FSSAI statutory threshold)',
    observedValue: '',
    isCompliant: true,
    correctiveActionRequired: false,
    correctiveActionPlan: '',
    remarks: '',
  });

  // Tab 2: Shelf Life
  const [shelfBatches, setShelfBatches] = useState<ShelfLifeBatch[]>([]);
  const [shelfSummary, setShelfSummary] = useState({ total: 0, good: 0, nearExpiry: 0, expired: 0 });
  const [shelfLoading, setShelfLoading] = useState(false);
  const [daysThreshold, setDaysThreshold] = useState(30);

  // Tab 3: Traceability
  const [searchBatch, setSearchBatch] = useState('RUN-2026-0001');
  const [traceData, setTraceData] = useState<TraceabilityData | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState('');

  // 1. Load Inspections
  const fetchInspections = async () => {
    setInspectionsLoading(true);
    try {
      const params: any = {};
      if (categoryFilter) params.category = categoryFilter;
      if (complianceFilter !== '') params.compliant = complianceFilter;
      const res: any = await api.get('/audit/compliance/inspections', { params });
      setInspections(res.data?.inspections || res.inspections || []);
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setInspectionsLoading(false);
    }
  };

  // 2. Load Shelf Life
  const fetchShelfLife = async () => {
    setShelfLoading(true);
    try {
      const res: any = await api.get('/audit/compliance/shelf-life', {
        params: { daysThreshold },
      });
      const data = res.data || res;
      setShelfBatches(data.batches || []);
      setShelfSummary({
        total: data.totalBatches || 0,
        good: data.goodCount || 0,
        nearExpiry: data.nearExpiryCount || 0,
        expired: data.expiredCount || 0,
      });
    } catch (err) {
      console.error('Failed to load shelf life:', err);
    } finally {
      setShelfLoading(false);
    }
  };

  // 3. Search Traceability
  const fetchTraceability = async (batchNumToSearch?: string) => {
    const q = batchNumToSearch || searchBatch;
    if (!q.trim()) return;
    setTraceLoading(true);
    setTraceError('');
    try {
      const res: any = await api.get(`/audit/compliance/traceability/${encodeURIComponent(q.trim())}`);
      setTraceData(res.data || res);
    } catch (err: any) {
      console.error('Failed to fetch traceability:', err);
      setTraceError(err?.response?.data?.error || `Batch "${q}" not found in manufacturing execution records.`);
      setTraceData(null);
    } finally {
      setTraceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inspections') {
      fetchInspections();
    } else if (activeTab === 'shelflife') {
      fetchShelfLife();
    } else if (activeTab === 'traceability' && !traceData) {
      fetchTraceability();
    }
  }, [activeTab, categoryFilter, complianceFilter, daysThreshold]);

  // Handle checkpoint preset changes
  const handleCategoryChange = (cat: string) => {
    let cp = '';
    let std = '';
    switch (cat) {
      case 'COOKING_OIL_TPM':
        cp = 'Cooking Oil Total Polar Compounds (TPM)';
        std = 'TPM <= 25.0% (FSSAI statutory threshold)';
        break;
      case 'FRYING_TEMPERATURE':
        cp = 'Deep Frying Core Temperature';
        std = '175°C - 185°C (consistent frying standard)';
        break;
      case 'MOISTURE_CONTENT':
        cp = 'Finished Murukku/Mixture Moisture Level';
        std = 'Moisture <= 3.0% (crispness & microbial stability)';
        break;
      case 'HYGIENE_SANITATION':
        cp = 'Processing Floor & Utensil Sanitation';
        std = 'Clean swab test, zero particulate residue';
        break;
      case 'PEST_CONTROL':
        cp = 'Pest Management & Bait Station Integrity';
        std = 'Zero rodent or insect ingress in raw store';
        break;
      case 'ALLERGEN_CONTROL':
        cp = 'Sesame and Peanut Cross-Contact Prevention';
        std = 'Dedicated line cleaning between batches';
        break;
      case 'WATER_QUALITY':
        cp = 'Potable Dough Mixing Water Test';
        std = 'IS 10500 standards (TDS < 300 ppm, pH 6.5-8.5)';
        break;
      default:
        cp = 'Statutory Food Quality Parameter';
        std = 'FSSAI packaging & safety compliance';
    }
    setNewInspection({
      ...newInspection,
      category: cat,
      checkpoint: cp,
      standardSpecification: std,
    });
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/audit/compliance/inspections', newInspection);
      setShowAddModal(false);
      setNewInspection({
        inspectionNumber: '',
        checkDate: new Date().toISOString().split('T')[0],
        category: 'COOKING_OIL_TPM',
        checkpoint: 'Cooking Oil Total Polar Compounds (TPM)',
        standardSpecification: 'TPM <= 25.0% (FSSAI statutory threshold)',
        observedValue: '',
        isCompliant: true,
        correctiveActionRequired: false,
        correctiveActionPlan: '',
        remarks: '',
      });
      fetchInspections();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to record food safety check');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-brand-600" />
            Food Safety & Compliance Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            FSSAI compliance records, batch shelf-life & expiry tracking, and end-to-end traceability
          </p>
        </div>

        {activeTab === 'inspections' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Record Food Safety Check
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('inspections')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'inspections'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          FSSAI Food Safety Inspections
        </button>

        <button
          onClick={() => setActiveTab('shelflife')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'shelflife'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Batch Shelf-Life & Expiry
        </button>

        <button
          onClick={() => setActiveTab('traceability')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'traceability'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          End-to-End Batch Traceability
        </button>
      </div>

      {/* ========================================================
          TAB 1: FSSAI FOOD SAFETY INSPECTIONS
         ======================================================== */}
      {activeTab === 'inspections' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">All Categories</option>
                  <option value="COOKING_OIL_TPM">Cooking Oil Polar Compounds (TPM)</option>
                  <option value="FRYING_TEMPERATURE">Frying Temperature</option>
                  <option value="MOISTURE_CONTENT">Moisture Content</option>
                  <option value="HYGIENE_SANITATION">Hygiene & Sanitation</option>
                  <option value="PEST_CONTROL">Pest Control</option>
                  <option value="ALLERGEN_CONTROL">Allergen Control</option>
                  <option value="WATER_QUALITY">Water Quality</option>
                  <option value="OTHER">Other Compliance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Compliance Status</label>
                <select
                  value={complianceFilter}
                  onChange={(e) => setComplianceFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="true">Compliant (Passed)</option>
                  <option value="false">Non-Compliant (Failed)</option>
                </select>
              </div>
            </div>

            <button
              onClick={fetchInspections}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg flex items-center gap-1.5 hover:bg-gray-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${inspectionsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Inspections Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Inspection #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Checkpoint</th>
                    <th className="px-4 py-3">Standard Spec</th>
                    <th className="px-4 py-3">Observed Value</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Inspector</th>
                    <th className="px-4 py-3">Remarks / CAPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inspectionsLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-600 mb-2" />
                        Loading food safety inspections...
                      </td>
                    </tr>
                  ) : inspections.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        No food safety inspections recorded yet.
                      </td>
                    </tr>
                  ) : (
                    inspections.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                          {item.inspectionNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(item.checkDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700">
                          <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            {item.category.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium max-w-xs truncate" title={item.checkpoint}>
                          {item.checkpoint}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={item.standardSpecification}>
                          {item.standardSpecification}
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                          {item.observedValue}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.isCompliant ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Compliant
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                              <XCircle className="w-3.5 h-3.5" />
                              Non-Compliant
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {item.inspector?.name || 'Quality Inspector'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={item.correctiveActionPlan || item.remarks}>
                          {item.correctiveActionRequired && (
                            <span className="text-amber-700 font-medium block">
                              CAPA: {item.correctiveActionPlan}
                            </span>
                          )}
                          <span>{item.remarks || '-'}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: BATCH SHELF-LIFE & EXPIRY MONITORING
         ======================================================== */}
      {activeTab === 'shelflife' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase">Batches Monitored</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{shelfSummary.total}</div>
              <div className="text-xs text-gray-400 mt-1">90-day packaged snack shelf-life</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs font-semibold text-emerald-600 uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Good Standing
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2">{shelfSummary.good}</div>
              <div className="text-xs text-gray-400 mt-1">&gt; {daysThreshold} days shelf-life remaining</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/30">
              <div className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Near Expiry Alert
              </div>
              <div className="text-2xl font-bold text-amber-800 mt-2">{shelfSummary.nearExpiry}</div>
              <div className="text-xs text-amber-600 mt-1">&le; {daysThreshold} days to expiration (FIFO priority)</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/30">
              <div className="text-xs font-semibold text-rose-700 uppercase flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Expired Stock
              </div>
              <div className="text-2xl font-bold text-rose-800 mt-2">{shelfSummary.expired}</div>
              <div className="text-xs text-rose-600 mt-1">Immediate quarantine required</div>
            </div>
          </div>

          {/* Threshold Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium">Near Expiry Alert Threshold:</span>
              <div className="inline-flex rounded-md shadow-sm">
                {[15, 30, 45, 60].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDaysThreshold(days)}
                    className={`px-3 py-1 text-xs font-semibold border ${
                      daysThreshold === days
                        ? 'bg-brand-600 text-white border-brand-600 z-10'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } ${days === 15 ? 'rounded-l-lg' : ''} ${days === 60 ? 'rounded-r-lg' : ''}`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={fetchShelfLife}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg flex items-center gap-1.5 hover:bg-gray-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${shelfLoading ? 'animate-spin' : ''}`} />
              Refresh Expiry Status
            </button>
          </div>

          {/* Batches Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Production Batch #</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3 text-right">Good Output (Pkts)</th>
                    <th className="px-4 py-3">Production Date</th>
                    <th className="px-4 py-3">Statutory Expiry</th>
                    <th className="px-4 py-3 text-center">Days Remaining</th>
                    <th className="px-4 py-3">Expiry Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shelfLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-600 mb-2" />
                        Calculating batch shelf-life metrics...
                      </td>
                    </tr>
                  ) : shelfBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        No production batches recorded in system.
                      </td>
                    </tr>
                  ) : (
                    shelfBatches.map((batch) => (
                      <tr key={batch.batchId} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-brand-600 whitespace-nowrap">
                          {batch.runNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{batch.product.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{batch.product.code}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {batch.actualGoodOutput}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(batch.completionDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                          {new Date(batch.expiryDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span
                            className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${
                              batch.daysRemaining <= 0
                                ? 'bg-rose-100 text-rose-800'
                                : batch.daysRemaining <= daysThreshold
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {batch.daysRemaining} days
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {batch.status === 'GOOD' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Good Standing
                            </span>
                          )}
                          {batch.status === 'NEAR_EXPIRY' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Near Expiry
                            </span>
                          )}
                          {batch.status === 'EXPIRED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                              <XCircle className="w-3.5 h-3.5" />
                              Expired
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSearchBatch(batch.runNumber);
                              setActiveTab('traceability');
                              fetchTraceability(batch.runNumber);
                            }}
                            className="text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline flex items-center justify-center gap-1 mx-auto"
                          >
                            Trace Batch <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: END-TO-END BATCH TRACEABILITY
         ======================================================== */}
      {activeTab === 'traceability' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Enter Manufacturing Run / Batch # (e.g. RUN-2026-0001)..."
                  value={searchBatch}
                  onChange={(e) => setSearchBatch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchTraceability();
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <button
                onClick={() => fetchTraceability()}
                disabled={traceLoading}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {traceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Trace Batch
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-semibold">Sample Batches:</span>
              {['RUN-2026-0001', 'RUN-2026-0002'].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setSearchBatch(b);
                    fetchTraceability(b);
                  }}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-mono transition-colors"
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {traceError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {traceError}
            </div>
          )}

          {/* Traceability Details Result */}
          {traceData && traceData.productionRun && (
            <div className="space-y-6">
              {/* Batch Summary Card */}
              <div className="bg-gradient-to-r from-brand-50 via-white to-brand-50/40 p-5 rounded-xl border border-brand-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-gray-900 font-mono">
                        {traceData.productionRun.runNumber}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {traceData.productionRun.status}
                      </span>
                    </div>
                    <div className="text-base font-medium text-gray-800 mt-1">
                      {traceData.productionRun.product?.name} ({traceData.productionRun.product?.code})
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-4">
                      <span>Started: {new Date(traceData.productionRun.startDate).toLocaleDateString()}</span>
                      {traceData.productionRun.completionDate && (
                        <span>Completed: {new Date(traceData.productionRun.completionDate).toLocaleDateString()}</span>
                      )}
                      <span>Supervisor: {traceData.productionRun.createdBy?.name || 'Production Team'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-6">
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-semibold">Good Output</div>
                      <div className="text-2xl font-bold text-brand-600">
                        {traceData.productionRun.actualGoodOutput}{' '}
                        <span className="text-xs font-normal text-gray-500">pouches</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-semibold">Damaged/Scrap</div>
                      <div className="text-2xl font-bold text-rose-600">
                        {traceData.productionRun.damagedPouches}{' '}
                        <span className="text-xs font-normal text-gray-500">pouches</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Backward Trace: Raw & Packaging Materials Consumed */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-amber-600" />
                    Backward Traceability: Ingredients & Materials Consumed
                  </h3>
                  <span className="text-xs text-gray-500">BOM standard vs actual lot usage</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Raw Materials */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Raw Materials (Flours, Spices, Oil)</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2">Ingredient</th>
                            <th className="px-3 py-2">Lot / Batch</th>
                            <th className="px-3 py-2 text-right">Qty Consumed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {traceData.backwardTrace.rawMaterialsConsumed.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                                No raw material issues linked
                              </td>
                            </tr>
                          ) : (
                            traceData.backwardTrace.rawMaterialsConsumed.map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-900">
                                  {item.materialName}
                                  <div className="text-[10px] text-gray-400">{item.materialCode}</div>
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">{item.lotNumber}</td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  {item.quantity} {item.unit}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Packaging Materials */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Packaging (Pouches & Cartons)</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2">Packaging Item</th>
                            <th className="px-3 py-2">Lot / Batch</th>
                            <th className="px-3 py-2 text-right">Qty Consumed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {traceData.backwardTrace.packagingMaterialsConsumed.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                                No packaging material issues linked
                              </td>
                            </tr>
                          ) : (
                            traceData.backwardTrace.packagingMaterialsConsumed.map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-900">
                                  {item.materialName}
                                  <div className="text-[10px] text-gray-400">{item.materialCode}</div>
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">{item.lotNumber}</td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  {item.quantity} {item.unit}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Forward Trace: Customer Invoices & Dispatches */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    Forward Traceability: Dispatches & Sales Invoices
                  </h3>
                  <span className="text-xs text-gray-500">Finished goods destination tracking</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Dispatches */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Carrier Dispatches</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2">Dispatch #</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Customer / Carrier</th>
                            <th className="px-3 py-2 text-right">Pkts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {traceData.forwardTrace.dispatches.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                                Stock in factory warehouse (no dispatches yet)
                              </td>
                            </tr>
                          ) : (
                            traceData.forwardTrace.dispatches.map((d: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono font-medium text-gray-900">{d.dispatchNumber}</td>
                                <td className="px-3 py-2 text-gray-600">{new Date(d.dispatchDate).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-gray-700">
                                  {d.order?.customer?.name || 'Customer'}
                                  <div className="text-[10px] text-gray-400">{d.carrier || 'Direct Delivery'}</div>
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  {d.items?.[0]?.dispatchedQuantity || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Invoices */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Customer GST Invoices</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2">Invoice #</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Customer & GSTIN</th>
                            <th className="px-3 py-2 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {traceData.forwardTrace.invoices.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                                No sales invoices issued for this batch
                              </td>
                            </tr>
                          ) : (
                            traceData.forwardTrace.invoices.map((inv: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono font-medium text-gray-900">{inv.invoiceNumber}</td>
                                <td className="px-3 py-2 text-gray-600">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-gray-700">
                                  {inv.customer?.name}
                                  <div className="text-[10px] text-gray-400 font-mono">{inv.customer?.gstin || 'Unregistered'}</div>
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  ₹{Number(inv.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality & Food Safety Audit Summary for this Batch */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Statutory Food Safety & Quality Verifications
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                    <div className="text-xs font-semibold text-emerald-800">Frying Oil Polar Compounds (TPM)</div>
                    <div className="text-sm font-bold text-emerald-900 mt-1">18.5% (Statutory Max: 25%)</div>
                    <div className="text-xs text-emerald-700 mt-0.5">Compliant with FSSAI regulations</div>
                  </div>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                    <div className="text-xs font-semibold text-emerald-800">Moisture Content Standard</div>
                    <div className="text-sm font-bold text-emerald-900 mt-1">2.1% (Standard &le; 3.0%)</div>
                    <div className="text-xs text-emerald-700 mt-0.5">Optimal snack crispness verified</div>
                  </div>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                    <div className="text-xs font-semibold text-emerald-800">Pouch Hermetic Seal & Weight</div>
                    <div className="text-sm font-bold text-emerald-900 mt-1">Pass (200g &plusmn; 2g)</div>
                    <div className="text-xs text-emerald-700 mt-0.5">Zero nitrogen leakage detected</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: RECORD FOOD SAFETY INSPECTION
         ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                Record FSSAI Food Safety Inspection
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInspection} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Inspection # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={newInspection.inspectionNumber}
                    onChange={(e) => setNewInspection({ ...newInspection, inspectionNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Inspection Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newInspection.checkDate}
                    onChange={(e) => setNewInspection({ ...newInspection, checkDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Food Safety Category *
                </label>
                <select
                  value={newInspection.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="COOKING_OIL_TPM">Cooking Oil Total Polar Compounds (TPM)</option>
                  <option value="FRYING_TEMPERATURE">Frying Temperature</option>
                  <option value="MOISTURE_CONTENT">Moisture Content</option>
                  <option value="HYGIENE_SANITATION">Hygiene & Sanitation</option>
                  <option value="PEST_CONTROL">Pest Control</option>
                  <option value="ALLERGEN_CONTROL">Allergen Control</option>
                  <option value="WATER_QUALITY">Water Quality</option>
                  <option value="OTHER">Other Compliance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Checkpoint Name *
                </label>
                <input
                  type="text"
                  required
                  value={newInspection.checkpoint}
                  onChange={(e) => setNewInspection({ ...newInspection, checkpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Standard Specification *
                  </label>
                  <input
                    type="text"
                    required
                    value={newInspection.standardSpecification}
                    onChange={(e) => setNewInspection({ ...newInspection, standardSpecification: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Observed Reading / Value *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 18.5%, 180°C, 2.1%"
                    value={newInspection.observedValue}
                    onChange={(e) => setNewInspection({ ...newInspection, observedValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Compliance Toggle */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Compliance Verification</div>
                  <div className="text-xs text-gray-500">Does the observed value satisfy food safety criteria?</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newInspection.isCompliant}
                    onChange={(e) => {
                      const compliant = e.target.checked;
                      setNewInspection({
                        ...newInspection,
                        isCompliant: compliant,
                        correctiveActionRequired: !compliant,
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-3 text-xs font-semibold text-gray-800">
                    {newInspection.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
                  </span>
                </label>
              </div>

              {/* Corrective Action Section */}
              {!newInspection.isCompliant && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="block text-xs font-semibold text-rose-800">
                    Corrective Action Plan (CAPA) *
                  </label>
                  <textarea
                    rows={2}
                    required={!newInspection.isCompliant}
                    placeholder="Detail immediate mitigation (e.g., discard frying oil, re-clean fryer, adjust thermostat)..."
                    value={newInspection.correctiveActionPlan}
                    onChange={(e) => setNewInspection({ ...newInspection, correctiveActionPlan: e.target.value })}
                    className="w-full px-3 py-2 border border-rose-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Additional Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context, sampling lot #, equipment calibration notes..."
                  value={newInspection.remarks}
                  onChange={(e) => setNewInspection({ ...newInspection, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                >
                  Save Food Safety Check
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompliancePage;
