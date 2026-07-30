import Link from "next/link";
import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { RevokeCreditsInlineForm } from "@/components/RevokeCreditsInlineForm";
import type { Organization, PlatformUser } from "@/lib/types";
import { revokeOrganizationCreditsAction } from "../../actions";
import { MembersDetailTable } from "./MembersDetailTable";
import { RenameOrganizationForm } from "./RenameOrganizationForm";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let orgs: Organization[];
  let users: PlatformUser[];
  try {
    [orgs, users] = await Promise.all([
      callBackend<Organization[]>("/v1/super-admin/organizations"),
      callBackend<PlatformUser[]>("/v1/super-admin/users"),
    ]);
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  const org = orgs.find((o) => o.id === id);
  if (!org) {
    return (
      <div className="rounded-md border border-border bg-surface p-4 text-sm text-foreground/60">
        Organization not found.{" "}
        <Link href="/super-admin/organizations" className="underline">
          Back to organizations
        </Link>
      </div>
    );
  }

  // Every member of this org, full stop: confirmed members (organization_id) AND people
  // invited by email who haven't accepted yet (pending_organization_id) - the same
  // completeness org_admin.list_members already gives that org's own admin. This
  // intentionally includes the org's own org_admin(s) too, unlike list_organizations'
  // member_count (a lighter capacity-style metric elsewhere) - a super_admin looking at
  // one specific org's full roster should see everyone who belongs to it.
  const members = users.filter((u) => u.organization_id === id || u.pending_organization_id === id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/super-admin/organizations" className="text-sm text-foreground/50 underline">
          ← Organizations
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <RenameOrganizationForm orgId={org.id} currentName={org.name} />
        </div>
        <p className="font-mono text-xs text-foreground/40">{org.org_id}</p>
        <p className="text-sm text-foreground/50">
          Unallocated pool: {org.credit_balance.toLocaleString()} credits · {members.length}{" "}
          {members.length === 1 ? "member" : "members"} · {org.profit_margin_percent}% margin
        </p>
        <p className="text-xs text-foreground/40">
          Credits waiting to be allocated to a member - not the same as what members
          already have below, which comes out of this pool as it&apos;s given out.
        </p>
        {org.credit_balance > 0 && (
          <div className="mt-2">
            <RevokeCreditsInlineForm
              action={revokeOrganizationCreditsAction}
              targetId={org.id}
              hiddenFieldName="org_id"
              currentBalance={org.credit_balance}
              label="Revoke unallocated pool"
            />
          </div>
        )}
      </div>

      <MembersDetailTable members={members} />
    </div>
  );
}
