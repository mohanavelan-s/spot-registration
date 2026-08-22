import React from 'react';
import {
  Shield,
  User,
  LogOut,
  LogIn,
  KeyRound,
  Calendar,
  AlertOctagon,
  Lock,
  Building
} from 'lucide-react';
import { AppUser, UserRole } from '../../types';

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
  const getRoleBadgeStyle = (role?: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-600 text-white border-purple-500';
      case 'EVENT_COORDINATOR':
        return 'bg-indigo-600 text-white border-indigo-500';
      case 'ON_SPOT':
        return 'bg-emerald-600 text-white border-emerald-500';
      case 'DATABASE':
        return 'bg-blue-600 text-white border-blue-500';
      case 'CERTIFICATE':
        return 'bg-amber-600 text-white border-amber-500';
      case 'REGISTRATION':
        return 'bg-teal-600 text-white border-teal-500';
      default:
        return 'bg-slate-700 text-slate-200 border-slate-600';
    }
  };

  return (
    <div id="auth-session-bar" className="bg-slate-900 text-white text-xs border-b border-slate-800 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Current Authenticated User Identity */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Authenticated Session:</span>
          </span>

          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <span className="font-semibold text-slate-100">{currentUser.name}</span>
              <span className="text-slate-400 font-mono text-[10px]">
                (@{currentUser.username || currentUser.email})
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeStyle(currentUser.role)}`}>
                {currentUser.role === 'CERTIFICATE' ? 'CERTIFICATE DESK' : currentUser.role}
              </span>

              {currentUser.teamName && (
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-slate-300 bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-600/50">
                  <Building className="w-2.5 h-2.5 text-slate-400" />
                  <span>{currentUser.teamName}</span>
                </span>
              )}

              {currentUser.secondaryRoles && currentUser.secondaryRoles.length > 0 && (
                <span className="bg-teal-900/60 text-teal-200 border border-teal-700/60 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  +{currentUser.secondaryRoles.join(', ')}
                </span>
              )}

              {currentUser.role === 'EVENT_COORDINATOR' && currentUser.assignedEvents.length > 0 && (
                <span className="bg-indigo-900/60 text-indigo-200 border border-indigo-700/60 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-300" />
                  <span>{currentUser.assignedEvents.join(', ')}</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-amber-400 font-medium flex items-center gap-1 text-xs">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Unauthenticated (Portal Locked)</span>
            </span>
          )}
        </div>

        {/* User Account Controls */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-1.5">
              {onChangePasswordClick && (
                <button
                  id="btn-change-pwd-bar"
                  onClick={onChangePasswordClick}
                  className="bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
                  title="Change Password"
                >
                  <Lock className="w-3 h-3" />
                  <span>Change Password</span>
                </button>
              )}
              <button
                id="btn-signout-bar"
                onClick={onLogoutClick}
                className="bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-200 px-2.5 py-1 rounded-lg border border-slate-700 hover:border-rose-800/60 transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
                title="Sign Out"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              id="btn-signin-bar"
              onClick={onLoginClick}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer text-[11px] shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Portal Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
