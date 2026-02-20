"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn, getUser } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

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

interface DashboardFilters { from?: string; to?: string; }

function ProgressRing({ percent, size = 100, stroke = 8, color }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  const offset = circ - (p / 100) * circ;
  const c = color || (p >= 80 ? "#22c55e" : p >= 60 ? "#3b82f6" : p >= 40 ? "#eab308" : "#ef4444");
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
    </svg>
  );
}

function fmtDate(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  catch { return d; }
}
function fmtShort(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return d; }
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "🌙"; if (h < 12) return "🌅"; if (h < 17) return "☀️"; if (h < 20) return "🌇"; return "🌙";
}

const CAT_ICONS: Record<string, string> = {
  sawm: "🌙", ibadah: "🕌", salah: "🙏", sunnah: "☪️", dua: "🤲",
  akhlaq: "💜", sadaqah: "🤝", habit: "💪", mood: "😊",
  gratitude: "🙏", quran: "📖", hadith: "📿", challenge: "🎯",
};

function getQuickDates(preset: string): { from: string; to: string } {
  const now = new Date();
  const today = toDateStr(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "thisWeek") {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: toDateStr(mon), to: toDateStr(sun) };
  }
  if (preset === "lastWeek") {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7) - 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: toDateStr(mon), to: toDateStr(sun) };
  }
  if (preset === "thisMonth") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toDateStr(first), to: toDateStr(last) };
  }
  if (preset === "last30") {
    const from = new Date(now); from.setDate(now.getDate() - 29);
    return { from: toDateStr(from), to: today };
  }
  return { from: today, to: today };
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [gifts, setGifts] = useState<any[]>([]);
  const [unseenGifts, setUnseenGifts] = useState(0);

  const loadDashboard = useCallback(async (filters: DashboardFilters = {}) => {
    try {
      setLoading(true); setError("");
      const token = getToken();
      if (!token) { router.push("/login"); return; }
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      // Send client's local date so backend uses correct timezone-aware reference
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      params.set("today", localToday);
      const result = await apiFetch(`/dashboard/summary?${params.toString()}`, { token });
      setData(result);
    } catch (err: any) {
      setData(null); setError(err.message || t("dashboard.failedLoad"));
    } finally { setLoading(false); }
  }, [router, t]);

  const loadGifts = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const data: any = await apiFetch("/me/gifts", { token });
      setGifts(data.gifts || []);
      setUnseenGifts(data.unseenCount || 0);
    } catch {}
  }, []);

  const markGiftsSeen = useCallback(async () => {
    try {
      const token = getToken();
      if (!token || unseenGifts === 0) return;
      await apiFetch("/me/gifts/seen", { method: "PATCH", token });
      setUnseenGifts(0);
      setGifts((prev) => prev.map((g) => ({ ...g, seen: true })));
    } catch {}
  }, [unseenGifts]);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    setUser(getUser());
    loadDashboard();
    loadGifts();
  }, [loadDashboard, loadGifts]);

  const applyFilters = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromDate && toDate && fromDate > toDate) { setError(t("dashboard.invalidRange")); return; }
    setActivePreset(null);
    await loadDashboard({ from: fromDate || undefined, to: toDate || undefined });
  };

  const applyPreset = async (preset: string) => {
    const { from, to } = getQuickDates(preset);
    setFromDate(from); setToDate(to); setActivePreset(preset);
    await loadDashboard({ from, to });
  };

  const clearFilters = async () => {
    setFromDate(""); setToDate(""); setActivePreset(null);
    await loadDashboard();
  };

  if (loading) return (
    <div className="space-y-5 animate-pulse">
      <div className="h-40 rounded-2xl bg-gradient-to-br from-indigo-200 via-purple-200 to-indigo-200" />
      <div className="h-20 rounded-2xl bg-gray-100" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-100" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="h-44 rounded-2xl bg-gray-100" />
          <div className="h-44 rounded-2xl bg-gray-100" />
          <div className="h-56 rounded-2xl bg-gray-100" />
        </div>
        <div className="space-y-5">
          <div className="h-52 rounded-2xl bg-gray-100" />
          <div className="h-40 rounded-2xl bg-gray-100" />
          <div className="h-36 rounded-2xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
  if (!data) return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">😔</div>
      <p className="text-red-600 font-medium">{error || t("dashboard.failedLoad")}</p>
      <button onClick={() => loadDashboard()} className="mt-4 bg-ink text-white px-6 py-2 rounded-xl font-bold text-sm">Retry</button>
    </div>
  );

  const todayScore = data.today.hasEntry && data.today.totalFields > 0
    ? Math.round((data.today.completedFields / data.today.totalFields) * 100) : null;
  const last7 = (data.completionScores || []).slice(0, 7).reverse();

  return (
    <div className="space-y-5">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <span>{getGreeting()}</span><span>{t("dashboard.welcome")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{user?.displayName || "User"}</h1>
            <p className="text-white/70 text-sm mt-1">{t("dashboard.todayIs")} {fmtDate(data.today.date)}</p>
            <p className="text-white/50 text-xs mt-2 italic">{t("dashboard.motivationalQuote")}</p>

            {data.today.hasEntry ? (
              <div className="mt-3 bg-white/10 backdrop-blur rounded-xl px-4 py-2 inline-flex items-center gap-2">
                <span className="text-lg">{todayScore !== null && todayScore >= 75 ? "🎉" : "📝"}</span>
                <span className="text-sm font-bold">
                  {todayScore !== null && todayScore >= 75 ? t("dashboard.greatJob") : t("dashboard.keepGoing")}
                </span>
                <span className="text-white/70 text-sm">{data.today.completedFields}/{data.today.totalFields} • {todayScore ?? 0}%</span>
              </div>
            ) : (
              <button onClick={() => router.push("/tracker")} className="mt-3 bg-amber-500/30 backdrop-blur rounded-xl px-4 py-2 inline-flex items-center gap-2 hover:bg-amber-500/40 transition">
                <span className="text-lg">⚡</span>
                <span className="text-sm font-bold">{t("dashboard.noTrackedToday")}</span>
              </button>
            )}
          </div>
          <div className="hidden sm:block relative shrink-0">
            <ProgressRing percent={data.avgScore || 0} size={90} stroke={7} color="rgba(255,255,255,0.85)" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black">{data.avgScore || 0}%</span>
              <span className="text-[8px] text-white/60">{t("dashboard.completionRate")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm flex items-center gap-2">🔍 {t("dashboard.filters")}</h2>
          {data.range?.isFiltered && (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              {fmtShort(data.range.from || "")} → {fmtShort(data.range.to || "")}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "today", label: t("reports.today") },
            { key: "thisWeek", label: t("reports.thisWeek") },
            { key: "lastWeek", label: t("reports.lastWeek") },
            { key: "thisMonth", label: t("reports.thisMonth") },
            { key: "last30", label: "Last 30d" },
          ].map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                activePreset === p.key ? "border-ink bg-ink text-white" : "border-gray-200 hover:border-gray-300"
              }`}>{p.label}</button>
          ))}
          {(data.range?.isFiltered || activePreset) && (
            <button onClick={clearFilters} className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 transition-all">
              ✕ {t("dashboard.clearFilters")}
            </button>
          )}
        </div>
        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] text-gray-400 mb-0.5">{t("dashboard.fromDate")}</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] text-gray-400 mb-0.5">{t("dashboard.toDate")}</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
          </div>
          <button type="submit" className="bg-ink text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition h-[34px]">
            {t("dashboard.applyFilters")}
          </button>
        </form>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: "📝", label: t("dashboard.trackToday"), href: "/tracker", color: "from-blue-500 to-indigo-600" },
          { icon: "🎯", label: t("dashboard.viewChallenges"), href: "/challenges", color: "from-amber-500 to-orange-600" },
          { icon: "📊", label: t("dashboard.viewReports"), href: "/reports", color: "from-green-500 to-emerald-600" },
          { icon: "👨‍👩‍👧‍👦", label: t("dashboard.viewFamily"), href: "/family", color: "from-purple-500 to-pink-600" },
        ].map((a) => (
          <button key={a.href} onClick={() => router.push(a.href)}
            className={`bg-gradient-to-br ${a.color} text-white rounded-2xl p-3 sm:p-4 text-center hover:shadow-lg hover:scale-[1.02] transition-all`}>
            <div className="text-xl sm:text-2xl mb-1">{a.icon}</div>
            <div className="text-[10px] sm:text-xs font-bold leading-tight">{a.label}</div>
          </button>
        ))}
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-base">🔥</div>
            <div><div className="text-xl font-extrabold">{data.currentStreak}</div><div className="text-[10px] text-gray-500">{t("dashboard.dayStreak")}</div></div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-base">📝</div>
            <div><div className="text-xl font-extrabold">{data.totalEntries}</div><div className="text-[10px] text-gray-500">{t("dashboard.totalEntries")}</div></div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center text-base">💯</div>
            <div><div className="text-xl font-extrabold">{data.perfectDays || 0}</div><div className="text-[10px] text-gray-500">{t("dashboard.perfectDays")}</div></div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-base">📊</div>
            <div><div className="text-xl font-extrabold">{data.avgScore || 0}%</div><div className="text-[10px] text-gray-500">{t("dashboard.completionRate")}</div></div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-base">✅</div>
            <div><div className="text-xl font-extrabold">{data.totalCompletedItems || 0}</div><div className="text-[10px] text-gray-500">{t("dashboard.totalItems")}</div></div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-base">🎯</div>
            <div><div className="text-xl font-extrabold">{data.challengeSummary?.length || 0}</div><div className="text-[10px] text-gray-500">{t("dashboard.activeChallenges")}</div></div>
          </div>
        </div>
      </div>

      {/* Best / Worst Day Highlight */}
      {data.bestDay && data.worstDay && data.totalEntries > 1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="text-3xl">🏆</div>
            <div>
              <div className="text-xs text-green-600 font-medium">Best Day</div>
              <div className="text-lg font-extrabold text-green-700">{data.bestDay.score}%</div>
              <div className="text-[10px] text-green-500">{fmtDate(data.bestDay.date)} • {data.bestDay.completed}/{data.bestDay.total}</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="text-3xl">📉</div>
            <div>
              <div className="text-xs text-red-600 font-medium">Needs Improvement</div>
              <div className="text-lg font-extrabold text-red-700">{data.worstDay.score}%</div>
              <div className="text-[10px] text-red-500">{fmtDate(data.worstDay.date)} • {data.worstDay.completed}/{data.worstDay.total}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Last 7 Days Bar Chart */}
          {last7.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">📅 {t("dashboard.last7Days")}</h2>
              <div className="flex items-end gap-1.5" style={{ height: "120px" }}>
                {last7.map((day: any) => {
                  const isToday = day.date === data.today.date;
                  const barH = Math.max(6, (day.score / 100) * 120);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className={`w-full rounded-t-lg transition-all duration-700 ${isToday ? "ring-2 ring-indigo-400 ring-offset-2" : ""}`}
                        style={{
                          height: `${barH}px`,
                          background: day.score >= 80 ? "linear-gradient(180deg, #22c55e, #16a34a)" :
                            day.score >= 60 ? "linear-gradient(180deg, #3b82f6, #2563eb)" :
                            day.score >= 40 ? "linear-gradient(180deg, #eab308, #ca8a04)" :
                            day.score > 0 ? "linear-gradient(180deg, #ef4444, #dc2626)" : "#e5e7eb",
                        }} />
                      <div className="text-[10px] font-bold mt-1.5 text-gray-500">
                        {new Date(day.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                      </div>
                      <div className="text-[9px] text-gray-400">{day.score}%</div>
                      <div className="absolute -top-8 bg-gray-900 text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                        {fmtDate(day.date)}: {day.score}% ({day.completed}/{day.total})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly Trend */}
          {data.weeklyStats?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">📈 {t("dashboard.weeklyTrendLast4")}</h2>
              <div className="grid grid-cols-4 gap-3">
                {data.weeklyStats.map((w: any, i: number) => {
                  const isFirst = i === 0;
                  const hasData = w.entryCount > 0;
                  return (
                    <div key={w.week} className={`text-center rounded-xl p-3 transition-all ${
                      isFirst ? "bg-indigo-50 border-2 border-indigo-200" : hasData ? "bg-gray-50 border border-gray-100" : "bg-gray-50/50 border border-dashed border-gray-200"
                    }`}>
                      <div className="relative mx-auto mb-2">
                        <ProgressRing percent={w.avgScore} size={56} stroke={5} color={!hasData ? "#e5e7eb" : undefined} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-sm font-extrabold ${!hasData ? "text-gray-300" : ""}`}>{w.avgScore}%</span>
                        </div>
                      </div>
                      <p className={`text-xs font-bold ${isFirst ? "text-indigo-600" : hasData ? "text-gray-600" : "text-gray-400"}`}>
                        {isFirst ? "This Week" : `W${w.week}`}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        {w.entryCount} {t("dashboard.days")}
                      </p>
                      <p className="text-[8px] text-gray-300 mt-0.5">
                        {fmtShort(w.startDate)} - {fmtShort(w.endDate)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {data.categoryBreakdown?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">📂 {t("dashboard.categoryProgress")}</h2>
              <div className="space-y-3">
                {data.categoryBreakdown.map((cat: any) => {
                  const label = cat.category.charAt(0).toUpperCase() + cat.category.slice(1).replace(/-/g, " ");
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold flex items-center gap-1.5">
                          <span>{CAT_ICONS[cat.category] || "📋"}</span> {label}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">{cat.completed}/{cat.total} ({cat.rate}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{
                          width: `${cat.rate}%`,
                          background: cat.rate >= 75 ? "linear-gradient(90deg, #22c55e, #10b981)" :
                            cat.rate >= 50 ? "linear-gradient(90deg, #3b82f6, #6366f1)" :
                            cat.rate >= 25 ? "linear-gradient(90deg, #eab308, #f59e0b)" :
                            "linear-gradient(90deg, #ef4444, #f97316)",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Field Highlights */}
          {data.fieldHighlights?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">⭐ Top Fields</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.fieldHighlights.map((f: any) => (
                  <div key={f.fieldKey} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      f.rate >= 80 ? "bg-green-100 text-green-700" : f.rate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                    }`}>{f.rate}%</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{f.fieldKey.replace(/_/g, " ")}</div>
                      <div className="text-[9px] text-gray-400">{f.completed}/{f.total} days</div>
                    </div>
                    {f.rate === 100 && <span className="text-sm">🏅</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Days */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-sm mb-4 flex items-center gap-2">📋 {t("dashboard.recentDays")}</h2>
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {data.completionScores?.map((s: any) => {
                const isToday = s.date === data.today.date;
                return (
                  <div key={s.date} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-all ${
                    isToday ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                  }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      s.score === 100 ? "bg-green-500 text-white" :
                      s.score >= 75 ? "bg-blue-500 text-white" :
                      s.score >= 50 ? "bg-yellow-500 text-white" :
                      "bg-red-400 text-white"
                    }`}>{s.score === 100 ? "💯" : s.score + "%"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{fmtDate(s.date)}</span>
                        {isToday && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">Today</span>}
                        {s.score === 100 && <span className="text-xs">🏅</span>}
                      </div>
                      <div className="text-[9px] text-gray-400">{s.completed}/{s.total} items</div>
                    </div>
                    <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden shrink-0">
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${s.score}%`,
                        background: s.score >= 75 ? "#22c55e" : s.score >= 50 ? "#eab308" : "#ef4444",
                      }} />
                    </div>
                  </div>
                );
              })}
              {(!data.completionScores || data.completionScores.length === 0) && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📝</div>
                  <p className="text-gray-500 text-sm">{t("dashboard.noEntriesYet")}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-5">

          {/* Overall Progress Ring */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
            <h2 className="font-bold text-sm mb-3">{t("dashboard.overallProgress")}</h2>
            <div className="relative inline-block">
              <ProgressRing percent={data.avgScore || 0} size={130} stroke={10} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black">{data.avgScore || 0}%</span>
                <span className="text-[9px] text-gray-400">{t("dashboard.completionRate")}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <div className="text-base font-bold">{data.currentStreak}</div>
                <div className="text-[8px] text-gray-400">🔥 Streak</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <div className="text-base font-bold">{data.perfectDays || 0}</div>
                <div className="text-[8px] text-gray-400">💯 Perfect</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <div className="text-base font-bold">{data.totalCompletedItems || 0}</div>
                <div className="text-[8px] text-gray-400">✅ Items</div>
              </div>
            </div>
          </div>

          {/* Challenge Progress */}
          {data.challengeSummary?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">🎯 {t("dashboard.challengeProgress")}</h2>
              <div className="space-y-2.5">
                {data.challengeSummary.map((c: any) => {
                  const pct = c.totalProgress > 0 ? Math.round((c.completedCount / c.totalProgress) * 100) : 0;
                  return (
                    <div key={c.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold truncate">{c.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          c.scope === "daily" ? "bg-blue-100 text-blue-700" :
                          c.scope === "weekly" ? "bg-purple-100 text-purple-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>{c.scope}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{
                            width: `${pct}%`,
                            background: pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : "#6366f1",
                          }} />
                        </div>
                        <span className="text-[9px] font-bold text-gray-500 w-12 text-right">{c.completedCount}/{c.totalProgress}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gifts Received */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm flex items-center gap-2">
                🎁 {t("dashboard.giftsReceived") || "Gifts Received"}
                {unseenGifts > 0 && (
                  <span className="bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unseenGifts} new</span>
                )}
              </h2>
              {unseenGifts > 0 && (
                <button onClick={markGiftsSeen} className="text-[10px] text-indigo-600 font-semibold hover:underline">
                  Mark all seen
                </button>
              )}
            </div>
            {gifts.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-1">🎁</div>
                <p className="text-xs text-gray-400">No gifts received yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {gifts.slice(0, 10).map((gift: any) => (
                  <div key={gift._id} className={`flex items-start gap-2.5 rounded-xl p-2.5 border transition-all ${
                    !gift.seen ? "bg-pink-50 border-pink-200" : "bg-gray-50 border-gray-100"
                  }`}>
                    <span className="text-xl shrink-0">{gift.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold truncate">{gift.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                          gift.type === "gift" ? "bg-pink-100 text-pink-700" :
                          gift.type === "badge" ? "bg-amber-100 text-amber-700" :
                          "bg-indigo-100 text-indigo-700"
                        }`}>{gift.type}</span>
                        {!gift.seen && <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />}
                      </div>
                      {gift.message && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{gift.message}</p>}
                      <div className="flex items-center gap-1 mt-0.5 text-[9px] text-gray-400">
                        <span>from <b className="text-gray-600">{gift.fromUserId?.displayName}</b></span>
                        {gift.familyId?.name && <span>· {gift.familyId.name}</span>}
                        <span>· {timeAgo(gift.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {gifts.length > 0 && (
              <button onClick={() => router.push("/family")} className="mt-2 w-full text-[10px] text-indigo-600 font-semibold hover:underline text-center">
                View all in Family →
              </button>
            )}
          </div>

          {/* Achievements */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2">🎖️ {t("dashboard.achievements")}</h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: "🌟", title: "First Step", earned: data.totalEntries >= 1 },
                { icon: "📝", title: "Week", earned: data.totalEntries >= 7 },
                { icon: "🔥", title: "On Fire", earned: data.currentStreak >= 14 },
                { icon: "🏆", title: "Champion", earned: data.totalEntries >= 28 },
                { icon: "💯", title: "Perfect", earned: (data.perfectDays || 0) >= 1 },
                { icon: "⭐", title: "Star", earned: (data.avgScore || 0) >= 80 },
                { icon: "💎", title: "Diamond", earned: (data.avgScore || 0) >= 95 },
                { icon: "🎯", title: "Streak 3", earned: data.currentStreak >= 3 },
              ].map((ach, i) => (
                <div key={i} className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                  ach.earned ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200 opacity-35"
                }`} title={ach.title}>
                  <span className="text-lg">{ach.icon}</span>
                  <span className="text-[7px] font-bold mt-0.5 leading-tight">{ach.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
