"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn, getUser } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

type FeedFilter = "all" | "entries" | "challenges" | "reports" | "social";
type FamilyTab = "overview" | "members" | "gifts" | "feed";
type GiftType = "gift" | "badge" | "certificate";

interface FeedEvent {
  id: string;
  type: "entries" | "challenges" | "reports" | "social";
  subtype: string;
  occurredAt: string;
  actor: { id: string; displayName: string; avatarUrl: string | null };
  data: Record<string, any>;
}

interface MemberStat {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string | null;
  stats: {
    totalEntries: number;
    completedFields: number;
    totalFields: number;
    completionRate: number;
    streak: number;
    activeChallenges: number;
    totalChallenges: number;
    completedProgressEntries: number;
    totalProgress: number;
    giftsReceived: number;
    points: number;
  };
}

interface FamilyStatsData {
  totalMembers: number;
  totalEntries: number;
  avgCompletionRate: number;
  totalChallenges: number;
  totalPoints: number;
  longestStreak: number;
}

interface GiftItem {
  _id: string;
  type: GiftType;
  icon: string;
  title: string;
  message: string;
  createdAt: string;
  fromUserId: { _id: string; displayName: string; avatarUrl: string | null };
  toUserId: { _id: string; displayName: string; avatarUrl: string | null };
}

const FEED_FILTERS: FeedFilter[] = ["all", "entries", "challenges", "reports", "social"];

const GIFT_ICONS: Record<GiftType, string[]> = {
  gift: ["🎁", "🌹", "🌙", "⭐", "💎", "🏆", "🎯", "📿", "🕌", "🤲"],
  badge: ["🥇", "🥈", "🥉", "🏅", "🎖️", "💫", "✨", "🌟", "🔥", "💪"],
  certificate: ["📜", "🎓", "🏆", "👑", "🌠", "📋", "🎗️", "🏵️", "💐", "🎊"],
};

const GIFT_PRESETS: Record<GiftType, string[]> = {
  gift: ["Ramadan Mubarak!", "Keep Going!", "Proud of You!", "Mashallah!", "Jazakallah!"],
  badge: ["Consistency Star", "Challenge Champion", "Prayer Warrior", "Quran Hero", "Top Tracker"],
  certificate: ["Best Streak Award", "Most Improved", "Family MVP", "Dedication Award", "Ramadan Excellence"],
};

function ProgressRing({ percent, size = 56, stroke = 5, color = "#6366f1" }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, percent)) / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
}

function Avatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-14 h-14 text-xl" : size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  if (url) return <img src={url} alt={name} className={`${sizeClass} rounded-full object-cover border-2 border-white shadow`} />;
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-violet-500"];
  const colorIdx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div className={`${sizeClass} ${colors[colorIdx]} rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow`}>
      {initials}
    </div>
  );
}

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-2xl font-extrabold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500 font-medium">{label}</div>
          {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">#{rank}</span>;
}

