import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export interface OfflineRecord {
  id?: string;
  rowIndex?: number;
  offlineRegistrationId: string;
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  department: string;
  yearSection: string;
  event: string;
  teamName: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  registeredAt: string;
  registeredBy: string;
  updatedAt: string;
  updatedBy: string;
  status: 'ACTIVE' | 'CANCELLED';
}

export interface SupabaseConfigState {
  supabaseUrl: string;
  supabaseAnonKey: string;
  tableName: string;
  isConfigured: boolean;
  source: 'ENV' | 'CUSTOM' | 'DEFAULT';
}

export interface SupabaseDiagnosticResult {
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

export class ServerSupabaseService {
  private supabaseClient: SupabaseClient | null = null;
  private supabaseUrl: string = '';
  private supabaseAnonKey: string = '';
  private tableName: string = 'offline_registrations';
  private localStorePath: string;
  private cachedRecords: OfflineRecord[] = [];

  constructor() {
    this.localStorePath = path.join(process.cwd(), 'server', 'offline_registrations_store.json');
    this.loadFromDisk();

    // Read initial env config
    this.supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    this.tableName = process.env.SUPABASE_TABLE_NAME || 'offline_registrations';

    this.initClient();
  }

  private initClient(): void {
    if (this.supabaseUrl && this.supabaseAnonKey) {
      try {
        this.supabaseClient = createClient(this.supabaseUrl, this.supabaseAnonKey, {
          auth: { persistSession: false }
        });
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
        this.supabaseClient = null;
      }
    } else {
      this.supabaseClient = null;
    }
  }

  public setConfig(url: string, key: string, tableName?: string): void {
    this.supabaseUrl = (url || '').trim();
    this.supabaseAnonKey = (key || '').trim();
    if (tableName) {
      this.tableName = tableName.trim() || 'offline_registrations';
    }
    this.initClient();
  }

  public getConfig(): SupabaseConfigState {
    const isConfigured = Boolean(this.supabaseUrl && this.supabaseAnonKey);
    return {
      supabaseUrl: this.supabaseUrl,
      supabaseAnonKey: this.supabaseAnonKey ? `${this.supabaseAnonKey.slice(0, 8)}...` : '',
      tableName: this.tableName,
      isConfigured,
      source: process.env.SUPABASE_URL ? 'ENV' : (this.supabaseUrl ? 'CUSTOM' : 'DEFAULT')
    };
  }

  public getRawConfig(): { supabaseUrl: string; supabaseAnonKey: string; tableName: string } {
    return {
      supabaseUrl: this.supabaseUrl,
      supabaseAnonKey: this.supabaseAnonKey,
      tableName: this.tableName
    };
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.localStorePath)) {
        const raw = fs.readFileSync(this.localStorePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cachedRecords = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed reading offline registrations from disk:', e);
      this.cachedRecords = [];
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.localStorePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.localStorePath, JSON.stringify(this.cachedRecords, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed saving offline registrations to disk:', e);
    }
  }

  public getCachedRecords(): OfflineRecord[] {
    return [...this.cachedRecords];
  }

  // Convert snake_case Supabase row to camelCase OfflineRecord
  private mapRowToRecord(row: any): OfflineRecord {
    return {
      id: row.id,
      offlineRegistrationId: row.offline_registration_id || row.offlineRegistrationId || '',
      fullName: row.full_name || row.fullName || '',
      email: row.email || '',
      mobile: row.mobile || '',
      college: row.college || '',
      department: row.department || '',
      yearSection: row.year_section || row.yearSection || '',
      event: row.event || '',
      teamName: row.team_name || row.teamName || '',
      verificationStatus: (row.verification_status || row.verificationStatus || 'Verified') as any,
      registeredAt: row.registered_at || row.registeredAt || new Date().toISOString(),
      registeredBy: row.registered_by || row.registeredBy || 'Desk Admin',
      updatedAt: row.updated_at || row.updatedAt || '',
      updatedBy: row.updated_by || row.updatedBy || '',
      status: (row.status || 'ACTIVE') as any
    };
  }

  // Convert camelCase OfflineRecord to snake_case Supabase payload
  private mapRecordToRow(rec: OfflineRecord): any {
    return {
      offline_registration_id: rec.offlineRegistrationId,
      full_name: rec.fullName,
      email: rec.email || '',
      mobile: rec.mobile,
      college: rec.college || '',
      department: rec.department || '',
      year_section: rec.yearSection || '',
      event: rec.event,
      team_name: rec.teamName || '',
      verification_status: rec.verificationStatus || 'Verified',
      registered_at: rec.registeredAt || new Date().toISOString(),
      registered_by: rec.registeredBy || 'Desk Admin',
      updated_at: rec.updatedAt || new Date().toISOString(),
      updated_by: rec.updatedBy || '',
      status: rec.status || 'ACTIVE'
    };
  }

  // Fetch all registrations from Supabase, or fall back to local disk
  public async fetchRegistrations(): Promise<{
    records: OfflineRecord[];
    source: 'SUPABASE_CLOUD' | 'LOCAL_PERSISTENT_STORE';
    message?: string;
  }> {
    if (this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from(this.tableName)
          .select('*')
          .order('registered_at', { ascending: true });

        if (error) {
          console.warn('Supabase fetch error, falling back to disk cache:', error.message);
          return {
            records: this.getCachedRecords(),
            source: 'LOCAL_PERSISTENT_STORE',
            message: `Supabase notice: ${error.message} (Serving persistent local store)`
          };
        }

        if (data && Array.isArray(data)) {
          const records = data.map((r, idx) => {
            const rec = this.mapRowToRecord(r);
            rec.rowIndex = idx + 1;
            return rec;
          });

          // Update local cache
          this.cachedRecords = records;
          this.saveToDisk();

          return {
            records,
            source: 'SUPABASE_CLOUD'
          };
        }
      } catch (err: any) {
        console.warn('Supabase request failed, using local store:', err.message);
      }
    }

    return {
      records: this.getCachedRecords(),
      source: 'LOCAL_PERSISTENT_STORE'
    };
  }

