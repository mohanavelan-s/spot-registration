import {
  DetectedEvent,
  OfflineRegistrationRecord,
  Participant,
  CombinedStats,
  RegistrationSource
} from '../types';
import { EventNormalizer, defaultNormalizer } from './normalizer';
import { DEFAULT_EVENT_REGISTRY } from '../config/defaultAliases';

/**
 * Converts a raw Google Sheets Offline Registration Record into the standardized Participant model
 * using the EXACT same canonical event normalizer.
 */
export function convertOfflineRecordToParticipant(
  record: OfflineRegistrationRecord,
  normalizer: EventNormalizer = defaultNormalizer
): Participant {
  // Parse event string (which can be comma, semicolon, pipe separated or single event)
  const eventTokens = normalizer.parseEventCell(record.event || '');
  const techKeys: string[] = [];
  const nonTechKeys: string[] = [];
  const rawOccurrences: string[] = [];

  for (const token of eventTokens) {
    if (!token.trim()) continue;
    rawOccurrences.push(token.trim());
    const normalized = normalizer.normalize(token);
    if (normalized.canonicalKey) {
      if (normalized.category === 'Technical') {
        if (!techKeys.includes(normalized.canonicalKey)) {
          techKeys.push(normalized.canonicalKey);
        }
      } else if (normalized.category === 'Non-Technical') {
        if (!nonTechKeys.includes(normalized.canonicalKey)) {
          nonTechKeys.push(normalized.canonicalKey);
        }
      } else {
        // 'Both' or unspecified - include in both arrays
        if (!techKeys.includes(normalized.canonicalKey)) techKeys.push(normalized.canonicalKey);
        if (!nonTechKeys.includes(normalized.canonicalKey)) nonTechKeys.push(normalized.canonicalKey);
      }
    }
  }

  const allEvents = Array.from(new Set([...techKeys, ...nonTechKeys]));

  return {
    id: record.offlineRegistrationId,
    registrationId: record.offlineRegistrationId,
    fullName: record.fullName || 'Anonymous Participant',
    email: record.email || '',
    mobile: record.mobile || '',
    college: record.college || 'Not Specified',
    department: record.department || undefined,
    yearSection: record.yearSection || undefined,
    technicalEventsRaw: techKeys.length > 0 ? record.event : '',
    nonTechnicalEventsRaw: nonTechKeys.length > 0 ? record.event : '',
    technicalEvents: techKeys,
    nonTechnicalEvents: nonTechKeys,
    allEvents,
    participationMode: record.teamName ? 'Team' : 'Individual',
    teamName: record.teamName || '',
    verificationStatus: record.verificationStatus || 'Verified',
    source: 'OFFLINE',
    registeredAt: record.registeredAt || '',
    registeredBy: record.registeredBy || 'Desk Admin',
    updatedAt: record.updatedAt || '',
    updatedBy: record.updatedBy || '',
    status: record.status || 'ACTIVE',
    rawRow: {
      'Offline Registration ID': record.offlineRegistrationId,
      'Full Name': record.fullName,
      'Email Address': record.email,
      'Mobile Number': record.mobile,
      'College / Institution': record.college,
      'Department': record.department,
      'Year / Section': record.yearSection,
      'Event': record.event,
      'Team Name': record.teamName,
      'Verification Status': record.verificationStatus,
      'Registered At': record.registeredAt,
      'Registered By': record.registeredBy,
      'Updated At': record.updatedAt,
      'Updated By': record.updatedBy,
      'Status': record.status
    }
  };
}

/**
 * Detects possible duplicate registrations across ONLINE and OFFLINE sources without deleting any record.
 * Flags matching identifiers (Mobile, Email, or Name + College) for coordinator awareness.
 */
