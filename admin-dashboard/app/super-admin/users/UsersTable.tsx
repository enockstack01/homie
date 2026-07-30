"use client";

import { useState } from "react";
import type { PlatformUser, UserStatus } from "@/lib/types";
import { ApiKeyDisplay } from "@/components/ApiKeyDisplay";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { GrantCreditsInlineForm } from "@/components/GrantCreditsInlineForm";
import { RevokeCreditsInlineForm } from "@/components/RevokeCreditsInlineForm";
import { Badge } from "@/components/ui/Badge";
import { STATUS_VARIANT } from "@/components/ui/statusVariants";
import {
  grantUserCreditsAction,
  issueUserApiKeyAction,
  revokeUserCreditsAction,
  viewUserApiKeyAction,
} from "../actions";
import { RoleStatusControls } from "@/components/RoleStatusControls";

/**
 * Every member is required to belong to an organization on this platform (see
 * backend/app/auth.py's role docstring) - there is no standing "no organization" account
 * type to show as its own section anymore. A member can still transiently have no
 * organization_id for the short window between signing in and completing the mandatory
 * /welcome registration step (see backend/app/routes/chat.py's register_organization),
 * so that state still needs a place to show up - "awaiting organization setup", not a
 * first-class account type - rather than being silently miscounted as an organization
 * member with no org name to display.
 */
function splitUsers(users: PlatformUser[]) {
  const platformStaff: PlatformUser[] = [];
  const awaitingSetup: PlatformUser[] = [];
  const organizationMembers: PlatformUser[] = [];

  for (const u of users) {
    if (u.role === "super_admin" || u.role === "platform_admin") {
      platformStaff.push(u);
    } else if (u.organization_id) {
      organizationMembers.push(u);
    } else {
      awaitingSetup.push(u);
    }
  }

  return { platformStaff, awaitingSetup, organizationMembers };
}

function UserRows({ users, showOrganization }: { users: PlatformUser[]; showOrganization: boolean }) {
  if (users.length === 0) {
    return (
      <tr>
        <td colSpan={showOrganization ? 5 : 4} className="px-4 py-6 text-center text-foreground/40">
          None.
        </td>
      </tr>
    );
  }

  return (
    <>
      {users.map((u) => (
        <tr key={u.id} className="border-b border-border/60 align-top last:border-0">
          <td className="px-4 py-3">
            {u.email ?? "—"}
            <div className="mt-1">
              <Badge variant={STATUS_VARIANT[u.status]}>{u.status}</Badge>
            </div>
          </td>
          {showOrganization && <td className="px-4 py-3">{u.organization_name ?? "—"}</td>}
          <td className="px-4 py-3 tabular-nums">{u.credit_balance.toLocaleString()}</td>
          <td className="px-4 py-3">
            <RoleStatusControls userId={u.id} currentRole={u.role} currentStatus={u.status} />
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-col gap-2">
              <GrantCreditsInlineForm action={grantUserCreditsAction} targetId={u.id} label="Grant credits" />
              <RevokeCreditsInlineForm
                action={revokeUserCreditsAction}
                targetId={u.id}
                hiddenFieldName="user_id"
                currentBalance={u.credit_balance}
              />
              <ApiKeyDisplay
                targetId={u.id}
                hasApiKeyInitially={u.has_api_key}
                viewAction={viewUserApiKeyAction}
                issueAction={issueUserApiKeyAction}
              />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function UserGroupTable({ users, showOrganization }: { users: PlatformUser[]; showOrganization: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-muted text-foreground/60">
          <tr>
            <th className="px-4 py-2 font-medium">Email</th>
            {showOrganization && <th className="px-4 py-2 font-medium">Organization</th>}
            <th className="px-4 py-2 font-medium">Balance</th>
            <th className="px-4 py-2 font-medium">Role / Status</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <UserRows users={users} showOrganization={showOrganization} />
        </tbody>
      </table>
    </div>
  );
}

export function UsersTable({ users }: { users: PlatformUser[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");

  const matches = (u: PlatformUser) => {
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${u.email ?? ""} ${u.role} ${u.organization_name ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  };

  const { platformStaff, awaitingSetup, organizationMembers } = splitUsers(users);
  const filteredStaff = platformStaff.filter(matches);
  const filteredAwaitingSetup = awaitingSetup.filter(matches);
  const filteredOrgMembers = organizationMembers.filter(matches);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search by email, role, or organization..."
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

      <CollapsibleSection title="Organization members" count={filteredOrgMembers.length} defaultOpen>
        <p className="mb-2 text-xs text-foreground/50">
          Belong to an organization and draw from that organization&apos;s shared credit pool.
        </p>
        <UserGroupTable users={filteredOrgMembers} showOrganization />
      </CollapsibleSection>

      <CollapsibleSection title="Awaiting organization setup" count={filteredAwaitingSetup.length}>
        <p className="mb-2 text-xs text-foreground/50">
          Signed in but haven&apos;t completed the mandatory organization-registration step yet.
        </p>
        <UserGroupTable users={filteredAwaitingSetup} showOrganization={false} />
      </CollapsibleSection>

      <CollapsibleSection title="Platform staff" count={filteredStaff.length}>
        <p className="mb-2 text-xs text-foreground/50">Super admins and platform admins.</p>
        <UserGroupTable users={filteredStaff} showOrganization={false} />
      </CollapsibleSection>
    </div>
  );
}
