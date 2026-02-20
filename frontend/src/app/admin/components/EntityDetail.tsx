"use client";

import { AdminEntityTab, ManagementDetail, formatDateTime } from "./adminTypes";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm py-0.5">
      <span className="font-medium text-gray-500 shrink-0 w-28">{label}</span>
      <span className="text-gray-800">{children}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{children}</p>;
}

function FamilyDetail({ data, familyTransferUserId, onTransferChange, familyRemoveUserId, onRemoveChange, onTransfer, onRemove, actionLoading }: {
  data: any;
  familyTransferUserId: string;
  onTransferChange: (v: string) => void;
  familyRemoveUserId: string;
  onRemoveChange: (v: string) => void;
  onTransfer: (id: string) => void;
  onRemove: (id: string) => void;
  actionLoading: string | null;
}) {
  const { family, members = [] } = data;
  const nonOwners = members.filter((m: any) => m.role !== "owner");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Family</SectionLabel>
          <InfoRow label="Name">{family.name}</InfoRow>
          <InfoRow label="Created">{formatDateTime(family.createdAt)}</InfoRow>
          <InfoRow label="Archived">{family.archivedAt ? formatDateTime(family.archivedAt) : "No"}</InfoRow>
        </div>
        <div>
          <SectionLabel>Owner</SectionLabel>
          <InfoRow label="Name">{family.ownerDisplayName}</InfoRow>
          <InfoRow label="Email">{family.ownerEmail}</InfoRow>
        </div>
      </div>

      {members.length > 0 && (
        <div>
          <SectionLabel>Members ({members.length})</SectionLabel>
          <div className="border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.userId} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.displayName}</div>
                      <div className="text-xs text-gray-400">{m.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${m.role === "owner" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${m.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(m.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border-t border-line pt-4 space-y-3">
        <SectionLabel>Admin Actions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600">Transfer Ownership To</label>
            <select
              value={familyTransferUserId}
              onChange={(e) => onTransferChange(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select new owner...</option>
              {nonOwners.map((m: any) => (
                <option key={m.userId} value={m.userId}>{m.displayName} ({m.email})</option>
              ))}
            </select>
            <button
              onClick={() => onTransfer(family.id)}
              disabled={!familyTransferUserId || actionLoading !== null}
              className="w-full px-3 py-2 border border-line rounded-xl text-sm disabled:opacity-40 hover:bg-gray-50 transition"
            >
              {actionLoading === "family-transfer" ? "Processing..." : "Transfer Ownership"}
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600">Remove Member</label>
            <select
              value={familyRemoveUserId}
              onChange={(e) => onRemoveChange(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select member to remove...</option>
              {nonOwners.map((m: any) => (
                <option key={m.userId} value={m.userId}>{m.displayName} ({m.email})</option>
              ))}
            </select>
            <button
              onClick={() => onRemove(family.id)}
              disabled={!familyRemoveUserId || actionLoading !== null}
              className="w-full px-3 py-2 border border-red-300 text-red-700 rounded-xl text-sm disabled:opacity-40 hover:bg-red-50 transition"
            >
              {actionLoading === "family-remove-member" ? "Processing..." : "Remove Member"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryDetail({ data }: { data: any }) {
  const { entry } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Entry</SectionLabel>
          <InfoRow label="Date">{entry.gregorianDate}</InfoRow>
          <InfoRow label="Status">
            <span className={`px-2 py-0.5 rounded text-xs ${entry.status === "locked" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              {entry.status}
            </span>
          </InfoRow>
          <InfoRow label="Updated">{formatDateTime(entry.updatedAt)}</InfoRow>
        </div>
        <div>
          <SectionLabel>User</SectionLabel>
          <InfoRow label="Name">{entry.userDisplayName}</InfoRow>
          <InfoRow label="Email">{entry.userEmail}</InfoRow>
        </div>
      </div>
      {entry.data && (
        <div>
          <SectionLabel>Entry Data</SectionLabel>
          <div className="bg-white border border-line rounded-xl p-3 overflow-x-auto max-h-48">
            <pre className="text-xs text-gray-700">{JSON.stringify(entry.data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ChallengeDetail({ data }: { data: any }) {
  const { challenge } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Challenge</SectionLabel>
          <InfoRow label="Title">{challenge.title}</InfoRow>
          <InfoRow label="Scope">
            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{challenge.scope}</span>
          </InfoRow>
          <InfoRow label="Active">
            <span className={`px-2 py-0.5 rounded text-xs ${challenge.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {challenge.active ? "Yes" : "No"}
            </span>
          </InfoRow>
          <InfoRow label="Created">{formatDateTime(challenge.createdAt)}</InfoRow>
        </div>
        <div>
          <SectionLabel>User</SectionLabel>
          <InfoRow label="Name">{challenge.userDisplayName}</InfoRow>
          <InfoRow label="Email">{challenge.userEmail}</InfoRow>
        </div>
      </div>
      {challenge.description && (
        <div>
          <SectionLabel>Description</SectionLabel>
          <p className="text-sm bg-white border border-line rounded-xl p-3">{challenge.description}</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-center">
        {([["Progress", challenge.progressCount ?? 0], ["Completed", challenge.completedCount ?? 0], ["Days Left", challenge.daysLeft ?? 0]] as [string, number][]).map(([label, val]) => (
          <div key={label} className="bg-white border border-line rounded-xl p-3">
            <div className="text-xl font-bold">{val}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportDetail({ data }: { data: any }) {
  const { report } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Report</SectionLabel>
          <InfoRow label="Period">{report.periodScope}</InfoRow>
          <InfoRow label="Start">{report.periodStart}</InfoRow>
          <InfoRow label="End">{report.periodEnd}</InfoRow>
          <InfoRow label="Visibility">
            <span className={`px-2 py-0.5 rounded text-xs ${report.visibility === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {report.visibility}
            </span>
          </InfoRow>
          <InfoRow label="Created">{formatDateTime(report.createdAt)}</InfoRow>
        </div>
        <div>
          <SectionLabel>Access & Stats</SectionLabel>
          <InfoRow label="Views">{report.accessCount}</InfoRow>
          <InfoRow label="Public Token">{report.hasPublicToken ? "Yes" : "No"}</InfoRow>
          <InfoRow label="Include Profile">{report.includeProfileInfo ? "Yes" : "No"}</InfoRow>
          <InfoRow label="Revoked">{report.revokedAt ? formatDateTime(report.revokedAt) : "No"}</InfoRow>
        </div>
      </div>
      <div>
        <SectionLabel>Owner</SectionLabel>
        <div className="bg-white border border-line rounded-xl p-3 space-y-1">
          <InfoRow label="Name">{report.ownerDisplayName}</InfoRow>
          <InfoRow label="Email">{report.ownerEmail}</InfoRow>
        </div>
      </div>
      {report.publicUrl && (
        <div>
          <SectionLabel>Public URL</SectionLabel>
          <a href={report.publicUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm break-all">
            {report.publicUrl}
          </a>
        </div>
      )}
    </div>
  );
}

interface Props {
  detail: ManagementDetail;
  familyTransferUserId: string;
  onTransferChange: (v: string) => void;
  familyRemoveUserId: string;
  onRemoveChange: (v: string) => void;
  onTransfer: (id: string) => void;
  onRemove: (id: string) => void;
  actionLoading: string | null;
}

export function EntityDetail({ detail, familyTransferUserId, onTransferChange, familyRemoveUserId, onRemoveChange, onTransfer, onRemove, actionLoading }: Props) {
  return (
    <div className="border-2 border-line rounded-xl p-4 space-y-4 bg-gray-50">
      <h3 className="font-bold text-base capitalize">{detail.tab.slice(0, -1)} Detail</h3>
      {detail.tab === "families" && detail.data?.family && (
        <FamilyDetail
          data={detail.data}
          familyTransferUserId={familyTransferUserId}
          onTransferChange={onTransferChange}
          familyRemoveUserId={familyRemoveUserId}
          onRemoveChange={onRemoveChange}
          onTransfer={onTransfer}
          onRemove={onRemove}
          actionLoading={actionLoading}
        />
      )}
      {detail.tab === "entries" && detail.data?.entry && <EntryDetail data={detail.data} />}
      {detail.tab === "challenges" && detail.data?.challenge && <ChallengeDetail data={detail.data} />}
      {detail.tab === "reports" && detail.data?.report && <ReportDetail data={detail.data} />}
    </div>
  );
}
