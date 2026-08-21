import React from 'react';
import { ShieldAlert, Lock, UserX, LogIn } from 'lucide-react';
import { AppUser } from '../../types';

interface AccessDeniedViewProps {
  user: AppUser | null;
  requiredRole?: string;
  eventName?: string;
  onLoginClick?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  user,
  requiredRole,
  eventName,
  onLoginClick
}) => {
  return (
    <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-8 shadow-xs">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied (403 Forbidden)</h2>

      {user ? (
        user.status !== 'ACTIVE' ? (
          <div className="space-y-3">
            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
              Your account <strong>({user.email})</strong> is marked as <strong>INACTIVE / DISABLED</strong>.
            </p>
            <p className="text-xs text-slate-600">
              Please contact the symposium administrator to re-enable your account.
            </p>
          </div>
        ) : eventName ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              You are signed in as <strong>{user.name}</strong> ({user.role}), but you are <strong>not authorized</strong> to view or export participants for event:
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
              {eventName}
            </div>
            <p className="text-[11px] text-slate-500">
              Your assigned events are: {user.assignedEvents?.join(', ') || 'None'}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              You do not have the required permissions <strong>({requiredRole || 'Authorized Role'})</strong> to access this section.
            </p>
            <p className="text-xs text-slate-500">
              Current role: <strong className="text-slate-800">{user.role}</strong>
            </p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            You must be authenticated with an authorized symposium staff account to view protected participant records and rosters.
          </p>
          {onLoginClick && (
            <button
              onClick={onLoginClick}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Authorized Google Account</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
