"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { formatHijriDate } from "@/lib/i18n";
import { useLanguage } from "@/contexts/LanguageContext";

const IBADAH_FIELDS = [
  { key: "ibadah_intention_quran", labelKey: "tracker.ibadah_intention_quran" },
  { key: "ibadah_adhkar_focus", labelKey: "tracker.ibadah_adhkar_focus" },
  { key: "ibadah_two_rakaat", labelKey: "tracker.ibadah_two_rakaat" },
  { key: "ibadah_simple_charity", labelKey: "tracker.ibadah_simple_charity" },
  { key: "ibadah_tafsir_page", labelKey: "tracker.ibadah_tafsir_page" },
  { key: "ibadah_istighfar_100", labelKey: "tracker.ibadah_istighfar_100" },
];

const HABIT_FIELDS = [
  { key: "habit_no_smoking", labelKey: "tracker.habit_no_smoking" },
  { key: "habit_walk", labelKey: "tracker.habit_walk" },
  { key: "habit_no_sugar", labelKey: "tracker.habit_no_sugar" },
  { key: "habit_healthy_food", labelKey: "tracker.habit_healthy_food" },
  { key: "habit_water", labelKey: "tracker.habit_water" },
];

const SALAH_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const SUNNAH_FIELDS = [
  { key: "sunnah_morning_dhikr", labelKey: "tracker.sunnah_morning_dhikr" },
  { key: "sunnah_evening_dhikr", labelKey: "tracker.sunnah_evening_dhikr" },
  { key: "sunnah_duha", labelKey: "tracker.sunnah_duha" },
  { key: "sunnah_tahajjud", labelKey: "tracker.sunnah_tahajjud" },
  { key: "sunnah_tarawih", labelKey: "tracker.sunnah_tarawih" },
  { key: "sunnah_quran", labelKey: "tracker.sunnah_quran" },
  { key: "sunnah_qabliyah_fajr", labelKey: "tracker.sunnah_qabliyah_fajr" },
  { key: "sunnah_qabliyah_dhuhr", labelKey: "tracker.sunnah_qabliyah_dhuhr" },
  { key: "sunnah_qabliyah_maghrib", labelKey: "tracker.sunnah_qabliyah_maghrib" },
  { key: "sunnah_qabliyah_isha", labelKey: "tracker.sunnah_qabliyah_isha" },
];

const MOODS = [
  { value: "happy", emoji: "😊" },
  { value: "okay", emoji: "🙂" },
  { value: "sad", emoji: "🙁" },
  { value: "great", emoji: "😄" },
];

