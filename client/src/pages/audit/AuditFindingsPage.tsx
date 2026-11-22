import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  X,
  User,
  Calendar,
  FileText,
  ShieldAlert,
} from 'lucide-react';

export const AuditFindingsPage: React.FC = () => {
  const [findings, setFindings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Create Finding Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFinding, setNewFinding] = useState({
    title: '',
    auditSessionId: '',
    category: 'QUALITY',
    severity: 'MAJOR',
    description: '',
    correctiveAction: '',
    assignedToId: '',
    targetDate: '',
  });

  // Update Status Modal
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);
  const [updateStatus, setUpdateStatus] = useState('IN_PROGRESS');
  const [updateNotes, setUpdateNotes] = useState('');

  const fetchFindings = () => {
    setLoading(true);
    const params: any = {};
    if (search) params.search = search;
    if (severityFilter) params.severity = severityFilter;
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;

    api.get('/audit/findings', { params })
      .then((res: any) => {
        setFindings(res.data || res || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchUsersAndSessions = () => {
    Promise.all([
      api.get('/auth/me').catch(() => null),
      api.get('/audit/sessions').catch(() => null),
    ]).then(([_, sessRes]: [any, any]) => {
      setSessions(sessRes?.data || sessRes || []);
    });
  };

  useEffect(() => {
    fetchFindings();
    fetchUsersAndSessions();
  }, [severityFilter, statusFilter, categoryFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/audit/findings', newFinding);
      setIsCreateModalOpen(false);
      setNewFinding({
        title: '',
        auditSessionId: '',
        category: 'QUALITY',
        severity: 'MAJOR',
        description: '',
        correctiveAction: '',
        assignedToId: '',
        targetDate: '',
      });
      fetchFindings();
      alert('Audit finding and corrective action plan recorded!');
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to create finding.');
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinding) return;

    try {
      await api.patch(`/audit/findings/${selectedFinding.id}`, {
        status: updateStatus,
        resolutionNotes: updateNotes,
      });
      setIsUpdateModalOpen(false);
      setSelectedFinding(null);
      setUpdateNotes('');
      fetchFindings();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to update finding.');
    }
  };

  const openUpdateModal = (finding: any) => {
    setSelectedFinding(finding);
    setUpdateStatus(finding.status === 'OPEN' ? 'IN_PROGRESS' : 'RESOLVED');
    setUpdateNotes(finding.resolutionNotes || '');
    setIsUpdateModalOpen(true);
  };

  const filteredFindings = findings.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.findingNumber.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.assignedTo?.fullName?.toLowerCase().includes(q)
    );
  });

  const criticalCount = findings.filter(f => f.severity === 'CRITICAL' && f.status !== 'CLOSED').length;
  const openCount = findings.filter(f => f.status === 'OPEN').length;
  const resolvedCount = findings.filter(f => f.status === 'RESOLVED' || f.status === 'CLOSED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-brand-600" />
            Audit Findings & CAPA Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Corrective and Preventive Actions (CAPA) tracking, issue assignments, and statutory resolution milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm text-sm font-semibold transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Log New Finding
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Recorded Issues</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 font-mono">{findings.length}</div>
          <div className="text-xs text-gray-400 mt-1">Across all audit sessions</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm bg-rose-50/20">
          <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Critical Open Issues</div>
          <div className="mt-2 text-2xl font-bold text-rose-700 font-mono">{criticalCount}</div>
          <div className="text-xs text-rose-700/80 mt-1">High statutory priority</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm bg-amber-50/20">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Open / In Progress</div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono">{openCount}</div>
          <div className="text-xs text-amber-700/80 mt-1">Assigned to team members</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Resolved & Closed</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">{resolvedCount}</div>
          <div className="text-xs text-emerald-700/80 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Audited & Verified
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search finding #, title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 w-52"
            />
          </div>

          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
          >
            <option value="">All Categories</option>
            <option value="INVENTORY">Inventory</option>
            <option value="PRODUCTION">Production</option>
            <option value="QUALITY">Quality Control</option>
            <option value="FINANCIAL">Financial</option>
            <option value="HYGIENE">Hygiene & Safety</option>
            <option value="REGULATORY">Regulatory (FSSAI)</option>
          </select>
        </div>

        <button
          onClick={fetchFindings}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Findings Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Audit Findings Register ({filteredFindings.length} items)
          </h2>
          <span className="text-xs text-gray-500">CAPA Lifecycle Workflow</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Finding #</th>
                <th className="py-3 px-4">Title & Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Target Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading findings...
                  </td>
                </tr>
              ) : filteredFindings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No findings matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFindings.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700 whitespace-nowrap">
                      {f.findingNumber}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-semibold text-gray-900 text-xs">{f.title}</div>
                      <div className="text-[11px] text-gray-500 line-clamp-1" title={f.description}>
                        {f.description}
                      </div>
                      {f.correctiveAction && (
                        <div className="text-[10px] text-brand-700 mt-0.5 line-clamp-1 italic">
                          CAPA: {f.correctiveAction}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {f.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : f.severity === 'MAJOR'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {f.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">
                      {f.assignedTo?.fullName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {f.targetDate ? new Date(f.targetDate).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          f.status === 'RESOLVED' || f.status === 'CLOSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : f.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openUpdateModal(f)}
                        className="text-xs text-brand-600 hover:text-brand-800 font-semibold underline"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE FINDING MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900 text-sm">Log Audit Finding & CAPA Action</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title / Finding Summary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frying kettle oil temperature deviation"
                  value={newFinding.title}
                  onChange={e => setNewFinding({ ...newFinding, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={newFinding.category}
                    onChange={e => setNewFinding({ ...newFinding, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="QUALITY">Quality Control</option>
                    <option value="INVENTORY">Inventory</option>
                    <option value="PRODUCTION">Production</option>
                    <option value="FINANCIAL">Financial</option>
                    <option value="HYGIENE">Hygiene & Safety</option>
                    <option value="REGULATORY">Regulatory (FSSAI)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Severity</label>
                  <select
                    value={newFinding.severity}
                    onChange={e => setNewFinding({ ...newFinding, severity: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg font-bold"
                  >
                    <option value="CRITICAL">CRITICAL (Immediate Action)</option>
                    <option value="MAJOR">MAJOR (7 Days)</option>
                    <option value="MINOR">MINOR (Routine)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe observed violation or discrepancy..."
                  value={newFinding.description}
                  onChange={e => setNewFinding({ ...newFinding, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Corrective Action Plan (CAPA)</label>
                <textarea
                  rows={2}
                  placeholder="Action to prevent recurrence..."
                  value={newFinding.correctiveAction}
                  onChange={e => setNewFinding({ ...newFinding, correctiveAction: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Resolution Date</label>
                <input
                  type="date"
                  value={newFinding.targetDate}
                  onChange={e => setNewFinding({ ...newFinding, targetDate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700"
                >
                  Record Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {isUpdateModalOpen && selectedFinding && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900 text-sm">Update Finding #{selectedFinding.findingNumber}</h3>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Transition Status</label>
                <select
                  value={updateStatus}
                  onChange={e => setUpdateStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-bold"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Remediation active)</option>
                  <option value="RESOLVED">RESOLVED (Action executed)</option>
                  <option value="CLOSED">CLOSED (Auditor signed-off)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Notes & Evidence
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail actions taken to resolve this finding..."
                  value={updateNotes}
                  onChange={e => setUpdateNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
