"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, isAdmin, getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { ConfirmModal, ConfirmModalState, defaultConfirmModal } from "./components/ConfirmModal";
import { ToastContainer, useToast } from "./components/Toast";
import { OverviewSection } from "./components/OverviewSection";
import { EntityTable } from "./components/EntityTable";
import { EntityDetail } from "./components/EntityDetail";
import { UserDetailPanel } from "./components/UserDetailPanel";
import {
  RoleFilter, LanguageFilter, ReminderFilter, AdminEntityTab,
  OverviewFilters, UserListFilters,
  AdminOverviewResponse, AdminUserRow, AdminUsersResponse, AdminUserDetailResponse,
  EditFormState, AdminFamilyRow, AdminEntryRow, AdminChallengeRow, AdminReportRow,
  ManagementDetail, formatDateTime,
} from "./components/adminTypes";

const defaultOverviewFilters: OverviewFilters = { from: "", to: "", role: "", language: "" };
const defaultUserListFilters: UserListFilters = { search: "", role: "", language: "", reminderEnabled: "", sortBy: "createdAt", sortOrder: "desc" };
const emptyEditForm: EditFormState = { displayName: "", bio: "", language: "en", timezoneIana: "", timezoneSource: "auto", reminderEnabled: true, reminderTimeLocal: "21:00" };

