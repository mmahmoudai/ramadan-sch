"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { AdminEntityTab, AdminUserDetailResponse, AdminUserRow, formatDateTime } from "./adminTypes";

interface Props {
  user: AdminUserRow;
  detail: AdminUserDetailResponse;
  initialTab?: AdminEntityTab;
  onClose: () => void;
  onFamilyArchive: (familyId: string) => void;
  onFamilyDelete: (familyId: string) => void;
  onChallengeAction: (challengeId: string, action: "archive" | "reactivate" | "delete") => void;
  onReportRevokePublic: (reportId: string) => void;
  onReportToggleVisibility: (reportId: string, next: "public" | "private") => void;
  onReportDelete: (reportId: string) => void;
  actionLoading: string | null;
}

function Btn({ children, onClick, variant = "default", disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "warn" | "danger" | "success";
  disabled?: boolean;
}) {
  const cls = {
    default: "border-gray-300 text-gray-700 hover:bg-gray-100",
    warn: "border-amber-300 text-amber-700 hover:bg-amber-50",
    danger: "border-red-300 text-red-700 hover:bg-red-50",
    success: "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-2 py-1 border rounded text-xs font-medium transition disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

const TABS: { key: AdminEntityTab; label: string }[] = [
  { key: "families", label: "Families" },
  { key: "entries", label: "Entries" },
  { key: "challenges", label: "Challenges" },
  { key: "reports", label: "Reports" },
];

export function UserEntitiesModal({
  user, detail, initialTab = "families", onClose,
  onFamilyArchive, onFamilyDelete,
  onChallengeAction, onReportRevokePublic, onReportToggleVisibility, onReportDelete,
  actionLoading,
}: Props) {
  const [activeTab, setActiveTab] = useState<AdminEntityTab>(initialTab);

  const { familyMemberships, recent } = detail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold">{user.displayName}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-gray-200">
          {TABS.map(({ key, label }) => {
            const count =
              key === "families" ? familyMemberships.length
              : key === "entries" ? recent.entries.length
              : key === "challenges" ? recent.challenges.length
              : recent.reports.length;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition ${
                  activeTab === key
                    ? "border-ink text-ink"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === key ? "bg-ink text-white" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Families ─────────────────────────────────────────────────── */}
          {activeTab === "families" && (
            familyMemberships.length === 0
              ? <p className="text-center text-gray-400 py-10">No family memberships.</p>
              : <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                      <th className="px-3 py-2">Family</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Members</th>
                      <th className="px-3 py-2">Joined</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMemberships.map((f) => (
                      <tr key={f.familyId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-semibold">{f.name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${f.role === "owner" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                            {f.role}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${f.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {f.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{f.memberCount}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(f.joinedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {f.role === "owner" && (
                              <>
                                <Btn variant="warn" disabled={actionLoading !== null} onClick={() => onFamilyArchive(f.familyId)}>Archive</Btn>
                                <Btn variant="danger" disabled={actionLoading !== null} onClick={() => onFamilyDelete(f.familyId)}>Delete</Btn>
                              </>
                            )}
                            {f.role !== "owner" && <span className="text-xs text-gray-400 italic">Member only</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}

          {/* ── Entries ──────────────────────────────────────────────────── */}
          {activeTab === "entries" && (
            recent.entries.length === 0
              ? <p className="text-center text-gray-400 py-10">No recent entries.</p>
              : <>
                  <p className="text-xs text-gray-400 mb-3">Showing {recent.entries.length} most recent entries. Total: {detail.metrics.entryCount}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.entries.map((e) => (
                        <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{e.gregorianDate}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${e.status === "locked" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(e.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
          )}

          {/* ── Challenges ───────────────────────────────────────────────── */}
          {activeTab === "challenges" && (
            recent.challenges.length === 0
              ? <p className="text-center text-gray-400 py-10">No recent challenges.</p>
              : <>
                  <p className="text-xs text-gray-400 mb-3">Showing {recent.challenges.length} most recent challenges. Total: {detail.metrics.challengeCount}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left">
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Scope</th>
                        <th className="px-3 py-2">Active</th>
                        <th className="px-3 py-2">Updated</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.challenges.map((c) => (
                        <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-semibold max-w-[180px] truncate" title={c.title}>{c.title}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{c.scope}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                              {c.active ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(c.updatedAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {c.active
                                ? <Btn variant="warn" disabled={actionLoading !== null} onClick={() => onChallengeAction(c.id, "archive")}>Archive</Btn>
                                : <Btn variant="success" disabled={actionLoading !== null} onClick={() => onChallengeAction(c.id, "reactivate")}>Reactivate</Btn>}
                              <Btn variant="danger" disabled={actionLoading !== null} onClick={() => onChallengeAction(c.id, "delete")}>Delete</Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
          )}

          {/* ── Reports ──────────────────────────────────────────────────── */}
          {activeTab === "reports" && (
            recent.reports.length === 0
              ? <p className="text-center text-gray-400 py-10">No reports found.</p>
              : <>
                  <p className="text-xs text-gray-400 mb-3">Showing {recent.reports.length} most recent reports. Total: {detail.metrics.reportCount}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left">
                        <th className="px-3 py-2">Period</th>
                        <th className="px-3 py-2">Scope</th>
                        <th className="px-3 py-2">Visibility</th>
                        <th className="px-3 py-2">Views</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.reports.map((r) => (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs font-mono">{r.periodStart} → {r.periodEnd}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{r.periodScope}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${r.visibility === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                              {r.visibility}
                            </span>
                            {r.revokedAt && <span className="ml-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Revoked</span>}
                          </td>
                          <td className="px-3 py-2">{r.accessCount}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {r.visibility === "public" && !r.revokedAt && (
                                <a
                                  href={`/reports/public/${r.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded text-xs font-medium transition"
                                >
                                  View <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <Btn variant="warn" disabled={actionLoading !== null} onClick={() => onReportRevokePublic(r.id)}>Revoke</Btn>
                              <Btn variant="success" disabled={actionLoading !== null}
                                onClick={() => onReportToggleVisibility(r.id, r.visibility === "public" ? "private" : "public")}>
                                {r.visibility === "public" ? "→ Private" : "→ Public"}
                              </Btn>
                              <Btn variant="danger" disabled={actionLoading !== null} onClick={() => onReportDelete(r.id)}>Delete</Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border-2 border-line rounded-xl text-sm font-semibold hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
