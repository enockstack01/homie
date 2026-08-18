"use client";

import type { FlyerContent } from "@/lib/presentation/templates";
import { Button } from "@/components/ui/Button";
import { AiRewriteControl } from "./AiRewriteControl";

const inputClass =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none";

interface Props {
  content: FlyerContent;
  onChange: (content: FlyerContent) => void;
  sourceText: string;
}

/** Free-form structured editor for the "flyer" template format - single page, so unlike
 * DeckEditor there's one AI-rewrite control for the whole thing rather than per-slide.
 * Same principle as DeckEditor: edits exactly the FlyerContent shape
 * lib/presentation/renderFlyer.ts already renders deterministically. */
export function FlyerEditor({ content, onChange, sourceText }: Props) {
  async function aiRewrite(instruction: string) {
    const response = await fetch("/api/presentation/ai-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "flyer", instruction, sourceText, content }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Request failed: ${response.status}`);
    onChange(body.content as FlyerContent);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3.5">
      <label className="text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Headline</span>
        <input
          value={content.headline}
          onChange={(e) => onChange({ ...content, headline: e.target.value })}
          className={`${inputClass} mt-1`}
        />
      </label>

      <label className="text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Subheadline (optional)</span>
        <input
          value={content.subheadline ?? ""}
          onChange={(e) => onChange({ ...content, subheadline: e.target.value || undefined })}
          className={`${inputClass} mt-1`}
        />
      </label>

      <div className="text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Body</span>
        <div className="mt-1 flex flex-col gap-1.5">
          {content.body.map((line, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={line}
                onChange={(e) => onChange({ ...content, body: content.body.map((b, j) => (j === i ? e.target.value : b)) })}
                className={inputClass}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...content, body: content.body.filter((_, j) => j !== i) })}
                disabled={content.body.length <= 1}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...content, body: [...content.body, "New line"] })}
          >
            + Add line
          </Button>
        </div>
      </div>

      <label className="text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Call to action (optional)</span>
        <input
          value={content.cta ?? ""}
          onChange={(e) => onChange({ ...content, cta: e.target.value || undefined })}
          className={`${inputClass} mt-1`}
        />
      </label>

      <label className="text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Footer (optional)</span>
        <input
          value={content.footer ?? ""}
          onChange={(e) => onChange({ ...content, footer: e.target.value || undefined })}
          className={`${inputClass} mt-1`}
        />
      </label>

      <AiRewriteControl label="Rewrite this flyer" onApply={aiRewrite} />
    </div>
  );
}