function SortTh({ label, field, sortBy, sortOrder, onSort }: { label: string; field: UserListFilters["sortBy"]; sortBy: string; sortOrder: "asc" | "desc"; onSort: (f: UserListFilters["sortBy"]) => void }) {
  const active = sortBy === field;
  return (
    <th className="px-3 py-2 cursor-pointer select-none hover:bg-gray-100 text-left" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3 text-gray-400" />}
      </span>
    </th>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toasts, showToast, dismissToast } = useToast();
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(defaultConfirmModal);

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
  const [managementSearch, setManagementSearch] = useState("");
  const [appliedManagementSearch, setAppliedManagementSearch] = useState("");
  const [managementTotal, setManagementTotal] = useState(0);
  const [managementTotalPages, setManagementTotalPages] = useState(1);
  const [managementLoading, setManagementLoading] = useState(false);
  const [families, setFamilies] = useState<AdminFamilyRow[]>([]);
  const [entries, setEntries] = useState<AdminEntryRow[]>([]);
  const [challenges, setChallenges] = useState<AdminChallengeRow[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [managementDetail, setManagementDetail] = useState<ManagementDetail | null>(null);
  const [familyTransferUserId, setFamilyTransferUserId] = useState("");
  const [familyRemoveUserId, setFamilyRemoveUserId] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAuthorized = isLoggedIn() && isAdmin();

  const openConfirm = useCallback((title: string, description: string, destructive: boolean, requireReason: boolean, onConfirm: (reason: string) => void) => {
    setConfirmModal({ open: true, title, description, destructive, requireReason, onConfirm });
  }, []);
  const closeConfirm = useCallback(() => setConfirmModal(defaultConfirmModal), []);

  useEffect(() => { if (!isAuthorized) router.push("/login"); }, [isAuthorized, router]);

  const loadOverview = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      setOverviewLoading(true);
      const token = getToken()!;
      const params = new URLSearchParams();
      if (appliedOverviewFilters.from) params.set("from", appliedOverviewFilters.from);
      if (appliedOverviewFilters.to) params.set("to", appliedOverviewFilters.to);
      if (appliedOverviewFilters.role) params.set("role", appliedOverviewFilters.role);
      if (appliedOverviewFilters.language) params.set("language", appliedOverviewFilters.language);
      const q = params.toString();
      const data = await apiFetch<AdminOverviewResponse>(`/admin/overview${q ? `?${q}` : ""}`, { token });
      setOverview(data);
    } catch (err: any) { showToast("error", err.message || "Failed to load overview"); }
    finally { setOverviewLoading(false); }
  }, [appliedOverviewFilters, isAuthorized, showToast]);

  const loadUsers = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      setUsersLoading(true);
      const token = getToken()!;
      const params = new URLSearchParams({ page: String(page), limit: "20", sortBy: appliedUserFilters.sortBy, sortOrder: appliedUserFilters.sortOrder });
      if (appliedUserFilters.search) params.set("search", appliedUserFilters.search);
      if (appliedUserFilters.role) params.set("role", appliedUserFilters.role);
      if (appliedUserFilters.language) params.set("language", appliedUserFilters.language);
      if (appliedUserFilters.reminderEnabled) params.set("reminderEnabled", appliedUserFilters.reminderEnabled);
      const data = await apiFetch<AdminUsersResponse>(`/admin/users?${params.toString()}`, { token });
      setUsers(data.users); setTotalUsers(data.total); setTotalPages(data.totalPages);
    } catch (err: any) { showToast("error", err.message || "Failed to load users"); }
    finally { setUsersLoading(false); }
  }, [appliedUserFilters, isAuthorized, page, showToast]);

  const loadUserDetail = useCallback(async (userId: string) => {
    if (!isAuthorized) return;
    try {
      setDetailLoading(true);
      const token = getToken()!;
      const data = await apiFetch<AdminUserDetailResponse>(`/admin/users/${userId}`, { token });
      setSelectedUserDetail(data);
      setEditForm({ displayName: data.user.displayName, bio: data.user.bio || "", language: data.user.language, timezoneIana: data.user.timezoneIana, timezoneSource: data.user.timezoneSource, reminderEnabled: data.user.reminderEnabled, reminderTimeLocal: data.user.reminderTimeLocal });
    } catch (err: any) { showToast("error", err.message || "Failed to load user details"); }
    finally { setDetailLoading(false); }
  }, [isAuthorized, showToast]);

  const loadManagementTab = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      setManagementLoading(true);
      const token = getToken()!;
      const params = new URLSearchParams({ page: String(managementPage), limit: "10" });
      if (appliedManagementSearch) params.set("search", appliedManagementSearch);
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
    } catch (err: any) { showToast("error", err.message || "Failed to load management data"); }
    finally { setManagementLoading(false); }
  }, [activeTab, isAuthorized, managementPage, appliedManagementSearch, showToast]);

  const viewManagementDetail = useCallback(async (tab: AdminEntityTab, id: string) => {
    if (!isAuthorized) return;
    try {
      setActionLoading(`view-${tab}`);
      const token = getToken()!;
      const ep = tab === "families" ? `/admin/families/${id}` : tab === "entries" ? `/admin/entries/${id}` : tab === "challenges" ? `/admin/challenges/${id}` : `/admin/reports/${id}`;
      const data = await apiFetch<any>(ep, { token });
      setManagementDetail({ tab, data });
    } catch (err: any) { showToast("error", err.message || "Failed to load detail"); }
    finally { setActionLoading(null); }
  }, [isAuthorized, showToast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadManagementTab(); }, [loadManagementTab]);
  useEffect(() => {
    setManagementPage(1); setManagementDetail(null);
    setManagementSearch(""); setAppliedManagementSearch("");
    setFamilyTransferUserId(""); setFamilyRemoveUserId("");
  }, [activeTab]);

  const onApplyOverviewFilters = (e: FormEvent) => { e.preventDefault(); setAppliedOverviewFilters(overviewFilters); };
  const onClearOverviewFilters = () => { setOverviewFilters(defaultOverviewFilters); setAppliedOverviewFilters(defaultOverviewFilters); };
  const onApplyUserFilters = (e: FormEvent) => { e.preventDefault(); setPage(1); setAppliedUserFilters(userFilters); };
  const onClearUserFilters = () => { setUserFilters(defaultUserListFilters); setAppliedUserFilters(defaultUserListFilters); setPage(1); };
  const onToggleSort = (field: UserListFilters["sortBy"]) => {
    const next: UserListFilters = { ...appliedUserFilters, sortBy: field, sortOrder: appliedUserFilters.sortBy === field && appliedUserFilters.sortOrder === "asc" ? "desc" : "asc" };
    setUserFilters(next); setAppliedUserFilters(next); setPage(1);
  };
  const onManagementSearchSubmit = (e: FormEvent) => { e.preventDefault(); setManagementPage(1); setAppliedManagementSearch(managementSearch); };

  const onSelectUser = async (userId: string) => { setSelectedUserId(userId); await loadUserDetail(userId); };
  const onCloseUserPanel = () => { setSelectedUserId(null); setSelectedUserDetail(null); setEditForm(emptyEditForm); };

  const onSaveUser = () => {
    if (!selectedUserId) return;
    const uid = selectedUserId;
    openConfirm("Save User Changes", "Update this user's profile?", false, true, async (reason) => {
      try {
        setActionLoading("save-user");
        const token = getToken()!;
        await apiFetch(`/admin/users/${uid}`, { token, method: "PATCH", body: JSON.stringify({ displayName: editForm.displayName, bio: editForm.bio, language: editForm.language, timezoneIana: editForm.timezoneIana, timezoneSource: editForm.timezoneSource, reminderEnabled: editForm.reminderEnabled, reminderTimeLocal: editForm.reminderTimeLocal, reason }) });
        showToast("success", "User updated successfully");
        await Promise.all([loadUsers(), loadOverview(), loadUserDetail(uid)]);
      } catch (err: any) { showToast("error", err.message || "Failed to update user"); }
      finally { setActionLoading(null); }
    });
  };

  const onToggleRole = () => {
    if (!selectedUserDetail) return;
    const uid = selectedUserDetail.user.id;
    const newRole = selectedUserDetail.user.role === "admin" ? "user" : "admin";
    openConfirm(`Change role to "${newRole}"?`, `This will change ${selectedUserDetail.user.email}'s role.`, false, true, async (reason) => {
      try {
        setActionLoading("toggle-role");
        const token = getToken()!;
        await apiFetch(`/admin/users/${uid}/role`, { token, method: "PATCH", body: JSON.stringify({ role: newRole, reason }) });
        showToast("success", `Role changed to ${newRole}`);
        await Promise.all([loadUsers(), loadOverview(), loadUserDetail(uid)]);
      } catch (err: any) { showToast("error", err.message || t("admin.updateRoleFailed")); }
      finally { setActionLoading(null); }
    });
  };

  const onRevokeSessions = () => {
    if (!selectedUserDetail) return;
    const uid = selectedUserDetail.user.id;
    openConfirm("Revoke All Sessions", `Force logout ${selectedUserDetail.user.email} from all devices?`, true, true, async (reason) => {
      try {
        setActionLoading("revoke-sessions");
        const token = getToken()!;
        await apiFetch(`/admin/users/${uid}/revoke-sessions`, { token, method: "POST", body: JSON.stringify({ reason }) });
        showToast("success", "All sessions revoked");
        await loadUserDetail(uid);
      } catch (err: any) { showToast("error", err.message || "Failed to revoke sessions"); }
      finally { setActionLoading(null); }
    });
  };

  const onDeleteUser = () => {
    if (!selectedUserDetail) return;
    const uid = selectedUserDetail.user.id;
    const email = selectedUserDetail.user.email;
    openConfirm(`Delete "${email}"?`, "Permanent. All user data will be removed.", true, true, async (reason) => {
      try {
        setActionLoading("delete-user");
        const token = getToken()!;
        await apiFetch(`/admin/users/${uid}`, { token, method: "DELETE", body: JSON.stringify({ reason }) });
        showToast("success", "User deleted");
        onCloseUserPanel();
        await Promise.all([loadUsers(), loadOverview()]);
      } catch (err: any) { showToast("error", err.message || t("admin.deleteUserFailed")); }
      finally { setActionLoading(null); }
    });
  };

  const onTriggerPasswordReset = () => {
    if (!selectedUserDetail) return;
    const uid = selectedUserDetail.user.id;
    openConfirm("Trigger Password Reset", `Send reset email to ${selectedUserDetail.user.email} and force logout?`, false, true, async (reason) => {
      try {
        setActionLoading("reset-password");
        const token = getToken()!;
        await apiFetch(`/admin/users/${uid}/reset-password-trigger`, { token, method: "POST", body: JSON.stringify({ reason, forceLogout: true }) });
        showToast("success", "Password reset email sent");
        await loadUserDetail(uid);
      } catch (err: any) { showToast("error", err.message || "Failed to trigger password reset"); }
      finally { setActionLoading(null); }
    });
  };

  const onFamilyTransferOwnership = (familyId: string) => {
    openConfirm("Transfer Family Ownership", "The selected member will become the new owner.", false, true, async (reason) => {
      try {
        setActionLoading("family-transfer");
        const token = getToken()!;
        await apiFetch(`/admin/families/${familyId}/transfer-ownership`, { token, method: "POST", body: JSON.stringify({ newOwnerUserId: familyTransferUserId.trim(), reason }) });
        showToast("success", "Ownership transferred");
        setFamilyTransferUserId("");
        await loadManagementTab(); await viewManagementDetail("families", familyId);
      } catch (err: any) { showToast("error", err.message || "Failed to transfer ownership"); }
      finally { setActionLoading(null); }
    });
  };

  const onFamilyRemoveMember = (familyId: string) => {
    openConfirm("Remove Family Member", "The selected member will be removed from this family.", true, true, async (reason) => {
      try {
        setActionLoading("family-remove-member");
        const token = getToken()!;
        await apiFetch(`/admin/families/${familyId}/remove-member`, { token, method: "POST", body: JSON.stringify({ memberUserId: familyRemoveUserId.trim(), reason }) });
        showToast("success", "Member removed");
        setFamilyRemoveUserId("");
        await loadManagementTab(); await viewManagementDetail("families", familyId);
      } catch (err: any) { showToast("error", err.message || "Failed to remove member"); }
      finally { setActionLoading(null); }
    });
  };

  const onFamilyArchive = (familyId: string) => {
    openConfirm("Archive Family", "This family will be archived and hidden from active listings.", false, true, async (reason) => {
      try {
        setActionLoading("family-archive");
        const token = getToken()!;
        await apiFetch(`/admin/families/${familyId}/archive`, { token, method: "POST", body: JSON.stringify({ reason }) });
        showToast("success", "Family archived");
        await loadManagementTab();
        if (managementDetail?.tab === "families" && managementDetail.data?.family?.id === familyId) await viewManagementDetail("families", familyId);
      } catch (err: any) { showToast("error", err.message || "Failed to archive family"); }
      finally { setActionLoading(null); }
    });
  };

  const onFamilyDelete = (familyId: string) => {
    openConfirm("Delete Family", "Permanent. All family data will be removed.", true, true, async (reason) => {
      try {
        setActionLoading("family-delete");
        const token = getToken()!;
        await apiFetch(`/admin/families/${familyId}`, { token, method: "DELETE", body: JSON.stringify({ reason }) });
        showToast("success", "Family deleted");
        if (managementDetail?.tab === "families" && managementDetail.data?.family?.id === familyId) setManagementDetail(null);
        await loadManagementTab();
      } catch (err: any) { showToast("error", err.message || "Failed to delete family"); }
      finally { setActionLoading(null); }
    });
  };

  const onChallengeAction = (challengeId: string, action: "archive" | "reactivate" | "delete") => {
    openConfirm(`Challenge: ${action}`, `Are you sure you want to ${action} this challenge?`, action === "delete", true, async (reason) => {
      try {
        setActionLoading(`challenge-${action}`);
        const token = getToken()!;
        if (action === "delete") {
          await apiFetch(`/admin/challenges/${challengeId}`, { token, method: "DELETE", body: JSON.stringify({ reason }) });
        } else {
          await apiFetch(`/admin/challenges/${challengeId}/${action}`, { token, method: "POST", body: JSON.stringify({ reason }) });
        }
        showToast("success", `Challenge ${action}d`);
        await loadManagementTab();
        if (action !== "delete" && managementDetail?.tab === "challenges" && managementDetail.data?.challenge?.id === challengeId) await viewManagementDetail("challenges", challengeId);
        if (action === "delete" && managementDetail?.tab === "challenges" && managementDetail.data?.challenge?.id === challengeId) setManagementDetail(null);
      } catch (err: any) { showToast("error", err.message || `Failed to ${action} challenge`); }
      finally { setActionLoading(null); }
    });
  };

  const onReportRevokePublic = (reportId: string) => {
    openConfirm("Revoke Public Access", "This will revoke the public token for this report.", false, true, async (reason) => {
      try {
        setActionLoading("report-revoke");
        const token = getToken()!;
        await apiFetch(`/admin/reports/${reportId}/revoke-public`, { token, method: "POST", body: JSON.stringify({ reason }) });
        showToast("success", "Public access revoked");
        await loadManagementTab();
        if (managementDetail?.tab === "reports" && managementDetail.data?.report?.id === reportId) await viewManagementDetail("reports", reportId);
      } catch (err: any) { showToast("error", err.message || "Failed to revoke public access"); }
      finally { setActionLoading(null); }
    });
  };

  const onReportToggleVisibility = (reportId: string, nextVisibility: "public" | "private") => {
    openConfirm(`Set report to ${nextVisibility}`, `Change report visibility to ${nextVisibility}.`, false, true, async (reason) => {
      try {
        setActionLoading("report-policy");
        const token = getToken()!;
        await apiFetch(`/admin/reports/${reportId}/access-policy`, { token, method: "PATCH", body: JSON.stringify({ visibility: nextVisibility, reason }) });
        showToast("success", `Report set to ${nextVisibility}`);
        await loadManagementTab();
        if (managementDetail?.tab === "reports" && managementDetail.data?.report?.id === reportId) await viewManagementDetail("reports", reportId);
      } catch (err: any) { showToast("error", err.message || "Failed to update report visibility"); }
      finally { setActionLoading(null); }
    });
  };

  const onReportDelete = (reportId: string) => {
    openConfirm("Delete Report", "Permanent. This report will be removed.", true, true, async (reason) => {
      try {
        setActionLoading("report-delete");
        const token = getToken()!;
        await apiFetch(`/admin/reports/${reportId}`, { token, method: "DELETE", body: JSON.stringify({ reason }) });
        showToast("success", "Report deleted");
        if (managementDetail?.tab === "reports" && managementDetail.data?.report?.id === reportId) setManagementDetail(null);
        await loadManagementTab();
      } catch (err: any) { showToast("error", err.message || "Failed to delete report"); }
      finally { setActionLoading(null); }
    });
  };

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <ConfirmModal state={confirmModal} onClose={closeConfirm} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {selectedUserId && selectedUserDetail && !detailLoading && (
        <UserDetailPanel
          detail={selectedUserDetail}
          editForm={editForm}
          onEditFormChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
          onClose={onCloseUserPanel}
          onSave={onSaveUser}
          onToggleRole={onToggleRole}
          onRevokeSessions={onRevokeSessions}
          onTriggerPasswordReset={onTriggerPasswordReset}
          onDelete={onDeleteUser}
          actionLoading={actionLoading}
        />
      )}

      <h1 className="text-3xl font-extrabold">{t("admin.title")}</h1>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <section className="border-2 border-line rounded-xl p-4 space-y-4">
        <h2 className="text-xl font-bold">Overview</h2>
        <form onSubmit={onApplyOverviewFilters} className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input type="date" value={overviewFilters.from} onChange={(e) => setOverviewFilters((p) => ({ ...p, from: e.target.value }))} className="border-2 border-line rounded-xl px-3 py-2 text-sm" />
          <input type="date" value={overviewFilters.to} onChange={(e) => setOverviewFilters((p) => ({ ...p, to: e.target.value }))} className="border-2 border-line rounded-xl px-3 py-2 text-sm" />
          <select value={overviewFilters.role} onChange={(e) => setOverviewFilters((p) => ({ ...p, role: e.target.value as RoleFilter }))} className="border-2 border-line rounded-xl px-3 py-2 text-sm">
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select value={overviewFilters.language} onChange={(e) => setOverviewFilters((p) => ({ ...p, language: e.target.value as LanguageFilter }))} className="border-2 border-line rounded-xl px-3 py-2 text-sm">
            <option value="">All Languages</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
            <option value="tr">TR</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-ink text-white rounded-xl px-4 py-2 text-sm font-bold">
              {overviewLoading ? t("common.loading") : "Apply"}
            </button>
            <button type="button" onClick={onClearOverviewFilters} className="px-4 py-2 border-2 border-line rounded-xl text-sm font-bold">
              {t("admin.clear")}
            </button>
          </div>
        </form>
        {overview && <OverviewSection overview={overview} onSelectUser={onSelectUser} />}
      </section>

      {/* ── User Management ───────────────────────────────────────────────── */}
      <section className="border-2 border-line rounded-xl p-4 space-y-4">
        <h2 className="text-xl font-bold">User Management</h2>
        <form onSubmit={onApplyUserFilters} className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder={t("admin.searchPlaceholder")}
            value={userFilters.search}
            onChange={(e) => setUserFilters((p) => ({ ...p, search: e.target.value }))}
            className="md:col-span-2 border-2 border-line rounded-xl px-3 py-2 text-sm"
          />
          <select value={userFilters.role} onChange={(e) => setUserFilters((p) => ({ ...p, role: e.target.value as RoleFilter }))} className="border-2 border-line rounded-xl px-3 py-2 text-sm">
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select value={userFilters.language} onChange={(e) => setUserFilters((p) => ({ ...p, language: e.target.value as LanguageFilter }))} className="border-2 border-line rounded-xl px-3 py-2 text-sm">
            <option value="">All Languages</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
            <option value="tr">TR</option>
          </select>
          <select value={userFilters.reminderEnabled} onChange={(e) => setUserFilters((p) => ({ ...p, reminderEnabled: e.target.value as ReminderFilter }))} className="border-2 border-line rounded-xl px-3 py-2 text-sm">
            <option value="">All Reminders</option>
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-ink text-white rounded-xl px-4 py-2 text-sm font-bold">{t("admin.search")}</button>
            <button type="button" onClick={onClearUserFilters} className="px-4 py-2 border-2 border-line rounded-xl text-sm font-bold">{t("admin.clear")}</button>
          </div>
        </form>

        <div className="overflow-x-auto border border-line rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-line">
                <th className="px-3 py-2 text-left">{t("admin.user")}</th>
                <th className="px-3 py-2 text-left">{t("admin.email")}</th>
                <th className="px-3 py-2 text-left">{t("admin.role")}</th>
                <th className="px-3 py-2 text-left">{t("admin.lang")}</th>
                <SortTh label={t("admin.entries")} field="entryCount" sortBy={appliedUserFilters.sortBy} sortOrder={appliedUserFilters.sortOrder} onSort={onToggleSort} />
                <SortTh label="Last Activity" field="lastActivityAt" sortBy={appliedUserFilters.sortBy} sortOrder={appliedUserFilters.sortOrder} onSort={onToggleSort} />
                <SortTh label="Joined" field="createdAt" sortBy={appliedUserFilters.sortBy} sortOrder={appliedUserFilters.sortOrder} onSort={onToggleSort} />
                <th className="px-3 py-2 text-left">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>{t("admin.loading")}</td></tr>
              ) : users.length === 0 ? (
                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>{t("admin.noUsers")}</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className={`border-b border-line hover:bg-gray-50 ${selectedUserId === user.id ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-2 font-semibold">{user.displayName}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{user.email}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>{user.role}</span>
                  </td>
                  <td className="px-3 py-2 uppercase text-xs">{user.language}</td>
                  <td className="px-3 py-2">{user.entryCount}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(user.lastActivityAt)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(user.createdAt)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => onSelectUser(user.id)} className="text-xs px-3 py-1 rounded-lg border border-line hover:bg-gray-100 font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t("admin.page")} {page} {t("admin.of")} {totalPages} ({totalUsers} {t("admin.users")})</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-line rounded-lg disabled:opacity-50">{t("admin.previous")}</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border border-line rounded-lg disabled:opacity-50">{t("admin.next")}</button>
          </div>
        </div>
      </section>

      {/* ── Entity Management ─────────────────────────────────────────────── */}
      <section className="border-2 border-line rounded-xl p-4 space-y-4">
        <h2 className="text-xl font-bold">Entity Management</h2>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {(["families", "entries", "challenges", "reports"] as AdminEntityTab[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${activeTab === tab ? "bg-ink text-white border-ink" : "border-line hover:bg-gray-100"}`}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <form onSubmit={onManagementSearchSubmit} className="flex gap-2 ml-auto">
            <input
              type="text"
              value={managementSearch}
              onChange={(e) => setManagementSearch(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="border-2 border-line rounded-xl px-3 py-2 text-sm w-44 focus:outline-none focus:border-accent"
            />
            <button type="submit" className="px-3 py-2 bg-ink text-white rounded-xl text-sm font-semibold">{t("admin.search")}</button>
            {appliedManagementSearch && (
              <button type="button" onClick={() => { setManagementSearch(""); setAppliedManagementSearch(""); setManagementPage(1); }}
                className="px-3 py-2 border-2 border-line rounded-xl text-sm">{t("admin.clear")}</button>
            )}
          </form>
        </div>

        <EntityTable
          activeTab={activeTab}
          families={families} entries={entries} challenges={challenges} reports={reports}
          loading={managementLoading}
          actionLoading={actionLoading}
          onView={viewManagementDetail}
          onFamilyArchive={onFamilyArchive}
          onFamilyDelete={onFamilyDelete}
          onChallengeAction={onChallengeAction}
          onReportRevokePublic={onReportRevokePublic}
          onReportToggleVisibility={onReportToggleVisibility}
          onReportDelete={onReportDelete}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t("admin.page")} {managementPage} {t("admin.of")} {managementTotalPages} ({managementTotal} items)</span>
          <div className="flex gap-2">
            <button onClick={() => setManagementPage((p) => Math.max(1, p - 1))} disabled={managementPage === 1} className="px-3 py-1 border border-line rounded-lg disabled:opacity-50">{t("admin.previous")}</button>
            <button onClick={() => setManagementPage((p) => Math.min(managementTotalPages, p + 1))} disabled={managementPage === managementTotalPages} className="px-3 py-1 border border-line rounded-lg disabled:opacity-50">{t("admin.next")}</button>
          </div>
        </div>

        {managementDetail && (
          <EntityDetail
            detail={managementDetail}
            familyTransferUserId={familyTransferUserId}
            onTransferChange={setFamilyTransferUserId}
            familyRemoveUserId={familyRemoveUserId}
            onRemoveChange={setFamilyRemoveUserId}
            onTransfer={onFamilyTransferOwnership}
            onRemove={onFamilyRemoveMember}
            actionLoading={actionLoading}
          />
        )}
      </section>
    </div>
  );
}
