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
  Zap,
  ExternalLink,
  Sparkles,
  Database,
  Ban
} from 'lucide-react';
import {
  OfflineRegistrationRecord,
  OfflineRegistrationFormData,
  Participant
} from '../../types';
import {
  offlineApiClient,
  formatTimestamp,
  generateNextOfflineId
} from '../../services/googleSheetsService';
import { initAuth, googleSignIn, logout, getAccessToken } from '../../services/auth';
import { User } from 'firebase/auth';
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
  const [currentCoordinator, setCurrentCoordinator] = useState<string>(() => {
    return localStorage.getItem('airox26_coordinator_name') || 'Desk Admin';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageSource, setStorageSource] = useState<string>('PERSISTENT_STORE');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Google OAuth User State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OfflineRegistrationRecord | null>(null);

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setStatusMessage({
          type: 'success',
          text: `Signed in with Google as ${res.user.displayName || res.user.email}. Google Sheets access authorized!`
        });
        await fetchRecords(true);
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Google Sign-in failed. Please ensure popups are allowed.'
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setStatusMessage({
        type: 'info',
        text: 'Signed out from Google.'
      });
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  // Initial load from Google Sheets / backend persistence
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
      setStorageSource(res.source);
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
      if (msg.includes('Sign in with Google') || msg.includes('authorization required') || msg.includes('disabled')) {
        setStatusMessage({
          type: 'info',
          text: 'Google Sheets synchronization: Please click "Sign in with Google" in the top right to authorize and load registrations from your Google Sheet.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: msg || 'Unable to fetch registrations. Please try again.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      setStorageSource(res.source);
      setStatusMessage({
        type: 'success',
        text: `Sync Offline Registrations complete: ${res.records.length} records updated.`
      });
    } catch (err: any) {
      console.error('Sync error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to sync registrations. Please check Google Sheets access.'
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
        text: `Registration successful: ${newRecord.offlineRegistrationId} created for ${newRecord.fullName} in Google Sheets!`
      });
    } catch (err: any) {
      console.error('Create error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to save registration to Google Sheets.'
      });
      throw err; // Propagate so modal shows state
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
        text: `Record ${updatedRecord.offlineRegistrationId} updated in Google Sheets successfully.`
      });
    } catch (err: any) {
      console.error('Update error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to update registration in Google Sheets.'
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
        text: `Registration ${record.offlineRegistrationId} marked as CANCELLED (Soft-deleted in Google Sheets).`
      });
    } catch (err: any) {
      console.error('Cancel error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to cancel registration in Google Sheets.'
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
        text: `Registration ${record.offlineRegistrationId} restored to ACTIVE in Google Sheets.`
      });
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to restore registration in Google Sheets.'
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
            <span>Google Sheets Persistent Offline Desk</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Offline Registrations Module
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Google Sheets is the authoritative persistent database for all walk-in symposium registrations. Data persists across browsers, survives cache clears, and is instantly accessible for verification & event rosters.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Google Auth Status / Button */}
          {googleUser ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-slate-200">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google User'}
                  className="w-5 h-5 rounded-full border border-emerald-400"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-medium max-w-[120px] truncate">{googleUser.displayName || googleUser.email}</span>
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="ml-1 text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          )}

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Create Registration</span>
          </button>

          <button
            onClick={handleSyncRegistrations}
            disabled={isSyncing}
            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg hover:shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Offline Registrations'}</span>
          </button>

          <button
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
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs transition animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {statusMessage.type === 'info' && <Clock className="w-4 h-4 text-indigo-600 shrink-0" />}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Active */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
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
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
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
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
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
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
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
