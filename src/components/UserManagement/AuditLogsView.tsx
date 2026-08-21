import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, Filter, Search, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { AuditLogEntry, UserRole } from '../../types';
import { fetchAuditLogs } from '../../services/auth';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAuditLogs(200);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      !search ||
      log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      (log.targetId && log.targetId.toLowerCase().includes(search.toLowerCase()));

    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (action.includes('LOGOUT')) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (action.includes('UPDATE')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (action.includes('CANCEL')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (action.includes('RESTORE')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (action.includes('DENIED')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (action.includes('EXPORT')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search user, action, details..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN">Logins</option>
            <option value="OFFLINE_REGISTRATION_CREATED">Offline Created</option>
            <option value="OFFLINE_REGISTRATION_UPDATED">Offline Updated</option>
            <option value="OFFLINE_REGISTRATION_CANCELLED">Offline Cancelled</option>
            <option value="DATA_SYNCED">Data Syncs</option>
            <option value="ROSTER_EXPORTED">Exports</option>
            <option value="USER_ROLE_CHANGED">Role Changes</option>
            <option value="ACCESS_DENIED">Access Denied (Security)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredLogs.length} of {logs.length} events
          </span>
          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target / ID</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No audit records found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>{log.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.userEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-indigo-700 font-medium">
                      {log.targetId || '-'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-700" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {log.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>OK</span>
                        </span>
                      )}
                      {log.status === 'DENIED' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>DENIED</span>
                        </span>
                      )}
                      {log.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>FAIL</span>
                        </span>
                      )}
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
