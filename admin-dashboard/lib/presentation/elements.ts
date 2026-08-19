import type { SlidePlan } from "./outline";
import {
  PRIMARY,
  ACCENT,
  TEXT_DARK,
  DECK_LAYOUT,
  DECK_TITLE_BOX,
  DECK_SUBTITLE_BOX,
  DECK_SLIDE_TITLE_BOX,
  DECK_BULLETS_BOX,
} from "./layout";

// The freeform, Canva-style data model: a deck is a plain array of slides, every slide a
// plain array of positioned elements - no more special-cased "title slide" type. AI
// generation and templates still speak the older, simpler {title, bullets} shape
// (SlidePlan, from outline.ts) because that's a far more reliable schema to get an LLM to
// produce than raw coordinates - slideFromPlan below is the one place that shape becomes
// real, independently draggable/resizable elements, seeded at the same positions
// lib/presentation/layout.ts already defines so a freshly generated or templated deck
// looks identical to the old fixed layout until the user actually moves something.

export type TextAlign = "left" | "center" | "right";
export const FONT_FAMILIES = ["Arial", "Georgia", "Verdana", "Times New Roman", "Trebuchet MS", "Courier New"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

/** Curated PowerPoint/Canva "basic shapes" - `pptx` is the exact PptxGenJS ShapeType key
 * (lib/presentation/renderDeck.ts looks it up directly, `pres.ShapeType[pptx]`), `clip`
 * is the CSS clip-path polygon SlideCanvas.tsx uses so the on-screen preview roughly
 * matches (rect/roundRect/ellipse/donut/line need no clip-path - plain CSS covers them). */
export const SHAPE_KINDS = [
  { id: "rect", label: "Rectangle", pptx: "rect" },
  { id: "roundRect", label: "Rounded rectangle", pptx: "roundRect" },
  { id: "ellipse", label: "Circle", pptx: "ellipse" },
  { id: "donut", label: "Ring", pptx: "donut" },
  { id: "triangle", label: "Triangle", pptx: "triangle", clip: "polygon(50% 0%, 0% 100%, 100% 100%)" },
  { id: "diamond", label: "Diamond", pptx: "diamond", clip: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
  {
    id: "pentagon",
    label: "Pentagon",
    pptx: "pentagon",
    clip: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  },
  {
    id: "hexagon",
    label: "Hexagon",
    pptx: "hexagon",
    clip: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  },
  {
    id: "star5",
    label: "Star",
    pptx: "star5",
    clip: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  },
  {
    id: "arrowRight",
    label: "Arrow",
    pptx: "rightArrow",
    clip: "polygon(0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%)",
  },
  { id: "chevron", label: "Chevron", pptx: "chevron", clip: "polygon(0% 0%, 65% 0%, 100% 50%, 65% 100%, 0% 100%, 35% 50%)" },
  { id: "line", label: "Line", pptx: "line" },
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number]["id"];

export interface BaseElement {
  id: string;
  xIn: number;
  yIn: number;
  wIn: number;
  hIn: number;
}

/** `role` marks an element as "the thing AI rewrite updates" (see DeckEditor.tsx's
 * extractPlanFromSlide/applyPlanToSlide) - freeform elements added by the user (a text
 * box, a shape, an image, a table) have no role and are left untouched by AI rewrite. */
/** Real PptxGenJS bullet/number formatting, not literal "• " characters typed into the
 * string - lines in `text` are one list item each; a line's leading tab characters set
 * its indent level (PowerPoint's "multiple levels"), stripped from the visible text.
 * "none" (the default) renders `text` as plain paragraphs, for titles/freeform boxes. */
export type ListStyle = "none" | "bullet" | "number";

export interface TextElement extends BaseElement {
  type: "text";
  role?: "title" | "body";
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: FontFamily;
  bold?: boolean;
  italic?: boolean;
  align?: TextAlign;
  listStyle?: ListStyle;
  /** WordArt-lite text effects - a real drop shadow / stroke outline via PptxGenJS's own
   * `shadow`/`outline` text options, not a full WordArt style gallery. */
  shadow?: boolean;
  outline?: boolean;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  /** 0-100, defaults to 100 (fully opaque) - what makes the overlapping-circle "designed
   * cover graphic" look (see decorativeAccents below) possible without needing actual
   * photography, which this app has no legitimate way to source. */
  opacity?: number;
  /** Degrees, clockwise - only really matters for non-radially-symmetric shapes
   * (rect/triangle/arrow/chevron), used by the cover-graphic compositions below to turn
   * plain bands into angled ones. */
  rotate?: number;
}

export interface ImageElement extends BaseElement {
  type: "image";
  dataUrl: string;
  /** Alt text for screen readers, exported via PptxGenJS's altText - the one real,
   * honest piece of "Accessibility Checker" this app has (a full checker that scans a
   * whole deck for issues is a bigger, separate feature this pass doesn't build). */
  alt?: string;
}

export interface TableElement extends BaseElement {
  type: "table";
  rows: string[][];
  headerRow?: boolean;
}

export const CHART_KINDS = ["bar", "line", "pie"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

/** Deliberately single-series (one label + one value per row) rather than PowerPoint's
 * full multi-series/linked-Excel-data model - a plain "small chart from a short table"
 * covers the common case (a handful of stats on a slide) without needing a spreadsheet
 * editor built into the deck editor. */
export interface ChartElement extends BaseElement {
  type: "chart";
  chartKind: ChartKind;
  labels: string[];
  values: number[];
  color: string;
}

export type SlideElement = TextElement | ShapeElement | ImageElement | TableElement | ChartElement;

export interface Slide {
  id: string;
  background: string;
  elements: SlideElement[];
  /** Speaker notes - exported via PptxGenJS's addNotes (lib/presentation/renderDeck.ts),
   * never shown on the slide itself. */
  notes?: string;
  /** Groups slides in DeckEditor.tsx's thumbnail rail (PowerPoint's "Section
   * organization") - undefined means "no section", not an error. */
  section?: string;
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `el_${Date.now().toString(36)}_${counter}`;
}

function cloneElement(el: SlideElement): SlideElement {
  return { ...el, id: newId() };
}

/** Real, distinct cover-graphic compositions - what "templates should have different
 * looks/different images" means here: each built-in template is mapped (TEMPLATE_STYLES,
 * below) to one of these, so the gallery actually shows visual variety instead of the
 * same shapes recolored. Every one is a handful of overlapping, semi-transparent native
 * PowerPoint shapes in the deck's own two theme colors - a real, infinitely-crisp,
 * fully editable/movable composition, not a fake stock photo - this app has no licensed
 * image library or stock-photo API to draw a real one from. */
export type CoverStyle = "circles" | "diagonal" | "wedge" | "ringDot" | "confetti" | "wave" | "none";

function accentCircles(primary: string, accent: string): ShapeElement[] {
  return [
    { id: newId(), type: "shape", shape: "ellipse", fill: accent, opacity: 22, xIn: 6.9, yIn: -1.2, wIn: 4.5, hIn: 4.5 },
    { id: newId(), type: "shape", shape: "ellipse", fill: "FFFFFF", opacity: 12, xIn: 8.2, yIn: 2.6, wIn: 3, hIn: 3 },
    { id: newId(), type: "shape", shape: "ellipse", fill: primary, opacity: 35, xIn: -1.5, yIn: 3.6, wIn: 4, hIn: 4 },
  ];
}

function accentDiagonal(primary: string, accent: string): ShapeElement[] {
  return [
    { id: newId(), type: "shape", shape: "rect", fill: accent, opacity: 20, xIn: 6.5, yIn: -1.4, wIn: 7, hIn: 1.1, rotate: 25 },
    { id: newId(), type: "shape", shape: "rect", fill: "FFFFFF", opacity: 12, xIn: 7.4, yIn: 0.1, wIn: 7, hIn: 0.7, rotate: 25 },
    { id: newId(), type: "shape", shape: "rect", fill: accent, opacity: 30, xIn: 8.1, yIn: 1.2, wIn: 7, hIn: 0.5, rotate: 25 },
  ];
}

function accentWedge(primary: string, accent: string): ShapeElement[] {
  return [
    { id: newId(), type: "shape", shape: "triangle", fill: accent, opacity: 25, xIn: 6.8, yIn: -1.6, wIn: 5.2, hIn: 5.2, rotate: 130 },
    { id: newId(), type: "shape", shape: "ellipse", fill: "FFFFFF", opacity: 15, xIn: 0.3, yIn: 3.9, wIn: 1.6, hIn: 1.6 },
  ];
}

function accentRingDot(primary: string, accent: string): ShapeElement[] {
  return [
    { id: newId(), type: "shape", shape: "donut", fill: accent, opacity: 40, xIn: 7.5, yIn: -1.1, wIn: 3.8, hIn: 3.8 },
    { id: newId(), type: "shape", shape: "ellipse", fill: accent, opacity: 85, xIn: 0.55, yIn: 4.15, wIn: 0.5, hIn: 0.5 },
    { id: newId(), type: "shape", shape: "ellipse", fill: "FFFFFF", opacity: 25, xIn: 1.25, yIn: 4.45, wIn: 0.28, hIn: 0.28 },
  ];
}

function accentConfetti(primary: string, accent: string): ShapeElement[] {
  return [
    { id: newId(), type: "shape", shape: "star5", fill: accent, opacity: 75, xIn: 8.6, yIn: 0.35, wIn: 0.55, hIn: 0.55, rotate: 12 },
    { id: newId(), type: "shape", shape: "ellipse", fill: "FFFFFF", opacity: 50, xIn: 9.15, yIn: 1.25, wIn: 0.3, hIn: 0.3 },
    { id: newId(), type: "shape", shape: "star5", fill: "FFFFFF", opacity: 45, xIn: 0.5, yIn: 4.3, wIn: 0.4, hIn: 0.4, rotate: -8 },
    { id: newId(), type: "shape", shape: "ellipse", fill: accent, opacity: 60, xIn: 0.2, yIn: 0.5, wIn: 0.3, hIn: 0.3 },
    { id: newId(), type: "shape", shape: "ellipse", fill: accent, opacity: 30, xIn: 9.3, yIn: 3.6, wIn: 0.9, hIn: 0.9 },
  ];
}

function accentWave(primary: string, accent: string): ShapeElement[] {
  return [
    { id: newId(), type: "shape", shape: "chevron", fill: accent, opacity: 22, xIn: -1, yIn: 4.3, wIn: 6, hIn: 1.6, rotate: 8 },
    { id: newId(), type: "shape", shape: "chevron", fill: "FFFFFF", opacity: 14, xIn: 3.5, yIn: 4.5, wIn: 8, hIn: 1.6, rotate: -6 },
    { id: newId(), type: "shape", shape: "ellipse", fill: "FFFFFF", opacity: 14, xIn: 8.2, yIn: -1.1, wIn: 2.6, hIn: 2.6 },
  ];
}

const COVER_STYLES: Record<CoverStyle, (primary: string, accent: string) => ShapeElement[]> = {
  circles: accentCircles,
  diagonal: accentDiagonal,
  wedge: accentWedge,
  ringDot: accentRingDot,
  confetti: accentConfetti,
  wave: accentWave,
  none: () => [],
};

/** The small corner accent every content slide gets (see slideFromPlan) - one shape kind
 * per cover style so a templated deck's content slides visually match its cover. */
const CORNER_GLYPH: Record<CoverStyle, ShapeKind> = {
  circles: "ellipse",
  diagonal: "rect",
  wedge: "triangle",
  ringDot: "donut",
  confetti: "star5",
  wave: "chevron",
  none: "ellipse",
};

export function coverAccents(style: CoverStyle, primary: string, accent: string): ShapeElement[] {
  return (COVER_STYLES[style] ?? accentCircles)(primary, accent);
}

/** Which cover style each built-in template (lib/presentation/templates.ts) uses -
 * PresentationStudio.tsx reads this when opening a template or rendering its gallery
 * thumbnail. AI-generated decks default to "circles" (deckFromPlans's default param). */
export const TEMPLATE_STYLES: Record<string, CoverStyle> = {
  "business-pitch": "diagonal",
  "project-status": "ringDot",
  "team-update": "confetti",
  "product-launch": "wedge",
  "lesson-plan": "wave",
  "blank-deck": "none",
};

/** The auto-generated first page of a new deck - same visual as the old fixed "title
 * slide" (renderDeck.ts's original hardcoded first addSlide call), now just an ordinary
 * Slide made of a decorative shape composition plus two text elements. */
export function titleSlide(title: string, primary: string = PRIMARY, accent: string = ACCENT, style: CoverStyle = "circles"): Slide {
  return {
    id: newId(),
    background: primary,
    elements: [
      ...coverAccents(style, primary, accent),
      {
        id: newId(),
        type: "text",
        role: "title",
        text: title,
        xIn: DECK_TITLE_BOX.xIn,
        yIn: DECK_TITLE_BOX.yIn,
        wIn: DECK_TITLE_BOX.wIn,
        hIn: DECK_TITLE_BOX.hIn,
        fontSize: DECK_TITLE_BOX.fontSize,
        color: "FFFFFF",
        bold: true,
      },
      {
        id: newId(),
        type: "text",
        text: "Generated by Homie Presentation",
        xIn: DECK_SUBTITLE_BOX.xIn,
        yIn: DECK_SUBTITLE_BOX.yIn,
        wIn: DECK_SUBTITLE_BOX.wIn,
        hIn: DECK_SUBTITLE_BOX.hIn,
        fontSize: DECK_SUBTITLE_BOX.fontSize,
        color: accent,
      },
    ],
  };
}

/** One content slide from a {title, bullets} plan - the title and the bullets (joined as
 * one multi-line text box, same as a normal Canva body text box rather than N separate
 * draggable bullet objects) each become one role-tagged TextElement, plus a small corner
 * accent bar so content slides don't look bare next to the decorated cover. */
export function slideFromPlan(plan: SlidePlan, primary: string = PRIMARY, accent: string = ACCENT, style: CoverStyle = "circles"): Slide {
  const cornerGlyph: ShapeElement = {
    id: newId(),
    type: "shape",
    shape: CORNER_GLYPH[style],
    fill: accent,
    opacity: 60,
    xIn: 9.55,
    yIn: -0.35,
    wIn: 0.9,
    hIn: 0.9,
  };
  return {
    id: newId(),
    background: "FFFFFF",
    elements: [
      { id: newId(), type: "shape", shape: "rect", fill: primary, xIn: 0, yIn: 0, wIn: 0.12, hIn: DECK_LAYOUT.heightIn },
      ...(style === "none" ? [] : [cornerGlyph]),
      {
        id: newId(),
        type: "text",
        role: "title",
        text: plan.title,
        xIn: DECK_SLIDE_TITLE_BOX.xIn,
        yIn: DECK_SLIDE_TITLE_BOX.yIn,
        wIn: DECK_SLIDE_TITLE_BOX.wIn,
        hIn: DECK_SLIDE_TITLE_BOX.hIn,
        fontSize: DECK_SLIDE_TITLE_BOX.fontSize,
        color: primary,
        bold: true,
      },
      {
        id: newId(),
        type: "text",
        role: "body",
        text: plan.bullets.join("\n"),
        listStyle: "bullet",
        xIn: DECK_BULLETS_BOX.xIn,
        yIn: DECK_BULLETS_BOX.yIn,
        wIn: DECK_BULLETS_BOX.wIn,
        hIn: DECK_BULLETS_BOX.hIn,
        fontSize: DECK_BULLETS_BOX.fontSize,
        color: TEXT_DARK,
      },
    ],
  };
}

export function deckFromPlans(
  title: string,
  plans: SlidePlan[],
  primary: string = PRIMARY,
  accent: string = ACCENT,
  style: CoverStyle = "circles",
): Slide[] {
  return [titleSlide(title, primary, accent, style), ...plans.map((p) => slideFromPlan(p, primary, accent, style))];
}

/** A brand-new blank slide, for DeckEditor.tsx's "+ Add slide" - just enough to not be
 * empty (one title-role text box) so it isn't a totally inert page. */
export function blankSlide(): Slide {
  return {
    id: newId(),
    background: "FFFFFF",
    elements: [
      {
        id: newId(),
        type: "text",
        role: "title",
        text: "New slide",
        xIn: DECK_SLIDE_TITLE_BOX.xIn,
        yIn: DECK_SLIDE_TITLE_BOX.yIn,
        wIn: DECK_SLIDE_TITLE_BOX.wIn,
        hIn: DECK_SLIDE_TITLE_BOX.hIn,
        fontSize: DECK_SLIDE_TITLE_BOX.fontSize,
        color: PRIMARY,
        bold: true,
      },
    ],
  };
}

/** Deep-clones a slide with fresh element ids, for DeckEditor.tsx's "Duplicate slide". */
export function duplicateSlide(slide: Slide): Slide {
  return { ...slide, id: newId(), elements: slide.elements.map(cloneElement) };
}

/** Clones one element with a fresh id and a small position offset, so the copy is
 * visible next to the original instead of stacked exactly on top of it - DeckEditor.tsx's
 * "Duplicate element". */
export function duplicateElement(el: SlideElement): SlideElement {
  return { ...cloneElement(el), xIn: el.xIn + 0.25, yIn: el.yIn + 0.25 };
}

/** A freeform text box the user inserts via DeckEditor.tsx's "+ Text" button - deliberately
 * has no `role`, so AI rewrite (which only touches role-tagged elements) never touches it. */
export function newTextBox(): TextElement {
  return {
    id: newId(),
    type: "text",
    text: "New text",
    xIn: 3,
    yIn: 2.3,
    wIn: 4,
    hIn: 1,
    fontSize: 20,
    color: TEXT_DARK,
  };
}

export function newShape(): ShapeElement {
  return newShapeOfKind("rect");
}

/** Inserts one of SHAPE_KINDS - DeckEditor.tsx's Insert-tab shape picker (a Canva/
 * PowerPoint "basic shapes" gallery, not just a single rectangle button). Lines get a
 * thin default box since a 3x2in line reads as an oversized diagonal rather than a
 * divider. */
export function newShapeOfKind(kind: ShapeKind): ShapeElement {
  if (kind === "line") {
    return { id: newId(), type: "shape", shape: kind, fill: ACCENT, xIn: 3, yIn: 3, wIn: 4, hIn: 0.02 };
  }
  return { id: newId(), type: "shape", shape: kind, fill: ACCENT, xIn: 3.5, yIn: 2, wIn: 3, hIn: 2 };
}

export function newTable(): TableElement {
  return {
    id: newId(),
    type: "table",
    headerRow: true,
    rows: [
      ["Column A", "Column B", "Column C"],
      ["", "", ""],
      ["", "", ""],
    ],
    xIn: 1.5,
    yIn: 1.8,
    wIn: 7,
    hIn: 2,
  };
}

export function newChart(chartKind: ChartKind = "bar"): ChartElement {
  return {
    id: newId(),
    type: "chart",
    chartKind,
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [10, 22, 18, 30],
    color: PRIMARY,
    xIn: 1.5,
    yIn: 1.5,
    wIn: 7,
    hIn: 3,
  };
}

/** Sizes a new image element to fit within a max box while preserving its real aspect
 * ratio, rather than stretching every upload into a fixed square. */
export function newImage(dataUrl: string, naturalWidth: number, naturalHeight: number): ImageElement {
  const maxWIn = 5;
  const maxHIn = 3.5;
  const aspect = naturalWidth / naturalHeight || 1;
  let wIn = maxWIn;
  let hIn = wIn / aspect;
  if (hIn > maxHIn) {
    hIn = maxHIn;
    wIn = hIn * aspect;
  }
  return {
    id: newId(),
    type: "image",
    dataUrl,
    xIn: (DECK_LAYOUT.widthIn - wIn) / 2,
    yIn: (DECK_LAYOUT.heightIn - hIn) / 2,
    wIn,
    hIn,
  };
}

/** Moves one element forward/backward in the render/stacking order (array order = layer
 * order, last = frontmost) - DeckEditor.tsx's "Bring forward"/"Send backward". */
export function reorderElement(elements: SlideElement[], id: string, direction: "forward" | "backward" | "front" | "back"): SlideElement[] {
  const index = elements.findIndex((el) => el.id === id);
  if (index === -1) return elements;
  const next = [...elements];
  const [el] = next.splice(index, 1);
  if (direction === "front") next.push(el);
  else if (direction === "back") next.unshift(el);
  else if (direction === "forward") next.splice(Math.min(index + 1, next.length), 0, el);
  else next.splice(Math.max(index - 1, 0), 0, el);
  return next;
}

/** Reads the current title/body text back out of a slide's role-tagged elements, for
 * sending to the billed AI-rewrite route (which still speaks the simpler {title,
 * bullets} shape) - null if the user deleted those elements entirely, in which case
 * DeckEditor hides the AI-rewrite control rather than send a nonsensical request. */
export function extractPlanFromSlide(slide: Slide): SlidePlan | null {
  const titleEl = slide.elements.find((el): el is TextElement => el.type === "text" && el.role === "title");
  const bodyEl = slide.elements.find((el): el is TextElement => el.type === "text" && el.role === "body");
  if (!titleEl) return null;
  const bullets = (bodyEl?.text ?? "")
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
  return { title: titleEl.text, bullets: bullets.length > 0 ? bullets : ["..."] };
}

/** Inverse of extractPlanFromSlide - writes an AI-rewritten {title, bullets} back into
 * the slide's existing title/body elements in place, so their position/size/color/style
 * (and any other freeform elements on the slide) survive the rewrite untouched. */
export function applyPlanToSlide(slide: Slide, plan: SlidePlan): Slide {
  return {
    ...slide,
    elements: slide.elements.map((el) => {
      if (el.type !== "text") return el;
      if (el.role === "title") return { ...el, text: plan.title };
      if (el.role === "body") return { ...el, text: plan.bullets.join("\n") };
      return el;
    }),
  };
}
