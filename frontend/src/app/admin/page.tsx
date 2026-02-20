"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, isAdmin, getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

type RoleFilter = "" | "user" | "admin";
type LanguageFilter = "" | "en" | "ar" | "tr";
type ReminderFilter = "" | "true" | "false";

interface OverviewFilters {
  from: string;
  to: string;
  role: RoleFilter;
  language: LanguageFilter;
}

interface UserListFilters {
  search: string;
  role: RoleFilter;
  language: LanguageFilter;
  reminderEnabled: ReminderFilter;
  sortBy: "createdAt" | "updatedAt" | "entryCount" | "lastActivityAt";
  sortOrder: "asc" | "desc";
}

interface AdminOverviewResponse {
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

interface AdminUserRow {
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

interface AdminUsersResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  totalPages: number;
}

interface AdminUserDetailResponse {
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

interface EditFormState {
  displayName: string;
  bio: string;
  language: "en" | "ar" | "tr";
  timezoneIana: string;
  timezoneSource: "auto" | "manual";
  reminderEnabled: boolean;
  reminderTimeLocal: string;
  reason: string;
}

type AdminEntityTab = "families" | "entries" | "challenges" | "reports";

interface AdminFamilyRow {
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

interface AdminEntryRow {
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

interface AdminChallengeRow {
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

interface AdminReportRow {
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

const defaultOverviewFilters: OverviewFilters = {
  from: "",
  to: "",
  role: "",
  language: "",
};

const defaultUserListFilters: UserListFilters = {
  search: "",
  role: "",
  language: "",
  reminderEnabled: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

const emptyEditForm: EditFormState = {
  displayName: "",
  bio: "",
  language: "en",
  timezoneIana: "",
  timezoneSource: "auto",
  reminderEnabled: true,
  reminderTimeLocal: "21:00",
  reason: "",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function requestActionReason(actionLabel: string): string | null {
  const reason = window.prompt(`${actionLabel}\nReason is required (min 3 chars):`, "");
  if (!reason || reason.trim().length < 3) {
    alert("Action canceled. Reason is required.");
    return null;
  }
  return reason.trim();
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [overviewFilters, setOverviewFilters] = useState<OverviewFilters>(defaultOverviewFilters);
  const [appliedOverviewFilters, setAppliedOverviewFilters] = useState<OverviewFilters>(defaultOverviewFilters);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [userFilters, setUserFilters] = useState<UserListFilters>(defaultUserListFilters);
  const [appliedUserFilters, setAppliedUserFilters] = useState<UserListFilters>(defaultUserListFilters);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);

  const [activeTab, setActiveTab] = useState<AdminEntityTab>("families");
  const [managementPage, setManagementPage] = useState(1);
  const [managementTotal, setManagementTotal] = useState(0);
  const [managementTotalPages, setManagementTotalPages] = useState(1);
  const [managementLoading, setManagementLoading] = useState(false);
  const [families, setFamilies] = useState<AdminFamilyRow[]>([]);
  const [entries, setEntries] = useState<AdminEntryRow[]>([]);
  const [challenges, setChallenges] = useState<AdminChallengeRow[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [managementDetail, setManagementDetail] = useState<{ tab: AdminEntityTab; data: any } | null>(null);
  const [familyTransferUserId, setFamilyTransferUserId] = useState("");
  const [familyRemoveUserId, setFamilyRemoveUserId] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized = isLoggedIn() && isAdmin();

  useEffect(() => {
    if (!isAuthorized) {
      router.push("/login");
    }
  }, [isAuthorized, router]);

  const loadOverview = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      setOverviewLoading(true);
      setError(null);
      const token = getToken()!;
      const params = new URLSearchParams();
      if (appliedOverviewFilters.from) params.set("from", appliedOverviewFilters.from);
      if (appliedOverviewFilters.to) params.set("to", appliedOverviewFilters.to);
      if (appliedOverviewFilters.role) params.set("role", appliedOverviewFilters.role);
      if (appliedOverviewFilters.language) params.set("language", appliedOverviewFilters.language);
      const query = params.toString();
      const data = await apiFetch<AdminOverviewResponse>(`/admin/overview${query ? `?${query}` : ""}`, { token });
      setOverview(data);
    } catch (err: any) {
      setError(err.message || "Failed to load admin overview");
    } finally {
      setOverviewLoading(false);
    }
  }, [appliedOverviewFilters, isAuthorized]);

  const loadUsers = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      setUsersLoading(true);
      setError(null);
      const token = getToken()!;
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: appliedUserFilters.sortBy,
        sortOrder: appliedUserFilters.sortOrder,
      });
      if (appliedUserFilters.search) params.set("search", appliedUserFilters.search);
      if (appliedUserFilters.role) params.set("role", appliedUserFilters.role);
      if (appliedUserFilters.language) params.set("language", appliedUserFilters.language);
      if (appliedUserFilters.reminderEnabled) params.set("reminderEnabled", appliedUserFilters.reminderEnabled);
      const data = await apiFetch<AdminUsersResponse>(`/admin/users?${params.toString()}`, { token });
      setUsers(data.users);
      setTotalUsers(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, [appliedUserFilters, isAuthorized, page]);

