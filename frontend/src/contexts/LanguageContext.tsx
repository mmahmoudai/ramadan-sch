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
  const [mounted, setMounted] = useState(false);

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

  // On mount: read saved locale from localStorage, then load enabled languages
  useEffect(() => {
    try {
      const saved = localStorage.getItem("language") as Locale | null;
      if (saved && ALL_LOCALES.includes(saved)) {
        setLocaleState(saved);
      }
    } catch {}
    reloadEnabledLanguages();
    setMounted(true);
    // Remove the visibility:hidden set by the inline script in layout.tsx
    document.documentElement.style.visibility = "";
  }, [reloadEnabledLanguages]);

  // Update HTML lang and dir attributes when locale changes (client only)
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
    try { localStorage.setItem("language", locale); } catch {}
  }, [locale, mounted]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (enabledLanguages.includes(newLocale)) {
      setLocaleState(newLocale);
    }
  }, [enabledLanguages]);

  // Always use "en" for SSR/first render to match server output, switch after mount
  const activeLocale = mounted ? locale : "en";

  const value: LanguageContextType = {
    locale: activeLocale,
    setLocale,
    t: (key: string) => t(key, activeLocale),
    dir: getDirection(activeLocale),
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
