import type { ReactNode } from "react";

/** Shared branded backdrop for the sign-in/sign-up pages - these render outside the
 * authenticated header (no user yet), so they'd otherwise show Clerk's widget on a bare
 * page with zero Homie branding. The logo mark itself is NOT rendered here - it's
 * configured once on ClerkProvider (`appearance.layout.logoImageUrl` in app/layout.tsx)
 * so it shows up inside the Clerk card itself, rather than as a separate image floating
 * above it. */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col items-center justify-center gap-8 px-6 py-12"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(0,151,88,0.12), transparent 45%), radial-gradient(circle at 80% 0%, rgba(7,51,146,0.10), transparent 40%)",
      }}
    >
      {children}
    </div>
  );
}
