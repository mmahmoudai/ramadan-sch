"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { type Locale, t, getDirection } from "@/lib/i18n";

const ALL_LOCALES: Locale[] = ["en", "ar", "tr"];

export interface LanguageInfo {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGE_META: Record<Locale, LanguageInfo> = {
  en: { code: "en", name: "English",  nativeName: "English",  flag: "🇺🇸" },
  ar: { code: "ar", name: "Arabic",   nativeName: "العربية",   flag: "🇸🇦" },
  tr: { code: "tr", name: "Turkish",  nativeName: "Türkçe",   flag: "🇹🇷" },
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
  enabledLanguages: Locale[];
  reloadEnabledLanguages: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [enabledLanguages, setEnabledLanguages] = useState<Locale[]>(ALL_LOCALES);

  const reloadEnabledLanguages = useCallback(async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/config/languages`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const langs: Locale[] = Array.isArray(data.enabledLanguages)
        ? data.enabledLanguages.filter((l: string) => ALL_LOCALES.includes(l as Locale)) as Locale[]
        : ALL_LOCALES;
      if (langs.length === 0) return;
      setEnabledLanguages(langs);
      // If current locale was disabled, fall back to first enabled
      setLocaleState((prev) => langs.includes(prev) ? prev : langs[0]);
    } catch {
      // Network error — keep defaults
    }
  }, []);

  // On mount: load enabled languages, then apply saved locale if still enabled
  useEffect(() => {
    reloadEnabledLanguages().then(() => {
      const saved = localStorage.getItem("language") as Locale | null;
      if (saved && ALL_LOCALES.includes(saved)) {
        setLocaleState((prev) => {
          // Will be corrected by reloadEnabledLanguages if disabled
          return saved;
        });
      }
    });
  }, [reloadEnabledLanguages]);

  // Update HTML lang and dir attributes when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
    localStorage.setItem("language", locale);
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (enabledLanguages.includes(newLocale)) {
      setLocaleState(newLocale);
    }
  }, [enabledLanguages]);

  const value: LanguageContextType = {
    locale,
    setLocale,
    t: (key: string) => t(key, locale),
    dir: getDirection(locale),
    enabledLanguages,
    reloadEnabledLanguages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
