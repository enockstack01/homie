import { BackendError, callBackend } from "@/lib/backend";
import { findLatestAddinRelease } from "@/lib/addinRelease";
import { AddinDownloadCard } from "@/components/AddinDownloadCard";
import { AppCard } from "@/components/AppCard";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { HOMIE_APPS } from "@/lib/apps";
import type { Me } from "@/lib/types";

/**
 * "Homie Applications" - reachable from every role's nav (see app/layout.tsx's
 * NAV_BY_ROLE), unlike the rest of member/org-admin/super-admin which are role-scoped.
 * Homie GIS gets its full real download flow (AddinDownloadCard, gated on account status
 * the same way app/member/page.tsx already gates it); a web app with a `path` (see
 * lib/apps.ts) gets an "Open" link straight to its page inside this dashboard; anything
 * else without a distribution pipeline yet renders as "Coming soon" with no action,
 * rather than a dead or fabricated link.
 */
export default async function AppsPage() {
  let me: Me;
  try {
    me = await callBackend<Me>("/v1/me");
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  const xgisRelease = me.status === "active" ? await findLatestAddinRelease() : null;
  const approver = me.organization_name ? "your organization's admin" : "a platform admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Homie Applications</h1>
        <p className="text-sm text-foreground/50">
          Every agentic tool built on the Homie platform, in one place.
        </p>
      </div>

      {me.status === "pending" && (
        <div className="rounded-md border border-accent/50 bg-accent-soft/50 p-4 text-black/80">
          <p className="font-medium">Waiting for approval</p>
          <p className="text-sm">{`Your account has been created, but ${approver} needs to approve it before you can download desktop apps or get an API key. You'll be able to use every Homie application as soon as that happens.`}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {HOMIE_APPS.map((app) =>
          // AddinDownloadCard is Homie GIS's own real, status-gated download flow (same
          // component and same gate as app/member/page.tsx) - only swapped in once the
          // account is active, so a pending/banned account never sees a broken "Download"
          // button; it falls back to the plain, action-less card like every other app.
          app.id === "homie-gis" && me.status === "active" ? (
            <AddinDownloadCard key={app.id} version={xgisRelease?.version ?? null} />
          ) : (
            <AppCard
              key={app.id}
              app={app}
              action={app.path ? { label: "Open", href: app.path } : undefined}
            />
          ),
        )}
      </div>
    </div>
  );
}
