import React from 'react';
import {
  Users,
  Calendar,
  CheckCircle2,
  Award,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  ClipboardList,
  Sparkles,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { DetectedEvent, CombinedStats } from '../types';

interface StatsOverviewProps {
  totalRegistrations: number;
  onlineUniqueCount: number;
  offlineActiveCount: number;
  detectedEventsCount: number;
  selectedEvent: DetectedEvent | null;
  extractedCount: number;
  onlineCountInEvent: number;
  offlineCountInEvent: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  stats?: CombinedStats;
  onQuickExportXLSX?: () => void;
  onQuickExportCSV?: () => void;
  onSyncData?: () => void;
  isSyncing?: boolean;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  totalRegistrations,
  onlineUniqueCount,
  offlineActiveCount,
  detectedEventsCount,
  selectedEvent,
  extractedCount,
  onlineCountInEvent,
  offlineCountInEvent,
  verifiedCount,
  pendingCount,
  rejectedCount,
  stats,
  onQuickExportXLSX,
  onQuickExportCSV,
  onSyncData,
  isSyncing = false
}) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1: Total Combined Registrations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Combined Registrations
              </p>
              <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">
                {detectedEventsCount} Events
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {totalRegistrations}
              </h3>
              <span className="text-xs font-medium text-slate-400">total participants</span>
            </div>
          </div>

          {/* Breakdown: Online vs Offline */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-indigo-700 font-semibold">
              <Globe className="w-3.5 h-3.5" />
              <span>Online: <strong className="font-mono text-slate-900">{onlineUniqueCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Offline: <strong className="font-mono text-slate-900">{offlineActiveCount}</strong></span>
            </div>
          </div>
        </div>

        {/* 2: Active Selected Event Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Active Event
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                selectedEvent
                  ? selectedEvent.category === 'Technical'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedEvent ? selectedEvent.category : 'All Events'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-indigo-950 truncate mt-1" title={selectedEvent ? selectedEvent.displayName : 'All Symposium Participants'}>
              {selectedEvent ? selectedEvent.displayName : 'All Participants'}
            </h3>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono font-medium">
            {selectedEvent ? (
              <>
                <span className="text-indigo-600">Online: <strong>{selectedEvent.onlineCount}</strong></span>
                <span className="text-emerald-600">Offline: <strong>{selectedEvent.offlineCount}</strong></span>
                <span className="text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded">Total: {selectedEvent.combinedCount}</span>
              </>
            ) : (
              <>
                <span className="text-indigo-600">Online: <strong>{onlineUniqueCount}</strong></span>
                <span className="text-emerald-600">Offline: <strong>{offlineActiveCount}</strong></span>
                <span className="text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded">Total: {totalRegistrations}</span>
              </>
            )}
          </div>
        </div>

        {/* 3: Event Roster & Verification Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Event Participants
              </p>
              <span className="text-xs text-slate-500 font-medium">
                ({totalRegistrations > 0 ? Math.round((extractedCount / totalRegistrations) * 100) : 0}% of all)
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {extractedCount}
              </h3>
              <span className="text-xs text-slate-400 font-medium">in current view</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold mt-3 pt-3 border-t border-slate-100">
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex-1 text-center">
              {verifiedCount} Verified
            </span>
            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex-1 text-center">
              {pendingCount} Pending
            </span>
            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex-1 text-center">
              {rejectedCount} Rejected
            </span>
          </div>
        </div>

        {/* 4: Export Roster Action Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-5 rounded-xl border border-slate-800 shadow-xs flex flex-col justify-between text-white">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
                Export Roster
              </p>
              {stats?.lastSyncedAt && (
                <span className="text-[10px] text-indigo-300/80 font-mono">
                  Synced: {stats.lastSyncedAt}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-200 font-medium truncate mt-1">
              {selectedEvent ? selectedEvent.displayName : 'Combined Symposium Roster'}
            </div>
          </div>

          <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
            <button
              onClick={onQuickExportXLSX}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
              title="Quick Download Excel (.xlsx) with Online & Offline details"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>XLSX</span>
            </button>
            <button
              onClick={onQuickExportCSV}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
              title="Quick Download CSV (.csv)"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate / Offline Sync Status Notification Bar if needed */}
      {stats && (stats.possibleDuplicatesCount > 0 || !stats.isOfflineAvailable || stats.offlineErrorMessage) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              {stats.possibleDuplicatesCount > 0 && (
                <span className="font-semibold">
                  {stats.possibleDuplicatesCount} cross-registered participant{stats.possibleDuplicatesCount > 1 ? 's' : ''} detected between Online and Offline sources. Records are preserved and flagged for verification.
                </span>
              )}
              {!stats.isOfflineAvailable && stats.offlineErrorMessage && (
                <span className="font-medium ml-1">
                  Offline Google Sheets sync notice: {stats.offlineErrorMessage}
                </span>
              )}
            </div>
          </div>

          {onSyncData && (
            <button
              onClick={onSyncData}
              disabled={isSyncing}
              className="px-3 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Re-sync Data'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
