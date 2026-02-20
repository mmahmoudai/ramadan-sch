export type RoleFilter = "" | "user" | "admin";
export type LanguageFilter = "" | "en" | "ar" | "tr";
export type ReminderFilter = "" | "true" | "false";
export type AdminEntityTab = "families" | "entries" | "challenges" | "reports";

export interface OverviewFilters {
  from: string;
  to: string;
  role: RoleFilter;
  language: LanguageFilter;
}

export interface UserListFilters {
  search: string;
  role: RoleFilter;
  language: LanguageFilter;
  reminderEnabled: ReminderFilter;
  sortBy: "createdAt" | "updatedAt" | "entryCount" | "lastActivityAt";
  sortOrder: "asc" | "desc";
}

export interface AdminOverviewResponse {
  range: { from: string | null; to: string | null; isFiltered: boolean };
  filters: { role: "user" | "admin" | null; language: "en" | "ar" | "tr" | null };
  kpis: {
    totalUsers: number;
    totalAdmins: number;
    newUsers: number;
    activeUsers: number;
    totalEntries: number;
    totalChallenges: number;
    totalReports: number;
    totalFamilies: number;
    totalComments: number;
    totalReactions: number;
  };
  trend: Array<{ date: string; users: number; entries: number; challenges: number; reports: number }>;
  topActiveUsers: Array<{
    userId: string;
    displayName: string;
    email: string;
    entryCount: number;
    lastActivityAt: string | null;
  }>;
  topActiveFamilies: Array<{
    familyId: string;
    name: string;
    ownerUserId: string;
    ownerDisplayName: string;
    ownerEmail: string;
    memberCount: number;
    activityCount: number;
  }>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  language: "en" | "ar" | "tr";
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  lastActivityAt: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminUserDetailResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "user" | "admin";
    language: "en" | "ar" | "tr";
    bio: string;
    avatarUrl: string | null;
    timezoneIana: string;
    timezoneSource: "auto" | "manual";
    reminderEnabled: boolean;
    reminderTimeLocal: string;
    createdAt: string;
    updatedAt: string;
  };
  metrics: {
    entryCount: number;
    challengeCount: number;
    activeChallengeCount: number;
    inactiveChallengeCount: number;
    reportCount: number;
    familyOwnedCount: number;
    familyMembershipCount: number;
    refreshSessionCount: number;
    commentCount: number;
    reactionCount: number;
    lastActivityAt: string | null;
  };
  entryStatus: { open: number; locked: number };
  challengeScopes: { daily: number; weekly: number; monthly: number };
  visibilityApprovals: {
    asOwner: { pending: number; approved: number; rejected: number };
    asViewer: { pending: number; approved: number; rejected: number };
  };
  familyMemberships: Array<{
    familyId: string;
    name: string;
    ownerUserId: string;
    ownerDisplayName: string;
    ownerEmail: string;
    role: "owner" | "member";
    status: "invited" | "active";
    joinedAt: string;
    memberCount: number;
  }>;
  recent: {
    entries: Array<{ id: string; gregorianDate: string; status: "open" | "locked"; updatedAt: string }>;
    challenges: Array<{ id: string; title: string; scope: "daily" | "weekly" | "monthly"; active: boolean; updatedAt: string }>;
    reports: Array<{
      id: string;
      periodScope: string;
      periodStart: string;
      periodEnd: string;
      visibility: "public" | "private";
      includeProfileInfo: boolean;
      revokedAt: string | null;
      accessCount: number;
      updatedAt: string;
    }>;
  };
}

export interface EditFormState {
  displayName: string;
  bio: string;
  language: "en" | "ar" | "tr";
  timezoneIana: string;
  timezoneSource: "auto" | "manual";
  reminderEnabled: boolean;
  reminderTimeLocal: string;
}

export interface AdminFamilyRow {
  id: string;
  name: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  memberCount: number;
  activeMembers: number;
  invitedMembers: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEntryRow {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  gregorianDate: string;
  status: "open" | "locked";
  completedFields: number;
  totalFields: number;
  updatedAt: string;
}

export interface AdminChallengeRow {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  title: string;
  scope: "daily" | "weekly" | "monthly";
  active: boolean;
  progressCount: number;
  completedCount: number;
  updatedAt: string;
}

export interface AdminReportRow {
  id: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  periodScope: string;
  periodStart: string;
  periodEnd: string;
  visibility: "public" | "private";
  includeProfileInfo: boolean;
  hasPublicToken: boolean;
  revokedAt: string | null;
  accessCount: number;
  updatedAt: string;
}

export interface ManagementDetail {
  tab: AdminEntityTab;
  data: any;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}
