import React, { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { Shield, Search } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit/logs')
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Trail</h1>
        <p className="text-sm text-gray-500">
          Tamper-evident log of all order modifications, approvals, dispatches, production runs and payments
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity Type</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Audit Details / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">Loading audit trail...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No audit logs recorded yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-900">{log.entityType}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-500 truncate max-w-[120px]">{log.entityId}</td>
                    <td className="p-3 font-medium text-gray-800">{log.user?.fullName || 'System'}</td>
                    <td className="p-3 text-gray-500">{log.user?.role || '—'}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-600 max-w-xs truncate">
                      {log.newValues || log.previousValues || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
