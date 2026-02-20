"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportView from "@/components/ReportView";

export default function PublicReportPage() {
  const params = useParams();
  const { t } = useLanguage();
  const token = params.token as string;
  const [report, setReport] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [owner, setOwner] = useState<any>(null);
  const [giftsReceived, setGiftsReceived] = useState<any[]>([]);
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
      setGiftsReceived(data.giftsReceived || []);
    } catch (err: any) {
      setError(err.message || t("report.notFound"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-lg">{t("report.loading")}</div>;
  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="border-2 border-line rounded-2xl bg-card p-8">
        <div className="text-5xl mb-4">📋</div>
        <h1 className="text-2xl font-extrabold mb-2">{t("report.notFound")}</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );

  return <ReportView report={report} entries={entries} owner={owner} isPublic={true} giftsReceived={giftsReceived} />;
}
