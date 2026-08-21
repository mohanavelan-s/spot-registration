import React, { useState } from 'react';
import { X, LogIn, Shield, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { googleSignIn, switchTestPersona } from '../../services/auth';
import { AppUser } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AppUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onSuccess(result.appUser);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed or user is not authorized.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonaSelect = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await switchTestPersona(email);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to switch persona.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">AIROX'26 Staff Portal</h2>
              <p className="text-xs text-slate-500">Secure Role-Based Authentication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center space-y-1">
            <p className="text-xs text-slate-600">
              Sign in with your authorized Google Account to manage registrations, event rosters, and exports.
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isLoading ? 'Signing In...' : 'Sign in with Google OAuth'}</span>
          </button>

          {/* Quick Testing Personas */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Quick Role Test Logins:
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handlePersonaSelect('mohanavelandev@gmail.com')}
                className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 text-left font-medium border border-purple-200 transition-colors"
              >
                <div className="font-bold">Admin</div>
                <div className="text-[9px] text-purple-600">Full Access</div>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaSelect('coordinator.finalhire@airox26.org')}
                className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-left font-medium border border-indigo-200 transition-colors"
              >
                <div className="font-bold">Final Hire Coord</div>
                <div className="text-[9px] text-indigo-600">Event-Scoped</div>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaSelect('onspot@airox26.org')}
                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-left font-medium border border-emerald-200 transition-colors"
              >
                <div className="font-bold">On-Spot Desk</div>
                <div className="text-[9px] text-emerald-600">Offline CRUD</div>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaSelect('database@airox26.org')}
                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-left font-medium border border-blue-200 transition-colors"
              >
                <div className="font-bold">Database Team</div>
                <div className="text-[9px] text-blue-600">All Participants</div>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaSelect('certificate@airox26.org')}
                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-left font-medium border border-amber-200 transition-colors"
              >
                <div className="font-bold">Certificate Team</div>
                <div className="text-[9px] text-amber-600">Read-Only Export</div>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaSelect('disabled.user@airox26.org')}
                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-left font-medium border border-rose-200 transition-colors"
              >
                <div className="font-bold">Disabled Account</div>
                <div className="text-[9px] text-rose-600">Deny Access Test</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
