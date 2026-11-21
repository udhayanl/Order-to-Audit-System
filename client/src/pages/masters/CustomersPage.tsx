import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Users, Search, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Building2, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // Modals & alerts
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'RETAILER',
    gstin: '',
    billingAddress: '',
    shippingAddress: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    contactNumber: '',
    email: '',
    creditLimit: 50000,
    salesmanId: '',
  });

  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const loadData = async () => {
    try {
      setLoading(true);
      const custs = await api.get('/master/customers');
      setCustomers(custs || []);
      // Salesmen list for assignment dropdown
      const usersRes = await api.get('/audit/logs').catch(() => null); // or fetch salesmen
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStateChange = (stateName: string) => {
    let code = '33';
    if (stateName === 'Karnataka') code = '29';
    if (stateName === 'Kerala') code = '32';
    if (stateName === 'Andhra Pradesh') code = '37';
    if (stateName === 'Telangana') code = '36';
    setFormData({ ...formData, state: stateName, stateCode: code });
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await api.post('/master/customers', {
        ...formData,
        creditLimit: Number(formData.creditLimit),
      });
      setSuccessMsg('Customer registered successfully');
      setIsCreateOpen(false);
      setFormData({
        name: '',
        type: 'RETAILER',
        gstin: '',
        billingAddress: '',
        shippingAddress: '',
        state: 'Tamil Nadu',
        stateCode: '33',
        contactNumber: '',
        email: '',
        creditLimit: 50000,
        salesmanId: '',
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create customer');
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setErrorMsg(null);
    try {
      await api.put(`/master/customers/${editingCustomer.id}`, {
        name: formData.name,
        type: formData.type,
        gstin: formData.gstin,
        billingAddress: formData.billingAddress,
        shippingAddress: formData.shippingAddress,
        state: formData.state,
        stateCode: formData.stateCode,
        contactNumber: formData.contactNumber,
        email: formData.email,
        creditLimit: Number(formData.creditLimit),
        salesmanId: formData.salesmanId || null,
      });
      setSuccessMsg('Customer updated successfully');
      setEditingCustomer(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update customer');
    }
  };

  const handleDeleteCustomer = async (customer: any) => {
    if (!window.confirm(`Are you sure you want to delete customer ${customer.name}?`)) return;
    setErrorMsg(null);
    try {
      await api.delete(`/master/customers/${customer.id}`);
      setSuccessMsg(`Customer ${customer.name} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete customer');
    }
  };

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase())) ||
      c.contactNumber.includes(search) ||
      c.state.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || c.type === typeFilter;
    const matchesState = !stateFilter || c.state === stateFilter;
    return matchesSearch && matchesType && matchesState;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Master Registry</h1>
          <p className="text-sm text-gray-500">
            Retailers, distributors, GSTIN compliance, state codes and assigned sales representatives
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setFormData({
                name: '',
                type: 'RETAILER',
                gstin: '',
                billingAddress: '',
                shippingAddress: '',
                state: 'Tamil Nadu',
                stateCode: '33',
                contactNumber: '',
                email: '',
                creditLimit: 50000,
                salesmanId: '',
              });
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
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

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, GSTIN, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 w-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
          >
            <option value="">All Types</option>
            <option value="RETAILER">Retailer</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
          >
            <option value="">All States</option>
            <option value="Tamil Nadu">Tamil Nadu (33)</option>
            <option value="Karnataka">Karnataka (29)</option>
            <option value="Kerala">Kerala (32)</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">State & Code</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Assigned Salesman</th>
                <th className="p-3">Credit Limit</th>
                <th className="p-3">Billing Address</th>
                {canEdit && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-gray-400">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-gray-400">No customers found.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{c.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${c.type === 'DISTRIBUTOR' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-800">{c.gstin || 'Unregistered'}</td>
                    <td className="p-3">
                      {c.state} <span className="font-bold text-gray-700">({c.stateCode})</span>
                    </td>
                    <td className="p-3">{c.contactNumber}</td>
                    <td className="p-3 font-medium text-brand-700">{c.salesman?.fullName || 'Unassigned'}</td>
                    <td className="p-3 font-bold text-gray-900">₹{Number(c.creditLimit).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-gray-500 max-w-xs truncate">{c.billingAddress}</td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingCustomer(c);
                              setFormData({
                                name: c.name,
                                type: c.type,
                                gstin: c.gstin || '',
                                billingAddress: c.billingAddress,
                                shippingAddress: c.shippingAddress || c.billingAddress,
                                state: c.state,
                                stateCode: c.stateCode,
                                contactNumber: c.contactNumber,
                                email: c.email || '',
                                creditLimit: Number(c.creditLimit),
                                salesmanId: c.salesmanId || '',
                              });
                            }}
                            className="p-1 rounded text-gray-500 hover:text-brand-600 hover:bg-gray-100"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100"
                            title="Delete Customer"
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

      {/* Create / Edit Customer Modal */}
      {(isCreateOpen || editingCustomer) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-gray-900">
                {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Register New Customer Account'}
              </h3>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingCustomer(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={editingCustomer ? handleUpdateCustomer : handleCreateCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Customer / Trade Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g. Sri Krishna Sweets & Snacks"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Category</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="RETAILER">Retailer (Local Shop / Sweet Stall)</option>
                    <option value="DISTRIBUTOR">Distributor (Wholesale Stockist)</option>
                  </select>
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                  <select
                    value={formData.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="Tamil Nadu">Tamil Nadu (Code 33)</option>
                    <option value="Karnataka">Karnataka (Code 29)</option>
                    <option value="Kerala">Kerala (Code 32)</option>
                    <option value="Andhra Pradesh">Andhra Pradesh (Code 37)</option>
                    <option value="Telangana">Telangana (Code 36)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="+91 94431 00000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Billing Address</label>
                <textarea
                  required
                  rows={2}
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value, shippingAddress: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  placeholder="Full street address, district, state and PIN code"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                    placeholder="order@customer.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
                >
                  {editingCustomer ? 'Save Customer' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