export default function TrackerPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fields, setFields] = useState<Record<string, any>>({});
  const [locked, setLocked] = useState(false);
  const [hijriInfo, setHijriInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadEntry();
  }, [date]);

  const loadEntry = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch(`/entries/${date}`, { token });
      if (data.entry) {
        const fieldMap: Record<string, any> = {};
        for (const f of data.entry.fields) {
          fieldMap[f.fieldKey] = f.value;
        }
        setFields(fieldMap);
        setLocked(data.entry.status === "locked");
        setHijriInfo(formatHijriDate(data.entry.hijriDay, data.entry.hijriMonth, data.entry.hijriYear, locale));
      } else {
        setFields({});
        setLocked(false);
        setHijriInfo("");
      }
      setLoaded(true);
    } catch (err) {
      console.error(err);
      setLoaded(true);
    }
  };

  const saveEntry = useCallback(async (updatedFields: Record<string, any>) => {
    if (locked) return;
    setSaving(true);
    try {
      const token = getToken()!;
      const fieldArr = Object.entries(updatedFields).map(([key, value]) => ({
        fieldKey: key,
        fieldType: typeof value === "boolean" ? "checkbox" : typeof value === "string" && value.length > 50 ? "textarea" : "text",
        value,
        completed: typeof value === "boolean" ? value : typeof value === "string" ? value.trim().length > 0 : false,
      }));
      const data: any = await apiFetch(`/entries/${date}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ fields: fieldArr }),
      });
      if (data.entry) {
        setHijriInfo(formatHijriDate(data.entry.hijriDay, data.entry.hijriMonth, data.entry.hijriYear, locale));
        setLocked(data.entry.status === "locked");
      }
    } catch (err: any) {
      if (err.message?.includes("locked")) setLocked(true);
    } finally {
      setSaving(false);
    }
  }, [date, locked, locale]);

  const toggleField = (key: string) => {
    if (locked) return;
    const updated = { ...fields, [key]: !fields[key] };
    setFields(updated);
    saveEntry(updated);
  };

  const setTextField = (key: string, value: string) => {
    if (locked) return;
    const updated = { ...fields, [key]: value };
    setFields(updated);
  };

  const onTextBlur = () => { if (!locked) saveEntry(fields); };

  const setMood = (value: string) => {
    if (locked) return;
    const updated = { ...fields, mood: value };
    setFields(updated);
    saveEntry(updated);
  };


  const completedCount = Object.values(fields).filter((v) => v === true).length;
  const textCount = Object.entries(fields).filter(([k, v]) => typeof v === "string" && v.trim().length > 0 && k !== "mood").length;
  const moodCount = fields.mood ? 1 : 0;
  const totalCompleted = completedCount + textCount + moodCount;

  if (!loaded) return <div className="text-center py-20 text-lg">{t("tracker.loading")}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-2 border-line rounded-2xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.85),rgba(255,255,255,0.85)_10px,rgba(240,240,240,0.95)_10px,rgba(240,240,240,0.95)_20px)] p-4 text-center">
        <p className="font-ruqaa text-3xl md:text-5xl">رمضان كريم</p>
        <h1 className="text-2xl md:text-4xl font-extrabold">{t("app.title")}</h1>
        {hijriInfo && <p className="text-accent font-semibold mt-1">{hijriInfo}</p>}
        <div className="mt-3 inline-flex items-center gap-3 bg-white border-2 border-line rounded-full px-4 py-2">
          <label className="font-semibold text-sm">{t("tracker.day")}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-line rounded-lg px-2 py-1 text-sm" />
        </div>
        {locked && <div className="mt-2 bg-red-100 text-red-700 rounded-lg px-4 py-2 font-semibold text-sm inline-block">{t("tracker.permanentlyLocked")}</div>}
        {saving && <div className="mt-2 text-xs text-gray-500">{t("tracker.saving")}</div>}
      </div>

      {/* Top Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ibadah */}
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.ibadah")}</h2>
          <ul className="mt-3 space-y-1.5">
            {IBADAH_FIELDS.map((f) => (
              <li key={f.key}>
                <label className="flex items-center gap-2 cursor-pointer text-base">
                  <input type="checkbox" checked={!!fields[f.key]} onChange={() => toggleField(f.key)} disabled={locked} className="w-4 h-4 accent-accent" />
                  {t(f.labelKey)}
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* Challenge */}
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.challenge")}</h2>
          <textarea rows={7} placeholder={t("tracker.challengePlaceholder")} value={fields.daily_challenge || ""} onChange={(e) => setTextField("daily_challenge", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>

        {/* Habits */}
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.habits")}</h2>
          <ul className="mt-3 space-y-1.5">
            {HABIT_FIELDS.map((f) => (
              <li key={f.key}>
                <label className="flex items-center gap-2 cursor-pointer text-base">
                  <input type="checkbox" checked={!!fields[f.key]} onChange={() => toggleField(f.key)} disabled={locked} className="w-4 h-4 accent-accent" />
                  {t(f.labelKey)}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Salah */}
      <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
        <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.salah")}</h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SALAH_NAMES.map((s) => (
            <div key={s} className="border border-gray-300 rounded-xl p-3 text-center bg-white">
              <h3 className="font-bold text-lg">{t(`tracker.salah.${s}`)}</h3>
              <div className="flex justify-center gap-2 mt-2">
                {[1, 2, 3].map((n) => {
                  const key = `${s}_${n}`;
                  return (
                    <label key={key} className="relative w-5 h-5 cursor-pointer">
                      <input type="checkbox" checked={!!fields[key]} onChange={() => toggleField(key)} disabled={locked} className="absolute inset-0 opacity-0 cursor-pointer" />
                      <span className={`absolute inset-0 rounded-full border-2 border-ink transition ${fields[key] ? "bg-accent scale-90" : "bg-white"}`} />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gratitude + Mood */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.gratitude")}</h2>
          <textarea rows={5} placeholder={t("tracker.gratitudePlaceholder")} value={fields.gratitude || ""} onChange={(e) => setTextField("gratitude", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.mood")}</h2>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {MOODS.map((m) => (
              <label key={m.value} className={`border-2 rounded-xl p-3 text-center cursor-pointer text-3xl transition ${fields.mood === m.value ? "border-accent shadow-inner" : "border-line bg-white"}`}>
                <input type="radio" name="mood" checked={fields.mood === m.value} onChange={() => setMood(m.value)} disabled={locked} className="hidden" />
                {m.emoji}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Sunnah */}
      <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
        <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.sunnah")}</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[SUNNAH_FIELDS.slice(0, 5), SUNNAH_FIELDS.slice(5)].map((col, ci) => (
            <ul key={ci} className="space-y-1.5">
              {col.map((f) => (
                <li key={f.key}>
                  <label className="flex items-center gap-2 cursor-pointer text-base">
                    <input type="checkbox" checked={!!fields[f.key]} onChange={() => toggleField(f.key)} disabled={locked} className="w-4 h-4 accent-accent" />
                    {t(f.labelKey)}
                  </label>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/* Quran + Hadith */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.quran")}</h2>
          <textarea rows={5} placeholder={t("tracker.quranPlaceholder")} value={fields.quran_tracker || ""} onChange={(e) => setTextField("quran_tracker", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">{t("tracker.hadith")}</h2>
          <textarea rows={5} placeholder={t("tracker.hadithPlaceholder")} value={fields.hadith_day || ""} onChange={(e) => setTextField("hadith_day", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-dashed border-gray-400 pt-3 text-center font-bold text-lg">
        {totalCompleted} {t("tracker.completedItems")}
      </div>
    </div>
  );
}
