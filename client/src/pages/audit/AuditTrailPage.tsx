import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import {
  Shield,
  Activity,
  Search,
  Filter,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  User,
  Eye,
  X,
  FileText,
} from 'lucide-react';

export const AuditTrailPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trail' | 'userActivity'>('trail');
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Payload modal
  const [selectedPayload, setSelectedPayload] = useState<{ title: string; previous: any; current: any } | null>(null);

  const fetchData = () => {
    setLoading(true);
    const endpoint = activeTab === 'trail' ? '/audit/trail' : '/audit/user-activity';
    const params: any = {};
    if (search) params.search = search;
    if (actionFilter) params.action = actionFilter;
    if (entityFilter) params.entityType = entityFilter;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    api.get(endpoint, { params })
      .then((res: any) => {
        const payload = res.data || res;
        setLogs(payload.logs || []);
        setTotalCount(payload.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, actionFilter, entityFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const exportCSV = () => {
    if (logs.length === 0) return;
    const isTrail = activeTab === 'trail';
    const headers = isTrail
      ? ['Timestamp,Action,Entity Type,Entity ID,User,Role,IP Address']
      : ['Timestamp,Action,Entity Type,User,Role,Description,IP Address'];

    const rows = logs.map(l => {
      const time = new Date(l.timestamp).toISOString();
      const uName = l.user?.fullName || 'System';
      const uRole = l.user?.role || 'SYSTEM';
      if (isTrail) {
        return `"${time}","${l.action}","${l.entityType}","${l.entityId}","${uName}","${uRole}","${l.ipAddress || ''}"`;
      } else {
        return `"${time}","${l.action}","${l.entityType}","${uName}","${uRole}","${(l.description || '').replace(/"/g, '""')}","${l.ipAddress || ''}"`;
      }
    });

    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab === 'trail' ? 'System_Audit_Trail' : 'User_Activity_Log'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Audit Trail & Activity Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tamper-evident chronological log of all entity modifications, approvals, dispatches, and user security events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('trail')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'trail'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            System Audit Trail (Immutable Records)
          </button>
          <button
            onClick={() => setActiveTab('userActivity')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'userActivity'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Activity className="w-4 h-4" />
            User Activity Tracker (Logins, Actions & IP)
          </button>
        </nav>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 flex-wrap flex-1">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search description, entity ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 w-56"
            />
          </div>

          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Entity Types</option>
            <option value="ORDER">Orders (SALES_ORDER)</option>
            <option value="INVOICE">Invoices (GST)</option>
            <option value="PRODUCTION_RUN">Production Batches</option>
            <option value="PURCHASE">Purchases</option>
            <option value="PAYMENT">Payments</option>
            <option value="EXPENSE">Expenses</option>
            <option value="STOCK">Stock Ledger</option>
            <option value="AUTH">Authentication</option>
            <option value="AUDIT_SESSION">Audit Sessions</option>
          </select>

          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
            <option value="DISPATCH">Dispatch</option>
            <option value="POST">Post Ledger</option>
            <option value="LOGIN">Login</option>
          </select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
            />
          </div>

          {(search || actionFilter || entityFilter || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActionFilter('');
                setEntityFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              Reset Filters
            </button>
          )}
        </form>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            {activeTab === 'trail' ? 'Immutable Audit Logs' : 'User Activity History'} ({totalCount} total entries)
          </span>
          <span className="text-xs text-gray-500">PostgreSQL Relational Ledger</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity Type</th>
                {activeTab === 'trail' && <th className="py-3 px-4">Entity ID</th>}
                {activeTab === 'userActivity' && <th className="py-3 px-4">Activity Description</th>}
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">IP Address</th>
                {activeTab === 'trail' && <th className="py-3 px-4 text-right">Details</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'trail' ? 9 : 8} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Querying audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'trail' ? 9 : 8} className="py-12 text-center text-gray-400">
                    No audit records matching query parameters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.action === 'CREATE' || log.action === 'LOGIN'
                            ? 'bg-blue-100 text-blue-800'
                            : log.action === 'APPROVE' || log.action === 'FOOD_SAFETY_CHECK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'REJECT' || log.action === 'CANCEL'
                            ? 'bg-rose-100 text-rose-800'
                            : log.action === 'DISPATCH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{log.entityType}</td>
                    {activeTab === 'trail' && (
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-500 truncate max-w-[120px]" title={log.entityId}>
                        {log.entityId}
                      </td>
                    )}
                    {activeTab === 'userActivity' && (
                      <td className="py-3 px-4 text-gray-900 font-medium max-w-sm truncate" title={log.description}>
                        {log.description}
                      </td>
                    )}
                    <td className="py-3 px-4 font-medium text-gray-800">
                      {log.user?.fullName || 'System'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                        {log.user?.role || 'SYSTEM'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-400">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    {activeTab === 'trail' && (
                      <td className="py-3 px-4 text-right">
                        {(log.previousValues || log.newValues) ? (
                          <button
                            onClick={() =>
                              setSelectedPayload({
                                title: `${log.action} on ${log.entityType} (${log.entityId.slice(0, 8)}...)`,
                                previous: log.previousValues ? JSON.parse(log.previousValues) : null,
                                current: log.newValues ? JSON.parse(log.newValues) : null,
                              })
                            }
                            className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5" /> Payload
                          </button>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Inspection Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-gray-900 text-sm">Audit Payload Details</h3>
              </div>
              <button
                onClick={() => setSelectedPayload(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="font-semibold text-xs text-gray-700">{selectedPayload.title}</div>
              {selectedPayload.previous && (
                <div>
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">Previous Values:</div>
                  <pre className="p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-800 border border-gray-200 overflow-x-auto">
                    {JSON.stringify(selectedPayload.previous, null, 2)}
                  </pre>
                </div>
              )}
              {selectedPayload.current && (
                <div>
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Updated Values:</div>
                  <pre className="p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-800 border border-gray-200 overflow-x-auto">
                    {JSON.stringify(selectedPayload.current, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
