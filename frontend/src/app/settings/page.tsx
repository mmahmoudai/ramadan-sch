"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SettingsPage() {
  const router = useRouter();
  const { setLocale, t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  // Settings fields
  const [language, setLanguageState] = useState("en");
  const [timezoneIana, setTimezoneIana] = useState("");
  const [timezoneSource, setTimezoneSource] = useState("auto");
  const [reminderEnabled, setReminderEnabled] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/me", { token });
      const u = data.user;
      setUser(u);
      setDisplayName(u.displayName || "");
      setBio(u.bio || "");
      const userLanguage = u.language || "en";
      setLanguageState(userLanguage);
      setLocale(userLanguage as "en" | "ar" | "tr");
      setTimezoneIana(u.timezoneIana || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setTimezoneSource(u.timezoneSource || "auto");
      setReminderEnabled(u.reminderEnabled !== false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = getToken()!;
      await apiFetch("/me/profile", { method: "PATCH", token, body: JSON.stringify({ displayName, bio }) });
      setMessage(t("settings.profileSaved"));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = getToken()!;
      await apiFetch("/me/settings", {
        method: "PATCH",
        token,
        body: JSON.stringify({ language, timezoneIana, timezoneSource, reminderEnabled }),
      });
      setLocale(language as "en" | "ar" | "tr");
      setMessage(t("settings.settingsSaved"));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-lg">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-extrabold">{t("settings.title")}</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">{message}</div>}

      {/* Profile */}
      <div className="border-2 border-line rounded-xl bg-card p-5">
        <h2 className="font-bold text-lg mb-4">{t("settings.profile")}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">{t("auth.displayName")}</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border-2 border-line rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t("settings.bio")}</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full border-2 border-line rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t("settings.reminders")}</label>
            <input type="email" value={user?.email || ""} disabled className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500" />
          </div>
          <button onClick={saveProfile} disabled={saving} className="bg-ink text-white px-4 py-2 rounded-lg font-semibold hover:bg-ink/80 disabled:opacity-50">{t("common.save")}</button>
        </div>
      </div>

      {/* Settings */}
      <div className="border-2 border-line rounded-xl bg-card p-5">
        <h2 className="font-bold text-lg mb-4">{t("settings.appSettings")}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">{t("settings.language")}</label>
            <select value={language} onChange={(e) => setLanguageState(e.target.value)} className="w-full border-2 border-line rounded-lg px-3 py-2">
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="tr">Türkçe (Turkish)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t("settings.timezone")}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="tzSrc" checked={timezoneSource === "auto"} onChange={() => { setTimezoneSource("auto"); setTimezoneIana(Intl.DateTimeFormat().resolvedOptions().timeZone); }} /> {t("settings.autoDetect")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="tzSrc" checked={timezoneSource === "manual"} onChange={() => setTimezoneSource("manual")} /> {t("settings.manual")}
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t("settings.timezoneIana")}</label>
            <input type="text" value={timezoneIana} onChange={(e) => setTimezoneIana(e.target.value)} disabled={timezoneSource === "auto"} className="w-full border-2 border-line rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="accent-accent w-4 h-4" />
              <span className="font-semibold">{t("settings.reminderEnabled")}</span>
            </label>
          </div>
          <button onClick={saveSettings} disabled={saving} className="bg-ink text-white px-4 py-2 rounded-lg font-semibold hover:bg-ink/80 disabled:opacity-50">{t("common.save")}</button>
        </div>
      </div>
      {/* Reminder Metrics */}
      <ReminderMetrics />
    </div>
  );
}

function ReminderMetrics() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = getToken()!;
      const [statsData, remData]: [any, any] = await Promise.all([
        apiFetch("/reminders/stats", { token }),
        apiFetch("/reminders", { token }),
      ]);
      setStats(statsData);
      setReminders(remData.reminders || []);
    } catch {}
    setLoading(false);
  };

  if (loading) return null;
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
