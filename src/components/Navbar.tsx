import React from 'react';
import {
  Layers,
  UserPlus,
  BarChart3,
  Users,
  RefreshCw,
  UploadCloud,
  PlayCircle,
  Sliders,
  Award,
  Calendar,
  Lock,
  Download
} from 'lucide-react';
import { AppUser, UserRole } from '../types';

export type AppViewMode = 'extractor' | 'matrix' | 'offline' | 'users' | 'certificates';

interface NavbarProps {
  fileName: string | null;
  totalRegistrations: number;
  onlineCount?: number;
  offlineCount?: number;
  currentUser: AppUser | null;
  currentView: AppViewMode;
  setCurrentView: (view: AppViewMode) => void;
  onOpenUpload: () => void;
  onLoadSample: () => void;
  onOpenTests: () => void;
  onOpenAliases: () => void;
  onOpenAllEvents: () => void;
  onOpenExport?: () => void;
  onSyncData?: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  fileName,
  totalRegistrations,
  onlineCount = 0,
  offlineCount = 0,
  currentUser,
  currentView,
  setCurrentView,
  onOpenUpload,
  onLoadSample,
  onOpenTests,
  onOpenAliases,
  onOpenAllEvents,
  onOpenExport,
  onSyncData,
  isSyncing = false
}) => {
  const role = currentUser?.role;

  // Determine allowed navigation items per role
  const canSeeCombined = !currentUser || role === 'ADMIN' || role === 'DATABASE' || role === 'EVENT_COORDINATOR';
  const canSeeOfflineDesk = !currentUser || role === 'ADMIN' || role === 'ON_SPOT';
  const canSeeMatrix = !currentUser || role === 'ADMIN' || role === 'DATABASE';
  const canSeeUserManagement = currentUser && role === 'ADMIN';
  const canSeeCertificates = currentUser && (role === 'ADMIN' || role === 'CERTIFICATE');
  const isCoordinator = currentUser && role === 'EVENT_COORDINATOR';
  const isCertificateRole = currentUser && role === 'CERTIFICATE';

  return (
    <header id="airox-header" className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xs shrink-0">
              <span className="text-white font-black text-xl tracking-tighter">A</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight">
                  AIROX'26 Portal
                </h1>
                {currentUser && (
                  <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                    {currentUser.role === 'CERTIFICATE' ? 'CERTIFICATE DESK' : currentUser.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {isCertificateRole ? (
                  <span>Track and issue certificates for symposium participants</span>
                ) : isCoordinator ? (
                  <span>
                    Scoped to: <strong className="text-indigo-700">{currentUser?.assignedEvents.join(', ') || 'No Assigned Events'}</strong>
                  </span>
                ) : (
                  <span>
                    Online ({onlineCount}) + Offline ({offlineCount}) = <strong className="text-slate-800 font-semibold">{totalRegistrations} Combined</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (Role-Filtered) */}
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
            {/* Combined Extractor / Coordinator My Events */}
            {canSeeCombined && (
              <button
                id="tab-extractor"
                onClick={() => setCurrentView('extractor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  currentView === 'extractor'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isCoordinator ? <Calendar className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                <span>{isCoordinator ? 'My Assigned Events' : 'Participants'}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {totalRegistrations}
                </span>
              </button>
            )}

            {/* Offline Desk (Admin & On-Spot) */}
            {canSeeOfflineDesk && (
              <button
                id="tab-offline"
                onClick={() => setCurrentView('offline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  currentView === 'offline'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Offline Desk</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    currentView === 'offline' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {offlineCount} Sheets
                </span>
              </button>
            )}

            {/* Matrix / Events (Admin & Database) */}
            {canSeeMatrix && (
              <button
                id="tab-matrix"
                onClick={() => setCurrentView('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  currentView === 'matrix'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Events Matrix</span>
              </button>
            )}

            {/* Certificate Team View */}
            {canSeeCertificates && (
              <button
                id="tab-certificates"
                onClick={() => setCurrentView('certificates')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  currentView === 'certificates'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Certificate Desk</span>
              </button>
            )}

            {/* Admin Users & RBAC */}
            {canSeeUserManagement && (
              <button
                id="tab-users"
                onClick={() => setCurrentView('users')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  currentView === 'users'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users & RBAC</span>
              </button>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Export button for Coordinators, Database, or Admin (NOT CERTIFICATE) */}
            {onOpenExport && (role === 'ADMIN' || role === 'DATABASE' || role === 'EVENT_COORDINATOR') && (
              <button
                id="btn-quick-export"
                onClick={onOpenExport}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Export Authorized Participant Rosters (XLSX / CSV)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            {onSyncData && (role === 'ADMIN' || role === 'DATABASE' || role === 'ON_SPOT' || role === 'EVENT_COORDINATOR') && (
              <button
                id="btn-sync-data"
                onClick={onSyncData}
                disabled={isSyncing}
                className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                title="Sync and Re-combine Online & Offline Google Sheets Registrations"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}

            {/* Admin only: upload, tests, aliases */}
            {(role === 'ADMIN' || !currentUser) && (
              <>
                <button
                  id="btn-upload-file"
                  onClick={onOpenUpload}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-100 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Upload Online Registration Excel/CSV"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden lg:inline">Update File</span>
                </button>

                <button
                  id="btn-test-suite"
                  onClick={onOpenTests}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition-colors shadow-xs cursor-pointer"
                  title="Live Edge-Case & RBAC Tests"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden xl:inline">Tests</span>
                </button>

                <button
                  id="btn-alias-settings"
                  onClick={onOpenAliases}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition-colors shadow-xs cursor-pointer"
                  title="Aliases & Settings"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden xl:inline">Aliases</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