export default function FamilyPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<FamilyTab>("overview");

  // Stats
  const [familyStats, setFamilyStats] = useState<FamilyStatsData | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Gifts
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftType, setGiftType] = useState<GiftType>("gift");
  const [giftToUserId, setGiftToUserId] = useState("");
  const [giftIcon, setGiftIcon] = useState("");
  const [giftTitle, setGiftTitle] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftSending, setGiftSending] = useState(false);

  // Feed
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  const userId = getUser()?.id;

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/families", { token });
      setGroups(data.groups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-select first group
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0]._id);
    }
  }, [groups, selectedGroupId]);

  // Load stats when group/tab changes
  const loadStats = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      setStatsLoading(true);
      const token = getToken()!;
      const data: any = await apiFetch(`/families/${selectedGroupId}/stats`, { token });
      setFamilyStats(data.familyStats);
      setMemberStats(data.memberStats || []);
    } catch (err: any) {
      console.error("Stats error:", err.message);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId) {
      loadStats();
    }
  }, [selectedGroupId, loadStats]);

  // Load gifts
  const loadGifts = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      setGiftsLoading(true);
      const token = getToken()!;
      const data: any = await apiFetch(`/families/${selectedGroupId}/gifts`, { token });
      setGifts(data.gifts || []);
    } catch (err: any) {
      console.error("Gifts error:", err.message);
    } finally {
      setGiftsLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId && activeTab === "gifts") {
      loadGifts();
    }
  }, [selectedGroupId, activeTab, loadGifts]);

  // Load feed
  const loadFeed = useCallback(async (reset: boolean) => {
    if (!selectedGroupId) return;
    try {
      setFeedLoading(true);
      const token = getToken()!;
      const params = new URLSearchParams({ filter: feedFilter, limit: "10" });
      if (!reset && feedCursor) params.set("cursor", feedCursor);
      const data: any = await apiFetch(`/families/${selectedGroupId}/feed?${params.toString()}`, { token });
      const events: FeedEvent[] = data.events || [];
      setFeedEvents((prev) => (reset ? events : [...prev, ...events]));
      setFeedCursor(data.nextCursor || null);
      setFeedHasMore(Boolean(data.hasMore));
    } catch (err: any) {
      console.error("Feed error:", err.message);
      if (reset) { setFeedEvents([]); setFeedCursor(null); setFeedHasMore(false); }
    } finally {
      setFeedLoading(false);
    }
  }, [selectedGroupId, feedFilter, feedCursor]);

  useEffect(() => {
    if (selectedGroupId && activeTab === "feed") {
      loadFeed(true);
    }
  }, [selectedGroupId, activeTab, feedFilter]);

  // Actions
  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const token = getToken()!;
      await apiFetch("/families", { method: "POST", token, body: JSON.stringify({ name: groupName }) });
      setGroupName("");
      setShowForm(false);
      loadGroups();
    } catch (err: any) { setError(err.message); }
  };

  const inviteMember = async (e: React.FormEvent, groupId: string) => {
    e.preventDefault();
    setError(""); setMessage("");
    try {
      const token = getToken()!;
      await apiFetch(`/families/${groupId}/invite`, { method: "POST", token, body: JSON.stringify({ email: inviteEmail }) });
      setInviteEmail("");
      setInviteGroupId("");
      setMessage(t("family.invitationSent"));
      loadGroups();
    } catch (err: any) { setError(err.message); }
  };

  const acceptInvite = async (groupId: string) => {
    try {
      const token = getToken()!;
      await apiFetch(`/families/${groupId}/accept`, { method: "POST", token });
      loadGroups();
    } catch (err: any) { setError(err.message); }
  };

  const leaveGroup = async (groupId: string) => {
    if (!confirm(t("family.leaveConfirm"))) return;
    try {
      const token = getToken()!;
      await apiFetch(`/families/${groupId}/leave`, { method: "POST", token });
      loadGroups();
    } catch (err: any) { setError(err.message); }
  };

  const sendGift = async () => {
    if (!selectedGroupId || !giftToUserId || !giftIcon || !giftTitle) return;
    try {
      setGiftSending(true);
      const token = getToken()!;
      await apiFetch(`/families/${selectedGroupId}/gifts`, {
        method: "POST",
        token,
        body: JSON.stringify({ toUserId: giftToUserId, type: giftType, icon: giftIcon, title: giftTitle, message: giftMessage }),
      });
      setMessage(t("family.giftSent"));
      setShowGiftModal(false);
      setGiftToUserId(""); setGiftIcon(""); setGiftTitle(""); setGiftMessage("");
      loadGifts();
      loadStats();
    } catch (err: any) { setError(err.message); }
    finally { setGiftSending(false); }
  };

  const formatEventTime = (iso: string) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    const now = new Date();
    const diff = now.getTime() - dt.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return dt.toLocaleDateString();
  };

  const renderEventMessage = (event: FeedEvent) => {
    if (event.type === "entries") return `${t("family.feedEventEntry")} ${event.data.gregorianDate || ""}`;
    if (event.type === "challenges") return `${t("family.feedEventChallenge")} ${event.data.title || ""}`;
    if (event.type === "reports") return `${t("family.feedEventReport")} ${event.data.periodStart || ""} → ${event.data.periodEnd || ""}`;
    if (event.subtype === "comment_created") return `${t("family.feedEventComment")} ${String(event.data.body || "").slice(0, 100)}`;
    if (event.subtype === "reaction_created") return `${t("family.feedEventReaction")}${event.data.reactionType ? ` (${event.data.reactionType})` : ""}`;
    return t("family.feedEventActivity");
  };

  const selectedGroup = groups.find((g) => g._id === selectedGroupId);
  const sortedMembers = [...memberStats].sort((a, b) => b.stats.points - a.stats.points);
  const otherMembers = memberStats.filter((m) => m.userId !== userId);

  if (loading) return <div className="text-center py-20 text-lg">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{t("family.title")}</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-ink text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm">
          {showForm ? t("common.cancel") : t("family.createPlus")}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
      {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">{message}</div>}

      {showForm && (
        <form onSubmit={createGroup} className="border-2 border-line rounded-xl bg-card p-4 flex gap-3">
          <input type="text" placeholder={t("family.groupNamePlaceholder")} value={groupName} onChange={(e) => setGroupName(e.target.value)} required className="flex-1 border-2 border-line rounded-xl px-4 py-2.5" />
          <button type="submit" className="bg-accent text-white px-6 py-2.5 rounded-xl font-bold text-sm">{t("challenges.createAction")}</button>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
          <p className="text-gray-500 text-lg">{t("family.noGroups")}</p>
          <p className="text-gray-400 text-sm mt-2">Create a family group to start tracking together!</p>
        </div>
      ) : (
        <>
          {/* Group Selector Cards */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {groups.map((g) => {
              const isOwner = g.ownerUserId === userId || g.ownerUserId?._id === userId;
              const myMember = g.members?.find((m: any) => (m.userId?._id || m.userId) === userId);
              const isPending = myMember?.status === "invited";
              const isSelected = g._id === selectedGroupId;
              const activeCount = g.members?.filter((m: any) => m.status === "active").length || 0;

              return (
                <div
                  key={g._id}
                  onClick={() => { setSelectedGroupId(g._id); setActiveTab("overview"); }}
                  className={`min-w-[220px] cursor-pointer border-2 rounded-2xl p-4 transition-all ${
                    isSelected ? "border-ink bg-ink/5 shadow-md" : "border-line bg-card hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base truncate">{g.name}</h3>
                    {isOwner && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">👑</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{activeCount} {t("family.members")}</span>
                    {isPending && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>}
                  </div>
                  {isPending && (
                    <button onClick={(e) => { e.stopPropagation(); acceptInvite(g._id); }} className="mt-2 w-full bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition">
                      {t("family.acceptInvite")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tab Navigation */}
          {selectedGroup && (
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {(["overview", "members", "gifts", "feed"] as FamilyTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === tab ? "bg-white text-ink shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "overview" && "📊 "}
                  {tab === "members" && "👥 "}
                  {tab === "gifts" && "🎁 "}
                  {tab === "feed" && "📰 "}
                  {tab === "overview" ? t("family.stats") : tab === "members" ? t("family.memberStats") : tab === "gifts" ? t("family.recentGifts") : t("family.activityFeed")}
                </button>
              ))}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === "overview" && selectedGroup && (
            <div className="space-y-6">
              {/* Family Stats Cards */}
              {statsLoading ? (
                <div className="text-center py-8 text-gray-400">{t("common.loading")}</div>
              ) : familyStats ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard icon="👥" label={t("family.members")} value={familyStats.totalMembers} />
                    <StatCard icon="📝" label={t("family.totalEntries")} value={familyStats.totalEntries} />
                    <StatCard icon="📊" label={t("family.avgCompletion")} value={`${familyStats.avgCompletionRate}%`} />
                    <StatCard icon="🎯" label={t("family.totalChallenges")} value={familyStats.totalChallenges} />
                    <StatCard icon="⭐" label={t("family.totalPoints")} value={familyStats.totalPoints} />
                    <StatCard icon="🔥" label={t("family.longestStreak")} value={familyStats.longestStreak} sub={t("family.daysActive")} />
                  </div>

                  {/* Leaderboard */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">🏆 {t("family.leaderboard")}</h3>
                    <div className="space-y-3">
                      {sortedMembers.map((member, idx) => (
                        <div key={member.userId} className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                          idx === 0 ? "bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200" :
                          idx === 1 ? "bg-gray-50 border border-gray-200" :
                          idx === 2 ? "bg-orange-50/50 border border-orange-100" : "hover:bg-gray-50"
                        }`}>
                          <RankBadge rank={idx + 1} />
                          <Avatar name={member.displayName} url={member.avatarUrl} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{member.displayName}</div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                              <span>🔥 {member.stats.streak}d</span>
                              <span>📝 {member.stats.totalEntries}</span>
                              <span>🎯 {member.stats.completedProgressEntries}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-extrabold text-indigo-600">{member.stats.points}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{t("family.points")}</div>
                          </div>
                          <div className="relative">
                            <ProgressRing percent={member.stats.completionRate} size={48} stroke={4} color={idx === 0 ? "#f59e0b" : "#6366f1"} />
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{member.stats.completionRate}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invite & Leave Actions */}
                  <div className="flex flex-wrap gap-3">
                    {(selectedGroup.ownerUserId === userId || selectedGroup.ownerUserId?._id === userId) && (
                      <form onSubmit={(e) => inviteMember(e, selectedGroupId)} className="flex-1 flex gap-2 min-w-[280px]">
                        <input type="email" placeholder={t("family.inviteByEmail")} value={inviteGroupId === selectedGroupId ? inviteEmail : ""} onChange={(e) => { setInviteEmail(e.target.value); setInviteGroupId(selectedGroupId); }} className="flex-1 border-2 border-line rounded-xl px-4 py-2.5 text-sm" />
                        <button type="submit" onClick={() => setInviteGroupId(selectedGroupId)} className="bg-ink text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90">{t("family.invite")}</button>
                      </form>
                    )}
                    {selectedGroup.ownerUserId !== userId && selectedGroup.ownerUserId?._id !== userId && (
                      <button onClick={() => leaveGroup(selectedGroupId)} className="px-4 py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">{t("family.leave")}</button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && selectedGroup && (
            <div className="space-y-4">
              {statsLoading ? (
                <div className="text-center py-8 text-gray-400">{t("common.loading")}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedMembers.map((member, idx) => (
                    <div key={member.userId} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <Avatar name={member.displayName} url={member.avatarUrl} size="lg" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-xs">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base truncate">{member.displayName}</span>
                            {member.role === "owner" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">👑 {t("family.owner")}</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{member.email}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-lg font-extrabold text-indigo-600">{member.stats.points}</span>
                            <span className="text-xs text-gray-400">{t("family.points")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="text-center bg-gray-50 rounded-xl p-2.5">
                          <div className="text-lg font-bold">{member.stats.streak}</div>
                          <div className="text-[10px] text-gray-500">🔥 {t("family.streak")}</div>
                        </div>
                        <div className="text-center bg-gray-50 rounded-xl p-2.5">
                          <div className="text-lg font-bold">{member.stats.totalEntries}</div>
                          <div className="text-[10px] text-gray-500">📝 {t("family.entries")}</div>
                        </div>
                        <div className="text-center bg-gray-50 rounded-xl p-2.5">
                          <div className="text-lg font-bold">{member.stats.totalChallenges}</div>
                          <div className="text-[10px] text-gray-500">🎯 {t("family.challenges")}</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{t("family.completion")}</span>
                          <span className="font-bold">{member.stats.completionRate}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-700" style={{ width: `${member.stats.completionRate}%` }} />
                        </div>
                      </div>

                      {/* Gift Button */}
                      {member.userId !== userId && (
                        <button
                          onClick={() => { setGiftToUserId(member.userId); setShowGiftModal(true); }}
                          className="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
                        >
                          🎁 {t("family.sendGift")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Gifts Tab */}
          {activeTab === "gifts" && selectedGroup && (
            <div className="space-y-4">
              {/* Send Gift Bar */}
              <div className="flex flex-wrap gap-3">
                {(["gift", "badge", "certificate"] as GiftType[]).map((type) => (
                  <button key={type} onClick={() => { setGiftType(type); setShowGiftModal(true); }}
                    className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all hover:shadow-md ${
                      type === "gift" ? "border-pink-200 bg-pink-50 text-pink-700 hover:border-pink-400" :
                      type === "badge" ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400" :
                      "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400"
                    }`}>
                    {type === "gift" ? "🎁" : type === "badge" ? "🏅" : "📜"} {t(`family.send${type[0].toUpperCase() + type.slice(1)}`)}
                  </button>
                ))}
              </div>

              {/* Gift List */}
              {giftsLoading ? (
                <div className="text-center py-8 text-gray-400">{t("common.loading")}</div>
              ) : gifts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🎁</div>
                  <p className="text-gray-500">{t("family.noGifts")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gifts.map((gift) => (
                    <div key={gift._id} className={`bg-white border rounded-2xl p-4 shadow-sm ${
                      gift.type === "gift" ? "border-pink-100" : gift.type === "badge" ? "border-amber-100" : "border-indigo-100"
                    }`}>
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{gift.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">{gift.title}</div>
                          <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-block mt-0.5 ${
                            gift.type === "gift" ? "bg-pink-100 text-pink-700" : gift.type === "badge" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                          }`}>
                            {t(`family.${gift.type}`)}
                          </div>
                          {gift.message && <p className="text-xs text-gray-600 mt-1">{gift.message}</p>}
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                            <span>{t("family.giftFrom")}: <b className="text-gray-600">{gift.fromUserId?.displayName}</b></span>
                            <span>→</span>
                            <span>{t("family.giftTo")}: <b className="text-gray-600">{gift.toUserId?.displayName}</b></span>
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-400">{formatEventTime(gift.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feed Tab */}
          {activeTab === "feed" && selectedGroup && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {FEED_FILTERS.map((f) => (
                  <button key={f} type="button" onClick={() => setFeedFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      feedFilter === f ? "bg-ink text-white border-ink" : "border-line hover:bg-gray-100"
                    }`}>
                    {t(`family.feedFilter.${f}`)}
                  </button>
                ))}
              </div>

              {feedLoading && feedEvents.length === 0 && <div className="text-sm text-gray-400 py-4">{t("family.feedLoading")}</div>}
              {!feedLoading && feedEvents.length === 0 && <div className="text-center py-8 text-gray-400">{t("family.feedNoEvents")}</div>}

              {feedEvents.length > 0 && (
                <div className="space-y-2">
                  {feedEvents.map((event) => (
                    <div key={event.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition">
                      <div className="flex items-start gap-3">
                        <Avatar name={event.actor.displayName} url={event.actor.avatarUrl} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm"><b>{event.actor.displayName}</b> {renderEventMessage(event)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatEventTime(event.occurredAt)}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          event.type === "entries" ? "bg-blue-100 text-blue-700" :
                          event.type === "challenges" ? "bg-amber-100 text-amber-700" :
                          event.type === "reports" ? "bg-green-100 text-green-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>{event.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {feedHasMore && (
                <button type="button" onClick={() => loadFeed(false)} disabled={feedLoading}
                  className="w-full border border-line rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-gray-50 disabled:opacity-50 transition">
                  {feedLoading ? t("common.loading") : t("family.feedLoadMore")}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Gift Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowGiftModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {giftType === "gift" ? "🎁" : giftType === "badge" ? "🏅" : "📜"}{" "}
                {t(`family.send${giftType[0].toUpperCase() + giftType.slice(1)}`)}
              </h3>
              <button onClick={() => setShowGiftModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
            </div>

            {/* Type Selector */}
            <div className="flex gap-2">
              {(["gift", "badge", "certificate"] as GiftType[]).map((type) => (
                <button key={type} onClick={() => { setGiftType(type); setGiftIcon(""); setGiftTitle(""); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    giftType === type ? "border-ink bg-ink/5" : "border-gray-200 hover:border-gray-300"
                  }`}>
                  {type === "gift" ? "🎁 " : type === "badge" ? "🏅 " : "📜 "}{t(`family.${type}`)}
                </button>
              ))}
            </div>

            {/* Recipient */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{t("family.selectMember")}</label>
              <select value={giftToUserId} onChange={(e) => setGiftToUserId(e.target.value)} className="w-full border-2 border-line rounded-xl px-4 py-2.5 text-sm">
                <option value="">{t("family.selectMember")}...</option>
                {otherMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.displayName}</option>
                ))}
              </select>
            </div>

            {/* Icon Selector */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{t("family.giftIcon")}</label>
              <div className="flex flex-wrap gap-2">
                {GIFT_ICONS[giftType].map((icon) => (
                  <button key={icon} onClick={() => setGiftIcon(icon)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border-2 transition-all ${
                      giftIcon === icon ? "border-ink bg-ink/5 shadow-sm scale-110" : "border-gray-200 hover:border-gray-300"
                    }`}>{icon}</button>
                ))}
              </div>
            </div>

            {/* Title Presets */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{t("family.giftTitle")}</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {GIFT_PRESETS[giftType].map((preset) => (
                  <button key={preset} onClick={() => setGiftTitle(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      giftTitle === preset ? "border-ink bg-ink/5" : "border-gray-200 hover:border-gray-300"
                    }`}>{preset}</button>
                ))}
              </div>
              <input type="text" value={giftTitle} onChange={(e) => setGiftTitle(e.target.value)} placeholder={t("family.giftTitle")} className="w-full border-2 border-line rounded-xl px-4 py-2.5 text-sm" />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{t("family.giftMessage")}</label>
              <textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder={t("family.giftMessage")} className="w-full border-2 border-line rounded-xl px-4 py-2.5 text-sm min-h-[60px] resize-none" />
            </div>

            {/* Preview */}
            {giftIcon && giftTitle && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed ${
                giftType === "gift" ? "border-pink-200 bg-pink-50" : giftType === "badge" ? "border-amber-200 bg-amber-50" : "border-indigo-200 bg-indigo-50"
              }`}>
                <span className="text-3xl">{giftIcon}</span>
                <div>
                  <div className="font-bold text-sm">{giftTitle}</div>
                  {giftMessage && <div className="text-xs text-gray-600">{giftMessage}</div>}
                </div>
              </div>
            )}

            {/* Send Button */}
            <button onClick={sendGift} disabled={giftSending || !giftToUserId || !giftIcon || !giftTitle}
              className="w-full bg-ink text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm">
              {giftSending ? t("common.loading") : t("family.send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
