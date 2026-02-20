"use client";

import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-line rounded-xl bg-card p-3 space-y-1">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

type TrendMetric = "entries" | "users" | "challenges" | "reports";
const METRIC_COLORS: Record<TrendMetric, string> = {
  entries: "bg-ink",
  users: "bg-emerald-500",
  challenges: "bg-amber-500",
  reports: "bg-blue-500",
};

interface Props {
  overview: AdminOverviewResponse;
  onSelectUser: (userId: string) => void;
}

export function OverviewSection({ overview, onSelectUser }: Props) {
  const { t } = useLanguage();

  const trendMax = useMemo(() => {
    if (!overview.trend.length) return 1;
    return Math.max(...overview.trend.flatMap((d) => [d.entries, d.users, d.challenges, d.reports]), 1);
  }, [overview.trend]);

  const metrics: TrendMetric[] = ["entries", "users", "challenges", "reports"];

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <StatCard label={t("admin.totalUsers")} value={overview.kpis.totalUsers} />
        <StatCard label={t("admin.admins")} value={overview.kpis.totalAdmins} />
        <StatCard label="New Users" value={overview.kpis.newUsers} sub="in range" />
        <StatCard label="Active Users" value={overview.kpis.activeUsers} sub="with entries" />
        <StatCard label={t("admin.dailyEntries")} value={overview.kpis.totalEntries} />
        <StatCard label={t("challenges.title")} value={overview.kpis.totalChallenges} />
        <StatCard label={t("reports.title")} value={overview.kpis.totalReports} />
        <StatCard label={t("admin.families")} value={overview.kpis.totalFamilies} />
        <StatCard label="Comments" value={overview.kpis.totalComments} />
        <StatCard label="Reactions" value={overview.kpis.totalReactions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Multi-metric Trend Chart */}
        <div className="border border-line rounded-xl p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Activity Trend</h3>
            <div className="flex gap-3 text-xs">
              {metrics.map((m) => (
                <span key={m} className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${METRIC_COLORS[m]}`} />
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {overview.trend.length === 0 && (
              <div className="text-sm text-gray-400 py-4 text-center">No trend data for this range.</div>
            )}
            {overview.trend.map((item) => (
              <div key={item.date} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-gray-500">{item.date}</span>
                <div className="flex-1 space-y-0.5">
                  {metrics.map((m) => {
                    const val = item[m];
                    const pct = Math.max(val > 0 ? 4 : 0, Math.round((val / trendMax) * 100));
                    return (
                      <div key={m} className="flex items-center gap-1">
                        <div className="flex-1 bg-gray-100 rounded h-1.5 overflow-hidden">
                          <div className={`${METRIC_COLORS[m]} h-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right text-gray-500">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Active Users */}
        <div className="border border-line rounded-xl p-4 space-y-3">
          <h3 className="font-bold">Top Active Users</h3>
          <div className="space-y-2">
            {overview.topActiveUsers.length === 0 && (
              <div className="text-sm text-gray-400">No activity yet.</div>
            )}
            {overview.topActiveUsers.map((user, i) => (
              <button
                key={user.userId}
                onClick={() => onSelectUser(user.userId)}
                className="w-full text-left border border-line rounded-xl px-3 py-2 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{user.displayName}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    <div className="text-xs text-gray-400">{user.entryCount} entries</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {overview.topActiveFamilies.length > 0 && (
            <>
              <h3 className="font-bold pt-2 border-t border-line">Top Families</h3>
              <div className="space-y-2">
                {overview.topActiveFamilies.map((fam, i) => (
                  <div key={fam.familyId} className="border border-line rounded-xl px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{fam.name}</div>
                        <div className="text-xs text-gray-500">{fam.memberCount} members · {fam.activityCount} activities</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
