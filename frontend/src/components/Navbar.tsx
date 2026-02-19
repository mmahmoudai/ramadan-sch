"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLoggedIn, clearAuth, getUser, isAdmin } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Locale } from "@/lib/i18n";

export default function Navbar() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setAdmin(isAdmin());
    const u = getUser();
    if (u) setUserName(u.displayName);
  }, [pathname]);

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

  const cycleLanguage = () => {
    const order: Locale[] = ["en", "ar", "tr"];
    const idx = order.indexOf(locale);
    setLocale(order[(idx + 1) % order.length]);
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
          <button
            onClick={cycleLanguage}
            className="px-2 py-1 rounded-lg text-xs font-bold border border-line hover:bg-gray-100 transition"
            title={t("settings.language")}
          >
            {locale.toUpperCase()}
          </button>

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
