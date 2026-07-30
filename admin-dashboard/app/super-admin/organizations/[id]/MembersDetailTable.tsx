"use client";

import { useState } from "react";
import { ApiKeyDisplay } from "@/components/ApiKeyDisplay";
import { GrantCreditsInlineForm } from "@/components/GrantCreditsInlineForm";
import { RevokeCreditsInlineForm } from "@/components/RevokeCreditsInlineForm";
import { RoleStatusControls } from "@/components/RoleStatusControls";
import { Badge } from "@/components/ui/Badge";
import { STATUS_VARIANT } from "@/components/ui/statusVariants";
import type { PlatformUser, UserStatus } from "@/lib/types";
import {
  grantUserCreditsAction,
  issueUserApiKeyAction,
  revokeUserCreditsAction,
  viewUserApiKeyAction,
} from "../../actions";

export function MembersDetailTable({ members }: { members: PlatformUser[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");

  const filtered = members.filter((m) => {
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
              <th className="px-4 py-2 font-medium">Member&apos;s own balance</th>
              <th className="px-4 py-2 font-medium">Role / Status</th>
              <th className="px-4 py-2 font-medium">Grant credits directly</th>
              <th className="px-4 py-2 font-medium">API key</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-3">
                  {m.email ?? "—"}
                  <div className="mt-1">
                    <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{m.credit_balance.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <RoleStatusControls userId={m.id} currentRole={m.role} currentStatus={m.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <GrantCreditsInlineForm action={grantUserCreditsAction} targetId={m.id} label="Grant credits" />
                    <RevokeCreditsInlineForm
                      action={revokeUserCreditsAction}
                      targetId={m.id}
                      hiddenFieldName="user_id"
                      currentBalance={m.credit_balance}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ApiKeyDisplay
                    targetId={m.id}
                    hasApiKeyInitially={m.has_api_key}
                    viewAction={viewUserApiKeyAction}
                    issueAction={issueUserApiKeyAction}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-foreground/40">
                  {members.length === 0
                    ? "No members yet. Members are added from the Organization Admin portal once one is set for this org."
                    : "No members match your search or filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
