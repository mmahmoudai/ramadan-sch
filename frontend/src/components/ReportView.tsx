"use client";

import { useMemo } from "react";
import { formatHijriDate } from "@/lib/i18n";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReportViewProps {
  report: any;
  entries: any[];
  owner: any;
  isPublic?: boolean;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function ProgressRing({ percent, size = 120, stroke = 8 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, percent)) / 100) * circ;
  const color = percent >= 90 ? "#22c55e" : percent >= 75 ? "#3b82f6" : percent >= 50 ? "#eab308" : "#ef4444";
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
    </svg>
  );
}

function getGrade(score: number): { letter: string; label: string; color: string; bg: string } {
  if (score >= 95) return { letter: "S", label: "Exceptional", color: "text-amber-600", bg: "from-amber-50 to-yellow-50 border-amber-200" };
  if (score >= 90) return { letter: "A+", label: "Outstanding", color: "text-green-600", bg: "from-green-50 to-emerald-50 border-green-200" };
  if (score >= 80) return { letter: "A", label: "Excellent", color: "text-blue-600", bg: "from-blue-50 to-indigo-50 border-blue-200" };
  if (score >= 70) return { letter: "B+", label: "Very Good", color: "text-indigo-600", bg: "from-indigo-50 to-violet-50 border-indigo-200" };
  if (score >= 60) return { letter: "B", label: "Good", color: "text-purple-600", bg: "from-purple-50 to-fuchsia-50 border-purple-200" };
  if (score >= 50) return { letter: "C", label: "Fair", color: "text-orange-600", bg: "from-orange-50 to-amber-50 border-orange-200" };
  return { letter: "D", label: "Keep Going", color: "text-gray-600", bg: "from-gray-50 to-slate-50 border-gray-200" };
}