  // Generate Next ID
  public generateNextOfflineId(): string {
    const existing = this.cachedRecords;
    let maxNum = 0;
    const regex = /AIROX26-OFF-(\d+)/i;

    existing.forEach(r => {
      const match = (r.offlineRegistrationId || '').match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `AIROX26-OFF-${String(nextNum).padStart(3, '0')}`;
  }

  // Create new registration
  public async appendRegistration(
    recordData: Omit<OfflineRecord, 'offlineRegistrationId'> & { offlineRegistrationId?: string }
  ): Promise<OfflineRecord> {
    const offlineId = recordData.offlineRegistrationId?.trim() || this.generateNextOfflineId();
    const now = new Date().toISOString();

    const newRecord: OfflineRecord = {
      ...recordData,
      offlineRegistrationId: offlineId,
      registeredAt: recordData.registeredAt || now,
      updatedAt: now,
      status: recordData.status || 'ACTIVE',
      verificationStatus: recordData.verificationStatus || 'Verified',
      rowIndex: this.cachedRecords.length + 1
    };

    // Save locally first
    this.cachedRecords.push(newRecord);
    this.saveToDisk();

    // If Supabase is connected, insert into Supabase
    if (this.supabaseClient) {
      try {
        const rowPayload = this.mapRecordToRow(newRecord);
        const { data, error } = await this.supabaseClient
          .from(this.tableName)
          .insert(rowPayload)
          .select()
          .single();

        if (error) {
          console.warn('Supabase insert notice (saved locally):', error.message);
        } else if (data) {
          newRecord.id = data.id;
        }
      } catch (err: any) {
        console.warn('Failed to insert into Supabase (saved locally):', err.message);
      }
    }

    return newRecord;
  }

  // Update registration
  public async updateRegistration(
    idOrRegId: string,
    updates: Partial<OfflineRecord>,
    actorEmail: string = 'Desk Admin'
  ): Promise<OfflineRecord> {
    const index = this.cachedRecords.findIndex(
      r => r.offlineRegistrationId === idOrRegId || r.id === idOrRegId
    );

    if (index === -1) {
      throw new Error(`Registration record '${idOrRegId}' not found.`);
    }

    const current = this.cachedRecords[index];
    const now = new Date().toISOString();

    const updated: OfflineRecord = {
      ...current,
      ...updates,
      updatedAt: now,
      updatedBy: actorEmail || updates.updatedBy || current.updatedBy
    };

    this.cachedRecords[index] = updated;
    this.saveToDisk();

    // Update in Supabase
    if (this.supabaseClient) {
      try {
        const rowPayload = this.mapRecordToRow(updated);
        const { error } = await this.supabaseClient
          .from(this.tableName)
          .update(rowPayload)
          .eq('offline_registration_id', updated.offlineRegistrationId);

        if (error) {
          console.warn('Supabase update notice:', error.message);
        }
      } catch (err: any) {
        console.warn('Failed to update Supabase row:', err.message);
      }
    }

    return updated;
  }

  // Soft Delete / Cancel Registration
  public async cancelRegistration(
    idOrRegId: string,
    actorEmail: string = 'Desk Admin'
  ): Promise<OfflineRecord> {
    return this.updateRegistration(
      idOrRegId,
      {
        status: 'CANCELLED',
        verificationStatus: 'Rejected'
      },
      actorEmail
    );
  }

  // Bulk sync local records to Supabase
  public async syncAllLocalToSupabase(): Promise<{
    syncedCount: number;
    message: string;
    success: boolean;
  }> {
    if (!this.supabaseClient) {
      return {
        syncedCount: this.cachedRecords.length,
        message: 'Saved to persistent store. Connect Supabase credentials in settings to sync to cloud.',
        success: true
      };
    }

    if (this.cachedRecords.length === 0) {
      return {
        syncedCount: 0,
        message: 'No local records to sync.',
        success: true
      };
    }

    try {
      const rows = this.cachedRecords.map(r => this.mapRecordToRow(r));
      const { error } = await this.supabaseClient
        .from(this.tableName)
        .upsert(rows, { onConflict: 'offline_registration_id' });

      if (error) {
        throw new Error(error.message);
      }

      return {
        syncedCount: rows.length,
        message: `Successfully synchronized ${rows.length} offline registrations to Supabase database!`,
        success: true
      };
    } catch (err: any) {
      throw new Error(`Failed to sync to Supabase: ${err.message}`);
    }
  }

  // Run Diagnostics / Test Connection
  public async runDiagnostics(): Promise<SupabaseDiagnosticResult> {
    const timestamp = new Date().toISOString();
    const recommendations: string[] = [];

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      recommendations.push(
        'Configure your Supabase Project URL and Anon Public Key in Supabase Settings.'
      );
      recommendations.push(
        'Run the provided SQL Migration Script in your Supabase SQL Editor to create the table.'
      );

      return {
        timestamp,
        supabaseUrl: this.supabaseUrl || 'Not Configured',
        tableName: this.tableName,
        isConnected: false,
        tableExists: false,
        rowCount: this.cachedRecords.length,
        storageMode: 'LOCAL_PERSISTENT_STORE',
        error: 'Supabase URL or API Key is missing. Operating in high-performance local store mode.',
        recommendations
      };
    }

    if (!this.supabaseClient) {
      this.initClient();
    }

    if (!this.supabaseClient) {
      return {
        timestamp,
        supabaseUrl: this.supabaseUrl,
        tableName: this.tableName,
        isConnected: false,
        tableExists: false,
        rowCount: this.cachedRecords.length,
        storageMode: 'LOCAL_PERSISTENT_STORE',
        error: 'Failed to create Supabase client instance with provided credentials.',
        recommendations: ['Verify your Supabase Project URL format (e.g. https://xyz.supabase.co).']
      };
    }

    const startTime = Date.now();
    try {
      const { data, error, count } = await this.supabaseClient
        .from(this.tableName)
        .select('*', { count: 'exact', head: false })
        .limit(5);

      const latencyMs = Date.now() - startTime;

      if (error) {
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          recommendations.push(
            `Table "${this.tableName}" does not exist yet. Run the SQL schema script in your Supabase SQL Editor.`
          );
        } else {
          recommendations.push(`Supabase error: ${error.message}. Check your API keys and Row Level Security (RLS) policies.`);
        }

        return {
          timestamp,
          supabaseUrl: this.supabaseUrl,
          tableName: this.tableName,
          isConnected: true,
          tableExists: false,
          rowCount: this.cachedRecords.length,
          storageMode: 'LOCAL_PERSISTENT_STORE',
          latencyMs,
          error: error.message,
          recommendations
        };
      }

      return {
        timestamp,
        supabaseUrl: this.supabaseUrl,
        tableName: this.tableName,
        isConnected: true,
        tableExists: true,
        rowCount: count ?? (data?.length || 0),
        storageMode: 'SUPABASE_CLOUD',
        latencyMs,
        recommendations: ['Supabase connection is healthy and ready for live synchronization.']
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      recommendations.push('Verify internet connectivity and Supabase project status.');

      return {
        timestamp,
        supabaseUrl: this.supabaseUrl,
        tableName: this.tableName,
        isConnected: false,
        tableExists: false,
        rowCount: this.cachedRecords.length,
        storageMode: 'LOCAL_PERSISTENT_STORE',
        latencyMs,
        error: err.message || 'Connection attempt failed',
        recommendations
      };
    }
  }

  // Diagnostic Test Write
  public async executeTestWrite(): Promise<{ success: boolean; record?: OfflineRecord; error?: string; message: string }> {
    const testId = `TEST-SUPA-${Math.floor(1000 + Math.random() * 9000)}`;
    const testRecord: OfflineRecord = {
      offlineRegistrationId: testId,
      fullName: 'Supabase Diagnostic Tester',
      email: 'test.supabase@airox26.org',
      mobile: '9876543210',
      college: 'AIROX Engineering College',
      department: 'CSE',
      yearSection: 'IV-A',
      event: 'The Final Hire, Web Craft',
      teamName: 'Supabase Sync Test',
      verificationStatus: 'Verified',
      registeredAt: new Date().toISOString(),
      registeredBy: 'System Diagnostic',
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Diagnostic',
      status: 'ACTIVE'
    };

    if (this.supabaseClient) {
      try {
        const payload = this.mapRecordToRow(testRecord);
        const { error } = await this.supabaseClient
          .from(this.tableName)
          .insert(payload);

        if (error) {
          throw new Error(error.message);
        }

        testRecord.rowIndex = this.cachedRecords.length + 1;
        this.cachedRecords.push(testRecord);
        this.saveToDisk();

        return {
          success: true,
          record: testRecord,
          message: `Diagnostic test record (${testId}) successfully written to Supabase table "${this.tableName}"!`
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
          message: `Supabase write failed: ${err.message}`
        };
      }
    }

    testRecord.rowIndex = this.cachedRecords.length + 1;
    this.cachedRecords.push(testRecord);
    this.saveToDisk();

    return {
      success: true,
      record: testRecord,
      message: `Diagnostic record (${testId}) saved to local database (Supabase credentials not configured).`
    };
  }

  // Get SQL Migration Schema for Supabase SQL Editor
  public getSqlMigrationSchema(): string {
    return `-- =========================================================================
-- AIROX'26 SUPABASE DATABASE SCHEMA MIGRATION
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- =========================================================================

-- 1. Create the offline_registrations table
create table if not exists ${this.tableName} (
  id uuid primary key default gen_random_uuid(),
  offline_registration_id text unique not null,
  full_name text not null,
  email text default '',
  mobile text not null,
  college text default '',
  department text default '',
  year_section text default '',
  event text not null,
  team_name text default '',
  verification_status text default 'Verified',
  registered_at timestamptz default now(),
  registered_by text default 'Desk Admin',
  updated_at timestamptz default now(),
  updated_by text default 'Desk Admin',
  status text default 'ACTIVE'
);

-- 2. Create indices for high-speed participant lookup
create index if not exists idx_offline_reg_id on ${this.tableName} (offline_registration_id);
create index if not exists idx_offline_mobile on ${this.tableName} (mobile);
create index if not exists idx_offline_email on ${this.tableName} (email);
create index if not exists idx_offline_event on ${this.tableName} (event);
create index if not exists idx_offline_status on ${this.tableName} (status);

-- 3. Enable Row Level Security (RLS)
alter table ${this.tableName} enable row level security;

-- 4. Create RLS Policies for Anon / Authenticated Access
drop policy if exists "Allow public select" on ${this.tableName};
create policy "Allow public select" on ${this.tableName}
  for select using (true);

drop policy if exists "Allow public insert" on ${this.tableName};
create policy "Allow public insert" on ${this.tableName}
  for insert with check (true);

drop policy if exists "Allow public update" on ${this.tableName};
create policy "Allow public update" on ${this.tableName}
  for update using (true);

drop policy if exists "Allow public delete" on ${this.tableName};
create policy "Allow public delete" on ${this.tableName}
  for delete using (true);

-- 5. Confirmation Query
select count(*) as total_records from ${this.tableName};
`;
  }
}

export const serverSupabaseService = new ServerSupabaseService();
