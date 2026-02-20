"use client";

import { X } from "lucide-react";
import { AdminUserDetailResponse, EditFormState, formatDateTime } from "./adminTypes";
import { useLanguage } from "@/contexts/LanguageContext";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line rounded-xl bg-card p-3 text-center">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

interface Props {
  detail: AdminUserDetailResponse;
  editForm: EditFormState;
  onEditFormChange: (patch: Partial<EditFormState>) => void;
  onClose: () => void;
  onSave: () => void;
  onToggleRole: () => void;
  onRevokeSessions: () => void;
  onTriggerPasswordReset: () => void;
  onDelete: () => void;
  actionLoading: string | null;
}

export function UserDetailPanel({
  detail, editForm, onEditFormChange, onClose,
  onSave, onToggleRole, onRevokeSessions, onTriggerPasswordReset, onDelete,
  actionLoading,
}: Props) {
  const { t } = useLanguage();
  const { user, metrics, entryStatus, visibilityApprovals, familyMemberships, recent } = detail;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-50 w-full max-w-2xl bg-white border-l-2 border-line shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold">{user.displayName}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {/* KPI row */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            <StatCard label={t("admin.entries")} value={metrics.entryCount} />
            <StatCard label={t("challenges.title")} value={metrics.challengeCount} />
            <StatCard label={t("reports.title")} value={metrics.reportCount} />
            <StatCard label={t("family.title")} value={metrics.familyMembershipCount} />
            <StatCard label="Sessions" value={metrics.refreshSessionCount} />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-line rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account</p>
              <div><span className="font-semibold">{t("admin.role")}:</span> <span className="ml-1">{user.role}</span></div>
              <div><span className="font-semibold">{t("admin.lang")}:</span> <span className="ml-1 uppercase">{user.language}</span></div>
              <div><span className="font-semibold">Timezone:</span> <span className="ml-1">{user.timezoneIana}</span></div>
              <div><span className="font-semibold">Last Activity:</span> <span className="ml-1 text-gray-500">{formatDateTime(metrics.lastActivityAt)}</span></div>
              <div><span className="font-semibold">Joined:</span> <span className="ml-1 text-gray-500">{formatDateTime(user.createdAt)}</span></div>
            </div>

            <div className="border border-line rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stats</p>
              <div><span className="font-semibold">Entries:</span> <span className="ml-1">{entryStatus.open} open / {entryStatus.locked} locked</span></div>
              <div><span className="font-semibold">Challenges:</span> <span className="ml-1">{metrics.activeChallengeCount} active / {metrics.inactiveChallengeCount} inactive</span></div>
              <div><span className="font-semibold">Visibility (owner):</span> <span className="ml-1">{visibilityApprovals.asOwner.approved} approved, {visibilityApprovals.asOwner.pending} pending</span></div>
              <div><span className="font-semibold">Visibility (viewer):</span> <span className="ml-1">{visibilityApprovals.asViewer.approved} approved, {visibilityApprovals.asViewer.pending} pending</span></div>
              <div><span className="font-semibold">Comments / Reactions:</span> <span className="ml-1">{metrics.commentCount} / {metrics.reactionCount}</span></div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="border border-line rounded-xl p-3">
              <p className="font-bold mb-2 text-xs uppercase tracking-wide text-gray-500">Recent Entries</p>
              <div className="space-y-1">
                {recent.entries.length === 0 && <p className="text-gray-400 text-xs">None</p>}
                {recent.entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs border border-line rounded-lg px-2 py-1">
                    <span>{e.gregorianDate}</span>
                    <span className={`px-1.5 py-0.5 rounded ${e.status === "locked" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-line rounded-xl p-3">
              <p className="font-bold mb-2 text-xs uppercase tracking-wide text-gray-500">Recent Challenges</p>
              <div className="space-y-1">
                {recent.challenges.length === 0 && <p className="text-gray-400 text-xs">None</p>}
                {recent.challenges.map((c) => (
                  <div key={c.id} className="text-xs border border-line rounded-lg px-2 py-1">
                    <div className="font-medium truncate">{c.title}</div>
                    <div className="text-gray-400">{c.scope} · {c.active ? "active" : "inactive"}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-line rounded-xl p-3">
              <p className="font-bold mb-2 text-xs uppercase tracking-wide text-gray-500">Families</p>
              <div className="space-y-1">
                {familyMemberships.length === 0 && <p className="text-gray-400 text-xs">None</p>}
                {familyMemberships.map((f) => (
                  <div key={f.familyId} className="text-xs border border-line rounded-lg px-2 py-1">
                    <div className="font-medium truncate">{f.name}</div>
                    <div className="text-gray-400">{f.role} · {f.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div className="border border-line rounded-xl p-4 space-y-3">
            <p className="font-bold text-sm">Edit User</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) => onEditFormChange({ displayName: e.target.value })}
                placeholder="Display name"
                className="border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                value={editForm.timezoneIana}
                onChange={(e) => onEditFormChange({ timezoneIana: e.target.value })}
                placeholder="Timezone IANA (e.g. Asia/Riyadh)"
                className="border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
              <select
                value={editForm.language}
                onChange={(e) => onEditFormChange({ language: e.target.value as "en" | "ar" | "tr" })}
                className="border border-line rounded-xl px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="tr">Turkish</option>
              </select>
              <select
                value={editForm.timezoneSource}
                onChange={(e) => onEditFormChange({ timezoneSource: e.target.value as "auto" | "manual" })}
                className="border border-line rounded-xl px-3 py-2 text-sm"
              >
                <option value="auto">Timezone: Auto</option>
                <option value="manual">Timezone: Manual</option>
              </select>
              <label className="flex items-center gap-2 text-sm col-span-1">
                <input
                  type="checkbox"
                  checked={editForm.reminderEnabled}
                  onChange={(e) => onEditFormChange({ reminderEnabled: e.target.checked })}
                  className="rounded"
                />
                Reminder enabled
              </label>
              <input
                type="text"
                value={editForm.reminderTimeLocal}
                onChange={(e) => onEditFormChange({ reminderTimeLocal: e.target.value })}
                placeholder="Reminder time (HH:MM)"
                className="border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
              <textarea
                value={editForm.bio}
                onChange={(e) => onEditFormChange({ bio: e.target.value })}
                placeholder="Bio"
                rows={3}
                className="md:col-span-2 border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              onClick={onSave}
              disabled={actionLoading !== null}
              className="bg-ink text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition"
            >
              {actionLoading === "save-user" ? t("common.loading") : t("common.save")}
            </button>
            <button
              onClick={onToggleRole}
              disabled={actionLoading !== null}
              className="px-4 py-2 rounded-xl border border-purple-300 text-purple-700 text-sm font-semibold disabled:opacity-50 hover:bg-purple-50 transition"
            >
              {user.role === "admin" ? t("admin.demote") : t("admin.promote")}
            </button>
            <button
              onClick={onRevokeSessions}
              disabled={actionLoading !== null}
              className="px-4 py-2 rounded-xl border border-amber-300 text-amber-700 text-sm font-semibold disabled:opacity-50 hover:bg-amber-50 transition"
            >
              Revoke Sessions
            </button>
            <button
              onClick={onTriggerPasswordReset}
              disabled={actionLoading !== null}
              className="px-4 py-2 rounded-xl border border-blue-300 text-blue-700 text-sm font-semibold disabled:opacity-50 hover:bg-blue-50 transition"
            >
              Trigger Reset
            </button>
            <button
              onClick={onDelete}
              disabled={actionLoading !== null}
              className="px-4 py-2 rounded-xl border border-red-300 text-red-700 text-sm font-semibold disabled:opacity-50 hover:bg-red-50 transition"
            >
              {t("admin.delete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
