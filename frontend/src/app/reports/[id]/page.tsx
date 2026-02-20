"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportView from "@/components/ReportView";

export default function PrivateReportPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const id = params.id as string;
  const [report, setReport] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [owner, setOwner] = useState<any>(null);
  const [giftsReceived, setGiftsReceived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    if (!id) return;
    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch(`/reports/${id}`, { token });
      setReport(data.report);
      setEntries(data.entries || []);
      setOwner(data.owner);
      setGiftsReceived(data.giftsReceived || []);
    } catch (err: any) {
      setError(err.message || t("report.accessDenied"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-lg">{t("report.loading")}</div>;
  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="border-2 border-line rounded-2xl bg-card p-8">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-extrabold mb-2">{t("report.accessDenied")}</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  return <ReportView report={report} entries={entries} owner={owner} isPublic={false} giftsReceived={giftsReceived} />;
}
