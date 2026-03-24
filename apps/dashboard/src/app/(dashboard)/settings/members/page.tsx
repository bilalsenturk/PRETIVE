"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/user-context";
import { Loader2, Check, UserPlus, Trash2, Clock, Mail } from "lucide-react";

interface Member {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  role: string;
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  sent_at: string;
}

const roles = ["admin", "member", "viewer"];

export default function MembersSettings() {
  const { user, loading: userLoading } = useUser();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [membersRes, invitesRes] = await Promise.all([
          fetch(`${apiBase}/api/organization/members`, {
            headers: { "x-user-id": user.id },
          }),
          fetch(`${apiBase}/api/organization/invitations`, {
            headers: { "x-user-id": user.id },
          }),
        ]);
        if (membersRes.ok) setMembers(await membersRes.json());
        if (invitesRes.ok) setInvitations(await invitesRes.json());
      } catch (e) {
        console.error("Failed to fetch members:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, apiBase]);

  const handleInvite = async () => {
    if (!user || !inviteEmail) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBase}/api/organization/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        const newInvite = await res.json();
        setInvitations((prev) => [...prev, newInvite]);
        setInviteEmail("");
        setToast("Invitation sent");
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error("Failed to send invite:", e);
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!user || !window.confirm("Remove this member?")) return;
    try {
      await fetch(`${apiBase}/api/organization/members/${memberId}`, {
        method: "DELETE",
        headers: { "x-user-id": user.id },
      });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setToast("Member removed");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      console.error("Failed to remove member:", e);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    if (!user) return;
    try {
      await fetch(`${apiBase}/api/organization/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ role }),
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
    } catch (e) {
      console.error("Failed to update role:", e);
    }
  };

  const getInitials = (name: string) =>
    name
      ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
      : "?";

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700 shadow-sm">
          <Check size={16} />
          {toast}
        </div>
      )}

      {/* Invite Section */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Invite Team Member
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={sending || !inviteEmail}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#D94228] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#C13920] disabled:opacity-50 whitespace-nowrap"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <UserPlus size={16} />
            )}
            Send Invite
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Team Members
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="p-6 pt-2 text-center text-sm text-gray-500">
            No team members yet. Send an invite to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.avatar_url}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D94228]/10 text-[#D94228] text-xs font-bold">
                            {getInitials(member.full_name)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {member.full_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.id, e.target.value)
                        }
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:border-[#D94228] focus:outline-none"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label={`Remove ${member.full_name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Pending Invitations
          </h2>
          <div className="space-y-3">
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50">
                    <Mail size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {invite.email}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {invite.role}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock size={12} />
                  Sent {new Date(invite.sent_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
