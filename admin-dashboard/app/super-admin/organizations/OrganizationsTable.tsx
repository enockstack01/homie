"use client";

import { useState } from "react";
import Link from "next/link";
import { GrantCreditsInlineForm } from "@/components/GrantCreditsInlineForm";
import { RevokeCreditsInlineForm } from "@/components/RevokeCreditsInlineForm";
import type { Organization } from "@/lib/types";
import { fundOrganizationAction, revokeOrganizationCreditsAction } from "../actions";

export function OrganizationsTable({ orgs }: { orgs: Organization[] }) {
  const [query, setQuery] = useState("");

  const filtered = orgs.filter((org) => org.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Search by organization name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-foreground/60">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Members</th>
              <th className="px-4 py-2 font-medium">Unallocated pool</th>
              <th className="px-4 py-2 font-medium">Margin</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((org) => (
              <tr key={org.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/super-admin/organizations/${org.id}`}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    {org.name}
                  </Link>
                  <p className="font-mono text-xs text-foreground/40">{org.org_id}</p>
                </td>
                <td className="px-4 py-3">{org.member_count}</td>
                <td className="px-4 py-3 tabular-nums">{org.credit_balance.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums">{org.profit_margin_percent}%</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <GrantCreditsInlineForm action={fundOrganizationAction} targetId={org.id} label="Fund" />
                    <RevokeCreditsInlineForm
                      action={revokeOrganizationCreditsAction}
                      targetId={org.id}
                      hiddenFieldName="org_id"
                      currentBalance={org.credit_balance}
                      label="Revoke pool"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-foreground/40">
                  {orgs.length === 0 ? "No organizations yet." : "No organizations match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
