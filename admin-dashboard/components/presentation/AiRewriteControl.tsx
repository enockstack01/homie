"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Shared "type an instruction, spend credits, get a rewrite back" control used by both
 * DeckEditor (per-slide) and FlyerEditor (whole flyer) - the only two places in the
 * editor that call the billed /api/presentation/ai-edit route, as opposed to every other
 * control here which only touches local component state and costs nothing. */
export function AiRewriteControl({
  label,
  onApply,
}: {
  label: string;
  onApply: (instruction: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        ✨ {label}
      </Button>
    );
  }

  async function handleApply() {
    if (!instruction.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onApply(instruction.trim());
      setOpen(false);
      setInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted p-2.5">
      <input
        autoFocus
        placeholder="e.g. Make this punchier, or add a stat about growth"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        className="w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none"
      />
      <p className="text-xs text-foreground/50">✨ Uses Homie credits - a real AI call, unlike typing directly above.</p>
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleApply} disabled={busy || !instruction.trim()}>
          {busy ? "Rewriting..." : "Apply"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
