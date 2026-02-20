"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getQuickDates(preset: string): { start: string; end: string; scope: string } {
  const now = new Date();
  const today = toDateStr(now);
  if (preset === "today") return { start: today, end: today, scope: "day" };
  if (preset === "thisWeek") {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: toDateStr(mon), end: toDateStr(sun), scope: "week" };
  }
  if (preset === "lastWeek") {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7) - 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: toDateStr(mon), end: toDateStr(sun), scope: "week" };
  }
  if (preset === "thisMonth") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toDateStr(first), end: toDateStr(last), scope: "month" };
  }
  return { start: today, end: today, scope: "custom" };
}

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [periodScope, setPeriodScope] = useState("week");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [includeProfile, setIncludeProfile] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedShare, setExpandedShare] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/reports/mine", { token });
      setReports(data.reports || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const token = getToken()!;
      await apiFetch("/reports", {
        method: "POST",
        token,
        body: JSON.stringify({ periodScope, periodStart, periodEnd, visibility, includeProfileInfo: includeProfile }),
      });
      setShowForm(false);
      setPeriodStart(""); setPeriodEnd("");
      loadReports();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm(t("reports.deleteConfirm"))) return;
    try {
      const token = getToken()!;
      await apiFetch(`/reports/${id}`, { method: "DELETE", token });
      loadReports();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const revokeLink = async (id: string) => {
    try {
      const token = getToken()!;
      await apiFetch(`/reports/${id}/revoke`, { method: "POST", token });
      loadReports();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getShareLink = async (id: string) => {
    if (expandedShare === id) { setExpandedShare(null); return; }
    try {
      const token = getToken()!;
      const data: any = await apiFetch(`/reports/${id}/share-link`, { method: "POST", token });
      setShareLink(data.link);
      setExpandedShare(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const applyQuickDate = (preset: string) => {
    const { start, end, scope } = getQuickDates(preset);
    setPeriodStart(start);
    setPeriodEnd(end);
    setPeriodScope(scope);
  };

  // Stats
  const stats = useMemo(() => {
    const total = reports.length;
    const pub = reports.filter((r) => r.visibility === "public").length;
    const priv = reports.filter((r) => r.visibility === "private").length;
    const views = reports.reduce((sum, r) => sum + (r.accessLog?.length || 0), 0);
    return { total, pub, priv, views };
  }, [reports]);

  if (loading) return <div className="text-center py-20 text-lg">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{t("reports.title")}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-ink text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
        >
          {showForm ? t("common.cancel") : t("reports.createPlus")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* Stats Overview */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-2xl font-extrabold">{stats.total}</div>
                <div className="text-xs text-gray-500">{t("reports.totalReports")}</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <div>
                <div className="text-2xl font-extrabold">{stats.pub}</div>
                <div className="text-xs text-gray-500">{t("reports.publicReports")}</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <div className="text-2xl font-extrabold">{stats.priv}</div>
                <div className="text-xs text-gray-500">{t("reports.privateReports")}</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👁️</span>
              <div>
                <div className="text-2xl font-extrabold">{stats.views}</div>
                <div className="text-xs text-gray-500">{t("reports.totalViews")}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="border-2 border-ink/20 rounded-2xl bg-white p-5 shadow-md space-y-4">
          <h2 className="font-bold text-lg">📝 {t("reports.createAction")}</h2>

          {/* Quick Period Buttons */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">{t("reports.quickPeriod")}</label>
            <div className="flex flex-wrap gap-2">
              {["today", "thisWeek", "lastWeek", "thisMonth"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyQuickDate(preset)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-gray-200 hover:border-ink hover:bg-ink/5 transition-all"
                >
                  {t(`reports.${preset}`)}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={createReport} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("reports.startDate")}</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className="w-full border-2 border-line rounded-xl px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("reports.endDate")}</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required className="w-full border-2 border-line rounded-xl px-4 py-2.5 text-sm" />
              </div>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Scope</label>
              <div className="flex gap-2">
                {(["day", "week", "month", "custom"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setPeriodScope(s)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                      periodScope === s ? "bg-ink text-white border-ink shadow-sm" : "border-line hover:border-gray-300"
                    }`}>
                    {t(`reports.${s}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Visibility & Options */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setVisibility("private")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    visibility === "private" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-line hover:border-gray-300"
                  }`}>
                  🔒 {t("reports.private")}
                </button>
                <button type="button" onClick={() => setVisibility("public")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    visibility === "public" ? "border-green-400 bg-green-50 text-green-700" : "border-line hover:border-gray-300"
                  }`}>
                  🌐 {t("reports.public")}
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={includeProfile} onChange={(e) => setIncludeProfile(e.target.checked)} className="w-4 h-4 accent-ink rounded" />
                <span className="font-medium text-gray-600">{t("reports.includeProfileInfo")}</span>
              </label>
            </div>

            {/* Preview summary */}
            {periodStart && periodEnd && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 flex flex-wrap items-center gap-2">
                <span>📅 {formatDate(periodStart)} → {formatDate(periodEnd)}</span>
                <span className="text-gray-400">•</span>
                <span>{daysBetween(periodStart, periodEnd)} days</span>
                <span className="text-gray-400">•</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${visibility === "public" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {visibility === "public" ? "🌐 " : "🔒 "}{t(`reports.${visibility}`)}
                </span>
              </div>
            )}

            <button type="submit" disabled={creating}
              className="w-full sm:w-auto bg-ink text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
              {creating ? t("common.loading") : t("reports.createAction")}
            </button>
          </form>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-500 text-lg font-medium">{t("reports.noReports")}</p>
          <p className="text-gray-400 text-sm mt-1">{t("reports.noReportsDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const views = r.accessLog?.length || 0;
            const isPublic = r.visibility === "public";
            const isRevoked = !!r.revokedAt;
            const days = daysBetween(r.periodStart, r.periodEnd);
            const isShareExpanded = expandedShare === r._id;

            return (
              <div key={r._id} className={`border-2 rounded-2xl bg-white overflow-hidden transition-all hover:shadow-md ${
                isRevoked ? "border-red-200 opacity-75" : isPublic ? "border-green-200" : "border-gray-200"
              }`}>
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Date visual */}
                    <div className={`hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white font-bold shrink-0 ${
                      isRevoked ? "bg-red-400" : isPublic ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-blue-500 to-indigo-600"
                    }`}>
                      <span className="text-lg leading-none">{days}</span>
                      <span className="text-[10px] opacity-80 mt-0.5">days</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base">
                          {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-600 uppercase">
                          {t(`reports.${r.periodScope}`)}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isPublic ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {isPublic ? "🌐 " : "🔒 "}{isPublic ? t("reports.public") : t("reports.private")}
                        </span>
                        {isRevoked && (
                          <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                            ⛔ {t("reports.revoked")}
                          </span>
                        )}
                        {r.includeProfileInfo && (
                          <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                            👤 Profile
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          👁️ {views} {t("reports.views")}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-400 mt-1.5">
                        {t("reports.createdOn")}: {timeAgo(r.createdAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                      <button
                        onClick={() => router.push(`/reports/${r._id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-ink text-white hover:opacity-90 transition"
                      >
                        {t("reports.viewReport")}
                      </button>
                      <button
                        onClick={() => getShareLink(r._id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                          isShareExpanded ? "border-ink bg-ink/5 text-ink" : "border-line hover:bg-gray-50"
                        }`}
                      >
                        🔗 {t("reports.share")}
                      </button>
                      {isPublic && !isRevoked && (
                        <button
                          onClick={() => revokeLink(r._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 transition"
                        >
                          {t("reports.revoke")}
                        </button>
                      )}
                      <button
                        onClick={() => deleteReport(r._id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Inline Share Link */}
                  {isShareExpanded && shareLink && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          readOnly
                          value={shareLink}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 select-all"
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          onClick={() => copyLink(shareLink, r._id)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            copiedId === r._id
                              ? "bg-green-500 text-white"
                              : "bg-ink text-white hover:opacity-90"
                          }`}
                        >
                          {copiedId === r._id ? "✓ " + t("reports.copied") : t("reports.copy")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
