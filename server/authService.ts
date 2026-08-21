import fs from 'fs';
import path from 'path';

export type UserRole = 'ADMIN' | 'EVENT_COORDINATOR' | 'ON_SPOT' | 'DATABASE' | 'CERTIFICATE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  assignedEvents: string[]; // List of canonical event display names e.g. ["The Final Hire"]
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  picture?: string;
}

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'OFFLINE_REGISTRATION_CREATED'
  | 'OFFLINE_REGISTRATION_UPDATED'
  | 'OFFLINE_REGISTRATION_CANCELLED'
  | 'OFFLINE_REGISTRATION_RESTORED'
  | 'DATA_SYNCED'
  | 'ROSTER_EXPORTED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_EVENT_ASSIGNED'
  | 'USER_STATUS_CHANGED'
  | 'USER_DELETED'
  | 'ACCESS_DENIED'
  | 'DIAGNOSTIC_RUN';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  role: UserRole | 'ANONYMOUS';
  action: AuditActionType;
  details: string;
  targetId?: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipAddress?: string;
}

class AuthService {
  private users: Map<string, AppUser> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private usersStorePath: string;
  private auditLogsStorePath: string;
  private adminEmail: string;

  constructor() {
    this.usersStorePath = path.join(process.cwd(), 'server', 'users_store.json');
    this.auditLogsStorePath = path.join(process.cwd(), 'server', 'audit_logs_store.json');
    this.adminEmail = (process.env.ADMIN_EMAIL || 'mohanavelandev@gmail.com').toLowerCase().trim();

    this.initializeStores();
  }

  private initializeStores() {
    // 1. Initialize Users Store
    try {
      if (fs.existsSync(this.usersStorePath)) {
        const data = fs.readFileSync(this.usersStorePath, 'utf8');
        const parsed: AppUser[] = JSON.parse(data);
        parsed.forEach(user => {
          this.users.set(user.email.toLowerCase(), user);
        });
        console.log(`[AuthService] Loaded ${this.users.size} users from storage.`);
      } else {
        this.seedDefaultUsers();
      }
    } catch (err) {
      console.warn('[AuthService] Failed reading users store, seeding defaults:', err);
      this.seedDefaultUsers();
    }

    // Ensure the primary admin email is always registered as ACTIVE ADMIN
    this.ensureAdminUser(this.adminEmail, 'Primary Admin');
    this.ensureAdminUser('admin@airox26.org', 'AIROX Admin Desk');

    // 2. Initialize Audit Logs Store
    try {
      if (fs.existsSync(this.auditLogsStorePath)) {
        const logData = fs.readFileSync(this.auditLogsStorePath, 'utf8');
        this.auditLogs = JSON.parse(logData);
      }
    } catch (err) {
      console.warn('[AuthService] Failed reading audit logs, initializing empty log list.');
      this.auditLogs = [];
    }
  }

  private seedDefaultUsers() {
    const defaultUsers: AppUser[] = [
      {
        id: 'usr_admin_01',
        name: 'Mohanavela (Primary Admin)',
        email: 'mohanavelandev@gmail.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        assignedEvents: [],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_admin_02',
        name: 'AIROX Admin Desk',
        email: 'admin@airox26.org',
        role: 'ADMIN',
        status: 'ACTIVE',
        assignedEvents: [],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_coord_01',
        name: 'Final Hire Coordinator',
        email: 'coordinator.finalhire@airox26.org',
        role: 'EVENT_COORDINATOR',
        status: 'ACTIVE',
        assignedEvents: ['The Final Hire'],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_coord_02',
        name: 'AD Shot Coordinator',
        email: 'coordinator.adshot@airox26.org',
        role: 'EVENT_COORDINATOR',
        status: 'ACTIVE',
        assignedEvents: ['AD SHOT'],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_onspot_01',
        name: 'On-Spot Desk Lead',
        email: 'onspot@airox26.org',
        role: 'ON_SPOT',
        status: 'ACTIVE',
        assignedEvents: [],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_db_01',
        name: 'Database Team Lead',
        email: 'database@airox26.org',
        role: 'DATABASE',
        status: 'ACTIVE',
        assignedEvents: [],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_cert_01',
        name: 'Certificate Coordinator',
        email: 'certificate@airox26.org',
        role: 'CERTIFICATE',
        status: 'ACTIVE',
        assignedEvents: [],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_disabled_01',
        name: 'Disabled Test Account',
        email: 'disabled.user@airox26.org',
        role: 'EVENT_COORDINATOR',
        status: 'INACTIVE',
        assignedEvents: ['The Final Hire'],
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      }
    ];

    defaultUsers.forEach(u => this.users.set(u.email.toLowerCase(), u));
    this.saveUsersToDisk();
  }

