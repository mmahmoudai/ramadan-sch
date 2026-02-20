"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

const BIO_MAX = 300;

const ALL_TIMEZONES: string[] = (() => {
  try {
    return (Intl as any).supportedValuesOf("timeZone") as string[];
  } catch {
    return ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Istanbul", "Asia/Riyadh", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];
  }
})();

export default function SettingsPage() {
  const router = useRouter();
  const { setLocale, t, enabledLanguages } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile fields + saved snapshot for dirty tracking
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [savedProfile, setSavedProfile] = useState({ displayName: "", bio: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  // Settings fields + saved snapshot
  const [language, setLanguageState] = useState("en");
  const [timezoneIana, setTimezoneIana] = useState("");
  const [timezoneSource, setTimezoneSource] = useState("auto");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [savedSettings, setSavedSettings] = useState({ language: "en", timezoneIana: "", timezoneSource: "auto", reminderEnabled: true });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");

  // Timezone search filter
  const [tzSearch, setTzSearch] = useState("");

  const profileDirty = displayName !== savedProfile.displayName || bio !== savedProfile.bio;
  const settingsDirty =
    language !== savedSettings.language ||
    timezoneIana !== savedSettings.timezoneIana ||
    timezoneSource !== savedSettings.timezoneSource ||
    reminderEnabled !== savedSettings.reminderEnabled;

  const filteredTimezones = useMemo(() =>
    tzSearch.trim() === ""
      ? ALL_TIMEZONES
      : ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase())),
    [tzSearch]
  );

  const loadProfile = useCallback(async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/me", { token });
      const u = data.user;
      setUser(u);
      const dn = u.displayName || "";
      const b = u.bio || "";
      const lang = u.language || "en";
      const tz = u.timezoneIana || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzSrc = u.timezoneSource || "auto";
      const rem = u.reminderEnabled !== false;
      setDisplayName(dn);
      setBio(b);
      setSavedProfile({ displayName: dn, bio: b });
      setLanguageState(lang);
      setLocale(lang as "en" | "ar" | "tr");
      setTimezoneIana(tz);
      setTimezoneSource(tzSrc);
      setReminderEnabled(rem);
      setSavedSettings({ language: lang, timezoneIana: tz, timezoneSource: tzSrc, reminderEnabled: rem });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [setLocale]);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadProfile();
  }, [loadProfile, router]);

  const saveProfile = async () => {
    if (!profileDirty) return;
    setProfileSaving(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const token = getToken()!;
      await apiFetch("/me/profile", { method: "PATCH", token, body: JSON.stringify({ displayName, bio }) });
      setSavedProfile({ displayName, bio });
      setProfileMessage(t("settings.profileSaved"));
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!settingsDirty) return;
    setSettingsSaving(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      const token = getToken()!;
      await apiFetch("/me/settings", {
        method: "PATCH",
        token,
        body: JSON.stringify({ language, timezoneIana, timezoneSource, reminderEnabled }),
      });
      setLocale(language as "en" | "ar" | "tr");
      setSavedSettings({ language, timezoneIana, timezoneSource, reminderEnabled });
      setSettingsMessage(t("settings.settingsSaved"));
    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-lg">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-extrabold">{t("settings.title")}</h1>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <div className="border-2 border-line rounded-xl bg-card p-5">
        <h2 className="font-bold text-lg mb-4">{t("settings.profile")}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">{t("auth.displayName")}</label>
            <input
              type="text"
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-ink transition"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-semibold">{t("settings.bio")}</label>
              <span className={`text-xs ${bio.length > BIO_MAX * 0.9 ? "text-red-500" : "text-gray-400"}`}>{bio.length}/{BIO_MAX}</span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => { if (e.target.value.length <= BIO_MAX) setBio(e.target.value); }}
              rows={3}
              className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-ink transition resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t("settings.email")}</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">{t("settings.emailNote")}</p>
          </div>
          {profileError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{profileError}</p>}
          {profileMessage && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{profileMessage}</p>}
          <button
            onClick={saveProfile}
            disabled={profileSaving || !profileDirty}
            className="bg-ink text-white px-4 py-2 rounded-lg font-semibold hover:bg-ink/80 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {profileSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>

      {/* ── App Settings ─────────────────────────────────────────────────── */}
      <div className="border-2 border-line rounded-xl bg-card p-5">
        <h2 className="font-bold text-lg mb-4">{t("settings.appSettings")}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">{t("settings.language")}</label>
            <select
              value={language}
              onChange={(e) => setLanguageState(e.target.value)}
              className="w-full border-2 border-line rounded-lg px-3 py-2 focus:outline-none focus:border-ink transition"
            >
              {enabledLanguages.includes("en") && <option value="en">English</option>}
              {enabledLanguages.includes("ar") && <option value="ar">العربية (Arabic)</option>}
              {enabledLanguages.includes("tr") && <option value="tr">Türkçe (Turkish)</option>}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">{t("settings.timezone")}</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="tzSrc"
                  checked={timezoneSource === "auto"}
                  onChange={() => { setTimezoneSource("auto"); setTimezoneIana(Intl.DateTimeFormat().resolvedOptions().timeZone); setTzSearch(""); }}
                />
                {t("settings.autoDetect")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="tzSrc" checked={timezoneSource === "manual"} onChange={() => setTimezoneSource("manual")} />
                {t("settings.manual")}
              </label>
            </div>
            {timezoneSource === "manual" ? (
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Search timezone..."
                  value={tzSearch}
                  onChange={(e) => setTzSearch(e.target.value)}
                  className="w-full border-2 border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ink transition"
                />
                <select
                  size={5}
                  value={timezoneIana}
                  onChange={(e) => { setTimezoneIana(e.target.value); setTzSearch(""); }}
                  className="w-full border-2 border-line rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-ink transition"
                >
                  {filteredTimezones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Selected: <span className="font-semibold">{timezoneIana}</span></p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {timezoneIana}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              <div>
                <span className="font-semibold">{t("settings.reminderEnabled")}</span>
                <p className="text-xs text-gray-400 mt-0.5">{t("settings.reminderEnabledNote")}</p>
              </div>
            </label>
          </div>

          {settingsError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{settingsError}</p>}
          {settingsMessage && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{settingsMessage}</p>}
          <button
            onClick={saveSettings}
            disabled={settingsSaving || !settingsDirty}
            className="bg-ink text-white px-4 py-2 rounded-lg font-semibold hover:bg-ink/80 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {settingsSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>

      {/* ── Reminder Metrics ─────────────────────────────────────────────── */}
      <ReminderMetrics />
    </div>
  );
}

function ReminderMetrics() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const token = getToken()!;
      const [statsData, remData]: [any, any] = await Promise.all([
        apiFetch("/reminders/stats", { token }),
        apiFetch("/reminders", { token }),
      ]);
      setStats(statsData);
      setReminders(remData.reminders || []);
    } catch (err: any) {
      setError(err.message || "Failed to load reminder metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) return null;
  if (error) return null;
  if (!stats) return null;

  return (
    <div className="border-2 border-line rounded-xl bg-card p-5">
      <h2 className="font-bold text-lg mb-4">{t("settings.reminderMetrics")}</h2>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-2xl font-extrabold">{stats.total}</p>
          <p className="text-xs font-semibold text-gray-500">{t("stats.total")}</p>
        </div>
        <div className="bg-white rounded-lg border border-green-200 p-3 text-center">
          <p className="text-2xl font-extrabold text-green-600">{stats.sent}</p>
          <p className="text-xs font-semibold text-gray-500">{t("stats.sent")}</p>
        </div>
        <div className="bg-white rounded-lg border border-yellow-200 p-3 text-center">
          <p className="text-2xl font-extrabold text-yellow-600">{stats.skipped}</p>
          <p className="text-xs font-semibold text-gray-500">{t("stats.skipped")}</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-3 text-center">
          <p className="text-2xl font-extrabold text-red-600">{stats.failed}</p>
          <p className="text-xs font-semibold text-gray-500">{t("stats.failed")}</p>
        </div>
      </div>
      {reminders.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2">{t("settings.recentReminders")}</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {reminders.map((r: any) => (
              <div key={r._id} className="flex items-center justify-between bg-white rounded px-3 py-1.5 border border-gray-100 text-xs">
                <span>{new Date(r.sendAtUtc).toLocaleString()}</span>
                <span className={`font-bold ${r.status === "sent" ? "text-green-600" : r.status === "skipped" ? "text-yellow-600" : "text-red-600"}`}>
                  {r.status}
                </span>
                {r.reason && <span className="text-gray-400 ml-2 truncate max-w-[200px]">{r.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
