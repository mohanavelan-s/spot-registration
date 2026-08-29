import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  OfflineRegistrationRecord,
  OfflineRegistrationFormData,
  DuplicateCheckResult,
  Participant
} from '../types';
import { getStoredUser } from './auth';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  tableName: string;
  isConfigured: boolean;
  source?: string;
}

export interface SupabaseDiagnostics {
  timestamp: string;
  supabaseUrl: string;
  tableName: string;
  isConnected: boolean;
  tableExists: boolean;
  rowCount: number;
  storageMode: 'SUPABASE_CLOUD' | 'LOCAL_PERSISTENT_STORE';
  latencyMs?: number;
  error?: string;
  recommendations: string[];
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
 * Generate Next Unique Sequential Offline ID (e.g. AIROX26-OFF-001)
 */
export function generateNextOfflineId(records: OfflineRegistrationRecord[]): string {
  let maxSeq = 0;

  for (const rec of records) {
    const match = (rec.offlineRegistrationId || '').match(/(?:AIROX26-OFF-|OFF-AIROX26-)(\d+)/i);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `AIROX26-OFF-${String(nextSeq).padStart(3, '0')}`;
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
    if (cleanMobile.length >= 7 && offMobile.length >= 7 && (cleanMobile === offMobile || offMobile.includes(cleanMobile) || cleanMobile.includes(offMobile))) {
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
        message: `Phone number matches existing offline registration (${off.offlineRegistrationId} - ${off.fullName}).`
      };
    }

    // Check exact email match
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
        message: `Email address matches existing offline registration (${off.offlineRegistrationId} - ${off.fullName}).`
      };
    }

    // Check Fuzzy Name + College Match
    if (cleanName && cleanCollege && cleanName === offName && cleanCollege === offCollege) {
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
        message: `Participant with identical name and college is already registered (${off.offlineRegistrationId}).`
      };
    }
  }

  // 2. Check Online Extracted Participants
  for (const onl of onlineParticipants) {
    const onlMobile = (onl.mobile || '').replace(/\D/g, '');
    const onlEmail = (onl.email || '').trim().toLowerCase();
    const onlName = (onl.fullName || '').trim().toLowerCase();
    const onlCollege = (onl.college || '').trim().toLowerCase();

    if (cleanMobile.length >= 7 && onlMobile.length >= 7 && (cleanMobile === onlMobile || onlMobile.includes(cleanMobile) || cleanMobile.includes(onlMobile))) {
      const evNames = (onl.allEvents || []).join(', ');
      return {
        isDuplicate: true,
        duplicateType: 'mobile',
        matchedRecord: {
          id: onl.registrationId,
          name: onl.fullName,
          source: 'ONLINE',
          mobile: onl.mobile,
          college: onl.college,
          events: evNames
        },
        message: `Phone number matches online registered participant (${onl.registrationId} - ${onl.fullName}).`
      };
    }

    if (cleanEmail && onlEmail && cleanEmail === onlEmail) {
      const evNames = (onl.allEvents || []).join(', ');
      return {
        isDuplicate: true,
        duplicateType: 'email',
        matchedRecord: {
          id: onl.registrationId,
          name: onl.fullName,
          source: 'ONLINE',
          mobile: onl.mobile,
          college: onl.college,
          events: evNames
        },
        message: `Email address matches online registered participant (${onl.registrationId} - ${onl.fullName}).`
      };
    }

    if (cleanName && cleanCollege && cleanName === onlName && cleanCollege === onlCollege) {
      const evNames = (onl.allEvents || []).join(', ');
      return {
        isDuplicate: true,
        duplicateType: 'name_college',
        matchedRecord: {
          id: onl.registrationId,
          name: onl.fullName,
          source: 'ONLINE',
          mobile: onl.mobile,
          college: onl.college,
          events: evNames
        },
        message: `Participant with identical name and college is already registered online (${onl.registrationId}).`
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Supabase and Offline API Client
 */
export class SupabaseApiClient {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const user = getStoredUser();
    if (user) {
      headers['x-user-id'] = user.id;
      headers['x-user-email'] = user.email;
      headers['x-user-role'] = user.role;
      headers['x-user-name'] = user.name;
    }

    return headers;
  }

  /**
   * Fetch all offline registrations
   */
  async fetchRegistrations(): Promise<{
    records: OfflineRegistrationRecord[];
    source: string;
    message?: string;
  }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/registrations', { headers });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to fetch offline registrations.');
    }
    const data = await res.json();
    return {
      records: data.records || [],
      source: data.source || 'PERSISTENT_STORE',
      message: data.message
    };
  }

  /**
   * Force sync from Supabase
   */
  async syncRegistrations(): Promise<{
    records: OfflineRegistrationRecord[];
    source: string;
    message: string;
  }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/sync', { method: 'POST', headers });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Unable to sync registrations. Please try again.');
    }
    return await res.json();
  }

  /**
   * Push sync all local store records directly to Supabase
   */
  async pushSyncToSupabase(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/sync-to-supabase', { method: 'POST', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to push records to Supabase');
    }
    return data;
  }

  // Alias for backward compatibility
  async pushSyncToGoogleSheet(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    return this.pushSyncToSupabase();
  }

  /**
   * Creates an offline registration in Supabase / persistent store
   */
  async createRegistration(
    formData: OfflineRegistrationFormData,
    coordinatorName: string = 'Desk Admin'
  ): Promise<OfflineRegistrationRecord> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/registrations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        formData,
        coordinatorName
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || `Unable to save registration (${res.status})`);
    }

    return data.record;
  }

  /**
   * Updates an existing registration
   */
  async updateRegistration(
    id: string,
    updates: Partial<OfflineRegistrationRecord>,
    coordinatorName: string = 'Desk Admin'
  ): Promise<OfflineRegistrationRecord> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/offline/registrations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        updates,
        coordinatorName
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || `Unable to update registration (${res.status})`);
    }

    return data.record;
  }

  /**
   * Soft-deletes a registration (status = CANCELLED)
   */
  async cancelRegistration(id: string, coordinatorName: string = 'Desk Admin'): Promise<OfflineRegistrationRecord> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/offline/registrations/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ coordinatorName })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || `Unable to cancel registration (${res.status})`);
    }

    return data.record;
  }

  /**
   * Restores a previously cancelled registration
   */
  async restoreRegistration(id: string, coordinatorName: string = 'Desk Admin'): Promise<OfflineRegistrationRecord> {
    return this.updateRegistration(id, { status: 'ACTIVE', verificationStatus: 'Verified' }, coordinatorName);
  }

  /**
   * Get server-side Supabase configuration
   */
  async getConfig(): Promise<SupabaseConfig> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/config', { headers });
    if (!res.ok) {
      return {
        supabaseUrl: '',
        supabaseAnonKey: '',
        tableName: 'offline_registrations',
        isConfigured: false
      };
    }
    return await res.json();
  }

  /**
   * Update server-side Supabase configuration
   */
  async setConfig(config: { supabaseUrl: string; supabaseAnonKey: string; tableName?: string }): Promise<{
    success: boolean;
    config: SupabaseConfig;
  }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/config', {
      method: 'POST',
      headers,
      body: JSON.stringify(config)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to update Supabase configuration.');
    }
    return await res.json();
  }

  /**
   * Run server diagnostics on Supabase connectivity
   */
  async getDiagnostics(): Promise<SupabaseDiagnostics> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/diagnostics', { headers });
    return await res.json();
  }

  /**
   * Execute backend test write of a sample row to Supabase
   */
  async executeTestWrite(): Promise<{ success: boolean; record?: OfflineRegistrationRecord; error?: string; message: string }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/test-write', { method: 'POST', headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Diagnostic test write failed');
    }
    return data;
  }

  /**
   * Get standard SQL migration script for Supabase SQL Editor
   */
  async getSqlMigrationScript(): Promise<{ sql: string }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/offline/sql-schema', { headers });
    return await res.json();
  }
}

export const supabaseApiClient = new SupabaseApiClient();
export const offlineApiClient = supabaseApiClient;
export const defaultSheetsClient = supabaseApiClient;
