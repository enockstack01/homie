/**
 * Used by loading.tsx files (app/super-admin, app/org-admin, app/member, root app/) - the
 * Suspense fallback Next.js renders while a route segment's server component is still
 * awaiting the backend (see lib/backend's callBackend calls in each portal's page.tsx).
 * A Server Component itself (no "use client") - it's pure markup, no interactivity, so it
 * doesn't need to be one.
 */
export function PageLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-foreground/60">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
        role="status"
        aria-label={label}
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}
