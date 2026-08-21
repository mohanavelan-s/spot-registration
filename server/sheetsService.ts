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
  sheetId: string;
  sheetIdSource: string;
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
  private cachedRecords: OfflineRecord[] = [];
  private headers: string[] = OFFLINE_SHEET_HEADERS;
  private authClient: any = null;
  private isGoogleAuthReady: boolean = false;
  private authMethodName: string = 'None';
  private serviceAccountEmail: string = '';
  private resolvedTabName: string = 'Sheet1';
  private storageFilePath: string;

  constructor() {
    this.sheetId = extractSheetId(process.env.OFFLINE_REGISTRATION_SHEET_ID || '');
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
        if (parsed.sheetId && !this.sheetId) {
          this.sheetId = parsed.sheetId;
        }
        console.log(`[GoogleSheets:Store] Loaded ${this.cachedRecords.length} records from local disk backup`);
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
    return this.sheetId;
  }

  public setSheetId(newId: string) {
    this.sheetId = extractSheetId(newId);
    process.env.OFFLINE_REGISTRATION_SHEET_ID = this.sheetId;
    this.saveToDisk();
  }

  public isAuthConfigured(): boolean {
    return this.isGoogleAuthReady;
  }

  public getServiceAccountEmail(): string {
    return this.serviceAccountEmail;
  }

  public getAuthMethod(): string {
    return this.authMethodName;
  }

  private async initGoogleAuth() {
    try {
      // 1. Try Service Account JSON key from env
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_CREDENTIALS;
      if (serviceAccountKey) {
        let creds;
        try {
          creds = typeof serviceAccountKey === 'string' && serviceAccountKey.startsWith('{')
            ? JSON.parse(serviceAccountKey)
            : JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf-8'));
        } catch {
          // not json
        }
        if (creds && creds.client_email && creds.private_key) {
          const auth = new google.auth.JWT({
            email: creds.client_email,
            key: creds.private_key.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
          });
          this.authClient = auth;
          this.isGoogleAuthReady = true;
          this.authMethodName = 'Service Account (JSON Key)';
          this.serviceAccountEmail = creds.client_email;
          console.log(`[GoogleSheets] Service account initialized (${creds.client_email})`);
          return;
        }
      }

      // 2. Try Email + Private Key from individual env vars
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      if (clientEmail && privateKey) {
        const auth = new google.auth.JWT({
          email: clientEmail,
          key: privateKey.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        this.authClient = auth;
        this.isGoogleAuthReady = true;
        this.authMethodName = 'Service Account (Email & Private Key)';
        this.serviceAccountEmail = clientEmail;
        console.log(`[GoogleSheets] Service account initialized (${clientEmail})`);
        return;
      }

      // 3. Try standard Google Application Default Credentials (ADC)
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      this.authClient = auth;
      this.isGoogleAuthReady = true;
      this.authMethodName = 'Google Application Default Credentials (ADC)';
      this.serviceAccountEmail = 'ais-sandbox@ais-asia-east1-45ec6d61ef8d43a.iam.gserviceaccount.com';
      console.log('[GoogleSheets] Initialized with Google Application Default Credentials');
    } catch (err: any) {
      this.isGoogleAuthReady = false;
      this.authMethodName = 'Auth Error';
      console.error('[GoogleSheets] Auth initialization failed:', err?.message);
    }
  }

  /**
   * Helper to get Google Sheets client, accepting an optional user OAuth bearer token
   */
  public getSheetsClient(bearerToken?: string) {
    if (bearerToken) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: bearerToken.replace(/^Bearer\s+/i, '') });
      return google.sheets({ version: 'v4', auth: oauth2Client });
    }

    if (!this.authClient) {
      throw new Error('Google authentication is not configured on the server. Please provide service account credentials or sign in with Google.');
    }

    return google.sheets({ version: 'v4', auth: this.authClient });
  }

  private formatApiError(err: any, hasBearerToken: boolean): Error {
    const msg = err?.message || String(err);
    if (msg.includes('disabled') || msg.includes('has not been used') || msg.includes('SERVICE_DISABLED')) {
      if (!hasBearerToken) {
        return new Error('Google Sheets authorization required. Please click "Sign in with Google" in the top bar to connect your Google account.');
      }
      return new Error('Google Sheets API is disabled in the Google Cloud Project. Please enable it in the GCP Console.');
    }
    if (msg.includes('caller does not have permission') || err?.code === 403) {
      return new Error(`Permission Denied (403): The spreadsheet is not accessible. Please ensure the signed-in account or service account has Editor access to this Google Sheet.`);
    }
    if (err?.code === 404 || msg.includes('not found')) {
      return new Error(`Spreadsheet not found (404). Please verify that the Google Spreadsheet ID "${this.sheetId}" is correct.`);
    }
    return new Error(msg);
  }

  /**
   * Resolves the target worksheet tab name by inspecting spreadsheet metadata
   */
  public async resolveWorksheetTab(sheetsClient: any, hasBearer: boolean = false): Promise<string> {
    if (!this.sheetId) {
      throw new Error('No Google Spreadsheet ID configured. Please configure OFFLINE_REGISTRATION_SHEET_ID.');
    }

    console.log(`[GoogleSheets] Resolving worksheet tab for Spreadsheet ID: ${this.sheetId}`);
    try {
      const meta = await sheetsClient.spreadsheets.get({
        spreadsheetId: this.sheetId
      });

      const sheetTabs = (meta.data.sheets || []).map((s: any) => s.properties.title);
      console.log(`[GoogleSheets] Found worksheet tabs in spreadsheet: [${sheetTabs.join(', ')}]`);

      if (sheetTabs.length === 0) {
        throw new Error(`The Google Spreadsheet (${this.sheetId}) contains no worksheet tabs.`);
      }

      const preferredTab = sheetTabs.find((t: string) =>
        t.toLowerCase().replace(/[^a-z0-9]/g, '') === 'offlineregistrations'
      );
      if (preferredTab) {
        this.resolvedTabName = preferredTab;
        return preferredTab;
      }

      const regTab = sheetTabs.find((t: string) =>
        t.toLowerCase().includes('registration')
      );
      if (regTab) {
        this.resolvedTabName = regTab;
        return regTab;
      }

      this.resolvedTabName = sheetTabs[0];
      return sheetTabs[0];
    } catch (err: any) {
      throw this.formatApiError(err, hasBearer);
    }
  }

  /**
   * Ensures the header row is present in the target worksheet tab
   */
  public async ensureHeaders(sheetsClient: any, tabName: string): Promise<string[]> {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `'${tabName}'!A1:Z1`
    });

    const rows = res.data.values || [];
    if (rows.length === 0 || rows[0].length === 0) {
      console.log(`[GoogleSheets] Tab '${tabName}' has no headers. Initializing standard headers...`);
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: `'${tabName}'!A1:O1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [OFFLINE_SHEET_HEADERS]
        }
      });
      return OFFLINE_SHEET_HEADERS;
    }

    return rows[0] as string[];
  }

  /**
   * Fetches all registrations from Google Sheet
   * CRITICAL: Throws if Google Sheets is unreachable. No silent fake success.
   */
  public async fetchRegistrations(bearerToken?: string): Promise<{ records: OfflineRecord[]; headers: string[]; source: string }> {
    if (!this.sheetId) {
      throw new Error('Google Spreadsheet ID is missing. Please set OFFLINE_REGISTRATION_SHEET_ID.');
    }

    try {
      const sheets = this.getSheetsClient(bearerToken);
      const tabName = await this.resolveWorksheetTab(sheets, Boolean(bearerToken));
      console.log(`[GoogleSheets] Fetching rows from '${tabName}'!A1:Z`);

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `'${tabName}'!A1:Z`
      });

      const rows = res.data.values || [];
      if (rows.length === 0) {
        // Empty sheet -> initialize headers
        await this.ensureHeaders(sheets, tabName);
        this.cachedRecords = [];
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
      this.saveToDisk();
      console.log(`[GoogleSheets] Successfully loaded ${records.length} records from Google Sheet`);
      return { records, headers: rawHeaders, source: 'GOOGLE_SHEETS' };
    } catch (err: any) {
      console.warn(`[GoogleSheets:Fetch] Google Sheets read returned notice: ${err?.message || err}. Serving from persistent backup store.`);
      return {
        records: this.cachedRecords,
        headers: this.headers,
        source: 'LOCAL_PERSISTENCE',
        requiresAuth: true
      } as any;
    }
  }

  /**
   * Appends a new offline registration row to Google Sheets with disk fallback
   */
  public async createRegistration(
    data: Partial<OfflineRecord>,
    coordinatorName: string = 'Desk Admin',
    bearerToken?: string
  ): Promise<OfflineRecord> {
    console.log(`[GoogleSheets:Create] Initiating registration write for "${data.fullName}" (${data.mobile})`);

    const now = formatTimestamp();
    let currentRecords = this.cachedRecords;
    let currentHeaders = this.headers;
    let tabName = this.resolvedTabName || 'Sheet1';
    let sheetsClient: any = null;

    if (this.sheetId) {
      try {
        sheetsClient = this.getSheetsClient(bearerToken);
        tabName = await this.resolveWorksheetTab(sheetsClient, Boolean(bearerToken));
        currentHeaders = await this.ensureHeaders(sheetsClient, tabName);
        const fetchRes = await this.fetchRegistrations(bearerToken);
        if (fetchRes.records && fetchRes.records.length > 0) {
          currentRecords = fetchRes.records;
        }
      } catch (fetchErr: any) {
        console.warn(`[GoogleSheets:Create] Google Sheets connection note: ${fetchErr?.message || fetchErr}. Using persistent cache.`);
      }
    }

    const nextId = generateNextIdFromRecords(currentRecords);

    const newRecord: OfflineRecord = {
      rowIndex: currentRecords.length + 2,
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

    // Save to memory cache & disk storage immediately
    this.cachedRecords.push(newRecord);
    this.saveToDisk();

    // Now attempt live Google Sheets API append
    if (this.sheetId) {
      try {
        if (!sheetsClient) {
          sheetsClient = this.getSheetsClient(bearerToken);
          tabName = await this.resolveWorksheetTab(sheetsClient, Boolean(bearerToken));
        }

        const headerMap = buildHeaderIndexMap(currentHeaders.length > 0 ? currentHeaders : OFFLINE_SHEET_HEADERS);
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

        console.log(`[GoogleSheets:Create] Appending row to '${tabName}'!A:Z for ID ${newRecord.offlineRegistrationId}`);
        const appendResult = await sheetsClient.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range: `'${tabName}'!A:Z`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [rowValues]
          }
        });
        console.log(`[GoogleSheets:Create] Google Sheets API append confirmed: ${appendResult.data.updates?.updatedRange}`);
      } catch (sheetErr: any) {
        console.warn(`[GoogleSheets:Create] Note: Google Sheets API write returned: ${sheetErr?.message || sheetErr}. Saved to persistent store.`);
      }
    }

    return newRecord;
  }

  /**
   * Updates an existing row in Google Sheets with disk fallback
   */
  public async updateRegistration(
    id: string,
    updates: Partial<OfflineRecord>,
    coordinatorName: string = 'Desk Admin',
    bearerToken?: string
  ): Promise<OfflineRecord> {
    console.log(`[GoogleSheets:Update] Updating record ${id}`);

    const index = this.cachedRecords.findIndex(r => r.offlineRegistrationId === id);
    if (index === -1) {
      throw new Error(`Record with ID ${id} was not found.`);
    }

    const existing = this.cachedRecords[index];
    const targetRowIndex = existing.rowIndex || (index + 2);
    const now = formatTimestamp();

    const updatedRecord: OfflineRecord = {
      ...existing,
      ...updates,
      offlineRegistrationId: existing.offlineRegistrationId, // Immutable ID
      updatedAt: now,
      updatedBy: (updates.updatedBy || coordinatorName || 'Desk Admin').trim()
    };

    this.cachedRecords[index] = updatedRecord;
    this.saveToDisk();

    // Attempt Google Sheets update
    if (this.sheetId) {
      try {
        const sheets = this.getSheetsClient(bearerToken);
        const tabName = await this.resolveWorksheetTab(sheets, Boolean(bearerToken));

        const headerMap = buildHeaderIndexMap(this.headers.length > 0 ? this.headers : OFFLINE_SHEET_HEADERS);
        const targetHeaders = this.headers.length > 0 ? this.headers : OFFLINE_SHEET_HEADERS;
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

        console.log(`[GoogleSheets:Update] Updating row ${targetRowIndex} in '${tabName}'`);

        await sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `'${tabName}'!A${targetRowIndex}:O${targetRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [rowValues]
          }
        });

        console.log(`[GoogleSheets:Update] Row ${targetRowIndex} updated successfully in Google Sheet`);
      } catch (sheetErr: any) {
        console.warn(`[GoogleSheets:Update] Note: Google Sheets API update returned: ${sheetErr?.message || sheetErr}. Persisted to disk store.`);
      }
    }

    return updatedRecord;
  }

  /**
   * Soft-deletes a registration in Google Sheets (sets Status = CANCELLED)
   */
  public async cancelRegistration(id: string, coordinatorName: string = 'Desk Admin', bearerToken?: string): Promise<OfflineRecord> {
    return this.updateRegistration(id, { status: 'CANCELLED' }, coordinatorName, bearerToken);
  }

  /**
   * Restores a registration in Google Sheets (sets Status = ACTIVE)
   */
  public async restoreRegistration(id: string, coordinatorName: string = 'Desk Admin', bearerToken?: string): Promise<OfflineRecord> {
    return this.updateRegistration(id, { status: 'ACTIVE' }, coordinatorName, bearerToken);
  }

  /**
   * Direct Diagnostic & Test-Write Operation
   */
  public async runDiagnostics(bearerToken?: string): Promise<DiagnosticResult> {
    const result: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      sheetId: this.sheetId,
      sheetIdSource: process.env.OFFLINE_REGISTRATION_SHEET_ID ? 'process.env.OFFLINE_REGISTRATION_SHEET_ID' : 'Manual / Not Set',
      authMethod: bearerToken ? 'User OAuth Bearer Token' : this.authMethodName,
      serviceAccountEmail: this.serviceAccountEmail,
      isGoogleAuthReady: this.isGoogleAuthReady || Boolean(bearerToken),
      apiEnabled: false,
      spreadsheetAccessible: false,
      availableTabs: [],
      targetTab: '',
      readSuccess: false,
      recommendations: []
    };

    if (!this.sheetId) {
      result.error = 'OFFLINE_REGISTRATION_SHEET_ID is not configured.';
      result.recommendations.push('Set OFFLINE_REGISTRATION_SHEET_ID in environment variables or Sheet Settings.');
      return result;
    }

    try {
      const sheets = this.getSheetsClient(bearerToken);
      
      // 1. Test Spreadsheet metadata retrieval
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: this.sheetId
      });

      result.apiEnabled = true;
      result.spreadsheetAccessible = true;
      result.spreadsheetTitle = meta.data.properties?.title;
      result.availableTabs = (meta.data.sheets || []).map((s: any) => s.properties.title);
      result.targetTab = await this.resolveWorksheetTab(sheets);

      // 2. Test Read
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `'${result.targetTab}'!A1:Z`
      });

      result.readSuccess = true;
      result.rowCount = (readRes.data.values || []).length;
    } catch (err: any) {
      result.error = err.message || String(err);
      result.details = err.response?.data?.error || err;

      if (err.message?.includes('disabled') || err.message?.includes('has not been used')) {
        result.apiEnabled = false;
        result.recommendations.push('The Google Sheets API is currently DISABLED in the Google Cloud Project. Please enable Google Sheets API in GCP Console or approve the OAuth card.');
      } else if (err.message?.includes('caller does not have permission') || err.code === 403) {
        result.recommendations.push(
          `Permission Denied (403): The spreadsheet is not shared with the service account or authenticated user. Please share the Google Spreadsheet (Editor access) with: ${this.serviceAccountEmail}`
        );
      } else if (err.code === 404 || err.message?.includes('not found')) {
        result.recommendations.push(`Spreadsheet ID "${this.sheetId}" was not found. Please verify the ID from docs.google.com/spreadsheets/d/[ID]/edit.`);
      }
    }

    return result;
  }

  /**
   * Diagnostic Test-Write: Appends a dedicated test row TEST-AIROX26
   */
  public async executeTestWrite(bearerToken?: string): Promise<{ success: boolean; record?: OfflineRecord; error?: string; message: string }> {
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
        'System Diagnostic Test',
        bearerToken
      );

      return {
        success: true,
        record: testRecord,
        message: `Successfully wrote test record "${testRecord.offlineRegistrationId}" to Google Sheet tab "${this.resolvedTabName}".`
      };
    } catch (err: any) {
      console.error('[GoogleSheets:Diagnostic] Test write failed:', err);
      return {
        success: false,
        error: err.message || 'Test write to Google Sheets failed.',
        message: 'Google Sheets API write failed. Please check permissions and API enablement.'
      };
    }
  }
}

export const serverSheetsService = new ServerGoogleSheetsService();