export function detectCrossSourceDuplicates(
  onlineParticipants: Participant[],
  offlineParticipants: Participant[]
): void {
  // Reset previous duplicate flags on offline participants
  offlineParticipants.forEach(off => {
    off.isPossibleDuplicate = false;
    off.duplicateInfo = undefined;
  });

  const onlineByMobile = new Map<string, Participant>();
  const onlineByEmail = new Map<string, Participant>();
  const onlineByNameCollege = new Map<string, Participant>();

  for (const onl of onlineParticipants) {
    const cleanMobile = (onl.mobile || '').replace(/\D/g, '');
    if (cleanMobile.length >= 7) {
      onlineByMobile.set(cleanMobile, onl);
    }
    const cleanEmail = (onl.email || '').trim().toLowerCase();
    if (cleanEmail && cleanEmail.includes('@')) {
      onlineByEmail.set(cleanEmail, onl);
    }
    const cleanName = (onl.fullName || '').trim().toLowerCase();
    const cleanCollege = (onl.college || '').trim().toLowerCase();
    if (cleanName && cleanCollege && cleanCollege !== 'not specified') {
      onlineByNameCollege.set(`${cleanName}__${cleanCollege}`, onl);
    }
  }

  for (const off of offlineParticipants) {
    const cleanMobile = (off.mobile || '').replace(/\D/g, '');
    const cleanEmail = (off.email || '').trim().toLowerCase();
    const cleanName = (off.fullName || '').trim().toLowerCase();
    const cleanCollege = (off.college || '').trim().toLowerCase();

    // Check Mobile match first
    if (cleanMobile.length >= 7 && onlineByMobile.has(cleanMobile)) {
      const match = onlineByMobile.get(cleanMobile)!;
      off.isPossibleDuplicate = true;
      off.duplicateInfo = {
        matchedId: match.registrationId,
        matchedSource: 'ONLINE',
        matchedName: match.fullName,
        matchedEvent: match.allEvents.join(', '),
        reason: `Mobile number (${off.mobile}) matches online registration ${match.registrationId}`
      };
      continue;
    }

    // Check Email match
    if (cleanEmail && cleanEmail.includes('@') && onlineByEmail.has(cleanEmail)) {
      const match = onlineByEmail.get(cleanEmail)!;
      off.isPossibleDuplicate = true;
      off.duplicateInfo = {
        matchedId: match.registrationId,
        matchedSource: 'ONLINE',
        matchedName: match.fullName,
        matchedEvent: match.allEvents.join(', '),
        reason: `Email address (${off.email}) matches online registration ${match.registrationId}`
      };
      continue;
    }

    // Check Name + College match
    const nameCollegeKey = `${cleanName}__${cleanCollege}`;
    if (cleanName && cleanCollege && cleanCollege !== 'not specified' && onlineByNameCollege.has(nameCollegeKey)) {
      const match = onlineByNameCollege.get(nameCollegeKey)!;
      off.isPossibleDuplicate = true;
      off.duplicateInfo = {
        matchedId: match.registrationId,
        matchedSource: 'ONLINE',
        matchedName: match.fullName,
        matchedEvent: match.allEvents.join(', '),
        reason: `Participant "${off.fullName}" from "${off.college}" matches online registration ${match.registrationId}`
      };
    }
  }
}

/**
 * Builds combined canonical event rosters for all symposium events.
 * Correctly combines:
 * Online participant count for event
 * + Active Offline participant count for event (Cancelled excluded)
 * = Combined total for event
 */
