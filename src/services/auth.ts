import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole, UserStatus, AuditLogEntry, AuditActionType } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'consent select_account'
});

const USER_STORAGE_KEY = 'airox_auth_user';
const GOOGLE_TOKEN_STORAGE_KEY = 'airox_google_access_token';

let isSigningIn = false;
let currentAppUser: AppUser | null = null;
let cachedAccessToken: string | null = null;

export const DEFAULT_ADMIN_USER: AppUser = {
  id: 'usr_admin_01',
  name: 'Mohanavelan S',
  username: 'mohanavelan_s',
  email: 'mohanavelandev@gmail.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  assignedEvents: [],
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z'
};

try {
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem(USER_STORAGE_KEY) : null;
  if (storedUser) {
    currentAppUser = JSON.parse(storedUser);
  } else {
    currentAppUser = DEFAULT_ADMIN_USER;
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_ADMIN_USER));
    }
  }
} catch {
  currentAppUser = DEFAULT_ADMIN_USER;
}

export const getStoredUser = (): AppUser | null => currentAppUser || DEFAULT_ADMIN_USER;

export const getAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY) || sessionStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY);
    if (token) {
      cachedAccessToken = token;
      return token;
    }
  }
  return null;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(GOOGLE_TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(GOOGLE_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
    }
  }
};

/**
 * Initialize auth listener
 */
export const initAuth = (
  callback: (user: User | null) => void,
  onSignOut?: () => void
): (() => void) => {
  return onAuthStateChanged(auth, async user => {
    if (user) {
      callback(user);
    } else {
      callback(null);
      if (onSignOut) onSignOut();
    }
  });
};

export const setStoredUser = (user: AppUser | null) => {
  currentAppUser = user;
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }
};

/**
 * Standard Auth Request Headers to attach user username/email and identity
 */
export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const user = getStoredUser();
  if (user) {
    if (user.username) {
      headers['x-username'] = user.username;
    }
    if (user.email) {
      headers['x-user-email'] = user.email;
    }
    headers['Authorization'] = `Bearer ${user.username || user.email}`;
  }

  const googleToken = getAccessToken();
  if (googleToken) {
    headers['x-google-access-token'] = googleToken;
  }

  return headers;
};

/**
 * Staff Credentials Sign-in (Username or Email + Password)
 */
export const staffCredentialsSignIn = async (
  identifier: string,
  plainPassword: string
): Promise<{ user: AppUser; mustChangePassword: boolean }> => {
  const res = await fetch('/api/auth/staff-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: identifier.trim(),
      password: plainPassword
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Invalid username or password. Please try again.');
  }

  setStoredUser(data.user);
  return {
    user: data.user,
    mustChangePassword: Boolean(data.mustChangePassword)
  };
};

/**
 * User Change Password (for first login or self-service)
 */
export const changePasswordApi = async (newPassword: string): Promise<AppUser> => {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newPassword })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to change password.');
  }

  const updatedUser = { ...data.user, mustChangePassword: false };
  setStoredUser(updatedUser);
  return updatedUser;
};

/**
 * Admin: Reset User Password to Default
 */
export const adminResetPasswordApi = async (
  userId: string
): Promise<{ user: AppUser; defaultPasswordNotice: string }> => {
  const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    headers: getAuthHeaders()
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to reset password.');
  }

  return data;
};

/**
 * Google Sign In with Firebase OAuth popup + Backend User Verification
 */
