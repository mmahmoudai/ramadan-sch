"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, isLoggedIn, getUser } from "@/lib/auth";

export default function FamilyPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const token = getToken()!;
      const data: any = await apiFetch("/families", { token });
      setGroups(data.groups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const token = getToken()!;
      await apiFetch("/families", { method: "POST", token, body: JSON.stringify({ name: groupName }) });
      setGroupName("");
      setShowForm(false);
      loadGroups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const token = getToken()!;
      await apiFetch(`/families/${inviteGroupId}/invite`, { method: "POST", token, body: JSON.stringify({ email: inviteEmail }) });
      setInviteEmail("");
      setInviteGroupId("");
      setMessage("Invitation sent!");
      loadGroups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const acceptInvite = async (groupId: string) => {
    try {
      const token = getToken()!;
      await apiFetch(`/families/${groupId}/accept`, { method: "POST", token });
      loadGroups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const leaveGroup = async (groupId: string) => {
    if (!confirm("Leave this group?")) return;
    try {
      const token = getToken()!;
      await apiFetch(`/families/${groupId}/leave`, { method: "POST", token });
      loadGroups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const userId = getUser()?.id;

  if (loading) return <div className="text-center py-20 text-lg">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Family Groups</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-ink text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90">
          {showForm ? "Cancel" : "+ Create Group"}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">{message}</div>}

      {showForm && (
        <form onSubmit={createGroup} className="border-2 border-line rounded-xl bg-card p-4 flex gap-3">
          <input type="text" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required className="flex-1 border-2 border-line rounded-lg px-3 py-2" />
          <button type="submit" className="bg-accent text-white px-6 py-2 rounded-lg font-bold text-sm">Create</button>
        </form>
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const isOwner = g.ownerUserId === userId || g.ownerUserId?._id === userId;
          const myMember = g.members?.find((m: any) => (m.userId?._id || m.userId) === userId);
          const isPending = myMember?.status === "invited";

          return (
            <div key={g._id} className="border-2 border-line rounded-xl bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{g.name}</h3>
                  <p className="text-xs text-gray-500">{g.members?.length || 0} members</p>
                </div>
                <div className="flex gap-2">
                  {isPending && (
                    <button onClick={() => acceptInvite(g._id)} className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold">Accept Invite</button>
                  )}
                  {!isOwner && !isPending && (
                    <button onClick={() => leaveGroup(g._id)} className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold">Leave</button>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {g.members?.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                    <span className="font-semibold">{m.userId?.displayName || m.userId?.email || "User"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${m.role === "owner" ? "bg-accent/20 text-accent" : "bg-gray-100"}`}>{m.role}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${m.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{m.status}</span>
                  </div>
                ))}
              </div>

              {isOwner && (
                <form onSubmit={inviteMember} className="mt-3 flex gap-2">
                  <input type="email" placeholder="Invite by email" value={inviteGroupId === g._id ? inviteEmail : ""} onChange={(e) => { setInviteEmail(e.target.value); setInviteGroupId(g._id); }} className="flex-1 border border-line rounded-lg px-3 py-1.5 text-sm" />
                  <button type="submit" onClick={() => setInviteGroupId(g._id)} className="bg-ink text-white px-4 py-1.5 rounded-lg text-xs font-bold">Invite</button>
                </form>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-gray-500 text-center py-8">No family groups yet.</p>}
      </div>
    </div>
  );
}
