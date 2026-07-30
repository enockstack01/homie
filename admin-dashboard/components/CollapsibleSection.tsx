"use client";

import { useState, type ReactNode } from "react";

/**
 * Collapsed by default everywhere a log/transaction list is shown (usage logs, credit
 * transactions) - the data itself is already fetched server-side (these pages/sections
 * are Server Components), this only hides the rendered table until a user asks for it, to
 * keep the page short by default.
 */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-2 text-left text-sm font-medium hover:bg-surface-muted"
      >
        <span>
          {title}
          {count !== undefined && (
            <span className="ml-2 font-normal text-foreground/50">
              ({count.toLocaleString("en-US")})
            </span>
          )}
        </span>
        <span className="text-xs font-normal text-foreground/50">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