export const googleSignIn = async (): Promise<{ user: User; appUser: AppUser; accessToken?: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setAccessToken(credential.accessToken);
    }

    // Authenticate with server to fetch role & permissions
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.user.email}`,
        'x-user-email': result.user.email || ''
      },
      body: JSON.stringify({
        email: result.user.email,
        name: result.user.displayName || result.user.email?.split('@')[0] || 'Authorized User',
        picture: result.user.photoURL || undefined
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Access Denied: Your Google account is not authorized for this symposium portal.');
    }

    setStoredUser(data.user);
    return {
      user: result.user,
      appUser: data.user,
      accessToken: credential?.accessToken
    };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user') ||
      error?.message?.includes('cancelled-popup-request')
    ) {
      console.info('[Auth] Google Sign-In popup closed by user.');
      return null;
    }
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Dedicated helper to prompt or refresh Google Sheets OAuth authorization popup
 */
export const authorizeGoogleSheets = async (): Promise<string | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setAccessToken(credential.accessToken);
      return credential.accessToken;
    }
    return null;
  } catch (err: any) {
    console.error('Failed to authorize Google Sheets:', err);
    throw err;
  }
};

/**
 * Fetch current user profile from server
 */
export const checkCurrentSession = async (): Promise<AppUser | null> => {
  try {
    const user = getStoredUser();
    if (!user) return null;

    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      setStoredUser(null);
      return null;
    }

    const data = await res.json();
    if (data.success && data.user) {
      setStoredUser(data.user);
      return data.user;
    }
    return null;
  } catch {
    return getStoredUser();
  }
};

/**
 * Logout
 */
export const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    }).catch(() => {});
    await signOut(auth).catch(() => {});
  } catch (e) {
    console.warn('Sign out error:', e);
  } finally {
    setStoredUser(null);
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }
};

// ==========================================
// ROLE & PERMISSION HELPERS
// ==========================================

export function getUserRoles(user: AppUser | null): UserRole[] {
  if (!user) return [];
  return [user.role, ...(user.additionalRoles || [])];
}

export function canAccessEvent(user: AppUser | null, eventNameOrKey: string): boolean {
  if (!user || user.status !== 'ACTIVE') return false;

  const roles = getUserRoles(user);
  if (roles.includes('ADMIN') || roles.includes('DATABASE')) {
    return true;
  }

  if (roles.includes('EVENT_COORDINATOR')) {
    if (!user.assignedEvents || user.assignedEvents.length === 0) return false;
    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = normalize(eventNameOrKey);

    return user.assignedEvents.some(ev => {
      const evNorm = normalize(ev);
      return evNorm === target || target.includes(evNorm) || evNorm.includes(target);
    });
  }

  return false;
}

export function canExportEvent(user: AppUser | null, eventNameOrKey: string): boolean {
  if (!user || user.status !== 'ACTIVE') return false;

  const roles = getUserRoles(user);
  if (roles.includes('ADMIN') || roles.includes('DATABASE')) {
    return true;
  }

  if (roles.includes('EVENT_COORDINATOR')) {
    return canAccessEvent(user, eventNameOrKey);
  }

  return false;
}

export function canManageUsers(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && getUserRoles(user).includes('ADMIN'));
}

export function canCreateOffline(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('ON_SPOT');
}

export function canEditOffline(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('ON_SPOT');
}

export function canCancelOffline(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('ON_SPOT');
}

export function canViewAllParticipants(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('DATABASE');
}

export function canAccessParticipantsSection(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('DATABASE') || roles.includes('EVENT_COORDINATOR') || roles.includes('REGISTRATION');
}

export function canAccessEventsMatrix(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('DATABASE');
}

export function canAccessCertificateDesk(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('CERTIFICATE');
}

export function canModifyCertificateStatus(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('CERTIFICATE');
}

export function canSyncData(user: AppUser | null): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  const roles = getUserRoles(user);
  return roles.includes('ADMIN') || roles.includes('DATABASE') || roles.includes('ON_SPOT') || roles.includes('EVENT_COORDINATOR') || roles.includes('CERTIFICATE') || roles.includes('REGISTRATION');
}

// ==========================================
// CERTIFICATE DESK API CLIENT
// ==========================================

export async function fetchCertificateRecords(): Promise<any[]> {
  const res = await fetch('/api/certificates', { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch certificate records');
  }
  const data = await res.json();
  return data.records || [];
}

export async function updateCertificateStatusApi(
  registrationId: string,
  event: string,
  status: 'PENDING' | 'ISSUED',
  participantName?: string,
  college?: string
): Promise<any> {
  const res = await fetch('/api/certificates/update', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ registrationId, event, status, participantName, college })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update certificate status');
  }
  const data = await res.json();
  return data.record;
}

export async function bulkUpdateCertificateStatusApi(
  updates: Array<{
    registrationId: string;
    event: string;
    status: 'PENDING' | 'ISSUED';
    participantName?: string;
    college?: string;
  }>
): Promise<any[]> {
  const res = await fetch('/api/certificates/bulk-update', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ updates })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to bulk update certificates');
  }
  const data = await res.json();
  return data.records || [];
}

export async function syncCertificateRecordsApi(): Promise<any[]> {
  const res = await fetch('/api/certificates/sync', {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to sync certificate records');
  }
  const data = await res.json();
  return data.records || [];
}

// ==========================================
// USER MANAGEMENT & AUDIT API CLIENT
// ==========================================

export async function fetchUsersList(): Promise<AppUser[]> {
  const res = await fetch('/api/auth/users', { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch users list');
  }
  const data = await res.json();
  return data.users || [];
}

export async function createUser(userData: {
  name: string;
  username?: string;
  email?: string;
  role: UserRole;
  additionalRoles?: UserRole[];
  status?: UserStatus;
  assignedEvents?: string[];
  initialPassword?: string;
}): Promise<AppUser> {
  const res = await fetch('/api/auth/users', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create user');
  }
  const data = await res.json();
  return data.user;
}

export async function updateUser(
  id: string,
  updates: {
    name?: string;
    role?: UserRole;
    additionalRoles?: UserRole[];
    status?: UserStatus;
    assignedEvents?: string[];
  }
): Promise<AppUser> {
  const res = await fetch(`/api/auth/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update user');
  }
  const data = await res.json();
  return data.user;
}

export async function deleteUser(id: string): Promise<boolean> {
  const res = await fetch(`/api/auth/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete user');
  }
  return true;
}

export async function fetchAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  const res = await fetch(`/api/audit-logs?limit=${limit}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch audit logs');
  }
  const data = await res.json();
  return data.logs || [];
}

export async function logAuditAction(action: AuditActionType, details: string, targetId?: string): Promise<void> {
  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, details, targetId, status: 'SUCCESS' })
    });
  } catch (e) {
    // Non-blocking
  }
}

export async function verifyServerEventAccess(eventKey: string): Promise<{ allowed: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventKey)}/verify-access`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.allowed) {
      return { allowed: false, error: data.error || 'Access Denied' };
    }
    return { allowed: true };
  } catch (e: any) {
    return { allowed: false, error: e.message || 'Verification failed' };
  }
}
