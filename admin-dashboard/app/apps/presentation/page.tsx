import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { PresentationStudio } from "@/components/PresentationStudio";
import type { Me } from "@/lib/types";

/** Homie Presentation, running as a page inside admin-dashboard rather than its own
 * deployed app - see lib/apps.ts for why: it shares this dashboard's auth (Clerk session,
 * via PresentationStudio's calls to app/api/presentation/*), hosting, and deploy pipeline
 * instead of standing up a separate one. */
export default async function PresentationPage() {
  let me: Me;
  try {
    me = await callBackend<Me>("/v1/me");
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  const approver = me.organization_name ? "your organization's admin" : "a platform admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Homie Presentation</h1>
        <p className="text-sm text-foreground/50">
          Pick a template or generate one with AI, then edit it online - editing and
          exporting are free; AI generation and AI rewrites use your account&apos;s Homie
          credits.
        </p>
      </div>

      {me.status === "pending" && (
        <div className="rounded-md border border-accent/50 bg-accent-soft/50 p-4 text-black/80">
          <p className="font-medium">Waiting for approval</p>
          <p className="text-sm">{`Your account has been created, but ${approver} needs to approve it before any AI feature (generating an outline, or an AI rewrite) will work. Templates and the online editor are free and available right now regardless.`}</p>
        </div>
      )}

      <PresentationStudio />
    </div>
  );
}
