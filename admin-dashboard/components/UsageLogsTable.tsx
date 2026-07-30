"use client";

import { useMemo, useState } from "react";
import type { UsageLog } from "@/lib/types";

/**
 * Shared by all three places a usage-log list is shown (super-admin, org-admin, and a
 * member's own "Recent usage") - same columns, same filtering logic, only the user column
 * (and its label) differs, since a member viewing their own log already knows who it is.
 */
export function UsageLogsTable({
  logs,
  userColumnLabel = "User",
  showUserColumn = true,
  showOrgMarginColumn = false,
}: {
  logs: UsageLog[];
  userColumnLabel?: string;
  showUserColumn?: boolean;
  /** Org-admin and super-admin views only - a member's own usage log never includes
   * org_margin_credits (see lib/types.ts's UsageLog), so there's nothing to show them. */
  showOrgMarginColumn?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [modelFilter, setModelFilter] = useState("all");

  const models = useMemo(() => Array.from(new Set(logs.map((l) => l.model_id))).sort(), [logs]);

  const filtered = logs.filter((log) => {
    if (modelFilter !== "all" && log.model_id !== modelFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${log.user_email ?? log.user_id ?? ""} ${log.model_id}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder={showUserColumn ? "Search by email or model..." : "Search by model..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">All models</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-foreground/60">
            <tr>
              <th className="px-4 py-2 font-medium">Timestamp</th>
              {showUserColumn && <th className="px-4 py-2 font-medium">{userColumnLabel}</th>}
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 font-medium">Input tokens</th>
              <th className="px-4 py-2 font-medium">Output tokens</th>
              <th className="px-4 py-2 font-medium">Credits deducted</th>
              {showOrgMarginColumn && <th className="px-4 py-2 font-medium">Org margin earned</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                {showUserColumn && (
                  <td className="px-4 py-2 text-xs">
                    {log.user_email ?? <span className="font-mono text-foreground/40">{log.user_id}</span>}
                  </td>
                )}
                <td className="px-4 py-2">{log.model_id}</td>
                <td className="px-4 py-2 tabular-nums">{log.input_tokens.toLocaleString()}</td>
                <td className="px-4 py-2 tabular-nums">{log.output_tokens.toLocaleString()}</td>
                <td className="px-4 py-2 tabular-nums">{log.credits_deducted}</td>
                {showOrgMarginColumn && (
                  <td className="px-4 py-2 tabular-nums">{log.org_margin_credits ?? 0}</td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={(showUserColumn ? 6 : 5) + (showOrgMarginColumn ? 1 : 0)}
                  className="px-4 py-6 text-center text-foreground/40"
                >
                  {logs.length === 0 ? "No usage yet." : "No entries match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
