"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  type Slide,
  type SlideElement,
  type TextElement,
  type TableElement,
  type ChartElement,
  type ImageElement,
  FONT_FAMILIES,
  SHAPE_KINDS,
  CHART_KINDS,
  blankSlide,
  duplicateSlide,
  duplicateElement,
  newTextBox,
  newShapeOfKind,
  newTable,
  newChart,
  newImage,
  reorderElement,
  extractPlanFromSlide,
  applyPlanToSlide,
} from "@/lib/presentation/elements";
import { DECK_LAYOUT } from "@/lib/presentation/layout";
import { removeBackground } from "@/lib/presentation/imageTools";
import { Button } from "@/components/ui/Button";
import { AiRewriteControl } from "./AiRewriteControl";
import { SlideCanvas, shapeStyle, DECK_CANVAS_WIDTH, DECK_CANVAS_HEIGHT } from "./SlideCanvas";

const THUMB_SCALE = 0.16;
const TEXT_SWATCHES = ["101914", "005C3D", "F8B712", "FFFFFF", "DC2626", "1D4ED8"];
const BG_SWATCHES = ["FFFFFF", "F7F9F8", "101914", "005C3D", "6D28D9", "075985", "9A3412"];

const TABS = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "design", label: "Design" },
  { id: "format", label: "Format" },
  { id: "view", label: "View" },
] as const;
type TabId = (typeof TABS)[number]["id"];

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
 * thumbnails, a PowerPoint/Canva-style tab bar (Home/Insert/Design/Format/View) driving
 * a single toolbar panel below it, and a large interactive canvas (SlideCanvas.tsx,
 * backed by react-rnd) for whichever page is selected - every element on it is
 * draggable, resizable, and (for text/tables) double-click-to-edit in place. AI rewrite
 * (billed - see app/api/presentation/ai-edit/route.ts) only touches the slide's
 * role-tagged title/body elements (lib/presentation/elements.ts's
 * extractPlanFromSlide/applyPlanToSlide), leaving any freeform elements the user added
 * untouched. */
