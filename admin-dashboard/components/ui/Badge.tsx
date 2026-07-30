import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "success" | "warning" | "info" | "neutral" | "danger";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-primary/10 text-primary dark:bg-primary/15",
  warning: "bg-accent-soft text-black/80",
  info: "bg-info/10 text-info",
  neutral: "bg-surface-muted text-foreground/60",
  danger: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        VARIANT_CLASSES[variant],
      )}
    >
      {children}
    </span>
  );
}
