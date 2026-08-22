import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar, AppViewMode } from './components/Navbar';
import { FileUpload } from './components/FileUpload';
import { StatsOverview } from './components/StatsOverview';
import { EventSelector } from './components/EventSelector';
import { ParticipantTable } from './components/ParticipantTable';
import { ParticipantModal } from './components/ParticipantModal';
import { ExportModal } from './components/ExportModal';
import { TestRunnerModal } from './components/TestRunnerModal';
import { AliasManagerModal } from './components/AliasManagerModal';
import { AllEventsOverview } from './components/AllEventsOverview';
import { OfflineRegistrationPage } from './components/OfflineRegistration/OfflineRegistrationPage';
import { UserManagementPage } from './components/UserManagement/UserManagementPage';
import { CertificateDeskPage } from './components/CertificateDesk/CertificateDeskPage';
import { RoleSwitcherBar } from './components/Auth/RoleSwitcherBar';
import { LoginModal } from './components/Auth/LoginModal';
import { ChangePasswordModal } from './components/Auth/ChangePasswordModal';
import { AccessDeniedView } from './components/Auth/AccessDeniedView';
import {
  ColumnMapping,
  DetectedEvent,
  EventAliasMap,
  FilterState,
  ParseResult,
  Participant,
  OfflineRegistrationRecord,
  AppUser
} from './types';
import { EventNormalizer } from './utils/normalizer';
import { parseRegistrationFile, processRawRows, detectColumnMapping } from './utils/fileParser';
import { extractParticipants } from './utils/extractor';
import { exportToCSV, exportToXLSX } from './utils/exporter';
import { combineDatasets } from './utils/combinedEngine';
import { offlineApiClient, onlineApiClient } from './services/googleSheetsService';
import {
  getStoredUser,
  setStoredUser,
  checkCurrentSession,
  logout,
  canAccessEvent,
  canExportEvent,
  canManageUsers,
  userHasRole
} from './services/auth';
import { SAMPLE_AIROX26_RAW_DATA } from './data/sampleDataset';
import { DEFAULT_EVENT_REGISTRY } from './config/defaultAliases';

