import React, { useState } from 'react';
import { X, UserPlus, Shield, Mail, User, Calendar, AlertCircle, Lock, BookOpen, Layers } from 'lucide-react';
import { UserRole, UserStatus } from '../../types';
import { DEFAULT_EVENT_REGISTRY } from '../../config/defaultAliases';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: {
    name: string;
    username?: string;
    email?: string;
    role: UserRole;
    secondaryRoles?: UserRole[];
    status?: UserStatus;
    assignedEvents?: string[];
    teamName?: string;
    yearSection?: string;
    password?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
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
  const [assignedEvents, setAssignedEvents] = useState<string[]>(['The Final Hire']);
  const [teamName, setTeamName] = useState('');
  const [yearSection, setYearSection] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableEvents = Object.values(DEFAULT_EVENT_REGISTRY).map(e => e.displayName);
  const allRoles: UserRole[] = ['ADMIN', 'EVENT_COORDINATOR', 'ON_SPOT', 'DATABASE', 'CERTIFICATE', 'REGISTRATION'];

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

  const handleNameChange = (val: string) => {
    setName(val);
    if (!username || username === name.toLowerCase().replace(/[^a-z0-9]/g, '_')) {
      setUsername(val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    }
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
      await onSubmit({
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim().toLowerCase() || `${username || name.toLowerCase().replace(/[^a-z0-9]/g, '_')}@airox26.org`,
        role,
        secondaryRoles: secondaryRoles.filter(r => r !== role),
        status,
        assignedEvents: (role === 'EVENT_COORDINATOR' || secondaryRoles.includes('EVENT_COORDINATOR')) ? assignedEvents : [],
        teamName: teamName.trim() || undefined,
        yearSection: yearSection.trim() || undefined,
        password: password.trim() || undefined
      });
      onClose();
      // Reset
      setName('');
      setUsername('');
      setEmail('');
      setRole('EVENT_COORDINATOR');
      setSecondaryRoles([]);
      setAssignedEvents(['The Final Hire']);
      setTeamName('');
      setYearSection('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to authorize user');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Authorize New User</h2>
              <p className="text-xs text-slate-500">Add symposium staff and configure role permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
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
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username <span className="text-slate-400">(Unique ID)</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. rahul_sharma"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
              />
            </div>
          </div>

          {/* Email & Team Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. rahul@airox26.org"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Organizing Team / Committee
              </label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. The Final Hire"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          </div>

          {/* Year/Section & Initial Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Year / Department / Section
              </label>
              <input
                type="text"
                value={yearSection}
                onChange={e => setYearSection(e.target.value)}
                placeholder="e.g. III CSE A"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Password <span className="text-slate-400">(Optional)</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Defaults to full name lowercase"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                />
              </div>
            </div>
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
                <option value="ON_SPOT">ON_SPOT (On-Spot Registration Desk Team)</option>
                <option value="REGISTRATION">REGISTRATION (Online Registration & Welcome)</option>
                <option value="DATABASE">DATABASE (Database Team - All Participants)</option>
                <option value="CERTIFICATE">CERTIFICATE (Certificate Writing Team)</option>
                <option value="ADMIN">ADMIN (Full System Administrator)</option>
              </select>
            </div>
          </div>

          {/* Secondary Roles (Dual assignments) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Secondary Roles <span className="text-slate-400">(Optional multi-role access)</span>
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
                  name="status"
                  value="ACTIVE"
                  checked={status === 'ACTIVE'}
                  onChange={() => setStatus('ACTIVE')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  Active
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="INACTIVE"
                  checked={status === 'INACTIVE'}
                  onChange={() => setStatus('INACTIVE')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Disabled
                </span>
              </label>
            </div>
          </div>

          {/* Assigned Events */}
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
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Authorizing...' : 'Authorize User'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
