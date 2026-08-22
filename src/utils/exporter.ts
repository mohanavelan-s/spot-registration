import * as XLSX from 'xlsx';
import { Participant } from '../types';

export interface ExportColumnOption {
  key: string;
  label: string;
  enabled: boolean;
  getValue: (p: Participant) => string;
}

export const DEFAULT_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'registrationId', label: 'Registration ID', enabled: true, getValue: p => p.registrationId },
  { key: 'source', label: 'Registration Source', enabled: true, getValue: p => p.source },
  { key: 'fullName', label: 'Full Name', enabled: true, getValue: p => p.fullName },
  { key: 'email', label: 'Email Address', enabled: true, getValue: p => p.email },
  { key: 'mobile', label: 'Mobile Number', enabled: true, getValue: p => p.mobile },
  { key: 'college', label: 'College / Institution', enabled: true, getValue: p => p.college },
  { key: 'department', label: 'Department', enabled: true, getValue: p => p.department || 'N/A' },
  { key: 'yearSection', label: 'Year / Section', enabled: true, getValue: p => p.yearSection || 'N/A' },
  { key: 'teamName', label: 'Team Name', enabled: true, getValue: p => p.teamName || 'N/A' },
  { key: 'participationMode', label: 'Participation Mode', enabled: true, getValue: p => p.participationMode },
  { key: 'technicalEventsRaw', label: 'Technical Events Registered', enabled: true, getValue: p => p.technicalEventsRaw },
  { key: 'nonTechnicalEventsRaw', label: 'Non-Technical Events Registered', enabled: true, getValue: p => p.nonTechnicalEventsRaw },
  { key: 'verificationStatus', label: 'Verification Status', enabled: true, getValue: p => p.verificationStatus },
  { key: 'registeredAt', label: 'Registered At', enabled: true, getValue: p => p.registeredAt || 'N/A' }
];

/**
 * Format clean filename e.g. "AIROX26_The_Final_Hire_Participants.xlsx"
 */
export function generateExportFilename(eventName: string, extension: 'xlsx' | 'csv'): string {
  const cleanEvent = (eventName || 'All_Participants')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `AIROX26_${cleanEvent}_Participants.${extension}`;
}

/**
 * Export participants to XLSX
 */
export function exportToXLSX(
  participants: Participant[],
  eventName: string,
  columns: ExportColumnOption[] = DEFAULT_EXPORT_COLUMNS
) {
  const activeColumns = columns.filter(c => c.enabled);

  // Prepare table data
  const rows = participants.map((p, idx) => {
    const rowObj: Record<string, any> = {
      'S.No': idx + 1
    };
    for (const col of activeColumns) {
      rowObj[col.label] = col.getValue(p);
    }
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = [{ wch: 6 }]; // S.No
  for (const col of activeColumns) {
    const maxLen = Math.max(
      col.label.length,
      ...participants.map(p => String(col.getValue(p) || '').length)
    );
    colWidths.push({ wch: Math.min(Math.max(maxLen + 3, 12), 45) });
  }
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  const safeSheetName = (eventName || 'Participants').slice(0, 30).replace(/[:\/\\?*\[\]]/g, '_');
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName || 'Participants');

  // Also create a Summary Sheet
  const onlineCount = participants.filter(p => p.source === 'ONLINE').length;
  const offlineCount = participants.filter(p => p.source === 'OFFLINE').length;

  const summaryData = [
    { Property: 'Symposium', Value: "AIROX '26" },
    { Property: 'Extracted Event', Value: eventName || 'All Events' },
    { Property: 'Total Combined Participants', Value: participants.length },
    { Property: 'Online Registrations', Value: onlineCount },
    { Property: 'Offline Registrations', Value: offlineCount },
    { Property: 'Verified Participants', Value: participants.filter(p => p.verificationStatus === 'Verified').length },
    { Property: 'Pending Participants', Value: participants.filter(p => p.verificationStatus === 'Pending').length },
    { Property: 'Rejected Participants', Value: participants.filter(p => p.verificationStatus === 'Rejected').length },
    { Property: 'Export Timestamp', Value: new Date().toLocaleString() }
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Extraction Summary');

  const filename = generateExportFilename(eventName, 'xlsx');
  XLSX.writeFile(workbook, filename);
}

import { getAuthHeaders } from '../services/auth';

/**
 * Server-Enforced RBAC Export: Downloads authoritative roster from backend
 */
export async function exportFromServer(
  eventKey: string,
  eventName: string,
  format: 'xlsx' | 'csv' = 'xlsx',
  fallbackParticipants?: Participant[]
): Promise<void> {
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventKey)}/export?format=${format}`, {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateExportFilename(eventName, format);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }
  } catch (err) {
    console.warn('[Exporter] Backend export failed, using client-side export fallback:', err);
  }

  // Fallback if client-side records provided
  if (fallbackParticipants && fallbackParticipants.length > 0) {
    if (format === 'csv') {
      exportToCSV(fallbackParticipants, eventName);
    } else {
      exportToXLSX(fallbackParticipants, eventName);
    }
  }
}

/**
 * Export participants to CSV
 */
export function exportToCSV(
  participants: Participant[],
  eventName: string,
  columns: ExportColumnOption[] = DEFAULT_EXPORT_COLUMNS
) {
  const activeColumns = columns.filter(c => c.enabled);

  const rows = participants.map((p, idx) => {
    const rowObj: Record<string, any> = {
      'S.No': idx + 1
    };
    for (const col of activeColumns) {
      rowObj[col.label] = col.getValue(p);
    }
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);

  // Trigger browser download with UTF-8 BOM
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', generateExportFilename(eventName, 'csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
