import {
  OfflineRegistrationRecord,
  OfflineRegistrationFormData,
  DuplicateCheckResult,
  Participant
} from '../types';

/**
 * Standard Header Column Definitions for AIROX'26 Offline Registrations
 */
export const OFFLINE_SHEET_HEADERS = [
  'Offline Registration ID',
  'Full Name',
  'Email Address',
  'Mobile Number',
  'College / Institution',
  'Department',
  'Year / Section',
  'Event',
  'Team Name',
  'Verification Status',
  'Registered At',
  'Registered By',
  'Updated At',
  'Updated By',
  'Status'
];

export interface HeaderIndexMap {
  [key: string]: number;
}

/**
 * Normalizes header string to match header index regardless of column casing or slight spacing
 */
function normalizeHeaderKey(header: string): string {
  return (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts a dynamic mapping of standard fields to column indices
 */
export function buildHeaderIndexMap(headers: string[]): HeaderIndexMap {
  const map: HeaderIndexMap = {};
  
  headers.forEach((h, index) => {
    const norm = normalizeHeaderKey(h);
    if (norm.includes('offlineregistrationid') || (norm.includes('offline') && norm.includes('id')) || norm === 'regid' || norm === 'id') {
      map['offlineRegistrationId'] = index;
    } else if (norm.includes('fullname') || norm === 'name' || norm.includes('participantname')) {
      map['fullName'] = index;
    } else if (norm.includes('email') || norm.includes('mail')) {
      map['email'] = index;
    } else if (norm.includes('mobile') || norm.includes('phone') || norm.includes('contact')) {
      map['mobile'] = index;
    } else if (norm.includes('college') || norm.includes('institution')) {
      map['college'] = index;
    } else if (norm.includes('dept') || norm.includes('department')) {
      map['department'] = index;
    } else if (norm.includes('year') || norm.includes('section')) {
      map['yearSection'] = index;
    } else if (norm === 'event' || norm.includes('events') || norm.includes('registeredevent')) {
      map['event'] = index;
    } else if (norm.includes('team') || norm.includes('teamname')) {
      map['teamName'] = index;
    } else if (norm.includes('verification') || norm.includes('verificationstatus') || norm === 'verified') {
      map['verificationStatus'] = index;
    } else if (norm.includes('registeredat') || (norm.includes('reg') && norm.includes('time')) || norm.includes('timestamp')) {
      map['registeredAt'] = index;
    } else if (norm.includes('registeredby') || norm.includes('createdby') || norm.includes('coordinator')) {
      map['registeredBy'] = index;
    } else if (norm.includes('updatedat') || norm.includes('modifiedat')) {
      map['updatedAt'] = index;
    } else if (norm.includes('updatedby') || norm.includes('modifiedby')) {
      map['updatedBy'] = index;
    } else if (norm === 'status' || norm.includes('recordstatus') || norm.includes('activestatus')) {
      map['status'] = index;
    }
  });

  return map;
}

/**
 * Format current timestamp for audit fields
 */
export function formatTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Generate Next Unique Sequential Offline ID (e.g. OFF-AIROX26-001)
 * Scans all existing records (including CANCELLED ones) to ensure monotonic incrementing
 */
export function generateNextOfflineId(records: OfflineRegistrationRecord[]): string {
  let maxSeq = 0;
  
  for (const rec of records) {
    const match = (rec.offlineRegistrationId || '').match(/OFF-AIROX26-(\d+)/i);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `OFF-AIROX26-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Check for potential duplicates against existing offline records and online participants
 */
export function checkDuplicateRegistration(
  form: OfflineRegistrationFormData,
  existingOffline: OfflineRegistrationRecord[],
  onlineParticipants: Participant[] = []
): DuplicateCheckResult {
  const cleanMobile = (form.mobile || '').replace(/\D/g, '');
  const cleanEmail = (form.email || '').trim().toLowerCase();
  const cleanName = (form.fullName || '').trim().toLowerCase();
  const cleanCollege = (form.college || '').trim().toLowerCase();

  // 1. Check Offline Records (Active only)
  for (const off of existingOffline) {
    if (off.status === 'CANCELLED') continue;

    const offMobile = (off.mobile || '').replace(/\D/g, '');
    const offEmail = (off.email || '').trim().toLowerCase();
    const offName = (off.fullName || '').trim().toLowerCase();
    const offCollege = (off.college || '').trim().toLowerCase();

    // Check exact mobile match (at least 7 digits)
    if (cleanMobile.length >= 7 && offMobile === cleanMobile) {
      return {
        isDuplicate: true,
        duplicateType: 'mobile',
        matchedRecord: {
          id: off.offlineRegistrationId,
          name: off.fullName,
          source: 'OFFLINE',
          mobile: off.mobile,
          college: off.college,
          events: off.event
        },
        message: `Mobile number ${form.mobile} is already registered under Offline ID ${off.offlineRegistrationId} (${off.fullName}).`
      };
    }

    // Check exact email match (if provided)
    if (cleanEmail && offEmail && cleanEmail === offEmail) {
      return {
        isDuplicate: true,
        duplicateType: 'email',
        matchedRecord: {
          id: off.offlineRegistrationId,
          name: off.fullName,
          source: 'OFFLINE',
          mobile: off.mobile,
          college: off.college,
          events: off.event
        },
        message: `Email address ${form.email} is already registered under Offline ID ${off.offlineRegistrationId} (${off.fullName}).`
      };
    }

    // Check Name + Mobile
    if (cleanName && offName && cleanName === offName && offMobile === cleanMobile) {
      return {
        isDuplicate: true,
        duplicateType: 'name_mobile',
        matchedRecord: {
          id: off.offlineRegistrationId,
          name: off.fullName,
          source: 'OFFLINE',
          mobile: off.mobile,
          college: off.college,
          events: off.event
        },
        message: `A participant named "${off.fullName}" with mobile ${form.mobile} already exists (${off.offlineRegistrationId}).`
      };
    }

    // Check Name + College
    if (cleanName && offName && cleanCollege && offCollege && cleanName === offName && cleanCollege === offCollege) {
      return {
        isDuplicate: true,
        duplicateType: 'name_college',
        matchedRecord: {
          id: off.offlineRegistrationId,
          name: off.fullName,
          source: 'OFFLINE',
          mobile: off.mobile,
          college: off.college,
          events: off.event
        },
        message: `A participant named "${off.fullName}" from "${off.college}" already exists (${off.offlineRegistrationId}).`
      };
    }
  }

  // 2. Check Online Participants (if loaded in the app)
  for (const onl of onlineParticipants) {
    const onlMobile = (onl.mobile || '').replace(/\D/g, '');
    const onlEmail = (onl.email || '').trim().toLowerCase();
    const onlName = (onl.fullName || '').trim().toLowerCase();
    const onlCollege = (onl.college || '').trim().toLowerCase();

    if (cleanMobile.length >= 7 && onlMobile === cleanMobile) {
      return {
        isDuplicate: true,
        duplicateType: 'mobile',
        matchedRecord: {
          id: onl.registrationId,
          name: onl.fullName,
          source: 'ONLINE',
          mobile: onl.mobile,
          college: onl.college,
          events: onl.allEvents.join(', ')
        },
        message: `Mobile number ${form.mobile} is already registered in Online Registrations (${onl.registrationId} - ${onl.fullName}).`
      };
    }

    if (cleanEmail && onlEmail && cleanEmail === onlEmail) {
      return {
        isDuplicate: true,
        duplicateType: 'email',
        matchedRecord: {
          id: onl.registrationId,
          name: onl.fullName,
          source: 'ONLINE',
          mobile: onl.mobile,
          college: onl.college,
          events: onl.allEvents.join(', ')
        },
        message: `Email ${form.email} was previously registered online (${onl.registrationId} - ${onl.fullName}).`
      };
    }

    if (cleanName && onlName && cleanName === onlName && cleanCollege && onlCollege && cleanCollege === onlCollege) {
      return {
        isDuplicate: true,
        duplicateType: 'name_college',
        matchedRecord: {
          id: onl.registrationId,
          name: onl.fullName,
          source: 'ONLINE',
          mobile: onl.mobile,
          college: onl.college,
          events: onl.allEvents.join(', ')
        },
        message: `Participant "${onl.fullName}" from "${onl.college}" is already present in Online Registrations (${onl.registrationId}).`
      };
    }
  }

  return { isDuplicate: false };
}

import { getAccessToken, getAuthHeaders } from './auth';
import { apiRequest } from './apiClient';

/**
 * Authoritative Server-Side Google Sheets & Backend API Client
 */
export class OfflineApiClient {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    return getAuthHeaders();
  }

  /**
   * Fetches all offline registrations from the authoritative Google Sheets backend
   */
  async fetchRegistrations(): Promise<{ records: OfflineRegistrationRecord[]; headers: string[]; source: string; sheetId?: string }> {
    const { ok, data, error } = await apiRequest<{ records: OfflineRegistrationRecord[]; headers: string[]; source: string; sheetId?: string }>('/api/offline/registrations');
    if (!ok) {
      throw new Error(error || 'Unable to fetch registrations from Google Sheets.');
    }
    return {
      records: data.records || [],
      headers: data.headers || OFFLINE_SHEET_HEADERS,
      source: data.source || 'PERSISTENT_STORE',
      sheetId: data.sheetId
    };
  }

  /**
   * Triggers a live sync with Google Sheets
   */
  async syncRegistrations(): Promise<{ records: OfflineRegistrationRecord[]; headers: string[]; source: string; message: string }> {
    const { ok, data, error } = await apiRequest<{ records: OfflineRegistrationRecord[]; headers: string[]; source: string; message: string }>('/api/offline/sync', {
      method: 'POST'
    });
    if (!ok) {
      throw new Error(error || 'Unable to sync offline registrations. Please try again.');
    }
    return data;
  }

  /**
   * Creates an offline registration in Google Sheets
   */
  async createRegistration(
    formData: OfflineRegistrationFormData,
    coordinatorName: string = 'Desk Admin'
  ): Promise<OfflineRegistrationRecord> {
    const { ok, data, error } = await apiRequest<{ success: boolean; record: OfflineRegistrationRecord }>('/api/offline/registrations', {
      method: 'POST',
      body: JSON.stringify({
        formData,
        coordinatorName
      })
    });

    if (!ok || !data.record) {
      throw new Error(error || 'Unable to save registration to Google Sheets.');
    }

    return data.record;
  }

  /**
   * Updates an existing registration in Google Sheets
   */
  async updateRegistration(
    id: string,
    updates: Partial<OfflineRegistrationRecord>,
    coordinatorName: string = 'Desk Admin'
  ): Promise<OfflineRegistrationRecord> {
    const { ok, data, error } = await apiRequest<{ success: boolean; record: OfflineRegistrationRecord }>(`/api/offline/registrations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        updates,
        coordinatorName
      })
    });

    if (!ok || !data.record) {
      throw new Error(error || 'Unable to update registration in Google Sheets.');
    }

    return data.record;
  }

  /**
   * Soft-deletes a registration by setting Status = CANCELLED in Google Sheets
   */
  async cancelRegistration(id: string, coordinatorName: string = 'Desk Admin'): Promise<OfflineRegistrationRecord> {
    const { ok, data, error } = await apiRequest<{ success: boolean; record: OfflineRegistrationRecord }>(`/api/offline/registrations/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ coordinatorName })
    });

    if (!ok || !data.record) {
      throw new Error(error || 'Unable to cancel registration in Google Sheets.');
    }

    return data.record;
  }

  /**
   * Restores a previously cancelled registration
   */
  async restoreRegistration(id: string, coordinatorName: string = 'Desk Admin'): Promise<OfflineRegistrationRecord> {
    const { ok, data, error } = await apiRequest<{ success: boolean; record: OfflineRegistrationRecord }>(`/api/offline/registrations/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: JSON.stringify({ coordinatorName })
    });

    if (!ok || !data.record) {
      throw new Error(error || 'Unable to restore registration in Google Sheets.');
    }

    return data.record;
  }

  /**
   * Get server-side Google Sheets configuration status
   */
  async getConfig(): Promise<{ sheetId: string; isGoogleAuthReady: boolean; authMethod?: string; serviceAccountEmail?: string }> {
    const { ok, data } = await apiRequest<{ sheetId: string; isGoogleAuthReady: boolean; authMethod?: string; serviceAccountEmail?: string }>('/api/offline/config');
    if (!ok) return { sheetId: '', isGoogleAuthReady: false };
    return data;
  }

  /**
   * Run server diagnostics on Google Sheets connectivity
   */
  async getDiagnostics(): Promise<any> {
    const { data } = await apiRequest<any>('/api/offline/diagnostics');
    return data;
  }

  /**
   * Execute backend test write of TEST-AIROX26
   */
  async executeTestWrite(): Promise<{ success: boolean; record?: OfflineRegistrationRecord; error?: string; message: string }> {
    const { ok, data, error } = await apiRequest<{ success: boolean; record?: OfflineRegistrationRecord; error?: string; message: string }>('/api/offline/test-write', {
      method: 'POST'
    });
    if (!ok) {
      throw new Error(error || data?.message || 'Diagnostic test write failed');
    }
    return data;
  }

  /**
   * Update server-side Google Sheets Sheet ID
   */
  async setConfig(sheetId: string): Promise<{ success: boolean; sheetId: string; isGoogleAuthReady: boolean; authMethod?: string; serviceAccountEmail?: string }> {
    const { ok, data, error } = await apiRequest<{ success: boolean; sheetId: string; isGoogleAuthReady: boolean; authMethod?: string; serviceAccountEmail?: string }>('/api/offline/config', {
      method: 'POST',
      body: JSON.stringify({ sheetId })
    });
    if (!ok) {
      throw new Error(error || 'Failed to update Google Sheet ID.');
    }
    return data;
  }
}

