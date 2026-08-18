import { BackendError, callBackend } from "@/lib/backend";
import { findLatestAddinRelease } from "@/lib/addinRelease";
import { AddinDownloadCard } from "@/components/AddinDownloadCard";
import { ApiKeyDisplay } from "@/components/ApiKeyDisplay";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { ModelSelector } from "@/components/ModelSelector";
import type { AvailableModel, Me } from "@/lib/types";
import { issueMyApiKeyAction, viewMyApiKeyAction } from "../../member/actions";

export default async function SuperAdminAccountPage() {
  let me: Me;
  let availableModels: AvailableModel[];
  try {
    [me, availableModels] = await Promise.all([
      callBackend<Me>("/v1/me"),
      callBackend<AvailableModel[]>("/v1/available-models"),
    ]);
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  const release = me.status === "active" ? await findLatestAddinRelease() : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">My Account</h1>
        <p className="text-sm text-foreground/50">{me.email}</p>
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
        {!me.has_api_key && (
          <p className="mt-1 text-xs text-foreground/50">
            Only needed if you plan to use Homie GIS yourself - most super admins won&apos;t.
          </p>
        )}
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
    </div>
  );
}