export default function App() {
  // Auth and Session state (Real token-based authentication)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isMandatoryPasswordChange, setIsMandatoryPasswordChange] = useState(false);

  // Normalizer instance state
  const [registry, setRegistry] = useState<EventAliasMap>(DEFAULT_EVENT_REGISTRY);
  const normalizer = useMemo(() => new EventNormalizer(registry), [registry]);

  // Online Data States
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Offline Data States (Persistent Google Sheets / Local Store)
  const [offlineRecords, setOfflineRecords] = useState<OfflineRegistrationRecord[]>([]);
  const [isOfflineLoading, setIsOfflineLoading] = useState<boolean>(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlineSourceType, setOfflineSourceType] = useState<string>('PERSISTENT_STORE');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  // View state: 'extractor' | 'matrix' | 'offline' | 'users' | 'certificates'
  const [currentView, setCurrentView] = useState<AppViewMode>('extractor');

  // Filter & Pagination state
  const [filterState, setFilterState] = useState<FilterState>({
    selectedEventKey: 'the final hire', // Default directly to flagship event
    searchQuery: '',
    statusFilter: 'All',
    sourceFilter: 'ALL',
    showCancelled: false,
    sortBy: 'registrationId',
    sortOrder: 'asc',
    page: 1,
    pageSize: 10
  });

  // Selection state
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());

  // Modal visibility states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOnlySelected, setExportOnlySelected] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false);
  const [viewingParticipant, setViewingParticipant] = useState<Participant | null>(null);

  // Initial Auth check
  useEffect(() => {
    checkCurrentSession().then(user => {
      if (user) {
        setCurrentUser(user);
        if (user.mustChangePassword) {
          setIsMandatoryPasswordChange(true);
          setIsChangePasswordOpen(true);
        }
      } else {
        setCurrentUser(null);
      }
    });
  }, []);

  const handleLoginSuccess = (user: AppUser, mustChange?: boolean) => {
    setCurrentUser(user);
    if (mustChange || user.mustChangePassword) {
      setIsMandatoryPasswordChange(true);
      setIsChangePasswordOpen(true);
    }
    // Set initial view based on role
    if (user.role === 'ON_SPOT') {
      setCurrentView('offline');
    } else if (user.role === 'EVENT_COORDINATOR') {
      setCurrentView('extractor');
      if (user.assignedEvents && user.assignedEvents.length > 0) {
        const firstEventKey = user.assignedEvents[0].toLowerCase();
        setFilterState(prev => ({ ...prev, selectedEventKey: firstEventKey, page: 1 }));
      }
    } else if (user.role === 'CERTIFICATE') {
      setCurrentView('certificates');
    } else if (user.role === 'DATABASE') {
      setCurrentView('extractor');
      setFilterState(prev => ({ ...prev, selectedEventKey: null, page: 1 }));
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  // Load the official 321 AIROX'26 registration database for Online Portal
  const loadSampleDataset = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = Object.keys(SAMPLE_AIROX26_RAW_DATA[0] || {});
      const columnMapping = detectColumnMapping(headers);
      const { participants, detectedEvents, warnings } = processRawRows(
        SAMPLE_AIROX26_RAW_DATA,
        columnMapping,
        normalizer
      );

      setParseResult({
        fileName: "AIROX '26 - Registration Database.xlsx",
        fileSize: 1024 * 78,
        totalRegistrations: participants.length,
        participants,
        detectedEvents,
        columnMapping,
        warnings,
        errors: []
      });

      // Set default selected event
      const defaultKey = currentUser?.role === 'EVENT_COORDINATOR' && currentUser.assignedEvents.length > 0
        ? currentUser.assignedEvents[0].toLowerCase()
        : 'the final hire';

      setFilterState(prev => ({
        ...prev,
        selectedEventKey: defaultKey,
        page: 1
      }));
      setSelectedParticipantIds(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to initialize online database');
    } finally {
      setIsLoading(false);
    }
  }, [normalizer, currentUser]);

  // Fetch Online Registrations (Google Sheet or fallback to sample dataset)
  const fetchOnlineData = useCallback(async (isManualSync: boolean = false) => {
    try {
      const res = isManualSync 
        ? await onlineApiClient.syncRegistrations() 
        : await onlineApiClient.fetchRegistrations();

      if (res.source === 'GOOGLE_SHEETS' && res.rows && res.rows.length > 0) {
        const columnMapping = detectColumnMapping(res.headers);
        const { participants, detectedEvents, warnings } = processRawRows(
          res.rows,
          columnMapping,
          normalizer
        );
        setParseResult({
          fileName: `Google Sheet (ONLINE_REGISTRATION_SHEET_ID)`,
          fileSize: 1024 * res.rows.length,
          totalRegistrations: participants.length,
          participants,
          detectedEvents,
          columnMapping,
          warnings,
          errors: []
        });
      } else {
        loadSampleDataset();
      }
    } catch (err: any) {
      console.warn('[OnlineFetch] Notice:', err);
      loadSampleDataset();
    }
  }, [normalizer, loadSampleDataset]);

  // Fetch Offline Registrations from Google Sheets / persistent storage
  const fetchOfflineData = useCallback(async () => {
    setIsOfflineLoading(true);
    setOfflineError(null);
    try {
      const res = await offlineApiClient.fetchRegistrations();
      setOfflineRecords(res.records);
      setOfflineSourceType(res.source);
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.warn('Initial offline fetch warning:', err);
      setOfflineError(err.message || 'Offline Google Sheets connection pending');
    } finally {
      setIsOfflineLoading(false);
    }
  }, []);

  // Sync Both Offline & Online Data
  const handleSyncData = async () => {
    setIsOfflineLoading(true);
    let errorMessages: string[] = [];

    // 1. Sync Offline Registrations
    try {
      const res = await offlineApiClient.syncRegistrations();
      setOfflineRecords(res.records);
      setOfflineSourceType(res.source);
      setOfflineError(null);
    } catch (err: any) {
      console.error('Offline sync failed:', err);
      setOfflineError(err.message || 'Offline sync failed');
      errorMessages.push(`Offline: ${err.message || 'Sync failed'}`);
    }

    // 2. Sync Online Registrations
    try {
      const res = await onlineApiClient.syncRegistrations();
      if (res.source === 'GOOGLE_SHEETS' && res.rows && res.rows.length > 0) {
        const columnMapping = detectColumnMapping(res.headers);
        const { participants, detectedEvents, warnings } = processRawRows(
          res.rows,
          columnMapping,
          normalizer
        );
        setParseResult({
          fileName: `Google Sheet (ONLINE_REGISTRATION_SHEET_ID)`,
          fileSize: 1024 * res.rows.length,
          totalRegistrations: participants.length,
          participants,
          detectedEvents,
          columnMapping,
          warnings,
          errors: []
        });
      }
    } catch (err: any) {
      console.warn('Online sync notice:', err);
    }

    setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setIsOfflineLoading(false);

    if (errorMessages.length > 0) {
      throw new Error(errorMessages.join('. '));
    }
  };

  // Callback when offline records are modified directly in the Offline Registration Desk
  const handleOfflineRecordsChange = useCallback((updatedRecords: OfflineRegistrationRecord[]) => {
    setOfflineRecords(updatedRecords);
    setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  // Load online dataset & fetch offline data on initial mount
  useEffect(() => {
    fetchOnlineData(false);
    fetchOfflineData();
  }, [fetchOnlineData, fetchOfflineData]);

  // Handle uploaded online file
  const handleFileUpload = async (file: File) => {
    if (currentUser?.role !== 'ADMIN') {
      alert('Only administrators can upload/replace the online registration database.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await parseRegistrationFile(file, undefined, normalizer);

    if (result.errors && result.errors.length > 0) {
      setError(result.errors.join(' '));
      setIsLoading(false);
      return;
    }

    setParseResult(result);
    const firstEvent = result.detectedEvents[0]?.key || null;
    setFilterState(prev => ({
      ...prev,
      selectedEventKey: firstEvent,
      page: 1
    }));
    setSelectedParticipantIds(new Set());
    setIsLoading(false);
  };

  const handleSelectSheet = async (sheetName: string) => {
    if (!parseResult) return;
  };

  // Update filter state
  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
  };

  // Selection handlers
  const handleToggleSelectParticipant = (id: string) => {
    setSelectedParticipantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (!paginatedData) return;
    const allPageIds = paginatedData.paginatedParticipants.map(p => p.id);
    const isAllSelected = allPageIds.every(id => selectedParticipantIds.has(id));

    setSelectedParticipantIds(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        allPageIds.forEach(id => next.delete(id));
      } else {
        allPageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Status Change Handler
  const handleStatusChange = (id: string, newStatus: 'Verified' | 'Pending' | 'Rejected') => {
    if (currentUser?.role === 'CERTIFICATE' || currentUser?.role === 'DATABASE') {
      alert('DATABASE and CERTIFICATE roles are read-only and cannot modify participant verification status.');
      return;
    }

    if (parseResult) {
      setParseResult(prev => {
        if (!prev) return prev;
        const updated = prev.participants.map(p => {
          if (p.id === id) {
            return { ...p, verificationStatus: newStatus };
          }
          return p;
        });
        return { ...prev, participants: updated };
      });
    }

    if (viewingParticipant && viewingParticipant.id === id) {
      setViewingParticipant(prev => (prev ? { ...prev, verificationStatus: newStatus } : null));
    }
  };

  // Apply registry modifications
  const handleSaveRegistry = (newRegistry: EventAliasMap) => {
    if (currentUser?.role !== 'ADMIN') {
      alert('Only administrators can modify event aliases and canonical definitions.');
      return;
    }

    setRegistry(newRegistry);
    normalizer.updateRegistry(newRegistry);

    // Re-normalize existing online participants with new registry
    if (parseResult) {
      const rawRows = parseResult.participants.map(p => p.rawRow);
      const { participants, detectedEvents, warnings } = processRawRows(
        rawRows,
        parseResult.columnMapping,
        normalizer
      );
      setParseResult(prev => (prev ? { ...prev, participants, detectedEvents, warnings } : null));
    }
  };

  // ==========================================
  // PHASE 2 & 3: COMBINED & RBAC-SCOPED DATA ENGINE
  // ==========================================
  const rawCombinedData = useMemo(() => {
    const onlineParticipants = parseResult?.participants || [];
    const baseDetectedEvents = parseResult?.detectedEvents || [];

    return combineDatasets({
      onlineParticipants,
      offlineRecords,
      normalizer,
      baseDetectedEvents,
      isOfflineAvailable: !offlineError,
      offlineSourceType,
      offlineErrorMessage: offlineError || undefined,
      lastSyncedAt
    });
  }, [parseResult, offlineRecords, normalizer, offlineError, offlineSourceType, lastSyncedAt]);

  // Apply Role-Based Scoping to Events & Participants
  const combinedData = useMemo(() => {
    if (!currentUser || currentUser.status !== 'ACTIVE') {
      return {
        ...rawCombinedData,
        combinedParticipants: [],
        combinedEvents: [],
        stats: {
          ...rawCombinedData.stats,
          totalRegistrations: 0,
          onlineUniqueRegistrations: 0,
          offlineActiveRegistrations: 0
        }
      };
    }

    // If Coordinator: scope exclusively to assigned events
    if (currentUser.role === 'EVENT_COORDINATOR') {
      const assigned = currentUser.assignedEvents || [];
      const scopedEvents = rawCombinedData.combinedEvents.filter(ev =>
        canAccessEvent(currentUser, ev.displayName) || canAccessEvent(currentUser, ev.key)
      );

      const scopedParticipants = rawCombinedData.combinedParticipants.filter(p =>
        p.allEvents.some(e => canAccessEvent(currentUser, e))
      );

      return {
        ...rawCombinedData,
        combinedEvents: scopedEvents,
        combinedParticipants: scopedParticipants,
        stats: {
          ...rawCombinedData.stats,
          totalRegistrations: scopedParticipants.length,
          onlineUniqueRegistrations: scopedParticipants.filter(p => p.source === 'ONLINE').length,
          offlineActiveRegistrations: scopedParticipants.filter(p => p.source === 'OFFLINE').length
        }
      };
    }

    return rawCombinedData;
  }, [rawCombinedData, currentUser]);

  // Filtered and Paginated Participants
  const paginatedData = useMemo(() => {
    return extractParticipants(combinedData.combinedParticipants, filterState);
  }, [combinedData.combinedParticipants, filterState]);

  const selectedEvent = useMemo(() => {
    if (!filterState.selectedEventKey) return null;
    return combinedData.combinedEvents.find(e => e.key === filterState.selectedEventKey) || null;
  }, [combinedData.combinedEvents, filterState.selectedEventKey]);

  // Quick export helpers
  const handleQuickExportXLSX = () => {
    const eventName = selectedEvent ? selectedEvent.displayName : 'All_Combined_Participants';
    exportToXLSX(paginatedData.filteredParticipants, eventName);
  };

  const handleQuickExportCSV = () => {
    const eventName = selectedEvent ? selectedEvent.displayName : 'All_Combined_Participants';
    exportToCSV(paginatedData.filteredParticipants, eventName);
  };

  // Check if current user is inactive or unauthorized
  const isUserDisabled = currentUser && currentUser.status !== 'ACTIVE';
  const isUnauthorized = !currentUser;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Authenticated User & Role Session Bar */}
      <RoleSwitcherBar
        currentUser={currentUser}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
        onChangePasswordClick={() => {
          setIsMandatoryPasswordChange(false);
          setIsChangePasswordOpen(true);
        }}
      />

      {/* Main Navigation Bar */}
      <Navbar
        fileName={parseResult?.fileName || null}
        totalRegistrations={combinedData.stats.totalRegistrations}
        onlineCount={combinedData.stats.onlineUniqueRegistrations}
        offlineCount={combinedData.stats.offlineActiveRegistrations}
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenUpload={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          document.getElementById('drop-zone')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onLoadSample={loadSampleDataset}
        onOpenTests={() => setIsTestModalOpen(true)}
        onOpenAliases={() => setIsAliasModalOpen(true)}
        onOpenAllEvents={() => setCurrentView('matrix')}
        onOpenExport={() => {
          setExportOnlySelected(false);
          setIsExportModalOpen(true);
        }}
        onSyncData={handleSyncData}
        isSyncing={isOfflineLoading}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isUnauthorized || isUserDisabled ? (
          <AccessDeniedView
            user={currentUser}
            onLoginClick={() => setIsLoginModalOpen(true)}
          />
        ) : currentView === 'users' ? (
          /* Admin-Only User Management and RBAC Dashboard */
          currentUser.role === 'ADMIN' ? (
            <UserManagementPage />
          ) : (
            <AccessDeniedView user={currentUser} requiredRole="ADMIN" />
          )
        ) : currentView === 'certificates' ? (
          /* Dedicated Certificate Desk (Admin & Certificate Team ONLY) */
          currentUser.role === 'ADMIN' || userHasRole(currentUser, 'CERTIFICATE') ? (
            <CertificateDeskPage
              participants={combinedData.combinedParticipants}
              currentUser={currentUser}
              onRefreshData={handleSyncData}
            />
          ) : (
            <AccessDeniedView user={currentUser} requiredRole="CERTIFICATE or ADMIN" />
          )
        ) : currentView === 'offline' ? (
          /* Dedicated Google Sheets Offline Registration Desk */
          currentUser.role === 'ADMIN' || userHasRole(currentUser, 'ON_SPOT') || userHasRole(currentUser, 'REGISTRATION') ? (
            <OfflineRegistrationPage
              onlineParticipants={parseResult?.participants || []}
              onRecordsChange={handleOfflineRecordsChange}
            />
          ) : (
            <AccessDeniedView user={currentUser} requiredRole="ON_SPOT or ADMIN" />
          )
        ) : currentView === 'matrix' ? (
          /* Master Symposium Matrix (Admin & Database) */
          currentUser.role === 'ADMIN' || userHasRole(currentUser, 'DATABASE') ? (
            <AllEventsOverview
              detectedEvents={combinedData.combinedEvents}
              participants={combinedData.combinedParticipants}
              onSelectEventAndSwitch={eventKey => {
                setFilterState(prev => ({ ...prev, selectedEventKey: eventKey, page: 1 }));
                setCurrentView('extractor');
              }}
            />
          ) : (
            <AccessDeniedView user={currentUser} requiredRole="DATABASE or ADMIN" />
          )
        ) : (currentUser.role === 'ADMIN' || userHasRole(currentUser, 'DATABASE') || userHasRole(currentUser, 'REGISTRATION') || userHasRole(currentUser, 'EVENT_COORDINATOR')) ? (
          /* Combined Participant Engine & Event Extractor View */
          <>
            {/* Upload & Database Bar (Admin Only) */}
            {currentUser.role === 'ADMIN' && (
              <FileUpload
                onFileUpload={handleFileUpload}
                onLoadSample={loadSampleDataset}
                isLoading={isLoading}
                columnMapping={parseResult?.columnMapping}
                error={error}
                warnings={parseResult?.warnings}
                sheetNames={parseResult?.sheetNames}
                activeSheet={parseResult?.activeSheet}
                onSelectSheet={handleSelectSheet}
                currentFileName={parseResult?.fileName}
                totalRegistrations={combinedData.stats.totalRegistrations}
              />
            )}

            {/* Coordinator Welcome Banner */}
            {currentUser.role === 'EVENT_COORDINATOR' && (
              <div className="mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-indigo-950">
                    Welcome, {currentUser.name} (Event Coordinator)
                  </h2>
                  <p className="text-xs text-indigo-700">
                    You have secure, scoped access to manage participants and export rosters for your assigned event(s):{' '}
                    <strong>{currentUser.assignedEvents.join(', ')}</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  Export Event Roster
                </button>
              </div>
            )}

            {/* Combined KPI Statistics Overview */}
            <StatsOverview
              totalRegistrations={combinedData.stats.totalRegistrations}
              onlineUniqueCount={combinedData.stats.onlineUniqueRegistrations}
              offlineActiveCount={combinedData.stats.offlineActiveRegistrations}
              detectedEventsCount={combinedData.combinedEvents.length}
              selectedEvent={selectedEvent}
              extractedCount={paginatedData.totalFilteredCount}
              onlineCountInEvent={paginatedData.onlineCount}
              offlineCountInEvent={paginatedData.offlineCount}
              verifiedCount={paginatedData.verifiedCount}
              pendingCount={paginatedData.pendingCount}
              rejectedCount={paginatedData.rejectedCount}
              stats={combinedData.stats}
              onQuickExportXLSX={handleQuickExportXLSX}
              onQuickExportCSV={handleQuickExportCSV}
              onSyncData={handleSyncData}
              isSyncing={isOfflineLoading}
            />

            {/* Event Selector with Online/Offline/Combined Counts */}
            <EventSelector
              detectedEvents={combinedData.combinedEvents}
              selectedEventKey={filterState.selectedEventKey}
              onSelectEvent={key => setFilterState(prev => ({ ...prev, selectedEventKey: key, page: 1 }))}
              totalParticipants={combinedData.stats.totalRegistrations}
              onlineTotal={combinedData.stats.onlineUniqueRegistrations}
              offlineTotal={combinedData.stats.offlineActiveRegistrations}
            />

            {/* Combined Participant Table with Source filtering & Badges */}
            <ParticipantTable
              participants={paginatedData.paginatedParticipants}
              totalFilteredCount={paginatedData.totalFilteredCount}
              onlineCount={paginatedData.onlineCount}
              offlineCount={paginatedData.offlineCount}
              verifiedCount={paginatedData.verifiedCount}
              pendingCount={paginatedData.pendingCount}
              rejectedCount={paginatedData.rejectedCount}
              filterState={filterState}
              onFilterChange={handleFilterChange}
              selectedParticipantIds={selectedParticipantIds}
              onToggleSelectParticipant={handleToggleSelectParticipant}
              onToggleSelectAll={handleToggleSelectAll}
              onViewParticipant={p => setViewingParticipant(p)}
              onOpenExportModal={onlySelected => {
                setExportOnlySelected(onlySelected);
                setIsExportModalOpen(true);
              }}
              selectedEventDisplayName={selectedEvent ? selectedEvent.displayName : null}
              onStatusChange={handleStatusChange}
            />
          </>
        ) : (
          <AccessDeniedView user={currentUser} requiredRole="ADMIN, DATABASE, CERTIFICATE or EVENT_COORDINATOR" />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-700">AIROX '26 Symposium</span> — Central Registration Management System (RBAC Enforced)
          </div>
          {currentUser?.role === 'ADMIN' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="text-indigo-600 hover:underline font-semibold cursor-pointer"
              >
                Live Edge-Case & RBAC Tests
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setIsAliasModalOpen(true)}
                className="text-slate-600 hover:underline cursor-pointer"
              >
                Alias Dictionary
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Modals */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        participants={paginatedData.filteredParticipants}
        selectedParticipantIds={selectedParticipantIds}
        onlySelected={exportOnlySelected}
        selectedEventDisplayName={selectedEvent ? selectedEvent.displayName : 'All_Events'}
      />

      <ParticipantModal
        participant={viewingParticipant}
        onClose={() => setViewingParticipant(null)}
        onStatusChange={handleStatusChange}
      />

      {currentUser?.role === 'ADMIN' && (
        <>
          <TestRunnerModal
            isOpen={isTestModalOpen}
            onClose={() => setIsTestModalOpen(false)}
          />

          <AliasManagerModal
            isOpen={isAliasModalOpen}
            onClose={() => setIsAliasModalOpen(false)}
            registry={registry}
            onSaveRegistry={handleSaveRegistry}
          />
        </>
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={(user, mustChange) => handleLoginSuccess(user, mustChange)}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        user={currentUser}
        isMandatoryFirstLogin={isMandatoryPasswordChange}
        onClose={() => {
          if (!isMandatoryPasswordChange) {
            setIsChangePasswordOpen(false);
          }
        }}
        onSuccess={updatedUser => {
          setCurrentUser(updatedUser);
          setIsMandatoryPasswordChange(false);
          setIsChangePasswordOpen(false);
        }}
      />
    </div>
  );
}