export const offlineApiClient = new OfflineApiClient();
export const defaultSheetsClient = offlineApiClient;

export class OnlineApiClient {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    return getAuthHeaders();
  }

  async fetchRegistrations(): Promise<{
    success: boolean;
    rows: any[];
    headers: string[];
    source: 'GOOGLE_SHEETS' | 'UNCONFIGURED' | 'FALLBACK';
    count: number;
    sheetId?: string;
    warning?: string;
  }> {
    const { ok, data, error } = await apiRequest<{
      success: boolean;
      rows: any[];
      headers: string[];
      source: 'GOOGLE_SHEETS' | 'UNCONFIGURED' | 'FALLBACK';
      count: number;
      sheetId?: string;
      warning?: string;
    }>('/api/online/registrations');
    if (!ok) {
      throw new Error(error || 'Failed to fetch online registrations');
    }
    return data;
  }

  async syncRegistrations(): Promise<{
    success: boolean;
    rows: any[];
    headers: string[];
    source: 'GOOGLE_SHEETS' | 'UNCONFIGURED' | 'FALLBACK';
    count: number;
    sheetId?: string;
    warning?: string;
  }> {
    const { ok, data, error } = await apiRequest<{
      success: boolean;
      rows: any[];
      headers: string[];
      source: 'GOOGLE_SHEETS' | 'UNCONFIGURED' | 'FALLBACK';
      count: number;
      sheetId?: string;
      warning?: string;
    }>('/api/online/sync', { method: 'POST' });
    if (!ok) {
      throw new Error(error || 'Failed to sync online registrations');
    }
    return data;
  }

  async getConfig(): Promise<{ sheetId: string; isGoogleAuthReady: boolean }> {
    const { ok, data } = await apiRequest<{ sheetId: string; isGoogleAuthReady: boolean }>('/api/online/config');
    if (!ok) return { sheetId: '', isGoogleAuthReady: false };
    return data;
  }

  async setConfig(sheetId: string): Promise<{ success: boolean; sheetId: string; isGoogleAuthReady: boolean }> {
    const { ok, data, error } = await apiRequest<{ success: boolean; sheetId: string; isGoogleAuthReady: boolean }>('/api/online/config', {
      method: 'POST',
      body: JSON.stringify({ sheetId })
    });
    if (!ok) {
      throw new Error(error || 'Failed to update Online Sheet ID.');
    }
    return data;
  }
}

export const onlineApiClient = new OnlineApiClient();

