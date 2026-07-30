import { BackendError, callBackend } from "@/lib/backend";
import { findLatestAddinRelease } from "@/lib/addinRelease";
import { AddinDownloadCard } from "@/components/AddinDownloadCard";
import { ApiKeyDisplay } from "@/components/ApiKeyDisplay";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { ModelSelector } from "@/components/ModelSelector";
import type { AvailableModel, Me, MyOrganization, OrgMember } from "@/lib/types";
import { issueMyApiKeyAction, viewMyApiKeyAction } from "../member/actions";
import { AddMemberForm } from "./AddMemberForm";
import { MembersTable } from "./MembersTable";
import { ProfitMarginForm } from "./ProfitMarginForm";

export default async function OrgAdminPage() {
  let me: Me;
  let org: MyOrganization;
  let members: OrgMember[];
  let availableModels: AvailableModel[];
  try {
    [me, org, members, availableModels] = await Promise.all([
      callBackend<Me>("/v1/me"),
      callBackend<MyOrganization>("/v1/org-admin/organization"),
      callBackend<OrgMember[]>("/v1/org-admin/members"),
      callBackend<AvailableModel[]>("/v1/available-models"),
    ]);
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  const release = me.status === "active" ? await findLatestAddinRelease() : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <p className="text-sm text-foreground/50">
            Unallocated pool: {org.credit_balance.toLocaleString()} credits
          </p>
          <p className="text-xs text-foreground/40">
            Credits waiting to be given out - allocating moves credits from here into a
            member&apos;s own balance below, so this number goes down as members&apos; balances go up.
          </p>
        </div>
        <AddMemberForm />
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-xs text-foreground/50">Your organization ID</p>
        <p className="mb-2 text-xs text-foreground/40">
          Share this with anyone who should join your organization - they enter it on
          their own /welcome screen after signing up, and show up below for you to
          approve.
        </p>
        <code className="inline-block rounded-md bg-surface-muted px-3 py-1.5 font-mono text-sm">
          {org.org_id}
        </code>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-xs text-foreground/50">Your profit margin</p>
        <p className="mb-2 text-xs text-foreground/40">
          Earn a percentage on top of Homie&apos;s own price for every credit your members
          spend - the extra amount is credited back into your organization&apos;s pool
          above, not sent anywhere else. 0% means no markup, same as not setting one.
        </p>
        <ProfitMarginForm currentMarginPercent={org.profit_margin_percent} />
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-xs text-foreground/50">Your Homie API key</p>
        <div className="mt-1">
          <ApiKeyDisplay
            targetId={me.id}
            hasApiKeyInitially={me.has_api_key}
            viewAction={viewMyApiKeyAction}
            issueAction={issueMyApiKeyAction}
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-xs text-foreground/50">Your model</p>
        <p className="mb-2 text-xs text-foreground/40">
          Which model your API key uses for every chat request - credits are deducted at
          this model&apos;s rate.
        </p>
        <ModelSelector currentModelId={me.preferred_model_id} availableModels={availableModels} />
      </div>

      {me.status === "active" && <AddinDownloadCard version={release?.version ?? null} />}

      <MembersTable members={members} myId={me.id} />
    </div>
  );
}
