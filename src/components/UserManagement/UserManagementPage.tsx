import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  RefreshCw,
  FileText,
  AlertCircle,
  KeyRound,
  Lock,
  RotateCcw
} from 'lucide-react';
import { AppUser, UserRole, UserStatus, EventAliasMap } from '../../types';
import {
  fetchUsersList,
  createUser,
  updateUser,
  deleteUser,
  adminResetPasswordApi
} from '../../services/auth';
import { AddUserModal } from './AddUserModal';
import { EditUserModal } from './EditUserModal';
import { AuditLogsView } from './AuditLogsView';
import { CustomSelect } from '../ui/CustomSelect';

interface UserManagementPageProps {
  registry?: EventAliasMap;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ registry }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUsersList();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (userData: {
    name: string;
    username?: string;
    email?: string;
    role: UserRole;
    additionalRoles?: UserRole[];
    status?: UserStatus;
    assignedEvents?: string[];
    initialPassword?: string;
  }) => {
    await createUser(userData);
    await loadUsers();
    setNotice(`User "${userData.name}" added successfully.`);
  };

  const handleEditUser = async (
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      additionalRoles?: UserRole[];
      status?: UserStatus;
      assignedEvents?: string[];
    }
  ) => {
    await updateUser(id, updates);
    await loadUsers();
    setNotice('User updated successfully.');
  };

  const handleToggleStatus = async (user: AppUser) => {
    try {
      const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateUser(user.id, { status: newStatus });
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleResetPassword = async (user: AppUser) => {
    if (!window.confirm(`Reset password for "${user.name}" (@${user.username}) to the default initial password?`)) {
      return;
    }
    try {
      const res = await adminResetPasswordApi(user.id);
      await loadUsers();
      setNotice(res.defaultPasswordNotice || `Password reset successfully for ${user.name}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (user.role === 'ADMIN' && (user.username === 'mohanavelan_s' || user.email === 'mohanavelandev@gmail.com')) {
      alert('Primary administrator account cannot be deleted.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove authorization for "${user.name}" (@${user.username})?`)) {
      try {
        await deleteUser(user.id);
        await loadUsers();
        setNotice(`User "${user.name}" removed successfully.`);
      } catch (err: any) {
        alert(err.message || 'Failed to delete user');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      u.assignedEvents.some(ev => ev.toLowerCase().includes(search.toLowerCase()));

    const userRoles = [u.role, ...(u.additionalRoles || [])];
    const matchesRole = roleFilter === 'ALL' || userRoles.includes(roleFilter as UserRole);
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'EVENT_COORDINATOR':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ON_SPOT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REGISTRATION':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'DATABASE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CERTIFICATE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">User Management & Access Control</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                ADMIN ONLY
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage organizing team accounts, role privileges, password resets, and security logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Sub-tabs switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'users' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff Accounts ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'audit' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Logs</span>
            </button>
          </div>

          {activeTab === 'users' && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Account</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={loadUsers} className="underline font-semibold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* View Content */}
      {activeTab === 'audit' ? (
        <AuditLogsView />
      ) : (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by name, username, email, or event..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
              <div className="w-48">
                <CustomSelect
                  id="select-user-role-filter"
                  value={roleFilter}
                  onChange={val => setRoleFilter(val)}
                  size="sm"
                  options={[
                    { value: 'ALL', label: 'All Roles' },
                    { value: 'ADMIN', label: 'ADMIN' },
                    { value: 'EVENT_COORDINATOR', label: 'EVENT_COORDINATOR' },
                    { value: 'ON_SPOT', label: 'ON_SPOT' },
                    { value: 'REGISTRATION', label: 'REGISTRATION' },
                    { value: 'DATABASE', label: 'DATABASE' },
                    { value: 'CERTIFICATE', label: 'CERTIFICATE' }
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                {filteredUsers.length} authorized accounts
              </span>
              <button
                onClick={loadUsers}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member & Login</th>
                    <th className="py-3.5 px-4">Role(s)</th>
                    <th className="py-3.5 px-4">Assigned Events</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Password State</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No authorized users found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const allRoles = [user.role, ...(user.additionalRoles || [])];
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{user.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-indigo-600 font-mono bg-indigo-50 px-1.5 py-0.2 rounded font-semibold">
                                @{user.username}
                              </span>
                              {user.email && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {user.email}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {allRoles.map(r => (
                                <span
                                  key={r}
                                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadge(r)}`}
                                >
                                  {r.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {user.role === 'EVENT_COORDINATOR' ? (
                              user.assignedEvents && user.assignedEvents.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {user.assignedEvents.map(ev => (
                                    <span
                                      key={ev}
                                      className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold text-[10px]"
                                    >
                                      {ev}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-rose-500 font-semibold italic">
                                  No Events Assigned (Deny)
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Global Scope</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                                user.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              }`}
                              title="Click to toggle status"
                            >
                              {user.status === 'ACTIVE' ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>ACTIVE</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>DISABLED</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            {user.mustChangePassword ? (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium inline-flex items-center gap-1">
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>Default (Unchanged)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>Custom Password Set</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleResetPassword(user)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Reset to default password"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingUser(user)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Roles / Assignments"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        registry={registry}
        onSubmit={handleAddUser}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={Boolean(editingUser)}
        user={editingUser}
        registry={registry}
        onClose={() => setEditingUser(null)}
        onSubmit={handleEditUser}
      />
    </div>
  );
};
