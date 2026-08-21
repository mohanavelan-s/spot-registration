import React from 'react';
import {
  Shield,
  User,
  LogOut,
  LogIn,
  KeyRound,
  CheckCircle2,
  Calendar,
  Sparkles,
  AlertOctagon
} from 'lucide-react';
import { AppUser, UserRole } from '../../types';

interface RoleSwitcherBarProps {
  currentUser: AppUser | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onSwitchPersona: (email: string) => Promise<void>;
  isSwitching?: boolean;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentUser,
  onLoginClick,
  onLogoutClick,
  onSwitchPersona,
  isSwitching = false
}) => {
  const personas = [
    {
      label: 'Admin (Full)',
      email: 'mohanavelandev@gmail.com',
      role: 'ADMIN',
      badge: 'bg-purple-100 text-purple-800'
    },
    {
      label: 'The Final Hire Coordinator',
      email: 'coordinator.finalhire@airox26.org',
      role: 'EVENT_COORDINATOR',
      badge: 'bg-indigo-100 text-indigo-800'
    },
    {
      label: 'AD Shot Coordinator',
      email: 'coordinator.adshot@airox26.org',
      role: 'EVENT_COORDINATOR',
      badge: 'bg-indigo-100 text-indigo-800'
    },
    {
      label: 'On-Spot Desk',
      email: 'onspot@airox26.org',
      role: 'ON_SPOT',
      badge: 'bg-emerald-100 text-emerald-800'
    },
    {
      label: 'Database Team',
      email: 'database@airox26.org',
      role: 'DATABASE',
      badge: 'bg-blue-100 text-blue-800'
    },
    {
      label: 'Certificate Team',
      email: 'certificate@airox26.org',
      role: 'CERTIFICATE',
      badge: 'bg-amber-100 text-amber-800'
    },
    {
      label: 'Disabled User',
      email: 'disabled.user@airox26.org',
      role: 'DISABLED',
      badge: 'bg-rose-100 text-rose-800'
    }
  ];

  const getRoleColor = (role?: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-600 text-white';
      case 'EVENT_COORDINATOR':
        return 'bg-indigo-600 text-white';
      case 'ON_SPOT':
        return 'bg-emerald-600 text-white';
      case 'DATABASE':
        return 'bg-blue-600 text-white';
      case 'CERTIFICATE':
        return 'bg-amber-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="bg-slate-900 text-white text-xs border-b border-slate-800 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Current Identity */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>RBAC Session:</span>
            </span>

            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <span className="font-semibold text-slate-200">{currentUser.name}</span>
                <span className="text-slate-400 font-mono text-[10px]">({currentUser.email})</span>
                <span className={`px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider ${getRoleColor(currentUser.role)}`}>
                  {currentUser.role}
                </span>

                {currentUser.role === 'EVENT_COORDINATOR' && currentUser.assignedEvents.length > 0 && (
                  <span className="bg-indigo-900/60 text-indigo-200 border border-indigo-700/60 px-1.5 py-0.2 rounded text-[10px] font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{currentUser.assignedEvents.join(', ')}</span>
                  </span>
                )}
              </div>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Not Authenticated (Default Deny)</span>
              </span>
            )}
          </div>
        </div>

        {/* Fast Persona Switcher & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 hidden lg:inline">Test Role:</span>
          <select
            value={currentUser?.email || ''}
            onChange={e => e.target.value && onSwitchPersona(e.target.value)}
            disabled={isSwitching}
            className="bg-slate-800 text-slate-200 text-[11px] font-medium py-1 px-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="" disabled>
              ⚡ Switch Test Account / Persona
            </option>
            {personas.map(p => (
              <option key={p.email} value={p.email}>
                {p.label} ({p.role})
              </option>
            ))}
          </select>

          {currentUser ? (
            <button
              onClick={onLogoutClick}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
              title="Sign Out"
            >
              <LogOut className="w-3 h-3 text-rose-400" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              onClick={onLoginClick}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer text-[11px] shadow-xs"
            >
              <LogIn className="w-3 h-3" />
              <span>Google Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
