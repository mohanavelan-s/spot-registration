import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Download,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  CheckSquare,
  Square,
  AlertCircle,
  Sparkles,
  Building2,
  Smartphone,
  Tag,
  Check,
  ChevronDown,
  XCircle,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { Participant, AppUser, CertificateRecord, CertificateStatus } from '../../types';
import {
  fetchCertificateRecords,
  updateCertificateStatusApi,
  bulkUpdateCertificateStatusApi,
  syncCertificateRecordsApi,
  canModifyCertificateStatus
} from '../../services/auth';
import { getStrippedKey } from '../../utils/normalizer';
import { CustomSelect } from '../ui/CustomSelect';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import * as XLSX from 'xlsx';

interface CertificateDeskPageProps {
  participants: Participant[];
  currentUser: AppUser | null;
  onRefreshData?: () => Promise<void> | void;
}

const CANONICAL_EVENTS = [
  { name: 'The Final Hire', category: 'Technical' },
  { name: 'Paper Presentation', category: 'Technical' },
  { name: 'The Prompt League', category: 'Technical' },
  { name: 'Zero Hour', category: 'Technical' },
  { name: 'ADS SHOT', category: 'Non-Technical' },
  { name: 'GOATED OR GHOSTED', category: 'Non-Technical' },
  { name: 'CLASH AND CONQUER', category: 'Non-Technical' },
  { name: 'BOX CRICKET', category: 'Non-Technical' },
  { name: 'ESPORTS (FREE FIRE & STUMBLE GUYS)', category: 'Non-Technical' }
];

