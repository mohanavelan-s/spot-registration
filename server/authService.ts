import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type UserRole = 'ADMIN' | 'EVENT_COORDINATOR' | 'ON_SPOT' | 'REGISTRATION' | 'DATABASE' | 'CERTIFICATE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  id: string;
  name: string;
  username: string; // e.g. "mohanavelan_s"
  email: string;
  role: UserRole;
  secondaryRoles?: UserRole[]; // for users in multiple teams
  status: UserStatus;
  assignedEvents: string[]; // List of canonical event display names e.g. ["The Final Hire"]
  teamName?: string;
  yearSection?: string;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  picture?: string;
}

export interface StoredUserRecord extends AppUser {
  passwordHash?: string;
  passwordSalt?: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  expiresAt: string;
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

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return computed === hash;
}

export function normalizeUsername(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '_');
}

export function getInitialPassword(name: string): string {
  return name.toLowerCase().trim();
}

class AuthService {
  private users: Map<string, StoredUserRecord> = new Map(); // Indexed by lowercase username, lowercase email & ID
  private sessions: Map<string, SessionRecord> = new Map(); // Indexed by session token
  private auditLogs: AuditLogEntry[] = [];
  private usersStorePath: string;
  private sessionsStorePath: string;
  private auditLogsStorePath: string;
  private adminEmail: string;

  constructor() {
    this.usersStorePath = path.join(process.cwd(), 'server', 'users_store.json');
    this.sessionsStorePath = path.join(process.cwd(), 'server', 'sessions_store.json');
    this.auditLogsStorePath = path.join(process.cwd(), 'server', 'audit_logs_store.json');
    this.adminEmail = (process.env.ADMIN_EMAIL || 'mohanavelandev@gmail.com').toLowerCase().trim();

    this.initializeStores();
  }

