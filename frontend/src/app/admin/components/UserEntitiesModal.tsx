"use client";

import { useState } from "react";
import { X, ExternalLink, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { AdminEntityTab, AdminUserDetailResponse, AdminUserRow, formatDateTime } from "./adminTypes";

interface FamilyMember {
  userId: string;
  displayName: string;
  email: string;
  role: "owner" | "member";
  status: "invited" | "active";
  joinedAt: string;
}

interface FamilyDetail {
  family: { id: string; name: string; archivedAt: string | null };
  members: FamilyMember[];
}

interface Props {
  user: AdminUserRow;
  detail: AdminUserDetailResponse;
  initialTab?: AdminEntityTab;
  onClose: () => void;
  onFamilyArchive: (familyId: string) => void;
  onFamilyDelete: (familyId: string) => void;
  onFamilyTransferOwnership: (familyId: string, newOwnerUserId: string, reason: string) => Promise<void>;
  onFamilyRemoveMember: (familyId: string, memberUserId: string, reason: string) => Promise<void>;
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
  onFamilyArchive, onFamilyDelete, onFamilyTransferOwnership, onFamilyRemoveMember,
  onChallengeAction, onReportRevokePublic, onReportToggleVisibility, onReportDelete,
  actionLoading,
}: Props) {
  const [activeTab, setActiveTab] = useState<AdminEntityTab>(initialTab);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [familyDetails, setFamilyDetails] = useState<Record<string, FamilyDetail>>({});
  const [familyLoading, setFamilyLoading] = useState<string | null>(null);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});
  const [transferReason, setTransferReason] = useState<Record<string, string>>({});
  const [removeReason, setRemoveReason] = useState<Record<string, Record<string, string>>>({});
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);

  const { familyMemberships, recent } = detail;

  const toggleFamily = async (familyId: string) => {
    if (expandedFamily === familyId) { setExpandedFamily(null); return; }
    setExpandedFamily(familyId);
    if (familyDetails[familyId]) return;
    try {
      setFamilyLoading(familyId);
      setFamilyError(null);
      const token = getToken()!;
      const data = await apiFetch<FamilyDetail>(`/admin/families/${familyId}`, { token });
      setFamilyDetails((prev) => ({ ...prev, [familyId]: data }));
    } catch (err: any) {
      setFamilyError(err.message || "Failed to load family members");
    } finally {
      setFamilyLoading(null);
    }
  };

  const refreshFamily = async (familyId: string) => {
    try {
      const token = getToken()!;
      const data = await apiFetch<FamilyDetail>(`/admin/families/${familyId}`, { token });
      setFamilyDetails((prev) => ({ ...prev, [familyId]: data }));
    } catch { /* silent */ }
  };

  const handleTransfer = async (familyId: string) => {
    const newOwner = transferTarget[familyId]?.trim();
    const reason = transferReason[familyId]?.trim();
    if (!newOwner || !reason || reason.length < 3) return;
    try {
      setMemberActionLoading(`transfer-${familyId}`);
      await onFamilyTransferOwnership(familyId, newOwner, reason);
      setTransferTarget((p) => ({ ...p, [familyId]: "" }));
      setTransferReason((p) => ({ ...p, [familyId]: "" }));
      await refreshFamily(familyId);
    } finally { setMemberActionLoading(null); }
  };

  const handleRemove = async (familyId: string, memberId: string) => {
    const reason = removeReason[familyId]?.[memberId]?.trim();
    if (!reason || reason.length < 3) return;
    try {
      setMemberActionLoading(`remove-${familyId}-${memberId}`);
      await onFamilyRemoveMember(familyId, memberId, reason);
      setRemoveReason((p) => ({ ...p, [familyId]: { ...p[familyId], [memberId]: "" } }));
      await refreshFamily(familyId);
    } finally { setMemberActionLoading(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

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
                  activeTab === key ? "border-ink text-ink" : "border-transparent text-gray-500 hover:text-gray-700"
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
              : <div className="space-y-3">
                  {familyError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{familyError}</p>}
                  {familyMemberships.map((f) => {
                    const isExpanded = expandedFamily === f.familyId;
                    const fd = familyDetails[f.familyId];
                    const isLoadingThis = familyLoading === f.familyId;
                    return (
                      <div key={f.familyId} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Family row */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{f.name}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${f.role === "owner" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>{f.role}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${f.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{f.status}</span>
                              <span className="text-xs text-gray-500">{f.memberCount} members</span>
                              <span className="text-xs text-gray-400">Joined {formatDateTime(f.joinedAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {f.role === "owner" && (
                              <>
                                <Btn variant="warn" disabled={actionLoading !== null} onClick={() => onFamilyArchive(f.familyId)}>Archive</Btn>
                                <Btn variant="danger" disabled={actionLoading !== null} onClick={() => onFamilyDelete(f.familyId)}>Delete</Btn>
                              </>
                            )}
                            <button
                              onClick={() => toggleFamily(f.familyId)}
                              className="flex items-center gap-1 px-3 py-1 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded text-xs font-medium transition"
                            >
                              {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {isExpanded ? "Hide" : "Members"}
                            </button>
                          </div>
                        </div>

                        {/* Expanded members panel */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-white">
                            {isLoadingThis ? (
                              <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading members...
                              </div>
                            ) : fd ? (
                              <div className="p-4 space-y-4">
                                {/* Members table */}
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                                      <th className="px-3 py-2">Member</th>
                                      <th className="px-3 py-2">Role</th>
                                      <th className="px-3 py-2">Status</th>
                                      <th className="px-3 py-2">Joined</th>
                                      <th className="px-3 py-2">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {fd.members.map((m) => (
                                      <tr key={m.userId} className="border-b border-gray-100">
                                        <td className="px-3 py-2">
                                          <div className="font-medium">{m.displayName}</div>
                                          <div className="text-xs text-gray-400">{m.email}</div>
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-0.5 rounded text-xs ${m.role === "owner" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>{m.role}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-0.5 rounded text-xs ${m.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{m.status}</span>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(m.joinedAt)}</td>
                                        <td className="px-3 py-2">
                                          {m.role !== "owner" ? (
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="text"
                                                placeholder="Reason (min 3 chars)"
                                                value={removeReason[f.familyId]?.[m.userId] ?? ""}
                                                onChange={(e) => setRemoveReason((p) => ({ ...p, [f.familyId]: { ...p[f.familyId], [m.userId]: e.target.value } }))}
                                                className="border border-gray-200 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-red-300"
                                              />
                                              <Btn
                                                variant="danger"
                                                disabled={memberActionLoading !== null || !removeReason[f.familyId]?.[m.userId]?.trim() || (removeReason[f.familyId]?.[m.userId]?.trim().length ?? 0) < 3}
                                                onClick={() => handleRemove(f.familyId, m.userId)}
                                              >
                                                {memberActionLoading === `remove-${f.familyId}-${m.userId}` ? "..." : "Remove"}
                                              </Btn>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-gray-400 italic">Owner</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {/* Transfer ownership */}
                                <div className="border-t border-gray-100 pt-3">
                                  <p className="text-xs font-semibold text-gray-600 mb-2">Transfer Ownership</p>
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <select
                                      value={transferTarget[f.familyId] ?? ""}
                                      onChange={(e) => setTransferTarget((p) => ({ ...p, [f.familyId]: e.target.value }))}
                                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-300"
                                    >
                                      <option value="">Select new owner...</option>
                                      {fd.members.filter((m) => m.role !== "owner" && m.status === "active").map((m) => (
                                        <option key={m.userId} value={m.userId}>{m.displayName} ({m.email})</option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Reason (min 3 chars)"
                                      value={transferReason[f.familyId] ?? ""}
                                      onChange={(e) => setTransferReason((p) => ({ ...p, [f.familyId]: e.target.value }))}
                                      className="border border-gray-200 rounded px-2 py-1 text-xs w-44 focus:outline-none focus:border-blue-300"
                                    />
                                    <Btn
                                      variant="default"
                                      disabled={memberActionLoading !== null || !transferTarget[f.familyId] || !transferReason[f.familyId]?.trim() || (transferReason[f.familyId]?.trim().length ?? 0) < 3}
                                      onClick={() => handleTransfer(f.familyId)}
                                    >
                                      {memberActionLoading === `transfer-${f.familyId}` ? "..." : "Transfer"}
                                    </Btn>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
