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

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));

const TOKEN_STORAGE_KEY = 'airox_google_sheets_token';
const USER_STORAGE_KEY = 'airox_auth_user';
const SESSION_STORAGE_KEY = 'airox_session_token';

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
let currentAppUser: AppUser | null = null;

try {
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem(USER_STORAGE_KEY) : null;
  if (storedUser) {
    currentAppUser = JSON.parse(storedUser);
  }
} catch {
  currentAppUser = null;
}

export const getStoredUser = (): AppUser | null => currentAppUser;

/**
 * Initialize auth listener
 */
export const initAuth = (
  callback: (user: User | null, token?: string | null) => void,
  onSignOut?: () => void
): (() => void) => {
  return onAuthStateChanged(auth, async user => {
    if (user) {
      const token = await getAccessToken();
      callback(user, token);
    } else {
      callback(null, null);
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
 * Standard Auth Request Headers with Bearer session token
 */
export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (typeof window !== 'undefined') {
    const sessionToken = localStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
  }

  return headers;
};

/**
 * Username + Password Authentication
 */
export const loginWithCredentials = async (
  usernameOrEmail: string,
  passwordAttempt: string
): Promise<{ user: AppUser; mustChangePassword: boolean }> => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: usernameOrEmail.trim(),
      password: passwordAttempt
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Invalid username or password.');
  }

  if (data.token && typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, data.token);
  }

  setStoredUser(data.user);
  return {
    user: data.user,
    mustChangePassword: Boolean(data.mustChangePassword)
  };
};

/**
 * Change Password (first login or self-service)
 */
export const changePasswordApi = async (
  newPassword: string,
  currentPassword?: string,
  userId?: string
): Promise<AppUser> => {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      newPassword,
      currentPassword,
      userId
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update password.');
  }

  setStoredUser(data.user);
  return data.user;
};

/**
 * Admin Reset User Password
 */
export const resetUserPasswordApi = async (
  userId: string,
  newPassword?: string
): Promise<{ user: AppUser; temporaryPassword?: string; message: string }> => {
  const res = await fetch(`/api/auth/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ newPassword })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to reset password.');
  }

  return {
    user: data.user,
    temporaryPassword: data.temporaryPassword,
    message: data.message || 'Password reset successfully'
  };
};

/**
 * Google Sign In with Firebase OAuth popup + Backend User Verification
 */
export const googleSignIn = async (): Promise<{ user: User; appUser: AppUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';

    if (accessToken) {
      cachedAccessToken = accessToken;
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      }
    }

    // Authenticate with server to fetch role & permissions
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: result.user.email,
        name: result.user.displayName || result.user.email?.split('@')[0] || 'Authorized User',
        picture: result.user.photoURL || undefined
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Access Denied: Your Google account is not authorized for this symposium portal.');
    }

    if (data.token && typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, data.token);
    }

    setStoredUser(data.user);
    return {
      user: result.user,
      appUser: data.user,
      accessToken
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
 * Fetch current user profile from server
 */
export const checkCurrentSession = async (): Promise<AppUser | null> => {
  try {
    const sessionToken = typeof window !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
    if (!sessionToken) {
      setStoredUser(null);
      return null;
    }

    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      setStoredUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
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
    cachedAccessToken = null;
    setStoredUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
};

// ==========================================
// ROLE & PERMISSION HELPERS
// ==========================================

export function userHasRole(user: AppUser | null, role: UserRole): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  if (user.role === role) return true;
  if (user.secondaryRoles && user.secondaryRoles.includes(role)) return true;
  return false;
}

export function canAccessEvent(user: AppUser | null, eventNameOrKey: string): boolean {
  if (!user || user.status !== 'ACTIVE') return false;

  // ADMIN, DATABASE, REGISTRATION have global access for all events
  if (user.role === 'ADMIN' || userHasRole(user, 'DATABASE') || userHasRole(user, 'REGISTRATION')) {
    return true;
  }

  // EVENT_COORDINATOR scoped strictly to assigned events
  if (userHasRole(user, 'EVENT_COORDINATOR')) {
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

  if (user.role === 'ADMIN' || userHasRole(user, 'DATABASE')) {
    return true;
  }

  if (userHasRole(user, 'EVENT_COORDINATOR')) {
    return canAccessEvent(user, eventNameOrKey);
  }

  return false;
}

export function canManageUsers(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && user.role === 'ADMIN');
}

export function canCreateOffline(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || userHasRole(user, 'ON_SPOT')));
}

export function canEditOffline(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || userHasRole(user, 'ON_SPOT')));
}

export function canCancelOffline(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || userHasRole(user, 'ON_SPOT')));
}

export function canViewAllParticipants(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || userHasRole(user, 'DATABASE') || userHasRole(user, 'REGISTRATION')));
}

export function canAccessParticipantsSection(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (
    user.role === 'ADMIN' ||
    userHasRole(user, 'DATABASE') ||
    userHasRole(user, 'REGISTRATION') ||
    userHasRole(user, 'EVENT_COORDINATOR')
  ));
}

export function canAccessEventsMatrix(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || userHasRole(user, 'DATABASE')));
}

export function canAccessCertificateDesk(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || userHasRole(user, 'CERTIFICATE')));
}

export function canModifyCertificateStatus(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (user.role === 'ADMIN' || userHasRole(user, 'CERTIFICATE')));
}

export function canSyncData(user: AppUser | null): boolean {
  return Boolean(user && user.status === 'ACTIVE' && (
    user.role === 'ADMIN' ||
    userHasRole(user, 'DATABASE') ||
    userHasRole(user, 'ON_SPOT') ||
    userHasRole(user, 'EVENT_COORDINATOR')
  ));
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
  secondaryRoles?: UserRole[];
  status?: UserStatus;
  assignedEvents?: string[];
  teamName?: string;
  yearSection?: string;
  password?: string;
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
    username?: string;
    email?: string;
    role?: UserRole;
    secondaryRoles?: UserRole[];
    status?: UserStatus;
    assignedEvents?: string[];
    teamName?: string;
    yearSection?: string;
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
