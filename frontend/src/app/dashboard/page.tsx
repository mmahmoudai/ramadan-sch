"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const token = getToken()!;
      const result = await apiFetch("/dashboard/summary", { token });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-lg">{t("common.loading")}</div>;
  if (!data) return <div className="text-center py-20 text-red-600">{t("dashboard.failedLoad")}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">{t("dashboard.title")}</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
          <p className="text-3xl font-extrabold text-accent">{data.currentStreak}</p>
          <p className="text-sm font-semibold text-gray-600">{t("dashboard.dayStreak")}</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
          <p className="text-3xl font-extrabold text-accent">{data.totalEntries}</p>
          <p className="text-sm font-semibold text-gray-600">{t("dashboard.totalEntries")}</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
          <p className="text-3xl font-extrabold text-accent">
            {data.today.hasEntry ? `${data.today.completedFields}/${data.today.totalFields}` : "—"}
          </p>
          <p className="text-sm font-semibold text-gray-600">{t("dashboard.todayScore")}</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
          <p className="text-3xl font-extrabold text-accent">{data.challengeSummary?.length || 0}</p>
          <p className="text-sm font-semibold text-gray-600">{t("dashboard.activeChallenges")}</p>
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="border-2 border-line rounded-xl bg-card p-4">
        <h2 className="font-bold text-lg mb-3">{t("dashboard.weeklyTrendLast4")}</h2>
        <div className="grid grid-cols-4 gap-3">
          {data.weeklyStats?.map((w: any) => (
            <div key={w.week} className="text-center">
              <div className="mx-auto w-16 bg-gray-200 rounded-full overflow-hidden h-32 relative flex flex-col justify-end">
                <div className="bg-accent rounded-t-lg transition-all" style={{ height: `${w.avgScore}%` }} />
              </div>
              <p className="font-bold mt-1">W{w.week}</p>
              <p className="text-xs text-gray-500">{w.avgScore}% {t("dashboard.avg")}</p>
              <p className="text-xs text-gray-400">{w.entryCount} {t("dashboard.days")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Completion Scores */}
      <div className="border-2 border-line rounded-xl bg-card p-4">
        <h2 className="font-bold text-lg mb-3">{t("dashboard.recentDays")}</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {data.completionScores?.map((s: any) => (
            <div key={s.date} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
              <span className="font-semibold text-sm">{s.date}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${s.score}%` }} />
                </div>
                <span className="text-sm font-bold w-12 text-right">{s.score}%</span>
              </div>
            </div>
          ))}
          {(!data.completionScores || data.completionScores.length === 0) && (
            <p className="text-gray-500 text-sm text-center py-4">{t("dashboard.noEntriesYet")}</p>
          )}
        </div>
      </div>

      {/* Challenge Summary */}
      {data.challengeSummary?.length > 0 && (
        <div className="border-2 border-line rounded-xl bg-card p-4">
          <h2 className="font-bold text-lg mb-3">{t("dashboard.activeChallenges")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.challengeSummary.map((c: any) => (
              <div key={c.id} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                <p className="font-bold">{c.title}</p>
                <p className="text-xs text-gray-500 uppercase">{c.scope}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-accent h-full rounded-full" style={{ width: `${c.totalProgress > 0 ? (c.completedCount / c.totalProgress) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-bold">{c.completedCount}/{c.totalProgress}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
