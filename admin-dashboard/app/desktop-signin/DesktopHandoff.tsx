"use client";

import { useEffect, useState } from "react";

interface Props {
  apiKey: string;
  email: string | null;
  creditBalance: number;
}

/**
 * Client component so the actual xcrop:// navigation happens from a real browser context
 * (needed either way) and can also be retried from a genuine user click - some browsers
 * silently ignore a script-initiated custom-protocol navigation with no direct user
 * gesture behind it, so the auto-attempt on mount is a best-effort convenience, not the
 * only path; the button below is the reliable fallback, not a redundant afterthought.
 */
export function DesktopHandoff({ apiKey, email, creditBalance }: Props) {
  const [attempted, setAttempted] = useState(false);
  const callbackUrl = `xcrop://auth-callback?key=${encodeURIComponent(apiKey)}`;

  useEffect(() => {
    window.location.href = callbackUrl;
    setAttempted(true);
  }, [callbackUrl]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">🌱</div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">You&apos;re signed in</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {email ? `${email} — ` : ""}
          {creditBalance.toFixed(2)} credits available.
        </p>
      </div>

      <div className="w-full rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-foreground/70">
          {attempted
            ? "xcrop should be opening now. If nothing happened, click below:"
            : "Handing off to xcrop..."}
        </p>
        <a href={callbackUrl} className="mt-4 inline-block w-full">
          <button
            type="button"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Open xcrop
          </button>
        </a>
      </div>

      <p className="text-xs text-foreground/40">You can close this tab once xcrop opens.</p>
    </div>
  );
}
