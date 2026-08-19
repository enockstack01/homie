"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Slide,
  type SlideElement,
  type TextElement,
  type TableElement,
  FONT_FAMILIES,
  blankSlide,
  duplicateSlide,
  duplicateElement,
  newTextBox,
  newShape,
  newTable,
  newImage,
  reorderElement,
  extractPlanFromSlide,
  applyPlanToSlide,
} from "@/lib/presentation/elements";
import { Button } from "@/components/ui/Button";
import { AiRewriteControl } from "./AiRewriteControl";
import { SlideCanvas, DECK_CANVAS_WIDTH, DECK_CANVAS_HEIGHT } from "./SlideCanvas";

const THUMB_SCALE = 0.16;
const TEXT_SWATCHES = ["101914", "005C3D", "F8B712", "FFFFFF", "DC2626", "1D4ED8"];
const BG_SWATCHES = ["FFFFFF", "F7F9F8", "101914", "005C3D", "6D28D9", "075985", "9A3412"];

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

function ToolbarDivider() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}

interface Props {
  slides: Slide[];
  onChange: (slides: Slide[]) => void;
  sourceText: string;
}

/** Canva-style freeform editor for the "deck" format: a left rail of live slide
 * thumbnails, and a large interactive canvas (SlideCanvas.tsx, backed by react-rnd) for
 * whichever page is selected - every element on it is draggable, resizable, and (for
 * text/tables) double-click-to-edit in place, plus Insert/Format toolbars, per-slide
 * background color, speaker notes, and undo/redo. AI rewrite (billed - see
 * app/api/presentation/ai-edit/route.ts) only touches the slide's role-tagged title/body
 * elements (lib/presentation/elements.ts's extractPlanFromSlide/applyPlanToSlide),
 * leaving any freeform elements the user added untouched. */
