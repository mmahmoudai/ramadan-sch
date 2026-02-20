"use client";

import { useState, useEffect, useCallback } from "react";
import { Languages, RefreshCw } from "lucide-react";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

const ALL_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
] as const;

type LangCode = "en" | "ar" | "tr";

interface AppConfig {
  emailRemindersEnabled: boolean;
  enabledLanguages: LangCode[];
}

interface Props {
  onToast: (type: "success" | "error", message: string) => void;
}

export function LanguagesPanel({ onToast }: Props) {
  const { reloadEnabledLanguages } = useLanguage();
  const [enabledLanguages, setEnabledLanguages] = useState<LangCode[]>(["en", "ar", "tr"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken()!;
      const data = await apiFetch<{ config: AppConfig }>("/admin/config", { token });
      const langs = Array.isArray(data.config.enabledLanguages)
        ? data.config.enabledLanguages
        : ["en", "ar", "tr"];
      setEnabledLanguages(langs as LangCode[]);
    } catch (err: any) {
      onToast("error", err.message || "Failed to load language settings");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const toggle = async (code: LangCode) => {
    if (saving) return;

    const isCurrentlyEnabled = enabledLanguages.includes(code);

    // Enforce: at least one language must remain active
    if (isCurrentlyEnabled && enabledLanguages.length <= 1) {
      onToast("error", "At least one language must remain enabled");
      return;
    }

    const next = isCurrentlyEnabled
      ? enabledLanguages.filter((l) => l !== code)
      : [...enabledLanguages, code];

    setSaving(true);
    const prev = enabledLanguages;
    setEnabledLanguages(next); // optimistic

    try {
      const token = getToken()!;
      const data = await apiFetch<{ config: AppConfig }>("/admin/config", {
        token,
        method: "PATCH",
        body: JSON.stringify({ enabledLanguages: next }),
      });
      const updated = Array.isArray(data.config.enabledLanguages)
        ? data.config.enabledLanguages as LangCode[]
        : next;
      setEnabledLanguages(updated);
      // Reload context so navbar/settings page update immediately
      await reloadEnabledLanguages();
      onToast("success", `${ALL_LANGUAGES.find(l => l.code === code)?.name} ${isCurrentlyEnabled ? "disabled" : "enabled"}`);
    } catch (err: any) {
      setEnabledLanguages(prev); // rollback
      onToast("error", err.message || "Failed to update language settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-2 border-line rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold">Language Control</h2>
        </div>
        <button
          onClick={loadConfig}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Enable or disable languages available in the app. At least one must remain active.
        Users on a disabled language will automatically switch to the first enabled language.
      </p>

      {loading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading...</div>
      ) : (
        <div className="space-y-2">
          {ALL_LANGUAGES.map((lang) => {
            const isEnabled = enabledLanguages.includes(lang.code);
            const isLast = isEnabled && enabledLanguages.length === 1;

            return (
              <div
                key={lang.code}
                className="flex items-center justify-between border border-line rounded-xl px-4 py-3 bg-card"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <p className="font-semibold text-sm">{lang.name}</p>
                    <p className="text-xs text-gray-500">{lang.nativeName}</p>
                  </div>
                  {isLast && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Last active
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggle(lang.code)}
                  disabled={saving || isLast}
                  title={isLast ? "Cannot disable the last active language" : undefined}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                    isEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      isEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
