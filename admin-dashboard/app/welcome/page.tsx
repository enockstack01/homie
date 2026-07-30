import Image from "next/image";
import { redirect } from "next/navigation";
import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import type { Me } from "@/lib/types";
import { WelcomeChooser } from "./WelcomeChooser";

/**
 * Reached via /sign-up's forceRedirectUrl - every brand-new signup lands here, since
 * there is no standing "no organization" account type on this platform (see
 * backend/app/auth.py's role docstring): resolving one of these two ways is the
 * mandatory next step, not an optional path chosen at sign-up.
 */
export default async function WelcomePage() {
  let me: Me;
  try {
    me = await callBackend<Me>("/v1/me");
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  // Only a still-default brand-new signup (member, no org yet) has anything to resolve
  // here - anyone else (already in an org, or already some kind of admin) gets bounced
  // to "/", which already knows their real home (see app/page.tsx's HOME_BY_ROLE). Covers
  // a stray direct visit to this URL by someone who's already done this step.
  if (me.role !== "member" || me.organization_id) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-12 text-center">
      <Image src="/homie-icon.png" alt="Homie" width={48} height={48} className="h-12 w-12 rounded-md" priority />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set up your account</h1>
        <p className="mt-2 text-sm text-foreground/60">
          One more thing before you start - create your own organization, or join one
          you&apos;ve already been given the ID for.
        </p>
      </div>

      <div className="w-full rounded-xl border border-border bg-surface p-6 text-left">
        <WelcomeChooser />
      </div>
    </div>
  );
}
