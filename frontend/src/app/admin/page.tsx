"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, isAdmin, getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  language: string;
  reminderEnabled: boolean;
  createdAt: string;
  entryCount: number;
}

interface Stats {
  totalUsers: number;
  totalAdmins: number;
  totalEntries: number;
  totalChallenges: number;
  totalReports: number;
  totalFamilies: number;
  totalReminders: number;
  recentUsers: { email: string; displayName: string; role: string; createdAt: string }[];
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn() || !isAdmin()) {
      router.push("/login");
      return;
    }
    loadStats();
    loadUsers();
  }, []);

  useEffect(() => {
    if (!isLoggedIn() || !isAdmin()) return;
    loadUsers();
  }, [page, search]);

  const loadStats = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/admin/stats", { token });
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = getToken()!;
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const data: any = await apiFetch(`/admin/users?${params}`, { token });
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`${t("admin.changeRoleTo")} "${newRole}"?`)) return;
    try {
      setActionLoading(userId);
      const token = getToken()!;
      await apiFetch(`/admin/users/${userId}/role`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      alert(err.message || t("admin.updateRoleFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`${t("admin.deleteUserConfirm")} "${email}"?`)) return;
    try {
      setActionLoading(userId);
      const token = getToken()!;
      await apiFetch(`/admin/users/${userId}`, { token, method: "DELETE" });
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      alert(err.message || t("admin.deleteUserFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  if (!isLoggedIn() || !isAdmin()) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">{t("admin.title")}</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t("admin.totalUsers")} value={stats.totalUsers} icon="👥" />
          <StatCard label={t("admin.admins")} value={stats.totalAdmins} icon="🛡️" />
          <StatCard label={t("admin.dailyEntries")} value={stats.totalEntries} icon="📝" />
          <StatCard label={t("challenges.title")} value={stats.totalChallenges} icon="🏆" />
          <StatCard label={t("reports.title")} value={stats.totalReports} icon="📊" />
          <StatCard label={t("admin.families")} value={stats.totalFamilies} icon="👨‍👩‍👧‍👦" />
          <StatCard label={t("admin.reminders")} value={stats.totalReminders} icon="🔔" />
          <StatCard label={t("admin.page")} value={`${page}/${totalPages}`} icon="📄" />
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.searchPlaceholder")}
          className="flex-1 border-2 border-line rounded-xl px-4 py-2 focus:outline-none focus:border-ink"
        />
        <button type="submit" className="bg-ink text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 transition">
          {t("admin.search")}
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); setPage(1); }}
            className="border-2 border-line px-4 py-2 rounded-xl font-bold hover:bg-gray-100 transition"
          >
            {t("admin.clear")}
          </button>
        )}
      </form>

      {/* Users Table */}
      <div className="border-2 border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-line text-left">
                <th className="px-4 py-3 font-bold">{t("admin.user")}</th>
                <th className="px-4 py-3 font-bold">{t("admin.email")}</th>
                <th className="px-4 py-3 font-bold">{t("admin.role")}</th>
                <th className="px-4 py-3 font-bold">{t("admin.lang")}</th>
                <th className="px-4 py-3 font-bold">{t("admin.entries")}</th>
                <th className="px-4 py-3 font-bold">{t("admin.joined")}</th>
                <th className="px-4 py-3 font-bold">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t("admin.loading")}</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t("admin.noUsers")}</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-line hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{u.displayName}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 uppercase text-gray-500">{u.language}</td>
                    <td className="px-4 py-3 text-center">{u.entryCount}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleRole(u.id, u.role)}
                          disabled={actionLoading === u.id}
                          className="text-xs px-3 py-1 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 transition disabled:opacity-50"
                        >
                          {u.role === "admin" ? t("admin.demote") : t("admin.promote")}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id, u.email)}
                          disabled={actionLoading === u.id}
                          className="text-xs px-3 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {t("admin.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border-2 border-line font-bold hover:bg-gray-100 disabled:opacity-50 transition"
          >
            {t("admin.previous")}
          </button>
          <span className="px-4 py-2 text-sm font-semibold">
            {t("admin.page")} {page} {t("admin.of")} {totalPages} ({total} {t("admin.users")})
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border-2 border-line font-bold hover:bg-gray-100 disabled:opacity-50 transition"
          >
            {t("admin.next")}
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
      <div className="text-3xl mb-1">{icon}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-gray-500 font-semibold mt-1">{label}</div>
    </div>
  );
}
