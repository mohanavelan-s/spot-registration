import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Calendar,
  RefreshCw,
  FileText,
  AlertCircle
} from 'lucide-react';
import { AppUser, UserRole, UserStatus } from '../../types';
import {
  fetchUsersList,
  createUser,
  updateUser,
  deleteUser
} from '../../services/auth';
import { AddUserModal } from './AddUserModal';
import { EditUserModal } from './EditUserModal';
import { AuditLogsView } from './AuditLogsView';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [error, setError] = useState<string | null>(null);

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
    email: string;
    role: UserRole;
    status: UserStatus;
    assignedEvents: string[];
  }) => {
    await createUser(userData);
    await loadUsers();
  };

  const handleEditUser = async (
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      status?: UserStatus;
      assignedEvents?: string[];
    }
  ) => {
    await updateUser(id, updates);
    await loadUsers();
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

  const handleDeleteUser = async (user: AppUser) => {
    if (user.role === 'ADMIN' && user.email === 'mohanavelandev@gmail.com') {
      alert('Primary administrator account cannot be deleted.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove authorization for "${user.name}" (${user.email})?`)) {
      try {
        await deleteUser(user.id);
        await loadUsers();
      } catch (err: any) {
        alert(err.message || 'Failed to delete user');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.assignedEvents.some(ev => ev.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
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
              Configure symposium roles, event-scoped assignments, and review security audit logs
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
              <span>Users ({users.length})</span>
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
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

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
                  placeholder="Search by name, email, or event..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="EVENT_COORDINATOR">EVENT_COORDINATOR</option>
                <option value="ON_SPOT">ON_SPOT</option>
                <option value="DATABASE">DATABASE</option>
                <option value="CERTIFICATE">CERTIFICATE</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                {filteredUsers.length} authorized accounts
              </span>
              <button
                onClick={loadUsers}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Symposium Role</th>
                    <th className="py-3.5 px-4">Assigned Events</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Activity</th>
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
                    filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{user.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${getRoleBadge(user.role)}`}>
                            {user.role}
                          </span>
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
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit user role and events"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={user.email === 'mohanavelandev@gmail.com'}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Remove user authorization"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
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
        onSubmit={handleAddUser}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={Boolean(editingUser)}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSubmit={handleEditUser}
      />
    </div>
  );
};
