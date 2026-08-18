"use client";

import { useRef, useState } from "react";
import { TEMPLATES, type Template, type FlyerContent } from "@/lib/presentation/templates";
import type { SlidePlan } from "@/lib/presentation/outline";
import { Button } from "@/components/ui/Button";
import { DeckEditor } from "@/components/presentation/DeckEditor";
import { FlyerEditor } from "@/components/presentation/FlyerEditor";

type EditorState =
  | { kind: "deck"; title: string; slides: SlidePlan[]; sourceText: string }
  | { kind: "flyer"; title: string; content: FlyerContent; sourceText: string };

const inputClass =
  "mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none";

function downloadBlob(blob: Blob, fallbackName: string, disposition: string | null) {
  const match = (disposition ?? "").match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** The whole Homie Presentation experience (see app/apps/presentation/page.tsx for the
 * server-rendered account-status shell around this): pick a template or generate one
 * with AI (billed - see app/api/presentation/generate/route.ts), land in a real online
 * editor (DeckEditor/FlyerEditor - entirely free, local state), and export to .pptx any
 * time (also free - app/api/presentation/export/route.ts never calls the AI gateway). */
export function PresentationStudio() {
  const [editing, setEditing] = useState<EditorState | null>(null);

  const [genKind, setGenKind] = useState<"deck" | "flyer">("deck");
  const [deckTitle, setDeckTitle] = useState("");
  const [designIntent, setDesignIntent] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function openTemplate(t: Template) {
    setEditing(
      t.kind === "deck"
        ? { kind: "deck", title: t.name, slides: t.slides, sourceText: "" }
        : { kind: "flyer", title: t.name, content: t.content, sourceText: "" },
    );
  }

  async function handleGenerate() {
    setGenError(null);
    if (!sourceText.trim() && !sourceFile) {
      setGenError("Paste source material and/or upload a document first.");
      return;
    }
    setGenerating(true);
    try {
      const form = new FormData();
      form.set("kind", genKind);
      form.set("title", deckTitle || "Untitled");
      form.set("designIntent", designIntent);
      form.set("sourceText", sourceText);
      if (sourceFile) form.set("sourceFile", sourceFile);

      const response = await fetch("/api/presentation/generate", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || `Request failed: ${response.status}`);

      setEditing(
        genKind === "flyer"
          ? { kind: "flyer", title: body.title, content: body.content, sourceText: body.sourceText ?? "" }
          : { kind: "deck", title: body.title, slides: body.slides, sourceText: body.sourceText ?? "" },
      );
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport() {
    if (!editing) return;
    setExportError(null);
    setExporting(true);
    try {
      const response = await fetch("/api/presentation/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing.kind === "deck"
            ? { kind: "deck", title: editing.title, slides: editing.slides }
            : { kind: "flyer", title: editing.title, content: editing.content },
        ),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${response.status}`);
      }
      const blob = await response.blob();
      downloadBlob(blob, "deck.pptx", response.headers.get("Content-Disposition"));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            ← Back to templates
          </Button>
          <div className="flex items-center gap-2">
            {exportError && <p className="text-sm text-red-700 dark:text-red-400">{exportError}</p>}
            <Button variant="primary" onClick={handleExport} disabled={exporting}>
              {exporting ? "Rendering..." : "Download .pptx"}
            </Button>
          </div>
        </div>

        <label className="text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {editing.kind === "deck" ? "Deck" : "Flyer"} title
          </span>
          <input
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            className={inputClass}
          />
        </label>

        {editing.kind === "deck" ? (
          <DeckEditor
            slides={editing.slides}
            sourceText={editing.sourceText}
            onChange={(slides) => setEditing({ ...editing, slides })}
          />
        ) : (
          <FlyerEditor
            content={editing.content}
            sourceText={editing.sourceText}
            onChange={(content) => setEditing({ ...editing, content })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold">Choose a type of presentation</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Every template opens in a free online editor - rearrange slides, rewrite text,
          add or remove content, then export whenever you&apos;re ready. No credits used.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3.5">
              <span
                className={`self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  t.kind === "deck" ? "bg-primary/15 text-primary" : "bg-accent/25 text-[#8a6300]"
                }`}
              >
                {t.kind === "deck" ? "Deck" : "Flyer"}
              </span>
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="flex-1 text-xs text-foreground/60">{t.description}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <Button variant="primary" size="sm" onClick={() => openTemplate(t)}>
                  Edit online
                </Button>
                <a
                  href={`/api/presentation/template?id=${t.id}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Download as-is →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">Or generate one from your own material</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Paste source material and/or upload a document, and Homie Presentation drafts a
          grounded outline you can then edit for free. This step calls the AI gateway, so
          it&apos;s billed against your account&apos;s credit balance and model like any
          other Homie request.
        </p>

        <div className="mt-4 flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={genKind === "deck"} onChange={() => setGenKind("deck")} />
              Deck (multi-slide)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={genKind === "flyer"} onChange={() => setGenKind("flyer")} />
              Flyer (single page)
            </label>
          </div>

          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Title</span>
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
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Source document (optional)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
            />
            <span className="mt-1 block text-xs text-foreground/50">
              .txt, .md, .pdf, or .docx - text is extracted and combined with anything
              pasted below.
            </span>
          </label>

          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Source material (optional if a document is uploaded)
            </span>
            <textarea
              placeholder="Paste a report, notes, or any text the deck should be grounded in..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={8}
              className={`${inputClass} resize-y`}
            />
            <span className="mt-1 block text-xs text-foreground/50">
              Every slide is drafted only from what you paste or upload here - nothing is
              invented.
            </span>
          </label>

          {genError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {genError}
            </p>
          )}

          <Button variant="primary" onClick={handleGenerate} disabled={generating} className="self-start">
            {generating ? "Generating..." : "✨ Generate outline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