export function DeckEditor({ slides, onChange, sourceText }: Props) {
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<"png" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  // Hidden off-screen renders of every slide (see the JSX near the bottom), used only to
  // rasterize a real, chrome-free (no selection outlines/resize handles) capture for the
  // PNG/PDF export buttons - the on-screen canvas isn't captured directly since it's the
  // interactive react-rnd version.
  const exportNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Selecting an element jumps to the Format tab, mirroring PowerPoint's contextual
  // "Shape/Picture/Table Format" tabs auto-activating on selection - deselecting doesn't
  // jump back, it just leaves Format showing its empty state.
  function selectElement(id: string | null) {
    setSelectedElementId(id);
    if (id) setActiveTab("format");
  }

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
    selectElement(el.id);
    setEditingElementId(null);
    setShapePickerOpen(false);
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

  /** Swaps a photo in place - same id, same position/size on the slide, only the pixels
   * change (PowerPoint's own "Change Picture" does the same thing) - this plus the
   * template sample photos (lib/presentation/assets.ts) is what makes "download and send
   * it, just replacing photos or text" true for a whole deck, not only newly-inserted
   * images. */
  function handleReplaceImage(id: string, file: File) {
    const reader = new FileReader();
    reader.onload = () => updateElement(id, { dataUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  async function handleRemoveBackground(el: ImageElement) {
    setBgError(null);
    setRemovingBg(true);
    try {
      const dataUrl = await removeBackground(el.dataUrl);
      updateElement(el.id, { dataUrl });
    } catch (err) {
      setBgError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingBg(false);
    }
  }

  async function captureSlide(id: string) {
    const node = exportNodesRef.current.get(id);
    if (!node) return null;
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(node, { scale: 2, backgroundColor: null });
  }

  async function handleExportPng() {
    setExportError(null);
    setExportBusy("png");
    try {
      const canvas = await captureSlide(slide.id);
      if (!canvas) throw new Error("Couldn't render this slide.");
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `slide-${selectedSlide + 1}.png`;
      a.click();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportBusy(null);
    }
  }

  async function handleExportPdf() {
    setExportError(null);
    setExportBusy("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "in", format: [DECK_LAYOUT.widthIn, DECK_LAYOUT.heightIn] });
      for (let i = 0; i < slides.length; i++) {
        const canvas = await captureSlide(slides[i].id);
        if (!canvas) continue;
        if (i > 0) pdf.addPage([DECK_LAYOUT.widthIn, DECK_LAYOUT.heightIn], "landscape");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, DECK_LAYOUT.widthIn, DECK_LAYOUT.heightIn);
      }
      pdf.save("deck.pdf");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportBusy(null);
    }
  }

  async function handleInsertQrCode() {
    const text = window.prompt("URL or text for the QR code:");
    if (!text?.trim()) return;
    const dataUrl = await QRCode.toDataURL(text.trim(), { width: 480, margin: 1 });
    addElement({ ...newImage(dataUrl, 1, 1), wIn: 1.6, hIn: 1.6 });
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

  function addChartPoint(el: ChartElement) {
    updateElement(el.id, { labels: [...el.labels, `Item ${el.labels.length + 1}`], values: [...el.values, 1] });
  }
  function removeChartPoint(el: ChartElement) {
    if (el.labels.length <= 1) return;
    updateElement(el.id, { labels: el.labels.slice(0, -1), values: el.values.slice(0, -1) });
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
  const chartEl = selectedElement?.type === "chart" ? (selectedElement as ChartElement) : null;
  const imageEl = selectedElement?.type === "image" ? (selectedElement as ImageElement) : null;

  return (
    <div className="flex gap-4">
      <div className="flex max-h-[640px] shrink-0 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-surface-muted p-2">
        {slides.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-2">
            {s.section && s.section !== slides[i - 1]?.section && (
              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-foreground/50">{s.section}</p>
            )}
            <Thumbnail
              slide={s}
              selected={selectedSlide === i}
              onClick={() => {
                setSelectedSlide(i);
                setSelectedElementId(null);
              }}
            />
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addSlide}>
          + Add slide
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Ribbon tab bar - PowerPoint/Canva-style: one panel below, driven by activeTab */}
        <div className="flex items-center gap-1 border-b border-border">
          {TABS.map((tab) => {
            const disabled = tab.id === "format" && !selectedElement;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : disabled
                      ? "border-transparent text-foreground/25"
                      : "border-transparent text-foreground/60 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-b-md rounded-tr-md border border-t-0 border-border bg-surface p-2">
          {activeTab === "home" && (
            <div className="flex flex-wrap items-center gap-1.5">
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
                ⧉ Duplicate slide
              </Button>
              <Button variant="danger" size="sm" onClick={() => removeSlide(selectedSlide)} disabled={slides.length <= 1}>
                Remove slide
              </Button>
              <ToolbarDivider />
              <label className="flex items-center gap-1.5 text-xs text-foreground/60">
                Section
                <input
                  value={slide?.section ?? ""}
                  onChange={(e) => updateSlide(selectedSlide, { ...slide, section: e.target.value || undefined }, true)}
                  onBlur={stopEditing}
                  placeholder="e.g. Introduction"
                  className="w-28 rounded border border-border bg-surface px-1.5 py-1 text-xs outline-none focus:border-primary"
                />
              </label>
              <ToolbarDivider />
              <Button variant="ghost" size="sm" onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)">
                ↶ Undo
              </Button>
              <Button variant="ghost" size="sm" onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">
                ↷ Redo
              </Button>
              {canRewrite && (
                <>
                  <ToolbarDivider />
                  <AiRewriteControl label="Rewrite this slide" onApply={aiRewriteSlide} />
                </>
              )}
            </div>
          )}

          {activeTab === "insert" && (
            <div className="flex flex-wrap items-start gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => addElement(newTextBox())}>
                + Text box
              </Button>
              <div className="relative">
                <Button variant="secondary" size="sm" onClick={() => setShapePickerOpen((v) => !v)}>
                  + Shape ▾
                </Button>
                {shapePickerOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 grid grid-cols-4 gap-1.5 rounded-md border border-border bg-surface p-2 shadow-lg">
                    {SHAPE_KINDS.map((kind) => (
                      <button
                        key={kind.id}
                        type="button"
                        title={kind.label}
                        onClick={() => addElement(newShapeOfKind(kind.id))}
                        className="flex h-9 w-9 items-center justify-center rounded border border-border hover:border-primary"
                      >
                        <span
                          style={{ width: 20, height: kind.id === "line" ? 2 : 20, ...shapeStyle({ ...newShapeOfKind(kind.id), fill: "94A3B8" }) }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => addElement(newTable())}>
                + Table
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addElement(newChart("bar"))}>
                + Chart
              </Button>
              <Button variant="secondary" size="sm" onClick={() => imageInputRef.current?.click()}>
                + Image
              </Button>
              <Button variant="secondary" size="sm" onClick={handleInsertQrCode}>
                + QR code
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
          )}

          {activeTab === "design" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-foreground/50">Slide background</span>
              <div className="flex items-center gap-1">
                {BG_SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateSlide(selectedSlide, { ...slide, background: color })}
                    className={`h-6 w-6 rounded-full border ${slide?.background === color ? "ring-2 ring-primary" : "border-border"}`}
                    style={{ backgroundColor: `#${color}` }}
                    title={`#${color}`}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => commit(slides.map((s) => ({ ...s, background: slide.background })))}
                title="Slide Master-lite: recolors every slide's background to match this one"
              >
                Apply to all slides
              </Button>
              <p className="text-xs text-foreground/40">
                A whole deck&apos;s theme (used for text/decoration colors, not just background) is picked once, before opening a template or
                generating with AI - see the theme picker above the gallery.
              </p>
            </div>
          )}

          {activeTab === "format" &&
            (selectedElement ? (
              <div className="flex flex-wrap items-center gap-2">
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
                    <select
                      value={textEl.listStyle ?? "none"}
                      onChange={(e) => updateElement(textEl.id, { listStyle: e.target.value as TextElement["listStyle"] })}
                      className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
                      title="List style"
                    >
                      <option value="none">No list</option>
                      <option value="bullet">• Bullets</option>
                      <option value="number">1. Numbered</option>
                    </select>
                    <Button variant={textEl.shadow ? "primary" : "ghost"} size="sm" onClick={() => updateElement(textEl.id, { shadow: !textEl.shadow })} title="Drop shadow">
                      S
                    </Button>
                    <Button
                      variant={textEl.outline ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => updateElement(textEl.id, { outline: !textEl.outline })}
                      title="Outline (WordArt-style)"
                    >
                      O
                    </Button>
                  </>
                )}

                {selectedElement.type === "shape" && (
                  <>
                    <select
                      value={selectedElement.shape}
                      onChange={(e) => updateElement(selectedElement.id, { shape: e.target.value as typeof selectedElement.shape })}
                      className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
                    >
                      {SHAPE_KINDS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
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
                    <label className="flex items-center gap-1.5 text-xs text-foreground/60">
                      Rotate
                      <input
                        type="range"
                        min={0}
                        max={359}
                        value={selectedElement.rotate ?? 0}
                        onChange={(e) => updateElement(selectedElement.id, { rotate: Number(e.target.value) })}
                      />
                    </label>
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

                {chartEl && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={chartEl.chartKind}
                      onChange={(e) => updateElement(chartEl.id, { chartKind: e.target.value as ChartElement["chartKind"] })}
                      className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
                    >
                      {CHART_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k[0].toUpperCase() + k.slice(1)}
                        </option>
                      ))}
                    </select>
                    {chartEl.chartKind !== "pie" && (
                      <div className="flex items-center gap-1">
                        {TEXT_SWATCHES.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => updateElement(chartEl.id, { color })}
                            className={`h-5 w-5 rounded-full border ${chartEl.color === color ? "ring-2 ring-primary" : "border-border"}`}
                            style={{ backgroundColor: `#${color}` }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex max-w-xs flex-wrap items-center gap-1">
                      {chartEl.labels.map((label, i) => (
                        <span key={i} className="flex items-center gap-0.5 rounded border border-border bg-surface-muted px-1">
                          <input
                            value={label}
                            onChange={(e) =>
                              updateElement(chartEl.id, { labels: chartEl.labels.map((l, j) => (j === i ? e.target.value : l)) }, true)
                            }
                            className="w-14 border-0 bg-transparent px-0.5 py-0.5 text-xs outline-none"
                          />
                          <input
                            type="number"
                            value={chartEl.values[i]}
                            onChange={(e) =>
                              updateElement(
                                chartEl.id,
                                { values: chartEl.values.map((v, j) => (j === i ? Number(e.target.value) : v)) },
                                true,
                              )
                            }
                            className="w-12 border-0 bg-transparent px-0.5 py-0.5 text-xs outline-none"
                          />
                        </span>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => addChartPoint(chartEl)}>
                      + Point
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeChartPoint(chartEl)} disabled={chartEl.labels.length <= 1}>
                      - Point
                    </Button>
                  </div>
                )}

                {imageEl && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => replaceImageInputRef.current?.click()}>
                      Replace photo
                    </Button>
                    <input
                      ref={replaceImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleReplaceImage(imageEl.id, file);
                        e.target.value = "";
                      }}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-foreground/60">
                      Alt text
                      <input
                        value={imageEl.alt ?? ""}
                        onChange={(e) => updateElement(imageEl.id, { alt: e.target.value }, true)}
                        placeholder="Describe this image for screen readers"
                        className="w-48 rounded border border-border bg-surface px-1.5 py-1 text-xs outline-none focus:border-primary"
                      />
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRemoveBackground(imageEl)}
                      disabled={removingBg}
                      title="Keys out the color at the image's corners - best for a plain/solid background, not a real subject-detection model"
                    >
                      {removingBg ? "Removing..." : "Remove background"}
                    </Button>
                    {bgError && <p className="text-xs text-red-700 dark:text-red-400">{bgError}</p>}
                  </>
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
            ) : (
              <p className="text-xs text-foreground/40">Select an element on the slide to format it.</p>
            ))}

          {activeTab === "view" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => setNotesOpen((v) => !v)}>
                📝 {notesOpen ? "Hide" : "Show"} speaker notes
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPng} disabled={exportBusy !== null}>
                {exportBusy === "png" ? "Rendering..." : "Export slide as PNG"}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportPdf} disabled={exportBusy !== null}>
                {exportBusy === "pdf" ? "Rendering..." : "Export deck as PDF"}
              </Button>
              {exportError && <p className="text-xs text-red-700 dark:text-red-400">{exportError}</p>}
              <p className="text-xs text-foreground/40">
                Click an element to select it, drag its edges to resize, double-click text or a table cell to type. Delete/Backspace removes
                the selected element, Ctrl+Z / Ctrl+Shift+Z undo/redo, Escape deselects.
              </p>
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <div className="mx-auto w-fit rounded-md border border-border bg-white shadow-sm">
            <SlideCanvas
              slide={slide}
              editable
              selectedId={selectedElementId}
              editingId={editingElementId}
              onSelect={selectElement}
              onStartEditing={setEditingElementId}
              onStopEditing={stopEditing}
              onElementChange={updateElement}
            />
          </div>
        </div>

        {notesOpen && (
          <div className="rounded-md border border-border bg-surface p-2">
            <p className="mb-1 text-xs font-medium text-foreground/60">📝 Speaker notes</p>
            <textarea
              value={slide?.notes ?? ""}
              onChange={(e) => updateSlide(selectedSlide, { ...slide, notes: e.target.value }, true)}
              onBlur={stopEditing}
              rows={3}
              placeholder="Notes for this slide - not shown on the slide itself, only when presenting from PowerPoint."
              className="w-full resize-y rounded border border-border bg-surface-muted px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* Off-screen, chrome-free static renders of every slide - see captureSlide, used
          only by the PNG/PDF export buttons above so the exported image never includes
          react-rnd's selection outlines/resize handles. */}
      <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden>
        {slides.map((s) => (
          <div
            key={s.id}
            ref={(el) => {
              if (el) exportNodesRef.current.set(s.id, el);
              else exportNodesRef.current.delete(s.id);
            }}
          >
            <SlideCanvas slide={s} editable={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