export function DeckEditor({ slides, onChange, sourceText }: Props) {
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Undo/redo: `past`/`future` hold whole-deck snapshots. A "coalesced" run (typing into
  // one text box or table cell) only takes one snapshot for the whole run, closed out by
  // stopEditing - see SlideCanvas.tsx's onElementChange coalesce flag.
  const [past, setPast] = useState<Slide[][]>([]);
  const [future, setFuture] = useState<Slide[][]>([]);
  const coalescingRef = useRef(false);

  function commit(next: Slide[], coalesce = false) {
    if (!coalesce || !coalescingRef.current) {
      setPast((p) => [...p, slides]);
      setFuture([]);
    }
    coalescingRef.current = coalesce;
    onChange(next);
  }

  function stopEditing() {
    setEditingElementId(null);
    coalescingRef.current = false;
  }

  function undo() {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [slides, ...f]);
    onChange(previous);
    setSelectedElementId(null);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, slides]);
    onChange(next);
    setSelectedElementId(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isTyping = active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
      const meta = e.ctrlKey || e.metaKey;

      if (meta && !isTyping && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (meta && !isTyping && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        setSelectedElementId(null);
        stopEditing();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !isTyping && editingElementId === null && selectedElementId) {
        e.preventDefault();
        commit(
          slides.map((s, i) =>
            i === selectedSlide ? { ...s, elements: s.elements.filter((el) => el.id !== selectedElementId) } : s,
          ),
        );
        setSelectedElementId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, slides, selectedElementId, editingElementId]);

  const slide = slides[selectedSlide];
  const selectedElement = slide?.elements.find((el) => el.id === selectedElementId) ?? null;

  function updateSlide(index: number, next: Slide, coalesce = false) {
    commit(
      slides.map((s, i) => (i === index ? next : s)),
      coalesce,
    );
  }

  function updateElement(id: string, patch: Partial<SlideElement>, coalesce = false) {
    updateSlide(
      selectedSlide,
      { ...slide, elements: slide.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as SlideElement) : el)) },
      coalesce,
    );
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

  function reorderSelected(direction: "forward" | "backward" | "front" | "back") {
    if (!selectedElementId) return;
    updateSlide(selectedSlide, { ...slide, elements: reorderElement(slide.elements, selectedElementId, direction) });
  }

  function addSlide() {
    commit([...slides, blankSlide()]);
    setSelectedSlide(slides.length);
    setSelectedElementId(null);
  }

  function duplicateCurrentSlide() {
    const copy = duplicateSlide(slide);
    const next = [...slides.slice(0, selectedSlide + 1), copy, ...slides.slice(selectedSlide + 1)];
    commit(next);
    setSelectedSlide(selectedSlide + 1);
    setSelectedElementId(null);
  }

  function removeSlide(index: number) {
    commit(slides.filter((_, i) => i !== index));
    setSelectedSlide((current) => Math.min(current, slides.length - 2));
    setSelectedElementId(null);
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
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

  function addTableRow(el: TableElement) {
    updateElement(el.id, { rows: [...el.rows, el.rows[0].map(() => "")] });
  }
  function removeTableRow(el: TableElement) {
    if (el.rows.length <= 1) return;
    updateElement(el.id, { rows: el.rows.slice(0, -1) });
  }
  function addTableCol(el: TableElement) {
    updateElement(el.id, { rows: el.rows.map((r) => [...r, ""]) });
  }
  function removeTableCol(el: TableElement) {
    if (el.rows[0].length <= 1) return;
    updateElement(el.id, { rows: el.rows.map((r) => r.slice(0, -1)) });
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
  const tableEl = selectedElement?.type === "table" ? (selectedElement as TableElement) : null;

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
        {/* Slide-level toolbar: navigation, duplicate/remove, undo/redo, background, AI */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-2">
          <span className="mr-1 text-xs text-foreground/50">
            Slide {selectedSlide + 1} of {slides.length}
          </span>
          <Button variant="ghost" size="sm" onClick={() => moveSlide(selectedSlide, -1)} disabled={selectedSlide === 0} title="Move slide up">
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => moveSlide(selectedSlide, 1)}
            disabled={selectedSlide === slides.length - 1}
            title="Move slide down"
          >
            ↓
          </Button>
          <Button variant="secondary" size="sm" onClick={duplicateCurrentSlide} title="Duplicate slide">
            ⧉ Duplicate
          </Button>
          <Button variant="danger" size="sm" onClick={() => removeSlide(selectedSlide)} disabled={slides.length <= 1}>
            Remove slide
          </Button>
          <ToolbarDivider />
          <Button variant="ghost" size="sm" onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)">
            ↶ Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">
            ↷ Redo
          </Button>
          <ToolbarDivider />
          <span className="text-xs text-foreground/50">Background</span>
          <div className="flex items-center gap-1">
            {BG_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateSlide(selectedSlide, { ...slide, background: color })}
                className={`h-5 w-5 rounded-full border ${slide?.background === color ? "ring-2 ring-primary" : "border-border"}`}
                style={{ backgroundColor: `#${color}` }}
                title={`#${color}`}
              />
            ))}
          </div>
          {canRewrite && (
            <>
              <ToolbarDivider />
              <AiRewriteControl label="Rewrite this slide" onApply={aiRewriteSlide} />
            </>
          )}
        </div>

        {/* Insert toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface p-2">
          <span className="mr-1 text-xs text-foreground/50">Insert</span>
          <Button variant="secondary" size="sm" onClick={() => addElement(newTextBox())}>
            + Text
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement(newShape())}>
            + Shape
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement(newTable())}>
            + Table
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
        </div>

        {/* Format toolbar - contextual to the selected element */}
        {selectedElement && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2">
            {textEl && (
              <>
                <select
                  value={textEl.fontFamily ?? "Arial"}
                  onChange={(e) => updateElement(textEl.id, { fontFamily: e.target.value as TextElement["fontFamily"] })}
                  className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => updateElement(textEl.id, { fontSize: Math.max(8, textEl.fontSize - 2) })}>
                    A-
                  </Button>
                  <span className="w-6 text-center text-xs">{textEl.fontSize}</span>
                  <Button variant="ghost" size="sm" onClick={() => updateElement(textEl.id, { fontSize: Math.min(96, textEl.fontSize + 2) })}>
                    A+
                  </Button>
                </div>
                <Button variant={textEl.bold ? "primary" : "ghost"} size="sm" onClick={() => updateElement(textEl.id, { bold: !textEl.bold })}>
                  B
                </Button>
                <Button variant={textEl.italic ? "primary" : "ghost"} size="sm" onClick={() => updateElement(textEl.id, { italic: !textEl.italic })}>
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
                  {TEXT_SWATCHES.map((color) => (
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
              <>
                <div className="flex items-center gap-1">
                  {TEXT_SWATCHES.map((color) => (
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
                <label className="flex items-center gap-1.5 text-xs text-foreground/60">
                  Opacity
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={selectedElement.opacity ?? 100}
                    onChange={(e) => updateElement(selectedElement.id, { opacity: Number(e.target.value) })}
                  />
                </label>
                <Button
                  variant={selectedElement.shape === "ellipse" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => updateElement(selectedElement.id, { shape: selectedElement.shape === "ellipse" ? "rect" : "ellipse" })}
                >
                  ○ / ▭
                </Button>
              </>
            )}

            {tableEl && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => addTableRow(tableEl)}>
                  + Row
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeTableRow(tableEl)} disabled={tableEl.rows.length <= 1}>
                  - Row
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addTableCol(tableEl)}>
                  + Col
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeTableCol(tableEl)} disabled={tableEl.rows[0].length <= 1}>
                  - Col
                </Button>
                <Button
                  variant={tableEl.headerRow ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => updateElement(tableEl.id, { headerRow: !tableEl.headerRow })}
                >
                  Header row
                </Button>
              </div>
            )}

            <ToolbarDivider />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => reorderSelected("backward")} title="Send backward">
                ⬇︎ Layer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => reorderSelected("forward")} title="Bring forward">
                ⬆︎ Layer
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => addElement(duplicateElement(selectedElement))}>
              ⧉ Duplicate
            </Button>
            <Button variant="danger" size="sm" onClick={() => removeElement(selectedElement.id)} className="ml-auto">
              Delete
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
              onStopEditing={stopEditing}
              onElementChange={updateElement}
            />
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-2">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-foreground/60"
          >
            <span>📝 Speaker notes {slide?.notes ? "" : "(none)"}</span>
            <span>{notesOpen ? "▲" : "▼"}</span>
          </button>
          {notesOpen && (
            <textarea
              value={slide?.notes ?? ""}
              onChange={(e) => updateSlide(selectedSlide, { ...slide, notes: e.target.value }, true)}
              onBlur={stopEditing}
              rows={3}
              placeholder="Notes for this slide - not shown on the slide itself, only when presenting from PowerPoint."
              className="mt-2 w-full resize-y rounded border border-border bg-surface-muted px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          )}
        </div>

        <p className="text-xs text-foreground/40">
          Click an element to select it, drag its edges to resize, double-click text or a table cell to type. Delete/Backspace removes the
          selected element, Ctrl+Z / Ctrl+Shift+Z undo/redo.
        </p>
      </div>
    </div>
  );
}
