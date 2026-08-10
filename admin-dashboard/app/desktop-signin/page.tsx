import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import type { Me } from "@/lib/types";
import { DesktopHandoff } from "./DesktopHandoff";

/**
 * Landing point for the xcrop desktop app's "Sign in" button (see
 * xcrop/desktop/electron/main.ts's openSignIn, which does shell.openExternal to here) -
 * completes a normal Clerk sign-in in the system browser, then hands the account's
 * existing Homie API key back to the desktop app via a custom-protocol redirect
 * (xcrop://auth-callback?key=...), the standard pattern desktop apps use for browser-based
 * OAuth-style sign-in (same idea VS Code/GitHub Desktop/Slack use, just with Clerk
 * standing in for a full OAuth provider).
 *
 * Deliberately GET /v1/my-api-key (fetch the existing/auto-provisioned key), not POST
 * /v1/my-api-key/issue (rotates it) - this account may already have that same key
 * configured elsewhere (the ArcGIS Pro Add-in, or xcrop on another machine); silently
 * invalidating it just because the user also signed in from xcrop's desktop app would be
 * a nasty surprise there.
 */
export default async function DesktopSignInPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=%2Fdesktop-signin");
  }

  let me: Me;
  let apiKey: string;
  try {
    const [meResult, keyResult] = await Promise.all([
      callBackend<Me>("/v1/me"),
      callBackend<{ api_key: string }>("/v1/my-api-key"),
    ]);
    me = meResult;
    apiKey = keyResult.api_key;
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  return <DesktopHandoff apiKey={apiKey} email={me.email} creditBalance={me.credit_balance} />;
}
