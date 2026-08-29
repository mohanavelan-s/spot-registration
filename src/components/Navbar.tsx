import React from 'react';
import {
  Layers,
  UserPlus,
  BarChart3,
  Users,
  RefreshCw,
  Award,
  Calendar,
  KeyRound,
  SlidersHorizontal
} from 'lucide-react';
import { AppUser, UserRole } from '../types';
import { getUserRoles } from '../services/auth';

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
  onOpenEventCustomizer?: () => void;
  eventsCount?: number;
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
  isSyncing = false,
  onOpenEventCustomizer,
  eventsCount
}) => {
  const roles = getUserRoles(currentUser);

  // Determine allowed navigation items per role
  const canSeeCombined = !currentUser || roles.includes('ADMIN') || roles.includes('DATABASE') || roles.includes('EVENT_COORDINATOR') || roles.includes('REGISTRATION');
  const canSeeOfflineDesk = !currentUser || roles.includes('ADMIN') || roles.includes('ON_SPOT') || roles.includes('REGISTRATION');
  const canSeeMatrix = !currentUser || roles.includes('ADMIN') || roles.includes('DATABASE');
  const canSeeUserManagement = currentUser && roles.includes('ADMIN');
  const canSeeCertificates = currentUser && (roles.includes('ADMIN') || roles.includes('CERTIFICATE'));
  const isCoordinator = currentUser && currentUser.role === 'EVENT_COORDINATOR';
  const isCertificateRole = currentUser && currentUser.role === 'CERTIFICATE';

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
                    {currentUser.role.replace('_', ' ')}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
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

            {/* Offline Desk (Admin, On-Spot, Registration) */}
            {canSeeOfflineDesk && (
              <button
                id="tab-offline"
                onClick={() => setCurrentView('offline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
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

            {/* Certificate Desk */}
            {canSeeCertificates && (
              <button
                id="tab-certificates"
                onClick={() => setCurrentView('certificates')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'certificates'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Certificate Desk</span>
              </button>
            )}

            {/* Matrix / Events (Admin & Database) */}
            {canSeeMatrix && (
              <button
                id="tab-matrix"
                onClick={() => setCurrentView('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'matrix'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Events Matrix</span>
              </button>
            )}

            {/* Admin-Only User Management Tab */}
            {canSeeUserManagement && (
              <button
                id="tab-users"
                onClick={() => setCurrentView('users')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'users'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Management</span>
              </button>
            )}
          </div>

          {/* Right Action Icons & Sync */}
          <div className="flex items-center gap-2">
            {/* Admin-Only Events & Tracks Customizer */}
            {roles.includes('ADMIN') && onOpenEventCustomizer && (
              <button
                id="btn-manage-events-tracks"
                onClick={onOpenEventCustomizer}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                title="Customise symposium event names, tracks (Technical / Non-Technical), and total events"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">Events &amp; Tracks</span>
                <span className="sm:hidden">Events</span>
                {typeof eventsCount === 'number' && (
                  <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-indigo-200/80 text-indigo-900">
                    {eventsCount}
                  </span>
                )}
              </button>
            )}

            {onSyncData && (
              <button
                id="btn-sync-live-data"
                onClick={onSyncData}
                disabled={isSyncing}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                title="Sync Live Data with Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 transform-gpu ${isSyncing ? 'animate-spin text-indigo-600' : 'transition-transform duration-300'}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
