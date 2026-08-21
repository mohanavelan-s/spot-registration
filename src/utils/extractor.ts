import { FilterState, Participant, VerificationStatus, SourceFilter } from '../types';

/**
 * Filter combined participants based on selected event, search term, source, and verification status
 */
export function extractParticipants(
  participants: Participant[],
  filterState: FilterState
): {
  filteredParticipants: Participant[];
  totalFilteredCount: number;
  onlineCount: number;
  offlineCount: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  paginatedParticipants: Participant[];
  totalPages: number;
} {
  const {
    selectedEventKey,
    searchQuery,
    statusFilter,
    sourceFilter = 'ALL',
    showCancelled = false,
    sortBy,
    sortOrder,
    page,
    pageSize
  } = filterState;

  // 1. Exclude Cancelled Offline records by default (unless explicitly requested in audit mode)
  let activeOnly = participants;
  if (!showCancelled) {
    activeOnly = participants.filter(p => p.status !== 'CANCELLED');
  }

  // 2. Filter by canonical event key (searches across both tech and non-tech)
  let eventFiltered = activeOnly;
  if (selectedEventKey) {
    eventFiltered = activeOnly.filter(p => p.allEvents.includes(selectedEventKey));
  }

  // Calculate counts for this event BEFORE status/source filtering
  let onlineCount = 0;
  let offlineCount = 0;
  let verifiedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  for (const p of eventFiltered) {
    if (p.source === 'ONLINE') onlineCount++;
    else if (p.source === 'OFFLINE') offlineCount++;

    if (p.verificationStatus === 'Verified') verifiedCount++;
    else if (p.verificationStatus === 'Pending') pendingCount++;
    else if (p.verificationStatus === 'Rejected') rejectedCount++;
  }

  // 3. Filter by Registration Source (ALL / ONLINE / OFFLINE)
  let sourceFiltered = eventFiltered;
  if (sourceFilter && sourceFilter !== 'ALL') {
    sourceFiltered = eventFiltered.filter(p => p.source === sourceFilter);
  }

  // 4. Filter by Verification Status (All / Verified / Pending / Rejected)
  let statusFiltered = sourceFiltered;
  if (statusFilter && statusFilter !== 'All') {
    statusFiltered = sourceFiltered.filter(p => p.verificationStatus === statusFilter);
  }

  // 5. Search query filter
  let queryFiltered = statusFiltered;
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    queryFiltered = statusFiltered.filter(p => {
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.registrationId.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.mobile.toLowerCase().includes(q) ||
        p.college.toLowerCase().includes(q) ||
        (p.department && p.department.toLowerCase().includes(q)) ||
        (p.yearSection && p.yearSection.toLowerCase().includes(q)) ||
        p.teamName.toLowerCase().includes(q) ||
        p.participationMode.toLowerCase().includes(q) ||
        p.source.toLowerCase().includes(q)
      );
    });
  }

  // 6. Sort
  const sorted = [...queryFiltered].sort((a, b) => {
    let valA = '';
    let valB = '';

    switch (sortBy) {
      case 'registrationId':
      case 'id':
        valA = a.registrationId;
        valB = b.registrationId;
        break;
      case 'fullName':
      case 'name':
        valA = a.fullName;
        valB = b.fullName;
        break;
      case 'college':
        valA = a.college;
        valB = b.college;
        break;
      case 'verificationStatus':
        valA = a.verificationStatus;
        valB = b.verificationStatus;
        break;
      case 'teamName':
        valA = a.teamName;
        valB = b.teamName;
        break;
      case 'email':
        valA = a.email;
        valB = b.email;
        break;
      case 'source':
        valA = a.source;
        valB = b.source;
        break;
      case 'registeredAt':
        valA = a.registeredAt || '';
        valB = b.registeredAt || '';
        break;
      default:
        valA = a.registrationId;
        valB = b.registrationId;
    }

    const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalFilteredCount = sorted.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalFilteredCount / pageSize) : 1;
  const safePage = Math.max(1, Math.min(page, totalPages || 1));

  const startIndex = (safePage - 1) * pageSize;
  const paginatedParticipants = pageSize > 0 ? sorted.slice(startIndex, startIndex + pageSize) : sorted;

  return {
    filteredParticipants: sorted,
    totalFilteredCount,
    onlineCount,
    offlineCount,
    verifiedCount,
    pendingCount,
    rejectedCount,
    paginatedParticipants,
    totalPages
  };
}

