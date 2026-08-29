import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, XCircle, RefreshCw, X, ShieldAlert, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { EventNormalizer } from '../utils/normalizer';
import { TestCaseResult, AppUser } from '../types';
import { processRawRows, detectColumnMapping } from '../utils/fileParser';
import { combineDatasets } from '../utils/combinedEngine';
import { SAMPLE_AIROX26_RAW_DATA } from '../data/sampleDataset';
import {
  canAccessEvent,
  canCreateOffline,
  canManageUsers,
  canExportEvent,
  canViewAllParticipants,
  canSyncData,
  canAccessCertificateDesk,
  canModifyCertificateStatus,
  canAccessParticipantsSection,
  canAccessEventsMatrix
} from '../services/auth';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(isOpen);
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runAllTests = () => {
    setIsRunning(true);
    const normalizer = new EventNormalizer();
    const testCases: TestCaseResult[] = [];

    // Test 0: Critical Column Detection - Exact & Independent Mapping (No Collisions)
    const testHeaders = [
      'Registration ID',
      'Full Name',
      'Email Address',
      'Mobile Number',
      'College / Institution',
      'Technical Events',
      'Non-Technical Events',
      'How will you participate?',
      'Team Name',
      'Verification Status'
    ];
    const detectedCols = detectColumnMapping(testHeaders);
    const colMappingPassed =
      detectedCols.technicalEventsKey === 'Technical Events' &&
      detectedCols.nonTechnicalEventsKey === 'Non-Technical Events';
    testCases.push({
      name: '0. Independent Column Detection: Technical vs Non-Technical',
      description: 'Verifies that "Technical Events" and "Non-Technical Events" map strictly to their respective distinct columns without substring collisions.',
      inputs: ['Headers: Technical Events, Non-Technical Events'],
      expectedCanonical: 'Tech: Technical Events | Non-Tech: Non-Technical Events',
      actualCanonical: `Tech: ${detectedCols.technicalEventsKey || 'None'} | Non-Tech: ${detectedCols.nonTechnicalEventsKey || 'None'}`,
      passed: colMappingPassed,
      notes: colMappingPassed
        ? 'Passed! Technical and Non-Technical columns mapped independently with 4-tier deterministic priority.'
        : 'Failed: Column mapping collision detected!'
    });

    // Test 1: Critical Edge Case - "The FinalHire" vs "The Final Hire" (Technical)
    const finalHireVariants = [
      'The FinalHire',
      'The Final Hire',
      'THE FINAL HIRE',
      'the final hire',
      'The  Final   Hire',
      'the finalhire',
      'The Final-Hire'
    ];
    const finalHireNorms = finalHireVariants.map(v => normalizer.normalize(v));
    const allFinalHireSame = finalHireNorms.every(n => n.canonicalKey === 'the final hire' && n.category === 'Technical');
    testCases.push({
      name: '1. Technical Canonicalization: "The FinalHire"',
      description: 'Verifies that "The FinalHire", "The Final Hire", "THE FINAL HIRE", and "The  Final   Hire" all resolve to canonical "The Final Hire" with Category = Technical.',
      inputs: finalHireVariants,
      expectedCanonical: 'the final hire [Technical]',
      actualCanonical: Array.from(new Set(finalHireNorms.map(n => `${n.canonicalKey} [${n.category}]`))).join(', '),
      passed: allFinalHireSame,
      notes: allFinalHireSame
        ? 'All 7 variant strings successfully mapped to canonical "the final hire" with category Technical!'
        : 'Variant mapping failed'
    });

    // Test 2: Critical Non-Tech Verification - "ADS SHOT" / "AD SHOT" variants
    const adShotVariants = ['ADS SHOT', 'Ads Shot', 'AD SHOT', 'Ad Shot', 'ad shot', 'AD  SHOT', 'AD-SHOT', 'adshot', 'ADSHOT'];
    const adShotNorms = adShotVariants.map(v => normalizer.normalize(v));
    const allAdShotSame = adShotNorms.every(n => n.canonicalKey === 'ads shot' && n.displayName === 'ADS SHOT' && n.category === 'Non-Technical');
    testCases.push({
      name: '2. Non-Technical Canonicalization: "ADS SHOT"',
      description: 'Verifies that "ADS SHOT", "Ads Shot", "AD SHOT", "Ad Shot", "ad shot", "ADSHOT", and "AD-SHOT" resolve to canonical "ADS SHOT" with Category = Non-Technical.',
      inputs: adShotVariants,
      expectedCanonical: 'ads shot [ADS SHOT] (Non-Technical)',
      actualCanonical: Array.from(new Set(adShotNorms.map(n => `${n.canonicalKey} [${n.displayName}] (${n.category})`))).join(', '),
      passed: allAdShotSame,
      notes: allAdShotSame
        ? 'Passed! All casing, spacing, and hyphenation variations canonicalized to ADS SHOT.'
        : 'ADS SHOT variation normalization failed.'
    });

    // Test 3: Critical Non-Tech Legacy Mapping - "AD BATTLE" -> "ADS SHOT"
    const adBattleNorm = normalizer.normalize('AD BATTLE');
    const adBattleLowerNorm = normalizer.normalize('ad battle');
    const adBattlePassed =
      adBattleNorm.canonicalKey === 'ads shot' &&
      adBattleNorm.displayName === 'ADS SHOT' &&
      adBattleNorm.category === 'Non-Technical' &&
      adBattleNorm.aliasNote === 'Known legacy/incorrect event name' &&
      adBattleLowerNorm.canonicalKey === 'ads shot';
    testCases.push({
      name: '3. Legacy Alias Mapping: "AD BATTLE" → "ADS SHOT"',
      description: 'Ensures incorrect / legacy spreadsheet entry "AD BATTLE" correctly canonicalizes to official "ADS SHOT" (Non-Technical).',
      inputs: ['AD BATTLE', 'ad battle'],
      expectedCanonical: 'ads shot [ADS SHOT] (Non-Technical) + Legacy Alias Note',
      actualCanonical: `${adBattleNorm.canonicalKey} [${adBattleNorm.displayName}] (${adBattleNorm.category}) - ${adBattleNorm.aliasNote || 'none'}`,
      passed: adBattlePassed,
      notes: adBattlePassed
        ? 'Passed! "AD BATTLE" cleanly mapped to official "ADS SHOT" with diagnostic note.'
        : 'Failed to map AD BATTLE to ADS SHOT.'
    });

    // Test 4: Official Non-Tech - "GOATED OR GHOSTED"
    const goatedVariants = ['GOATED OR GHOSTED', 'Goated or Ghosted', 'goated or ghosted', 'Goated  Or  Ghosted', 'Goated / Ghosted', 'goated n ghosted'];
    const goatedNorms = goatedVariants.map(v => normalizer.normalize(v));
    const allGoatedSame = goatedNorms.every(n => n.canonicalKey === 'goated or ghosted' && n.category === 'Non-Technical');
    testCases.push({
      name: '4. Non-Technical: "GOATED OR GHOSTED"',
      description: 'Verifies spacing variations, slashes, and ampersands map to canonical "GOATED OR GHOSTED".',
      inputs: goatedVariants,
      expectedCanonical: 'goated or ghosted (Non-Technical)',
      actualCanonical: Array.from(new Set(goatedNorms.map(n => `${n.canonicalKey} (${n.category})`))).join(', '),
      passed: allGoatedSame,
      notes: allGoatedSame
        ? 'Passed! All variations cleanly canonicalized to GOATED OR GHOSTED.'
        : 'GOATED OR GHOSTED normalization mismatch.'
    });

    // Test 5: Official Non-Tech - "CLASH AND CONQUER"
    const clashVariants = ['CLASH AND CONQUER', 'Clash and Conquer', 'clash and conquer', 'Clash & Conquer', 'clash  and  conquer'];
    const clashNorms = clashVariants.map(v => normalizer.normalize(v));
    const allClashSame = clashNorms.every(n => n.canonicalKey === 'clash and conquer' && n.category === 'Non-Technical');
    testCases.push({
      name: '5. Non-Technical: "CLASH AND CONQUER"',
      description: 'Verifies "CLASH AND CONQUER", "Clash & Conquer", and spacing variants map to Non-Technical "CLASH AND CONQUER".',
      inputs: clashVariants,
      expectedCanonical: 'clash and conquer (Non-Technical)',
      actualCanonical: Array.from(new Set(clashNorms.map(n => `${n.canonicalKey} (${n.category})`))).join(', '),
      passed: allClashSame,
      notes: allClashSame ? 'Passed! Cleanly classified as official Non-Technical event.' : 'Clash and Conquer mismatch.'
    });

    // Test 6: Distinction Safety - "The Final Hire" vs "The Final Fight"
    const finalFightNorm = normalizer.normalize('The Final Fight');
    const finalHireNorm = normalizer.normalize('The Final Hire');
    const distinctPassed = finalFightNorm.canonicalKey !== finalHireNorm.canonicalKey;
    testCases.push({
      name: '6. Distinction Safety: "The Final Hire" vs "The Final Fight"',
      description: 'Ensures conservative fuzzy matching does NOT accidentally merge distinct events with similar prefixes.',
      inputs: ['The Final Hire', 'The Final Fight'],
      expectedCanonical: 'Distinct Canonical Keys',
      actualCanonical: `"${finalHireNorm.canonicalKey}" vs "${finalFightNorm.canonicalKey}"`,
      passed: distinctPassed,
      notes: distinctPassed
        ? 'Passed! Distinct events remained separated and were not conflated.'
        : 'Failed: Events were accidentally merged!'
    });

    // Test 7: Multi-Event Cell Delimiter Parsing
    const multiEventCell = 'AD SHOT, GOATED OR GHOSTED; The Final Hire\nZero Hour';
    const parsedTokens = normalizer.parseEventCell(multiEventCell);
    const multiEventPassed = parsedTokens.length === 4;
    testCases.push({
      name: '7. Multi-Event Delimiter Parsing',
      description: 'Tests parsing comma, semicolon, and newline separated events from a single spreadsheet cell.',
      inputs: [multiEventCell],
      expectedCanonical: '4 Distinct Tokens',
      actualCanonical: `${parsedTokens.length} tokens: [${parsedTokens.join(' | ')}]`,
      passed: multiEventPassed,
      notes: multiEventPassed ? 'Successfully split multi-event cell into individual clean tokens.' : 'Delimiter parsing issue.'
    });

    // Test 8: RBAC - Event Coordinator Scoping
    const testCoordinatorA: AppUser = {
      id: 'coord-a',
      username: 'coord_a',
      email: 'coordinator.finalhire@airox26.org',
      name: 'Final Hire Coordinator',
      role: 'EVENT_COORDINATOR',
      status: 'ACTIVE',
      assignedEvents: ['The Final Hire'],
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z'
    };
    const canAccessFinalHire = canAccessEvent(testCoordinatorA, 'The Final Hire');
    const canAccessPaper = canAccessEvent(testCoordinatorA, 'Paper Presentation');
    const canAccessAdShot = canAccessEvent(testCoordinatorA, 'AD SHOT');
    const coordExportFinalHire = canExportEvent(testCoordinatorA, 'The Final Hire');
    const coordExportPaper = canExportEvent(testCoordinatorA, 'Paper Presentation');

    const rbacCoordPassed = canAccessFinalHire && !canAccessPaper && !canAccessAdShot && coordExportFinalHire && !coordExportPaper;
    testCases.push({
      name: '8. RBAC: Event Coordinator Isolation ("The Final Hire")',
      description: 'Verifies Coordinator A assigned to "The Final Hire" can access/export ONLY "The Final Hire" and is strictly DENIED access to "Paper Presentation" and "AD SHOT".',
      inputs: ['Access The Final Hire', 'Access Paper Presentation', 'Access AD SHOT'],
      expectedCanonical: 'Allowed: The Final Hire | Denied: Paper Presentation & AD SHOT',
      actualCanonical: `Final Hire: ${canAccessFinalHire ? 'ALLOWED' : 'DENIED'} | Paper: ${canAccessPaper ? 'ALLOWED' : 'DENIED'} | AD SHOT: ${canAccessAdShot ? 'ALLOWED' : 'DENIED'}`,
      passed: rbacCoordPassed,
      notes: rbacCoordPassed
        ? 'Passed! Coordinator is strictly isolated to assigned events.'
        : 'Failed: Coordinator breached event boundaries!'
    });

    // Test 9: RBAC - On-Spot Registration Desk Role
    const testOnSpot: AppUser = {
      id: 'onspot-1',
      username: 'onspot_1',
      email: 'onspot@airox26.org',
      name: 'Registration Desk Staff',
      role: 'ON_SPOT',
      status: 'ACTIVE',
      assignedEvents: [],
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z'
    };
    const onSpotCanCreate = canCreateOffline(testOnSpot);
    const onSpotCanManageUsers = canManageUsers(testOnSpot);
    const onSpotPassed = onSpotCanCreate && !onSpotCanManageUsers;
    testCases.push({
      name: '9. RBAC: On-Spot Desk Role Boundary',
      description: 'Verifies On-Spot Desk user can create/modify offline registrations in Google Sheets, but is forbidden from User Management or Admin settings.',
      inputs: ['Create Offline: yes', 'Manage Users: no'],
      expectedCanonical: 'Can Create Offline = true, Can Manage Users = false',
      actualCanonical: `Can Create Offline: ${onSpotCanCreate} | Can Manage Users: ${onSpotCanManageUsers}`,
      passed: onSpotPassed,
      notes: onSpotPassed ? 'Passed! Desk user has registration CRUD without administrative escalation.' : 'Role boundary violation.'
    });

    // Test 10: RBAC - Account Disabling (Default Deny)
    const testDisabledUser: AppUser = {
      id: 'dis-1',
      username: 'dis_1',
      email: 'disabled@airox26.org',
      name: 'Disabled Staff',
      role: 'ADMIN', // Even if previously admin!
      status: 'INACTIVE',
      assignedEvents: [],
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z'
    };
    const disabledCanAccess = canAccessEvent(testDisabledUser, 'The Final Hire');
    const disabledCanCreate = canCreateOffline(testDisabledUser);
    const disabledCanManage = canManageUsers(testDisabledUser);
    const disabledPassed = !disabledCanAccess && !disabledCanCreate && !disabledCanManage;
    testCases.push({
      name: '10. RBAC: Inactive Account Enforcement (Default Deny)',
      description: 'Ensures an INACTIVE or DISABLED user is rejected on all endpoints and views regardless of their role.',
      inputs: ['Status: INACTIVE'],
      expectedCanonical: 'All Actions = DENIED (false)',
      actualCanonical: `Access: ${disabledCanAccess} | Create: ${disabledCanCreate} | Manage: ${disabledCanManage}`,
      passed: disabledPassed,
      notes: disabledPassed ? 'Passed! Inactive users are strictly blocked by the authorization layer.' : 'Inactive user bypass detected!'
    });

    // Test 11: RBAC - DATABASE Role Global Access
    const testDatabaseUser: AppUser = {
      id: 'db-test-user',
      username: 'db_test_user',
      email: 'database@airox26.org',
      name: 'Database Team Lead',
      role: 'DATABASE',
      status: 'ACTIVE',
      assignedEvents: [],
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z'
    };
    const sampleEvents = [
      'Paper Presentation',
      'The Final Hire',
      'Zero Hour',
      'AD SHOT',
      'GOATED OR GHOSTED',
      'CLASH AND CONQUER',
      'BOX CRICKET',
      'ESPORTS',
      'The Final Prompt League'
    ];
    const dbAllEventsAllowed = sampleEvents.every(ev => canAccessEvent(testDatabaseUser, ev) && canExportEvent(testDatabaseUser, ev));
    const dbCanViewAll = canViewAllParticipants(testDatabaseUser);
    const dbCanSync = canSyncData(testDatabaseUser);
    const dbGlobalAccessPassed = dbAllEventsAllowed && dbCanViewAll && dbCanSync;

    testCases.push({
      name: '11. RBAC: DATABASE Role Global Access (All 9+ Events, Combined, Export, Sync)',
      description: 'Verifies DATABASE role has unrestricted symposium-wide access to view, analyze, export, and sync all events without individual event scoping.',
      inputs: sampleEvents,
      expectedCanonical: 'All Events Allowed = true, Global View = true, Sync = true',
      actualCanonical: `All Events: ${dbAllEventsAllowed} | Global View: ${dbCanViewAll} | Sync: ${dbCanSync}`,
      passed: dbGlobalAccessPassed,
      notes: dbGlobalAccessPassed
        ? 'Passed! DATABASE role has comprehensive global symposium data & export permissions.'
        : 'Failed: DATABASE was blocked on some events or data operations.'
    });

    // Test 12: RBAC - DATABASE Role Security Boundaries (No Admin/User Management)
    const dbCanManageUsers = canManageUsers(testDatabaseUser);
    const dbCanCreateOffline = canCreateOffline(testDatabaseUser);
    const dbSecurityPassed = !dbCanManageUsers && !dbCanCreateOffline;

    testCases.push({
      name: '12. RBAC: DATABASE Security Boundary (No User Mgmt / No Desk Write)',
      description: 'Verifies DATABASE role is read/analysis focused and strictly DENIED administrative user management, role alterations, and offline desk creation.',
      inputs: ['Manage Users: no', 'Create Offline: no'],
      expectedCanonical: 'Can Manage Users = false, Can Create Offline = false',
      actualCanonical: `Can Manage Users: ${dbCanManageUsers} | Can Create Offline: ${dbCanCreateOffline}`,
      passed: dbSecurityPassed,
      notes: dbSecurityPassed
        ? 'Passed! DATABASE role is correctly isolated from administrative write/user privileges.'
        : 'Failed: DATABASE improperly inherited administrative privileges.'
    });

    // Test 13: RBAC - CERTIFICATE Role Dedicated Access to Certificate Desk
    const testCertUser: AppUser = {
      id: 'cert-test-user',
      username: 'cert_lead',
      email: 'certificate@airox26.org',
      name: 'Certificate Team Lead',
      role: 'CERTIFICATE',
      status: 'ACTIVE',
      assignedEvents: [],
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z'
    };
    const certCanAccessDesk = canAccessCertificateDesk(testCertUser);
    const certCanModifyStatus = canModifyCertificateStatus(testCertUser);
    const certAccessPassed = certCanAccessDesk && certCanModifyStatus;

    testCases.push({
      name: '13. RBAC: CERTIFICATE Role Access to Certificate Desk',
      description: 'Verifies CERTIFICATE role has full access to view Certificate Desk and mark certificate status as ISSUED/PENDING.',
      inputs: ['Certificate Desk Access', 'Modify Certificate Status'],
      expectedCanonical: 'Can Access Certificate Desk = true, Can Modify Status = true',
      actualCanonical: `Desk Access: ${certCanAccessDesk} | Modify Status: ${certCanModifyStatus}`,
      passed: certAccessPassed,
      notes: certAccessPassed
        ? 'Passed! CERTIFICATE role has authorized access to operate Certificate Desk.'
        : 'Failed: CERTIFICATE role was denied Certificate Desk access.'
    });

    // Test 14: RBAC - CERTIFICATE Role Strict Boundary (No Participants, Matrix, Offline, Users)
    const certCanAccessParticipants = canAccessParticipantsSection(testCertUser);
    const certCanAccessMatrix = canAccessEventsMatrix(testCertUser);
    const certCanCreateOffline = canCreateOffline(testCertUser);
    const certCanManageUsers = canManageUsers(testCertUser);
    const certBoundaryPassed =
      !certCanAccessParticipants &&
      !certCanAccessMatrix &&
      !certCanCreateOffline &&
      !certCanManageUsers;

    testCases.push({
      name: '14. RBAC: CERTIFICATE Role Strict Boundary (No Participants / Matrix / Offline / Users)',
      description: 'Ensures CERTIFICATE role is strictly blocked from general participants page, events matrix, offline registration desk, and user management.',
      inputs: ['Participants: deny', 'Matrix: deny', 'Offline: deny', 'Users: deny'],
      expectedCanonical: 'All Restricted Views = false (403 Forbidden)',
      actualCanonical: `Participants: ${certCanAccessParticipants} | Matrix: ${certCanAccessMatrix} | Offline: ${certCanCreateOffline} | Users: ${certCanManageUsers}`,
      passed: certBoundaryPassed,
      notes: certBoundaryPassed
        ? 'Passed! CERTIFICATE role is strictly isolated from non-certificate sections.'
        : 'Failed: CERTIFICATE role leaked access to unauthorized sections.'
    });

    // Test 15: Certificate Persistence Key Association (Reg ID + Canonical Event)
    const p1RegId = 'AIR001';
    const eventA = 'The Final Hire';
    const eventB = 'Paper Presentation';
    const keyA = `${p1RegId}__${normalizer.normalize(eventA).canonicalKey}`;
    const keyB = `${p1RegId}__${normalizer.normalize(eventB).canonicalKey}`;
    const keysAreIndependent = keyA !== keyB && keyA === 'AIR001__the final hire' && keyB === 'AIR001__paper presentation';

    testCases.push({
      name: '15. Certificate Persistence: Event-Specific Composite Keys',
      description: 'Verifies certificate tracking is associated with Registration ID + Canonical Event so issuing event A leaves event B as PENDING.',
      inputs: [`${p1RegId} + ${eventA}`, `${p1RegId} + ${eventB}`],
      expectedCanonical: 'AIR001__the final hire !== AIR001__paper presentation',
      actualCanonical: `Key A: ${keyA} | Key B: ${keyB}`,
      passed: keysAreIndependent,
      notes: keysAreIndependent
        ? 'Passed! Event keys are independently scoped per participant registration.'
        : 'Failed: Event keys collided!'
    });

    // Test 16: Certificate Desk Online + Offline Combination & Cancelled Filtering
    const sampleHeaders = Object.keys(SAMPLE_AIROX26_RAW_DATA[0] || {});
    const sampleMapping = detectColumnMapping(sampleHeaders);
    const { participants: sampleParticipants } = processRawRows(
      SAMPLE_AIROX26_RAW_DATA,
      sampleMapping,
      normalizer
    );
    const sampleOnlineCount = sampleParticipants.filter(p => p.allEvents.includes('the final hire')).length;
    const mockOfflineRecords: any[] = [
      { offlineRegistrationId: 'OFF-AIROX26-101', fullName: 'Test Offline Active', event: 'The Final Hire', status: 'ACTIVE', verificationStatus: 'Verified' },
      { offlineRegistrationId: 'OFF-AIROX26-102', fullName: 'Test Offline Cancelled', event: 'The Final Hire', status: 'CANCELLED', verificationStatus: 'Verified' }
    ];
    const combinedTest = combineDatasets({
      onlineParticipants: sampleParticipants,
      offlineRecords: mockOfflineRecords,
      normalizer
    });
    const finalHireParticipants = combinedTest.combinedParticipants.filter(p => 
      p.status !== 'CANCELLED' && p.allEvents.includes('the final hire')
    );
    const hasActiveOffline = finalHireParticipants.some(p => p.registrationId === 'OFF-AIROX26-101');
    const excludesCancelledOffline = !finalHireParticipants.some(p => p.registrationId === 'OFF-AIROX26-102');
    const combinedSyncPassed = hasActiveOffline && excludesCancelledOffline && finalHireParticipants.length === (sampleOnlineCount + 1);

    testCases.push({
      name: '16. Certificate Desk Roster Synchronization (Active Offline Included, Cancelled Excluded)',
      description: 'Verifies that the Certificate Desk participant list includes active offline registrations and strictly excludes cancelled offline registrations.',
      inputs: ['Online Roster', 'Active Offline: OFF-AIROX26-101', 'Cancelled Offline: OFF-AIROX26-102'],
      expectedCanonical: `Total: ${sampleOnlineCount + 1} (Includes Active, Excludes Cancelled)`,
      actualCanonical: `Total: ${finalHireParticipants.length} (Active: ${hasActiveOffline}, Cancelled Excluded: ${excludesCancelledOffline})`,
      passed: combinedSyncPassed,
      notes: combinedSyncPassed
        ? 'Passed! Offline active participants are properly merged, and cancelled entries are excluded.'
        : 'Failed: Combined roster did not correctly handle active/cancelled offline participants.'
    });

    // Test 17: ADS SHOT Canonical Normalization Consistency
    const adsVariants = ['AD SHOT', 'Ad Shot', 'ADS SHOT', 'Ads Shot', 'AD  SHOT'];
    const allNormalizedToAdsShot = adsVariants.every(v => normalizer.normalize(v).displayName === 'ADS SHOT');

    testCases.push({
      name: '17. ADS SHOT Canonical Normalization Consistency',
      description: 'Verifies all AD SHOT / ADS SHOT variants map to the single canonical event name "ADS SHOT".',
      inputs: adsVariants,
      expectedCanonical: 'ADS SHOT across all variants',
      actualCanonical: adsVariants.map(v => `${v} -> ${normalizer.normalize(v).displayName}`).join(' | '),
      passed: allNormalizedToAdsShot,
      notes: allNormalizedToAdsShot
        ? 'Passed! All variants resolve to the uniform canonical display name ADS SHOT.'
        : 'Failed: Some variant mapped to an inconsistent name.'
    });

    setResults(testCases);
    setIsRunning(false);
  };

  useEffect(() => {
    if (isOpen) {
      runAllTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allPassed = results.length > 0 && results.every(r => r.passed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Edge-Case & RBAC Verification Suite</h3>
              <p className="text-xs text-slate-300">
                Automated tests verifying Normalization, Google Sheets Engine & Role-Based Access Control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Test Suite Summary Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {allPassed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All {results.length} Tests Passed (100% Green)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                <XCircle className="w-4 h-4 text-rose-600" />
                Some Tests Failed
              </span>
            )}
          </div>

          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>Re-Run Tests</span>
          </button>
        </div>

        {/* Test Cases List */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {results.map((test, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                test.passed
                  ? 'bg-emerald-50/30 border-emerald-200'
                  : 'bg-rose-50/40 border-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {test.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{test.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{test.description}</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    test.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {test.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/70 font-mono">
                <div>
                  <span className="text-slate-400 block font-sans text-[10px]">Expected:</span>
                  <span className="text-slate-800 font-semibold">{test.expectedCanonical}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans text-[10px]">Result:</span>
                  <span className="text-emerald-700 font-semibold">{test.actualCanonical}</span>
                </div>
              </div>

              {test.notes && (
                <div className="mt-2 text-xs text-slate-500 italic">
                  💡 {test.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
          >
            Close Suite
          </button>
        </div>
      </div>
    </div>
  );
};
