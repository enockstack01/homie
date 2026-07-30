import Image from "next/image";
import Link from "next/link";

const FEATURES = [
  {
    title: "Spatial Intelligence",
    description:
      "Buffer, clip, join, and transform geographic data by describing what you need, not which tool or in what order.",
  },
  {
    title: "Data Science",
    description:
      "Turn raw datasets into modeled, decision-ready insight without hand-authoring every transformation step.",
  },
  {
    title: "Analytics",
    description:
      "Ask for the number, the trend, or the summary, and get it back computed and explained in plain language.",
  },
];

const COMING_SOON = ["Data Science Agent", "Analytics Agent", "More desktop surfaces"];

const ORG_FEATURES = [
  {
    title: "Unlimited members",
    description:
      "Add as many teammates as you want at no extra cost - invite by email and manage every role from one dashboard.",
  },
  {
    title: "One shared credit pool",
    description:
      "Fund your organization once, then allocate credits out to individual members however you see fit.",
  },
  {
    title: "Set your own margin",
    description:
      "Add a profit margin (0-100%) on top of Homie's own price - the extra earned on every credit your members spend flows straight back into your own pool.",
  },
];

const CTA_PRIMARY =
  "rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover";
const CTA_SECONDARY =
  "rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted";

/**
 * Public marketing page, shown at "/" only to signed-out visitors (see proxy.ts, which
 * carves "/" out of the auth-required routes, and app/page.tsx, which still redirects a
 * signed-in visit straight to its role's home instead of showing this).
 */
export function LandingPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      <nav className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-2">
          <Image src="/homie-icon.png" alt="Homie" width={32} height={32} className="h-8 w-8 rounded-md" priority />
          <span className="text-lg font-semibold tracking-tight">Homie</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-foreground/70 hover:text-foreground">
            Sign in
          </Link>
          <Link href="/sign-up" className={CTA_PRIMARY}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl border border-border px-6 py-16 text-center sm:px-16"
        style={{
          background:
            "radial-gradient(circle at 15% 15%, rgba(0,151,88,0.16), transparent 45%), radial-gradient(circle at 85% 10%, rgba(7,51,146,0.14), transparent 45%), radial-gradient(circle at 50% 100%, rgba(248,183,18,0.14), transparent 50%)",
        }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Agentic AI, not just chat
        </span>
        <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Homie gives your desktop <span style={{ color: "#e87722" }}>superpowers.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-foreground/60 sm:text-lg">
          Homie houses a growing family of agentic AI power tools that autonomously carry
          out complex, time-consuming work: spatial intelligence, data science,
          analytics, and more. Describe the outcome you want, not the steps to get there.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up" className={CTA_PRIMARY}>
            Get started free
          </Link>
          <Link href="/sign-in" className={CTA_SECONDARY}>
            Sign in
          </Link>
        </div>
      </section>

      {/* What Homie is */}
      <section>
        <h2 className="text-center text-2xl font-bold tracking-tight">One assistant, an expanding toolbox</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-foreground/60">
          Every Homie agent shares the same core: it reads the real state of your work,
          acts directly inside the tools you already use, and asks before anything
          irreversible.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(232,119,34,0.12)" }}
              >
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: "#e87722" }} />
              </div>
              <p className="font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-foreground/60">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Meet xGIS */}
      <section
        id="xgis"
        className="grid grid-cols-1 items-center gap-10 rounded-2xl border border-border bg-surface p-8 lg:grid-cols-2 lg:p-12"
      >
        <div>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Available now
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Meet xGIS: Homie&apos;s first agent</h2>
          <p className="mt-3 text-sm text-foreground/60">
            xGIS lives inside ArcGIS Pro and turns plain-English requests into real
            geoprocessing work, buffering, clipping, dissolving, joining, symbolizing,
            and more, carried out directly on your live map and project.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-foreground/70">
            <li className="flex gap-2">
              <span className="text-primary">✓</span>
              No memorizing tool names or parameter order
            </li>
            <li className="flex gap-2">
              <span className="text-primary">✓</span>
              Reads your actual layers, fields, and map state before acting
            </li>
            <li className="flex gap-2">
              <span className="text-primary">✓</span>
              Every destructive change asks first, with a full audit trail after
            </li>
          </ul>
          <Link href="/sign-up" className={`${CTA_PRIMARY} mt-6 inline-flex`}>
            Try xGIS
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted p-4">
          <div className="flex flex-col gap-2 text-sm">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-primary px-3 py-2 text-white">
              Buffer the roads layer by 500 meters and add it as a new layer.
            </div>
            <div className="text-xs text-foreground/40">Running buffer_layer...</div>
            <div className="max-w-[85%] rounded-lg rounded-tl-none border border-border bg-surface px-3 py-2">
              Buffered <code className="rounded bg-foreground/10 px-1 font-mono text-xs">roads_layer</code> by
              500m → <code className="rounded bg-foreground/10 px-1 font-mono text-xs">roads_Buffer</code> added
              to the map.
            </div>
            <div className="text-xs text-foreground/40">42.15 credits remaining.</div>
          </div>
        </div>
      </section>

      {/* Coming soon */}
      <section id="roadmap" className="text-center">
        <h2 className="text-xl font-bold tracking-tight">More tools are coming</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-foreground/60">
          xGIS is only the start. The same agentic core is headed to more desktop work next.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {COMING_SOON.map((t) => (
            <span
              key={t}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-foreground/50"
            >
              {t} · coming soon
            </span>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing">
        <h2 className="text-center text-2xl font-bold tracking-tight">Simple, pay-as-you-go pricing</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-foreground/60">
          No subscription, no minimum commitment - fund your account with as little as
          $1 and start using every Homie agent right away.
        </p>
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground/50">Starting at</p>
          <p className="mt-1 text-5xl font-bold tracking-tight">
            $1<span className="text-lg font-medium text-foreground/50"> minimum</span>
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-foreground/60">
            Every dollar you add becomes <strong>1,000 Homie credits</strong>, usable
            immediately across every agent on the platform.
          </p>
          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
            {[
              { usd: "$1", credits: "1,000" },
              { usd: "$10", credits: "10,000" },
              { usd: "$50", credits: "50,000" },
            ].map((row) => (
              <div key={row.usd} className="rounded-lg border border-border bg-surface-muted p-3">
                <p className="font-semibold">{row.usd}</p>
                <p className="mt-1 text-xs text-foreground/50">{row.credits} credits</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-md text-xs text-foreground/40">
            Credits are spent per request at your chosen model&apos;s own rate - see your
            dashboard for exact per-model pricing once you&apos;re signed in.
          </p>
          <Link href="/sign-up" className={`${CTA_PRIMARY} mt-6 inline-flex`}>
            Get started free
          </Link>
        </div>
      </section>

      {/* How to get started */}
      <section id="paths">
        <h2 className="text-center text-2xl font-bold tracking-tight">Built for teams</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-foreground/60">
          Every account starts by registering an organization - and every organization
          can turn its own credit pool into its own business.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ORG_FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(0,151,88,0.12)" }}
              >
                <span className="h-4 w-4 rounded-full bg-primary" />
              </div>
              <p className="font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-foreground/60">{f.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <Link href="/sign-up" className={CTA_PRIMARY}>
            Register your organization
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="rounded-2xl bg-primary px-6 py-12 text-center text-white">
        <h2 className="text-2xl font-bold tracking-tight">Ready to put agentic AI to work?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
          Join Homie today and hand off the tasks you&apos;ve been putting off.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/sign-up"
            className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </section>
    </div>
  );
}