  private initializeStores() {
    // 1. Initialize Users Store
    try {
      if (fs.existsSync(this.usersStorePath)) {
        const data = fs.readFileSync(this.usersStorePath, 'utf8');
        const parsed: StoredUserRecord[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasTeams = parsed.some(u => u.username === 'aadhil_banu' || u.username === 'anto_sebastian_s');
          if (hasTeams) {
            parsed.forEach(user => {
              this.indexUser(user);
            });
            console.log(`[AuthService] Loaded ${this.getDistinctUsers().length} distinct users from storage.`);
          } else {
            console.log('[AuthService] Existing users store requires team roster seeding.');
            this.seedAllTeamUsers(parsed);
          }
        } else {
          this.seedAllTeamUsers();
        }
      } else {
        this.seedAllTeamUsers();
      }
    } catch (err) {
      console.warn('[AuthService] Failed reading users store, seeding defaults:', err);
      this.seedAllTeamUsers();
    }

    // Ensure the primary admin accounts
    this.ensureAdminUser(this.adminEmail, 'Primary Admin');
    this.ensureAdminUser('admin@airox26.org', 'AIROX Admin Desk');

    // 2. Initialize Sessions Store
    try {
      if (fs.existsSync(this.sessionsStorePath)) {
        const sessionData = fs.readFileSync(this.sessionsStorePath, 'utf8');
        const parsedSessions: SessionRecord[] = JSON.parse(sessionData);
        if (Array.isArray(parsedSessions)) {
          const now = Date.now();
          parsedSessions.forEach(s => {
            if (new Date(s.expiresAt).getTime() > now) {
              this.sessions.set(s.token, s);
            }
          });
        }
      }
    } catch (err) {
      this.sessions = new Map();
    }

    // 3. Initialize Audit Logs Store
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

  private indexUser(user: StoredUserRecord) {
    if (user.email) {
      this.users.set(user.email.toLowerCase().trim(), user);
    }
    if (user.username) {
      this.users.set(user.username.toLowerCase().trim(), user);
    }
    if (user.id) {
      this.users.set(user.id, user);
    }
  }

  private getDistinctUsers(): StoredUserRecord[] {
    const seen = new Set<string>();
    const list: StoredUserRecord[] = [];
    for (const user of this.users.values()) {
      if (!seen.has(user.id)) {
        seen.add(user.id);
        list.push(user);
      }
    }
    return list;
  }

  public sanitizeUser(user: StoredUserRecord | null): AppUser | null {
    if (!user) return null;
    const { passwordHash, passwordSalt, ...safeUser } = user;
    return safeUser;
  }

  private seedAllTeamUsers(existingUsers: StoredUserRecord[] = []) {
    const existingById = new Map<string, StoredUserRecord>();
    const existingByUsername = new Map<string, StoredUserRecord>();
    const existingByEmail = new Map<string, StoredUserRecord>();

    existingUsers.forEach(u => {
      if (u.id) existingById.set(u.id, u);
      if (u.username) existingByUsername.set(u.username.toLowerCase(), u);
      if (u.email) existingByEmail.set(u.email.toLowerCase(), u);
    });

    // Helper to create or merge a team user record
    const userDefinitions: Array<{
      name: string;
      yearSection: string;
      teamName: string;
      role: UserRole;
      assignedEvents: string[];
    }> = [
      // 1. Paper Presentation (Team 1) -> EVENT_COORDINATOR
      { name: 'Aadhil Banu', yearSection: 'Third Year-A', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },
      { name: 'Anusha', yearSection: 'Third Year-A', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },
      { name: 'Elango Y', yearSection: 'Final Year', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },
      { name: 'Gayathri K', yearSection: 'Final Year', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },
      { name: 'Gurudev', yearSection: 'Third Year-A', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },
      { name: 'Mohamed Farhan M', yearSection: 'Third Year-B', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },
      { name: 'Niveditha M', yearSection: 'Third Year-B', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },
      { name: 'Nivetha S', yearSection: 'Third Year-B', teamName: 'Paper Presentation', role: 'EVENT_COORDINATOR', assignedEvents: ['Paper Presentation'] },

      // 2. The Final Hire (Team 2) -> EVENT_COORDINATOR
      { name: 'Abarna', yearSection: 'Third Year-A', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Abdul Basith A', yearSection: 'Final Year', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Abishek', yearSection: 'Third Year-A', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Harrish N', yearSection: 'Final Year', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Iyyapan A', yearSection: 'Final Year', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Kamalesh M', yearSection: 'Third Year-B', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Kaviya S', yearSection: 'Third Year-B', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Mohamed Irban S', yearSection: 'Third Year-B', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },
      { name: 'Sandhiya S', yearSection: 'Final Year', teamName: 'The Final Hire', role: 'EVENT_COORDINATOR', assignedEvents: ['The Final Hire'] },

      // 3. Zero Hour (Team 3) -> EVENT_COORDINATOR
      { name: 'Akashaya', yearSection: 'Third Year-A', teamName: 'Zero Hour', role: 'EVENT_COORDINATOR', assignedEvents: ['Zero Hour'] },
      { name: 'Archana', yearSection: 'Third Year-A', teamName: 'Zero Hour', role: 'EVENT_COORDINATOR', assignedEvents: ['Zero Hour'] },
      { name: 'Deepa U', yearSection: 'Final Year', teamName: 'Zero Hour', role: 'EVENT_COORDINATOR', assignedEvents: ['Zero Hour'] }, // also Team 11 Registration
      { name: 'Kiruthika S-', yearSection: 'Third Year-B', teamName: 'Zero Hour', role: 'EVENT_COORDINATOR', assignedEvents: ['Zero Hour'] },
      { name: 'Mohanavelan S', yearSection: 'Final Year', teamName: 'Zero Hour', role: 'ADMIN', assignedEvents: ['Zero Hour'] }, // Admin
      { name: 'Preethi P', yearSection: 'Third Year-B', teamName: 'Zero Hour', role: 'EVENT_COORDINATOR', assignedEvents: ['Zero Hour'] },
      { name: 'Rathi Sankari', yearSection: 'Third Year-C', teamName: 'Zero Hour', role: 'EVENT_COORDINATOR', assignedEvents: ['Zero Hour'] },
      { name: 'Ruba Soundharya', yearSection: 'Third Year-C', teamName: 'Zero Hour', role: 'EVENT_COORDINATOR', assignedEvents: ['Zero Hour'] },

      // 4. The Prompt League (Team 4) -> EVENT_COORDINATOR
      { name: 'Boobesh', yearSection: 'Third Year-A', teamName: 'The Prompt League', role: 'EVENT_COORDINATOR', assignedEvents: ['The Prompt League'] },
      { name: 'Deekshitha', yearSection: 'Third Year-A', teamName: 'The Prompt League', role: 'EVENT_COORDINATOR', assignedEvents: ['The Prompt League'] },
      { name: 'Dhuvarakesh', yearSection: 'Third Year-A', teamName: 'The Prompt League', role: 'EVENT_COORDINATOR', assignedEvents: ['The Prompt League'] },
      { name: 'Jitendra V K', yearSection: 'Third Year-B', teamName: 'The Prompt League', role: 'EVENT_COORDINATOR', assignedEvents: ['The Prompt League'] },
      { name: 'Princy G', yearSection: 'Final Year', teamName: 'The Prompt League', role: 'EVENT_COORDINATOR', assignedEvents: ['The Prompt League'] },
      { name: 'Sherin S', yearSection: 'Third Year-C', teamName: 'The Prompt League', role: 'EVENT_COORDINATOR', assignedEvents: ['The Prompt League'] },
      { name: 'Vishalini V', yearSection: 'Final Year', teamName: 'The Prompt League', role: 'EVENT_COORDINATOR', assignedEvents: ['The Prompt League'] },

      // 5. AD Battle (Team 5) -> EVENT_COORDINATOR
      { name: 'Bala', yearSection: 'Third Year-A', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'Kumaran S', yearSection: 'Third Year-B', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'Madhan Kumar S', yearSection: 'Final Year', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'MadhuShree B', yearSection: 'Final Year', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'Mahadevika D L', yearSection: 'Third Year-B', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'Rithvika R', yearSection: 'Final Year', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'Sandhya', yearSection: 'Third Year-C', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'Suji', yearSection: 'Third Year-C', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },
      { name: 'Sunpoornarajan M', yearSection: 'Final Year', teamName: 'AD Battle', role: 'EVENT_COORDINATOR', assignedEvents: ['AD Battle', 'ADS SHOT'] },

      // 6. Goated or Ghosted (Team 6) -> EVENT_COORDINATOR
      { name: 'Amirtha A P', yearSection: 'Final Year', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Devishree S', yearSection: 'Third Year-A', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Dhananjeyan P', yearSection: 'Third Year-A', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Jefrin Raja R', yearSection: 'Third Year-B', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Kishore R K', yearSection: 'Final Year', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Manoj S', yearSection: 'Final Year', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Menaka Sri R L', yearSection: 'Third Year-B', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Shindhuja', yearSection: 'Third Year-C', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Sri Lakshana', yearSection: 'Third Year-C', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },
      { name: 'Thamizharasi V', yearSection: 'Final Year', teamName: 'Goated or Ghosted', role: 'EVENT_COORDINATOR', assignedEvents: ['Goated or Ghosted', 'GOATED OR GHOSTED'] },

      // 7. Clash and Conquer (Team 7) -> EVENT_COORDINATOR
      { name: 'Darwin', yearSection: 'Third Year-A', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Joshika G', yearSection: 'Third Year-B', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Karthikeyan S', yearSection: 'Third Year-C', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Mohamad Irfan F', yearSection: 'Final Year', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Rithiha V', yearSection: 'Final Year', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Sheik Zayed F', yearSection: 'Final Year', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Subhashini S', yearSection: 'Final Year', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Mahadevi S', yearSection: 'Third Year-B', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Kiruthika', yearSection: 'Third Year-B', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },
      { name: 'Senthil', yearSection: 'Third Year-C', teamName: 'Clash and Conquer', role: 'EVENT_COORDINATOR', assignedEvents: ['Clash and Conquer', 'CLASH AND CONQUER'] },

      // 8. Box Cricket (Team 8) -> EVENT_COORDINATOR
      { name: 'Bala Krishnan', yearSection: 'Third Year-A', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Harikishore', yearSection: 'Third Year-A', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Kalayarasan S', yearSection: 'Third Year-B', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Kavidhasan S', yearSection: 'Final Year', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Logesh', yearSection: 'Third Year-C', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Mahendra Varma', yearSection: 'Final Year', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Shanmuganathan', yearSection: 'Third Year-C', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Sivapriyan', yearSection: 'Third Year-C', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Sridhar S', yearSection: 'Final Year', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },
      { name: 'Varun Sabarish', yearSection: 'Third Year-C', teamName: 'Box Cricket', role: 'EVENT_COORDINATOR', assignedEvents: ['Box Cricket', 'BOX CRICKET'] },

      // 9. E-Sports (Team 9) -> EVENT_COORDINATOR
      { name: 'Harrish', yearSection: 'Third Year-A', teamName: 'E-Sports', role: 'EVENT_COORDINATOR', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] },
      { name: 'Nobil S', yearSection: 'Final Year', teamName: 'E-Sports', role: 'EVENT_COORDINATOR', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] }, // also Team 13 Database
      { name: 'Pratheesh M', yearSection: 'Third Year-B', teamName: 'E-Sports', role: 'EVENT_COORDINATOR', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] },
      { name: 'Rahul', yearSection: 'Third Year-C', teamName: 'E-Sports', role: 'EVENT_COORDINATOR', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] },
      { name: 'Santhosh', yearSection: 'Third Year-C', teamName: 'E-Sports', role: 'EVENT_COORDINATOR', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] },
      { name: 'Siddharth T', yearSection: 'Final Year', teamName: 'E-Sports', role: 'EVENT_COORDINATOR', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] }, // also Team 13 Database

      // 10. ON Spot Registration (Team 10) -> ON_SPOT
      { name: 'Abirami M', yearSection: 'Final Year', teamName: 'ON Spot Registration', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Archana M', yearSection: 'Final Year', teamName: 'ON Spot Registration', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Gopika S', yearSection: 'Final Year', teamName: 'ON Spot Registration', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Jeevitha', yearSection: 'Third Year-B', teamName: 'ON Spot Registration', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Jeyavarshini M', yearSection: 'Third Year-B', teamName: 'ON Spot Registration', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Kiruthika M', yearSection: 'Third Year-B', teamName: 'ON Spot Registration', role: 'ON_SPOT', assignedEvents: [] },
      { name: 'Megavarshiini M', yearSection: 'Final Year', teamName: 'ON Spot Registration', role: 'ON_SPOT', assignedEvents: [] },

      // 11. Online Registration and Welcome Committee (Team 11) -> REGISTRATION
      { name: 'Abirami S', yearSection: 'Final Year', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] }, // also Team 20 Certificate
      { name: 'Blessy', yearSection: 'Third Year-A', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Deepa U', yearSection: 'Final Year', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: ['Zero Hour'] }, // also Team 3 Zero Hour
      { name: 'Kamalesh harish', yearSection: 'Third Year-B', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Kishore Kumar', yearSection: 'Third Year-B', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] }, // also Team 20 Certificate
      { name: 'Mohana Prasanth', yearSection: 'Third Year-B', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Praveena K', yearSection: 'Final Year', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] }, // also Team 20 Certificate
      { name: 'Praveena N', yearSection: 'Final Year', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] },
      { name: 'Vaishnavi B R', yearSection: 'Final Year', teamName: 'Online Registration and Welcome Committee', role: 'REGISTRATION', assignedEvents: [] },

      // 13. Database (Team 13) -> DATABASE
      { name: 'Anto Sebastian S', yearSection: 'Final Year', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'Buvana B', yearSection: 'Third Year-A', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'Divya Dharshini', yearSection: 'Third Year-A', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'Janani G', yearSection: 'Third Year-A', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'Jeevitha M', yearSection: 'Third Year-A', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'MahaLakshmi', yearSection: 'Third Year-B', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'MahaSri R L', yearSection: 'Third Year-B', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'Mubarak', yearSection: 'Third Year-B', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'Navina S', yearSection: 'Third Year-B', teamName: 'Database', role: 'DATABASE', assignedEvents: [] },
      { name: 'Nobil S', yearSection: 'Final Year', teamName: 'Database', role: 'DATABASE', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] }, // also Team 9 E-Sports
      { name: 'Siddharth T', yearSection: 'Final Year', teamName: 'Database', role: 'DATABASE', assignedEvents: ['ESPORTS (FREE FIRE & STUMBLE GUYS)', 'E-Sports'] }, // also Team 9 E-Sports

      // 20. Certificate Writing (Team 20) -> CERTIFICATE
      { name: 'Aaisha Banu', yearSection: 'Third Year-A', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Abirami S', yearSection: 'Final Year', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] }, // also Team 11 Registration
      { name: 'Dharani', yearSection: 'Third Year-A', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Kishore Kumar', yearSection: 'Third Year-B', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] }, // also Team 11 Registration
      { name: 'Oviya', yearSection: 'Third Year-B', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Praveena K', yearSection: 'Final Year', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] }, // also Team 11 Registration
      { name: 'Vishalini', yearSection: 'Third Year-C', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] },
      { name: 'Yogeshwari', yearSection: 'Third Year-C', teamName: 'Certificate Writing', role: 'CERTIFICATE', assignedEvents: [] }
    ];

    // Merge shared users into unique account records
    const mergedUsersMap = new Map<string, StoredUserRecord>();

    for (const def of userDefinitions) {
      const username = normalizeUsername(def.name);
      const email = `${username}@airox26.org`;

      let existing = mergedUsersMap.get(username);
      if (!existing) {
        // Check if existed before
        const prev = existingByUsername.get(username) || existingByEmail.get(email);
        const rawInitPassword = getInitialPassword(def.name);
        const { hash, salt } = hashPassword(rawInitPassword);

        existing = {
          id: prev?.id || `usr_${username}_${Math.random().toString(36).substring(2, 6)}`,
          name: def.name,
          username,
          email: prev?.email || email,
          role: def.role,
          secondaryRoles: [],
          status: prev?.status || 'ACTIVE',
          assignedEvents: [...def.assignedEvents],
          teamName: def.teamName,
          yearSection: def.yearSection,
          mustChangePassword: prev?.mustChangePassword !== undefined ? prev.mustChangePassword : true,
          passwordHash: prev?.passwordHash || hash,
          passwordSalt: prev?.passwordSalt || salt,
          createdAt: prev?.createdAt || '2026-08-20T10:00:00.000Z',
          updatedAt: new Date().toISOString()
        };
        mergedUsersMap.set(username, existing);
      } else {
        // Shared User found: merge roles & events
        if (existing.role !== def.role) {
          if (!existing.secondaryRoles) existing.secondaryRoles = [];
          if (!existing.secondaryRoles.includes(def.role)) {
            existing.secondaryRoles.push(def.role);
          }
          // Prioritize higher authority role as primary if applicable
          if (def.role === 'ADMIN' || (def.role === 'DATABASE' && existing.role !== 'ADMIN')) {
            const oldPrimary = existing.role;
            existing.role = def.role;
            if (!existing.secondaryRoles.includes(oldPrimary)) {
              existing.secondaryRoles.push(oldPrimary);
            }
          }
        }
        // Merge assigned events
        def.assignedEvents.forEach(ev => {
          if (!existing!.assignedEvents.includes(ev)) {
            existing!.assignedEvents.push(ev);
          }
        });
        existing.teamName = `${existing.teamName} & ${def.teamName}`;
      }
    }

    // Also ensure Admin accounts exist
    const adminHash = hashPassword('admin123');
    const adminRecords: StoredUserRecord[] = [
      {
        id: 'usr_admin_01',
        name: 'Mohanavela (Primary Admin)',
        username: 'mohanavelandev',
        email: 'mohanavelandev@gmail.com',
        role: 'ADMIN',
        secondaryRoles: ['DATABASE', 'EVENT_COORDINATOR'],
        status: 'ACTIVE',
        assignedEvents: ['Zero Hour', 'The Final Hire', 'Paper Presentation'],
        teamName: 'Core Administration',
        yearSection: 'Staff & Lead',
        mustChangePassword: false,
        passwordHash: adminHash.hash,
        passwordSalt: adminHash.salt,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'usr_admin_02',
        name: 'AIROX Admin Desk',
        username: 'admin',
        email: 'admin@airox26.org',
        role: 'ADMIN',
        status: 'ACTIVE',
        assignedEvents: [],
        teamName: 'Core Administration',
        yearSection: 'Staff',
        mustChangePassword: false,
        passwordHash: adminHash.hash,
        passwordSalt: adminHash.salt,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      }
    ];

    adminRecords.forEach(adm => {
      mergedUsersMap.set(adm.username, adm);
    });

    this.users.clear();
    for (const u of mergedUsersMap.values()) {
      this.indexUser(u);
    }

    this.saveUsersToDisk();
    console.log(`[AuthService] Successfully initialized ${this.getDistinctUsers().length} user accounts with password hashes across all 13 teams.`);
  }

  private ensureAdminUser(email: string, name: string) {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return;

    let existing = this.users.get(normalized);
    if (!existing) {
      const username = normalizeUsername(name);
      const { hash, salt } = hashPassword('admin123');
      const newUser: StoredUserRecord = {
        id: `usr_adm_${Date.now()}`,
        name,
        username,
        email: normalized,
        role: 'ADMIN',
        status: 'ACTIVE',
        assignedEvents: [],
        mustChangePassword: false,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.indexUser(newUser);
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
      const list = this.getDistinctUsers();
      const dir = path.dirname(this.usersStorePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
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

  private saveSessionsToDisk() {
    try {
      const activeSessions = Array.from(this.sessions.values()).filter(
        s => new Date(s.expiresAt).getTime() > Date.now()
      );
      const dir = path.dirname(this.sessionsStorePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.sessionsStorePath, JSON.stringify(activeSessions, null, 2), 'utf8');
    } catch (err) {
      console.error('[AuthService] Failed to save sessions store:', err);
    }
  }

  public createSession(userId: string): SessionRecord {
    const user = this.getStoredUserByIdOrUsername(userId);
    if (!user) {
      throw new Error('Cannot create session for non-existent user.');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const session: SessionRecord = {
      token,
      userId: user.id,
      userEmail: user.email,
      createdAt: now.toISOString(),
      expiresAt
    };

    this.sessions.set(token, session);
    this.saveSessionsToDisk();
    return session;
  }

  public verifySessionToken(token: string): AppUser | null {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.trim();
    const session = this.sessions.get(cleanToken);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(cleanToken);
      this.saveSessionsToDisk();
      return null;
    }

    const user = this.getStoredUserByIdOrUsername(session.userId) || this.getStoredUserByIdOrUsername(session.userEmail);
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    return this.sanitizeUser(user);
  }

  public destroySession(token: string): boolean {
    if (!token) return false;
    const cleanToken = token.trim();
    const existed = this.sessions.delete(cleanToken);
    if (existed) {
      this.saveSessionsToDisk();
    }
    return existed;
  }

  public destroyUserSessions(userId: string): void {
    let changed = false;
    for (const [tok, sess] of this.sessions.entries()) {
      if (sess.userId === userId || sess.userEmail.toLowerCase() === userId.toLowerCase()) {
        this.sessions.delete(tok);
        changed = true;
      }
    }
    if (changed) {
      this.saveSessionsToDisk();
    }
  }

  // --- USER RESOLUTION & AUTHENTICATION ---

  /**
   * Identifies user from request headers:
   * Requires a valid active Bearer token in Authorization header or x-session-token.
   */
  public resolveUserFromHeaders(headers: Record<string, string | string[] | undefined>): AppUser | null {
    let sessionToken: string | null = null;

    const authHeader = headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7).trim();
    } else if (typeof headers['x-session-token'] === 'string' && headers['x-session-token'].trim()) {
      sessionToken = headers['x-session-token'].trim();
    }

    if (sessionToken) {
      return this.verifySessionToken(sessionToken);
    }

    return null;
  }

  /**
   * Username / Password Credential Authentication
   */
  public authenticateWithCredentials(usernameOrEmail: string, passwordAttempt: string): { user: AppUser; mustChangePassword: boolean; token: string } {
    if (!usernameOrEmail || !passwordAttempt) {
      throw new Error('Username and password are required.');
    }

    const normalized = usernameOrEmail.toLowerCase().trim();
    const storedUser = this.users.get(normalized);

    if (!storedUser) {
      this.logAudit({
        userEmail: normalized,
        userName: 'Unknown',
        role: 'ANONYMOUS',
        action: 'ACCESS_DENIED',
        details: `Failed login attempt: Account "${normalized}" does not exist.`,
        status: 'DENIED'
      });
      throw new Error('Invalid username or password.');
    }

    if (storedUser.status !== 'ACTIVE') {
      this.logAudit({
        userEmail: storedUser.email,
        userName: storedUser.name,
        role: storedUser.role,
        action: 'ACCESS_DENIED',
        details: `Login attempt on deactivated account ${storedUser.username}`,
        status: 'DENIED'
      });
      throw new Error('Your account is currently disabled. Please contact the administrator.');
    }

    // Verify Password Hash
    let isValid = false;
    if (storedUser.passwordHash && storedUser.passwordSalt) {
      isValid = verifyPassword(passwordAttempt, storedUser.passwordHash, storedUser.passwordSalt);
    } else {
      // If legacy un-hashed account, check initial password and upgrade
      const initPassword = getInitialPassword(storedUser.name);
      if (passwordAttempt === initPassword || passwordAttempt === 'admin123') {
        const { hash, salt } = hashPassword(passwordAttempt);
        storedUser.passwordHash = hash;
        storedUser.passwordSalt = salt;
        this.saveUsersToDisk();
        isValid = true;
      }
    }

    if (!isValid) {
      this.logAudit({
        userEmail: storedUser.email,
        userName: storedUser.name,
        role: storedUser.role,
        action: 'ACCESS_DENIED',
        details: `Invalid password attempt for ${storedUser.username}`,
        status: 'DENIED'
      });
      throw new Error('Invalid username or password.');
    }

    // Update login timestamp
    storedUser.lastLoginAt = new Date().toISOString();
    this.saveUsersToDisk();

    // Create secure session token
    const session = this.createSession(storedUser.id);

    this.logAudit({
      userEmail: storedUser.email,
      userName: storedUser.name,
      role: storedUser.role,
      action: 'LOGIN',
      details: `User ${storedUser.username} (${storedUser.name}) signed in with credentials. Role: ${storedUser.role}`,
      status: 'SUCCESS'
    });

    const safeUser = this.sanitizeUser(storedUser)!;
    return {
      user: safeUser,
      mustChangePassword: Boolean(storedUser.mustChangePassword),
      token: session.token
    };
  }

  /**
   * Change Password (for first-login password prompt or user self-service)
   */
  public changePassword(
    userIdOrUsername: string,
    newPassword: string,
    currentPassword?: string,
    actorUser?: AppUser
  ): AppUser {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const storedUser = this.getStoredUserByIdOrUsername(userIdOrUsername);
    if (!storedUser) {
      throw new Error('User not found.');
    }

    // If current password provided, verify it
    if (currentPassword && storedUser.passwordHash && storedUser.passwordSalt) {
      const isMatch = verifyPassword(currentPassword, storedUser.passwordHash, storedUser.passwordSalt);
      if (!isMatch) {
        throw new Error('Current password does not match.');
      }
    }

    // Hash and store new password
    const { hash, salt } = hashPassword(newPassword.trim());
    storedUser.passwordHash = hash;
    storedUser.passwordSalt = salt;
    storedUser.mustChangePassword = false;
    storedUser.updatedAt = new Date().toISOString();

    this.saveUsersToDisk();

    this.logAudit({
      userEmail: storedUser.email,
      userName: storedUser.name,
      role: storedUser.role,
      action: 'PASSWORD_CHANGED',
      details: `Password changed for user ${storedUser.username} (${storedUser.name})`,
      targetId: storedUser.id,
      status: 'SUCCESS'
    });

    return this.sanitizeUser(storedUser)!;
  }

  /**
   * Admin Reset Password for a User
   */
  public resetPassword(
    targetUserId: string,
    customPassword: string | undefined,
    actorUser: AppUser
  ): { user: AppUser; temporaryPassword?: string } {
    if (actorUser.role !== 'ADMIN') {
      throw new Error('Only ADMIN can reset user passwords.');
    }

    const storedUser = this.getStoredUserByIdOrUsername(targetUserId);
    if (!storedUser) {
      throw new Error('Target user not found.');
    }

    const passwordToSet = customPassword && customPassword.trim().length > 0
      ? customPassword.trim()
      : getInitialPassword(storedUser.name);

    const { hash, salt } = hashPassword(passwordToSet);
    storedUser.passwordHash = hash;
    storedUser.passwordSalt = salt;
    storedUser.mustChangePassword = true;
    storedUser.updatedAt = new Date().toISOString();

    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'PASSWORD_RESET',
      details: `Admin ${actorUser.name} reset password for user ${storedUser.username} (${storedUser.name})`,
      targetId: storedUser.id,
      status: 'SUCCESS'
    });

    return {
      user: this.sanitizeUser(storedUser)!,
      temporaryPassword: passwordToSet
    };
  }

  public getStoredUserByIdOrUsername(idOrUsername: string): StoredUserRecord | null {
    const normalized = idOrUsername.toLowerCase().trim();
    return this.users.get(normalized) || this.users.get(idOrUsername) || null;
  }

  public getUserByEmail(email: string): AppUser | null {
    return this.sanitizeUser(this.users.get(email.toLowerCase().trim()) || null);
  }

  public getUserByUsername(username: string): AppUser | null {
    return this.sanitizeUser(this.users.get(username.toLowerCase().trim()) || null);
  }

  public getAllUsers(): AppUser[] {
    return this.getDistinctUsers()
      .map(u => this.sanitizeUser(u)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public createUser(data: {
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
  }, actorUser: AppUser): AppUser {
    const rawName = data.name.trim();
    const username = data.username ? data.username.toLowerCase().trim().replace(/\s+/g, '_') : normalizeUsername(rawName);
    const email = data.email ? data.email.toLowerCase().trim() : `${username}@airox26.org`;

    if (this.users.has(username) || this.users.has(email)) {
      throw new Error(`User with username "${username}" or email "${email}" already exists.`);
    }

    const initPassword = data.password && data.password.trim().length > 0
      ? data.password.trim()
      : getInitialPassword(rawName);

    const { hash, salt } = hashPassword(initPassword);

    const newUser: StoredUserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: rawName,
      username,
      email,
      role: data.role,
      secondaryRoles: Array.isArray(data.secondaryRoles) ? data.secondaryRoles : [],
      status: data.status || 'ACTIVE',
      assignedEvents: Array.isArray(data.assignedEvents) ? data.assignedEvents : [],
      teamName: data.teamName || '',
      yearSection: data.yearSection || '',
      mustChangePassword: true,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.indexUser(newUser);
    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'USER_CREATED',
      details: `Created user ${newUser.name} (@${newUser.username}) with role ${newUser.role} [${newUser.assignedEvents.join(', ')}]`,
      targetId: newUser.id,
      status: 'SUCCESS'
    });

    return this.sanitizeUser(newUser)!;
  }

  public updateUser(
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
    },
    actorUser: AppUser
  ): AppUser {
    const user = this.getStoredUserByIdOrUsername(id);
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
    if (updates.secondaryRoles !== undefined) user.secondaryRoles = updates.secondaryRoles;
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.assignedEvents !== undefined) user.assignedEvents = updates.assignedEvents;
    if (updates.teamName !== undefined) user.teamName = updates.teamName;
    if (updates.yearSection !== undefined) user.yearSection = updates.yearSection;
    user.updatedAt = new Date().toISOString();

    this.saveUsersToDisk();

    // Audit logs for role/event/status changes
    if (updates.role && updates.role !== prevRole) {
      this.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'USER_ROLE_CHANGED',
        details: `Changed role of @${user.username} from ${prevRole} to ${updates.role}`,
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
        details: `Changed status of @${user.username} from ${prevStatus} to ${updates.status}`,
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
        details: `Updated assigned events for @${user.username}: [${updates.assignedEvents.join(', ')}]`,
        targetId: user.id,
        status: 'SUCCESS'
      });
    }

    return this.sanitizeUser(user)!;
  }

  public deleteUser(id: string, actorUser: AppUser): boolean {
    const user = this.getStoredUserByIdOrUsername(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found.`);
    }

    if (user.email === this.adminEmail || user.username === 'admin') {
      throw new Error('Primary system administrator account cannot be deleted.');
    }

    this.users.delete(user.email.toLowerCase());
    this.users.delete(user.username.toLowerCase());
    this.users.delete(user.id);
    this.saveUsersToDisk();

    this.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'USER_DELETED',
      details: `Deleted user ${user.name} (@${user.username})`,
      targetId: id,
      status: 'SUCCESS'
    });

    return true;
  }

  // --- PERMISSION CHECKS & EVENT SCOPING ---

  public hasRole(user: AppUser | null, role: UserRole): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    if (user.role === role) return true;
    if (user.secondaryRoles && user.secondaryRoles.includes(role)) return true;
    return false;
  }

  /**
   * Checks if user has permission to access a specific event in the participant extractor/roster.
   * - ADMIN, DATABASE, REGISTRATION: Allowed for ALL events.
   * - EVENT_COORDINATOR: Allowed ONLY if event is in user.assignedEvents.
   * - CERTIFICATE: False for general participants extractor (has dedicated Certificate Desk).
   * - ON_SPOT: False (they have offline registration desk scope).
   */
  public canUserAccessEvent(user: AppUser | null, eventNameOrKey: string): boolean {
    if (!user || user.status !== 'ACTIVE') return false;

    if (user.role === 'ADMIN' || this.hasRole(user, 'DATABASE') || this.hasRole(user, 'REGISTRATION')) {
      return true;
    }

    if (this.hasRole(user, 'EVENT_COORDINATOR')) {
      if (!user.assignedEvents || user.assignedEvents.length === 0) return false;

      const normalizeStrict = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetNormalized = normalizeStrict(eventNameOrKey);

      return user.assignedEvents.some(ev => {
        const evNorm = normalizeStrict(ev);
        if (evNorm === targetNormalized) return true;
        // Handle plural/singular 'adshot' vs 'adsshot' or 'adbattle'
        if (evNorm.replace(/s+/g, '') === targetNormalized.replace(/s+/g, '')) return true;
        if (targetNormalized.includes(evNorm) || evNorm.includes(targetNormalized)) return true;
        return false;
      });
    }

    return false;
  }

  public canAccessCertificateDesk(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || this.hasRole(user, 'CERTIFICATE');
  }

  public canModifyCertificates(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || this.hasRole(user, 'CERTIFICATE');
  }

  public canCreateOrModifyOffline(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || this.hasRole(user, 'ON_SPOT');
  }

  public canManageUsers(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN';
  }

  public canAccessDatabaseWorkflow(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || this.hasRole(user, 'DATABASE');
  }

  public canAccessRegistrationWorkflow(user: AppUser | null): boolean {
    if (!user || user.status !== 'ACTIVE') return false;
    return user.role === 'ADMIN' || this.hasRole(user, 'REGISTRATION') || this.hasRole(user, 'DATABASE');
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
