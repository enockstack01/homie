"use client";

import { useState } from "react";
import { TEMPLATES } from "@/lib/presentation/templates";
import { Button } from "@/components/ui/Button";

const inputClass =
  "mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none";

/** The interactive half of the Homie Presentation app (see app/apps/presentation/page.tsx
 * for the server-rendered account-status shell around this). Ported from the standalone
 * homie-presentation/ vertical slice, minus the pasted-API-key field - this runs inside
 * admin-dashboard, so the signed-in user's own Clerk session already authenticates every
 * request (see app/api/presentation/*), the same way every other dashboard page works. */
export function PresentationStudio() {
  const [deckTitle, setDeckTitle] = useState("");
  const [designIntent, setDesignIntent] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setStatus("Reading your source material and drafting an outline...");
    setGenerating(true);
    try {
      const response = await fetch("/api/presentation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, designIntent, deckTitle }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${response.status}`);
      }

      setStatus("Rendering your deck...");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? "deck.pptx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(`Downloaded ${fileName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = !!sourceText.trim() && !generating;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold">Start from a template</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Every template downloads instantly as a real, editable .pptx - free, no credits used.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <a
              key={t.id}
              href={`/api/presentation/template?id=${t.id}`}
              className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3.5 transition-colors hover:border-primary"
            >
              <span
                className={`self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  t.kind === "deck" ? "bg-primary/15 text-primary" : "bg-accent/25 text-[#8a6300]"
                }`}
              >
                {t.kind === "deck" ? "Deck" : "Flyer"}
              </span>
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="flex-1 text-xs text-foreground/60">{t.description}</p>
              <span className="mt-1.5 text-xs font-semibold text-primary">Download →</span>
            </a>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">Or generate one from your own material</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Paste source material and a design intent - Homie Presentation drafts a grounded
          outline and renders it as a real, downloadable .pptx, billed like any other
          Homie request against your credit balance and chosen model.
        </p>

        <div className="mt-4 flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Deck title</span>
            <input
              placeholder="Q3 operations review"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Design intent (optional)
            </span>
            <input
              placeholder="Formal, for a board of directors"
              value={designIntent}
              onChange={(e) => setDesignIntent(e.target.value)}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-foreground/50">
              Tone and audience - not colors or fonts yet in this early version.
            </span>
          </label>

          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Source material</span>
            <textarea
              placeholder="Paste a report, notes, or any text the deck should be grounded in..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={8}
              className={`${inputClass} resize-y`}
            />
            <span className="mt-1 block text-xs text-foreground/50">
              Every slide is drafted only from what you paste here - nothing is invented.
            </span>
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          {status && !error && <p className="text-sm text-foreground/60">{status}</p>}

          <Button variant="primary" onClick={handleGenerate} disabled={!canGenerate} className="self-start">
            {generating ? "Generating..." : "Generate deck"}
          </Button>
        </div>
      </div>
    </div>
  );
}
