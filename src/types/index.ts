export interface RawRow {
  [key: string]: any;
}

export type VerificationStatus = 'Verified' | 'Pending' | 'Rejected' | 'All';
export type RegistrationSource = 'ONLINE' | 'OFFLINE';
export type RecordStatus = 'ACTIVE' | 'CANCELLED';

export interface Participant {
  id: string; // Unique ID (Registration ID or fallback)
  registrationId: string;
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  department?: string;
  yearSection?: string;
  technicalEventsRaw: string;
  nonTechnicalEventsRaw: string;
  technicalEvents: string[]; // Normalized canonical event keys
  nonTechnicalEvents: string[]; // Normalized canonical event keys
  allEvents: string[]; // Combined canonical event keys
  participationMode: string; // "Individual", "Team", etc.
  teamName: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  source: RegistrationSource; // 'ONLINE' | 'OFFLINE'
  registeredAt?: string;
  registeredBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  status?: RecordStatus; // 'ACTIVE' | 'CANCELLED'
  isPossibleDuplicate?: boolean;
  duplicateInfo?: {
    matchedId: string;
    matchedSource: RegistrationSource;
    matchedName: string;
    matchedEvent?: string;
    reason: string;
  };
  rawRow?: RawRow; // Preserves all original columns (e.g. Department, Year, Timestamp)
}

export interface DetectedEvent {
  key: string; // Canonical normalized key, e.g. "the final hire"
  displayName: string; // Human readable title, e.g. "The Final Hire"
  category: 'Technical' | 'Non-Technical' | 'Both';
  participantCount: number; // Combined count (same as combinedCount)
  onlineCount: number;
  offlineCount: number;
  combinedCount: number;
  aliases: string[];
  sampleRawOccurrences: string[];
}

export interface EventAliasMap {
  [canonicalKey: string]: {
    displayName: string;
    category?: 'Technical' | 'Non-Technical' | 'Both';
    aliases: string[];
  };
}

export interface ColumnMapping {
  registrationIdKey: string | null;
  fullNameKey: string | null;
  emailKey: string | null;
  mobileKey: string | null;
  collegeKey: string | null;
  technicalEventsKey: string | null;
  nonTechnicalEventsKey: string | null;
  participationModeKey: string | null;
  teamNameKey: string | null;
  verificationStatusKey: string | null;
  allColumns: string[];
}

export interface ParseResult {
  fileName: string;
  fileSize?: number;
  totalRegistrations: number;
  participants: Participant[];
  detectedEvents: DetectedEvent[];
  columnMapping: ColumnMapping;
  warnings: string[];
  errors: string[];
  sheetNames?: string[];
  activeSheet?: string;
}

export type SourceFilter = 'ALL' | 'ONLINE' | 'OFFLINE';

export interface FilterState {
  selectedEventKey: string | null;
  searchQuery: string;
  statusFilter: VerificationStatus;
  sourceFilter: SourceFilter;
  showCancelled?: boolean;
  sortBy: keyof Participant | 'college' | 'name' | 'id' | 'teamName' | 'source' | 'registeredAt';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface CombinedStats {
  totalUniqueRegistrations: number;
  onlineUniqueRegistrations: number;
  offlineActiveRegistrations: number;
  offlineCancelledRegistrations: number;
  totalEventParticipations: number;
  detectedEventsCount: number;
  possibleDuplicatesCount: number;
  lastSyncedAt?: string;
  isOfflineAvailable: boolean;
  offlineSourceType: string;
  offlineErrorMessage?: string;
}

export interface TestCaseResult {
  name: string;
  description: string;
  inputs: string[];
  expectedCanonical: string;
  actualCanonical: string;
  passed: boolean;
  notes?: string;
}

export interface OfflineRegistrationRecord {
  rowIndex?: number; // 1-based row index in Google Sheet
  offlineRegistrationId: string; // e.g. "OFF-AIROX26-001"
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  department: string;
  yearSection: string;
  event: string; // Canonical event name or comma-separated canonical names
  teamName: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  registeredAt: string;
  registeredBy: string;
  updatedAt: string;
  updatedBy: string;
  status: RecordStatus;
}

export interface OfflineRegistrationFormData {
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  department: string;
  yearSection: string;
  selectedEvents: string[]; // List of canonical display names
  teamName: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  registeredBy: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'mobile' | 'email' | 'name_mobile' | 'name_college';
  matchedRecord?: {
    id: string;
    name: string;
    source: 'OFFLINE' | 'ONLINE';
    mobile: string;
    college: string;
    events: string;
  };
  message?: string;
}

export interface OfflineFilterState {
  searchQuery: string;
  eventFilter: string; // 'ALL' or specific canonical event
  statusFilter: 'ALL' | 'ACTIVE' | 'CANCELLED';
  verificationFilter: 'ALL' | 'Verified' | 'Pending' | 'Rejected';
  sortBy: keyof OfflineRegistrationRecord | 'offlineRegistrationId';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

// ==========================================
// PHASE 3: AUTHENTICATION & RBAC TYPES
// ==========================================
export type UserRole = 'ADMIN' | 'EVENT_COORDINATOR' | 'ON_SPOT' | 'DATABASE' | 'CERTIFICATE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  assignedEvents: string[]; // List of canonical event display names, e.g. ["The Final Hire"]
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
  targetId?: string; // e.g. registration ID, event name, user ID
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipAddress?: string;
}

export interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
}

// ==========================================
// CERTIFICATE TRACKING TYPES
// ==========================================
export type CertificateStatus = 'PENDING' | 'ISSUED';

export interface CertificateRecord {
  id: string; // `${registrationId}__${eventKey}`
  registrationId: string;
  event: string;
  eventKey: string;
  participantName: string;
  college?: string;
  status: CertificateStatus;
  issuedAt?: string;
  issuedBy?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CertificateFilterState {
  searchQuery: string;
  statusFilter: 'ALL' | 'PENDING' | 'ISSUED';
  verificationFilter: 'ALL' | 'Verified' | 'Pending' | 'Rejected';
  event: string; // Selected canonical event display name
  page: number;
  pageSize: number;
}