export const CertificateDeskPage: React.FC<CertificateDeskPageProps> = ({
  participants,
  currentUser,
  onRefreshData
}) => {
  const [selectedEvent, setSelectedEvent] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ISSUED'>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<'ALL' | 'Verified' | 'Pending' | 'Rejected'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

  // Certificate persistence state from server
  const [certificateRecords, setCertificateRecords] = useState<Map<string, CertificateRecord>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk selection state (registration IDs for current event)
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState<boolean>(false);

  useBodyScrollLock(isBulkModalOpen);

  const canModify = canModifyCertificateStatus(currentUser);

  // Helper to construct unique lookup key
  const getCertKey = useCallback((regId: string, eventName: string) => {
    return `${regId}__${getStrippedKey(eventName)}`;
  }, []);

  // Helper to get certificate status for a participant in the current context
  const getParticipantCertStatus = useCallback((p: Participant, targetEvent: string): { status: CertificateStatus; record?: CertificateRecord } => {
    if (targetEvent !== 'All' && targetEvent !== 'ALL') {
      const certKey = getCertKey(p.registrationId, targetEvent);
      const rec = certificateRecords.get(certKey);
      return { status: rec?.status || 'PENDING', record: rec };
    }

    // In 'All' view: check if an explicit 'All' record exists or if any registered event is ISSUED
    const allKey = getCertKey(p.registrationId, 'All');
    const allRec = certificateRecords.get(allKey);
    if (allRec && allRec.status === 'ISSUED') {
      return { status: 'ISSUED', record: allRec };
    }

    for (const ev of p.allEvents || []) {
      const key = getCertKey(p.registrationId, ev);
      const rec = certificateRecords.get(key);
      if (rec && rec.status === 'ISSUED') {
        return { status: 'ISSUED', record: rec };
      }
    }

    // Check if any record in certificateRecords for this registrationId is ISSUED
    for (const rec of certificateRecords.values()) {
      if (rec.registrationId === p.registrationId && rec.status === 'ISSUED') {
        return { status: 'ISSUED', record: rec };
      }
    }

    return { status: 'PENDING', record: allRec };
  }, [certificateRecords, getCertKey]);

  // Fetch certificate records from server on mount
  const loadCertificates = useCallback(async () => {
    try {
      setIsLoading(true);
      const records = await fetchCertificateRecords();
      const map = new Map<string, CertificateRecord>();
      if (Array.isArray(records)) {
        records.forEach((rec: CertificateRecord) => {
          const key = getCertKey(rec.registrationId, rec.event);
          map.set(key, rec);
        });
      }
      setCertificateRecords(map);
    } catch (err: any) {
      console.warn('[CertificateDesk] Note on loading certificates:', err.message || err);
    } finally {
      setIsLoading(false);
    }
  }, [getCertKey]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates, currentUser]);

  // Handle Sync / Refresh
  const handleSync = async () => {
    try {
      setIsSyncing(true);
      if (onRefreshData) {
        await onRefreshData();
      }
      const records = await syncCertificateRecordsApi();
      const map = new Map<string, CertificateRecord>();
      records.forEach((rec: CertificateRecord) => {
        const key = getCertKey(rec.registrationId, rec.event);
        map.set(key, rec);
      });
      setCertificateRecords(map);
      setStatusMessage({ type: 'success', text: 'Certificate tracking and participant rosters refreshed.' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to refresh certificate data.' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper to check if participant matches the selected canonical event
  const isParticipantInEvent = useCallback((p: Participant, targetEvent: string): boolean => {
    if (targetEvent === 'ALL' || targetEvent === 'All' || targetEvent === 'All Events') return true;
    const targetKey = getStrippedKey(targetEvent);
    return p.allEvents.some(ev => {
      const evKey = getStrippedKey(ev);
      return evKey === targetKey || evKey.includes(targetKey) || targetKey.includes(evKey);
    });
  }, []);

  // Active participants for selected event (excluding CANCELLED)
  const eventParticipants = useMemo(() => {
    return participants.filter(p => {
      if (p.status === 'CANCELLED') return false;
      return isParticipantInEvent(p, selectedEvent);
    });
  }, [participants, selectedEvent, isParticipantInEvent]);

  // Filtered participants based on search, status filter, verification filter, source filter
  const filteredParticipants = useMemo(() => {
    return eventParticipants.filter(p => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.fullName.toLowerCase().includes(q);
        const matchesId = p.registrationId.toLowerCase().includes(q);
        const matchesCollege = (p.college || '').toLowerCase().includes(q);
        const matchesDepartment = (p.department || '').toLowerCase().includes(q);
        const matchesMobile = (p.mobile || '').includes(q);
        const matchesEmail = (p.email || '').toLowerCase().includes(q);
        const matchesEvents = (p.allEvents || []).some(ev => ev.toLowerCase().includes(q));
        if (!matchesName && !matchesId && !matchesCollege && !matchesDepartment && !matchesMobile && !matchesEmail && !matchesEvents) {
          return false;
        }
      }

      // 2. Verification status filter
      if (verificationFilter !== 'ALL') {
        const pVerif = p.verificationStatus || 'Verified';
        if (pVerif !== verificationFilter) return false;
      }

      // 3. Source Filter
      if (sourceFilter !== 'ALL') {
        const pSource = p.source || 'ONLINE';
        if (pSource !== sourceFilter) return false;
      }

      // 4. Certificate status filter
      if (statusFilter !== 'ALL') {
        const { status: currentStatus } = getParticipantCertStatus(p, selectedEvent);
        if (currentStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [eventParticipants, searchQuery, verificationFilter, sourceFilter, statusFilter, selectedEvent, getParticipantCertStatus]);

  // Dashboard Metrics for Selected Event
  const metrics = useMemo(() => {
    // Total eligible in selected event (excluding Rejected from eligible count unless specifically viewing rejected)
    const eligibleList = eventParticipants.filter(p => p.verificationStatus !== 'Rejected');
    const totalEligible = eligibleList.length;

    let issuedCount = 0;
    eligibleList.forEach(p => {
      const { status } = getParticipantCertStatus(p, selectedEvent);
      if (status === 'ISSUED') {
        issuedCount++;
      }
    });

    const pendingCount = Math.max(0, totalEligible - issuedCount);
    const progressPercent = totalEligible > 0 ? Math.round((issuedCount / totalEligible) * 100) : 0;

    return {
      totalEligible,
      issuedCount,
      pendingCount,
      progressPercent
    };
  }, [eventParticipants, selectedEvent, getParticipantCertStatus]);

  // Toggle single certificate status
  const handleToggleStatus = async (p: Participant) => {
    if (!canModify) return;

    if (p.verificationStatus === 'Rejected') {
      setStatusMessage({
        type: 'error',
        text: `Cannot issue certificate for rejected participant (${p.fullName}).`
      });
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    const { status: currentStatus } = getParticipantCertStatus(p, selectedEvent);
    const newStatus: CertificateStatus = currentStatus === 'ISSUED' ? 'PENDING' : 'ISSUED';
    const effectiveEvent = (selectedEvent === 'All' || selectedEvent === 'ALL')
      ? (p.allEvents && p.allEvents.length > 0 ? p.allEvents[0] : 'All Events')
      : selectedEvent;

    const certKey = getCertKey(p.registrationId, selectedEvent);
    const effectiveKey = getCertKey(p.registrationId, effectiveEvent);

    const now = new Date().toISOString();
    const actor = currentUser?.name || currentUser?.email || 'Certificate Team';

    // Optimistic update
    const optimisticRec: CertificateRecord = {
      id: effectiveKey,
      registrationId: p.registrationId,
      event: effectiveEvent,
      eventKey: getStrippedKey(effectiveEvent),
      participantName: p.fullName,
      college: p.college,
      status: newStatus,
      issuedAt: newStatus === 'ISSUED' ? now : undefined,
      issuedBy: newStatus === 'ISSUED' ? actor : undefined,
      updatedAt: now,
      updatedBy: actor
    };

    setCertificateRecords(prev => {
      const next = new Map(prev);
      next.set(effectiveKey, optimisticRec);
      if (selectedEvent === 'All' || selectedEvent === 'ALL') {
        next.set(certKey, optimisticRec);
        (p.allEvents || []).forEach(ev => {
          next.set(getCertKey(p.registrationId, ev), {
            ...optimisticRec,
            id: getCertKey(p.registrationId, ev),
            event: ev,
            eventKey: getStrippedKey(ev)
          });
        });
      }
      return next;
    });

    try {
      const savedRec = await updateCertificateStatusApi(
        p.registrationId,
        effectiveEvent,
        newStatus,
        p.fullName,
        p.college
      );
      setCertificateRecords(prev => {
        const next = new Map(prev);
        next.set(effectiveKey, savedRec);
        if (selectedEvent === 'All' || selectedEvent === 'ALL') {
          next.set(certKey, savedRec);
          (p.allEvents || []).forEach(ev => {
            next.set(getCertKey(p.registrationId, ev), {
              ...savedRec,
              id: getCertKey(p.registrationId, ev),
              event: ev,
              eventKey: getStrippedKey(ev)
            });
          });
        }
        return next;
      });
    } catch (err: any) {
      loadCertificates();
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update certificate status.' });
    }
  };

  // Bulk Selection Handlers
  const handleSelectAllOnPage = () => {
    const newSelected = new Set(selectedRegIds);
    const allEligibleOnPage = filteredParticipants.filter(p => p.verificationStatus !== 'Rejected');
    const allSelected = allEligibleOnPage.every(p => newSelected.has(p.registrationId));

    if (allSelected) {
      allEligibleOnPage.forEach(p => newSelected.delete(p.registrationId));
    } else {
      allEligibleOnPage.forEach(p => newSelected.add(p.registrationId));
    }
    setSelectedRegIds(newSelected);
  };

  const handleToggleSelectRow = (regId: string) => {
    setSelectedRegIds(prev => {
      const next = new Set(prev);
      if (next.has(regId)) next.delete(regId);
      else next.add(regId);
      return next;
    });
  };

  const handleSelectAllPendingInEvent = () => {
    const pendingSet = new Set<string>();
    eventParticipants.forEach(p => {
      if (p.verificationStatus === 'Rejected') return;
      const { status } = getParticipantCertStatus(p, selectedEvent);
      if (status !== 'ISSUED') {
        pendingSet.add(p.registrationId);
      }
    });
    setSelectedRegIds(pendingSet);
  };

  const executeBulkMarkIssued = async () => {
    if (selectedRegIds.size === 0 || !canModify) return;

    try {
      setIsProcessingBulk(true);
      const updates: Array<{
        registrationId: string;
        event: string;
        status: 'PENDING' | 'ISSUED';
        participantName?: string;
        college?: string;
      }> = Array.from(selectedRegIds).map((regId: string) => {
        const p = participants.find(item => item.registrationId === regId);
        const effectiveEvent = (selectedEvent === 'All' || selectedEvent === 'ALL')
          ? (p?.allEvents && p.allEvents.length > 0 ? p.allEvents[0] : 'All Events')
          : selectedEvent;
        return {
          registrationId: String(regId),
          event: String(effectiveEvent),
          status: 'ISSUED' as CertificateStatus,
          participantName: p?.fullName || 'Participant',
          college: p?.college
        };
      });

      const updatedRecords = await bulkUpdateCertificateStatusApi(updates);
      setCertificateRecords(prev => {
        const next = new Map(prev);
        updatedRecords.forEach((rec: CertificateRecord) => {
          const key = getCertKey(rec.registrationId, rec.event);
          next.set(key, rec);
          if (selectedEvent === 'All' || selectedEvent === 'ALL') {
            next.set(getCertKey(rec.registrationId, 'All'), rec);
          }
        });
        return next;
      });

      setSelectedRegIds(new Set());
      setIsBulkModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: `Successfully marked ${updatedRecords.length} certificates as ISSUED for ${selectedEvent === 'All' ? 'all participants' : selectedEvent}.`
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Bulk mark failed.' });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Certificate Specific Export Handlers
  const handleExportCertificates = (scope: 'ALL' | 'ISSUED' | 'PENDING') => {
    const rowsToExport = eventParticipants.filter(p => {
      if (p.verificationStatus === 'Rejected' && scope !== 'ALL') return false;
      const { status: currentStatus } = getParticipantCertStatus(p, selectedEvent);
      if (scope === 'ISSUED') return currentStatus === 'ISSUED';
      if (scope === 'PENDING') return currentStatus === 'PENDING';
      return true;
    });

    const exportRows = rowsToExport.map((p, index) => {
      const { status, record } = getParticipantCertStatus(p, selectedEvent);
      return {
        'S.No': index + 1,
        'Registration ID': p.registrationId,
        'Participant Name (Certificate)': p.fullName.trim(),
        'Institution / College': p.college || 'N/A',
        'Department': p.department || 'N/A',
        'Mobile': p.mobile || 'N/A',
        'Email': p.email || 'N/A',
        'Registered Events': (p.allEvents || []).join(', '),
        'Selected Event Context': selectedEvent,
        'Registration Source': p.source || 'ONLINE',
        'Verification Status': p.verificationStatus || 'Verified',
        'Certificate Status': status,
        'Certificate Issued At': record?.issuedAt ? new Date(record.issuedAt).toLocaleString() : 'N/A',
        'Issued By User': record?.issuedBy || 'N/A'
      };
    });

    const filename = `AIROX26_Certificates_${selectedEvent.replace(/[^a-zA-Z0-9]/g, '_')}_${scope}_${new Date().toISOString().slice(0, 10)}`;

    if (exportFormat === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Certificates');
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                AIROX'26 Certificate Desk
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                CERTIFICATE DESK
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Track and issue certificates for all participants across events • Syncs with Google Sheets tracking
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh / Sync Button */}
          <button
            id="btn-cert-refresh"
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh certificate tracking and participant roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {/* Export Format Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setExportFormat('xlsx')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                exportFormat === 'xlsx' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Excel (.xlsx)
            </button>
            <button
              onClick={() => setExportFormat('csv')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                exportFormat === 'csv' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CSV
            </button>
          </div>

          {/* Certificate Export Dropdown / Buttons */}
          <div className="flex items-center gap-1">
            <button
              id="btn-export-issued"
              onClick={() => handleExportCertificates('ISSUED')}
              disabled={metrics.issuedCount === 0}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Export only issued certificates"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Issued ({metrics.issuedCount})</span>
            </button>

            <button
              id="btn-export-all-cert"
              onClick={() => handleExportCertificates('ALL')}
              disabled={eventParticipants.length === 0}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Export all certificate records in current event/all filter"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All ({eventParticipants.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 2. Canonical Event Selector Grid with "All" Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Event Filter / Selection ({CANONICAL_EVENTS.length + 1} options)
          </span>
          <span className="text-xs text-slate-500">
            Selected Filter: <strong className="text-amber-700 font-bold">{selectedEvent === 'All' ? 'All (Every Participant)' : selectedEvent}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* "All" Filter Button */}
          <button
            id="btn-event-all"
            onClick={() => {
              setSelectedEvent('All');
              setSelectedRegIds(new Set());
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
              selectedEvent === 'All'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-500/20'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
            title="Show all participants across all events"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>All</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                selectedEvent === 'All' ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {participants.filter(p => p.status !== 'CANCELLED').length}
            </span>
          </button>

          {/* Canonical Events List */}
          {CANONICAL_EVENTS.map(ev => {
            const isSelected = selectedEvent === ev.name;
            const count = participants.filter(p => p.status === 'CANCELLED' ? false : isParticipantInEvent(p, ev.name)).length;

            return (
              <button
                key={ev.name}
                id={`btn-event-${ev.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                onClick={() => {
                  setSelectedEvent(ev.name);
                  setSelectedRegIds(new Set());
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-500/20'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{ev.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isSelected ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Event Dashboard Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Selected Event / Filter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active View</p>
            <h3 className="text-base font-bold text-slate-900 mt-0.5 truncate max-w-[180px]" title={selectedEvent}>
              {selectedEvent === 'All' ? 'All Participants' : selectedEvent}
            </h3>
            <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
              {selectedEvent === 'All' ? 'Symposium Wide' : `${CANONICAL_EVENTS.find(e => e.name === selectedEvent)?.category || 'Technical'} Track`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Eligible */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Eligible</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">
              {metrics.totalEligible}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Verified & active participants</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Issued vs Pending */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Certificates Issued</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-emerald-600">{metrics.issuedCount}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {metrics.pendingCount} Pending</span>
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
              {metrics.progressPercent}% completion
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Progress Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">Issuance Progress</span>
              <span className="font-black text-slate-900">{metrics.progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full mt-2 overflow-hidden border border-slate-200">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.progressPercent}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
            <span>{metrics.issuedCount} Issued</span>
            <span>{metrics.pendingCount} Remaining</span>
          </div>
        </div>
      </div>

      {/* 4. Controls, Search, & Bulk Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              id="input-cert-search"
              type="text"
              placeholder="Search by ID, Name, College, Department, or Mobile..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 bg-slate-50/50"
            />
          </div>

          {/* Filters & Status Segmented Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  statusFilter === 'PENDING' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                Pending ({metrics.pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('ISSUED')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  statusFilter === 'ISSUED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 hover:text-emerald-950'
                }`}
              >
                Issued ({metrics.issuedCount})
              </button>
            </div>

            {/* Registration Source Filter */}
            <div className="w-36">
              <CustomSelect
                id="select-cert-source"
                value={sourceFilter}
                onChange={val => setSourceFilter(val as any)}
                size="sm"
                options={[
                  { value: 'ALL', label: 'All Sources' },
                  { value: 'ONLINE', label: 'Online Portal' },
                  { value: 'OFFLINE', label: 'Offline (On-Spot)' }
                ]}
              />
            </div>

            {/* Verification Filter */}
            <div className="w-40">
              <CustomSelect
                id="select-cert-verification"
                value={verificationFilter}
                onChange={val => setVerificationFilter(val as any)}
                size="sm"
                options={[
                  { value: 'ALL', label: 'All Verification' },
                  { value: 'Verified', label: 'Verified Only' },
                  { value: 'Pending', label: 'Pending Verification' },
                  { value: 'Rejected', label: 'Rejected' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Bulk Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              onClick={handleSelectAllOnPage}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              {filteredParticipants.length > 0 &&
              filteredParticipants
                .filter(p => p.verificationStatus !== 'Rejected')
                .every(p => selectedRegIds.has(p.registrationId)) ? (
                <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Select All on Page</span>
            </button>

            <button
              onClick={handleSelectAllPendingInEvent}
              className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold transition flex items-center gap-1 cursor-pointer"
            >
              <span>Select All Pending ({metrics.pendingCount})</span>
            </button>

            {selectedRegIds.size > 0 && (
              <button
                onClick={() => setSelectedRegIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer"
              >
                Clear selection ({selectedRegIds.size})
              </button>
            )}
          </div>

          {/* Mark Selected as Issued Button */}
          {canModify && (
            <button
              id="btn-bulk-mark-issued"
              onClick={() => setIsBulkModalOpen(true)}
              disabled={selectedRegIds.size === 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Selected as Issued ({selectedRegIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Participants Certificate Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredParticipants.length > 0 &&
                      filteredParticipants
                        .filter(p => p.verificationStatus !== 'Rejected')
                        .every(p => selectedRegIds.has(p.registrationId))
                    }
                    onChange={handleSelectAllOnPage}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Reg ID</th>
                <th className="py-3.5 px-4">Participant Name</th>
                <th className="py-3.5 px-4">Registered Events</th>
                <th className="py-3.5 px-4">Institution / College</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Source</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4">Certificate Status</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                      <span>Loading certificate records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No participants found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredParticipants.map(p => {
                  const { status: certStatus, record: certRecord } = getParticipantCertStatus(p, selectedEvent);
                  const isIssued = certStatus === 'ISSUED';
                  const isRejected = p.verificationStatus === 'Rejected';
                  const isSelected = selectedRegIds.has(p.registrationId);

                  return (
                    <tr
                      key={p.id || p.registrationId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-amber-50/40' : ''
                      } ${isIssued ? 'bg-emerald-50/20' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          disabled={isRejected}
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(p.registrationId)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-30"
                        />
                      </td>

                      {/* Reg ID */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {p.registrationId}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">{p.fullName}</div>
                        {p.teamName && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Team: {p.teamName}
                          </span>
                        )}
                      </td>

                      {/* Registered Events */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="flex flex-wrap gap-1">
                          {(p.allEvents || []).map((ev, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                selectedEvent !== 'All' && ev.toLowerCase().includes(selectedEvent.toLowerCase())
                                  ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* College */}
                      <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate" title={p.college}>
                        <div className="font-medium text-slate-800 truncate">{p.college || 'N/A'}</div>
                        {p.department && (
                          <div className="text-[10px] text-slate-400 truncate">{p.department}</div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        <div>{p.mobile || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={p.email}>
                          {p.email}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.source === 'OFFLINE'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {p.source || 'ONLINE'}
                        </span>
                      </td>

                      {/* Verification Status */}
                      <td className="py-3 px-4">
                        {isRejected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        ) : p.verificationStatus === 'Pending' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </td>

                      {/* Certificate Status Badge & Audit Trail */}
                      <td className="py-3 px-4">
                        {isRejected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            NOT ELIGIBLE
                          </span>
                        ) : isIssued ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-700" />
                              ISSUED
                            </span>
                            {certRecord?.issuedBy && (
                              <p className="text-[9px] text-slate-400">
                                By {certRecord.issuedBy.split('@')[0]} •{' '}
                                {certRecord.issuedAt ? new Date(certRecord.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            PENDING
                          </span>
                        )}
                      </td>

                      {/* Action / Toggle Button */}
                      <td className="py-3 px-4 text-center">
                        {isRejected ? (
                          <span className="text-[11px] text-slate-400 italic">Ineligible</span>
                        ) : (
                          <button
                            id={`btn-toggle-cert-${p.registrationId}`}
                            onClick={() => handleToggleStatus(p)}
                            disabled={!canModify}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer border shadow-2xs ${
                              isIssued
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-400'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={
                              isIssued
                                ? 'Click to revert certificate to Pending'
                                : 'Click to mark certificate as Issued'
                            }
                          >
                            {isIssued ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Issued</span>
                              </>
                            ) : (
                              <>
                                <Square className="w-3.5 h-3.5 text-amber-600" />
                                <span>Mark Issued</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Bulk Confirmation Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Bulk Issue Certificates
                </h3>
                <p className="text-xs text-slate-500">
                  Target: <strong className="text-slate-800">{selectedEvent === 'All' ? 'All Participants' : selectedEvent}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to mark certificates as <strong>ISSUED</strong> for{' '}
              <strong className="text-emerald-700 font-bold">{selectedRegIds.size} participants</strong> in{' '}
              <strong>{selectedEvent === 'All' ? 'All Events' : selectedEvent}</strong>?
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] space-y-1">
              <p className="font-semibold">Persistence Guarantee:</p>
              <p>
                Each status update is saved individually to the backend Google Sheets CERTIFICATE_TRACKING tab with your username and timestamp.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                disabled={isProcessingBulk}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkMarkIssued}
                disabled={isProcessingBulk}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessingBulk ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Mark Issued</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
