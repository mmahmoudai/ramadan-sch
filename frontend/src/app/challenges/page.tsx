"use client";

import { useState, useEffect } from "react";
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
  const [editingChallenge, setEditingChallenge] = useState<string | null>(null);
  const [progressDate, setProgressDate] = useState(new Date().toISOString().split("T")[0]);
  const [progressValue, setProgressValue] = useState(100);
  const [progressNotes, setProgressNotes] = useState("");
  const [progressCompleted, setProgressCompleted] = useState(false);

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
      setProgressDate(new Date().toISOString().split("T")[0]);
      setProgressValue(100);
      setProgressNotes("");
      setProgressCompleted(false);
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

  const getPeriodIndex = (date: string, scope: string) => {
    const d = new Date(date);
    if (scope === "daily") return Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
    if (scope === "weekly") return Math.floor(d.getTime() / (1000 * 60 * 60 * 24 * 7));
    if (scope === "monthly") return d.getFullYear() * 12 + d.getMonth();
    return 0;
  };

  if (loading) return <div className="text-center py-20 text-lg">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{t("challenges.title")}</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-ink text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90">
          {showForm ? t("common.cancel") : t("challenges.createPlus")}
        </button>
      </div>

      {showForm && (
        <div className="border-2 border-line rounded-xl bg-card p-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3 text-sm">{error}</div>}
          <form onSubmit={createChallenge} className="space-y-3">
            <input type="text" placeholder={t("challenges.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2" />
            <textarea placeholder={t("challenges.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border-2 border-line rounded-lg px-3 py-2" />
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScope(s)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition ${scope === s ? "bg-ink text-white border-ink" : "border-line hover:bg-gray-100"}`}>
                  {t(`challenges.${s}`)}
                </button>
              ))}
            </div>
            <button type="submit" className="bg-accent text-white px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90">{t("challenges.createAction")}</button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {challenges.map((c) => (
          <div key={c._id} className="border-2 border-line rounded-xl bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{c.title}</h3>
                {c.description && <p className="text-sm text-gray-600 mt-1">{c.description}</p>}
                <div className="flex gap-2 mt-2">
                  <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold uppercase">{t(`challenges.${c.scope}`)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.active ? t("challenges.active") : t("challenges.inactive")}
                  </span>
                  <span className="text-xs text-gray-500">{c.progress?.length || 0} {t("challenges.progressEntries")}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(c._id, c.active)} className="text-xs px-3 py-1 rounded-lg border border-line hover:bg-gray-100 font-semibold">
                  {c.active ? t("challenges.deactivate") : t("challenges.activate")}
                </button>
                <button onClick={() => setEditingChallenge(editingChallenge === c._id ? null : c._id)} className="text-xs px-3 py-1 rounded-lg border border-line hover:bg-gray-100 font-semibold">
                  {editingChallenge === c._id ? t("common.cancel") : t("challenges.updateProgress")}
                </button>
                <button onClick={() => deleteChallenge(c._id)} className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold">
                  {t("common.delete")}
                </button>
              </div>
            </div>

            {/* Progress Update Form */}
            {editingChallenge === c._id && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t("challenges.date")}</label>
                    <input
                      type="date"
                      value={progressDate}
                      onChange={(e) => setProgressDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full border border-line rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t("challenges.progress")}</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={progressValue}
                      onChange={(e) => setProgressValue(Number(e.target.value))}
                      className="w-full border border-line rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold mb-1">{t("challenges.notesOptional")}</label>
                  <textarea
                    value={progressNotes}
                    onChange={(e) => setProgressNotes(e.target.value)}
                    placeholder={t("challenges.addNotesPlaceholder")}
                    rows={2}
                    className="w-full border border-line rounded px-2 py-1 text-sm resize-vertical"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={progressCompleted}
                      onChange={(e) => setProgressCompleted(e.target.checked)}
                      className="w-4 h-4 accent-accent"
                    />
                    {t("challenges.completed")}
                  </label>
                  <button
                    onClick={() => updateProgress(c._id)}
                    className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90"
                  >
                    {t("challenges.saveProgress")}
                  </button>
                </div>
              </div>
            )}

            {/* Progress History */}
            {c.progress && c.progress.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-2">{t("challenges.progressHistory")}</h4>
                <div className="space-y-2">
                  {c.progress
                    .sort((a, b) => new Date(b.dateGregorian).getTime() - new Date(a.dateGregorian).getTime())
                    .map((p) => (
                      <div key={p.dateGregorian} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{p.dateGregorian}</span>
                            <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${p.progressValue}%`,
                                  backgroundColor: p.completed ? "#22c55e" : "#3b82f6",
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{p.progressValue}%</span>
                            {p.completed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">{t("challenges.done")}</span>}
                          </div>
                          {new Date(p.dateGregorian) < new Date(new Date().toISOString().split("T")[0]) && (
                            <button
                              onClick={() => deleteProgress(c._id, p.dateGregorian)}
                              className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                            >
                              {t("common.delete")}
                            </button>
                          )}
                        </div>
                        {p.notes && (
                          <p className="text-xs text-gray-600 mt-1 italic">{p.notes}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {challenges.length === 0 && <p className="text-gray-500 text-center py-8">{t("challenges.noChallengesYet")}</p>}
      </div>
    </div>
  );
}
