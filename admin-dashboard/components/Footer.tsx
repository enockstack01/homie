import Image from "next/image";
import Link from "next/link";

/**
 * Deliberately dark regardless of the active light/dark theme (see globals.css - this
 * hardcodes that same dark palette rather than the theme-reactive bg-surface/text-foreground
 * tokens, so it doesn't flip to a light footer just because the rest of the site is light).
 * Only rendered by app/layout.tsx for a signed-out visitor, so it only ever appears on the
 * pages a signed-out visitor can actually reach: "/" (LandingPage), "/sign-in", "/sign-up"
 * (see proxy.ts for that same route list). The "#xgis"/"#pricing"/"#roadmap"/"#paths"
 * links target section ids on LandingPage - from /sign-in or /sign-up they still resolve correctly
 * (Next navigates to "/" first, then the browser scrolls to the anchor).
 */
export function Footer() {
  const year = new Date().getFullYear();
  const bg = "#0b1210";
  const fg = "#eef5f1";
  const fgMuted = "rgba(238,245,241,0.6)";
  const fgFaint = "rgba(238,245,241,0.4)";
  const border = "#24352c";

  return (
    <footer style={{ backgroundColor: bg, color: fg }} className="mt-16">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <Image src="/homie-icon.png" alt="Homie" width={28} height={28} className="h-7 w-7 rounded-md" />
              <span className="text-base font-semibold tracking-tight">Homie</span>
            </div>
            <p className="mt-3 max-w-sm text-sm" style={{ color: fgMuted }}>
              Agentic AI power tools that autonomously carry out complex, time-consuming
              desktop work: spatial intelligence, data science, analytics, and more.
            </p>
            <Link
              href="/sign-up"
              className="mt-4 inline-flex rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#17b579" }}
            >
              Get started free
            </Link>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: fgFaint }}>
              Product
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <Link href="/" className="hover:underline" style={{ color: fgMuted }}>
                  Overview
                </Link>
              </li>
              <li>
                <Link href="/#xgis" className="hover:underline" style={{ color: fgMuted }}>
                  Meet xGIS
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:underline" style={{ color: fgMuted }}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#roadmap" className="hover:underline" style={{ color: fgMuted }}>
                  Roadmap
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: fgFaint }}>
              Get started
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <Link href="/sign-in" className="hover:underline" style={{ color: fgMuted }}>
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="hover:underline" style={{ color: fgMuted }}>
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/#paths" className="hover:underline" style={{ color: fgMuted }}>
                  Register your organization
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs sm:flex-row"
          style={{ borderColor: border, color: fgFaint }}
        >
          <p>© {year} Homie. All rights reserved.</p>
          <p>Powered by Logistack Ltd</p>
        </div>
      </div>
    </footer>
  );
}
