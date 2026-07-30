"use client";

import { useState } from "react";
import { ApiKeyDisplay } from "@/components/ApiKeyDisplay";
import { Badge } from "@/components/ui/Badge";
import { ROLE_VARIANT } from "@/components/ui/statusVariants";
import type { OrgMember, Role } from "@/lib/types";
import { issueMemberApiKeyAction, viewMemberApiKeyAction } from "./actions";
import { AllocateCreditsForm } from "./AllocateCreditsForm";
import { MemberStatusControl } from "./MemberStatusControl";
import { ReclaimCreditsForm } from "./ReclaimCreditsForm";
import { RemoveMemberButton } from "./RemoveMemberButton";

export function MembersTable({ members, myId }: { members: OrgMember[]; myId: string }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OrgMember["status"]>("all");

  const filtered = members.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (!query.trim()) return true;
    return (m.email ?? "").toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search by email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All roles</option>
          <option value="member">Member</option>
          <option value="org_admin">Org admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-foreground/60">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Member&apos;s own balance</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-3">{m.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={ROLE_VARIANT[m.role]}>{m.role.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3 tabular-nums">{m.credit_balance.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {!m.invite_accepted ? (
                    <Badge variant="warning">Invited - awaiting response</Badge>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <MemberStatusControl memberId={m.id} currentStatus={m.status} />
                      {m.status === "pending" && (
                        <span className="text-xs text-foreground/40">
                          Awaiting your approval - set to Active above
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    {m.invite_accepted && (
                      <>
                        {/* An org_admin allocates/reclaims the shared pool to/from *other*
                            members - not themselves, even though they show up in their
                            own members list. Enforced server-side too, not just hidden here. */}
                        {m.id !== myId && (
                          <>
                            <AllocateCreditsForm memberId={m.id} />
                            <ReclaimCreditsForm memberId={m.id} memberBalance={m.credit_balance} />
                          </>
                        )}
                        <ApiKeyDisplay
                          targetId={m.id}
                          hasApiKeyInitially={m.has_api_key}
                          viewAction={viewMemberApiKeyAction}
                          issueAction={issueMemberApiKeyAction}
                        />
                      </>
                    )}
                    {m.role !== "org_admin" && (
                      <RemoveMemberButton memberId={m.id} label={m.invite_accepted ? "Remove" : "Cancel invite"} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-foreground/40">
                  {members.length === 0 ? "No members yet - add one by email above." : "No members match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
