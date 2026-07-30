/**
 * Only rendered when the caller has already checked the account is active - matches
 * gating done again, independently, in app/download/xgis-addin/route.ts itself (this
 * component hiding the link is a convenience, not the actual access control). Styled as
 * a spotlight, not a plain utility card - xGIS is Homie's flagship agent, not a generic
 * "ArcGIS Pro Add-in" utility, so it gets billed as one of the best apps on the
 * platform rather than described by the plugin mechanism it happens to install as.
 */
export function AddinDownloadCard({ version }: { version: string | null }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5"
      style={{
        borderColor: "rgba(232,119,34,0.35)",
        background:
          "radial-gradient(circle at 0% 0%, rgba(232,119,34,0.14), transparent 55%), var(--surface)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
            style={{ backgroundColor: "#e87722" }}
          >
            x
          </div>
          <div>
            <p className="text-base font-semibold">xGIS</p>
            <p className="mt-0.5 text-sm text-foreground/60">
              Homie&apos;s flagship agent for ArcGIS Pro - turns plain-English requests
              into real geoprocessing work, live on your own map and project.
            </p>
            <p className="mt-1 text-xs text-foreground/40">
              {version ? `Version ${version}` : "No build published yet"} - installs
              automatically, no separate setup step.
            </p>
          </div>
        </div>
        {version && (
          <a
            href="/download/xgis-addin"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#e87722" }}
          >
            Download
          </a>
        )}
      </div>
      {version && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-foreground/60">
          <li>Unzip the download, close ArcGIS Pro if it&apos;s open, then run <strong>Install.bat</strong>.</li>
          <li>It registers xGIS and reopens ArcGIS Pro automatically - no click-through installer.</li>
          <li>You&apos;ll see a new xGIS tab on the ribbon.</li>
          <li>
            Click <strong>Settings</strong> on that tab and paste your Homie API key (shown
            above) to start chatting.
          </li>
        </ol>
      )}
    </div>
  );
}
