"use client";

import { AdminEntityTab, AdminFamilyRow, AdminEntryRow, AdminChallengeRow, AdminReportRow } from "./adminTypes";
import { useLanguage } from "@/contexts/LanguageContext";

function ActionBtn({ children, onClick, variant = "default", disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "warn" | "danger" | "success";
  disabled?: boolean;
}) {
  const cls = {
    default: "border-line text-gray-700 hover:bg-gray-100",
    warn: "border-amber-300 text-amber-700 hover:bg-amber-50",
    danger: "border-red-300 text-red-700 hover:bg-red-50",
    success: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 border rounded text-xs font-medium transition disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

interface Props {
  activeTab: AdminEntityTab;
  families: AdminFamilyRow[];
  entries: AdminEntryRow[];
  challenges: AdminChallengeRow[];
  reports: AdminReportRow[];
  loading: boolean;
  actionLoading: string | null;
  onView: (tab: AdminEntityTab, id: string) => void;
  onFamilyArchive: (id: string) => void;
  onFamilyDelete: (id: string) => void;
  onChallengeAction: (id: string, action: "archive" | "reactivate" | "delete") => void;
  onReportRevokePublic: (id: string) => void;
  onReportToggleVisibility: (id: string, next: "public" | "private") => void;
  onReportDelete: (id: string) => void;
}

export function EntityTable({
  activeTab, families, entries, challenges, reports,
  loading, actionLoading,
  onView, onFamilyArchive, onFamilyDelete,
  onChallengeAction, onReportRevokePublic, onReportToggleVisibility, onReportDelete,
}: Props) {
  const { t } = useLanguage();

  return (
    <div className="overflow-x-auto border border-line rounded-xl">
      <table className="w-full text-sm">
        <thead>
          {activeTab === "families" && (
            <tr className="bg-gray-50 border-b border-line text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Members</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          )}
          {activeTab === "entries" && (
            <tr className="bg-gray-50 border-b border-line text-left">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Completed</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          )}
          {activeTab === "challenges" && (
            <tr className="bg-gray-50 border-b border-line text-left">
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          )}
          {activeTab === "reports" && (
            <tr className="bg-gray-50 border-b border-line text-left">
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2">Views</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          )}
        </thead>
        <tbody>
          {loading ? (
            <tr><td className="px-3 py-8 text-center text-gray-400" colSpan={5}>{t("common.loading")}</td></tr>
          ) : activeTab === "families" ? (
            families.length === 0
              ? <tr><td className="px-3 py-8 text-center text-gray-400" colSpan={5}>No families found.</td></tr>
              : families.map((f) => (
                <tr key={f.id} className="border-b border-line hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold">{f.name}</td>
                  <td className="px-3 py-2">
                    <div>{f.ownerDisplayName}</div>
                    <div className="text-xs text-gray-400">{f.ownerEmail}</div>
                  </td>
                  <td className="px-3 py-2">{f.memberCount}</td>
                  <td className="px-3 py-2">
                    {f.archivedAt
                      ? <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Archived</span>
                      : <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Active</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <ActionBtn onClick={() => onView("families", f.id)}>View</ActionBtn>
                      {!f.archivedAt && <ActionBtn variant="warn" onClick={() => onFamilyArchive(f.id)}>Archive</ActionBtn>}
                      <ActionBtn variant="danger" onClick={() => onFamilyDelete(f.id)}>Delete</ActionBtn>
                    </div>
                  </td>
                </tr>
              ))
          ) : activeTab === "entries" ? (
            entries.length === 0
              ? <tr><td className="px-3 py-8 text-center text-gray-400" colSpan={5}>No entries found.</td></tr>
              : entries.map((e) => (
                <tr key={e.id} className="border-b border-line hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{e.gregorianDate}</td>
                  <td className="px-3 py-2">
                    <div>{e.userDisplayName}</div>
                    <div className="text-xs text-gray-400">{e.userEmail}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${e.status === "locked" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{e.completedFields}/{e.totalFields}</td>
                  <td className="px-3 py-2">
                    <ActionBtn onClick={() => onView("entries", e.id)}>View</ActionBtn>
                  </td>
                </tr>
              ))
          ) : activeTab === "challenges" ? (
            challenges.length === 0
              ? <tr><td className="px-3 py-8 text-center text-gray-400" colSpan={5}>No challenges found.</td></tr>
              : challenges.map((c) => (
                <tr key={c.id} className="border-b border-line hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold max-w-[180px] truncate" title={c.title}>{c.title}</td>
                  <td className="px-3 py-2">
                    <div>{c.userDisplayName}</div>
                    <div className="text-xs text-gray-400">{c.userEmail}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{c.scope}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {c.active ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <ActionBtn onClick={() => onView("challenges", c.id)}>View</ActionBtn>
                      {c.active
                        ? <ActionBtn variant="warn" onClick={() => onChallengeAction(c.id, "archive")}>Archive</ActionBtn>
                        : <ActionBtn variant="success" onClick={() => onChallengeAction(c.id, "reactivate")}>Reactivate</ActionBtn>}
                      <ActionBtn variant="danger" onClick={() => onChallengeAction(c.id, "delete")}>Delete</ActionBtn>
                    </div>
                  </td>
                </tr>
              ))
          ) : (
            reports.length === 0
              ? <tr><td className="px-3 py-8 text-center text-gray-400" colSpan={5}>No reports found.</td></tr>
              : reports.map((r) => (
                <tr key={r.id} className="border-b border-line hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div>{r.ownerDisplayName}</div>
                    <div className="text-xs text-gray-400">{r.ownerEmail}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.periodStart} → {r.periodEnd}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${r.visibility === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {r.visibility}
                    </span>
                    {r.revokedAt && <span className="ml-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Revoked</span>}
                  </td>
                  <td className="px-3 py-2">{r.accessCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <ActionBtn onClick={() => onView("reports", r.id)}>View</ActionBtn>
                      <ActionBtn variant="warn" onClick={() => onReportRevokePublic(r.id)}>Revoke</ActionBtn>
                      <ActionBtn variant="success" onClick={() => onReportToggleVisibility(r.id, r.visibility === "public" ? "private" : "public")}>
                        {r.visibility === "public" ? "→ Private" : "→ Public"}
                      </ActionBtn>
                      <ActionBtn variant="danger" onClick={() => onReportDelete(r.id)}>Delete</ActionBtn>
                    </div>
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
}
