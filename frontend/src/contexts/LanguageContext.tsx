"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { type Locale, t, getDirection } from "@/lib/i18n";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Load language from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("language") as Locale;
    if (saved && (saved === "en" || saved === "ar")) {
      setLocaleState(saved);
    }
  }, []);

  // Update HTML lang and dir attributes when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
    localStorage.setItem("language", locale);
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const value: LanguageContextType = {
    locale,
    setLocale,
    t: (key: string) => t(key, locale),
    dir: getDirection(locale),
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
