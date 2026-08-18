"use client";

import type { SlidePlan } from "@/lib/presentation/outline";
import { Button } from "@/components/ui/Button";
import { AiRewriteControl } from "./AiRewriteControl";

const inputClass =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none";

interface Props {
  slides: SlidePlan[];
  onChange: (slides: SlidePlan[]) => void;
  sourceText: string;
}

/** Free-form structured editor for the "deck" template format - every change here is
 * local state only (see app/apps/presentation/page.tsx's PresentationStudio, which only
 * calls the billed /api/presentation/ai-edit route from the explicit "AI rewrite"
 * control below, never from these plain inputs). Deliberately a content/structure
 * editor, not a pixel-positioning canvas - it edits exactly the SlidePlan[] shape
 * lib/presentation/renderDeck.ts already renders deterministically, so "what you edit is
 * what downloads" without a separate preview renderer to keep in sync. */
export function DeckEditor({ slides, onChange, sourceText }: Props) {
  function updateSlide(index: number, next: SlidePlan) {
    onChange(slides.map((s, i) => (i === index ? next : s)));
  }

  function addSlide() {
    onChange([...slides, { title: "New slide", bullets: ["New point"] }]);
  }

  function removeSlide(index: number) {
    onChange(slides.filter((_, i) => i !== index));
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  async function aiRewriteSlide(index: number, instruction: string) {
    const response = await fetch("/api/presentation/ai-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "deck", instruction, sourceText, slide: slides[index] }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Request failed: ${response.status}`);
    updateSlide(index, body.slide as SlidePlan);
  }

  return (
    <div className="flex flex-col gap-4">
      {slides.map((slide, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3.5">
          <div className="flex items-start justify-between gap-2">
            <span className="mt-1.5 shrink-0 text-xs font-semibold text-foreground/40">Slide {i + 1}</span>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" onClick={() => moveSlide(i, -1)} disabled={i === 0} title="Move up">
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveSlide(i, 1)}
                disabled={i === slides.length - 1}
                title="Move down"
              >
                ↓
              </Button>
              <Button variant="danger" size="sm" onClick={() => removeSlide(i)} disabled={slides.length <= 1}>
                Remove
              </Button>
            </div>
          </div>

          <input
            value={slide.title}
            onChange={(e) => updateSlide(i, { ...slide, title: e.target.value })}
            className={`${inputClass} font-semibold`}
            placeholder="Slide title"
          />

          <div className="flex flex-col gap-1.5">
            {slide.bullets.map((bullet, bi) => (
              <div key={bi} className="flex gap-1.5">
                <input
                  value={bullet}
                  onChange={(e) =>
                    updateSlide(i, {
                      ...slide,
                      bullets: slide.bullets.map((b, j) => (j === bi ? e.target.value : b)),
                    })
                  }
                  className={inputClass}
                  placeholder="Bullet point"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateSlide(i, { ...slide, bullets: slide.bullets.filter((_, j) => j !== bi) })}
                  disabled={slide.bullets.length <= 1}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => updateSlide(i, { ...slide, bullets: [...slide.bullets, "New point"] })}
            >
              + Add bullet
            </Button>
          </div>

          <AiRewriteControl label="Rewrite this slide" onApply={(instruction) => aiRewriteSlide(i, instruction)} />
        </div>
      ))}

      <Button variant="secondary" onClick={addSlide} className="self-start">
        + Add slide
      </Button>
    </div>
  );
}
