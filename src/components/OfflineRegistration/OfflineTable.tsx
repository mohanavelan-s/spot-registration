import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Edit3,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Download,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  Phone
} from 'lucide-react';
import { OfflineRegistrationRecord, OfflineFilterState } from '../../types';
import { defaultNormalizer } from '../../utils/normalizer';
import { CustomSelect, CustomSelectGroup } from '../ui/CustomSelect';
import * as XLSX from 'xlsx';

interface OfflineTableProps {
  records: OfflineRegistrationRecord[];
  onEdit: (record: OfflineRegistrationRecord) => void;
  onCancelRecord: (record: OfflineRegistrationRecord) => Promise<void>;
  onRestoreRecord: (record: OfflineRegistrationRecord) => Promise<void>;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export const OfflineTable: React.FC<OfflineTableProps> = ({
  records,
  onEdit,
  onCancelRecord,
  onRestoreRecord,
  isLoading,
  onRefresh
}) => {
  const [filterState, setFilterState] = useState<OfflineFilterState>({
    searchQuery: '',
    eventFilter: 'ALL',
    statusFilter: 'ACTIVE',
    verificationFilter: 'ALL',
    sortBy: 'offlineRegistrationId',
    sortOrder: 'desc',
    page: 1,
    pageSize: 15
  });

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canonicalEvents = defaultNormalizer.getCanonicalEventsList();

  // Filter and Sort Logic
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    // 1. Status Filter (ACTIVE vs CANCELLED vs ALL)
    if (filterState.statusFilter !== 'ALL') {
      result = result.filter(r => r.status === filterState.statusFilter);
    }

    // 2. Verification Filter
    if (filterState.verificationFilter !== 'ALL') {
      result = result.filter(r => r.verificationStatus === filterState.verificationFilter);
    }

    // 3. Event Filter
    if (filterState.eventFilter !== 'ALL') {
      const targetLower = filterState.eventFilter.toLowerCase();
      result = result.filter(r => {
        const evLower = (r.event || '').toLowerCase();
        return evLower.includes(targetLower);
      });
    }

    // 4. Search Query Filter
    if (filterState.searchQuery.trim()) {
      const q = filterState.searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        return (
          r.offlineRegistrationId.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          r.college.toLowerCase().includes(q) ||
          (r.department && r.department.toLowerCase().includes(q)) ||
          (r.email && r.email.toLowerCase().includes(q)) ||
          (r.event && r.event.toLowerCase().includes(q)) ||
          (r.registeredBy && r.registeredBy.toLowerCase().includes(q))
        );
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      let valA: any = a[filterState.sortBy as keyof OfflineRegistrationRecord] || '';
      let valB: any = b[filterState.sortBy as keyof OfflineRegistrationRecord] || '';

      if (filterState.sortBy === 'offlineRegistrationId') {
        // Parse sequence number for natural sort
        const seqA = parseInt((a.offlineRegistrationId.match(/\d+/) || [0])[0], 10);
        const seqB = parseInt((b.offlineRegistrationId.match(/\d+/) || [0])[0], 10);
        valA = seqA;
        valB = seqB;
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return filterState.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return filterState.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, filterState]);

  // Counts for tabs
  const activeCount = useMemo(() => records.filter(r => r.status === 'ACTIVE').length, [records]);
  const cancelledCount = useMemo(() => records.filter(r => r.status === 'CANCELLED').length, [records]);
  const totalCount = records.length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / filterState.pageSize));
  const currentPage = Math.min(filterState.page, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * filterState.pageSize;
    return filteredAndSortedRecords.slice(start, start + filterState.pageSize);
  }, [filteredAndSortedRecords, currentPage, filterState.pageSize]);

  const handleSort = (field: keyof OfflineRegistrationRecord) => {
    setFilterState(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Export Filtered Offline Registrations to Excel
  const handleExportExcel = () => {
    const exportRows = filteredAndSortedRecords.map((r, idx) => ({
      'S.No': idx + 1,
      'Offline Reg ID': r.offlineRegistrationId,
      'Full Name': r.fullName,
      'Mobile Number': r.mobile,
      'Email Address': r.email || '',
      'College / Institution': r.college,
      'Department': r.department || '',
      'Year / Section': r.yearSection || '',
      'Event(s)': r.event,
      'Team Name': r.teamName || '',
      'Verification Status': r.verificationStatus,
      'Registered At': r.registeredAt,
      'Registered By': r.registeredBy,
      'Updated At': r.updatedAt || '',
      'Updated By': r.updatedBy || '',
      'Status': r.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Offline Registrations');
    XLSX.writeFile(workbook, `AIROX26_Offline_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
        {/* Status Filter Tabs & Export */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setFilterState(p => ({ ...p, statusFilter: 'ACTIVE', page: 1 }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterState.statusFilter === 'ACTIVE'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Active Registrations</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px]">
                {activeCount}
              </span>
            </button>

            <button
              onClick={() => setFilterState(p => ({ ...p, statusFilter: 'CANCELLED', page: 1 }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterState.statusFilter === 'CANCELLED'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Cancelled (Soft-Deleted)</span>
              <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px]">
                {cancelledCount}
              </span>
            </button>

            <button
              onClick={() => setFilterState(p => ({ ...p, statusFilter: 'ALL', page: 1 }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filterState.statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All History</span>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px]">
                {totalCount}
              </span>
            </button>
          </div>

          {/* Export & Refresh */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={filteredAndSortedRecords.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export ({filteredAndSortedRecords.length})</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Refresh Google Sheet"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Event/Verification Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name, Offline ID, Mobile, College, Event..."
              value={filterState.searchQuery}
              onChange={e => setFilterState(p => ({ ...p, searchQuery: e.target.value, page: 1 }))}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Event Filter */}
          <div className="sm:col-span-3">
            <CustomSelect
              id="select-offline-event-filter"
              value={filterState.eventFilter}
              onChange={val => setFilterState(p => ({ ...p, eventFilter: val, page: 1 }))}
              placeholder="All Events (Filter)"
              groups={[
                {
                  label: 'General',
                  options: [{ value: 'ALL', label: 'All Events (Filter)' }]
                },
                {
                  label: 'Technical Events',
                  options: canonicalEvents
                    .filter(e => e.category === 'Technical' || e.category === 'Both')
                    .map(e => ({ value: e.displayName, label: e.displayName }))
                },
                {
                  label: 'Non-Technical Events',
                  options: canonicalEvents
                    .filter(e => e.category === 'Non-Technical')
                    .map(e => ({ value: e.displayName, label: e.displayName }))
                }
              ]}
            />
          </div>

          {/* Verification Status Filter */}
          <div className="sm:col-span-3">
            <CustomSelect
              id="select-offline-verification-filter"
              value={filterState.verificationFilter}
              onChange={val => setFilterState(p => ({ ...p, verificationFilter: val as any, page: 1 }))}
              options={[
                { value: 'ALL', label: 'All Verification Status' },
                { value: 'Verified', label: 'Verified Only' },
                { value: 'Pending', label: 'Pending Only' },
                { value: 'Rejected', label: 'Rejected Only' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto min-h-[350px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('offlineRegistrationId')}>
                <div className="flex items-center gap-1.5">
                  <span>Offline ID</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('fullName')}>
                <div className="flex items-center gap-1.5">
                  <span>Participant</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('college')}>
                <div className="flex items-center gap-1.5">
                  <span>College / Department</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4">Event(s)</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Verification</th>
              <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('registeredAt')}>
                <div className="flex items-center gap-1.5">
                  <span>Audit / Desk</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No offline registrations found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {filterState.searchQuery || filterState.eventFilter !== 'ALL'
                        ? 'Try adjusting your search query or filter options.'
                        : 'Click "+ Create Offline Registration" to register an on-spot participant.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRecords.map(record => {
                const isCancelled = record.status === 'CANCELLED';
                const events = record.event.split(/[,;\n\r|]/).map(e => e.trim()).filter(Boolean);

                return (
                  <tr
                    key={record.offlineRegistrationId}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCancelled ? 'bg-slate-50/50 opacity-60' : ''
                    }`}
                  >
                    {/* Offline ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            isCancelled
                              ? 'bg-slate-200 text-slate-600 line-through'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}
                        >
                          {record.offlineRegistrationId}
                        </span>
                        {isCancelled && (
                          <span className="text-[10px] font-bold text-rose-600 uppercase">
                            Cancelled
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Participant */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{record.fullName}</div>
                      {record.email && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                          {record.email}
                        </div>
                      )}
                    </td>

                    {/* College / Department */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 truncate max-w-[200px]" title={record.college}>
                        {record.college}
                      </div>
                      {(record.department || record.yearSection) && (
                        <div className="text-[11px] text-slate-500">
                          {[record.department, record.yearSection].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </td>

                    {/* Event(s) */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {events.map((evName, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-100"
                          >
                            {evName}
                          </span>
                        ))}
                      </div>
                      {record.teamName && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          Team: <span className="font-semibold text-slate-700">{record.teamName}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{record.mobile}</span>
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          record.verificationStatus === 'Verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : record.verificationStatus === 'Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {record.verificationStatus === 'Verified' && <CheckCircle2 className="w-3 h-3" />}
                        {record.verificationStatus === 'Pending' && <Clock className="w-3 h-3" />}
                        {record.verificationStatus === 'Rejected' && <XCircle className="w-3 h-3" />}
                        <span>{record.verificationStatus}</span>
                      </span>
                    </td>

                    {/* Audit Info */}
                    <td className="py-3.5 px-4 text-[11px] text-slate-500">
                      <div>{record.registeredAt || 'N/A'}</div>
                      <div className="text-slate-400">By: {record.registeredBy || 'Desk'}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onEdit(record)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition"
                          title="Edit Registration"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {isCancelled ? (
                          <button
                            onClick={() => onRestoreRecord(record)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 transition"
                            title="Restore Registration (Active)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onCancelRecord(record)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition"
                            title="Cancel Registration (Status = CANCELLED)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Showing{' '}
          <span className="font-semibold text-slate-900">
            {filteredAndSortedRecords.length === 0 ? 0 : (currentPage - 1) * filterState.pageSize + 1}
          </span>{' '}
          to{' '}
          <span className="font-semibold text-slate-900">
            {Math.min(currentPage * filterState.pageSize, filteredAndSortedRecords.length)}
          </span>{' '}
          of <span className="font-semibold text-slate-900">{filteredAndSortedRecords.length}</span> records
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterState(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setFilterState(p => ({ ...p, page: Math.min(totalPages, p.page + 1) }))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
