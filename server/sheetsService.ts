import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { SAMPLE_AIROX26_RAW_DATA } from '../src/data/sampleDataset';

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

export interface CanonicalParticipant {
  id: string;
  registrationId: string;
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  department?: string;
  yearSection?: string;
  technicalEventsRaw: string;
  nonTechnicalEventsRaw: string;
  technicalEvents: string[];
  nonTechnicalEvents: string[];
  allEvents: string[];
  participationMode: string;
  teamName: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  source: 'ONLINE' | 'OFFLINE';
  registeredAt: string;
  registeredBy?: string;
  updatedAt?: string;
  updatedBy?: string;
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
    if (
      norm.includes('offlineregistrationid') ||
      (norm.includes('offline') && norm.includes('id')) ||
      norm === 'regid' ||
      norm === 'id'
    ) {
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
    } else if (
      norm.includes('registeredat') ||
      (norm.includes('reg') && norm.includes('time')) ||
      norm.includes('timestamp')
    ) {
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

/**
 * Normalizes any event string to official canonical display names.
 * Ensures ADS SHOT is canonical and AD SHOT / AD BATTLE map to ADS SHOT.
 */
export function normalizeEventNames(eventStr: string): string[] {
  if (!eventStr || !eventStr.trim()) return [];

  // Split on delimiters
  const tokens = eventStr
    .split(/[,;\n\r/|]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const canonicalResults: string[] = [];

  const eventMap: { [key: string]: string } = {
    thefinalhire: 'The Final Hire',
    finalhire: 'The Final Hire',
    zerohour: 'Zero Hour',
    '0hour': 'Zero Hour',
    paperpresentation: 'Paper Presentation',
    ppt: 'Paper Presentation',
    thepromptleague: 'The Prompt League',
    promptleague: 'The Prompt League',
    promptcraft: 'The Prompt League',
    adsshot: 'ADS SHOT',
    adshot: 'ADS SHOT',
    adbattle: 'ADS SHOT',
    adzap: 'ADS SHOT',
    goatedorghosted: 'GOATED OR GHOSTED',
    goatedghosted: 'GOATED OR GHOSTED',
    clashandconquer: 'CLASH AND CONQUER',
    clashconquer: 'CLASH AND CONQUER',
    boxcricket: 'BOX CRICKET',
    cricket: 'BOX CRICKET',
    esportsfreefireandstumbleguys: 'ESPORTS (FREE FIRE & STUMBLE GUYS)',
    esports: 'ESPORTS (FREE FIRE & STUMBLE GUYS)'
  };

  for (const token of tokens) {
    const stripped = token.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matchedName = eventMap[stripped];

    if (!matchedName) {
      for (const [key, name] of Object.entries(eventMap)) {
        if (stripped.includes(key) || key.includes(stripped)) {
          matchedName = name;
          break;
        }
      }
    }

    if (matchedName) {
      if (!canonicalResults.includes(matchedName)) {
        canonicalResults.push(matchedName);
      }
    } else if (token.trim()) {
      canonicalResults.push(token.trim());
    }
  }

  return canonicalResults;
}

export class ServerGoogleSheetsService {
  private sheetId: string;
  private onlineSheetId: string;
  private cachedRecords: OfflineRecord[] = [];
  private cachedOnlineParticipants: CanonicalParticipant[] = [];
  private headers: string[] = OFFLINE_SHEET_HEADERS;
  private authClient: any = null;
  private isGoogleAuthReady: boolean = false;
  private authMethodName: string = 'None';
  private serviceAccountEmail: string = '';
  private resolvedTabName: string = '';
  private storageFilePath: string;
  private onlineStorageFilePath: string;

  constructor() {
    this.storageFilePath = path.join(process.cwd(), 'server', 'offline_registrations_store.json');
    this.onlineStorageFilePath = path.join(process.cwd(), 'server', 'online_registrations_store.json');

    const envSheetId =
      process.env.OFFLINE_REGISTRATION_SHEET_ID ||
      process.env.GOOGLE_SHEET_ID ||
      process.env.SHEET_ID ||
      '';
    this.sheetId = extractSheetId(envSheetId);

    const envOnlineSheetId = process.env.ONLINE_REGISTRATION_SHEET_ID || '';
    this.onlineSheetId = extractSheetId(envOnlineSheetId);

    this.loadFromDisk();
    this.initGoogleAuth();
    this.initializeOnlineParticipants();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const fileContent = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed.records && Array.isArray(parsed.records)) {
          this.cachedRecords = parsed.records;
          if (parsed.headers && Array.isArray(parsed.headers)) {
            this.headers = parsed.headers;
          }
          if (!this.sheetId && parsed.sheetId) {
            this.sheetId = parsed.sheetId;
          }
          console.log(`[GoogleSheets:Store] Loaded ${this.cachedRecords.length} offline records from disk.`);
        }
      }
    } catch (err: any) {
      console.warn('[GoogleSheets:Store] Failed to load local offline backup file:', err?.message);
    }

    try {
      if (fs.existsSync(this.onlineStorageFilePath)) {
        const fileContent = fs.readFileSync(this.onlineStorageFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cachedOnlineParticipants = parsed;
          console.log(`[GoogleSheets:Store] Loaded ${this.cachedOnlineParticipants.length} online participants from disk.`);
        }
      }
    } catch (err: any) {
      console.warn('[GoogleSheets:Store] Failed to load local online backup file:', err?.message);
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

  private saveOnlineToDisk() {
    try {
      const dir = path.dirname(this.onlineStorageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.onlineStorageFilePath, JSON.stringify(this.cachedOnlineParticipants, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[GoogleSheets:Store] Failed to save online participants to disk:', err?.message);
    }
  }

  /**
   * Initializes online participants from authentic dataset if not already loaded
   */
  private initializeOnlineParticipants() {
    if (this.cachedOnlineParticipants.length > 0) {
      return;
    }

    console.log('[GoogleSheets] Parsing built-in AIROX26 Online dataset (321 authoritative registrations)...');
    const participants: CanonicalParticipant[] = [];

    SAMPLE_AIROX26_RAW_DATA.forEach((row, idx) => {
      const regId = row['Registration ID'] || `AIR${String(idx + 1).padStart(3, '0')}`;
      const fullName = (row['Full Name'] || '').trim();
      const email = (row['Email Address'] || '').trim();
      const mobile = (row['Mobile Number'] || '').trim();
      const college = (row['College / Institution'] || '').trim();
      const techRaw = row['Technical Events'] || '';
      const nonTechRaw = row['Non-Technical Events'] || '';
      const mode = row['How will you participate?'] || 'Individual';
      const teamName = row['Team Name'] || '';
      const verRaw = row['Verification Status'] || 'Verified';
      const verificationStatus = verRaw === 'Pending' ? 'Pending' : verRaw === 'Rejected' ? 'Rejected' : 'Verified';

      const techEvents = normalizeEventNames(techRaw);
      const nonTechEvents = normalizeEventNames(nonTechRaw);
      const allEvents = Array.from(new Set([...techEvents, ...nonTechEvents]));

      participants.push({
        id: regId,
        registrationId: regId,
        fullName,
        email,
        mobile,
        college,
        department: row['Department'] || '',
        yearSection: row['Year / Section'] || row['Year'] || '',
        technicalEventsRaw: techRaw,
        nonTechnicalEventsRaw: nonTechRaw,
        technicalEvents: techEvents,
        nonTechnicalEvents: nonTechEvents,
        allEvents: allEvents,
        participationMode: mode,
        teamName,
        verificationStatus,
        source: 'ONLINE',
        registeredAt: row['Timestamp'] || '2026-08-25 09:00:00',
        status: 'ACTIVE'
      });
    });

    this.cachedOnlineParticipants = participants;
    this.saveOnlineToDisk();
    console.log(`[GoogleSheets] Initialized ${this.cachedOnlineParticipants.length} online participants.`);
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

  public getOnlineSheetId(): string {
    return this.onlineSheetId;
  }

  public setOnlineSheetId(newId: string) {
    this.onlineSheetId = extractSheetId(newId);
    process.env.ONLINE_REGISTRATION_SHEET_ID = this.onlineSheetId;
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
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_CREDENTIALS;
      if (serviceAccountKey) {
        let creds;
        try {
          creds =
            typeof serviceAccountKey === 'string' && serviceAccountKey.startsWith('{')
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

      // Application Default Credentials (ADC)
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

  public getSheetsClient(accessToken?: string) {
    if (accessToken && accessToken.trim()) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken.trim() });
      return google.sheets({ version: 'v4', auth: oauth2Client });
    }

    if (!this.authClient) {
      this.initGoogleAuth();
    }

    if (this.authClient) {
      return google.sheets({ version: 'v4', auth: this.authClient });
    }

    const fallbackAuth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return google.sheets({ version: 'v4', auth: fallbackAuth });
  }

  private formatApiError(err: any): Error {
    const msg = err?.message || String(err);
    if (msg.includes('disabled') || msg.includes('has not been used') || msg.includes('SERVICE_DISABLED')) {
      return new Error('Google Sheets access requires your Google account authorization. Please click "Connect / Authorize Google Account" to enable live sync.');
    }
    if (msg.includes('caller does not have permission') || err?.code === 403) {
      return new Error(
        'Permission Denied (403): The spreadsheet is not accessible. Please ensure your Google account or the backend service account has Editor access to this Google Sheet.'
      );
    }
    if (err?.code === 404 || msg.includes('not found')) {
      return new Error(`Spreadsheet not found (404). Please verify that the Google Spreadsheet ID is correct.`);
    }
    return new Error(msg);
  }

  public async resolveWorksheetTab(sheetsClient: any, targetSheetId?: string): Promise<string> {
    const sheetId = targetSheetId || this.sheetId;
    if (!sheetId) {
      throw new Error('No Google Spreadsheet ID configured.');
    }

    try {
      const meta = await sheetsClient.spreadsheets.get({
        spreadsheetId: sheetId
      });

      const sheetTabs = (meta.data.sheets || []).map((s: any) => s.properties.title);
      if (sheetTabs.length === 0) {
        throw new Error(`Spreadsheet (${sheetId}) contains no worksheet tabs.`);
      }

      const preferredTab = sheetTabs.find(
        (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '') === 'offlineregistrations'
      );
      if (preferredTab) {
        this.resolvedTabName = preferredTab;
        return preferredTab;
      }

      const regTab = sheetTabs.find((t: string) => t.toLowerCase().includes('registration'));
      if (regTab) {
        this.resolvedTabName = regTab;
        return regTab;
      }

      this.resolvedTabName = sheetTabs[0];
      return sheetTabs[0];
    } catch (err: any) {
      throw this.formatApiError(err);
    }
  }

  public async ensureHeaders(sheetsClient: any, tabName: string): Promise<string[]> {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `'${tabName}'!A1:Z1`
    });

    const rows = res.data.values || [];
    if (rows.length === 0 || rows[0].length === 0) {
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
   * Fetches Online Registrations from Google Sheets (if configured) or returns cached
   */
  public async fetchOnlineRegistrations(): Promise<CanonicalParticipant[]> {
    if (!this.onlineSheetId) {
      return this.cachedOnlineParticipants;
    }

    try {
      const sheets = this.getSheetsClient();
      const meta = await sheets.spreadsheets.get({ spreadsheetId: this.onlineSheetId });
      const tabName = (meta.data.sheets && meta.data.sheets[0]?.properties?.title) || 'Sheet1';

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.onlineSheetId,
        range: `'${tabName}'!A1:Z`
      });

      const rows = res.data.values || [];
      if (rows.length > 1) {
        const rawHeaders = rows[0] as string[];
        const headerMap = buildHeaderIndexMap(rawHeaders);
        const parsed: CanonicalParticipant[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as string[];
          if (!row || !row.some(cell => cell && String(cell).trim())) continue;

          const getVal = (idx: number | undefined) => (idx !== undefined && idx < row.length ? String(row[idx] || '').trim() : '');
          const regId = getVal(headerMap['offlineRegistrationId']) || `AIR${String(i).padStart(3, '0')}`;
          const fullName = getVal(headerMap['fullName']);
          const email = getVal(headerMap['email']);
          const mobile = getVal(headerMap['mobile']);
          const college = getVal(headerMap['college']);
          const eventRaw = getVal(headerMap['event']);
          const teamName = getVal(headerMap['teamName']);
          const verRaw = getVal(headerMap['verificationStatus']);
          const verificationStatus = verRaw === 'Pending' ? 'Pending' : verRaw === 'Rejected' ? 'Rejected' : 'Verified';

          const events = normalizeEventNames(eventRaw);

          parsed.push({
            id: regId,
            registrationId: regId,
            fullName,
            email,
            mobile,
            college,
            department: getVal(headerMap['department']),
            yearSection: getVal(headerMap['yearSection']),
            technicalEventsRaw: eventRaw,
            nonTechnicalEventsRaw: '',
            technicalEvents: events,
            nonTechnicalEvents: [],
            allEvents: events,
            participationMode: teamName ? 'Team' : 'Individual',
            teamName,
            verificationStatus,
            source: 'ONLINE',
            registeredAt: getVal(headerMap['registeredAt']) || '2026-08-25 09:00:00',
            status: 'ACTIVE'
          });
        }

        if (parsed.length > 0) {
          this.cachedOnlineParticipants = parsed;
          this.saveOnlineToDisk();
        }
      }
    } catch (err: any) {
      console.warn('[GoogleSheets] Failed to fetch online registrations from remote sheet, using local cache:', err?.message);
    }

    return this.cachedOnlineParticipants;
  }

  /**
   * Fetches Offline Registrations from Google Sheets
   */
  public async fetchRegistrations(accessToken?: string): Promise<{ records: OfflineRecord[]; headers: string[]; source: string }> {
    if (!this.sheetId) {
      return { records: this.cachedRecords, headers: this.headers, source: 'PERSISTENT_STORE' };
    }

    try {
      const sheets = this.getSheetsClient(accessToken);
      const tabName = await this.resolveWorksheetTab(sheets);

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `'${tabName}'!A1:Z`
      });

      const rows = res.data.values || [];
      if (rows.length === 0) {
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
          registeredAt: getVal('registeredAt') || formatTimestamp(),
          registeredBy: getVal('registeredBy') || 'Registration Desk',
          updatedAt: getVal('updatedAt') || getVal('registeredAt') || formatTimestamp(),
          updatedBy: getVal('updatedBy') || getVal('registeredBy') || 'Registration Desk',
          status
        });
      }

      this.cachedRecords = records;
      this.saveToDisk();
      return { records, headers: rawHeaders, source: 'GOOGLE_SHEETS' };
    } catch (err: any) {
      console.log('[GoogleSheets] Remote sheet sync skipped (' + (err?.message || 'offline') + '), serving from server persistent store.');
      return { records: this.cachedRecords, headers: this.headers, source: 'PERSISTENT_STORE' };
    }
  }

  /**
   * Appends a new offline registration to Google Sheet or persistent local storage
   */
  public async appendRegistration(record: Omit<OfflineRecord, 'rowIndex'>, accessToken?: string): Promise<OfflineRecord> {
    const fullRecord: OfflineRecord = {
      ...record,
      registeredAt: record.registeredAt || formatTimestamp(),
      updatedAt: record.updatedAt || formatTimestamp(),
      status: record.status || 'ACTIVE'
    };

    if (!fullRecord.offlineRegistrationId) {
      fullRecord.offlineRegistrationId = generateNextIdFromRecords(this.cachedRecords);
    }

    if (!this.sheetId) {
      fullRecord.rowIndex = this.cachedRecords.length + 2;
      this.cachedRecords.push(fullRecord);
      this.saveToDisk();
      return fullRecord;
    }

    try {
      const sheets = this.getSheetsClient(accessToken);
      const tabName = await this.resolveWorksheetTab(sheets);
      await this.ensureHeaders(sheets, tabName);

      const rowValues = [
        fullRecord.offlineRegistrationId,
        fullRecord.fullName,
        fullRecord.email,
        fullRecord.mobile,
        fullRecord.college,
        fullRecord.department,
        fullRecord.yearSection,
        fullRecord.event,
        fullRecord.teamName,
        fullRecord.verificationStatus,
        fullRecord.registeredAt,
        fullRecord.registeredBy,
        fullRecord.updatedAt,
        fullRecord.updatedBy,
        fullRecord.status
      ];

      const res = await sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: `'${tabName}'!A:O`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowValues]
        }
      });

      let rowIndex = this.cachedRecords.length + 2;
      const updatedRange = res.data.updates?.updatedRange;
      if (updatedRange) {
        const match = updatedRange.match(/!A(\d+):/i) || updatedRange.match(/:O(\d+)/i);
        if (match && match[1]) {
          rowIndex = parseInt(match[1], 10);
        }
      }

      fullRecord.rowIndex = rowIndex;
      this.cachedRecords.push(fullRecord);
      this.saveToDisk();
      console.log(`[GoogleSheets] Successfully appended ${fullRecord.offlineRegistrationId} to Google Sheet row ${rowIndex}!`);
      return fullRecord;
    } catch (err: any) {
      // Safely ensure record is stored in persistent disk storage
      console.warn('[GoogleSheets] Append to Google Sheet bypassed (' + (err?.message || 'offline') + '), safely stored in server persistent store.');
      fullRecord.rowIndex = this.cachedRecords.length + 2;
      this.cachedRecords.push(fullRecord);
      this.saveToDisk();
      return fullRecord;
    }
  }

  /**
   * Updates an existing offline registration in Google Sheet or persistent storage
   */
  public async updateRegistration(
    id: string,
    updates: Partial<OfflineRecord>,
    actorEmail: string = 'System',
    accessToken?: string
  ): Promise<OfflineRecord> {
    const existingIndex = this.cachedRecords.findIndex(r => r.offlineRegistrationId === id);
    if (existingIndex === -1) {
      throw new Error(`Record with ID ${id} not found.`);
    }

    const existing = this.cachedRecords[existingIndex];
    const updatedRecord: OfflineRecord = {
      ...existing,
      ...updates,
      updatedAt: formatTimestamp(),
      updatedBy: actorEmail
    };

    if (!this.sheetId) {
      this.cachedRecords[existingIndex] = updatedRecord;
      this.saveToDisk();
      return updatedRecord;
    }

    try {
      const sheets = this.getSheetsClient(accessToken);
      const tabName = await this.resolveWorksheetTab(sheets);
      let targetRowIndex = existing.rowIndex;

      if (!targetRowIndex) {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: this.sheetId,
          range: `'${tabName}'!A:A`
        });
        const rows = res.data.values || [];
        const idx = rows.findIndex((r: any) => r[0] && String(r[0]).trim() === id);
        if (idx !== -1) {
          targetRowIndex = idx + 1;
        } else {
          targetRowIndex = existingIndex + 2;
        }
      }

      const rowValues = [
        updatedRecord.offlineRegistrationId,
        updatedRecord.fullName,
        updatedRecord.email,
        updatedRecord.mobile,
        updatedRecord.college,
        updatedRecord.department,
        updatedRecord.yearSection,
        updatedRecord.event,
        updatedRecord.teamName,
        updatedRecord.verificationStatus,
        updatedRecord.registeredAt,
        updatedRecord.registeredBy,
        updatedRecord.updatedAt,
        updatedRecord.updatedBy,
        updatedRecord.status
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: `'${tabName}'!A${targetRowIndex}:O${targetRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues]
        }
      });

      updatedRecord.rowIndex = targetRowIndex;
      this.cachedRecords[existingIndex] = updatedRecord;
      this.saveToDisk();
      console.log(`[GoogleSheets] Successfully updated ${id} in Google Sheet row ${targetRowIndex}!`);
      return updatedRecord;
    } catch (err: any) {
      console.warn('[GoogleSheets] Update to Google Sheet bypassed (' + (err?.message || 'offline') + '), safely updated in server persistent store.');
      this.cachedRecords[existingIndex] = updatedRecord;
      this.saveToDisk();
      return updatedRecord;
    }
  }

  /**
   * Soft-deletes a registration (status = CANCELLED)
   */
  public async cancelRegistration(id: string, actorEmail: string = 'System', accessToken?: string): Promise<OfflineRecord> {
    return this.updateRegistration(id, { status: 'CANCELLED' }, actorEmail, accessToken);
  }

  /**
   * Restores a previously cancelled registration (status = ACTIVE)
   */
  public async restoreRegistration(id: string, actorEmail: string = 'System', accessToken?: string): Promise<OfflineRecord> {
    return this.updateRegistration(id, { status: 'ACTIVE' }, actorEmail, accessToken);
  }

  /**
   * Bulk synchronizes all local offline records directly to the remote Google Sheet
   */
  public async syncAllLocalToRemote(accessToken?: string): Promise<{ syncedCount: number; message: string }> {
    if (!this.sheetId) {
      throw new Error('No Google Spreadsheet ID configured.');
    }

    const sheets = this.getSheetsClient(accessToken);
    const tabName = await this.resolveWorksheetTab(sheets);
    await this.ensureHeaders(sheets, tabName);

    if (this.cachedRecords.length === 0) {
      return { syncedCount: 0, message: 'No offline records in database to sync.' };
    }

    // Build row values matrix for all records
    const allRows = this.cachedRecords.map(r => [
      r.offlineRegistrationId,
      r.fullName,
      r.email,
      r.mobile,
      r.college,
      r.department,
      r.yearSection,
      r.event,
      r.teamName,
      r.verificationStatus,
      r.registeredAt,
      r.registeredBy,
      r.updatedAt,
      r.updatedBy,
      r.status
    ]);

    // Overwrite range A2:O with current authoritative records
    await sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `'${tabName}'!A2:O${this.cachedRecords.length + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: allRows
      }
    });

    console.log(`[GoogleSheets] Synced ${this.cachedRecords.length} records to tab "${tabName}"!`);
    return {
      syncedCount: this.cachedRecords.length,
      message: `Successfully synchronized ${this.cachedRecords.length} offline registrations to Google Sheet tab "${tabName}"!`
    };
  }

  /**
   * Executes a diagnostic test write
   */
  public async executeTestWrite(actorEmail: string = 'Diagnostic', accessToken?: string): Promise<{ success: boolean; record?: OfflineRecord; error?: string; message: string }> {
    const testId = `TEST-${Date.now().toString().slice(-4)}`;
    const testRecord: OfflineRecord = {
      offlineRegistrationId: testId,
      fullName: 'AIROX Diagnostic Test',
      email: 'test@airox26.org',
      mobile: '9999999999',
      college: 'AIROX Host Campus',
      department: 'CSE / AI',
      yearSection: 'IV / A',
      event: 'The Prompt League',
      teamName: '',
      verificationStatus: 'Verified',
      registeredAt: formatTimestamp(),
      registeredBy: actorEmail,
      updatedAt: formatTimestamp(),
      updatedBy: actorEmail,
      status: 'ACTIVE'
    };

    if (this.sheetId) {
      try {
        const sheets = this.getSheetsClient(accessToken);
        const tabName = await this.resolveWorksheetTab(sheets);
        await this.ensureHeaders(sheets, tabName);

        const res = await sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range: `'${tabName}'!A:O`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [[
              testRecord.offlineRegistrationId,
              testRecord.fullName,
              testRecord.email,
              testRecord.mobile,
              testRecord.college,
              testRecord.department,
              testRecord.yearSection,
              testRecord.event,
              testRecord.teamName,
              testRecord.verificationStatus,
              testRecord.registeredAt,
              testRecord.registeredBy,
              testRecord.updatedAt,
              testRecord.updatedBy,
              testRecord.status
            ]]
          }
        });

        testRecord.rowIndex = this.cachedRecords.length + 2;
        this.cachedRecords.push(testRecord);
        this.saveToDisk();

        return {
          success: true,
          record: testRecord,
          message: `Diagnostic test record (${testRecord.offlineRegistrationId}) successfully written to Google Sheet tab "${tabName}"!`
        };
      } catch (err: any) {
        const formattedErr = this.formatApiError(err);
        return {
          success: false,
          error: formattedErr.message,
          message: `Google Sheets write failed: ${formattedErr.message}`
        };
      }
    }

    return {
      success: false,
      error: 'No Google Spreadsheet ID configured.',
      message: 'Please configure the Google Spreadsheet ID in the settings modal.'
    };
  }

  /**
   * Generates Unified Combined Roster (Online + Offline)
   */
  public async getCombinedParticipants(): Promise<CanonicalParticipant[]> {
    const online = await this.fetchOnlineRegistrations();
    const { records: offline } = await this.fetchRegistrations();

    const offlineParticipants: CanonicalParticipant[] = offline.map(r => {
      const events = normalizeEventNames(r.event);
      return {
        id: r.offlineRegistrationId,
        registrationId: r.offlineRegistrationId,
        fullName: r.fullName,
        email: r.email,
        mobile: r.mobile,
        college: r.college,
        department: r.department,
        yearSection: r.yearSection,
        technicalEventsRaw: r.event,
        nonTechnicalEventsRaw: '',
        technicalEvents: events,
        nonTechnicalEvents: [],
        allEvents: events,
        participationMode: r.teamName ? 'Team' : 'Individual',
        teamName: r.teamName,
        verificationStatus: r.verificationStatus,
        source: 'OFFLINE',
        registeredAt: r.registeredAt,
        registeredBy: r.registeredBy,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
        status: r.status
      };
    });

    return [...online, ...offlineParticipants];
  }

  /**
   * Diagnostic health check for Google Sheets
   */
  public async runDiagnostics(accessToken?: string): Promise<DiagnosticResult> {
    const result: DiagnosticResult = {
      timestamp: formatTimestamp(),
      sheetId: this.sheetId || '(None Configured)',
      sheetIdSource: process.env.OFFLINE_REGISTRATION_SHEET_ID ? 'ENV' : 'LOCAL_STORE',
      authMethod: accessToken ? 'User Google OAuth2 Token' : this.authMethodName,
      serviceAccountEmail: this.serviceAccountEmail,
      isGoogleAuthReady: Boolean(accessToken || this.isGoogleAuthReady),
      apiEnabled: false,
      spreadsheetAccessible: false,
      availableTabs: [],
      targetTab: '',
      readSuccess: false,
      recommendations: []
    };

    if (!this.sheetId) {
      result.error = 'No Google Spreadsheet ID is configured.';
      result.recommendations.push('Configure OFFLINE_REGISTRATION_SHEET_ID in environment or modal.');
      return result;
    }

    try {
      const sheets = this.getSheetsClient(accessToken);
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: this.sheetId
      });

      result.apiEnabled = true;
      result.spreadsheetAccessible = true;
      result.spreadsheetTitle = meta.data.properties?.title;
      result.availableTabs = (meta.data.sheets || []).map((s: any) => s.properties.title);

      const tabName = await this.resolveWorksheetTab(sheets);
      result.targetTab = tabName;

      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `'${tabName}'!A1:Z5`
      });

      result.readSuccess = true;
      result.rowCount = (readRes.data.values || []).length;
    } catch (err: any) {
      const formattedError = this.formatApiError(err);
      result.error = formattedError.message;
      result.details = err;
      if (err.message?.includes('disabled') || err.message?.includes('has not been used') || err.message?.includes('SERVICE_DISABLED')) {
        result.recommendations.push(
          'Connect your Google Account using the "Connect / Authorize Google Account" button above to grant Sheets permissions.'
        );
      } else if (err.message?.includes('403') || err.message?.includes('Permission Denied')) {
        result.recommendations.push(
          `Share your Google Sheet with Editor permissions, or click "Connect / Authorize Google Account" in the portal.`
        );
      }
    }

    return result;
  }
}

export const serverSheetsService = new ServerGoogleSheetsService();
