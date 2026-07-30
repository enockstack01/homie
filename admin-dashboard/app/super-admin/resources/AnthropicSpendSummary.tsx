import type { AnthropicSpend, SpendTotals } from "@/lib/types";

// Locale pinned to "en-US" (not the runtime default) so this renders identically during
// SSR (Node's default locale) and client hydration (the browser's default locale) -
// otherwise "$5.00" vs "US$5.00" is a real hydration mismatch, not just a style choice.
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-foreground/50">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TotalsRow({ heading, totals }: { heading: string; totals: SpendTotals }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-foreground/60">{heading}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Anthropic cost" value={usd(totals.anthropic_cost_usd)} />
        <Stat label="Billed to users" value={usd(totals.billed_to_users_usd)} />
        <Stat label="Realized margin" value={usd(totals.realized_margin_usd)} />
        <Stat label="Requests" value={totals.request_count.toLocaleString("en-US")} />
      </div>
    </div>
  );
}

/**
 * Anthropic has no API for a prepaid account's actual remaining credit balance (confirmed
 * - there's no GET .../balance endpoint at all; it's console.anthropic.com/settings/billing
 * only). This shows the next best thing, built from data the gateway already records on
 * every request: real tracked Anthropic-side cost vs. what was billed to users - the
 * platform's own draw against whatever balance is loaded in that Console page, linked
 * below so a super_admin can read both numbers together to gauge runway.
 */
export function AnthropicSpendSummary({ spend }: { spend: AnthropicSpend }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between gap-4">
        <p className="text-sm font-medium">Anthropic API spend</p>
        <a
          href={spend.console_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Check real balance in Anthropic Console →
        </a>
      </div>
      <p className="mb-4 text-xs text-foreground/50">
        Anthropic doesn&apos;t expose a prepaid balance through any API - the figures below
        are this gateway&apos;s own tracked spend (computed from every request&apos;s real
        cost), not a live balance. Compare against the Console link above to gauge runway.
      </p>

      <div className="flex flex-col gap-4">
        <TotalsRow heading="Last 30 days" totals={spend.last_30_days} />
        <TotalsRow heading="All time" totals={spend.all_time} />
      </div>
    </div>
  );
}
