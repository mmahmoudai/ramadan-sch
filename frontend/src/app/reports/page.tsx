"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [periodScope, setPeriodScope] = useState("weekly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [includeProfile, setIncludeProfile] = useState(false);
  const [error, setError] = useState("");
  const [shareLink, setShareLink] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/reports/mine", { token });
      setReports(data.reports || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const token = getToken()!;
      await apiFetch("/reports", {
        method: "POST",
        token,
        body: JSON.stringify({ periodScope, periodStart, periodEnd, visibility, includeProfileInfo: includeProfile }),
      });
      setShowForm(false);
      loadReports();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const revokeLink = async (id: string) => {
    try {
      const token = getToken()!;
      await apiFetch(`/reports/${id}/revoke`, { method: "POST", token });
      loadReports();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getShareLink = async (id: string) => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch(`/reports/${id}/share-link`, { method: "POST", token });
      setShareLink(data.link);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-center py-20 text-lg">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{t("reports.title")}</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-ink text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90">
          {showForm ? t("common.cancel") : t("reports.createPlus")}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {shareLink && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-semibold mb-1">{t("reports.shareLink")}</p>
          <div className="flex gap-2">
            <input type="text" readOnly value={shareLink} className="flex-1 border border-line rounded-lg px-3 py-1 text-sm bg-white" />
            <button onClick={() => { navigator.clipboard.writeText(shareLink); }} className="bg-ink text-white px-3 py-1 rounded-lg text-xs font-bold">{t("reports.copy")}</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="border-2 border-line rounded-xl bg-card p-4">
          <form onSubmit={createReport} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">{t("reports.startDate")}</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t("reports.endDate")}</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required className="w-full border-2 border-line rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly", "custom"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setPeriodScope(s)} className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition ${periodScope === s ? "bg-ink text-white border-ink" : "border-line"}`}>
                  {t(`reports.${s}`)}
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="vis" checked={visibility === "private"} onChange={() => setVisibility("private")} /> {t("reports.private")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="vis" checked={visibility === "public"} onChange={() => setVisibility("public")} /> {t("reports.public")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={includeProfile} onChange={(e) => setIncludeProfile(e.target.checked)} className="accent-accent" /> {t("reports.includeProfileInfo")}
              </label>
            </div>
            <button type="submit" className="bg-accent text-white px-6 py-2 rounded-lg font-bold text-sm">{t("reports.createAction")}</button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r._id} className="border-2 border-line rounded-xl bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold">{r.periodStart} → {r.periodEnd}</p>
                <div className="flex gap-2 mt-1">
                  <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold uppercase">{t(`reports.${r.periodScope}`)}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.visibility === "public" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                    {r.visibility === "public" ? t("reports.public") : t("reports.private")}
                  </span>
                  {r.revokedAt && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">{t("reports.revoked")}</span>}
                  <span className="text-xs text-gray-500">{r.accessLog?.length || 0} {t("reports.views")}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => getShareLink(r._id)} className="text-xs px-3 py-1 rounded-lg border border-line hover:bg-gray-100 font-semibold">{t("reports.share")}</button>
                {r.visibility === "public" && !r.revokedAt && (
                  <button onClick={() => revokeLink(r._id)} className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold">{t("reports.revoke")}</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {reports.length === 0 && <p className="text-gray-500 text-center py-8">{t("reports.noReports")}</p>}
      </div>
    </div>
  );
}
