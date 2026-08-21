import React, { useState } from 'react';
import {
  Search,
  Download,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Copy,
  Check,
  Mail,
  Phone,
  Globe,
  ClipboardList,
  AlertTriangle
} from 'lucide-react';
import { FilterState, Participant, SourceFilter } from '../types';

interface ParticipantTableProps {
  participants: Participant[];
  totalFilteredCount: number;
  onlineCount: number;
  offlineCount: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  filterState: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  selectedParticipantIds: Set<string>;
  onToggleSelectParticipant: (id: string) => void;
  onToggleSelectAll: () => void;
  onViewParticipant: (participant: Participant) => void;
  onOpenExportModal: (onlySelected: boolean) => void;
  selectedEventDisplayName: string | null;
  onStatusChange?: (participantId: string, newStatus: 'Verified' | 'Pending' | 'Rejected') => void;
}

export const ParticipantTable: React.FC<ParticipantTableProps> = ({
  participants,
  totalFilteredCount,
  onlineCount,
  offlineCount,
  verifiedCount,
  pendingCount,
  rejectedCount,
  filterState,
  onFilterChange,
  selectedParticipantIds,
  onToggleSelectParticipant,
  onToggleSelectAll,
  onViewParticipant,
  onOpenExportModal,
  selectedEventDisplayName,
  onStatusChange
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSort = (columnKey: FilterState['sortBy']) => {
    if (filterState.sortBy === columnKey) {
      onFilterChange({
        sortOrder: filterState.sortOrder === 'asc' ? 'desc' : 'asc'
      });
    } else {
      onFilterChange({
        sortBy: columnKey,
        sortOrder: 'asc'
      });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isAllSelected =
    participants.length > 0 && participants.every(p => selectedParticipantIds.has(p.id));

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs overflow-hidden mb-8">
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{selectedEventDisplayName ? selectedEventDisplayName : 'All Combined Participants'}</span>
              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                ({totalFilteredCount} in active view)
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Showing combined registrations from Online portal and Offline desk with canonical event normalization
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {selectedParticipantIds.size > 0 && (
              <button
                id="btn-export-selected"
                onClick={() => onOpenExportModal(true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Selected ({selectedParticipantIds.size})</span>
              </button>
            )}

            <button
              id="btn-export-all-filtered"
              onClick={() => onOpenExportModal(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Roster</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Source Tabs & Status Radio Filters */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            {/* Registration Source Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => onFilterChange({ sourceFilter: 'ALL', page: 1 })}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  filterState.sourceFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Sources ({onlineCount + offlineCount})
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ sourceFilter: 'ONLINE', page: 1 })}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                  filterState.sourceFilter === 'ONLINE'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3 h-3 text-indigo-600" />
                <span>Online ({onlineCount})</span>
              </button>
              <button
                type="button"
                onClick={() => onFilterChange({ sourceFilter: 'OFFLINE', page: 1 })}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                  filterState.sourceFilter === 'OFFLINE'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-3 h-3 text-emerald-600" />
                <span>Offline ({offlineCount})</span>
              </button>
            </div>

            {/* Status Radio Pills */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="verificationStatus"
                  checked={filterState.statusFilter === 'All'}
                  onChange={() => onFilterChange({ statusFilter: 'All', page: 1 })}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className={filterState.statusFilter === 'All' ? 'font-semibold text-slate-900' : ''}>
                  All Status
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="verificationStatus"
                  checked={filterState.statusFilter === 'Verified'}
                  onChange={() => onFilterChange({ statusFilter: 'Verified', page: 1 })}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className={filterState.statusFilter === 'Verified' ? 'font-semibold text-emerald-700' : ''}>
                  Verified ({verifiedCount})
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="verificationStatus"
                  checked={filterState.statusFilter === 'Pending'}
                  onChange={() => onFilterChange({ statusFilter: 'Pending', page: 1 })}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className={filterState.statusFilter === 'Pending' ? 'font-semibold text-amber-700' : ''}>
                  Pending ({pendingCount})
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="verificationStatus"
                  checked={filterState.statusFilter === 'Rejected'}
                  onChange={() => onFilterChange({ statusFilter: 'Rejected', page: 1 })}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className={filterState.statusFilter === 'Rejected' ? 'font-semibold text-rose-700' : ''}>
                  Rejected ({rejectedCount})
                </span>
              </label>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-participant-input"
              type="text"
              value={filterState.searchQuery}
              onChange={e => onFilterChange({ searchQuery: e.target.value, page: 1 })}
              placeholder="Search by name, ID, phone, college, source..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
            />
            {filterState.searchQuery && (
              <button
                onClick={() => onFilterChange({ searchQuery: '', page: 1 })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Participants Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  title="Select all on page"
                />
              </th>

              <th
                onClick={() => handleSort('registrationId')}
                className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition select-none"
              >
                <div className="flex items-center gap-1">
                  <span>ID</span>
                  {filterState.sortBy === 'registrationId' ? (
                    filterState.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('source')}
                className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Source</span>
                  {filterState.sortBy === 'source' ? (
                    filterState.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('fullName')}
                className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Full Name</span>
                  {filterState.sortBy === 'fullName' ? (
                    filterState.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('college')}
                className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Institution</span>
                  {filterState.sortBy === 'college' ? (
                    filterState.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Team Name
              </th>

              <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Contact
              </th>

              <th
                onClick={() => handleSort('verificationStatus')}
                className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 transition select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {filterState.sortBy === 'verificationStatus' ? (
                    filterState.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>

              <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="text-sm divide-y divide-slate-100">
            {participants.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto flex flex-col items-center">
                    <Users className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700 text-sm">No participants found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No registrations matched "{selectedEventDisplayName || 'All'}" with current filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              participants.map(p => {
                const isSelected = selectedParticipantIds.has(p.id);
                const isOnline = p.source === 'ONLINE';

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? 'bg-indigo-50/50' : 'bg-white'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectParticipant(p.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    {/* ID */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 font-medium">
                      {p.registrationId}
                    </td>

                    {/* Source Badge */}
                    <td className="px-4 py-3">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Globe className="w-2.5 h-2.5" />
                          <span>ONLINE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ClipboardList className="w-2.5 h-2.5" />
                          <span>OFFLINE</span>
                        </span>
                      )}
                    </td>

                    {/* Full Name & Dept/Year */}
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{p.fullName}</span>
                        {p.isPossibleDuplicate && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-300"
                            title={p.duplicateInfo?.reason || 'Matching contact found in online records'}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            Cross-Reg
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal flex items-center gap-2 mt-0.5">
                        <span>{p.participationMode || 'Individual'}</span>
                        {p.department && <span>• {p.department}</span>}
                        {p.yearSection && <span>• {p.yearSection}</span>}
                      </div>
                    </td>

                    {/* Institution */}
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={p.college}>
                      {p.college || '-'}
                    </td>

                    {/* Team Name */}
                    <td className="px-4 py-3 text-slate-500 italic">
                      {p.teamName || '-'}
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {p.email && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="truncate max-w-[140px]" title={p.email}>
                            {p.email}
                          </span>
                          <button
                            onClick={() => copyToClipboard(p.email, `email_${p.id}`)}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                            title="Copy email"
                          >
                            {copiedId === `email_${p.id}` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      )}
                      {p.mobile && <div className="text-[10px] text-slate-400">{p.mobile}</div>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {p.verificationStatus === 'Verified' && (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">
                          Verified
                        </span>
                      )}
                      {p.verificationStatus === 'Pending' && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">
                          Pending
                        </span>
                      )}
                      {p.verificationStatus === 'Rejected' && (
                        <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">
                          Rejected
                        </span>
                      )}
                    </td>

                    {/* View Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onViewParticipant(p)}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-xs font-medium transition-colors cursor-pointer border border-slate-200"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>
            Showing {participants.length > 0 ? (filterState.page - 1) * filterState.pageSize + 1 : 0} to{' '}
            {Math.min(filterState.page * filterState.pageSize, totalFilteredCount)} of {totalFilteredCount} participants
            {selectedEventDisplayName && ` for '${selectedEventDisplayName}'`}
          </span>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFilterChange({ page: Math.max(1, filterState.page - 1) })}
            disabled={filterState.page <= 1}
            className="px-3 py-1 bg-white border border-slate-300 rounded-md shadow-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
          >
            Previous
          </button>

          <span className="px-2 font-medium text-slate-700">
            Page {filterState.page} of {Math.max(1, Math.ceil(totalFilteredCount / filterState.pageSize))}
          </span>

          <button
            onClick={() =>
              onFilterChange({
                page: Math.min(
                  Math.ceil(totalFilteredCount / filterState.pageSize),
                  filterState.page + 1
                )
              })
            }
            disabled={filterState.page >= Math.ceil(totalFilteredCount / filterState.pageSize)}
            className="px-3 py-1 bg-white border border-slate-300 rounded-md shadow-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
