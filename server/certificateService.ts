import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { serverSheetsService } from './sheetsService';
import { serverAuthService, AppUser } from './authService';

export type CertificateStatus = 'PENDING' | 'ISSUED';

export interface CertificateRecord {
  id: string; // Key: `${registrationId}__${canonicalEventKey}`
  registrationId: string;
  event: string; // Canonical Event Display Name
  eventKey: string; // Canonical Event Key (lowercase, trimmed)
  participantName: string;
  college?: string;
  status: CertificateStatus;
  issuedAt?: string;
  issuedBy?: string;
  updatedAt: string;
  updatedBy: string;
}

export const CERTIFICATE_SHEET_HEADERS = [
  'Certificate Record ID',
  'Registration ID',
  'Event',
  'Participant Name',
  'Certificate Status',
  'Issued At',
  'Issued By',
  'Updated At',
  'Updated By'
];

export function normalizeEventKey(eventName: string): string {
  return (eventName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export class CertificateService {
  private storageFilePath: string;
  private recordsMap: Map<string, CertificateRecord> = new Map();

  constructor() {
    this.storageFilePath = path.join(process.cwd(), 'server', 'certificates_store.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.records)) {
          this.recordsMap.clear();
          for (const rec of parsed.records) {
            const key = rec.id || `${rec.registrationId}__${normalizeEventKey(rec.event)}`;
            this.recordsMap.set(key, { ...rec, id: key });
          }
        }
        console.log(`[CertificateService:Store] Loaded ${this.recordsMap.size} certificate tracking records from local disk backup`);
      }
    } catch (err: any) {
      console.warn('[CertificateService:Store] Failed to load local certificate backup file:', err?.message);
    }
  }

  private saveToDisk() {
    try {
      const records = Array.from(this.recordsMap.values());
      const data = {
        headers: CERTIFICATE_SHEET_HEADERS,
        records,
        updatedAt: new Date().toISOString()
      };
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[CertificateService:Store] Failed to save certificate backup file:', err?.message);
    }
  }

  public getAllRecords(): CertificateRecord[] {
    return Array.from(this.recordsMap.values());
  }

  public getRecord(registrationId: string, eventName: string): CertificateRecord | undefined {
    const key = `${registrationId}__${normalizeEventKey(eventName)}`;
    return this.recordsMap.get(key);
  }

  public updateCertificateStatus(
    registrationId: string,
    eventName: string,
    status: CertificateStatus,
    participantName: string = '',
    actorUser: AppUser,
    college: string = ''
  ): CertificateRecord {
    // Only ADMIN and CERTIFICATE roles can modify status
    if (actorUser.role !== 'ADMIN' && actorUser.role !== 'CERTIFICATE') {
      serverAuthService.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'ACCESS_DENIED',
        details: `Unauthorized attempt to modify certificate status for ${registrationId} (${eventName})`,
        targetId: registrationId,
        status: 'DENIED'
      });
      throw new Error(`Forbidden: Modifying certificate status is restricted to ADMIN and CERTIFICATE roles. Current role: ${actorUser.role}`);
    }

    const eventKey = normalizeEventKey(eventName);
    const id = `${registrationId}__${eventKey}`;
    const now = new Date().toISOString();
    const actorIdentifier = actorUser.name ? `${actorUser.name} (${actorUser.email})` : actorUser.email;

    let record = this.recordsMap.get(id);
    const prevStatus = record?.status || 'PENDING';

    if (record) {
      record.status = status;
      record.updatedAt = now;
      record.updatedBy = actorIdentifier;
      if (participantName) record.participantName = participantName;
      if (college) record.college = college;
      if (status === 'ISSUED') {
        record.issuedAt = record.issuedAt || now;
        record.issuedBy = record.issuedBy || actorIdentifier;
      }
    } else {
      record = {
        id,
        registrationId,
        event: eventName,
        eventKey,
        participantName: participantName || registrationId,
        college,
        status,
        issuedAt: status === 'ISSUED' ? now : undefined,
        issuedBy: status === 'ISSUED' ? actorIdentifier : undefined,
        updatedAt: now,
        updatedBy: actorIdentifier
      };
      this.recordsMap.set(id, record);
    }

    this.saveToDisk();

    // Log to Audit trail
    serverAuthService.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: status === 'ISSUED' ? 'OFFLINE_REGISTRATION_UPDATED' : 'OFFLINE_REGISTRATION_UPDATED',
      details: `Certificate for ${record.participantName} [${registrationId}] for event '${eventName}' set to ${status} (was ${prevStatus})`,
      targetId: id,
      status: 'SUCCESS'
    });

    return record;
  }

  public bulkUpdateStatus(
    updates: Array<{
      registrationId: string;
      event: string;
      status: CertificateStatus;
      participantName?: string;
      college?: string;
    }>,
    actorUser: AppUser
  ): CertificateRecord[] {
    if (actorUser.role !== 'ADMIN' && actorUser.role !== 'CERTIFICATE') {
      serverAuthService.logAudit({
        userEmail: actorUser.email,
        userName: actorUser.name,
        role: actorUser.role,
        action: 'ACCESS_DENIED',
        details: `Unauthorized attempt to bulk update ${updates.length} certificates`,
        status: 'DENIED'
      });
      throw new Error(`Forbidden: Bulk updating certificates is restricted to ADMIN and CERTIFICATE roles.`);
    }

    const updatedRecords: CertificateRecord[] = [];
    const now = new Date().toISOString();
    const actorIdentifier = actorUser.name ? `${actorUser.name} (${actorUser.email})` : actorUser.email;

    for (const item of updates) {
      const eventKey = normalizeEventKey(item.event);
      const id = `${item.registrationId}__${eventKey}`;

      let record = this.recordsMap.get(id);
      if (record) {
        record.status = item.status;
        record.updatedAt = now;
        record.updatedBy = actorIdentifier;
        if (item.participantName) record.participantName = item.participantName;
        if (item.college) record.college = item.college;
        if (item.status === 'ISSUED') {
          record.issuedAt = record.issuedAt || now;
          record.issuedBy = record.issuedBy || actorIdentifier;
        }
      } else {
        record = {
          id,
          registrationId: item.registrationId,
          event: item.event,
          eventKey,
          participantName: item.participantName || item.registrationId,
          college: item.college || '',
          status: item.status,
          issuedAt: item.status === 'ISSUED' ? now : undefined,
          issuedBy: item.status === 'ISSUED' ? actorIdentifier : undefined,
          updatedAt: now,
          updatedBy: actorIdentifier
        };
        this.recordsMap.set(id, record);
      }
      updatedRecords.push(record);
    }

    this.saveToDisk();

    serverAuthService.logAudit({
      userEmail: actorUser.email,
      userName: actorUser.name,
      role: actorUser.role,
      action: 'DATA_SYNCED',
      details: `Bulk updated ${updatedRecords.length} certificate statuses by ${actorIdentifier}`,
      status: 'SUCCESS'
    });

    return updatedRecords;
  }
}

export const serverCertificateService = new CertificateService();
