"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatHijriDate, type Locale } from "@/lib/i18n";

export default function PublicReportPage() {
  const params = useParams();
  const token = params.token as string;
  const [report, setReport] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    loadReport();
  }, [token]);

  const loadReport = async () => {
    try {
      const data: any = await apiFetch(`/reports/public/${token}`);
      setReport(data.report);
      setEntries(data.entries || []);
      setOwner(data.owner);
    } catch (err: any) {
      setError(err.message || "Report not found or revoked");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocale = (): Locale => {
    if (typeof window !== "undefined") {
      const htmlLang = document.documentElement.lang;
      return htmlLang === "ar" ? "ar" : "en";
    }
    return "en";
  };

  if (loading) return <div className="text-center py-20 text-lg">Loading report...</div>;
  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="border-2 border-line rounded-2xl bg-card p-8">
        <div className="text-5xl mb-4">📋</div>
        <h1 className="text-2xl font-extrabold mb-2">Report Not Found</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  const totalFields = entries.reduce((sum, e) => sum + (e.fields?.length || 0), 0);
  const completedFields = entries.reduce((sum, e) => sum + (e.fields?.filter((f: any) => f.completed).length || 0), 0);
  const overallScore = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-2 border-line rounded-2xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.85),rgba(255,255,255,0.85)_10px,rgba(240,240,240,0.95)_10px,rgba(240,240,240,0.95)_20px)] p-6 text-center">
        <p className="font-ruqaa text-3xl mb-1">رمضان كريم</p>
        <h1 className="text-2xl font-extrabold">Ramadan Report</h1>
        {owner && (
          <div className="mt-3 flex items-center justify-center gap-3">
            {owner.avatarUrl && <img src={owner.avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-line" />}
            <div>
              <p className="font-bold">{owner.displayName}</p>
              {owner.bio && <p className="text-xs text-gray-500">{owner.bio}</p>}
            </div>
          </div>
        )}
        <div className="mt-3 text-sm text-gray-600">
          {report.periodStart} → {report.periodEnd}
          <span className="ml-3 bg-gray-200 px-2 py-0.5 rounded text-xs font-bold uppercase">{report.periodScope}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
          <p className="text-3xl font-extrabold text-accent">{entries.length}</p>
          <p className="text-sm font-semibold text-gray-600">Days Tracked</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
          <p className="text-3xl font-extrabold text-accent">{overallScore}%</p>
          <p className="text-sm font-semibold text-gray-600">Completion</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-4 text-center">
          <p className="text-3xl font-extrabold text-accent">{completedFields}</p>
          <p className="text-sm font-semibold text-gray-600">Items Done</p>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="border-2 border-line rounded-xl bg-card p-4">
        <h2 className="font-bold text-lg mb-3">Daily Breakdown</h2>
        <div className="space-y-2">
          {entries.map((entry: any) => {
            const completed = entry.fields?.filter((f: any) => f.completed).length || 0;
            const total = entry.fields?.length || 0;
            const score = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <div key={entry.gregorianDate} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-gray-200">
                <div>
                  <span className="font-semibold">{entry.gregorianDate}</span>
                  {entry.hijriDay && (
                    <span className="text-xs text-gray-500 ml-2">
                      {formatHijriDate(entry.hijriDay, entry.hijriMonth, entry.hijriYear, getCurrentLocale())}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${score}%`,
                        backgroundColor: score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold w-16 text-right">{completed}/{total}</span>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && (
            <p className="text-gray-500 text-center py-4">No entries in this period.</p>
          )}
        </div>
      </div>

      {/* Field Details per Day */}
      {entries.map((entry: any) => {
        const checkboxFields = entry.fields?.filter((f: any) => f.fieldType === "checkbox") || [];
        const textFields = entry.fields?.filter((f: any) => f.fieldType === "textarea" || f.fieldType === "text") || [];
        return (
          <details key={`detail-${entry.gregorianDate}`} className="border-2 border-line rounded-xl bg-card overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 font-bold">
              {entry.gregorianDate} — {entry.fields?.filter((f: any) => f.completed).length}/{entry.fields?.length} items
            </summary>
            <div className="px-4 pb-4 space-y-3">
              {checkboxFields.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {checkboxFields.map((f: any) => (
                    <div key={f.fieldKey} className="flex items-center gap-2 text-sm">
                      <span className={f.completed ? "text-green-600" : "text-gray-400"}>{f.completed ? "✓" : "✗"}</span>
                      <span className={f.completed ? "" : "text-gray-400"}>{f.fieldKey.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              )}
              {textFields.length > 0 && (
                <div className="space-y-2">
                  {textFields.map((f: any) => (
                    <div key={f.fieldKey} className="bg-white rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase">{f.fieldKey.replace(/_/g, " ")}</p>
                      <p className="text-sm mt-1">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        );
      })}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 border-t border-dashed border-gray-300 pt-4">
        Generated by <span className="font-bold">Ramadan Tracker</span>
      </div>
    </div>
  );
}
