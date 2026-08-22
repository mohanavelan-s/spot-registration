import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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

export interface OfflineRecord {
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

export interface DiagnosticResult {
  timestamp: string;
  sheetIdConfigured: boolean;
  maskedSheetId: string;
  sheetIdSource: string;
  envStatus: {
    hasAdminEmail: boolean;
    hasServiceAccountEmail: boolean;
    hasServiceAccountKey: boolean;
    hasOfflineSheetId: boolean;
    hasOnlineSheetId: boolean;
  };
  authMethod: string;
  serviceAccountEmail?: string;
  isGoogleAuthReady: boolean;
  apiEnabled: boolean;
  spreadsheetAccessible: boolean;
  spreadsheetTitle?: string;
  availableTabs: string[];
  targetTab: string;
  readSuccess: boolean;
  rowCount?: number;
  writeTestSuccess?: boolean;
  error?: string;
  details?: any;
  recommendations: string[];
}

/**
 * Extracts pure spreadsheet ID from a full Google Sheets URL or raw ID
 */
export function extractSheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

function normalizeHeaderKey(header: string): string {
  return (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildHeaderIndexMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  
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

export function formatTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function generateNextIdFromRecords(records: OfflineRecord[]): string {
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

export class ServerGoogleSheetsService {
  private sheetId: string;
  private onlineSheetId: string;
  private cachedRecords: OfflineRecord[] = [];
  private headers: string[] = OFFLINE_SHEET_HEADERS;
  private cachedOnlineRows: Record<string, any>[] = [];
  private cachedOnlineHeaders: string[] = [];
  private lastFetchTime: number = 0;
  private lastOnlineFetchTime: number = 0;
  private inFlightFetchPromise: Promise<{ records: OfflineRecord[]; headers: string[]; source: string; warning?: string }> | null = null;
  private inFlightOnlineFetchPromise: Promise<any> | null = null;
  private tabNameCache: Map<string, { name: string; expiry: number }> = new Map();
  private authClient: any = null;
  private isGoogleAuthReady: boolean = false;
  private authMethodName: string = 'None';
  private serviceAccountEmail: string = '';
  private resolvedTabName: string = 'Sheet1';
  private storageFilePath: string;

  constructor() {
    this.sheetId = extractSheetId(process.env.OFFLINE_REGISTRATION_SHEET_ID || '');
    this.onlineSheetId = extractSheetId(process.env.ONLINE_REGISTRATION_SHEET_ID || '');
    this.storageFilePath = path.join(process.cwd(), 'server', 'offline_registrations_store.json');
    this.loadFromDisk();
    this.initGoogleAuth();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.records)) {
          this.cachedRecords = parsed.records;
        }
        if (Array.isArray(parsed.headers) && parsed.headers.length > 0) {
          this.headers = parsed.headers;
        }
        if (Array.isArray(parsed.cachedOnlineRows)) {
          this.cachedOnlineRows = parsed.cachedOnlineRows;
        }
        if (Array.isArray(parsed.cachedOnlineHeaders)) {
          this.cachedOnlineHeaders = parsed.cachedOnlineHeaders;
        }
        if (parsed.sheetId && !this.sheetId) {
          this.sheetId = parsed.sheetId;
        }
      }
    } catch (err: any) {
      console.warn('[GoogleSheets:Store] Failed to load local backup file:', err?.message);
    }
  }

  private saveToDisk() {
    try {
      const data = {
        sheetId: this.sheetId,
        headers: this.headers,
        records: this.cachedRecords,
        cachedOnlineRows: this.cachedOnlineRows,
        cachedOnlineHeaders: this.cachedOnlineHeaders,
        updatedAt: new Date().toISOString()
      };
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[GoogleSheets:Store] Failed to save to local backup file:', err?.message);
    }
  }

  public getCachedRecords(): OfflineRecord[] {
    return this.cachedRecords;
  }

  public getHeaders(): string[] {
    return this.headers;
  }

  public getSheetId(): string {
    return this.sheetId || extractSheetId(process.env.OFFLINE_REGISTRATION_SHEET_ID || '');
  }

  public setSheetId(newId: string) {
    this.sheetId = extractSheetId(newId);
    process.env.OFFLINE_REGISTRATION_SHEET_ID = this.sheetId;
    this.tabNameCache.delete(this.sheetId);
    this.lastFetchTime = 0;
    this.saveToDisk();
  }

  public getOnlineSheetId(): string {
    return this.onlineSheetId || extractSheetId(process.env.ONLINE_REGISTRATION_SHEET_ID || '');
  }

  public setOnlineSheetId(newId: string) {
    this.onlineSheetId = extractSheetId(newId);
    process.env.ONLINE_REGISTRATION_SHEET_ID = this.onlineSheetId;
    this.tabNameCache.delete(this.onlineSheetId);
    this.lastOnlineFetchTime = 0;
    this.saveToDisk();
  }

  public isAuthConfigured(): boolean {
    return this.isGoogleAuthReady;
  }

