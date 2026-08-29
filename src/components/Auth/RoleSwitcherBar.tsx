import React from 'react';
import {
  Shield,
  User,
  LogOut,
  LogIn,
  KeyRound,
  Calendar,
  AlertOctagon,
  Award
} from 'lucide-react';
import { AppUser, UserRole } from '../../types';
import { getUserRoles } from '../../services/auth';

interface RoleSwitcherBarProps {
  currentUser: AppUser | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onChangePasswordClick?: () => void;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentUser,
  onLoginClick,
  onLogoutClick,
  onChangePasswordClick
}) => {
  const getRoleBadge = (role?: UserRole) => {
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
      case 'REGISTRATION':
        return 'bg-teal-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const allRoles = getUserRoles(currentUser);

  return (
    <div className="bg-slate-900 text-white text-xs border-b border-slate-800 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Left: Active Session Identity */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Portal Session:</span>
            </span>

            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1 rounded-lg border border-slate-700">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <span className="font-semibold text-slate-100">{currentUser.name}</span>
                <span className="text-slate-400 font-mono text-[10px]">(@{currentUser.username || currentUser.email})</span>

                {/* Primary and secondary role badges */}
                <div className="flex items-center gap-1">
                  {allRoles.map(r => (
                    <span
                      key={r}
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getRoleBadge(r)}`}
                    >
                      {r.replace('_', ' ')}
                    </span>
                  ))}
                </div>

                {currentUser.role === 'EVENT_COORDINATOR' && currentUser.assignedEvents.length > 0 && (
                  <span className="bg-indigo-950 text-indigo-200 border border-indigo-700/60 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-300" />
                    <span>{currentUser.assignedEvents.join(', ')}</span>
                  </span>
                )}
              </div>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Not Authenticated</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentUser ? (
            <>
              {onChangePasswordClick && (
                <button
                  onClick={onChangePasswordClick}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
                  title="Change Password"
                >
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>Change Password</span>
                </button>
              )}

              <button
                onClick={onLogoutClick}
                className="bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 px-2.5 py-1 rounded-lg border border-slate-700 hover:border-rose-800 transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
                title="Sign Out"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              onClick={onLoginClick}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer text-[11px] shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Staff Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