  const loadUserDetail = useCallback(
    async (userId: string) => {
      if (!isAuthorized) return;
      try {
        setDetailLoading(true);
        setError(null);
        const token = getToken()!;
        const data = await apiFetch<AdminUserDetailResponse>(`/admin/users/${userId}`, { token });
        setSelectedUserDetail(data);
        setEditForm({
          displayName: data.user.displayName,
          bio: data.user.bio || "",
          language: data.user.language,
          timezoneIana: data.user.timezoneIana,
          timezoneSource: data.user.timezoneSource,
          reminderEnabled: data.user.reminderEnabled,
          reminderTimeLocal: data.user.reminderTimeLocal,
          reason: "",
        });
      } catch (err: any) {
        setError(err.message || "Failed to load user details");
      } finally {
        setDetailLoading(false);
      }
    },
    [isAuthorized]
  );

  const loadManagementTab = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      setManagementLoading(true);
      setError(null);
      const token = getToken()!;
      const params = new URLSearchParams({ page: String(managementPage), limit: "10" });
      let endpoint = "";
      if (activeTab === "families") endpoint = `/admin/families?${params.toString()}`;
      if (activeTab === "entries") endpoint = `/admin/entries?${params.toString()}`;
      if (activeTab === "challenges") endpoint = `/admin/challenges?${params.toString()}`;
      if (activeTab === "reports") endpoint = `/admin/reports?${params.toString()}`;
      const data: any = await apiFetch(endpoint, { token });
      if (activeTab === "families") setFamilies(data.families || []);
      if (activeTab === "entries") setEntries(data.entries || []);
      if (activeTab === "challenges") setChallenges(data.challenges || []);
      if (activeTab === "reports") setReports(data.reports || []);
      setManagementTotal(data.total || 0);
      setManagementTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load admin management data");
    } finally {
      setManagementLoading(false);
    }
  }, [activeTab, isAuthorized, managementPage]);

