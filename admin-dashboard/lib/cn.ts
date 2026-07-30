/** Minimal className joiner - no dedup/merge logic needed since this project's
 * components never pass conflicting Tailwind utilities for the same property. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
