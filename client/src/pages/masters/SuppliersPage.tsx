import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Truck, Search, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Database, Upload, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals & alerts
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    address: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    contactPerson: '',
    contactNumber: '',
    email: '',
  });

  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.get('/master/suppliers');
      setSuppliers(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await api.post('/master/suppliers', formData);
      setSuccessMsg('Supplier registered successfully');
      setIsCreateOpen(false);
      setFormData({
        name: '',
        gstin: '',
        address: '',
        state: 'Tamil Nadu',
        stateCode: '33',
        contactPerson: '',
        contactNumber: '',
        email: '',
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create supplier');
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setErrorMsg(null);
    try {
      await api.put(`/master/suppliers/${editingSupplier.id}`, formData);
      setSuccessMsg('Supplier updated successfully');
      setEditingSupplier(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update supplier');
    }
  };

  const handleImportSampleDataset = async () => {
    if (!window.confirm('Import the comprehensive South Indian food manufacturing enterprise dataset? This will populate verified suppliers, customers, raw materials, BOM recipes and compliance records.')) return;
    setErrorMsg(null);
    setIsImporting(true);
    try {
      await api.post('/master/import-sample-dataset');
      setSuccessMsg('Comprehensive enterprise dataset imported successfully! Suppliers registry refreshed.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import dataset');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!csvText.trim()) {
      setErrorMsg('Please paste CSV text or load sample data.');
      return;
    }

    try {
      const lines = csvText.trim().split('\n').filter((l) => l.trim().length > 0);
      const rows = lines
        .map((line) => {
          const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
          return {
            name: parts[0] || '',
            gstin: parts[1] || '',
            address: parts[2] || '',
            state: parts[3] || 'Tamil Nadu',
            stateCode: parts[4] || '33',
            contactPerson: parts[5] || '',
            contactNumber: parts[6] || '',
            email: parts[7] || '',
          };
        })
        .filter((s) => s.name && s.address && s.contactNumber);

      if (rows.length === 0) {
        throw new Error('No valid supplier rows found in CSV. Format: Name,GSTIN,Address,State,StateCode,ContactPerson,Phone,Email');
      }

      await api.post('/master/suppliers/bulk-import', { suppliers: rows });
      setSuccessMsg(`Successfully imported ${rows.length} suppliers from CSV!`);
      setIsCsvModalOpen(false);
      setCsvText('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'CSV Import failed');
    }
  };

  const handleDeleteSupplier = async (supplier: any) => {
    if (!window.confirm(`Are you sure you want to delete supplier ${supplier.name}?`)) return;
    setErrorMsg(null);
    try {
      await api.delete(`/master/suppliers/${supplier.id}`);
      setSuccessMsg(`Supplier ${supplier.name} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete supplier');
    }
  };

  const filtered = suppliers.filter((s) => {
    return (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(search.toLowerCase())) ||
      s.contactNumber.includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Suppliers Registry</h1>
          <p className="text-sm text-gray-500">
            Raw ingredient mills, edible oil refiners, spice merchants and packaging manufacturers
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleImportSampleDataset}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-sm disabled:opacity-50"
              title="Import 8 South Indian agricultural and packaging suppliers, raw materials, customers and products"
            >
              {isImporting ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" /> : <Database className="w-4 h-4 text-emerald-600" />}
              {isImporting ? 'Importing Dataset...' : 'Import Dataset'}
            </button>
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-sm"
              title="Import suppliers from CSV text"
            >
              <Upload className="w-4 h-4 text-blue-600" /> Import CSV
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: '',
                  gstin: '',
                  address: '',
                  state: 'Tamil Nadu',
                  stateCode: '33',
                  contactPerson: '',
                  contactNumber: '',
                  email: '',
                });
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900 font-bold">×</button>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, GSTIN, person..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Address</th>
                <th className="p-3">State & Code</th>
                <th className="p-3">Contact Person</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Email</th>
                {canEdit && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="p-8 text-center text-gray-400">Loading suppliers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="p-8 text-center text-gray-400">No suppliers registered.</td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{s.name}</td>
                    <td className="p-3 font-semibold text-gray-800">{s.gstin || 'Unregistered'}</td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">{s.address}</td>
                    <td className="p-3">{s.state} ({s.stateCode})</td>
                    <td className="p-3 font-medium text-gray-700">{s.contactPerson || '—'}</td>
                    <td className="p-3">{s.contactNumber}</td>
                    <td className="p-3 text-gray-500">{s.email || '—'}</td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingSupplier(s);
                              setFormData({
                                name: s.name,
                                gstin: s.gstin || '',
                                address: s.address,
                                state: s.state,
                                stateCode: s.stateCode,
                                contactPerson: s.contactPerson || '',
                                contactNumber: s.contactNumber,
                                email: s.email || '',
                              });
                            }}
                            className="p-1 rounded text-gray-500 hover:text-brand-600 hover:bg-gray-100"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(s)}
                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100"
                            title="Delete Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Supplier Modal */}
      {(isCreateOpen || editingSupplier) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-gray-900">
                {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Vendor / Supplier'}
              </h3>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingSupplier(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={editingSupplier ? handleUpdateSupplier : handleCreateSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company / Mill Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g. Sri Annapoorna Agri Mills"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="33AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">State & State Code</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="Tamil Nadu (33)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Registered Business Address</label>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="Street, Industrial Estate, City, PIN"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="e.g. Periasamy"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="+91 94422 00000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="sales@supplier.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingSupplier(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
                >
                  {editingSupplier ? 'Save Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-lg w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-gray-900">Import Suppliers from CSV</h2>
              </div>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Paste comma-separated rows. Columns required:<br />
              <code className="text-brand-600 font-mono text-[11px] bg-gray-50 px-1 py-0.5 rounded">
                Name, GSTIN, Address, State, StateCode, ContactPerson, Phone, Email
              </code>
            </p>

            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-gray-700">CSV Data:</span>
              <button
                type="button"
                onClick={() => {
                  setCsvText(
                    `"Salem Agro Refineries","33AAACS9999Z1Z0","Bazaar St, Salem","Tamil Nadu","33","K. Sundar","+91 94432 11990","sales@salemagro.in"\n` +
                    `"Bangalore Corrugated Boxes Ltd","29AABCB8888Y1Z1","Peenya Indl Area, Bengaluru","Karnataka","29","R. Prasad","+91 98450 44556","orders@bangalorebox.com"\n` +
                    `"Calicut Spices Extraction","32AABCC7777X1Z2","Big Bazaar, Kozhikode","Kerala","32","M. Joseph","+91 98471 66778","calicutspices@gmail.com"`
                  );
                }}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> Load Sample Rows
              </button>
            </div>

            <form onSubmit={handleImportCsv} className="space-y-4">
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV rows here or click 'Load Sample Rows'..."
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  Import Rows
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
