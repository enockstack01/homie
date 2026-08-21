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
export const FONT_FAMILIES = [
  "Arial",
  "Georgia",
  "Verdana",
  "Times New Roman",
  "Trebuchet MS",
  "Courier New",
  "Cambria",
  "Constantia",
  "Garamond",
  "Book Antiqua",
  "Century Gothic",
  "Franklin Gothic Medium",
  "Segoe UI",
  "Calibri",
  "Monotype Corsiva",
  "Bahnschrift",
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

/** Named heading+body font pairings (Section 3.C's "typography is a system, not a
 * default") - every font referenced here comes preinstalled with Windows/Office, since
 * this app has no way to license or embed a custom font file into an exported .pptx;
 * that constraint is exactly why these are the specific fonts picked, not a Google Fonts
 * wishlist that would silently fall back to a default on most viewers' machines. */
export interface FontPairing {
  id: string;
  name: string;
  heading: FontFamily;
  body: FontFamily;
}

export const FONT_PAIRINGS: FontPairing[] = [
  { id: "editorial-serif", name: "Editorial Serif", heading: "Cambria", body: "Georgia" },
  { id: "modern-grotesk", name: "Modern Grotesk", heading: "Century Gothic", body: "Calibri" },
  { id: "elegant-script", name: "Elegant Script", heading: "Monotype Corsiva", body: "Book Antiqua" },
  { id: "bold-display", name: "Bold Display", heading: "Franklin Gothic Medium", body: "Trebuchet MS" },
  { id: "classic-serif", name: "Classic Serif", heading: "Garamond", body: "Constantia" },
  { id: "clean-sans", name: "Clean Sans", heading: "Segoe UI", body: "Verdana" },
];

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
 * Slide made of a decorative shape composition plus two text elements. `coverImage`
 * (a lib/presentation/assets.ts path, or any image element's dataUrl) is optional - when
 * given, it fills the whole slide behind everything else with a tinted photo, the same
 * pattern lib/presentation/designedTemplates.ts's own cover slides use, so a template
 * downloads looking like a finished sample instead of a flat-color placeholder. */
export function titleSlide(
  title: string,
  primary: string = PRIMARY,
  accent: string = ACCENT,
  style: CoverStyle = "circles",
  coverImage?: string,
): Slide {
  return {
    id: newId(),
    background: primary,
    elements: [
      ...(coverImage
        ? [
            { id: newId(), type: "image" as const, dataUrl: coverImage, xIn: 0, yIn: 0, wIn: DECK_LAYOUT.widthIn, hIn: DECK_LAYOUT.heightIn },
            {
              id: newId(),
              type: "shape" as const,
              shape: "rect" as const,
              fill: primary,
              opacity: 55,
              xIn: 0,
              yIn: 0,
              wIn: DECK_LAYOUT.widthIn,
              hIn: DECK_LAYOUT.heightIn,
            },
          ]
        : []),
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
 * draggable bullet objects) each become one role-tagged TextElement. Every content slide
 * also gets a real decorative composition so it doesn't look bare next to the decorated
 * cover: the left accent bar, a corner glyph sized and positioned to actually read on the
 * page (the previous version bled ~70% of itself off-canvas), a small secondary accent
 * dot, and - when `index`/`total` are given - a slide-number chip, the same finishing
 * detail a real deck always has. `index`/`total` are 1-based/inclusive of the cover, so a
 * 5-content-slide deck numbers its pages 2/6 through 6/6. */
export function slideFromPlan(
  plan: SlidePlan,
  primary: string = PRIMARY,
  accent: string = ACCENT,
  style: CoverStyle = "circles",
  index?: number,
  total?: number,
): Slide {
  const cornerGlyph: ShapeElement = {
    id: newId(),
    type: "shape",
    shape: CORNER_GLYPH[style],
    fill: accent,
    opacity: 55,
    xIn: 8.7,
    yIn: -0.25,
    wIn: 1.3,
    hIn: 1.3,
  };
  const cornerDot: ShapeElement = {
    id: newId(),
    type: "shape",
    shape: "ellipse",
    fill: primary,
    opacity: 20,
    xIn: 9.35,
    yIn: 4.85,
    wIn: 0.38,
    hIn: 0.38,
  };
  return {
    id: newId(),
    background: "FFFFFF",
    elements: [
      { id: newId(), type: "shape", shape: "rect", fill: primary, xIn: 0, yIn: 0, wIn: 0.14, hIn: DECK_LAYOUT.heightIn },
      cornerGlyph,
      cornerDot,
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
      ...(index && total
        ? [
            {
              id: newId(),
              type: "text" as const,
              text: `${index} / ${total}`,
              xIn: 8.9,
              yIn: 5.28,
              wIn: 0.9,
              hIn: 0.3,
              fontSize: 9,
              align: "right" as const,
              color: "9CA3AF",
            },
          ]
        : []),
    ],
  };
}

export function deckFromPlans(
  title: string,
  plans: SlidePlan[],
  primary: string = PRIMARY,
  accent: string = ACCENT,
  style: CoverStyle = "circles",
  coverImage?: string,
): Slide[] {
  const total = plans.length + 1;
  return [
    titleSlide(title, primary, accent, style, coverImage),
    ...plans.map((p, i) => slideFromPlan(p, primary, accent, style, i + 2, total)),
  ];
}

/** A brand-new blank slide, for DeckEditor.tsx's "+ Add slide" - just enough to not be
 * empty (one title-role text box) so it isn't a totally inert page. `pageSize` defaults
 * to the normal 16:9 deck - pass a print-format size (see printFormats.ts) so a new page
 * added to an invitation-sized document gets a sensibly-placed title instead of one
 * calibrated for the much wider landscape canvas. */
export function blankSlide(pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT): Slide {
  const wIn = Math.min(DECK_SLIDE_TITLE_BOX.wIn, pageSize.widthIn - DECK_SLIDE_TITLE_BOX.xIn * 2);
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
        wIn,
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
/** Every `newX()` factory below takes an optional `pageSize`, defaulting to the normal
 * 16:9 deck - DeckEditor.tsx passes the open document's actual layout (see
 * printFormats.ts) so a freshly-inserted text box, shape, table, chart, or image lands
 * centered and sensibly sized on whatever canvas is actually open, rather than always
 * assuming the 10x5.63in landscape deck (which would place things off-canvas, or
 * oddly-tiny/huge, on a 5.25x7.25in portrait invitation). */
export function newTextBox(pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT): TextElement {
  const wIn = Math.min(4, pageSize.widthIn - 1);
  return {
    id: newId(),
    type: "text",
    text: "New text",
    xIn: (pageSize.widthIn - wIn) / 2,
    yIn: pageSize.heightIn / 2 - 0.5,
    wIn,
    hIn: 1,
    fontSize: 20,
    color: TEXT_DARK,
  };
}

export function newShape(pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT): ShapeElement {
  return newShapeOfKind("rect", pageSize);
}

/** Inserts one of SHAPE_KINDS - DeckEditor.tsx's Insert-tab shape picker (a Canva/
 * PowerPoint "basic shapes" gallery, not just a single rectangle button). Lines get a
 * thin default box since a 3x2in line reads as an oversized diagonal rather than a
 * divider. */
export function newShapeOfKind(kind: ShapeKind, pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT): ShapeElement {
  const wIn = Math.min(3, pageSize.widthIn - 1);
  const xIn = (pageSize.widthIn - wIn) / 2;
  const yIn = pageSize.heightIn / 2 - 1;
  if (kind === "line") {
    return { id: newId(), type: "shape", shape: kind, fill: ACCENT, xIn, yIn: pageSize.heightIn / 2, wIn: Math.min(4, pageSize.widthIn - 1), hIn: 0.02 };
  }
  return { id: newId(), type: "shape", shape: kind, fill: ACCENT, xIn, yIn, wIn, hIn: 2 };
}

export function newTable(pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT): TableElement {
  const wIn = Math.min(7, pageSize.widthIn - 1);
  return {
    id: newId(),
    type: "table",
    headerRow: true,
    rows: [
      ["Column A", "Column B", "Column C"],
      ["", "", ""],
      ["", "", ""],
    ],
    xIn: (pageSize.widthIn - wIn) / 2,
    yIn: pageSize.heightIn / 2 - 1,
    wIn,
    hIn: 2,
  };
}

export function newChart(chartKind: ChartKind = "bar", pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT): ChartElement {
  const wIn = Math.min(7, pageSize.widthIn - 1);
  return {
    id: newId(),
    type: "chart",
    chartKind,
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [10, 22, 18, 30],
    color: PRIMARY,
    xIn: (pageSize.widthIn - wIn) / 2,
    yIn: pageSize.heightIn / 2 - 1.5,
    wIn,
    hIn: 3,
  };
}

/** Sizes a new image element to fit within a max box while preserving its real aspect
 * ratio, rather than stretching every upload into a fixed square. */
export function newImage(
  dataUrl: string,
  naturalWidth: number,
  naturalHeight: number,
  pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT,
): ImageElement {
  const maxWIn = Math.min(5, pageSize.widthIn - 1);
  const maxHIn = Math.min(3.5, pageSize.heightIn - 1);
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
    xIn: (pageSize.widthIn - wIn) / 2,
    yIn: (pageSize.heightIn - hIn) / 2,
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