export function buildCombinedEvents(
  onlineParticipants: Participant[],
  offlineParticipants: Participant[],
  normalizer: EventNormalizer = defaultNormalizer,
  baseDetectedEvents: DetectedEvent[] = []
): DetectedEvent[] {
  const registry = normalizer.getRegistry();
  const allEventKeys = new Set<string>();

  // 1. Add all official canonical events from registry
  Object.keys(registry).forEach(key => allEventKeys.add(key));

  // 2. Add any events already detected in online parser
  baseDetectedEvents.forEach(e => allEventKeys.add(e.key));

  // 3. Add any events present in online participants
  onlineParticipants.forEach(p => p.allEvents.forEach(k => allEventKeys.add(k)));

  // 4. Add any events present in offline participants
  offlineParticipants.forEach(p => p.allEvents.forEach(k => allEventKeys.add(k)));

  const combinedEvents: DetectedEvent[] = [];

  // Active offline participants only for active event counts
  const activeOfflineParticipants = offlineParticipants.filter(p => p.status !== 'CANCELLED');

  for (const eventKey of allEventKeys) {
    if (!eventKey) continue;

    const registryConfig = registry[eventKey];
    const baseDetected = baseDetectedEvents.find(e => e.key === eventKey);

    // Online count for this event
    const onlineCount = onlineParticipants.filter(p => p.allEvents.includes(eventKey)).length;

    // Active Offline count for this event
    const offlineCount = activeOfflineParticipants.filter(p => p.allEvents.includes(eventKey)).length;

    const combinedCount = onlineCount + offlineCount;

    // Determine canonical Display Name
    const displayName = registryConfig?.displayName || baseDetected?.displayName || normalizer.normalize(eventKey).displayName;

    // Determine category
    const category = registryConfig?.category || baseDetected?.category || normalizer.normalize(eventKey).category;

    // Collect aliases & sample occurrences
    const aliases = registryConfig?.aliases || baseDetected?.aliases || [];
    const sampleOccurrences = baseDetected?.sampleRawOccurrences || [displayName];

    combinedEvents.push({
      key: eventKey,
      displayName,
      category,
      participantCount: combinedCount,
      onlineCount,
      offlineCount,
      combinedCount,
      aliases,
      sampleRawOccurrences: sampleOccurrences
    });
  }

  // Sort canonical events: Technical first alphabetically, then Non-Technical alphabetically
  combinedEvents.sort((a, b) => {
    if (a.category !== b.category) {
      if (a.category === 'Technical') return -1;
      if (b.category === 'Technical') return 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return combinedEvents;
}

export interface CombineDatasetsParams {
  onlineParticipants: Participant[];
  offlineRecords: OfflineRegistrationRecord[];
  normalizer?: EventNormalizer;
  baseDetectedEvents?: DetectedEvent[];
  isOfflineAvailable?: boolean;
  offlineSourceType?: string;
  offlineErrorMessage?: string;
  lastSyncedAt?: string;
}

export interface CombineDatasetsResult {
  combinedParticipants: Participant[];
  combinedEvents: DetectedEvent[];
  stats: CombinedStats;
}

/**
 * Primary Engine Function:
 * Combines Online and Offline registration datasets in-memory.
 */
export function combineDatasets({
  onlineParticipants,
  offlineRecords,
  normalizer = defaultNormalizer,
  baseDetectedEvents = [],
  isOfflineAvailable = true,
  offlineSourceType = 'GOOGLE_SHEETS',
  offlineErrorMessage,
  lastSyncedAt
}: CombineDatasetsParams): CombineDatasetsResult {
  // 1. Convert Offline Google Sheet records to Participant models
  const offlineParticipants = offlineRecords.map(record =>
    convertOfflineRecordToParticipant(record, normalizer)
  );

  // 2. Perform duplicate check across online & offline
  detectCrossSourceDuplicates(onlineParticipants, offlineParticipants);

  // 3. Combined participants list (contains both online and offline)
  const combinedParticipants = [...onlineParticipants, ...offlineParticipants];

  // 4. Build combined canonical events
  const combinedEvents = buildCombinedEvents(
    onlineParticipants,
    offlineParticipants,
    normalizer,
    baseDetectedEvents
  );

  // 5. Calculate unique participant metrics & participation totals
  const onlineUniqueCount = onlineParticipants.length;
  const offlineActiveCount = offlineParticipants.filter(p => p.status !== 'CANCELLED').length;
  const offlineCancelledCount = offlineParticipants.filter(p => p.status === 'CANCELLED').length;

  // Total unique participants (Online + Active Offline, minus any flagged exact duplicate IDs)
  const totalUniqueRegistrations = onlineUniqueCount + offlineActiveCount;

  // Sum of all event participations across all active registrations
  let totalEventParticipations = 0;
  for (const p of onlineParticipants) {
    totalEventParticipations += p.allEvents.length;
  }
  for (const p of offlineParticipants) {
    if (p.status !== 'CANCELLED') {
      totalEventParticipations += p.allEvents.length;
    }
  }

  const possibleDuplicatesCount = offlineParticipants.filter(
    p => p.status !== 'CANCELLED' && p.isPossibleDuplicate
  ).length;

  const stats: CombinedStats = {
    totalUniqueRegistrations,
    onlineUniqueRegistrations: onlineUniqueCount,
    offlineActiveRegistrations: offlineActiveCount,
    offlineCancelledRegistrations: offlineCancelledCount,
    totalEventParticipations,
    detectedEventsCount: combinedEvents.length,
    possibleDuplicatesCount,
    lastSyncedAt: lastSyncedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    isOfflineAvailable,
    offlineSourceType,
    offlineErrorMessage
  };

  return {
    combinedParticipants,
    combinedEvents,
    stats
  };
}
