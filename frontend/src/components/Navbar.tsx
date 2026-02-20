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
  const [mobileOpen, setMobileOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setAdmin(isAdmin());
    const u = getUser();
    if (u) setUserName(u.displayName);
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setLangMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setLangMenuOpen(false); setMobileOpen(false); }
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
        { href: "/tracker", labelKey: "nav.tracker", icon: "📝" },
        { href: "/dashboard", labelKey: "nav.dashboard", icon: "📊" },
        { href: "/challenges", labelKey: "nav.challenges", icon: "🎯" },
        { href: "/family", labelKey: "nav.family", icon: "👨‍👩‍👧" },
        { href: "/reports", labelKey: "nav.reports", icon: "📋" },
        { href: "/settings", labelKey: "nav.settings", icon: "⚙️" },
        ...(admin ? [{ href: "/admin", labelKey: "nav.admin", icon: "🛡️" }] : []),
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
      tr: { code: "TR", flag: "🇹🇷", name: "Türkçe" },
    };
    return displays[loc];
  };

  return (
    <nav className="border-b-2 border-line bg-white/90 backdrop-blur sticky top-0 z-50">
      {/* Desktop + Mobile top bar */}
      <div className="mx-auto max-w-[1100px] px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="font-extrabold text-xl tracking-wide flex items-center gap-2 shrink-0">
          <span className="font-ruqaa text-accent text-2xl">☪</span>
          <span className="hidden xs:inline">{t("app.title")}</span>
          <span className="xs:hidden">RT</span>
        </Link>

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center px-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                pathname === link.href ? "bg-ink text-white" : "hover:bg-gray-100"
              }`}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>

        {/* Right side: lang + logout (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Language Toggle */}
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold border border-line hover:bg-gray-100 transition-all"
              aria-haspopup="menu"
              aria-expanded={langMenuOpen}
            >
              <span className="text-base">{getLanguageDisplay(locale).flag}</span>
              <span className="hidden sm:inline text-xs">{getLanguageDisplay(locale).code}</span>
              <svg className={`w-3 h-3 opacity-60 transition-transform ${langMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`absolute top-full mt-1 right-0 bg-white border border-line rounded-xl shadow-lg p-2 z-50 min-w-[150px] transition-all duration-150 ${langMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"}`}>
              <div className="text-xs font-semibold text-gray-500 mb-1 px-1">{t("settings.language")}</div>
              {languageOptions.map((lang) => {
                const display = getLanguageDisplay(lang as Locale);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleLanguageSelect(lang as Locale)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
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

          {/* Logout — desktop only */}
          {loggedIn ? (
            <button
              onClick={handleLogout}
              className="hidden md:block px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              {t("nav.logout")}
            </button>
          ) : (
            <div className="hidden md:flex gap-1">
              <Link href="/login" className="px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-100">
                {t("nav.login")}
              </Link>
              <Link href="/signup" className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-ink text-white">
                {t("nav.signup")}
              </Link>
            </div>
          )}

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-line bg-white shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  pathname === link.href
                    ? "bg-ink text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <span className="text-lg">{link.icon}</span>
                {t(link.labelKey)}
              </Link>
            ))}

            {/* Divider */}
            {loggedIn && <div className="border-t border-gray-100 my-2" />}

            {/* Auth actions */}
            {loggedIn ? (
              <button
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <span className="text-lg">🚪</span>
                {t("nav.logout")}
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-gray-100">
                  <span className="text-lg">🔑</span> {t("nav.login")}
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-ink text-white">
                  <span className="text-lg">✨</span> {t("nav.signup")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
