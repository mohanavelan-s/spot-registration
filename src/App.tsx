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
import { offlineApiClient } from './services/googleSheetsService';
import {
  getStoredUser,
  setStoredUser,
  checkCurrentSession,
  switchTestPersona,
  logout,
  canAccessEvent,
  canExportEvent,
  canManageUsers
} from './services/auth';
import { SAMPLE_AIROX26_RAW_DATA } from './data/sampleDataset';
import { DEFAULT_EVENT_REGISTRY } from './config/defaultAliases';

export default function App() {
  // Auth and Session state (Default to Admin persona for immediate sandbox exploration)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const stored = getStoredUser();
    if (stored) return stored;
    return {
      id: 'usr-admin-1',
      email: 'mohanavelandev@gmail.com',
      name: 'Mohanavelan Dev',
      role: 'ADMIN',
      status: 'ACTIVE',
      assignedEvents: []
    };
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSwitchingPersona, setIsSwitchingPersona] = useState(false);

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
      }
    });
  }, []);

  // When switching personas or logging in
  const handleSwitchPersona = async (email: string) => {
    setIsSwitchingPersona(true);
    try {
      const user = await switchTestPersona(email);
      setCurrentUser(user);
      // Adjust view if needed based on role
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
      } else if (user.role === 'ADMIN') {
        setCurrentView('extractor');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to switch persona');
    } finally {
      setIsSwitchingPersona(false);
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

  // Sync Offline & Online Data
  const handleSyncData = async () => {
    setIsOfflineLoading(true);
    try {
      const res = await offlineApiClient.syncRegistrations();
      setOfflineRecords(res.records);
      setOfflineSourceType(res.source);
      setOfflineError(null);
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      setOfflineError(err.message || 'Sync failed');
    } finally {
      setIsOfflineLoading(false);
    }
  };

  // Callback when offline records are modified directly in the Offline Registration Desk
  const handleOfflineRecordsChange = useCallback((updatedRecords: OfflineRegistrationRecord[]) => {
    setOfflineRecords(updatedRecords);
    setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  // Load default dataset & fetch offline data on initial mount
  useEffect(() => {
    loadSampleDataset();
    fetchOfflineData();
  }, [loadSampleDataset, fetchOfflineData]);

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
      {/* Top Testing Persona & Role Bar */}
      <RoleSwitcherBar
        currentUser={currentUser}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
        onSwitchPersona={handleSwitchPersona}
        isSwitching={isSwitchingPersona}
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
          currentUser.role === 'ADMIN' || currentUser.role === 'CERTIFICATE' ? (
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
          currentUser.role === 'ADMIN' || currentUser.role === 'ON_SPOT' ? (
            <OfflineRegistrationPage
              onlineParticipants={parseResult?.participants || []}
              onRecordsChange={handleOfflineRecordsChange}
            />
          ) : (
            <AccessDeniedView user={currentUser} requiredRole="ON_SPOT or ADMIN" />
          )
        ) : currentView === 'matrix' ? (
          /* Master Symposium Matrix (Admin & Database) */
          currentUser.role === 'ADMIN' || currentUser.role === 'DATABASE' ? (
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
        ) : (currentUser.role === 'ADMIN' || currentUser.role === 'DATABASE' || currentUser.role === 'EVENT_COORDINATOR') ? (
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
            <span className="font-bold text-slate-700">AIROX '26 Symposium</span> — Central Registration Management System (RBAC Enabled)
          </div>
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

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={user => setCurrentUser(user)}
      />
    </div>
  );
}