  private ensureAdminUser(email: string, name: string) {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return;

    const existing = this.users.get(normalized);
    if (!existing) {
      const newUser: AppUser = {
        id: `usr_adm_${Date.now()}`,
        name,
        email: normalized,
        role: 'ADMIN',
        status: 'ACTIVE',
        assignedEvents: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.users.set(normalized, newUser);
      this.saveUsersToDisk();
    } else if (existing.role !== 'ADMIN' || existing.status !== 'ACTIVE') {
      existing.role = 'ADMIN';
      existing.status = 'ACTIVE';
      existing.updatedAt = new Date().toISOString();
      this.saveUsersToDisk();
    }
  }

  private saveUsersToDisk() {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(this.usersStorePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[AuthService] Failed to save users store:', err);
    }
  }

  private saveAuditLogsToDisk() {
    try {
      fs.writeFileSync(this.auditLogsStorePath, JSON.stringify(this.auditLogs.slice(0, 500), null, 2), 'utf8');
    } catch (err) {
      console.error('[AuthService] Failed to save audit logs store:', err);
    }
  }

  // --- USER RESOLUTION ---

  /**
   * Identifies user from request headers:
   * 1. Header `x-user-email` (preferred direct authenticated identifier)
   * 2. Header `Authorization: Bearer <email_or_token>`
   */
  public resolveUserFromHeaders(headers: Record<string, string | string[] | undefined>): AppUser | null {
    let email: string | null = null;

    const xUserEmail = headers['x-user-email'];
    if (typeof xUserEmail === 'string' && xUserEmail.trim()) {
      email = xUserEmail.toLowerCase().trim();
    } else {
      const authHeader = headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token.includes('@')) {
          email = token.toLowerCase().trim();
        }
      }
    }

    if (!email) {
      return null;
    }

    // Lookup in users map
    const user = this.users.get(email);
    if (user) {
      return user;
    }

    // If matches configured primary admin email, register automatically
    if (email === this.adminEmail) {
      this.ensureAdminUser(email, 'Primary Administrator');
      return this.users.get(email) || null;
    }

