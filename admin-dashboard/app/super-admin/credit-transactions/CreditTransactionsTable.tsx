"use client";

import { useState } from "react";
import type { CreditTransaction } from "@/lib/types";

export function CreditTransactionsTable({ txns }: { txns: CreditTransaction[] }) {
  const [query, setQuery] = useState("");
  const [targetFilter, setTargetFilter] = useState<"all" | "organizations" | "users">("all");

  const filtered = txns.filter((t) => {
    if (targetFilter !== "all" && t.target_collection !== targetFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${t.granted_by_email ?? ""} ${t.payment_note} ${t.target_id}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search by granted-by email, note, or target id..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value as typeof targetFilter)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All targets</option>
          <option value="organizations">Organizations</option>
          <option value="users">Users</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-foreground/60">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Granted by</th>
              <th className="px-4 py-2 font-medium">USD received</th>
              <th className="px-4 py-2 font-medium">Credits</th>
              <th className="px-4 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {t.target_collection === "organizations" ? "org:" : "user:"}
                  {t.target_id}
                </td>
                <td className="px-4 py-2">{t.granted_by_email ?? "—"}</td>
                <td className="px-4 py-2 tabular-nums">
                  {t.amount_usd_received > 0 ? `$${t.amount_usd_received.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-2 tabular-nums">{t.credits_granted.toLocaleString()}</td>
                <td className="px-4 py-2 text-foreground/50">{t.payment_note || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-foreground/40">
                  {txns.length === 0 ? "No transactions yet." : "No transactions match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
