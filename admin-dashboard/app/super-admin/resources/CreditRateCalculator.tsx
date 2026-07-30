"use client";

import { useState } from "react";

const PRESET_AMOUNTS_USD = [5, 10, 25, 50, 100, 250, 500, 1000, 5000];

// Locale pinned to "en-US" (not the runtime default) so this renders identically during
// SSR (Node's default locale) and client hydration (the browser's default locale) - a
// mismatch here is exactly what caused a hydration error before this was pinned.
const credits = (usd: number, creditsPerUsd: number) =>
  (usd * creditsPerUsd).toLocaleString("en-US", { maximumFractionDigits: 2 });

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/**
 * Reference table + live calculator for "how many credits does a grant of $X actually
 * produce" - the same question GrantCreditsInlineForm's amount_usd_received field answers
 * after submission, surfaced here up front so a super_admin can check before granting.
 * creditsPerUsd comes from GET /v1/super-admin/credit-rate (credit_engine.CREDITS_PER_USD)
 * rather than a hardcoded 1000 here, so this can never silently drift from the real rate.
 */
export function CreditRateCalculator({ creditsPerUsd }: { creditsPerUsd: number }) {
  const [amount, setAmount] = useState("");
  const parsed = Number(amount);
  const isValid = amount.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-sm font-medium">Credit conversion</p>
      <p className="mb-4 text-xs text-foreground/50">
        1 USD = {creditsPerUsd.toLocaleString("en-US")} credits, fixed - the same rate every grant,
        allocation, and chat-request deduction on the platform uses.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Amount received (USD)
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50"
            className="mt-1 block w-40 rounded border border-border bg-surface px-2 py-1 focus:border-primary focus:outline-none"
          />
        </label>
        <div className="pb-1.5 text-sm text-foreground/70">
          →{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {isValid ? `${credits(parsed, creditsPerUsd)} credits` : "—"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-foreground/60">
            <tr>
              <th className="px-4 py-2 font-medium">Amount received</th>
              <th className="px-4 py-2 font-medium">Credits granted</th>
            </tr>
          </thead>
          <tbody>
            {PRESET_AMOUNTS_USD.map((a) => (
              <tr key={a} className="border-b border-border last:border-0">
                <td className="px-4 py-2 tabular-nums">{usd(a)}</td>
                <td className="px-4 py-2 tabular-nums">{credits(a, creditsPerUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