  /**
   * Helper to execute operations with exponential backoff on 429 Rate Limits
   */
  private async executeWithRetry<T = any>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    baseDelayMs: number = 1200
  ): Promise<T> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await operation();
      } catch (err: any) {
        const msg = err?.message || String(err);
        const statusCode = err?.code || err?.status || (err?.response && err.response.status);
        const isRateLimit = statusCode === 429 || msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED');

        if (isRateLimit && attempt < maxRetries) {
          attempt++;
          const waitTime = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 300;
          console.warn(`[GoogleSheets:RateLimit] 429 Quota Exceeded. Backing off ${Math.round(waitTime)}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise(res => setTimeout(res, waitTime));
        } else {
          throw err;
        }
      }
    }
    throw new Error('Operation failed after retries.');
  }

  /**
   * READ: Fetches online registrations directly from Google Sheets (ONLINE_REGISTRATION_SHEET_ID)
   */
  public async fetchOnlineRegistrations(forceFresh: boolean = false): Promise<{
    rows: Record<string, any>[];
    headers: string[];
    source: 'GOOGLE_SHEETS' | 'UNCONFIGURED' | 'FALLBACK';
    count: number;
    sheetId: string;
    warning?: string;
  }> {
    const activeOnlineSheetId = this.getOnlineSheetId();

    if (!activeOnlineSheetId) {
      return {
        rows: [],
        headers: [],
        source: 'UNCONFIGURED',
        count: 0,
        sheetId: '',
        warning: 'ONLINE_REGISTRATION_SHEET_ID is not configured. Online participants are sourced from loaded symposium file/dataset.'
      };
    }

    // Return in-memory cache if fresh (within 30 seconds)
    const now = Date.now();
    if (!forceFresh && this.cachedOnlineRows.length > 0 && now - this.lastOnlineFetchTime < 30000) {
      return {
        rows: this.cachedOnlineRows,
        headers: this.cachedOnlineHeaders,
        source: 'GOOGLE_SHEETS',
        count: this.cachedOnlineRows.length,
        sheetId: activeOnlineSheetId
      };
    }

    // Deduplicate concurrent in-flight calls
    if (this.inFlightOnlineFetchPromise) {
      return this.inFlightOnlineFetchPromise;
    }

    this.inFlightOnlineFetchPromise = (async () => {
      try {
        const sheets = this.getSheetsClient();
        const tabName = await this.resolveWorksheetTab(sheets, activeOnlineSheetId);

        console.log(`[GoogleSheets:ONLINE_READ] Reading rows from online sheet '${activeOnlineSheetId}', tab '${tabName}'!A1:Z`);

        const res = await this.executeWithRetry(() =>
          sheets.spreadsheets.values.get({
            spreadsheetId: activeOnlineSheetId,
            range: `'${tabName}'!A1:Z`
          })
        );

        const rows = res.data.values || [];
        if (rows.length === 0) {
          this.cachedOnlineRows = [];
          this.cachedOnlineHeaders = [];
          this.lastOnlineFetchTime = Date.now();
          return {
            rows: [],
            headers: [],
            source: 'GOOGLE_SHEETS' as const,
            count: 0,
            sheetId: activeOnlineSheetId
          };
        }

        const rawHeaders = (rows[0] as string[]).map(h => (h || '').trim()).filter(Boolean);
        const parsedRows: Record<string, any>[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as string[];
          if (!row || row.length === 0 || !row.some(cell => cell && String(cell).trim())) {
            continue;
          }

          const rowObj: Record<string, any> = {};
          rawHeaders.forEach((header, colIdx) => {
            rowObj[header] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
          });

          parsedRows.push(rowObj);
        }

        this.cachedOnlineRows = parsedRows;
        this.cachedOnlineHeaders = rawHeaders;
        this.lastOnlineFetchTime = Date.now();
        this.saveToDisk();

        console.log(`[GoogleSheets:ONLINE_READ] Success: Loaded ${parsedRows.length} online registration rows from Google Sheet.`);
        return {
          rows: parsedRows,
          headers: rawHeaders,
          source: 'GOOGLE_SHEETS' as const,
          count: parsedRows.length,
          sheetId: activeOnlineSheetId
        };
      } catch (err: any) {
        const formattedErr = this.formatApiError(err, 'ONLINE_READ');
        const isQuota = formattedErr.message.includes('Rate limit') || formattedErr.message.includes('429') || formattedErr.message.includes('Quota exceeded');
        console.warn('[GoogleSheets:ONLINE_READ] Notice reading online Google Sheet:', formattedErr.message);

        // If cached rows exist, return them safely
        if (this.cachedOnlineRows.length > 0) {
          return {
            rows: this.cachedOnlineRows,
            headers: this.cachedOnlineHeaders,
            source: 'GOOGLE_SHEETS' as const,
            count: this.cachedOnlineRows.length,
            sheetId: activeOnlineSheetId,
            warning: isQuota ? 'Google Sheets rate limit reached (429). Using cached records.' : formattedErr.message
          };
        }

        return {
          rows: [],
          headers: [],
          source: 'FALLBACK' as const,
          count: 0,
          sheetId: activeOnlineSheetId,
          warning: formattedErr.message
        };
      } finally {
        this.inFlightOnlineFetchPromise = null;
      }
    })();

    return this.inFlightOnlineFetchPromise;
  }

  public getServiceAccountEmail(): string {
    return this.serviceAccountEmail;
  }

  public getAuthMethod(): string {
    return this.authMethodName;
  }

  /**
   * Initializes JWT Service Account Authentication using GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY
   */
  public initGoogleAuth(): boolean {
    try {
      // Refresh Sheet ID from env if updated
      if (process.env.OFFLINE_REGISTRATION_SHEET_ID) {
        this.sheetId = extractSheetId(process.env.OFFLINE_REGISTRATION_SHEET_ID);
      }

      let clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
      let rawKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();

      // Strip surrounding quotes if present from user paste
      if ((clientEmail.startsWith('"') && clientEmail.endsWith('"')) || (clientEmail.startsWith("'") && clientEmail.endsWith("'"))) {
        clientEmail = clientEmail.slice(1, -1).trim();
      }
      if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
        rawKey = rawKey.slice(1, -1).trim();
      }

      if (rawKey) {
        let privateKey = rawKey;

        // Check if rawKey is full service account JSON or base64 JSON
        if (rawKey.startsWith('{') || rawKey.startsWith('eyJ')) {
          try {
            const parsed = rawKey.startsWith('{')
              ? JSON.parse(rawKey)
              : JSON.parse(Buffer.from(rawKey, 'base64').toString('utf-8'));
            if (parsed.private_key) {
              privateKey = parsed.private_key;
            }
            if (parsed.client_email && !clientEmail) {
              clientEmail = parsed.client_email;
            }
          } catch {
            // treat rawKey as raw private key string
          }
        }

        // Normalize escaped newlines and line breaks
        const formattedKey = privateKey
          .replace(/\\r\\n/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\r\n/g, '\n');

        if (clientEmail && formattedKey) {
          const auth = new google.auth.JWT({
            email: clientEmail,
            key: formattedKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
          });

          this.authClient = auth;
          this.isGoogleAuthReady = true;
          this.authMethodName = 'Google Service Account (GOOGLE_SERVICE_ACCOUNT_KEY)';
          this.serviceAccountEmail = clientEmail;
          console.log(`[GoogleSheets:Auth] Initialized Google Service Account (email configured: true, key length: ${formattedKey.length} chars)`);
          return true;
        }
      }

      // Check Application Default Credentials fallback
      try {
        const adcAuth = new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        this.authClient = adcAuth;
        this.isGoogleAuthReady = true;
        this.authMethodName = 'Server Application Default Credentials (ADC)';
        this.serviceAccountEmail = clientEmail || 'GCP Default Service Account';
        console.log('[GoogleSheets:Auth] Initialized with Server Application Default Credentials');
        return true;
      } catch {
        // No ADC
      }

      this.isGoogleAuthReady = false;
      this.authMethodName = 'Credentials Missing / Incomplete';
      return false;
    } catch (err: any) {
      this.isGoogleAuthReady = false;
      this.authMethodName = 'Auth Initialization Error';
      console.error('[GoogleSheets:Auth] Initialization error:', err?.message);
      return false;
    }
  }

  /**
   * Helper to get Google Sheets client using server-side credentials only
   */
  public getSheetsClient() {
    this.initGoogleAuth();

    if (!this.authClient) {
      throw new Error('Google Sheets credentials are not configured. Please provide GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY in environment variables.');
    }
    return google.sheets({ version: 'v4', auth: this.authClient });
  }

  private formatApiError(err: any, operation: string): Error {
    if (err instanceof Error && (err.message.includes('Permission Denied') || err.message.includes('Spreadsheet Not Found') || err.message.includes('Google Sheets API is disabled') || err.message.includes('Rate limit exceeded'))) {
      return err;
    }

    const msg = err?.message || String(err);
    const statusCode = err?.code || err?.status || (err?.response && err.response.status);

    if (statusCode === 429 || msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
      console.warn(`[GoogleSheets:${operation}] Rate limit notice (429): Google Sheets read/write quota reached.`);
      return new Error('Rate limit exceeded (429): Google Sheets API request quota temporarily reached. Local cached records are preserved.');
    }

    if (msg.includes('caller does not have permission') || statusCode === 403 || msg.includes('The caller does not have permission')) {
      const email = this.serviceAccountEmail || 'the backend service account';
      console.warn(`[GoogleSheets:${operation}] Access note (403): Sheet is not shared with ${email}`);
      return new Error(`Permission Denied (403): The Google Spreadsheet is not shared with ${email}. Please open the Google Sheet, click "Share", and grant "Editor" access to: ${email}`);
    }

    console.warn(`[GoogleSheets:${operation}] Status: ${statusCode || 'N/A'}, message: ${msg}`);

    if (msg.includes('disabled') || msg.includes('has not been used') || msg.includes('SERVICE_DISABLED')) {
      return new Error('Google Sheets API is disabled in your Google Cloud Project. Please enable "Google Sheets API" in the GCP Console.');
    }
    if (statusCode === 404 || msg.includes('not found') || msg.includes('Requested entity was not found')) {
      return new Error(`Spreadsheet Not Found (404): Could not find Google Spreadsheet with ID "${this.getSheetId()}". Please verify OFFLINE_REGISTRATION_SHEET_ID.`);
    }
    if (msg.includes('invalid_grant') || msg.includes('DECODER_ERROR') || msg.includes('PEM')) {
      return new Error('Google Authentication Failed: The private key format in GOOGLE_SERVICE_ACCOUNT_KEY is invalid or expired.');
    }
    return new Error(`Google Sheets ${operation} Error (${statusCode || 'API'}): ${msg}`);
  }

  /**
   * Resolves the target worksheet tab name by inspecting spreadsheet metadata (with 1-hour in-memory caching)
   */
  public async resolveWorksheetTab(sheetsClient: any, targetSheetId?: string): Promise<string> {
    const activeSheetId = targetSheetId || this.getSheetId();
    if (!activeSheetId) {
      throw new Error('No Google Spreadsheet ID configured. Please configure OFFLINE_REGISTRATION_SHEET_ID.');
    }

    // Check cached tab name
    const cached = this.tabNameCache.get(activeSheetId);
    if (cached && Date.now() < cached.expiry) {
      return cached.name;
    }

    try {
      const meta = await this.executeWithRetry(() =>
        sheetsClient.spreadsheets.get({
          spreadsheetId: activeSheetId
        })
      );

      const sheetTabs: string[] = (meta.data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);

      if (sheetTabs.length === 0) {
        throw new Error(`The Google Spreadsheet (${activeSheetId}) contains no worksheet tabs.`);
      }

      let resolvedTab = sheetTabs[0];

      // 1. Exact match 'OfflineRegistrations' or 'Offline Registrations'
      const preferredTab = sheetTabs.find((t: string) => {
        const norm = t.toLowerCase().replace(/[^a-z0-9]/g, '');
        return norm === 'offlineregistrations' || norm === 'offlineregistration';
      });

      if (preferredTab) {
        resolvedTab = preferredTab;
      } else {
        // 2. Contains 'offline' or 'registration'
        const regTab = sheetTabs.find((t: string) => {
          const norm = t.toLowerCase();
          return norm.includes('offline') || norm.includes('registration');
        });
        if (regTab) {
          resolvedTab = regTab;
        }
      }

      this.resolvedTabName = resolvedTab;
      // Cache resolved tab name for 1 hour to save API reads
      this.tabNameCache.set(activeSheetId, { name: resolvedTab, expiry: Date.now() + 3600_000 });
      return resolvedTab;
    } catch (err: any) {
      // If we already have a resolved tab name from earlier, use it as fallback
      if (this.resolvedTabName) {
        console.warn(`[GoogleSheets:Tab] Using previous tab '${this.resolvedTabName}' due to: ${err?.message}`);
        return this.resolvedTabName;
      }
      throw this.formatApiError(err, 'RESOLVE_TAB');
    }
  }

  /**
   * Ensures the header row is present in the target worksheet tab
   */
  public async ensureHeaders(sheetsClient: any, tabName: string, targetSheetId?: string): Promise<string[]> {
    const activeSheetId = targetSheetId || this.getSheetId();
    const res = await this.executeWithRetry(() =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: activeSheetId,
        range: `'${tabName}'!A1:Z1`
      })
    );

    const rows = res.data.values || [];
    if (rows.length === 0 || rows[0].length === 0) {
      console.log(`[GoogleSheets:INIT] Tab '${tabName}' has no headers. Initializing standard headers...`);
      await this.executeWithRetry(() =>
        sheetsClient.spreadsheets.values.update({
          spreadsheetId: activeSheetId,
          range: `'${tabName}'!A1:O1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [OFFLINE_SHEET_HEADERS]
          }
        })
      );
      return OFFLINE_SHEET_HEADERS;
    }

    return rows[0] as string[];
  }

  /**
   * Finds the exact 1-indexed row number of a record in Google Sheets by its stable Offline Registration ID
   */
  public async findRowIndexById(
    sheetsClient: any,
    tabName: string,
    id: string
  ): Promise<{ rowIndex: number; headers: string[]; currentRow: string[] }> {
    const activeSheetId = this.getSheetId();
    const res = await this.executeWithRetry(() =>
      sheetsClient.spreadsheets.values.get({
        spreadsheetId: activeSheetId,
        range: `'${tabName}'!A1:Z`
      })
    );

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      throw new Error(`Google Sheet tab '${tabName}' contains no registration records to match ID "${id}".`);
    }

    const headers = rows[0] as string[];
    const headerMap = buildHeaderIndexMap(headers);
    const idColumnIndex = headerMap['offlineRegistrationId'] !== undefined ? headerMap['offlineRegistrationId'] : 0;

    const cleanTargetId = id.trim().toLowerCase();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as string[];
      const cellVal = (row[idColumnIndex] || '').trim().toLowerCase();
      if (cellVal === cleanTargetId) {
        return {
          rowIndex: i + 1, // 1-based row index for Google Sheets A1 notation
          headers,
          currentRow: row
        };
      }
    }

    throw new Error(`Record with Offline Registration ID "${id}" was not found in Google Sheet tab '${tabName}'.`);
  }

  /**
   * READ: Fetches all registrations directly from Google Sheets (with in-memory cache and 429 quota resilience)
   */
  public async fetchRegistrations(forceFresh: boolean = false): Promise<{ records: OfflineRecord[]; headers: string[]; source: string; warning?: string }> {
    const activeSheetId = this.getSheetId();

    if (!activeSheetId) {
      if (this.cachedRecords.length > 0) {
        return { records: this.cachedRecords, headers: this.headers, source: 'LOCAL_BACKUP' };
      }
      throw new Error('OFFLINE_REGISTRATION_SHEET_ID is not configured. Please set the Sheet ID in environment variables or Sheet Settings.');
    }

    // Return in-memory cache if fresh (within 15 seconds) and not forced
    const now = Date.now();
    if (!forceFresh && this.cachedRecords.length > 0 && now - this.lastFetchTime < 15000) {
      return { records: this.cachedRecords, headers: this.headers, source: 'GOOGLE_SHEETS' };
    }

    // Deduplicate concurrent in-flight calls
    if (this.inFlightFetchPromise) {
      return this.inFlightFetchPromise;
    }

    this.inFlightFetchPromise = (async () => {
      try {
        const sheets = this.getSheetsClient();
        const tabName = await this.resolveWorksheetTab(sheets, activeSheetId);

        console.log(`[GoogleSheets:READ] Reading rows from '${tabName}'!A1:Z`);

        const res = await this.executeWithRetry(() =>
          sheets.spreadsheets.values.get({
            spreadsheetId: activeSheetId,
            range: `'${tabName}'!A1:Z`
          })
        );

        const rows = res.data.values || [];
        if (rows.length === 0) {
          await this.ensureHeaders(sheets, tabName, activeSheetId);
          this.cachedRecords = [];
          this.lastFetchTime = Date.now();
          this.saveToDisk();
          return { records: [], headers: OFFLINE_SHEET_HEADERS, source: 'GOOGLE_SHEETS' };
        }

        const rawHeaders = rows[0] as string[];
        this.headers = rawHeaders;
        const headerMap = buildHeaderIndexMap(rawHeaders);
        const records: OfflineRecord[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as string[];
          if (!row || row.length === 0 || !row.some(cell => cell && String(cell).trim())) {
            continue;
          }

          const getVal = (field: string): string => {
            const idx = headerMap[field];
            if (idx !== undefined && idx < row.length) {
              return String(row[idx] || '').trim();
            }
            return '';
          };

          const id = getVal('offlineRegistrationId') || `OFF-AIROX26-${String(i).padStart(3, '0')}`;
          const statusRaw = getVal('status').toUpperCase();
          const status = statusRaw === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE';
          const verRaw = getVal('verificationStatus');
          const verificationStatus: 'Verified' | 'Pending' | 'Rejected' =
            verRaw === 'Pending' ? 'Pending' : verRaw === 'Rejected' ? 'Rejected' : 'Verified';

          records.push({
            rowIndex: i + 1,
            offlineRegistrationId: id,
            fullName: getVal('fullName'),
            email: getVal('email'),
            mobile: getVal('mobile'),
            college: getVal('college'),
            department: getVal('department'),
            yearSection: getVal('yearSection'),
            event: getVal('event'),
            teamName: getVal('teamName'),
            verificationStatus,
            registeredAt: getVal('registeredAt'),
            registeredBy: getVal('registeredBy'),
            updatedAt: getVal('updatedAt'),
            updatedBy: getVal('updatedBy'),
            status
          });
        }

        this.cachedRecords = records;
        this.lastFetchTime = Date.now();
        this.saveToDisk();
        console.log(`[GoogleSheets:READ] Success: Loaded ${records.length} records from Google Sheet tab '${tabName}'.`);
        return { records, headers: rawHeaders, source: 'GOOGLE_SHEETS' };
      } catch (err: any) {
        const formattedErr = this.formatApiError(err, 'READ');
        console.warn('[GoogleSheets:READ] Warning reading offline sheet:', formattedErr.message);

        // If we have cached records on disk/memory, safely return them instead of crashing
        if (this.cachedRecords.length > 0) {
          const isQuota = formattedErr.message.includes('Rate limit') || formattedErr.message.includes('429') || formattedErr.message.includes('Quota exceeded');
          return {
            records: this.cachedRecords,
            headers: this.headers,
            source: 'LOCAL_BACKUP',
            warning: isQuota ? 'Google Sheets rate limit reached (429). Using local cached records.' : formattedErr.message
          };
        }

        throw formattedErr;
      } finally {
        this.inFlightFetchPromise = null;
      }
    })();

    return this.inFlightFetchPromise;
  }

  /**
   * CREATE: Appends a new offline registration row to Google Sheets.
   * Only returns success after Google Sheets API confirms write.
   */
  public async createRegistration(
    data: Partial<OfflineRecord>,
    coordinatorName: string = 'Desk Admin'
  ): Promise<OfflineRecord> {
    const activeSheetId = this.getSheetId();

    console.log(`[GoogleSheets:CREATE] Starting registration write for "${data.fullName}" (Mobile: ${data.mobile})`);

    if (!activeSheetId) {
      throw new Error('OFFLINE_REGISTRATION_SHEET_ID is not configured. Please set the Sheet ID in environment variables or Sheet Settings.');
    }

    try {
      const sheetsClient = this.getSheetsClient();
      const tabName = await this.resolveWorksheetTab(sheetsClient, activeSheetId);
      const currentHeaders = await this.ensureHeaders(sheetsClient, tabName, activeSheetId);

      // Fetch latest rows to ensure strict monotonic ID generation
      const fetchRes = await this.executeWithRetry(() =>
        sheetsClient.spreadsheets.values.get({
          spreadsheetId: activeSheetId,
          range: `'${tabName}'!A1:Z`
        })
      );

      const existingRows = fetchRes.data.values || [];
      const headerMap = buildHeaderIndexMap(currentHeaders.length > 0 ? currentHeaders : OFFLINE_SHEET_HEADERS);
      const idIdx = headerMap['offlineRegistrationId'] !== undefined ? headerMap['offlineRegistrationId'] : 0;

      let maxSeq = 0;
      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i];
        if (row && row[idIdx]) {
          const match = String(row[idIdx]).match(/OFF-AIROX26-(\d+)/i);
          if (match && match[1]) {
            const seq = parseInt(match[1], 10);
            if (!isNaN(seq) && seq > maxSeq) {
              maxSeq = seq;
            }
          }
        }
      }

      const nextId = `OFF-AIROX26-${String(maxSeq + 1).padStart(3, '0')}`;
      const now = formatTimestamp();

      const newRecord: OfflineRecord = {
        rowIndex: existingRows.length + 1,
        offlineRegistrationId: nextId,
        fullName: (data.fullName || '').trim(),
        email: (data.email || '').trim(),
        mobile: (data.mobile || '').trim(),
        college: (data.college || '').trim(),
        department: (data.department || '').trim(),
        yearSection: (data.yearSection || '').trim(),
        event: (data.event || '').trim(),
        teamName: (data.teamName || '').trim(),
        verificationStatus: data.verificationStatus || 'Verified',
        registeredAt: now,
        registeredBy: (data.registeredBy || coordinatorName || 'Desk Admin').trim(),
        updatedAt: '',
        updatedBy: '',
        status: 'ACTIVE'
      };

      const targetHeaders = currentHeaders.length > 0 ? currentHeaders : OFFLINE_SHEET_HEADERS;
      const rowValues = new Array(targetHeaders.length).fill('');

      const setField = (field: string, val: string) => {
        const idx = headerMap[field];
        if (idx !== undefined && idx < rowValues.length) {
          rowValues[idx] = val;
        }
      };

      setField('offlineRegistrationId', newRecord.offlineRegistrationId);
      setField('fullName', newRecord.fullName);
      setField('email', newRecord.email);
      setField('mobile', newRecord.mobile);
      setField('college', newRecord.college);
      setField('department', newRecord.department);
      setField('yearSection', newRecord.yearSection);
      setField('event', newRecord.event);
      setField('teamName', newRecord.teamName);
      setField('verificationStatus', newRecord.verificationStatus);
      setField('registeredAt', newRecord.registeredAt);
      setField('registeredBy', newRecord.registeredBy);
      setField('updatedAt', newRecord.updatedAt);
      setField('updatedBy', newRecord.updatedBy);
      setField('status', newRecord.status);

      console.log(`[GoogleSheets:CREATE] Appending row to tab '${tabName}' for ID ${newRecord.offlineRegistrationId}`);

      const appendResult = await this.executeWithRetry(() =>
        sheetsClient.spreadsheets.values.append({
          spreadsheetId: activeSheetId,
          range: `'${tabName}'!A:Z`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [rowValues]
          }
        })
      );

      console.log(`[GoogleSheets:CREATE] Success: Confirmed write to Google Sheet (${appendResult.data.updates?.updatedRange || 'appended'})`);

      // Update in-memory cache and backup disk file after verified write
      this.cachedRecords.push(newRecord);
      this.lastFetchTime = Date.now();
      this.saveToDisk();

      return newRecord;
    } catch (err: any) {
      throw this.formatApiError(err, 'CREATE');
    }
  }

  /**
   * UPDATE: Modifies the exact row in Google Sheets matched by stable Offline Registration ID.
   */
  public async updateRegistration(
    id: string,
    updates: Partial<OfflineRecord>,
    coordinatorName: string = 'Desk Admin'
  ): Promise<OfflineRecord> {
    const activeSheetId = this.getSheetId();

    console.log(`[GoogleSheets:UPDATE] Locating row for ID "${id}"`);

    if (!activeSheetId) {
      throw new Error('OFFLINE_REGISTRATION_SHEET_ID is not configured. Please set the Sheet ID in environment variables or Sheet Settings.');
    }

    try {
      const sheetsClient = this.getSheetsClient();
      const tabName = await this.resolveWorksheetTab(sheetsClient, activeSheetId);

      // Locate exact row index by stable ID in Google Sheet
      const { rowIndex: targetRowIndex, headers: currentHeaders, currentRow } = await this.findRowIndexById(
        sheetsClient,
        tabName,
        id
      );

      const headerMap = buildHeaderIndexMap(currentHeaders.length > 0 ? currentHeaders : OFFLINE_SHEET_HEADERS);
      const targetHeaders = currentHeaders.length > 0 ? currentHeaders : OFFLINE_SHEET_HEADERS;
      const now = formatTimestamp();

      const getExisting = (field: string): string => {
        const idx = headerMap[field];
        if (idx !== undefined && idx < currentRow.length) {
          return currentRow[idx] || '';
        }
        return '';
      };

      const updatedRecord: OfflineRecord = {
        rowIndex: targetRowIndex,
        offlineRegistrationId: id, // Immutable ID
        fullName: updates.fullName !== undefined ? updates.fullName.trim() : getExisting('fullName'),
        email: updates.email !== undefined ? updates.email.trim() : getExisting('email'),
        mobile: updates.mobile !== undefined ? updates.mobile.trim() : getExisting('mobile'),
        college: updates.college !== undefined ? updates.college.trim() : getExisting('college'),
        department: updates.department !== undefined ? updates.department.trim() : getExisting('department'),
        yearSection: updates.yearSection !== undefined ? updates.yearSection.trim() : getExisting('yearSection'),
        event: updates.event !== undefined ? updates.event.trim() : getExisting('event'),
        teamName: updates.teamName !== undefined ? updates.teamName.trim() : getExisting('teamName'),
        verificationStatus: updates.verificationStatus || (getExisting('verificationStatus') as any) || 'Verified',
        registeredAt: getExisting('registeredAt') || now,
        registeredBy: getExisting('registeredBy') || coordinatorName || 'Desk Admin',
        updatedAt: now,
        updatedBy: (updates.updatedBy || coordinatorName || 'Desk Admin').trim(),
        status: updates.status || (getExisting('status') as any) || 'ACTIVE'
      };

      const rowValues = new Array(targetHeaders.length).fill('');

      const setField = (field: string, val: string) => {
        const idx = headerMap[field];
        if (idx !== undefined && idx < rowValues.length) {
          rowValues[idx] = val;
        }
      };

      setField('offlineRegistrationId', updatedRecord.offlineRegistrationId);
      setField('fullName', updatedRecord.fullName);
      setField('email', updatedRecord.email);
      setField('mobile', updatedRecord.mobile);
      setField('college', updatedRecord.college);
      setField('department', updatedRecord.department);
      setField('yearSection', updatedRecord.yearSection);
      setField('event', updatedRecord.event);
      setField('teamName', updatedRecord.teamName);
      setField('verificationStatus', updatedRecord.verificationStatus);
      setField('registeredAt', updatedRecord.registeredAt);
      setField('registeredBy', updatedRecord.registeredBy);
      setField('updatedAt', updatedRecord.updatedAt);
      setField('updatedBy', updatedRecord.updatedBy);
      setField('status', updatedRecord.status);

      console.log(`[GoogleSheets:UPDATE] Overwriting row ${targetRowIndex} in tab '${tabName}' for ID ${id}`);

      await this.executeWithRetry(() =>
        sheetsClient.spreadsheets.values.update({
          spreadsheetId: activeSheetId,
          range: `'${tabName}'!A${targetRowIndex}:O${targetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [rowValues]
          }
        })
      );

      console.log(`[GoogleSheets:UPDATE] Success: Confirmed update in Google Sheet row ${targetRowIndex} for ID ${id}`);

      // Update in memory cache and disk store
      const localIdx = this.cachedRecords.findIndex(r => r.offlineRegistrationId.toLowerCase() === id.toLowerCase());
      if (localIdx >= 0) {
        this.cachedRecords[localIdx] = updatedRecord;
      } else {
        this.cachedRecords.push(updatedRecord);
      }
      this.lastFetchTime = Date.now();
      this.saveToDisk();

      return updatedRecord;
    } catch (err: any) {
      throw this.formatApiError(err, 'UPDATE');
    }
  }

  /**
   * CANCEL: Soft-deletes a registration in Google Sheets (sets Status = CANCELLED)
   */
  public async cancelRegistration(id: string, coordinatorName: string = 'Desk Admin'): Promise<OfflineRecord> {
    console.log(`[GoogleSheets:CANCEL] Marking registration ${id} as CANCELLED`);
    return this.updateRegistration(id, { status: 'CANCELLED' }, coordinatorName);
  }

  /**
   * RESTORE: Sets Status back to ACTIVE in Google Sheets
   */
  public async restoreRegistration(id: string, coordinatorName: string = 'Desk Admin'): Promise<OfflineRecord> {
    console.log(`[GoogleSheets:RESTORE] Restoring registration ${id} to ACTIVE`);
    return this.updateRegistration(id, { status: 'ACTIVE' }, coordinatorName);
  }

  /**
   * Comprehensive Diagnostics Operation (Safe, non-sensitive reporting)
   */
  public async runDiagnostics(): Promise<DiagnosticResult> {
    this.initGoogleAuth();
    const activeSheetId = this.getSheetId();

    const maskedSheetId = activeSheetId
      ? `${activeSheetId.slice(0, 6)}...${activeSheetId.slice(-4)}`
      : 'Not Set';

    const result: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      sheetIdConfigured: Boolean(activeSheetId),
      maskedSheetId,
      sheetIdSource: process.env.OFFLINE_REGISTRATION_SHEET_ID ? 'process.env.OFFLINE_REGISTRATION_SHEET_ID' : 'Manual / Not Set',
      envStatus: {
        hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
        hasServiceAccountEmail: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
        hasServiceAccountKey: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
        hasOfflineSheetId: Boolean(process.env.OFFLINE_REGISTRATION_SHEET_ID),
        hasOnlineSheetId: Boolean(process.env.ONLINE_REGISTRATION_SHEET_ID)
      },
      authMethod: this.authMethodName,
      serviceAccountEmail: this.serviceAccountEmail,
      isGoogleAuthReady: this.isGoogleAuthReady,
      apiEnabled: false,
      spreadsheetAccessible: false,
      availableTabs: [],
      targetTab: '',
      readSuccess: false,
      recommendations: []
    };

    if (!activeSheetId) {
      result.error = 'OFFLINE_REGISTRATION_SHEET_ID is not configured.';
      result.recommendations.push('Set OFFLINE_REGISTRATION_SHEET_ID in environment variables or Sheet Settings.');
      return result;
    }

    if (!this.isGoogleAuthReady) {
      result.error = 'Google Service Account credentials are not ready.';
      result.recommendations.push('Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY in environment variables.');
      return result;
    }

    try {
      const sheets = this.getSheetsClient();
      
      // 1. Test Spreadsheet metadata retrieval
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: activeSheetId
      });

      result.apiEnabled = true;
      result.spreadsheetAccessible = true;
      result.spreadsheetTitle = meta.data.properties?.title;
      result.availableTabs = (meta.data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
      result.targetTab = await this.resolveWorksheetTab(sheets, activeSheetId);

      // 2. Test Read
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: activeSheetId,
        range: `'${result.targetTab}'!A1:Z`
      });

      result.readSuccess = true;
      result.rowCount = (readRes.data.values || []).length;
    } catch (err: any) {
      const formatted = this.formatApiError(err, 'DIAGNOSTICS');
      result.error = formatted.message;
      result.details = err.response?.data?.error || err.message;

      if (err.message?.includes('disabled') || err.message?.includes('has not been used')) {
        result.apiEnabled = false;
        result.recommendations.push('The Google Sheets API is currently disabled in your GCP Project. Please enable Google Sheets API in GCP Console.');
      } else if (err.message?.includes('caller does not have permission') || err.code === 403) {
        result.recommendations.push(
          `Permission Denied (403): The spreadsheet is not shared with ${this.serviceAccountEmail}. Please open the spreadsheet, click Share, and grant 'Editor' access to: ${this.serviceAccountEmail}`
        );
      } else if (err.code === 404 || err.message?.includes('not found')) {
        result.recommendations.push(`Spreadsheet ID "${maskedSheetId}" was not found. Please verify the ID from docs.google.com/spreadsheets/d/[ID]/edit.`);
      }
    }

    return result;
  }

  /**
   * Diagnostic Test-Write: Appends and verifies a test record
   */
  public async executeTestWrite(): Promise<{ success: boolean; record?: OfflineRecord; error?: string; message: string }> {
    try {
      console.log('[GoogleSheets:Diagnostic] Executing TEST-AIROX26 write test...');
      const testRecord = await this.createRegistration(
        {
          fullName: 'TEST PARTICIPANT 001',
          email: 'test001@airox26.edu',
          mobile: '9999900001',
          college: 'AIROX Engineering College',
          department: 'Robotics & AI',
          yearSection: 'IV / A',
          event: 'The Final Hire, AD SHOT',
          teamName: 'TestAlpha',
          verificationStatus: 'Verified',
          registeredBy: 'System Diagnostic Test'
        },
        'System Diagnostic Test'
      );

      return {
        success: true,
        record: testRecord,
        message: `Successfully created and verified test record "${testRecord.offlineRegistrationId}" in Google Sheets.`
      };
    } catch (err: any) {
      console.error('[GoogleSheets:Diagnostic] Test write failed:', err);
      return {
        success: false,
        error: err.message || 'Google Sheets write test failed.',
        message: 'Unable to write test record to Google Sheets.'
      };
    }
  }
}

export const serverSheetsService = new ServerGoogleSheetsService();
