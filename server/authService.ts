import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type UserRole = 'ADMIN' | 'EVENT_COORDINATOR' | 'ON_SPOT' | 'REGISTRATION' | 'DATABASE' | 'CERTIFICATE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  additionalRoles?: UserRole[];
  status: UserStatus;
  assignedEvents: string[]; // e.g. ["The Final Hire", "Paper Presentation"]
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  picture?: string;
}

export interface StoredUser extends AppUser {
  passwordHash: string; // "salt:hash"
}

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
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
  | 'EVENT_REGISTRY_UPDATED'
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

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + plainPassword).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plainPassword: string, storedHashString: string): boolean {
  if (!storedHashString || !storedHashString.includes(':')) {
    return false;
  }
  const [salt, storedHash] = storedHashString.split(':');
  const calculatedHash = crypto.createHash('sha256').update(salt + plainPassword).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(storedHash));
}

export function normalizeUsername(fullName: string): string {
  return fullName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

class AuthService {
  private users: Map<string, StoredUser> = new Map(); // Key: username (lowercase) or email (lowercase)
  private userList: StoredUser[] = [];
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
    try {
      if (fs.existsSync(this.usersStorePath)) {
        const data = fs.readFileSync(this.usersStorePath, 'utf8');
        const parsed: StoredUser[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.userList = parsed;
          this.rebuildUserIndex();
          console.log(`[AuthService] Loaded ${this.userList.length} users from storage.`);
        } else {
          this.seedDefaultUsers();
        }
      } else {
        this.seedDefaultUsers();
      }
    } catch (err) {
      console.warn('[AuthService] Failed reading users store, seeding defaults:', err);
      this.seedDefaultUsers();
    }

    // Ensure Primary Admin always exists with correct credentials
    this.ensureAdminUser();

    // 2. Initialize Audit Logs Store
    try {
      if (fs.existsSync(this.auditLogsStorePath)) {
        const logData = fs.readFileSync(this.auditLogsStorePath, 'utf8');
        this.auditLogs = JSON.parse(logData);
      }
    } catch (err) {
      this.auditLogs = [];
    }
  }

  private rebuildUserIndex() {
    this.users.clear();
    for (const u of this.userList) {
      if (u.username) {
        this.users.set(u.username.toLowerCase().trim(), u);
      }
      if (u.email) {
        this.users.set(u.email.toLowerCase().trim(), u);
      }
      if (u.id) {
        this.users.set(u.id.toLowerCase().trim(), u);
      }
    }
  }

  private seedDefaultUsers() {
    console.log('[AuthService] Seeding full AIROX 26 Organizing Team users...');

    interface RawUserData {
      name: string;
      role: UserRole;
      additionalRoles?: UserRole[];
      assignedEvents: string[];
      email?: string;
    }

    const teamMembers: RawUserData[] = [
      // Primary Administrator
      {
        name: 'Mohanavelan S',
        role: 'ADMIN',
        assignedEvents: [],
        email: 'mohanavelandev@gmail.com'
      },
      {
        name: 'AIROX Admin Desk',
        role: 'ADMIN',
        assignedEvents: [],
        email: 'admin@airox26.org'
      },

      // Teams 1–9: Event Coordinators
      {
        name: 'Paper Presentation Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['Paper Presentation'],
        email: 'coordinator.paper@airox26.org'
      },
      {
        name: 'The Final Hire Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['The Final Hire'],
        email: 'coordinator.finalhire@airox26.org'
      },
      {
        name: 'Zero Hour Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['Zero Hour'],
        email: 'coordinator.zerohour@airox26.org'
      },
      {
        name: 'The Prompt League Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['The Prompt League'],
        email: 'coordinator.promptleague@airox26.org'
      },
      {
        name: 'ADS SHOT Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['ADS SHOT'],
        email: 'coordinator.adsshot@airox26.org'
      },
      {
        name: 'Goated or Ghosted Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['GOATED OR GHOSTED'],
        email: 'coordinator.goated@airox26.org'
      },
      {
        name: 'Clash and Conquer Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['CLASH AND CONQUER'],
        email: 'coordinator.clash@airox26.org'
      },
      {
        name: 'Box Cricket Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['BOX CRICKET'],
        email: 'coordinator.cricket@airox26.org'
      },
      {
        name: 'E-Sports Coordinator',
        role: 'EVENT_COORDINATOR',
        assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)'],
        email: 'coordinator.esports@airox26.org'
      },

      // Team 10: ON Spot Registration (ON_SPOT)
      { name: 'Abirami M', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Archana M', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Gopika S', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Jeevitha', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Jeyavarshini M', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Kiruthika M', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Megavarshiini M', role: 'ON_SPOT', assignedEvents: [] },

      // Team 11: Online Registration & Welcome (REGISTRATION)
      // Note: Abirami S, Kishore Kumar, Praveena K also belong to Team 20 (CERTIFICATE)
      { name: 'Abirami S', role: 'REGISTRATION', additionalRoles: ['CERTIFICATE'], assignedEvents: [] },
      { name: 'Blessy', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Deepa U', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Kamalesh harish', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Kishore Kumar', role: 'REGISTRATION', additionalRoles: ['CERTIFICATE'], assignedEvents: [] },
      { name: 'Mohana Prasanth', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Praveena K', role: 'REGISTRATION', additionalRoles: ['CERTIFICATE'], assignedEvents: [] },
      { name: 'Praveena N', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Vaishnavi B R', role: 'REGISTRATION', assignedEvents: [] },

      // Team 13: Database (DATABASE)
      { name: 'Anto Sebastian S', role: 'DATABASE', assignedEvents: [] },
      { name: 'Buvana B', role: 'DATABASE', assignedEvents: [] },
      { name: 'Divya Dharshini', role: 'DATABASE', assignedEvents: [] },
      { name: 'Janani G', role: 'DATABASE', assignedEvents: [] },
      { name: 'Jeevitha M', role: 'DATABASE', assignedEvents: [] },
      { name: 'MahaLakshmi', role: 'DATABASE', assignedEvents: [] },
      { name: 'MahaSri R L', role: 'DATABASE', assignedEvents: [] },
      { name: 'Mubarak', role: 'DATABASE', assignedEvents: [] },
      { name: 'Navina S', role: 'DATABASE', assignedEvents: [] },
      { name: 'Nobil S', role: 'DATABASE', assignedEvents: [] },
      { name: 'Siddharth T', role: 'DATABASE', assignedEvents: [] },

      // Team 20: Certificate Writing (CERTIFICATE)
      { name: 'Aaisha Banu', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Dharani', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Oviya', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Vishalini', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Yogeshwari', role: 'CERTIFICATE', assignedEvents: [] }
    ];

    this.userList = [];

    teamMembers.forEach(tm => {
      const username = normalizeUsername(tm.name);
      const email = tm.email || `${username.replace(/_/g, '.')}@airox26.org`;
      const initialPlainPassword = tm.name.toLowerCase(); // Full name converted to lowercase with spaces
      const passwordHash = hashPassword(initialPlainPassword);

      const user: StoredUser = {
        id: `usr_${username}`,
        name: tm.name,
        username,
        email: email.toLowerCase().trim(),
        role: tm.role,
        additionalRoles: tm.additionalRoles,
        status: 'ACTIVE',
        assignedEvents: tm.assignedEvents,
        mustChangePassword: tm.role !== 'ADMIN', // Require password change on first login
        passwordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.userList.push(user);
    });

    this.rebuildUserIndex();
    this.saveUsersToDisk();
    console.log(`[AuthService] Seeded ${this.userList.length} users successfully.`);
  }

  private ensureAdminUser() {
    const adminUsername = 'mohanavelan_s';
    const adminEmail = this.adminEmail;

    let admin = this.userList.find(
      u => u.username === adminUsername || u.email === adminEmail || u.email === 'mohanavelandev@gmail.com'
    );

    if (!admin) {
      admin = {
        id: 'usr_admin_01',
        name: 'Mohanavelan S',
        username: adminUsername,
        email: adminEmail,
        role: 'ADMIN',
        status: 'ACTIVE',
        assignedEvents: [],
        mustChangePassword: false,
        passwordHash: hashPassword('mohanavelan s'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.userList.unshift(admin);
    } else {
      admin.role = 'ADMIN';
      admin.status = 'ACTIVE';
      admin.email = adminEmail;
      if (!admin.username) admin.username = adminUsername;
      if (!admin.passwordHash) admin.passwordHash = hashPassword('mohanavelan s');
    }

    this.rebuildUserIndex();
    this.saveUsersToDisk();
  }

  private saveUsersToDisk() {
    try {
      fs.writeFileSync(this.usersStorePath, JSON.stringify(this.userList, null, 2), 'utf8');
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

  public sanitizeUser(user: StoredUser): AppUser {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  // --- USER AUTHENTICATION & LOGIN ---

  /**
   * Authenticates user via Username/Email + Password
   */
  public authenticateWithCredentials(identifier: string, plainPassword: string): { user: AppUser; mustChangePassword: boolean } {
    if (!identifier || !plainPassword) {
      throw new Error('Username/Email and Password are required.');
    }

    const key = identifier.toLowerCase().trim();
    // Also try normalized username if user entered name or email
    const normKey = normalizeUsername(identifier);
    const user = this.users.get(key) || this.users.get(normKey);

    if (!user) {
      this.logAudit({
        userEmail: identifier,
        userName: identifier,
        role: 'ANONYMOUS',
        action: 'ACCESS_DENIED',
        details: `Failed login attempt for unknown user: "${identifier}"`,
        status: 'DENIED'
      });
      throw new Error('Invalid username or password.');
    }

    if (user.status !== 'ACTIVE') {
      this.logAudit({
        userEmail: user.email,
        userName: user.name,
        role: user.role,
        action: 'ACCESS_DENIED',
        details: `Login attempt for disabled account: ${user.username}`,
        status: 'DENIED'
      });
      throw new Error('Your account has been deactivated. Please contact the symposium administrator.');
    }

    const isValid = verifyPassword(plainPassword, user.passwordHash);
    if (!isValid) {
      this.logAudit({
        userEmail: user.email,
        userName: user.name,
        role: user.role,
        action: 'ACCESS_DENIED',
        details: `Invalid password attempt for user: ${user.username}`,
        status: 'DENIED'
      });
      throw new Error('Invalid username or password.');
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    this.saveUsersToDisk();

    this.logAudit({
      userEmail: user.email,
      userName: user.name,
      role: user.role,
      action: 'LOGIN',
      details: `Successful staff login for ${user.name} (${user.username}) as ${user.role}`,
      status: 'SUCCESS'
    });

    return {
      user: this.sanitizeUser(user),
      mustChangePassword: Boolean(user.mustChangePassword)
    };
  }

  /**
   * Changes user password
   */
  public changePassword(userIdOrUsername: string, newPassword: string): AppUser {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Password must be at least 4 characters in length.');
    }

    const user = this.getUserByIdOrUsername(userIdOrUsername);
    if (!user) {
      throw new Error('User account not found.');
    }

    user.passwordHash = hashPassword(newPassword);
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();

    this.saveUsersToDisk();

    this.logAudit({
      userEmail: user.email,
      userName: user.name,
      role: user.role,
      action: 'PASSWORD_CHANGED',
      details: `Password changed successfully for user: ${user.username}`,
      targetId: user.id,
      status: 'SUCCESS'
    });

    return this.sanitizeUser(user);
  }

  /**
   * Admin Resets a user's password to their default lowercase full name
   */
  public resetPasswordToDefault(userId: string, actorUser: AppUser): { user: AppUser; defaultPasswordNotice: string } {
    const user = this.userList.find(u => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    const defaultPlainPassword = user.name.toLowerCase();
    user.passwordHash = hashPassword(defaultPlainPassword);
    user.mustChangePassword = true;
    user.updatedAt = new Date().toISOString();

    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'PASSWORD_RESET',
      details: `Admin ${actorUser.name} reset password for ${user.name} (${user.username})`,
      targetId: user.id,
      status: 'SUCCESS'
    });

    return {
      user: this.sanitizeUser(user),
      defaultPasswordNotice: `Password has been reset to the user's lowercase name with spaces. User will be required to change password upon their next login.`
    };
  }

  /**
   * Resolves user from request headers
   */
  public resolveUserFromHeaders(headers: Record<string, string | string[] | undefined>): AppUser | null {
    let identifier: string | null = null;

    const xUserEmail = headers['x-user-email'];
    const xUsername = headers['x-username'];

    if (typeof xUsername === 'string' && xUsername.trim()) {
      identifier = xUsername.toLowerCase().trim();
    } else if (typeof xUserEmail === 'string' && xUserEmail.trim()) {
      identifier = xUserEmail.toLowerCase().trim();
    } else {
      const authHeader = headers['authorization'];
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) {
          identifier = token.toLowerCase().trim();
        }
      }
    }

    if (!identifier) {
      return null;
    }

    const user = this.getUserByIdOrUsername(identifier);
    if (user && user.status === 'ACTIVE') {
      return this.sanitizeUser(user);
    }

    return null;
  }

  public getUserByIdOrUsername(identifier: string): StoredUser | null {
    const key = identifier.toLowerCase().trim();
    const normKey = normalizeUsername(identifier);
    return this.users.get(key) || this.users.get(normKey) || this.userList.find(u => u.id === identifier) || null;
  }

  public getUserByEmail(email: string): AppUser | null {
    const user = this.users.get(email.toLowerCase().trim());
    return user ? this.sanitizeUser(user) : null;
  }

  public getAllUsers(): AppUser[] {
    return this.userList.map(u => this.sanitizeUser(u)).sort((a, b) => a.name.localeCompare(b.name));
  }

  public createUser(
    data: {
      name: string;
      username?: string;
      email?: string;
      role: UserRole;
      additionalRoles?: UserRole[];
      status?: UserStatus;
      assignedEvents?: string[];
      initialPassword?: string;
    },
    actorUser: AppUser
  ): AppUser {
    const username = data.username ? normalizeUsername(data.username) : normalizeUsername(data.name);
    if (this.users.has(username)) {
      throw new Error(`User with username "${username}" already exists.`);
    }

    const email = (data.email || `${username.replace(/_/g, '.')}@airox26.org`).toLowerCase().trim();
    const initialPlain = data.initialPassword || data.name.toLowerCase();
    const passwordHash = hashPassword(initialPlain);

    const newUser: StoredUser = {
      id: `usr_${username}_${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      username,
      email,
      role: data.role,
      additionalRoles: data.additionalRoles || [],
      status: data.status || 'ACTIVE',
      assignedEvents: Array.isArray(data.assignedEvents) ? data.assignedEvents : [],
      mustChangePassword: true,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.userList.push(newUser);
    this.rebuildUserIndex();
    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'USER_CREATED',
      details: `Created user ${newUser.name} (${newUser.username}) with role ${newUser.role} and events [${newUser.assignedEvents.join(', ')}]`,
      targetId: newUser.id,
      status: 'SUCCESS'
    });

    return this.sanitizeUser(newUser);
  }

  public updateUser(
    id: string,
    updates: {
      name?: string;
      role?: UserRole;
      additionalRoles?: UserRole[];
      status?: UserStatus;
      assignedEvents?: string[];
    },
    actorUser: AppUser
  ): AppUser {
    const user = this.userList.find(u => u.id === id);
    if (!user) {
      throw new Error(`User with ID ${id} not found.`);
    }

    if (user.email === this.adminEmail && (updates.status === 'INACTIVE' || (updates.role && updates.role !== 'ADMIN'))) {
      throw new Error('Primary system administrator account cannot be disabled or demoted.');
    }

    const prevRole = user.role;
    const prevStatus = user.status;
    const prevEvents = [...user.assignedEvents];

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.additionalRoles !== undefined) user.additionalRoles = updates.additionalRoles;
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.assignedEvents !== undefined) user.assignedEvents = updates.assignedEvents;
    user.updatedAt = new Date().toISOString();

    this.rebuildUserIndex();
    this.saveUsersToDisk();

    if (updates.role && updates.role !== prevRole) {
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_ROLE_CHANGED',
        details: `Changed role of ${user.username} from ${prevRole} to ${updates.role}`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }

    if (updates.status && updates.status !== prevStatus) {
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_STATUS_CHANGED',
        details: `Changed status of ${user.username} from ${prevStatus} to ${updates.status}`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }

    if (updates.assignedEvents && JSON.stringify(updates.assignedEvents) !== JSON.stringify(prevEvents)) {
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_EVENT_ASSIGNED',
        details: `Updated assigned events for ${user.username}: [${updates.assignedEvents.join(', ')}]`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }

    return this.sanitizeUser(user);
  }

  public deleteUser(id: string, actorUser: AppUser): boolean {
    const index = this.userList.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found.`);
    }

    const user = this.userList[index];
    if (user.email === this.adminEmail || user.username === 'mohanavelan_s') {
      throw new Error('Primary system administrator account cannot be deleted.');
    }

    this.userList.splice(index, 1);
    this.rebuildUserIndex();
    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'USER_DELETED',
      details: `Deleted user ${user.name} (${user.username})`,
      targetId: id,
      status: 'SUCCESS'
    });

    return true;
  }

  // --- PERMISSION CHECKS & EVENT SCOPING ---

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
    return (
      user.role === 'ADMIN' ||
      user.role === 'CERTIFICATE' ||
      (Array.isArray(user.additionalRoles) && user.additionalRoles.includes('CERTIFICATE'))
    );
  }

  public canModifyCertificates(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return (
      user.role === 'ADMIN' ||
      user.role === 'CERTIFICATE' ||
      (Array.isArray(user.additionalRoles) && user.additionalRoles.includes('CERTIFICATE'))
    );
  }

  public canCreateOrModifyOffline(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || user.role === 'ON_SPOT';
  }

  public canAccessRegistrationWorkflow(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return (
      user.role === 'ADMIN' ||
      user.role === 'REGISTRATION' ||
      (Array.isArray(user.additionalRoles) && user.additionalRoles.includes('REGISTRATION'))
    );
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
