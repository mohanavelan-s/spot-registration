import * as XLSX from 'xlsx';
import { ColumnMapping, DetectedEvent, ParseResult, Participant, RawRow } from '../types';
import { cleanRawString, EventNormalizer, defaultNormalizer } from './normalizer';

/**
 * Normalize a header string for exact normalized comparison
 */
function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[_\-–—/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Strip all non-alphanumeric characters for stripped comparison
 */
function stripHeaderName(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Deterministic 4-tier column matching:
 * Priority 1: Exact string match (case-sensitive or exact trimmed)
 * Priority 2: Normalized exact match (lowercased, space/separator normalized)
 * Priority 3: Controlled alias exact matches (full normalized string match against alias)
 * Priority 4: Conservative fuzzy match (only as last resort, never matching tech to non-tech)
 */
function findBestColumnMatch(
  headers: string[],
  exactTarget: string,
  aliases: string[] = []
): string | null {
  // Priority 1: Exact string match
  for (const h of headers) {
    if (h.trim() === exactTarget.trim()) {
      return h;
    }
  }

  // Priority 2: Normalized exact match
  const normTarget = normalizeHeaderName(exactTarget);
  const strippedTarget = stripHeaderName(exactTarget);

  for (const h of headers) {
    const normH = normalizeHeaderName(h);
    const strippedH = stripHeaderName(h);
    if (normH === normTarget || strippedH === strippedTarget) {
      return h;
    }
  }

  // Priority 3: Controlled aliases (strictly full normalized match)
  for (const alias of aliases) {
    const normAlias = normalizeHeaderName(alias);
    const strippedAlias = stripHeaderName(alias);
    for (const h of headers) {
      const normH = normalizeHeaderName(h);
      const strippedH = stripHeaderName(h);
      if (normH === normAlias || strippedH === strippedAlias) {
        return h;
      }
    }
  }

  // Priority 4: Conservative fallback (only if target doesn't conflict between tech / non-tech)
  const isTargetNonTech = normTarget.includes('non');
  for (const h of headers) {
    const normH = normalizeHeaderName(h);
    const isHeaderNonTech = normH.includes('non');

    // Never match Non-Technical column with Technical column or vice versa
    if (isTargetNonTech !== isHeaderNonTech) {
      continue;
    }

    if (normH.includes(normTarget) || normTarget.includes(normH)) {
      return h;
    }
  }

  return null;
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  return {
    registrationIdKey: findBestColumnMatch(headers, 'Registration ID', [
      'reg id', 'registration number', 'reg_id', 'reg no', 'registration_id', 'participant id', 'id', 'ticket number'
    ]),
    fullNameKey: findBestColumnMatch(headers, 'Full Name', [
      'name', 'participant name', 'student name', 'candidate name', 'applicant name'
    ]),
    emailKey: findBestColumnMatch(headers, 'Email Address', [
      'email', 'mail id', 'email id', 'mail', 'e-mail address', 'e-mail'
    ]),
    mobileKey: findBestColumnMatch(headers, 'Mobile Number', [
      'phone number', 'contact number', 'mobile', 'phone', 'whatsapp number', 'contact'
    ]),
    collegeKey: findBestColumnMatch(headers, 'College / Institution', [
      'college/institution', 'college', 'institution', 'college name', 'institution name', 'university', 'institute'
    ]),
    technicalEventsKey: findBestColumnMatch(headers, 'Technical Events', [
      'technical event', 'technical_events', 'tech events', 'tech event', 'technical', 'events technical', 'events (technical)'
    ]),
    nonTechnicalEventsKey: findBestColumnMatch(headers, 'Non-Technical Events', [
      'non technical events', 'non_technical_events', 'non-tech events', 'non tech events', 'non technical', 'non-technical', 'nontech events', 'events non-technical', 'events (non-technical)'
    ]),
    participationModeKey: findBestColumnMatch(headers, 'How will you participate?', [
      'how will you participate', 'participation mode', 'participation type', 'participation', 'mode', 'solo/team', 'individual/team'
    ]),
    teamNameKey: findBestColumnMatch(headers, 'Team Name', [
      'team', 'group name', 'team_name'
    ]),
    verificationStatusKey: findBestColumnMatch(headers, 'Verification Status', [
      'status', 'verification', 'payment status', 'verified'
    ]),
    allColumns: headers
  };
}

/**
 * Process raw JSON rows into structured Participant array and calculate detected events
 */
export function processRawRows(
  rows: RawRow[],
  columnMapping: ColumnMapping,
  normalizer: EventNormalizer = defaultNormalizer
): { participants: Participant[]; detectedEvents: DetectedEvent[]; warnings: string[] } {
  const warnings: string[] = [];
  const participantsMap = new Map<string, Participant>();
  const eventStatsMap = new Map<
    string,
    {
      displayName: string;
      techCount: number;
      nonTechCount: number;
      rawOccurrences: Set<string>;
    }
  >();

  // Helper to record event occurrence
  const recordEvent = (rawEvent: string, isTech: boolean): string => {
    const { canonicalKey, displayName } = normalizer.normalize(
      rawEvent,
      isTech ? 'Technical' : 'Non-Technical'
    );
    if (!canonicalKey) return '';

    if (!eventStatsMap.has(canonicalKey)) {
      eventStatsMap.set(canonicalKey, {
        displayName,
        techCount: 0,
        nonTechCount: 0,
        rawOccurrences: new Set<string>()
      });
    }

    const stat = eventStatsMap.get(canonicalKey)!;
    stat.rawOccurrences.add(rawEvent.trim());
    if (isTech) stat.techCount++;
    else stat.nonTechCount++;

    return canonicalKey;
  };

  rows.forEach((row, index) => {
    // Extract fields using mapping
    const rawId = columnMapping.registrationIdKey ? String(row[columnMapping.registrationIdKey] || '').trim() : '';
    const rawName = columnMapping.fullNameKey ? String(row[columnMapping.fullNameKey] || '').trim() : '';
    const rawEmail = columnMapping.emailKey ? String(row[columnMapping.emailKey] || '').trim() : '';
    const rawMobile = columnMapping.mobileKey ? String(row[columnMapping.mobileKey] || '').trim() : '';
    const rawCollege = columnMapping.collegeKey ? String(row[columnMapping.collegeKey] || '').trim() : '';
    const rawTechEvents = columnMapping.technicalEventsKey ? String(row[columnMapping.technicalEventsKey] || '').trim() : '';
    const rawNonTechEvents = columnMapping.nonTechnicalEventsKey ? String(row[columnMapping.nonTechnicalEventsKey] || '').trim() : '';
    const rawMode = columnMapping.participationModeKey ? String(row[columnMapping.participationModeKey] || '').trim() : 'Individual';
    const rawTeam = columnMapping.teamNameKey ? String(row[columnMapping.teamNameKey] || '').trim() : '';
    const rawStatus = columnMapping.verificationStatusKey ? String(row[columnMapping.verificationStatusKey] || '').trim() : 'Verified';

    // Ignore completely blank rows
    if (!rawId && !rawName && !rawEmail && !rawTechEvents && !rawNonTechEvents) {
      return;
    }

    // Determine unique deduplication key
    // Primary: Registration ID, Fallback: Email, Fallback 2: Name + Mobile, Fallback 3: Index
    const dedupeId = rawId || rawEmail.toLowerCase() || (rawName && rawMobile ? `${rawName.toLowerCase()}_${rawMobile}` : `ROW_${index + 1}`);

    // Parse technical events
    const techTokens = normalizer.parseEventCell(rawTechEvents);
    const normalizedTechKeys = Array.from(
      new Set(techTokens.map(t => recordEvent(t, true)).filter(Boolean))
    );

    // Parse non-technical events
    const nonTechTokens = normalizer.parseEventCell(rawNonTechEvents);
    const normalizedNonTechKeys = Array.from(
      new Set(nonTechTokens.map(t => recordEvent(t, false)).filter(Boolean))
    );

    // Combined unique canonical events for this participant
    const allEvents = Array.from(new Set([...normalizedTechKeys, ...normalizedNonTechKeys]));

    // Parse verification status
    let verificationStatus: 'Verified' | 'Pending' | 'Rejected' = 'Verified';
    const cleanStatus = rawStatus.toLowerCase();
    if (cleanStatus.includes('pend') || cleanStatus.includes('wait') || cleanStatus.includes('unverified')) {
      verificationStatus = 'Pending';
    } else if (cleanStatus.includes('reject') || cleanStatus.includes('cancel') || cleanStatus.includes('fail') || cleanStatus.includes('declined')) {
      verificationStatus = 'Rejected';
    } else if (cleanStatus.includes('verif') || cleanStatus.includes('approv') || cleanStatus.includes('success') || cleanStatus.includes('paid')) {
      verificationStatus = 'Verified';
    }

    // Extract optional department / year / timestamp if in raw row
    const rawTimestamp = row['Timestamp'] || row['registeredAt'] || row['Registered At'] || row['Created At'] || '';
    const rawDept = row['Department'] || row['Dept'] || row['Branch'] || '';
    const rawYear = row['Year / Section'] || row['Year'] || row['Year of Study'] || '';

    const participant: Participant = {
      id: dedupeId,
      registrationId: rawId || `AIR${String(index + 1).padStart(3, '0')}`,
      fullName: rawName || 'Anonymous Participant',
      email: rawEmail,
      mobile: rawMobile,
      college: rawCollege || 'Not Specified',
      department: rawDept ? String(rawDept) : undefined,
      yearSection: rawYear ? String(rawYear) : undefined,
      technicalEventsRaw: rawTechEvents,
      nonTechnicalEventsRaw: rawNonTechEvents,
      technicalEvents: normalizedTechKeys,
      nonTechnicalEvents: normalizedNonTechKeys,
      allEvents,
      participationMode: rawMode || 'Individual',
      teamName: rawTeam,
      verificationStatus,
      source: 'ONLINE',
      registeredAt: rawTimestamp ? String(rawTimestamp) : undefined,
      status: 'ACTIVE',
      rawRow: row
    };

    // If duplicate detected, merge events if needed or keep latest
    if (participantsMap.has(dedupeId)) {
      const existing = participantsMap.get(dedupeId)!;
      // Merge unique events
      existing.technicalEvents = Array.from(new Set([...existing.technicalEvents, ...normalizedTechKeys]));
      existing.nonTechnicalEvents = Array.from(new Set([...existing.nonTechnicalEvents, ...normalizedNonTechKeys]));
      existing.allEvents = Array.from(new Set([...existing.allEvents, ...allEvents]));
      if (!existing.college && participant.college) existing.college = participant.college;
      if (!existing.mobile && participant.mobile) existing.mobile = participant.mobile;
      if (!existing.teamName && participant.teamName) existing.teamName = participant.teamName;
    } else {
      participantsMap.set(dedupeId, participant);
    }
  });

  const participants = Array.from(participantsMap.values());

  // Build DetectedEvent array with accurate participant count
  const detectedEvents: DetectedEvent[] = Array.from(eventStatsMap.entries()).map(([key, stat]) => {
    // Count how many distinct participants registered for this event
    const count = participants.filter(p => p.allEvents.includes(key)).length;
    let category: 'Technical' | 'Non-Technical' | 'Both' = 'Both';
    if (stat.techCount > 0 && stat.nonTechCount === 0) category = 'Technical';
    else if (stat.nonTechCount > 0 && stat.techCount === 0) category = 'Non-Technical';

    const registry = normalizer.getRegistry();
    const config = registry[key];

    return {
      key,
      displayName: config?.displayName || stat.displayName,
      category: config?.category || category,
      participantCount: count,
      onlineCount: count,
      offlineCount: 0,
      combinedCount: count,
      aliases: config?.aliases || [],
      sampleRawOccurrences: Array.from(stat.rawOccurrences).slice(0, 5)
    };
  });

  // Sort detected events alphabetically
  detectedEvents.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { participants, detectedEvents, warnings };
}

/**
 * Parse an uploaded file buffer (XLSX, XLS, CSV) into a ParseResult
 */
export async function parseRegistrationFile(
  file: File,
  selectedSheetName?: string,
  normalizer: EventNormalizer = defaultNormalizer
): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellNF: false });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('The uploaded spreadsheet contains no readable sheets.');
    }

    const sheetNames = workbook.SheetNames;
    const activeSheetName = selectedSheetName && sheetNames.includes(selectedSheetName)
      ? selectedSheetName
      : sheetNames[0];

    const worksheet = workbook.Sheets[activeSheetName];
    if (!worksheet) {
      throw new Error(`Sheet "${activeSheetName}" could not be read.`);
    }

    // Convert worksheet to JSON array of objects with raw headers
    const rawData = XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: '' });

    if (rawData.length === 0) {
      throw new Error(`The sheet "${activeSheetName}" appears to be empty.`);
    }

    // Extract headers from first few rows
    const headers = Object.keys(rawData[0] || {});
    const columnMapping = detectColumnMapping(headers);

    // Validate essential columns
    if (!columnMapping.technicalEventsKey && !columnMapping.nonTechnicalEventsKey) {
      warnings.push('Could not automatically identify "Technical Events" or "Non-Technical Events" column. Please check column headers.');
    }
    if (!columnMapping.fullNameKey && !columnMapping.registrationIdKey) {
      warnings.push('Could not identify "Full Name" or "Registration ID" column.');
    }

    const { participants, detectedEvents, warnings: processWarnings } = processRawRows(rawData, columnMapping, normalizer);
    warnings.push(...processWarnings);

    return {
      fileName: file.name,
      fileSize: file.size,
      totalRegistrations: participants.length,
      participants,
      detectedEvents,
      columnMapping,
      warnings,
      errors,
      sheetNames,
      activeSheet: activeSheetName
    };
  } catch (err: any) {
    return {
      fileName: file.name,
      fileSize: file.size,
      totalRegistrations: 0,
      participants: [],
      detectedEvents: [],
      columnMapping: {
        registrationIdKey: null,
        fullNameKey: null,
        emailKey: null,
        mobileKey: null,
        collegeKey: null,
        technicalEventsKey: null,
        nonTechnicalEventsKey: null,
        participationModeKey: null,
        teamNameKey: null,
        verificationStatusKey: null,
        allColumns: []
      },
      warnings: [],
      errors: [err.message || 'Failed to parse the uploaded file. Please ensure it is a valid .xlsx, .xls, or .csv file.']
    };
  }
}
