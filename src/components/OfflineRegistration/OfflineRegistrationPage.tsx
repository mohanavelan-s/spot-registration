import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserPlus,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  ShieldCheck,
  Ban
} from 'lucide-react';
import {
  OfflineRegistrationRecord,
  OfflineRegistrationFormData,
  Participant
} from '../../types';
import {
  offlineApiClient
} from '../../services/googleSheetsService';
import { CreateOfflineModal } from './CreateOfflineModal';
import { EditOfflineModal } from './EditOfflineModal';
import { GoogleSheetConfigModal } from './GoogleSheetConfigModal';
import { OfflineTable } from './OfflineTable';

interface OfflineRegistrationPageProps {
  onlineParticipants: Participant[];
  onRecordsChange?: (records: OfflineRegistrationRecord[]) => void;
}

export const OfflineRegistrationPage: React.FC<OfflineRegistrationPageProps> = ({
  onlineParticipants,
  onRecordsChange
}) => {
  const [records, setRecords] = useState<OfflineRegistrationRecord[]>([]);
  const [sheetId, setSheetId] = useState<string>('');
  const [currentCoordinator] = useState<string>(() => {
    return localStorage.getItem('airox26_coordinator_name') || 'Desk Admin';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OfflineRegistrationRecord | null>(null);

  // Initial load from backend persistence / Google Sheets
  const fetchRecords = useCallback(async (showToast: boolean = false) => {
    setIsLoading(true);
    try {
      const config = await offlineApiClient.getConfig();
      if (config.sheetId) {
        setSheetId(config.sheetId);
      }

      const res = await offlineApiClient.fetchRegistrations();
      setRecords(res.records);
      onRecordsChange?.(res.records);
      if (res.sheetId) {
        setSheetId(res.sheetId);
      }

      if (showToast) {
        setStatusMessage({
          type: 'success',
          text: `Fetched ${res.records.length} registrations from persistent storage.`
        });
      }
    } catch (err: any) {
      console.error('Failed to load offline registrations:', err);
      const msg = err.message || '';
      setStatusMessage({
        type: 'error',
        text: msg || 'Unable to fetch registrations. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [onRecordsChange]);

  useEffect(() => {
    fetchRecords(false);
  }, [fetchRecords]);

  // Sync Offline Registrations handler
  const handleSyncRegistrations = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const res = await offlineApiClient.syncRegistrations();
      setRecords(res.records);
      onRecordsChange?.(res.records);
      setStatusMessage({
        type: 'success',
        text: `Sync Offline Registrations complete: ${res.records.length} records updated.`
      });
    } catch (err: any) {
      console.error('Sync error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to sync registrations. Please check backend storage status.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Create registration handler
  const handleCreateRegistration = async (formData: OfflineRegistrationFormData) => {
    try {
      const newRecord = await offlineApiClient.createRegistration(formData, currentCoordinator);
      // Immediately refresh latest data from authoritative backend/Google Sheet
      await fetchRecords(false);
      setStatusMessage({
        type: 'success',
        text: `Registration successful: ${newRecord.offlineRegistrationId} created for ${newRecord.fullName}!`
      });
    } catch (err: any) {
      console.error('Create error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to save registration to offline storage.'
      });
      throw err; // Propagate so modal displays the error
    }
  };

  // Edit registration handler
  const handleSaveEditedRecord = async (updatedRecord: OfflineRegistrationRecord) => {
    try {
      await offlineApiClient.updateRegistration(
        updatedRecord.offlineRegistrationId,
        updatedRecord,
        currentCoordinator
      );
      await fetchRecords(false);
      setStatusMessage({
        type: 'success',
        text: `Record ${updatedRecord.offlineRegistrationId} updated successfully.`
      });
    } catch (err: any) {
      console.error('Update error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to update registration.'
      });
      throw err;
    }
  };

  // Cancel (Soft Delete) registration handler: Status = CANCELLED
  const handleCancelRecord = async (record: OfflineRegistrationRecord) => {
    try {
      await offlineApiClient.cancelRegistration(record.offlineRegistrationId, currentCoordinator);
      await fetchRecords(false);
      setStatusMessage({
        type: 'info',
        text: `Registration ${record.offlineRegistrationId} marked as CANCELLED.`
      });
    } catch (err: any) {
      console.error('Cancel error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to cancel registration.'
      });
    }
  };

  // Restore registration handler: Status = ACTIVE
  const handleRestoreRecord = async (record: OfflineRegistrationRecord) => {
    try {
      await offlineApiClient.restoreRegistration(record.offlineRegistrationId, currentCoordinator);
      await fetchRecords(false);
      setStatusMessage({
        type: 'success',
        text: `Registration ${record.offlineRegistrationId} restored to ACTIVE.`
      });
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to restore registration.'
      });
    }
  };

  // Metrics (Active only vs Cancelled)
  const activeRecords = useMemo(() => records.filter(r => r.status === 'ACTIVE'), [records]);
  const cancelledRecords = useMemo(() => records.filter(r => r.status === 'CANCELLED'), [records]);
  const verifiedCount = useMemo(
    () => activeRecords.filter(r => r.verificationStatus === 'Verified').length,
    [activeRecords]
  );
  const pendingCount = useMemo(
    () => activeRecords.filter(r => r.verificationStatus === 'Pending').length,
    [activeRecords]
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Actions Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Offline Registration Desk</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Offline Registrations Module
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Persistent storage and authoritative database for all walk-in symposium registrations. Data persists across sessions, integrates with Google Sheets via server-side credentials, and is immediately accessible for verification & event rosters.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            id="btn-create-offline-reg"
            onClick={() => setCreateModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Create Registration</span>
          </button>

          <button
            id="btn-sync-offline-reg"
            onClick={handleSyncRegistrations}
            disabled={isSyncing}
            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg hover:shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Offline Registrations'}</span>
          </button>

          <button
            id="btn-sheet-settings"
            onClick={() => setConfigModalOpen(true)}
            className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition border border-white/10 flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Sheet Settings</span>
          </button>
        </div>
      </div>

      {/* Status / Alert Message */}
      {statusMessage && (
        <div
          id="offline-desk-status-msg"
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            {statusMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />}
            {statusMessage.type === 'info' && <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />}
            <span className="font-semibold leading-relaxed">{statusMessage.text}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {statusMessage.type === 'error' && statusMessage.text.includes('Permission Denied') && (
              <button
                onClick={() => setConfigModalOpen(true)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Fix Permissions in Settings
              </button>
            )}
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-2 py-0.5 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Active */}
        <div id="stat-active-attendees" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Attendees
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {activeRecords.length}
            </span>
            <span className="text-[11px] text-slate-400">Excludes cancelled</span>
          </div>
        </div>

        {/* Verified */}
        <div id="stat-verified-count" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Verified
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono">
              {verifiedCount}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">Paid & verified</span>
          </div>
        </div>

        {/* Pending */}
        <div id="stat-pending-desk" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Pending Desk
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono">
              {pendingCount}
            </span>
            <span className="text-[11px] text-amber-600 font-medium">Awaiting check</span>
          </div>
        </div>

        {/* Storage State / Cancelled count */}
        <div id="stat-cancelled-count" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cancelled / Soft-Deleted
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono">
              {cancelledRecords.length}
            </span>
            <span className="text-[11px] text-rose-600 font-medium">Preserved in sheet</span>
          </div>
        </div>
      </div>

      {/* Main Table Component */}
      <OfflineTable
        records={records}
        onEdit={record => setEditingRecord(record)}
        onCancelRecord={handleCancelRecord}
        onRestoreRecord={handleRestoreRecord}
        isLoading={isLoading || isSyncing}
        onRefresh={() => handleSyncRegistrations()}
      />

      {/* Create Modal */}
      <CreateOfflineModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateRegistration}
        existingRecords={records}
        onlineParticipants={onlineParticipants}
        currentCoordinator={currentCoordinator}
      />

      {/* Edit Modal */}
      <EditOfflineModal
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        record={editingRecord}
        onSave={handleSaveEditedRecord}
        currentCoordinator={currentCoordinator}
      />

      {/* Google Sheet Config Modal */}
      <GoogleSheetConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        sheetId={sheetId}
        onSaveSheetId={newId => {
          setSheetId(newId);
        }}
        onRefreshData={() => handleSyncRegistrations()}
      />
    </div>
  );
};
