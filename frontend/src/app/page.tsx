"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="border-2 border-line rounded-2xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.85),rgba(255,255,255,0.85)_10px,rgba(240,240,240,0.95)_10px,rgba(240,240,240,0.95)_20px)] p-6 text-center">
        <p className="font-ruqaa text-4xl md:text-6xl mt-1 mb-2">{t("app.subtitle")}</p>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-wide">{t("app.title")}</h1>
        <p className="mt-3 text-gray-600 max-w-lg mx-auto">
          {t("home.heroDescription")}
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/signup" className="bg-ink text-white px-8 py-3 rounded-xl font-bold text-lg hover:opacity-90 transition">
            {t("home.getStarted")}
          </Link>
          <Link href="/login" className="border-2 border-ink px-8 py-3 rounded-xl font-bold text-lg hover:bg-gray-100 transition">
            {t("nav.login")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">📿</div>
          <h3 className="font-bold text-lg">{t("home.dailyTrackerTitle")}</h3>
          <p className="text-sm text-gray-600 mt-1">{t("home.dailyTrackerDesc")}</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <h3 className="font-bold text-lg">{t("nav.challenges")}</h3>
          <p className="text-sm text-gray-600 mt-1">{t("home.challengesDesc")}</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">👨‍👩‍👧‍👦</div>
          <h3 className="font-bold text-lg">{t("home.familySharingTitle")}</h3>
          <p className="text-sm text-gray-600 mt-1">{t("home.familySharingDesc")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">📊</div>
          <h3 className="font-bold text-lg">{t("nav.dashboard")}</h3>
          <p className="text-sm text-gray-600 mt-1">{t("home.dashboardDesc")}</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">📋</div>
          <h3 className="font-bold text-lg">{t("nav.reports")}</h3>
          <p className="text-sm text-gray-600 mt-1">{t("home.reportsDesc")}</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h3 className="font-bold text-lg">{t("home.dailyLockTitle")}</h3>
          <p className="text-sm text-gray-600 mt-1">{t("home.dailyLockDesc")}</p>
        </div>
      </div>
    </div>
  );
}
