import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Mail, User, Calendar, AlertCircle } from 'lucide-react';
import { AppUser, UserRole, UserStatus } from '../../types';
import { DEFAULT_EVENT_REGISTRY } from '../../config/defaultAliases';

interface EditUserModalProps {
  isOpen: boolean;
  user: AppUser | null;
  onClose: () => void;
  onSubmit: (id: string, updates: {
    name?: string;
    username?: string;
    email?: string;
    role?: UserRole;
    secondaryRoles?: UserRole[];
    status?: UserStatus;
    assignedEvents?: string[];
    teamName?: string;
    yearSection?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('EVENT_COORDINATOR');
  const [secondaryRoles, setSecondaryRoles] = useState<UserRole[]>([]);
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [assignedEvents, setAssignedEvents] = useState<string[]>([]);
  const [teamName, setTeamName] = useState('');
  const [yearSection, setYearSection] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allRoles: UserRole[] = ['ADMIN', 'EVENT_COORDINATOR', 'ON_SPOT', 'DATABASE', 'CERTIFICATE', 'REGISTRATION'];

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setRole(user.role);
      setSecondaryRoles(user.secondaryRoles || []);
      setStatus(user.status);
      setAssignedEvents(user.assignedEvents || []);
      setTeamName(user.teamName || '');
      setYearSection(user.yearSection || '');
      setError(null);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const availableEvents = Object.values(DEFAULT_EVENT_REGISTRY).map(e => e.displayName);

  const toggleEvent = (eventName: string) => {
    setAssignedEvents(prev =>
      prev.includes(eventName)
        ? prev.filter(e => e !== eventName)
        : [...prev, eventName]
    );
  };

  const toggleSecondaryRole = (r: UserRole) => {
    setSecondaryRoles(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter user full name.');
      return;
    }

    if (role === 'EVENT_COORDINATOR' && assignedEvents.length === 0) {
      setError('Event Coordinators must have at least one assigned event.');
      return;
    }

    try {
      await onSubmit(user.id, {
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        role,
        secondaryRoles: secondaryRoles.filter(r => r !== role),
        status,
        assignedEvents: (role === 'EVENT_COORDINATOR' || secondaryRoles.includes('EVENT_COORDINATOR')) ? assignedEvents : [],
        teamName: teamName.trim() || undefined,
        yearSection: yearSection.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update user authorization');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit User Permissions</h2>
              <p className="text-xs text-slate-500 font-mono">@{user.username || user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
              />
            </div>
          </div>

          {/* Email & Team Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Organizing Team</label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          </div>

          {/* Year/Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Year / Section</label>
            <input
              type="text"
              value={yearSection}
              onChange={e => setYearSection(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>

          {/* Primary Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Role <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white font-medium"
              >
                <option value="EVENT_COORDINATOR">EVENT COORDINATOR (Event-Scoped)</option>
                <option value="ON_SPOT">ON_SPOT (Registration Desk Team)</option>
                <option value="REGISTRATION">REGISTRATION (Online Registration & Welcome)</option>
                <option value="DATABASE">DATABASE (All Participants Team)</option>
                <option value="CERTIFICATE">CERTIFICATE (Read-Only Cert Team)</option>
                <option value="ADMIN">ADMIN (Full Unrestricted Access)</option>
              </select>
            </div>
          </div>

          {/* Secondary Roles */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Secondary Roles
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {allRoles
                .filter(r => r !== role)
                .map(r => {
                  const isChecked = secondaryRoles.includes(r);
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() => toggleSecondaryRole(r)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-teal-50 text-teal-800 border-teal-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {r}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="edit-status"
                  value="ACTIVE"
                  checked={status === 'ACTIVE'}
                  onChange={() => setStatus('ACTIVE')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  Active (Allowed)
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="edit-status"
                  value="INACTIVE"
                  checked={status === 'INACTIVE'}
                  onChange={() => setStatus('INACTIVE')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                  Disabled (Denied)
                </span>
              </label>
            </div>
          </div>

          {/* Assigned Events (Only for EVENT_COORDINATOR or when EVENT_COORDINATOR is a secondary role) */}
          {(role === 'EVENT_COORDINATOR' || secondaryRoles.includes('EVENT_COORDINATOR')) && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Assigned Events ({assignedEvents.length})</span>
                </label>
                <span className="text-[10px] text-slate-500">Coordinator can only view/export checked events</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                {availableEvents.map(ev => {
                  const isSelected = assignedEvents.includes(ev);
                  return (
                    <button
                      type="button"
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      className={`text-left px-2 py-1.5 rounded text-[11px] font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <span className="truncate">{ev}</span>
                      {isSelected && <span className="text-xs font-bold text-indigo-600 ml-1">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
