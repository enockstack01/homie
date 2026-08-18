import type { HomieApp } from "@/lib/apps";

interface Props {
  app: HomieApp;
  /** Homie GIS's card renders its own real download flow (AddinDownloadCard, backed by a live
   * GitHub Releases lookup) instead of this - passed in rather than special-cased here so
   * this component stays a dumb renderer of the registry, not aware of any one app's
   * distribution mechanism. */
  action?: { label: string; href: string };
}

export function AppCard({ app, action }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5"
      style={{
        borderColor: `${app.color}59`,
        background: `radial-gradient(circle at 0% 0%, ${app.color}24, transparent 55%), var(--surface)`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
            style={{ backgroundColor: app.color }}
          >
            {app.glyph}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold">{app.name}</p>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={
                  app.status === "available"
                    ? { backgroundColor: "rgba(0,151,88,0.12)", color: "var(--primary)" }
                    : { backgroundColor: "var(--surface-muted)", color: "var(--foreground)", opacity: 0.6 }
                }
              >
                {app.status === "available" ? "Available now" : "Coming soon"}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-foreground/70">{app.tagline}</p>
            <p className="mt-1.5 text-sm text-foreground/60">{app.description}</p>
            <p className="mt-2 text-xs text-foreground/40">
              {app.surface === "desktop" ? "Desktop app" : "Web app"}
            </p>
          </div>
        </div>
        {action && (
          <a
            href={action.href}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: app.color }}
          >
            {action.label}
          </a>
        )}
      </div>
    </div>
  );
}