const SALAH_PREFIXES = new Set(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
function getFieldCategory(fieldKey: string): string {
  const prefix = fieldKey.split("_")[0] || "other";
  if (SALAH_PREFIXES.has(prefix)) return "salah";
  if (fieldKey === "daily_challenge") return "challenge";
  if (fieldKey === "quran_tracker") return "quran";
  if (fieldKey === "hadith_day") return "hadith";
  return prefix;
}

interface Achievement {
  icon: string;
  title: string;
  description: string;
  earned: boolean;
  color: string;
}

function computeAchievements(entries: any[], overallScore: number, perfectDays: number, streak: number): Achievement[] {
  const totalDays = entries.length;
  return [
    { icon: "🌟", title: "First Step", description: "Tracked at least 1 day", earned: totalDays >= 1, color: "bg-amber-100 border-amber-300" },
    { icon: "📝", title: "Consistent Tracker", description: "Tracked 7+ days", earned: totalDays >= 7, color: "bg-blue-100 border-blue-300" },
    { icon: "🔥", title: "On Fire", description: "Tracked 14+ days", earned: totalDays >= 14, color: "bg-orange-100 border-orange-300" },
    { icon: "🏆", title: "Ramadan Champion", description: "Tracked 28+ days", earned: totalDays >= 28, color: "bg-yellow-100 border-yellow-300" },
    { icon: "💯", title: "Perfectionist", description: "Achieved 100% on any day", earned: perfectDays >= 1, color: "bg-green-100 border-green-300" },
    { icon: "⭐", title: "Star Performer", description: "Overall score 80%+", earned: overallScore >= 80, color: "bg-indigo-100 border-indigo-300" },
    { icon: "💎", title: "Diamond Standard", description: "Overall score 95%+", earned: overallScore >= 95, color: "bg-violet-100 border-violet-300" },
    { icon: "🎯", title: "Streak Master", description: "3+ consecutive days tracked", earned: streak >= 3, color: "bg-rose-100 border-rose-300" },
    { icon: "📿", title: "Devoted", description: "Completed 50+ items", earned: entries.reduce((s, e) => s + (e.fields?.filter((f: any) => f.completed).length || 0), 0) >= 50, color: "bg-emerald-100 border-emerald-300" },
    { icon: "🕌", title: "Ramadan Spirit", description: "Scored 60%+ average", earned: overallScore >= 60, color: "bg-cyan-100 border-cyan-300" },
  ];
}

export default function ReportView({ report, entries, owner, isPublic = false }: ReportViewProps) {
  const { locale, t } = useLanguage();

  const stats = useMemo(() => {
    const totalFields = entries.reduce((sum, e) => sum + (e.fields?.length || 0), 0);
    const completedFields = entries.reduce((sum, e) => sum + (e.fields?.filter((f: any) => f.completed).length || 0), 0);
    const overallScore = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

    // Per-day scores
    const dayScores = entries.map((e) => {
      const total = e.fields?.length || 0;
      const done = e.fields?.filter((f: any) => f.completed).length || 0;
      return total > 0 ? Math.round((done / total) * 100) : 0;
    });
    const perfectDays = dayScores.filter((s) => s === 100).length;
    const bestDayScore = dayScores.length > 0 ? Math.max(...dayScores) : 0;
    const bestDayIdx = dayScores.indexOf(bestDayScore);
    const bestDayDate = bestDayIdx >= 0 ? entries[bestDayIdx]?.gregorianDate : "";
    const avgPerDay = entries.length > 0 ? Math.round(completedFields / entries.length) : 0;

    // Consistency: how many days scored above 50%
    const aboveHalf = dayScores.filter((s) => s >= 50).length;
    const consistency = entries.length > 0 ? Math.round((aboveHalf / entries.length) * 100) : 0;

    // Streak
    let streak = 0;
    let maxStreak = 0;
    const sortedEntries = [...entries].sort((a, b) => a.gregorianDate.localeCompare(b.gregorianDate));
    for (let i = 0; i < sortedEntries.length; i++) {
      if (i === 0) { streak = 1; }
      else {
        const prev = new Date(sortedEntries[i - 1].gregorianDate + "T00:00:00");
        const curr = new Date(sortedEntries[i].gregorianDate + "T00:00:00");
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        streak = diff === 1 ? streak + 1 : 1;
      }
      maxStreak = Math.max(maxStreak, streak);
    }

    // Category breakdown
    const categories: Record<string, { total: number; completed: number }> = {};
    entries.forEach((e) => {
      e.fields?.forEach((f: any) => {
        const cat = getFieldCategory(f.fieldKey);
        if (!categories[cat]) categories[cat] = { total: 0, completed: 0 };
        categories[cat].total++;
        if (f.completed) categories[cat].completed++;
      });
    });

    // Top completed fields
    const fieldCounts: Record<string, { total: number; completed: number }> = {};
    entries.forEach((e) => {
      e.fields?.forEach((f: any) => {
        if (f.fieldType !== "checkbox") return;
        if (!fieldCounts[f.fieldKey]) fieldCounts[f.fieldKey] = { total: 0, completed: 0 };
        fieldCounts[f.fieldKey].total++;
        if (f.completed) fieldCounts[f.fieldKey].completed++;
      });
    });
    const topFields = Object.entries(fieldCounts)
      .map(([key, val]) => ({ key, ...val, rate: val.total > 0 ? Math.round((val.completed / val.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 8);

    const grade = getGrade(overallScore);
    const achievements = computeAchievements(entries, overallScore, perfectDays, maxStreak);

    return {
      totalFields, completedFields, overallScore, perfectDays,
      bestDayScore, bestDayDate, avgPerDay, consistency, maxStreak,
      categories, topFields, grade, achievements, dayScores,
    };
  }, [entries]);

  const earnedAchievements = stats.achievements.filter((a) => a.earned);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Certificate Header */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-8 text-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-400" />
        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-amber-400 via-yellow-300 to-amber-400" />

        {/* Corner decorations */}
        <div className="absolute top-3 left-3 text-amber-300 text-lg">✦</div>
        <div className="absolute top-3 right-3 text-amber-300 text-lg">✦</div>
        <div className="absolute bottom-3 left-3 text-amber-300 text-lg">✦</div>
        <div className="absolute bottom-3 right-3 text-amber-300 text-lg">✦</div>

        <div className="text-4xl mb-2">🌙</div>
        <p className="font-ruqaa text-3xl text-amber-800 mb-1">{t("app.subtitle")}</p>
        <h1 className="text-xl font-extrabold text-gray-800 tracking-wide uppercase">{t("report.certificateTitle")}</h1>

        <div className="mt-4 text-sm text-gray-500">{t("report.certifiedThat")}</div>

        {owner && (
          <div className="mt-2 flex items-center justify-center gap-3">
            {owner.avatarUrl ? (
              <img src={owner.avatarUrl} alt="" className="w-12 h-12 rounded-full border-2 border-amber-300 shadow" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white text-lg font-bold border-2 border-amber-300 shadow">
                {(owner.displayName || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <p className="text-xl font-bold text-gray-900">{owner.displayName}</p>
              {owner.bio && <p className="text-xs text-gray-500 max-w-xs">{owner.bio}</p>}
            </div>
          </div>
        )}

        <p className="mt-3 text-sm text-gray-500">{t("report.completedRamadan")}</p>

        <div className="mt-3 inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full px-4 py-1.5 border border-amber-200 text-sm">
          <span className="font-semibold">{formatDate(report.periodStart)} → {formatDate(report.periodEnd)}</span>
          <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs font-bold uppercase">{report.periodScope}</span>
          {!isPublic && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{t("reports.private")}</span>
          )}
        </div>
      </div>

      {/* Grade + Ring */}
      <div className={`flex flex-col sm:flex-row items-center gap-6 rounded-2xl border p-6 bg-gradient-to-r ${stats.grade.bg}`}>
        <div className="relative">
          <ProgressRing percent={stats.overallScore} size={130} stroke={10} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${stats.grade.color}`}>{stats.grade.letter}</span>
            <span className="text-xs text-gray-500 font-medium">{stats.overallScore}%</span>
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="text-sm text-gray-500 font-medium">{t("report.overallGrade")}</div>
          <div className={`text-2xl font-extrabold ${stats.grade.color}`}>{stats.grade.label}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-white/80 rounded-xl p-2.5 text-center">
              <div className="text-xl font-extrabold">{entries.length}</div>
              <div className="text-[10px] text-gray-500">{t("report.daysTracked")}</div>
            </div>
            <div className="bg-white/80 rounded-xl p-2.5 text-center">
              <div className="text-xl font-extrabold">{stats.completedFields}</div>
              <div className="text-[10px] text-gray-500">{t("report.itemsDone")}</div>
            </div>
            <div className="bg-white/80 rounded-xl p-2.5 text-center">
              <div className="text-xl font-extrabold">{stats.perfectDays}</div>
              <div className="text-[10px] text-gray-500">{t("report.perfectDays")}</div>
            </div>
            <div className="bg-white/80 rounded-xl p-2.5 text-center">
              <div className="text-xl font-extrabold">{stats.maxStreak}</div>
              <div className="text-[10px] text-gray-500">🔥 Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl">🏆</div>
          <div className="text-lg font-extrabold mt-1">{stats.bestDayScore}%</div>
          <div className="text-[10px] text-gray-500">{t("report.bestDay")}</div>
          {stats.bestDayDate && <div className="text-[10px] text-gray-400 mt-0.5">{formatDate(stats.bestDayDate)}</div>}
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl">📊</div>
          <div className="text-lg font-extrabold mt-1">{stats.avgPerDay}</div>
          <div className="text-[10px] text-gray-500">{t("report.avgPerDay")}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{t("report.items")}/day</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl">📈</div>
          <div className="text-lg font-extrabold mt-1">{stats.consistency}%</div>
          <div className="text-[10px] text-gray-500">{t("report.consistencyScore")}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl">💯</div>
          <div className="text-lg font-extrabold mt-1">{stats.perfectDays}</div>
          <div className="text-[10px] text-gray-500">{t("report.perfectDays")}</div>
        </div>
      </div>

      {/* Achievements */}
      {earnedAchievements.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">🎖️ {t("report.achievements")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {stats.achievements.map((ach, i) => (
              <div key={i} className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all ${
                ach.earned ? ach.color : "bg-gray-50 border-gray-200 opacity-40"
              }`}>
                <span className="text-2xl">{ach.icon}</span>
                <span className="text-xs font-bold mt-1">{ach.title}</span>
                <span className="text-[9px] text-gray-500 mt-0.5">{ach.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {Object.keys(stats.categories).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">📂 {t("report.categoryBreakdown")}</h2>
          <div className="space-y-3">
            {Object.entries(stats.categories)
              .sort(([, a], [, b]) => (b.total > 0 ? b.completed / b.total : 0) - (a.total > 0 ? a.completed / a.total : 0))
              .map(([cat, val]) => {
                const pct = val.total > 0 ? Math.round((val.completed / val.total) * 100) : 0;
                const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, " ");
                const catIcons: Record<string, string> = {
                  sawm: "🌙", ibadah: "🕌", salah: "🙏", sunnah: "☪️", dua: "🤲",
                  akhlaq: "💜", sadaqah: "🤝", habit: "💪", mood: "😊",
                  gratitude: "🙏", quran: "📖", hadith: "📿", challenge: "🎯",
                };
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span>{catIcons[cat] || "📋"}</span> {catLabel}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{val.completed}/{val.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${pct}%`,
                        background: pct >= 75 ? "linear-gradient(90deg, #22c55e, #10b981)" :
                          pct >= 50 ? "linear-gradient(90deg, #eab308, #f59e0b)" :
                          "linear-gradient(90deg, #ef4444, #f97316)",
                      }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Top Fields */}
      {stats.topFields.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">⭐ {t("report.fieldHighlights")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stats.topFields.map((f) => (
              <div key={f.key} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                  f.rate >= 80 ? "bg-green-100 text-green-700" : f.rate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                }`}>{f.rate}%</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{f.key.replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-gray-400">{f.completed}/{f.total} days completed</div>
                </div>
                {f.rate === 100 && <span className="text-lg">🏅</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Progress Chart */}
      {entries.length > 1 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">📅 {t("report.dailyBreakdown")}</h2>
          <div className="flex items-end gap-1 h-32">
            {stats.dayScores.map((score, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full rounded-t-md transition-all duration-500 min-h-[4px]" style={{
                  height: `${Math.max(4, score)}%`,
                  background: score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : score > 0 ? "#ef4444" : "#e5e7eb",
                }} />
                <div className="absolute -top-6 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                  {entries[i]?.gregorianDate}: {score}%
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>{entries[0]?.gregorianDate}</span>
            <span>{entries[entries.length - 1]?.gregorianDate}</span>
          </div>
        </div>
      )}

      {/* Daily Entries List */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-lg mb-4">📋 {t("report.dailyBreakdown")}</h2>
        <div className="space-y-2">
          {entries.map((entry: any) => {
            const completed = entry.fields?.filter((f: any) => f.completed).length || 0;
            const total = entry.fields?.length || 0;
            const score = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <div key={entry.gregorianDate} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    score === 100 ? "bg-green-100 text-green-700" : score >= 75 ? "bg-blue-100 text-blue-700" : score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                  }`}>{score === 100 ? "💯" : `${score}%`}</span>
                  <div>
                    <span className="font-semibold text-sm">{formatDate(entry.gregorianDate)}</span>
                    {entry.hijriDay && (
                      <span className="text-[10px] text-gray-400 ml-2">
                        {formatHijriDate(entry.hijriDay, entry.hijriMonth, entry.hijriYear, locale)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${score}%`,
                      backgroundColor: score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444",
                    }} />
                  </div>
                  <span className="text-xs font-bold w-12 text-right text-gray-600">{completed}/{total}</span>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && <p className="text-gray-500 text-center py-4">{t("report.noEntriesPeriod")}</p>}
        </div>
      </div>

      {/* Day Details (Expandable) */}
      {entries.map((entry: any) => {
        const checkboxFields = entry.fields?.filter((f: any) => f.fieldType === "checkbox") || [];
        const textFields = entry.fields?.filter((f: any) => f.fieldType === "textarea" || f.fieldType === "text") || [];
        const completed = entry.fields?.filter((f: any) => f.completed).length || 0;
        const total = entry.fields?.length || 0;
        return (
          <details key={`detail-${entry.gregorianDate}`} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <summary className="px-5 py-3.5 cursor-pointer hover:bg-gray-50 font-bold flex items-center gap-2">
              <span className="text-sm">{formatDate(entry.gregorianDate)}</span>
              <span className="text-xs text-gray-400">—</span>
              <span className="text-xs font-medium text-gray-500">{completed}/{total} {t("report.items")}</span>
              {completed === total && total > 0 && <span className="ml-auto text-sm">🏅</span>}
            </summary>
            <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {checkboxFields.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {checkboxFields.map((f: any) => (
                    <div key={f.fieldKey} className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg ${f.completed ? "bg-green-50" : ""}`}>
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                        f.completed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
                      }`}>{f.completed ? "✓" : ""}</span>
                      <span className={f.completed ? "font-medium" : "text-gray-400"}>{f.fieldKey.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              )}
              {textFields.length > 0 && (
                <div className="space-y-2">
                  {textFields.map((f: any) => (
                    <div key={f.fieldKey} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{f.fieldKey.replace(/_/g, " ")}</p>
                      <p className="text-sm mt-1 text-gray-700">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        );
      })}

      {/* Footer */}
      <div className="text-center py-4 space-y-2">
        <div className="inline-flex items-center gap-2 text-sm text-gray-400">
          <span className="text-lg">🌙</span>
          {t("report.generatedBy")} <span className="font-bold text-gray-600">{t("app.title")}</span>
        </div>
        {earnedAchievements.length > 0 && (
          <div className="flex justify-center gap-1">
            {earnedAchievements.map((a, i) => (
              <span key={i} className="text-lg" title={a.title}>{a.icon}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
