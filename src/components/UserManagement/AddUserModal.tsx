import React, { useState } from 'react';
import { X, UserPlus, Shield, Mail, User, Lock, AlertCircle } from 'lucide-react';
import { UserRole, UserStatus, EventAliasMap, EventConfig } from '../../types';
import { DEFAULT_EVENT_REGISTRY } from '../../config/defaultAliases';
import { CustomSelect } from '../ui/CustomSelect';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  registry?: EventAliasMap;
  onSubmit: (userData: {
    name: string;
    username?: string;
    email?: string;
    role: UserRole;
    additionalRoles?: UserRole[];
    status: UserStatus;
    assignedEvents: string[];
    initialPassword?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  registry,
  onSubmit,
  isSubmitting = false
}) => {
  useBodyScrollLock(isOpen);
  const activeRegistry = registry || DEFAULT_EVENT_REGISTRY;
  const configList = Object.values(activeRegistry) as EventConfig[];
  const defaultEventName = configList[0]?.displayName || 'The Final Hire';
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('EVENT_COORDINATOR');
  const [additionalRoles, setAdditionalRoles] = useState<UserRole[]>([]);
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [assignedEvents, setAssignedEvents] = useState<string[]>([defaultEventName]);
  const [customPassword, setCustomPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableEvents = configList.map(e => e.displayName);
  const possibleAdditionalRoles: UserRole[] = ['CERTIFICATE', 'REGISTRATION', 'ON_SPOT', 'DATABASE'];

  const handleNameChange = (val: string) => {
    setName(val);
    if (!username || username === name.toLowerCase().replace(/[^a-z0-9]/g, '_')) {
      setUsername(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
    }
  };

  const toggleEvent = (eventName: string) => {
    setAssignedEvents(prev =>
      prev.includes(eventName)
        ? prev.filter(e => e !== eventName)
        : [...prev, eventName]
    );
  };

  const toggleAdditionalRole = (r: UserRole) => {
    setAdditionalRoles(prev =>
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
      await onSubmit({
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        role,
        additionalRoles: additionalRoles.filter(r => r !== role),
        status,
        assignedEvents: role === 'EVENT_COORDINATOR' ? assignedEvents : [],
        initialPassword: customPassword.trim() || undefined
      });
      onClose();
      // Reset
      setName('');
      setUsername('');
      setEmail('');
      setRole('EVENT_COORDINATOR');
      setAdditionalRoles([]);
      setAssignedEvents(['The Final Hire']);
      setCustomPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
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
              <h2 className="text-base font-bold text-slate-900">Add Staff Account</h2>
              <p className="text-xs text-slate-500">Create login credentials and symposium role permissions</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
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
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Staff Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. rahul_sharma"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Optional Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Primary Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Role <span className="text-rose-500">*</span>
            </label>
            <CustomSelect
              id="select-add-user-primary-role"
              value={role}
              onChange={val => setRole(val as UserRole)}
              icon={<Shield className="w-4 h-4 text-slate-400" />}
              options={[
                { value: 'EVENT_COORDINATOR', label: 'EVENT COORDINATOR (Assigned Events Scope)' },
                { value: 'ON_SPOT', label: 'ON_SPOT (Registration Desk Team)' },
                { value: 'REGISTRATION', label: 'REGISTRATION (Welcome & Online Reg Committee)' },
                { value: 'DATABASE', label: 'DATABASE (Global All Participants Access)' },
                { value: 'CERTIFICATE', label: 'CERTIFICATE (Certificate Desk & Printing)' },
                { value: 'ADMIN', label: 'ADMIN (Full System Administration)' }
              ]}
            />
          </div>

          {/* Additional Roles Multi-Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Additional Responsibilities (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {possibleAdditionalRoles.filter(r => r !== role).map(r => (
                <button
                  type="button"
                  key={r}
                  onClick={() => toggleAdditionalRole(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    additionalRoles.includes(r)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  + {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Event Assignment (Only for EVENT_COORDINATOR) */}
          {role === 'EVENT_COORDINATOR' && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700">
                Assigned Symposium Events <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Select the specific events this coordinator is permitted to view and export:
              </p>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {availableEvents.map(eventName => (
                  <label
                    key={eventName}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-xs text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={assignedEvents.includes(eventName)}
                      onChange={() => toggleEvent(eventName)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate">{eventName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Initial Password */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Password (Optional)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={customPassword}
                onChange={e => setCustomPassword(e.target.value)}
                placeholder="Leave blank to use full name in lowercase"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              User will be asked to set a custom password upon first login.
            </p>
          </div>

          {/* Submit */}
          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
