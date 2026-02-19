"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLoggedIn, clearAuth, getUser, isAdmin } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Locale } from "@/lib/i18n";

export default function Navbar() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [admin, setAdmin] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setAdmin(isAdmin());
    const u = getUser();
    if (u) setUserName(u.displayName);
  }, [pathname]);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLangMenuOpen(false);
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const handleLogout = async () => {
    const rt = typeof window !== "undefined" ? localStorage.getItem("rt_refresh_token") : null;
    try {
      await apiFetch("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: rt }) });
    } catch {}
    clearAuth();
    window.location.href = "/login";
  };

  const navLinks = loggedIn
    ? [
        { href: "/tracker", labelKey: "nav.tracker" },
        { href: "/dashboard", labelKey: "nav.dashboard" },
        { href: "/challenges", labelKey: "nav.challenges" },
        { href: "/family", labelKey: "nav.family" },
        { href: "/reports", labelKey: "nav.reports" },
        { href: "/settings", labelKey: "nav.settings" },
        ...(admin ? [{ href: "/admin", labelKey: "nav.admin" }] : []),
      ]
    : [];

  const languageOptions: Locale[] = ["en", "ar", "tr"];

  const handleLanguageSelect = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setLangMenuOpen(false);
  };

  const getLanguageDisplay = (loc: Locale) => {
    const displays = {
      en: { code: "EN", flag: "🇺🇸", name: "English" },
      ar: { code: "AR", flag: "🇸🇦", name: "العربية" },
      tr: { code: "TR", flag: "🇹🇷", name: "Türkçe" }
    };
    return displays[loc];
  };

  return (
    <nav className="border-b-2 border-line bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-[1100px] px-4 flex items-center justify-between h-14">
        <Link href="/" className="font-extrabold text-xl tracking-wide flex items-center gap-2">
          <span className="font-ruqaa text-accent text-2xl">☪</span>
          <span>{t("app.title")}</span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                pathname === link.href
                  ? "bg-ink text-white"
                  : "hover:bg-gray-100"
              }`}
            >
              {t(link.labelKey)}
            </Link>
          ))}

          {/* Language Toggle */}
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border border-line hover:bg-gray-100 transition-all duration-200 hover:shadow-sm"
              title={`${t("settings.language")}: ${getLanguageDisplay(locale).name}`}
              aria-haspopup="menu"
              aria-expanded={langMenuOpen}
            >
              <span className="text-base">{getLanguageDisplay(locale).flag}</span>
              <span className="hidden sm:inline">{getLanguageDisplay(locale).code}</span>
              <svg className={`w-3 h-3 opacity-70 transition-transform duration-200 ${langMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown showing all languages */}
            <div className={`absolute top-full mt-1 right-0 bg-white border border-line rounded-lg shadow-lg p-2 z-50 min-w-[150px] transition-all duration-150 ${langMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"}`}>
              <div className="text-xs font-semibold text-gray-500 mb-1">{t("settings.language")}</div>
              {languageOptions.map((lang) => {
                const display = getLanguageDisplay(lang as Locale);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleLanguageSelect(lang as Locale)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left transition-colors ${
                      lang === locale ? "bg-accent text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    <span>{display.flag}</span>
                    <span>{display.name}</span>
                    {lang === locale && (
                      <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {loggedIn ? (
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors ml-2"
            >
              {t("nav.logout")}
            </button>
          ) : (
            <div className="flex gap-1 ml-2">
              <Link href="/login" className="px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-100">
                {t("nav.login")}
              </Link>
              <Link href="/signup" className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-ink text-white">
                {t("nav.signup")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
