import * as XLSX from 'xlsx';
import { serverSheetsService } from './sheetsService';
import { serverAuthService, AppUser as ServerAppUser } from './authService';
import { Participant, AppUser } from '../src/types';
import { processRawRows, detectColumnMapping } from '../src/utils/fileParser';
import { defaultNormalizer, getStrippedKey } from '../src/utils/normalizer';
import { convertOfflineRecordToParticipant, detectCrossSourceDuplicates, buildCombinedEvents } from '../src/utils/combinedEngine';

export class ServerCombinedService {
  /**
   * Generates the complete, normalized combined dataset (Online + Offline)
   */
  public async getCombinedDataset(): Promise<{
    participants: Participant[];
    onlineCount: number;
    offlineCount: number;
    duplicateCount: number;
    events: any[];
  }> {
    // 1. Fetch Online Raw Rows
    const onlineData = await serverSheetsService.fetchOnlineRegistrations();
    const onlineRows = onlineData.rows || [];
    const onlineHeaders = onlineData.headers || (onlineRows.length > 0 ? Object.keys(onlineRows[0]) : []);

    let onlineParticipants: Participant[] = [];
    if (onlineRows.length > 0) {
      const mapping = detectColumnMapping(onlineHeaders);
      const parsed = processRawRows(onlineRows, mapping, defaultNormalizer);
      onlineParticipants = parsed.participants;
    }

    // 2. Fetch Offline Google Sheet Records
    const offlineData = await serverSheetsService.fetchRegistrations();
    const offlineRecords = (offlineData.records || []).filter(r => r.status !== 'CANCELLED');

    const offlineParticipants: Participant[] = offlineRecords.map(rec =>
      convertOfflineRecordToParticipant(rec as any, defaultNormalizer)
    );

    // 3. Detect Cross-Source Duplicates
    detectCrossSourceDuplicates(onlineParticipants, offlineParticipants);
    const duplicateCount = offlineParticipants.filter(p => p.isPossibleDuplicate).length;

    // 4. Combine
    const allCombined = [...onlineParticipants, ...offlineParticipants];
    const events = buildCombinedEvents(onlineParticipants, offlineParticipants, defaultNormalizer);

    return {
      participants: allCombined,
      onlineCount: onlineParticipants.length,
      offlineCount: offlineParticipants.length,
      duplicateCount,
      events
    };
  }

  /**
   * Get combined dataset filtered by user permissions (RBAC)
   */
  public async getAuthorizedParticipants(user: AppUser | ServerAppUser): Promise<{
    participants: Participant[];
    onlineCount: number;
    offlineCount: number;
    totalCount: number;
  }> {
    const dataset = await this.getCombinedDataset();

    // If user is EVENT_COORDINATOR, filter to only assigned events
    if (user.role === 'EVENT_COORDINATOR' && (!user.secondaryRoles || !user.secondaryRoles.includes('ADMIN'))) {
      const assigned = user.assignedEvents || [];
      if (assigned.length === 0) {
        return {
          participants: [],
          onlineCount: 0,
          offlineCount: 0,
          totalCount: 0
        };
      }

      const assignedKeys = assigned.map(e => getStrippedKey(e));
      const filtered = dataset.participants.filter(p => {
        return p.allEvents.some(ev => {
          const evKey = getStrippedKey(ev);
          return assignedKeys.some(ak => ak === evKey || evKey.includes(ak) || ak.includes(evKey));
        });
      });

      const onlineCount = filtered.filter(p => p.source === 'ONLINE').length;
      const offlineCount = filtered.filter(p => p.source === 'OFFLINE').length;

      return {
        participants: filtered,
        onlineCount,
        offlineCount,
        totalCount: filtered.length
      };
    }

    // ADMIN, DATABASE, CERTIFICATE, ON_SPOT, REGISTRATION
    return {
      participants: dataset.participants,
      onlineCount: dataset.onlineCount,
      offlineCount: dataset.offlineCount,
      totalCount: dataset.participants.length
    };
  }

  /**
   * Get single event roster with RBAC check
   */
  public async getEventRoster(eventKeyOrName: string, user: AppUser | ServerAppUser): Promise<Participant[]> {
    if (!serverAuthService.canUserAccessEvent(user as any, eventKeyOrName)) {
      throw new Error(`Forbidden: You are not authorized to view roster for event '${eventKeyOrName}'`);
    }

    const dataset = await this.getCombinedDataset();
    const targetKey = getStrippedKey(eventKeyOrName);

    return dataset.participants.filter(p => {
      if (p.status === 'CANCELLED') return false;
      return p.allEvents.some(ev => {
        const evKey = getStrippedKey(ev);
        return evKey === targetKey || evKey.includes(targetKey) || targetKey.includes(evKey);
      });
    });
  }

  /**
   * Export single event roster to XLSX or CSV buffer
   */
  public async exportEventRoster(
    eventKeyOrName: string,
    user: AppUser | ServerAppUser,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const participants = await this.getEventRoster(eventKeyOrName, user);

    const rows = participants.map((p, idx) => ({
      'S.No': idx + 1,
      'Registration ID': p.registrationId,
      'Source': p.source,
      'Full Name': p.fullName,
      'Email Address': p.email,
      'Mobile Number': p.mobile,
      'College / Institution': p.college,
      'Department': p.department || 'N/A',
      'Year / Section': p.yearSection || 'N/A',
      'Event': eventKeyOrName,
      'Team Name': p.teamName || 'N/A',
      'Verification Status': p.verificationStatus,
      'Registered At': p.registeredAt || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const safeEventName = eventKeyOrName.replace(/[^a-zA-Z0-9]/g, '_');

    if (format === 'csv') {
      const csvString = XLSX.utils.sheet_to_csv(worksheet);
      return {
        buffer: Buffer.from(csvString, 'utf-8'),
        filename: `AIROX26_${safeEventName}_Combined_Roster.csv`,
        contentType: 'text/csv; charset=utf-8'
      };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

    // Add Summary Sheet
    const summaryData = [
      { Metric: 'Symposium', Value: "AIROX '26" },
      { Metric: 'Event Name', Value: eventKeyOrName },
      { Metric: 'Total Participants', Value: participants.length },
      { Metric: 'Online Registrations', Value: participants.filter(p => p.source === 'ONLINE').length },
      { Metric: 'Offline Registrations', Value: participants.filter(p => p.source === 'OFFLINE').length },
      { Metric: 'Verified Participants', Value: participants.filter(p => p.verificationStatus === 'Verified').length },
      { Metric: 'Export Generated By', Value: `${user.name} (${user.role})` },
      { Metric: 'Export Timestamp', Value: new Date().toISOString() }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer: xlsxBuffer,
      filename: `AIROX26_${safeEventName}_Combined_Roster.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }
}

export const serverCombinedService = new ServerCombinedService();
