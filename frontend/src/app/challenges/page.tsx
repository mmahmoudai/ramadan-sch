"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

type Challenge = {
  _id: string;
  title: string;
  description?: string;
  scope: "daily" | "weekly" | "monthly";
  active: boolean;
  progress: Array<{
    periodIndex: number;
    dateGregorian: string;
    progressValue: number;
    notes: string;
    completed: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

function localDateStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function fmtDate(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  catch { return d; }
}

function ProgressRing({ percent, size = 48, stroke = 5, color }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  const offset = circ - (p / 100) * circ;
  const c = color || (p >= 80 ? "#22c55e" : p >= 50 ? "#eab308" : p >= 25 ? "#3b82f6" : "#94a3b8");
  return (
    <svg width={size} height={size} className="transform -rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
}

const SCOPE_CONFIG: Record<string, { icon: string; gradient: string; badge: string }> = {
  daily: { icon: "📅", gradient: "from-blue-500 to-indigo-600", badge: "bg-blue-100 text-blue-700" },
  weekly: { icon: "📆", gradient: "from-purple-500 to-fuchsia-600", badge: "bg-purple-100 text-purple-700" },
  monthly: { icon: "🗓️", gradient: "from-amber-500 to-orange-600", badge: "bg-amber-100 text-amber-700" },
};

export default function ChallengesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"daily" | "weekly" | "monthly">("daily");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [editingChallenge, setEditingChallenge] = useState<string | null>(null);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [progressDate, setProgressDate] = useState(localDateStr);
  const [progressValue, setProgressValue] = useState(100);
  const [progressNotes, setProgressNotes] = useState("");
  const [progressCompleted, setProgressCompleted] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/challenges", { token });
      setChallenges(data.challenges || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const active = challenges.filter((c) => c.active);
    const totalProgress = challenges.reduce((s, c) => s + c.progress.length, 0);
    const totalCompleted = challenges.reduce((s, c) => s + c.progress.filter((p) => p.completed).length, 0);
    const rate = totalProgress > 0 ? Math.round((totalCompleted / totalProgress) * 100) : 0;

    // Streak: consecutive days with at least 1 completed progress entry
    const allCompletedDates = new Set(
      challenges.flatMap((c) => c.progress.filter((p) => p.completed).map((p) => p.dateGregorian))
    );
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 366; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!allCompletedDates.has(ds)) break;
      streak++;
    }

    return { active: active.length, inactive: challenges.length - active.length, totalProgress, totalCompleted, rate, streak };
  }, [challenges]);

  const filteredChallenges = useMemo(() =>
    challenges.filter((c) => tab === "active" ? c.active : !c.active),
    [challenges, tab]
  );

  const createChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const token = getToken()!;
      await apiFetch("/challenges", {
        method: "POST",
        token,
        body: JSON.stringify({ title, description, scope }),
      });
      setTitle("");
      setDescription("");
      setShowForm(false);
      loadChallenges();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const token = getToken()!;
      await apiFetch(`/challenges/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !active }),
      });
      loadChallenges();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteChallenge = async (id: string) => {
    if (!confirm(t("challenges.deleteConfirm"))) return;
    try {
      const token = getToken()!;
      await apiFetch(`/challenges/${id}`, { method: "DELETE", token });
      loadChallenges();
    } catch (err) {
      console.error(err);
    }
  };

  const updateProgress = async (challengeId: string) => {
    try {
      const token = getToken()!;
      await apiFetch(`/challenges/${challengeId}/progress`, {
        method: "POST",
        token,
        body: JSON.stringify({
          dateGregorian: progressDate,
          progressValue,
          notes: progressNotes,
          completed: progressCompleted,
        }),
      });
      setEditingChallenge(null);
      setProgressDate(localDateStr());
      setProgressValue(100);
      setProgressNotes("");
      setProgressCompleted(true);
      loadChallenges();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteProgress = async (challengeId: string, dateGregorian: string) => {
    if (!confirm(t("challenges.deleteProgressConfirm"))) return;
    try {
      const token = getToken()!;
      await apiFetch(`/challenges/${challengeId}/progress/${dateGregorian}`, {
        method: "DELETE",
        token,
      });
      loadChallenges();
    } catch (err) {
      console.error(err);
    }
  };

  const openProgressForm = (challengeId: string) => {
    if (editingChallenge === challengeId) {
      setEditingChallenge(null);
    } else {
      setEditingChallenge(challengeId);
      setProgressDate(localDateStr());
      setProgressValue(100);
      setProgressNotes("");
      setProgressCompleted(true);
    }
  };

  // Loading skeleton
  if (loading) return (
    <div className="space-y-5 animate-pulse">
      <div className="h-32 rounded-2xl bg-gradient-to-br from-indigo-200 via-purple-200 to-amber-200" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
      </div>
      <div className="h-10 rounded-xl bg-gray-100 w-48" />
      {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-gray-100" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-amber-500 p-6 text-white">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">🎯 {t("challenges.title")}</h1>
            <p className="text-white/70 text-sm mt-1">{t("challenges.subtitle")}</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-white/20 backdrop-blur hover:bg-white/30 text-white px-4 py-2 rounded-xl font-bold text-sm transition">
            {showForm ? "✕ " + t("common.cancel") : t("challenges.createPlus")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold text-indigo-600">{stats.active}</div>
          <div className="text-[10px] text-gray-500 font-medium mt-0.5">{t("challenges.activeChallenges")}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold text-green-600">{stats.totalCompleted}</div>
          <div className="text-[10px] text-gray-500 font-medium mt-0.5">{t("challenges.completedEntries")}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold text-amber-600">{stats.rate}%</div>
          <div className="text-[10px] text-gray-500 font-medium mt-0.5">{t("challenges.completionRate")}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-extrabold text-orange-600">{stats.streak}</div>
          <div className="text-[10px] text-gray-500 font-medium mt-0.5">🔥 {t("challenges.streak")}</div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      {/* Create Form */}
      {showForm && (
        <div className="border-2 border-indigo-200 rounded-2xl bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">✨ {t("challenges.createNew")}</h2>
          <form onSubmit={createChallenge} className="space-y-3">
            <input type="text" placeholder={t("challenges.titlePlaceholder")} value={title}
              onChange={(e) => setTitle(e.target.value)} required
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition" />
            <textarea placeholder={t("challenges.descriptionPlaceholder")} value={description}
              onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition resize-vertical" />
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map((s) => {
                const cfg = SCOPE_CONFIG[s];
                return (
                  <button key={s} type="button" onClick={() => setScope(s)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      scope === s ? `bg-gradient-to-r ${cfg.gradient} text-white border-transparent shadow-md` : "border-gray-200 hover:bg-gray-50"
                    }`}>
                    <span>{cfg.icon}</span> {t(`challenges.${s}`)}
                  </button>
                );
              })}
            </div>
            <button type="submit" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition shadow-md">
              {t("challenges.createAction")}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab("active")}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${tab === "active" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}>
          {t("challenges.active")} ({stats.active})
        </button>
        <button onClick={() => setTab("inactive")}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${tab === "inactive" ? "bg-white shadow-sm text-gray-700" : "text-gray-500 hover:text-gray-700"}`}>
          {t("challenges.inactive")} ({stats.inactive})
        </button>
      </div>

      {/* Challenge Cards */}
      <div className="space-y-4">
        {filteredChallenges.map((c) => {
          const completed = c.progress.filter((p) => p.completed).length;
          const total = c.progress.length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const cfg = SCOPE_CONFIG[c.scope];
          const isExpanded = expandedChallenge === c._id;
          const isEditing = editingChallenge === c._id;
          const sorted = [...c.progress].sort((a, b) => b.dateGregorian.localeCompare(a.dateGregorian));
          const recent = sorted.slice(0, 5);
          const hasMore = sorted.length > 5;

          return (
            <div key={c._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Progress Ring */}
                  <div className="relative shrink-0">
                    <ProgressRing percent={pct} size={56} stroke={5} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold">{pct}%</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg truncate">{c.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>
                        {cfg.icon} {t(`challenges.${c.scope}`)}
                      </span>
                      {!c.active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">{t("challenges.inactive")}</span>
                      )}
                    </div>
                    {c.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="font-medium">{completed}/{total} {t("challenges.completedEntries")}</span>
                      <span>·</span>
                      <span>{fmtDate(c.createdAt?.split("T")[0] || "")}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.active && (
                      <button onClick={() => openProgressForm(c._id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                          isEditing ? "bg-gray-200 text-gray-700" : "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-sm hover:opacity-90"
                        }`}>
                        {isEditing ? "✕" : "+"} {isEditing ? t("common.cancel") : t("challenges.logProgress")}
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c._id ? null : c._id); }}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
                      </button>
                      {openMenuId === c._id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-xl p-1 w-44 z-20">
                            <button
                              onClick={() => { toggleActive(c._id, c.active); setOpenMenuId(null); }}
                              className="w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-gray-50 rounded-lg transition">
                              {c.active ? "⏸ " + t("challenges.deactivate") : "▶ " + t("challenges.activate")}
                            </button>
                            <button
                              onClick={() => { deleteChallenge(c._id); setOpenMenuId(null); }}
                              className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
                              🗑 {t("common.delete")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mini progress bar */}
                {total > 0 && (
                  <div className="mt-3 flex items-center gap-1.5">
                    {sorted.slice(0, 14).reverse().map((p) => (
                      <div key={p.dateGregorian} title={`${fmtDate(p.dateGregorian)}: ${p.progressValue}%${p.completed ? " ✓" : ""}`}
                        className={`h-2 flex-1 rounded-full transition-all ${
                          p.completed ? "bg-green-400" : p.progressValue >= 50 ? "bg-yellow-400" : "bg-gray-200"
                        }`} />
                    ))}
                    {total < 14 && [...Array(Math.max(0, 14 - total))].map((_, i) => (
                      <div key={`empty-${i}`} className="h-2 flex-1 rounded-full bg-gray-100" />
                    ))}
                  </div>
                )}
              </div>

              {/* Progress Update Form */}
              {isEditing && (
                <div className="border-t border-gray-100 bg-gradient-to-br from-green-50 to-emerald-50 p-5">
                  <h4 className="font-bold text-sm mb-3 flex items-center gap-2">📝 {t("challenges.logProgress")}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">{t("challenges.date")}</label>
                      <input type="date" value={progressDate} onChange={(e) => setProgressDate(e.target.value)}
                        max={localDateStr()} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-green-400 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">{t("challenges.progress")}</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min="0" max="100" value={progressValue}
                          onChange={(e) => setProgressValue(Number(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500" />
                        <span className="text-sm font-bold w-10 text-right">{progressValue}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">{t("challenges.notesOptional")}</label>
                      <input type="text" value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)}
                        placeholder={t("challenges.addNotesPlaceholder")}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-green-400 outline-none transition" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input type="checkbox" checked={progressCompleted}
                        onChange={(e) => setProgressCompleted(e.target.checked)}
                        className="w-5 h-5 accent-green-500 rounded" />
                      <span className="font-semibold">{t("challenges.completed")}</span>
                    </label>
                    <button onClick={() => updateProgress(c._id)}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-sm">
                      ✓ {t("challenges.saveProgress")}
                    </button>
                  </div>
                </div>
              )}

              {/* Progress History */}
              {total > 0 && (
                <div className="border-t border-gray-100">
                  <button onClick={() => setExpandedChallenge(isExpanded ? null : c._id)}
                    className="w-full px-5 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition flex items-center justify-between">
                    <span>{t("challenges.progressHistory")} ({total})</span>
                    <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-2">
                      {(hasMore && !isExpanded ? recent : sorted).map((p) => (
                        <div key={p.dateGregorian} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            p.completed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>{p.completed ? "✓" : `${p.progressValue}%`}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{fmtDate(p.dateGregorian)}</span>
                              {p.completed && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">{t("challenges.done")}</span>}
                            </div>
                            {p.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.notes}</p>}
                          </div>
                          <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden shrink-0">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${p.progressValue}%`,
                              background: p.completed ? "#22c55e" : "#6366f1",
                            }} />
                          </div>
                          {new Date(p.dateGregorian) < new Date(localDateStr()) && (
                            <button onClick={() => deleteProgress(c._id, p.dateGregorian)}
                              className="text-[10px] text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition shrink-0">
                              {t("common.delete")}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {filteredChallenges.length === 0 && (
          <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <div className="text-5xl mb-3">{tab === "active" ? "🎯" : "📦"}</div>
            <h3 className="font-bold text-lg text-gray-800">
              {tab === "active" ? t("challenges.noActiveChallenges") : t("challenges.noInactiveChallenges")}
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
              {tab === "active" ? t("challenges.createFirstChallenge") : t("challenges.archiveHint")}
            </p>
            {tab === "active" && (
              <button onClick={() => setShowForm(true)}
                className="mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition shadow-md">
                + {t("challenges.createPlus")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
