"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { formatHijriDate, type Locale } from "@/lib/i18n";

const IBADAH_FIELDS = [
  { key: "ibadah_intention_quran", label: "نية واضحة + جزء قرآن" },
  { key: "ibadah_adhkar_focus", label: "أذكار كاملة بتركيز" },
  { key: "ibadah_two_rakaat", label: "قيام ركعتين" },
  { key: "ibadah_simple_charity", label: "صدقة بسيطة" },
  { key: "ibadah_tafsir_page", label: "قراءة تفسير صفحة" },
  { key: "ibadah_istighfar_100", label: "استغفار 100 مرة" },
];

const HABIT_FIELDS = [
  { key: "habit_no_smoking", label: "No Smoking" },
  { key: "habit_walk", label: "One Hour Walk" },
  { key: "habit_no_sugar", label: "No Sugar" },
  { key: "habit_healthy_food", label: "Healthy Food" },
  { key: "habit_water", label: "Drinking Water" },
];

const SALAH_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const SUNNAH_FIELDS = [
  { key: "sunnah_morning_dhikr", label: "Morning dhikr" },
  { key: "sunnah_evening_dhikr", label: "Evening dhikr" },
  { key: "sunnah_duha", label: "Salah dhuha" },
  { key: "sunnah_tahajjud", label: "Salah tahajjud" },
  { key: "sunnah_tarawih", label: "Salah tarawih" },
  { key: "sunnah_quran", label: "Read Qur'an" },
  { key: "sunnah_qabliyah_fajr", label: "Qabliyah fajr" },
  { key: "sunnah_qabliyah_dhuhr", label: "Qabliyah dhuhr" },
  { key: "sunnah_qabliyah_maghrib", label: "Qabliyah maghrib" },
  { key: "sunnah_qabliyah_isha", label: "Qabliyah isha" },
];

const MOODS = [
  { value: "happy", emoji: "😊" },
  { value: "okay", emoji: "🙂" },
  { value: "sad", emoji: "🙁" },
  { value: "great", emoji: "😄" },
];

export default function TrackerPage() {
  const router = useRouter();
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
        const locale = getCurrentLocale();
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
        const locale = getCurrentLocale();
        setHijriInfo(formatHijriDate(data.entry.hijriDay, data.entry.hijriMonth, data.entry.hijriYear, locale));
        setLocked(data.entry.status === "locked");
      }
    } catch (err: any) {
      if (err.message?.includes("locked")) setLocked(true);
    } finally {
      setSaving(false);
    }
  }, [date, locked]);

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

  const getCurrentLocale = (): Locale => {
    if (typeof window !== "undefined") {
      const htmlLang = document.documentElement.lang;
      return htmlLang === "ar" ? "ar" : "en";
    }
    return "en";
  };

  const completedCount = Object.values(fields).filter((v) => v === true).length;
  const textCount = Object.entries(fields).filter(([k, v]) => typeof v === "string" && v.trim().length > 0 && k !== "mood").length;
  const moodCount = fields.mood ? 1 : 0;
  const totalCompleted = completedCount + textCount + moodCount;

  if (!loaded) return <div className="text-center py-20 text-lg">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-2 border-line rounded-2xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.85),rgba(255,255,255,0.85)_10px,rgba(240,240,240,0.95)_10px,rgba(240,240,240,0.95)_20px)] p-4 text-center">
        <p className="font-ruqaa text-3xl md:text-5xl">رمضان كريم</p>
        <h1 className="text-2xl md:text-4xl font-extrabold">Ramadan Tracker</h1>
        {hijriInfo && <p className="text-accent font-semibold mt-1">{hijriInfo}</p>}
        <div className="mt-3 inline-flex items-center gap-3 bg-white border-2 border-line rounded-full px-4 py-2">
          <label className="font-semibold text-sm">Day</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-line rounded-lg px-2 py-1 text-sm" />
        </div>
        {locked && <div className="mt-2 bg-red-100 text-red-700 rounded-lg px-4 py-2 font-semibold text-sm inline-block">🔒 This entry is permanently locked</div>}
        {saving && <div className="mt-2 text-xs text-gray-500">Saving...</div>}
      </div>

      {/* Top Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ibadah */}
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">العبادة</h2>
          <ul className="mt-3 space-y-1.5">
            {IBADAH_FIELDS.map((f) => (
              <li key={f.key}>
                <label className="flex items-center gap-2 cursor-pointer text-base">
                  <input type="checkbox" checked={!!fields[f.key]} onChange={() => toggleField(f.key)} disabled={locked} className="w-4 h-4 accent-accent" />
                  {f.label}
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* Challenge */}
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Challenge of the Day</h2>
          <textarea rows={7} placeholder="Set one focused challenge for today..." value={fields.daily_challenge || ""} onChange={(e) => setTextField("daily_challenge", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>

        {/* Habits */}
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Habits</h2>
          <ul className="mt-3 space-y-1.5">
            {HABIT_FIELDS.map((f) => (
              <li key={f.key}>
                <label className="flex items-center gap-2 cursor-pointer text-base">
                  <input type="checkbox" checked={!!fields[f.key]} onChange={() => toggleField(f.key)} disabled={locked} className="w-4 h-4 accent-accent" />
                  {f.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Salah */}
      <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
        <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Salah Tracker</h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SALAH_NAMES.map((s) => (
            <div key={s} className="border border-gray-300 rounded-xl p-3 text-center bg-white">
              <h3 className="font-bold text-lg capitalize">{s}</h3>
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
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Alhamdulillah for</h2>
          <textarea rows={5} placeholder="Write what you are grateful for..." value={fields.gratitude || ""} onChange={(e) => setTextField("gratitude", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Mood Tracker</h2>
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
        <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Sunnah Tracker</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[SUNNAH_FIELDS.slice(0, 5), SUNNAH_FIELDS.slice(5)].map((col, ci) => (
            <ul key={ci} className="space-y-1.5">
              {col.map((f) => (
                <li key={f.key}>
                  <label className="flex items-center gap-2 cursor-pointer text-base">
                    <input type="checkbox" checked={!!fields[f.key]} onChange={() => toggleField(f.key)} disabled={locked} className="w-4 h-4 accent-accent" />
                    {f.label}
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
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Qur&apos;an Tracker</h2>
          <textarea rows={5} placeholder="Ayah, page, or reflection..." value={fields.quran_tracker || ""} onChange={(e) => setTextField("quran_tracker", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 pt-2">
          <h2 className="bg-ink text-white rounded-full px-4 py-1 text-center font-bold text-lg -mt-6 mx-auto w-fit">Hadith of the Day</h2>
          <textarea rows={5} placeholder="Write one hadith and your takeaway..." value={fields.hadith_day || ""} onChange={(e) => setTextField("hadith_day", e.target.value)} onBlur={onTextBlur} disabled={locked} className="mt-3 w-full border border-line rounded-lg p-3 resize-vertical bg-white text-sm disabled:opacity-50" />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-dashed border-gray-400 pt-3 text-center font-bold text-lg">
        {totalCompleted} completed items
      </div>
    </div>
  );
}
