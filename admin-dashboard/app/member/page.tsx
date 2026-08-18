import { BackendError, callBackend } from "@/lib/backend";
import { findLatestAddinRelease } from "@/lib/addinRelease";
import { AddinDownloadCard } from "@/components/AddinDownloadCard";
import { ApiKeyDisplay } from "@/components/ApiKeyDisplay";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ModelSelector } from "@/components/ModelSelector";
import { UsageLogsTable } from "@/components/UsageLogsTable";
import type { AvailableModel, Me, UsageLog } from "@/lib/types";
import { InvitationBanner } from "./InvitationBanner";
import { issueMyApiKeyAction, viewMyApiKeyAction } from "./actions";

export default async function MemberPage() {
  let me: Me;
  let logs: UsageLog[];
  let availableModels: AvailableModel[];
  try {
    [me, logs, availableModels] = await Promise.all([
      callBackend<Me>("/v1/me"),
      callBackend<UsageLog[]>("/v1/my-usage-logs"),
      callBackend<AvailableModel[]>("/v1/available-models"),
    ]);
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  const release = me.status === "active" ? await findLatestAddinRelease() : null;
  const approver = me.organization_name ? "your organization's admin" : "a platform admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">My Account</h1>
        <p className="text-sm text-foreground/50">{me.email}</p>
      </div>

      {me.pending_organization_name && (
        <InvitationBanner organizationName={me.pending_organization_name} />
      )}

      {me.status === "pending" && (
        <div className="rounded-md border border-accent/50 bg-accent-soft/50 p-4 text-black/80">
          <p className="font-medium">Waiting for approval</p>
          <p className="text-sm">{`Your account has been created, but ${approver} needs to approve it before you can be given credits or an API key. You'll be able to use Homie as soon as that happens - no action needed from you.`}</p>
        </div>
      )}

      {me.status === "active" && <AddinDownloadCard version={release?.version ?? null} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-foreground/50">Credit balance</p>
          <p className="text-2xl font-semibold tabular-nums">{me.credit_balance.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-foreground/50">Organization</p>
          <p className="text-lg font-medium">{me.organization_name ?? "Not yet registered"}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-foreground/50">Homie API key</p>
          <div className="mt-1">
            <ApiKeyDisplay
              targetId={me.id}
              hasApiKeyInitially={me.has_api_key}
              viewAction={viewMyApiKeyAction}
              issueAction={issueMyApiKeyAction}
            />
          </div>
          {!me.has_api_key && (
            <p className="mt-1 text-xs text-foreground/50">
              This is what you paste into Homie GIS&apos;s Settings tab, inside ArcGIS Pro, to
              sign in.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-xs text-foreground/50">Model</p>
        <p className="mb-2 text-xs text-foreground/40">
          Which model your API key uses for every chat request - credits are deducted at
          this model&apos;s rate.
        </p>
        <ModelSelector currentModelId={me.preferred_model_id} availableModels={availableModels} />
      </div>

      <CollapsibleSection title="Recent usage" count={logs.length}>
        <UsageLogsTable logs={logs} showUserColumn={false} />
      </CollapsibleSection>
    </div>
  );
}