  const viewManagementDetail = useCallback(
    async (tab: AdminEntityTab, id: string) => {
      if (!isAuthorized) return;
      try {
        setActionLoading(`view-${tab}`);
        const token = getToken()!;
        const endpoint =
          tab === "families"
            ? `/admin/families/${id}`
            : tab === "entries"
            ? `/admin/entries/${id}`
            : tab === "challenges"
            ? `/admin/challenges/${id}`
            : `/admin/reports/${id}`;
        const data = await apiFetch<any>(endpoint, { token });
        setManagementDetail({ tab, data });
      } catch (err: any) {
        setError(err.message || "Failed to load detail");
      } finally {
        setActionLoading(null);
      }
    },
    [isAuthorized]
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadManagementTab();
  }, [loadManagementTab]);

  useEffect(() => {
    setManagementPage(1);
    setManagementDetail(null);
    setFamilyTransferUserId("");
    setFamilyRemoveUserId("");
  }, [activeTab]);

  const onApplyOverviewFilters = (e: FormEvent) => {
    e.preventDefault();
    setAppliedOverviewFilters(overviewFilters);
  };

  const onClearOverviewFilters = () => {
    setOverviewFilters(defaultOverviewFilters);
    setAppliedOverviewFilters(defaultOverviewFilters);
  };

  const onApplyUserFilters = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedUserFilters(userFilters);
  };

  const onClearUserFilters = () => {
    setUserFilters(defaultUserListFilters);
    setAppliedUserFilters(defaultUserListFilters);
    setPage(1);
  };

  const onSelectUser = async (userId: string) => {
    setSelectedUserId(userId);
    await loadUserDetail(userId);
  };

  const onSaveUser = async () => {
    if (!selectedUserId) return;
    if (!editForm.reason || editForm.reason.trim().length < 3) {
      setError("Reason is required to update user.");
      return;
    }
    try {
      setActionLoading("save-user");
      const token = getToken()!;
      await apiFetch(`/admin/users/${selectedUserId}`, {
        token,
        method: "PATCH",
        body: JSON.stringify({
          displayName: editForm.displayName,
          bio: editForm.bio,
          language: editForm.language,
          timezoneIana: editForm.timezoneIana,
          timezoneSource: editForm.timezoneSource,
          reminderEnabled: editForm.reminderEnabled,
          reminderTimeLocal: editForm.reminderTimeLocal,
          reason: editForm.reason.trim(),
        }),
      });
      await Promise.all([loadUsers(), loadOverview(), loadUserDetail(selectedUserId)]);
    } catch (err: any) {
      setError(err.message || "Failed to update user");
    } finally {
      setActionLoading(null);
    }
  };

  const onToggleRole = async () => {
    if (!selectedUserDetail) return;
    const newRole = selectedUserDetail.user.role === "admin" ? "user" : "admin";
    if (!confirm(`${t("admin.changeRoleTo")} "${newRole}"?`)) return;
    const reason = requestActionReason("Change user role");
    if (!reason) return;
    try {
      setActionLoading("toggle-role");
      const token = getToken()!;
      await apiFetch(`/admin/users/${selectedUserDetail.user.id}/role`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ role: newRole, reason }),
      });
      await Promise.all([loadUsers(), loadOverview(), loadUserDetail(selectedUserDetail.user.id)]);
    } catch (err: any) {
      setError(err.message || t("admin.updateRoleFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const onRevokeSessions = async () => {
    if (!selectedUserDetail) return;
    if (!confirm("Revoke all active sessions for this user?")) return;
    const reason = requestActionReason("Revoke user sessions");
    if (!reason) return;
    try {
      setActionLoading("revoke-sessions");
      const token = getToken()!;
      await apiFetch(`/admin/users/${selectedUserDetail.user.id}/revoke-sessions`, {
        token,
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await loadUserDetail(selectedUserDetail.user.id);
    } catch (err: any) {
      setError(err.message || "Failed to revoke sessions");
    } finally {
      setActionLoading(null);
    }
  };

  const onDeleteUser = async () => {
    if (!selectedUserDetail) return;
    if (!confirm(`${t("admin.deleteUserConfirm")} "${selectedUserDetail.user.email}"?`)) return;
    const reason = requestActionReason("Delete user");
    if (!reason) return;
    try {
      setActionLoading("delete-user");
      const token = getToken()!;
      await apiFetch(`/admin/users/${selectedUserDetail.user.id}`, {
        token,
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      setSelectedUserId(null);
      setSelectedUserDetail(null);
      setEditForm(emptyEditForm);
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (err: any) {
      setError(err.message || t("admin.deleteUserFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const onTriggerPasswordReset = async () => {
    if (!selectedUserDetail) return;
    const reason = requestActionReason("Trigger password reset email");
    if (!reason) return;
    try {
      setActionLoading("reset-password");
      const token = getToken()!;
      await apiFetch(`/admin/users/${selectedUserDetail.user.id}/reset-password-trigger`, {
        token,
        method: "POST",
        body: JSON.stringify({ reason, forceLogout: true }),
      });
      await loadUserDetail(selectedUserDetail.user.id);
    } catch (err: any) {
      setError(err.message || "Failed to trigger password reset");
    } finally {
      setActionLoading(null);
    }
  };

  const onFamilyTransferOwnership = async (familyId: string) => {
    const reason = requestActionReason("Transfer family ownership");
    if (!reason) return;
    if (!familyTransferUserId.trim()) {
      setError("New owner user ID is required.");
      return;
    }
    try {
      setActionLoading("family-transfer");
      const token = getToken()!;
      await apiFetch(`/admin/families/${familyId}/transfer-ownership`, {
        token,
        method: "POST",
        body: JSON.stringify({ newOwnerUserId: familyTransferUserId.trim(), reason }),
      });
      setFamilyTransferUserId("");
      await loadManagementTab();
      await viewManagementDetail("families", familyId);
    } catch (err: any) {
      setError(err.message || "Failed to transfer family ownership");
    } finally {
      setActionLoading(null);
    }
  };

  const onFamilyRemoveMember = async (familyId: string) => {
    const reason = requestActionReason("Remove family member");
    if (!reason) return;
    if (!familyRemoveUserId.trim()) {
      setError("Member user ID is required.");
      return;
    }
    try {
      setActionLoading("family-remove-member");
      const token = getToken()!;
      await apiFetch(`/admin/families/${familyId}/remove-member`, {
        token,
        method: "POST",
        body: JSON.stringify({ memberUserId: familyRemoveUserId.trim(), reason }),
      });
      setFamilyRemoveUserId("");
      await loadManagementTab();
      await viewManagementDetail("families", familyId);
    } catch (err: any) {
      setError(err.message || "Failed to remove family member");
    } finally {
      setActionLoading(null);
    }
  };

  const onFamilyArchive = async (familyId: string) => {
    const reason = requestActionReason("Archive family");
    if (!reason) return;
    try {
      setActionLoading("family-archive");
      const token = getToken()!;
      await apiFetch(`/admin/families/${familyId}/archive`, {
        token,
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await loadManagementTab();
      if (managementDetail?.tab === "families" && managementDetail.data?.family?.id === familyId) {
        await viewManagementDetail("families", familyId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to archive family");
    } finally {
      setActionLoading(null);
    }
  };

  const onFamilyDelete = async (familyId: string) => {
    const reason = requestActionReason("Delete family");
    if (!reason) return;
    try {
      setActionLoading("family-delete");
      const token = getToken()!;
      await apiFetch(`/admin/families/${familyId}`, {
        token,
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (managementDetail?.tab === "families" && managementDetail.data?.family?.id === familyId) {
        setManagementDetail(null);
      }
      await loadManagementTab();
    } catch (err: any) {
      setError(err.message || "Failed to delete family");
    } finally {
      setActionLoading(null);
    }
  };

  const onChallengeAction = async (challengeId: string, action: "archive" | "reactivate" | "delete") => {
    const reason = requestActionReason(`Challenge ${action}`);
    if (!reason) return;
    try {
      setActionLoading(`challenge-${action}`);
      const token = getToken()!;
      if (action === "delete") {
        await apiFetch(`/admin/challenges/${challengeId}`, {
          token,
          method: "DELETE",
          body: JSON.stringify({ reason }),
        });
      } else {
        await apiFetch(`/admin/challenges/${challengeId}/${action}`, {
          token,
          method: "POST",
          body: JSON.stringify({ reason }),
        });
      }
      await loadManagementTab();
      if (managementDetail?.tab === "challenges" && managementDetail.data?.challenge?.id === challengeId && action !== "delete") {
        await viewManagementDetail("challenges", challengeId);
      }
      if (action === "delete" && managementDetail?.tab === "challenges" && managementDetail.data?.challenge?.id === challengeId) {
        setManagementDetail(null);
      }
    } catch (err: any) {
      setError(err.message || `Failed to ${action} challenge`);
    } finally {
      setActionLoading(null);
    }
  };

  const onReportRevokePublic = async (reportId: string) => {
    const reason = requestActionReason("Revoke report public access");
    if (!reason) return;
    try {
      setActionLoading("report-revoke");
      const token = getToken()!;
      await apiFetch(`/admin/reports/${reportId}/revoke-public`, {
        token,
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await loadManagementTab();
      if (managementDetail?.tab === "reports" && managementDetail.data?.report?.id === reportId) {
        await viewManagementDetail("reports", reportId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to revoke public report access");
    } finally {
      setActionLoading(null);
    }
  };

  const onReportToggleVisibility = async (reportId: string, nextVisibility: "public" | "private") => {
    const reason = requestActionReason(`Set report to ${nextVisibility}`);
    if (!reason) return;
    try {
      setActionLoading("report-policy");
      const token = getToken()!;
      await apiFetch(`/admin/reports/${reportId}/access-policy`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ visibility: nextVisibility, reason }),
      });
      await loadManagementTab();
      if (managementDetail?.tab === "reports" && managementDetail.data?.report?.id === reportId) {
        await viewManagementDetail("reports", reportId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update report access policy");
    } finally {
      setActionLoading(null);
    }
  };

  const onReportDelete = async (reportId: string) => {
    const reason = requestActionReason("Delete report");
    if (!reason) return;
    try {
      setActionLoading("report-delete");
      const token = getToken()!;
      await apiFetch(`/admin/reports/${reportId}`, {
        token,
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (managementDetail?.tab === "reports" && managementDetail.data?.report?.id === reportId) {
        setManagementDetail(null);
      }
      await loadManagementTab();
    } catch (err: any) {
      setError(err.message || "Failed to delete report");
    } finally {
      setActionLoading(null);
    }
  };

  const trendMax = useMemo(() => {
    if (!overview?.trend.length) return 1;
    return Math.max(...overview.trend.map((item) => item.entries), 1);
  }, [overview?.trend]);

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">{t("admin.title")}</h1>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="border-2 border-line rounded-xl p-4 space-y-4">
        <h2 className="text-xl font-bold">Overview Filters</h2>
        <form onSubmit={onApplyOverviewFilters} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="date"
            value={overviewFilters.from}
            onChange={(e) => setOverviewFilters((prev) => ({ ...prev, from: e.target.value }))}
            className="border-2 border-line rounded-xl px-3 py-2"
          />
          <input
            type="date"
            value={overviewFilters.to}
            onChange={(e) => setOverviewFilters((prev) => ({ ...prev, to: e.target.value }))}
            className="border-2 border-line rounded-xl px-3 py-2"
          />
          <select
            value={overviewFilters.role}
            onChange={(e) => setOverviewFilters((prev) => ({ ...prev, role: e.target.value as RoleFilter }))}
            className="border-2 border-line rounded-xl px-3 py-2"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={overviewFilters.language}
            onChange={(e) => setOverviewFilters((prev) => ({ ...prev, language: e.target.value as LanguageFilter }))}
            className="border-2 border-line rounded-xl px-3 py-2"
          >
            <option value="">All Languages</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
            <option value="tr">TR</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-ink text-white rounded-xl px-4 py-2 font-bold">
              {overviewLoading ? t("common.loading") : "Apply"}
            </button>
            <button type="button" onClick={onClearOverviewFilters} className="px-4 py-2 border-2 border-line rounded-xl font-bold">
              {t("admin.clear")}
            </button>
          </div>
        </form>

        {overview && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label={t("admin.totalUsers")} value={overview.kpis.totalUsers} />
              <StatCard label={t("admin.admins")} value={overview.kpis.totalAdmins} />
              <StatCard label="New Users" value={overview.kpis.newUsers} />
              <StatCard label="Active Users" value={overview.kpis.activeUsers} />
              <StatCard label={t("admin.dailyEntries")} value={overview.kpis.totalEntries} />
              <StatCard label={t("challenges.title")} value={overview.kpis.totalChallenges} />
              <StatCard label={t("reports.title")} value={overview.kpis.totalReports} />
              <StatCard label={t("admin.families")} value={overview.kpis.totalFamilies} />
              <StatCard label="Comments" value={overview.kpis.totalComments} />
              <StatCard label="Reactions" value={overview.kpis.totalReactions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="border border-line rounded-xl p-3 lg:col-span-2">
                <h3 className="font-bold mb-2">Entry Trend</h3>
                <div className="space-y-2 max-h-56 overflow-auto">
                  {overview.trend.map((item) => (
                    <div key={item.date} className="flex items-center gap-3 text-sm">
                      <span className="w-24 text-gray-600">{item.date}</span>
                      <div className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                        <div
                          className="bg-ink h-full"
                          style={{ width: `${Math.max(4, Math.round((item.entries / trendMax) * 100))}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-semibold">{item.entries}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-line rounded-xl p-3">
                <h3 className="font-bold mb-2">Top Active Users</h3>
                <div className="space-y-2 text-sm">
                  {overview.topActiveUsers.length === 0 && <div className="text-gray-500">No activity yet.</div>}
                  {overview.topActiveUsers.map((user) => (
                    <button
                      key={user.userId}
                      onClick={() => onSelectUser(user.userId)}
                      className="w-full text-left border border-line rounded-lg px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="font-semibold">{user.displayName}</div>
                      <div className="text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-500">Entries: {user.entryCount}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="border-2 border-line rounded-xl p-4 space-y-4">
        <h2 className="text-xl font-bold">User Management</h2>
        <form onSubmit={onApplyUserFilters} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder={t("admin.searchPlaceholder")}
            value={userFilters.search}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="md:col-span-2 border-2 border-line rounded-xl px-3 py-2"
          />
          <select
            value={userFilters.role}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, role: e.target.value as RoleFilter }))}
            className="border-2 border-line rounded-xl px-3 py-2"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={userFilters.language}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, language: e.target.value as LanguageFilter }))}
            className="border-2 border-line rounded-xl px-3 py-2"
          >
            <option value="">All Languages</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
            <option value="tr">TR</option>
          </select>
          <select
            value={userFilters.reminderEnabled}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, reminderEnabled: e.target.value as ReminderFilter }))}
            className="border-2 border-line rounded-xl px-3 py-2"
          >
            <option value="">All Reminders</option>
            <option value="true">Reminders On</option>
            <option value="false">Reminders Off</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-ink text-white rounded-xl px-4 py-2 font-bold">
              {t("admin.search")}
            </button>
            <button type="button" onClick={onClearUserFilters} className="px-4 py-2 border-2 border-line rounded-xl font-bold">
              {t("admin.clear")}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto border border-line rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-line text-left">
                <th className="px-3 py-2">{t("admin.user")}</th>
                <th className="px-3 py-2">{t("admin.email")}</th>
                <th className="px-3 py-2">{t("admin.role")}</th>
                <th className="px-3 py-2">{t("admin.lang")}</th>
                <th className="px-3 py-2">{t("admin.entries")}</th>
                <th className="px-3 py-2">Last Activity</th>
                <th className="px-3 py-2">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                    {t("admin.loading")}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                    {t("admin.noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-line hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold">{user.displayName}</td>
                    <td className="px-3 py-2 text-gray-600">{user.email}</td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2 uppercase">{user.language}</td>
                    <td className="px-3 py-2">{user.entryCount}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(user.lastActivityAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => onSelectUser(user.id)}
                        className="text-xs px-3 py-1 rounded-lg border border-line hover:bg-gray-100"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            {t("admin.page")} {page} {t("admin.of")} {totalPages} ({totalUsers} {t("admin.users")})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-line rounded-lg disabled:opacity-50"
            >
              {t("admin.previous")}
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-line rounded-lg disabled:opacity-50"
            >
              {t("admin.next")}
            </button>
          </div>
        </div>
      </section>

      <section className="border-2 border-line rounded-xl p-4 space-y-4">
        <h2 className="text-xl font-bold">Entity Management</h2>
        <div className="flex flex-wrap gap-2">
          {(["families", "entries", "challenges", "reports"] as AdminEntityTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl border text-sm font-semibold ${
                activeTab === tab ? "bg-ink text-white border-ink" : "border-line hover:bg-gray-100"
              }`}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto border border-line rounded-xl">
          <table className="w-full text-sm">
            <thead>
              {activeTab === "families" && (
                <tr className="bg-gray-50 border-b border-line text-left">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Members</th>
                  <th className="px-3 py-2">Archived</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              )}
              {activeTab === "entries" && (
                <tr className="bg-gray-50 border-b border-line text-left">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Completed</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              )}
              {activeTab === "challenges" && (
                <tr className="bg-gray-50 border-b border-line text-left">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              )}
              {activeTab === "reports" && (
                <tr className="bg-gray-50 border-b border-line text-left">
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Visibility</th>
                  <th className="px-3 py-2">Access</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {managementLoading ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                    {t("common.loading")}
                  </td>
                </tr>
              ) : activeTab === "families" ? (
                families.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                      No families found.
                    </td>
                  </tr>
                ) : (
                  families.map((family) => (
                    <tr key={family.id} className="border-b border-line hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold">{family.name}</td>
                      <td className="px-3 py-2">{family.ownerDisplayName}</td>
                      <td className="px-3 py-2">{family.memberCount}</td>
                      <td className="px-3 py-2">{family.archivedAt ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => viewManagementDetail("families", family.id)} className="px-2 py-1 border border-line rounded">
                            View
                          </button>
                          {!family.archivedAt && (
                            <button onClick={() => onFamilyArchive(family.id)} className="px-2 py-1 border border-amber-300 text-amber-700 rounded">
                              Archive
                            </button>
                          )}
                          <button onClick={() => onFamilyDelete(family.id)} className="px-2 py-1 border border-red-300 text-red-700 rounded">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : activeTab === "entries" ? (
                entries.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                      No entries found.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-line hover:bg-gray-50">
                      <td className="px-3 py-2">{entry.gregorianDate}</td>
                      <td className="px-3 py-2">{entry.userDisplayName}</td>
                      <td className="px-3 py-2">{entry.status}</td>
                      <td className="px-3 py-2">
                        {entry.completedFields}/{entry.totalFields}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => viewManagementDetail("entries", entry.id)} className="px-2 py-1 border border-line rounded">
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : activeTab === "challenges" ? (
                challenges.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                      No challenges found.
                    </td>
                  </tr>
                ) : (
                  challenges.map((challenge) => (
                    <tr key={challenge.id} className="border-b border-line hover:bg-gray-50">
                      <td className="px-3 py-2">{challenge.title}</td>
                      <td className="px-3 py-2">{challenge.userDisplayName}</td>
                      <td className="px-3 py-2">{challenge.scope}</td>
                      <td className="px-3 py-2">{challenge.active ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => viewManagementDetail("challenges", challenge.id)} className="px-2 py-1 border border-line rounded">
                            View
                          </button>
                          {challenge.active ? (
                            <button onClick={() => onChallengeAction(challenge.id, "archive")} className="px-2 py-1 border border-amber-300 text-amber-700 rounded">
                              Archive
                            </button>
                          ) : (
                            <button onClick={() => onChallengeAction(challenge.id, "reactivate")} className="px-2 py-1 border border-emerald-300 text-emerald-700 rounded">
                              Reactivate
                            </button>
                          )}
                          <button onClick={() => onChallengeAction(challenge.id, "delete")} className="px-2 py-1 border border-red-300 text-red-700 rounded">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : reports.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                    No reports found.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="border-b border-line hover:bg-gray-50">
                    <td className="px-3 py-2">{report.ownerDisplayName}</td>
                    <td className="px-3 py-2">
                      {report.periodStart} to {report.periodEnd}
                    </td>
                    <td className="px-3 py-2">{report.visibility}</td>
                    <td className="px-3 py-2">{report.accessCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => viewManagementDetail("reports", report.id)} className="px-2 py-1 border border-line rounded">
                          View
                        </button>
                        <button onClick={() => onReportRevokePublic(report.id)} className="px-2 py-1 border border-amber-300 text-amber-700 rounded">
                          Revoke Public
                        </button>
                        <button
                          onClick={() => onReportToggleVisibility(report.id, report.visibility === "public" ? "private" : "public")}
                          className="px-2 py-1 border border-emerald-300 text-emerald-700 rounded"
                        >
                          Set {report.visibility === "public" ? "Private" : "Public"}
                        </button>
                        <button onClick={() => onReportDelete(report.id)} className="px-2 py-1 border border-red-300 text-red-700 rounded">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            {t("admin.page")} {managementPage} {t("admin.of")} {managementTotalPages} ({managementTotal} items)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setManagementPage((prev) => Math.max(1, prev - 1))}
              disabled={managementPage === 1}
              className="px-3 py-1 border border-line rounded-lg disabled:opacity-50"
            >
              {t("admin.previous")}
            </button>
            <button
              onClick={() => setManagementPage((prev) => Math.min(managementTotalPages, prev + 1))}
              disabled={managementPage === managementTotalPages}
              className="px-3 py-1 border border-line rounded-lg disabled:opacity-50"
            >
              {t("admin.next")}
            </button>
          </div>
        </div>

        {managementDetail && (
          <div className="border border-line rounded-xl p-4 space-y-4">
            <h3 className="font-bold text-lg">Selected {managementDetail.tab.slice(0, -1)} Detail</h3>
            
            {managementDetail.tab === "families" && managementDetail.data?.family && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Family Information</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">ID:</span> {managementDetail.data.family.id}</p>
                      <p><span className="font-medium">Name:</span> {managementDetail.data.family.name}</p>
                      <p><span className="font-medium">Created:</span> {formatDateTime(managementDetail.data.family.createdAt)}</p>
                      <p><span className="font-medium">Archived:</span> {managementDetail.data.family.archivedAt ? formatDateTime(managementDetail.data.family.archivedAt) : "No"}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Owner Information</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">ID:</span> {managementDetail.data.family.ownerUserId}</p>
                      <p><span className="font-medium">Name:</span> {managementDetail.data.family.ownerDisplayName}</p>
                      <p><span className="font-medium">Email:</span> {managementDetail.data.family.ownerEmail}</p>
                    </div>
                  </div>
                </div>
                
                {managementDetail.data.members && managementDetail.data.members.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600 mb-2">Members ({managementDetail.data.members.length})</h4>
                    <div className="border border-line rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">User</th>
                            <th className="px-3 py-2 text-left">Role</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {managementDetail.data.members.map((member: any) => (
                            <tr key={member.userId} className="border-t border-line">
                              <td className="px-3 py-2">
                                <div>
                                  <div className="font-medium">{member.displayName}</div>
                                  <div className="text-xs text-gray-500">{member.email}</div>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  member.role === "owner" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"
                                }`}>
                                  {member.role}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  member.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                }`}>
                                  {member.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600">
                                {formatDateTime(member.joinedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm text-gray-600 mb-3">Admin Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={familyTransferUserId}
                      onChange={(e) => setFamilyTransferUserId(e.target.value)}
                      className="border border-line rounded-lg px-3 py-2"
                      placeholder="New owner userId"
                    />
                    <button
                      onClick={() => onFamilyTransferOwnership(managementDetail.data.family.id)}
                      disabled={actionLoading !== null}
                      className="px-3 py-2 border border-line rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === "family-transfer" ? "Processing..." : "Transfer Ownership"}
                    </button>
                    <input
                      type="text"
                      value={familyRemoveUserId}
                      onChange={(e) => setFamilyRemoveUserId(e.target.value)}
                      className="border border-line rounded-lg px-3 py-2"
                      placeholder="Member userId to remove"
                    />
                    <button
                      onClick={() => onFamilyRemoveMember(managementDetail.data.family.id)}
                      disabled={actionLoading !== null}
                      className="px-3 py-2 border border-line rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === "family-remove-member" ? "Processing..." : "Remove Member"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {managementDetail.tab === "entries" && managementDetail.data?.entry && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Entry Information</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">ID:</span> {managementDetail.data.entry.id}</p>
                      <p><span className="font-medium">Date:</span> {managementDetail.data.entry.gregorianDate}</p>
                      <p><span className="font-medium">Status:</span> 
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          managementDetail.data.entry.status === "locked" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}>
                          {managementDetail.data.entry.status}
                        </span>
                      </p>
                      <p><span className="font-medium">Created:</span> {formatDateTime(managementDetail.data.entry.createdAt)}</p>
                      <p><span className="font-medium">Updated:</span> {formatDateTime(managementDetail.data.entry.updatedAt)}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">User Information</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">ID:</span> {managementDetail.data.entry.userId}</p>
                      <p><span className="font-medium">Name:</span> {managementDetail.data.entry.userDisplayName}</p>
                      <p><span className="font-medium">Email:</span> {managementDetail.data.entry.userEmail}</p>
                    </div>
                  </div>
                </div>
                
                {managementDetail.data.entry.data && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600 mb-2">Entry Data</h4>
                    <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-xs">{JSON.stringify(managementDetail.data.entry.data, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {managementDetail.tab === "challenges" && managementDetail.data?.challenge && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Challenge Information</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">ID:</span> {managementDetail.data.challenge.id}</p>
                      <p><span className="font-medium">Title:</span> {managementDetail.data.challenge.title}</p>
                      <p><span className="font-medium">Scope:</span> 
                        <span className="ml-2 px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                          {managementDetail.data.challenge.scope}
                        </span>
                      </p>
                      <p><span className="font-medium">Active:</span> 
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          managementDetail.data.challenge.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {managementDetail.data.challenge.active ? "Yes" : "No"}
                        </span>
                      </p>
                      <p><span className="font-medium">Created:</span> {formatDateTime(managementDetail.data.challenge.createdAt)}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">User Information</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">ID:</span> {managementDetail.data.challenge.userId}</p>
                      <p><span className="font-medium">Name:</span> {managementDetail.data.challenge.userDisplayName}</p>
                      <p><span className="font-medium">Email:</span> {managementDetail.data.challenge.userEmail}</p>
                    </div>
                  </div>
                </div>
                
                {managementDetail.data.challenge.description && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600 mb-2">Description</h4>
                    <p className="text-sm bg-gray-50 rounded-lg p-3">{managementDetail.data.challenge.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-bold">{managementDetail.data.challenge.progressCount || 0}</div>
                    <div className="text-xs text-gray-500">Progress</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-bold">{managementDetail.data.challenge.completedCount || 0}</div>
                    <div className="text-xs text-gray-500">Completed</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-bold">{managementDetail.data.challenge.daysLeft || 0}</div>
                    <div className="text-xs text-gray-500">Days Left</div>
                  </div>
                </div>
              </div>
            )}
            
            {managementDetail.tab === "reports" && managementDetail.data?.report && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Report Information</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">ID:</span> {managementDetail.data.report.id}</p>
                      <p><span className="font-medium">Period:</span> {managementDetail.data.report.periodScope}</p>
                      <p><span className="font-medium">Start:</span> {managementDetail.data.report.periodStart}</p>
                      <p><span className="font-medium">End:</span> {managementDetail.data.report.periodEnd}</p>
                      <p><span className="font-medium">Visibility:</span> 
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          managementDetail.data.report.visibility === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {managementDetail.data.report.visibility}
                        </span>
                      </p>
                      <p><span className="font-medium">Created:</span> {formatDateTime(managementDetail.data.report.createdAt)}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600">Access & Stats</h4>
                    <div className="mt-2 space-y-1">
                      <p><span className="font-medium">Access Count:</span> {managementDetail.data.report.accessCount}</p>
                      <p><span className="font-medium">Public Token:</span> {managementDetail.data.report.hasPublicToken ? "Yes" : "No"}</p>
                      <p><span className="font-medium">Include Profile:</span> {managementDetail.data.report.includeProfileInfo ? "Yes" : "No"}</p>
                      <p><span className="font-medium">Revoked:</span> {managementDetail.data.report.revokedAt ? formatDateTime(managementDetail.data.report.revokedAt) : "No"}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-2">Owner Information</h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p><span className="font-medium">ID:</span> {managementDetail.data.report.ownerUserId}</p>
                    <p><span className="font-medium">Name:</span> {managementDetail.data.report.ownerDisplayName}</p>
                    <p><span className="font-medium">Email:</span> {managementDetail.data.report.ownerEmail}</p>
                  </div>
                </div>
                
                {managementDetail.data.report.publicUrl && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-600 mb-2">Public URL</h4>
                    <a 
                      href={managementDetail.data.report.publicUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm break-all"
                    >
                      {managementDetail.data.report.publicUrl}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {selectedUserId && (
        <section className="border-2 border-line rounded-xl p-4 space-y-4">
          <h2 className="text-xl font-bold">User Detail</h2>
          {detailLoading || !selectedUserDetail ? (
            <div className="text-gray-500">{t("common.loading")}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label={t("admin.entries")} value={selectedUserDetail.metrics.entryCount} />
                <StatCard label={t("challenges.title")} value={selectedUserDetail.metrics.challengeCount} />
                <StatCard label={t("reports.title")} value={selectedUserDetail.metrics.reportCount} />
                <StatCard label={t("family.title")} value={selectedUserDetail.metrics.familyMembershipCount} />
                <StatCard label="Sessions" value={selectedUserDetail.metrics.refreshSessionCount} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-line rounded-xl p-3 space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">{t("admin.email")}:</span> {selectedUserDetail.user.email}
                  </div>
                  <div>
                    <span className="font-semibold">{t("admin.role")}:</span> {selectedUserDetail.user.role}
                  </div>
                  <div>
                    <span className="font-semibold">{t("admin.lang")}:</span> {selectedUserDetail.user.language}
                  </div>
                  <div>
                    <span className="font-semibold">Last Activity:</span> {formatDateTime(selectedUserDetail.metrics.lastActivityAt)}
                  </div>
                  <div>
                    <span className="font-semibold">Timezone:</span> {selectedUserDetail.user.timezoneIana}
                  </div>
                </div>

                <div className="border border-line rounded-xl p-3 space-y-2 text-sm">
                  <h3 className="font-bold">Visibility Approvals</h3>
                  <div>As Owner: approved {selectedUserDetail.visibilityApprovals.asOwner.approved}, pending {selectedUserDetail.visibilityApprovals.asOwner.pending}, rejected {selectedUserDetail.visibilityApprovals.asOwner.rejected}</div>
                  <div>As Viewer: approved {selectedUserDetail.visibilityApprovals.asViewer.approved}, pending {selectedUserDetail.visibilityApprovals.asViewer.pending}, rejected {selectedUserDetail.visibilityApprovals.asViewer.rejected}</div>
                  <h3 className="font-bold pt-2">Entry Status</h3>
                  <div>Open {selectedUserDetail.entryStatus.open} | Locked {selectedUserDetail.entryStatus.locked}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                <div className="border border-line rounded-xl p-3">
                  <h3 className="font-bold mb-2">Families</h3>
                  <div className="space-y-2">
                    {selectedUserDetail.familyMemberships.length === 0 && <div className="text-gray-500">No family memberships.</div>}
                    {selectedUserDetail.familyMemberships.map((family) => (
                      <div key={family.familyId} className="border border-line rounded-lg p-2">
                        <div className="font-semibold">{family.name}</div>
                        <div className="text-xs text-gray-500">{family.role} / {family.status}</div>
                        <div className="text-xs text-gray-500">Owner: {family.ownerDisplayName}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-line rounded-xl p-3">
                  <h3 className="font-bold mb-2">Recent Entries</h3>
                  <div className="space-y-2">
                    {selectedUserDetail.recent.entries.length === 0 && <div className="text-gray-500">No recent entries.</div>}
                    {selectedUserDetail.recent.entries.map((entry) => (
                      <div key={entry.id} className="border border-line rounded-lg p-2">
                        <div className="font-semibold">{entry.gregorianDate}</div>
                        <div className="text-xs text-gray-500">{entry.status}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-line rounded-xl p-3">
                  <h3 className="font-bold mb-2">Recent Challenges</h3>
                  <div className="space-y-2">
                    {selectedUserDetail.recent.challenges.length === 0 && <div className="text-gray-500">No recent challenges.</div>}
                    {selectedUserDetail.recent.challenges.map((challenge) => (
                      <div key={challenge.id} className="border border-line rounded-lg p-2">
                        <div className="font-semibold">{challenge.title}</div>
                        <div className="text-xs text-gray-500">{challenge.scope} / {challenge.active ? "active" : "inactive"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-line rounded-xl p-4 space-y-3">
                <h3 className="font-bold">Edit User</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, displayName: e.target.value }))}
                    className="border border-line rounded-xl px-3 py-2"
                    placeholder="Display name"
                  />
                  <input
                    type="text"
                    value={editForm.timezoneIana}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, timezoneIana: e.target.value }))}
                    className="border border-line rounded-xl px-3 py-2"
                    placeholder="Timezone IANA"
                  />
                  <select
                    value={editForm.language}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, language: e.target.value as "en" | "ar" | "tr" }))}
                    className="border border-line rounded-xl px-3 py-2"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                    <option value="tr">Turkish</option>
                  </select>
                  <select
                    value={editForm.timezoneSource}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, timezoneSource: e.target.value as "auto" | "manual" }))}
                    className="border border-line rounded-xl px-3 py-2"
                  >
                    <option value="auto">auto</option>
                    <option value="manual">manual</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.reminderEnabled}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, reminderEnabled: e.target.checked }))}
                    />
                    Reminder enabled
                  </label>
                  <input
                    type="text"
                    value={editForm.reminderTimeLocal}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, reminderTimeLocal: e.target.value }))}
                    className="border border-line rounded-xl px-3 py-2"
                    placeholder="Reminder time (HH:MM)"
                  />
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                    className="md:col-span-2 border border-line rounded-xl px-3 py-2 min-h-20"
                    placeholder="Bio"
                  />
                  <input
                    type="text"
                    value={editForm.reason}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
                    className="md:col-span-2 border border-line rounded-xl px-3 py-2"
                    placeholder="Reason for admin update (required)"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onSaveUser}
                    disabled={actionLoading !== null}
                    className="bg-ink text-white px-4 py-2 rounded-xl font-bold disabled:opacity-50"
                  >
                    {actionLoading === "save-user" ? t("common.loading") : t("common.save")}
                  </button>
                  <button
                    onClick={onToggleRole}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 rounded-xl border border-purple-300 text-purple-700 disabled:opacity-50"
                  >
                    {selectedUserDetail.user.role === "admin" ? t("admin.demote") : t("admin.promote")}
                  </button>
                  <button
                    onClick={onRevokeSessions}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 rounded-xl border border-amber-300 text-amber-700 disabled:opacity-50"
                  >
                    Revoke Sessions
                  </button>
                  <button
                    onClick={onTriggerPasswordReset}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 rounded-xl border border-blue-300 text-blue-700 disabled:opacity-50"
                  >
                    Trigger Reset
                  </button>
                  <button
                    onClick={onDeleteUser}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 rounded-xl border border-red-300 text-red-700 disabled:opacity-50"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line rounded-xl bg-card p-3">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
