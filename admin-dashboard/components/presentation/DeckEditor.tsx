"use client";

import { useRef, useState } from "react";
import {
  type Slide,
  type SlideElement,
  type TextElement,
  blankSlide,
  newTextBox,
  newShape,
  newImage,
  extractPlanFromSlide,
  applyPlanToSlide,
} from "@/lib/presentation/elements";
import { Button } from "@/components/ui/Button";
import { AiRewriteControl } from "./AiRewriteControl";
import { SlideCanvas, DECK_CANVAS_WIDTH, DECK_CANVAS_HEIGHT } from "./SlideCanvas";

const THUMB_SCALE = 0.16;
const SWATCHES = ["101914", "005C3D", "F8B712", "FFFFFF", "DC2626", "1D4ED8"];

function Thumbnail({ slide, selected, onClick }: { slide: Slide; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
        selected ? "border-primary" : "border-transparent hover:border-border"
      }`}
      style={{ width: DECK_CANVAS_WIDTH * THUMB_SCALE, height: DECK_CANVAS_HEIGHT * THUMB_SCALE }}
    >
      <div
        style={{
          width: DECK_CANVAS_WIDTH,
          height: DECK_CANVAS_HEIGHT,
          transform: `scale(${THUMB_SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <SlideCanvas slide={slide} editable={false} />
      </div>
    </button>
  );
}

interface Props {
  slides: Slide[];
  onChange: (slides: Slide[]) => void;
  sourceText: string;
}

/** Canva-style freeform editor for the "deck" format: a left rail of live slide
 * thumbnails, and a large interactive canvas (SlideCanvas.tsx, backed by react-rnd) for
 * whichever page is selected - every element on it is draggable, resizable, and (for
 * text) double-click-to-edit in place, plus an Insert toolbar (text/shape/image) and a
 * formatting toolbar that appears for the selected text element. AI rewrite (billed - see
 * app/api/presentation/ai-edit/route.ts) only touches the slide's role-tagged title/body
 * elements (lib/presentation/elements.ts's extractPlanFromSlide/applyPlanToSlide),
 * leaving any freeform elements the user added untouched. */
export function DeckEditor({ slides, onChange, sourceText }: Props) {
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const slide = slides[selectedSlide];
  const selectedElement = slide?.elements.find((el) => el.id === selectedElementId) ?? null;

  function updateSlide(index: number, next: Slide) {
    onChange(slides.map((s, i) => (i === index ? next : s)));
  }

  function updateElement(id: string, patch: Partial<SlideElement>) {
    updateSlide(selectedSlide, {
      ...slide,
      elements: slide.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as SlideElement) : el)),
    });
  }

  function addElement(el: SlideElement) {
    updateSlide(selectedSlide, { ...slide, elements: [...slide.elements, el] });
    setSelectedElementId(el.id);
    setEditingElementId(null);
  }

  function removeElement(id: string) {
    updateSlide(selectedSlide, { ...slide, elements: slide.elements.filter((el) => el.id !== id) });
    setSelectedElementId(null);
  }

  function addSlide() {
    onChange([...slides, blankSlide()]);
    setSelectedSlide(slides.length);
    setSelectedElementId(null);
  }

  function removeSlide(index: number) {
    onChange(slides.filter((_, i) => i !== index));
    setSelectedSlide((current) => Math.min(current, slides.length - 2));
    setSelectedElementId(null);
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setSelectedSlide(target);
  }

  function handleImagePick(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => addElement(newImage(dataUrl, img.naturalWidth, img.naturalHeight));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function aiRewriteSlide(instruction: string) {
    const plan = extractPlanFromSlide(slide);
    if (!plan) throw new Error("This slide has no title/body text to rewrite - add a text box first.");
    const response = await fetch("/api/presentation/ai-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "deck", instruction, sourceText, slide: plan }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Request failed: ${response.status}`);
    updateSlide(selectedSlide, applyPlanToSlide(slide, body.slide));
  }

  const canRewrite = slide ? extractPlanFromSlide(slide) !== null : false;
  const textEl = selectedElement?.type === "text" ? (selectedElement as TextElement) : null;

  return (
    <div className="flex gap-4">
      <div className="flex max-h-[640px] shrink-0 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-surface-muted p-2">
        {slides.map((s, i) => (
          <Thumbnail
            key={s.id}
            slide={s}
            selected={selectedSlide === i}
            onClick={() => {
              setSelectedSlide(i);
              setSelectedElementId(null);
            }}
          />
        ))}
        <Button variant="secondary" size="sm" onClick={addSlide}>
          + Add slide
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-2">
          <span className="mr-1 text-xs text-foreground/50">
            Slide {selectedSlide + 1} of {slides.length}
          </span>
          <Button variant="ghost" size="sm" onClick={() => moveSlide(selectedSlide, -1)} disabled={selectedSlide === 0}>
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => moveSlide(selectedSlide, 1)}
            disabled={selectedSlide === slides.length - 1}
          >
            ↓
          </Button>
          <Button variant="danger" size="sm" onClick={() => removeSlide(selectedSlide)} disabled={slides.length <= 1}>
            Remove slide
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button variant="secondary" size="sm" onClick={() => addElement(newTextBox())}>
            + Text
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement(newShape())}>
            + Shape
          </Button>
          <Button variant="secondary" size="sm" onClick={() => imageInputRef.current?.click()}>
            + Image
          </Button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImagePick(file);
              e.target.value = "";
            }}
          />
          {canRewrite && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              <AiRewriteControl label="Rewrite this slide" onApply={aiRewriteSlide} />
            </>
          )}
        </div>

        {selectedElement && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2">
            {textEl && (
              <>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => updateElement(textEl.id, { fontSize: Math.max(8, textEl.fontSize - 2) })}>
                    A-
                  </Button>
                  <span className="w-6 text-center text-xs">{textEl.fontSize}</span>
                  <Button variant="ghost" size="sm" onClick={() => updateElement(textEl.id, { fontSize: Math.min(96, textEl.fontSize + 2) })}>
                    A+
                  </Button>
                </div>
                <Button
                  variant={textEl.bold ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => updateElement(textEl.id, { bold: !textEl.bold })}
                >
                  B
                </Button>
                <Button
                  variant={textEl.italic ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => updateElement(textEl.id, { italic: !textEl.italic })}
                >
                  I
                </Button>
                <div className="flex items-center gap-0.5">
                  {(["left", "center", "right"] as const).map((align) => (
                    <Button
                      key={align}
                      variant={(textEl.align ?? "left") === align ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => updateElement(textEl.id, { align })}
                    >
                      {align === "left" ? "⟸" : align === "center" ? "≡" : "⟹"}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateElement(textEl.id, { color })}
                      className={`h-5 w-5 rounded-full border ${textEl.color === color ? "ring-2 ring-primary" : "border-border"}`}
                      style={{ backgroundColor: `#${color}` }}
                      title={`#${color}`}
                    />
                  ))}
                </div>
              </>
            )}
            {selectedElement.type === "shape" && (
              <div className="flex items-center gap-1">
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateElement(selectedElement.id, { fill: color })}
                    className={`h-5 w-5 rounded-full border ${
                      selectedElement.fill === color ? "ring-2 ring-primary" : "border-border"
                    }`}
                    style={{ backgroundColor: `#${color}` }}
                  />
                ))}
              </div>
            )}
            <Button variant="danger" size="sm" onClick={() => removeElement(selectedElement.id)} className="ml-auto">
              Delete element
            </Button>
          </div>
        )}

        <div className="w-full overflow-x-auto">
          <div className="mx-auto w-fit rounded-md border border-border bg-white shadow-sm">
            <SlideCanvas
              slide={slide}
              editable
              selectedId={selectedElementId}
              editingId={editingElementId}
              onSelect={setSelectedElementId}
              onStartEditing={setEditingElementId}
              onStopEditing={() => setEditingElementId(null)}
              onElementChange={updateElement}
            />
          </div>
        </div>
        <p className="text-xs text-foreground/40">Click an element to select it, drag its edges to resize, double-click text to type.</p>
      </div>
    </div>
  );
}