    // Default Deny: unknown user
    return null;
  }

  public getUserByEmail(email: string): AppUser | null {
    return this.users.get(email.toLowerCase().trim()) || null;
  }

  public getAllUsers(): AppUser[] {
    return Array.from(this.users.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public createUser(data: {
    name: string;
    email: string;
    role: UserRole;
    status?: UserStatus;
    assignedEvents?: string[];
  }, actorUser: AppUser): AppUser {
    const normalizedEmail = data.email.toLowerCase().trim();
    if (this.users.has(normalizedEmail)) {
      throw new Error(`User with email "${normalizedEmail}" already exists.`);
    }

    const newUser: AppUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      email: normalizedEmail,
      role: data.role,
      status: data.status || 'ACTIVE',
      assignedEvents: Array.isArray(data.assignedEvents) ? data.assignedEvents : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.users.set(normalizedEmail, newUser);
    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'USER_CREATED',
      details: `Created user ${newUser.name} (${newUser.email}) with role ${newUser.role} and events [${newUser.assignedEvents.join(', ')}]`,
      targetId: newUser.id,
      status: 'SUCCESS'
    });

    return newUser;
  }

  public updateUser(
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      status?: UserStatus;
      assignedEvents?: string[];
    },
    actorUser: AppUser
  ): AppUser {
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) {
      throw new Error(`User with ID ${id} not found.`);
    }

    // Prevent disabling or demoting the root primary admin
    if (user.email === this.adminEmail && (updates.status === 'INACTIVE' || (updates.role && updates.role !== 'ADMIN'))) {
      throw new Error('Primary system administrator account cannot be disabled or demoted.');
    }

    const prevRole = user.role;
    const prevStatus = user.status;
    const prevEvents = [...user.assignedEvents];

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.assignedEvents !== undefined) user.assignedEvents = updates.assignedEvents;
    user.updatedAt = new Date().toISOString();

    this.saveUsersToDisk();

    // Audit logs for role/event/status changes
    const changeNotes: string[] = [];
    if (updates.role && updates.role !== prevRole) {
      changeNotes.push(`Role changed from ${prevRole} to ${updates.role}`);
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_ROLE_CHANGED',
        details: `Changed role of ${user.email} from ${prevRole} to ${updates.role}`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }
    if (updates.status && updates.status !== prevStatus) {
      changeNotes.push(`Status changed from ${prevStatus} to ${updates.status}`);
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_STATUS_CHANGED',
        details: `Changed status of ${user.email} from ${prevStatus} to ${updates.status}`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }
    if (updates.assignedEvents && JSON.stringify(updates.assignedEvents) !== JSON.stringify(prevEvents)) {
      changeNotes.push(`Events updated: [${updates.assignedEvents.join(', ')}]`);
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_EVENT_ASSIGNED',
        details: `Updated assigned events for ${user.email}: [${updates.assignedEvents.join(', ')}]`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }

    if (changeNotes.length === 0) {
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_UPDATED',
        details: `Updated user info for ${user.email}`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }

    return user;
  }

  public deleteUser(id: string, actorUser: AppUser): boolean {
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) {
      throw new Error(`User with ID ${id} not found.`);
    }

    if (user.email === this.adminEmail) {
      throw new Error('Primary system administrator account cannot be deleted.');
    }

    this.users.delete(user.email.toLowerCase());
    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'USER_DELETED',
      details: `Deleted user ${user.name} (${user.email})`,
      targetId: id,
      status: 'SUCCESS'
    });

    return true;
  }

  // --- PERMISSION CHECKS & EVENT SCOPING ---

  /**
   * Checks if user has permission to access a specific event in the general extractor/matrix.
   * - ADMIN, DATABASE: Allowed for ALL events.
   * - EVENT_COORDINATOR: Allowed ONLY if event is in user.assignedEvents.
   * - CERTIFICATE: False for general participants extractor (has dedicated Certificate Desk).
   * - ON_SPOT: False (they have offline registration desk scope).
   * - INACTIVE: False.
   */
  public canUserAccessEvent(user: AppUser | null, eventNameOrKey: string): boolean {
    if (!user || user.status !== 'ACTIVE') return false;

    if (user.role === 'ADMIN' || user.role === 'DATABASE') {
      return true;
    }

    if (user.role === 'EVENT_COORDINATOR') {
      if (!user.assignedEvents || user.assignedEvents.length === 0) return false;

      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetNormalized = normalize(eventNameOrKey);

      return user.assignedEvents.some(ev => {
        const evNorm = normalize(ev);
        return evNorm === targetNormalized || targetNormalized.includes(evNorm) || evNorm.includes(targetNormalized);
      });
    }

    return false;
  }

  public canAccessCertificateDesk(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || user.role === 'CERTIFICATE';
  }

  public canModifyCertificates(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || user.role === 'CERTIFICATE';
  }

  public canCreateOrModifyOffline(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || user.role === 'ON_SPOT';
  }

  public canManageUsers(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN';
  }

  // --- AUDIT LOGS ---

  public logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };

    this.auditLogs.unshift(fullEntry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveAuditLogsToDisk();
    return fullEntry;
  }

  public getAuditLogs(limit: number = 100): AuditLogEntry[] {
    return this.auditLogs.slice(0, limit);
  }
}

export const serverAuthService = new AuthService();
