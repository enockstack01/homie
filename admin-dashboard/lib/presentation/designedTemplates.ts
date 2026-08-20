import { newId, type Slide, type SlideElement, type TextElement, type ShapeElement, type ImageElement } from "./elements";
import { DECK_LAYOUT } from "./layout";
import { SAMPLE_IMAGES } from "./assets";

// Bespoke, hand-laid-out templates - unlike lib/presentation/templates.ts's other deck
// templates (a plain {title, bullets} SlidePlan[] run through elements.ts's
// slideFromPlan, always the same title-and-body layout), every slide here is its own
// freeform element composition. This is what "build the best designs" turned into after
// research (see the design trends cited in the commit this file was added in): 2026
// presentation design leans on huge bold typography as the main visual element, "bento
// grid" cards of stats/metrics, and a single narrated data point per slide rather than a
// wall of bullets - patterns applied here as real, original layouts (not a copy of any
// specific copyrighted Canva file, which this app has no license to reproduce).

const CARD_FILL = "F1F5F4";
const QUOTE_GLYPH_COLOR = "E5E7EB";
const FAINT_NUMBER_COLOR = "EDEFEE";

function text(partial: Omit<TextElement, "id" | "type">): TextElement {
  return { id: newId(), type: "text", ...partial };
}
function box(partial: Omit<ShapeElement, "id" | "type">): ShapeElement {
  return { id: newId(), type: "shape", ...partial };
}
function slide(background: string, elements: SlideElement[]): Slide {
  return { id: newId(), background, elements };
}
function photo(partial: Omit<ImageElement, "id" | "type">): ImageElement {
  return { id: newId(), type: "image", ...partial };
}
/** Full-bleed cover photo + a translucent color tint over it, so a bold white/light title
 * on top stays legible regardless of what's in the photo - the same pattern
 * renderFlyer.ts/FlyerCanvas.tsx use for a flyer's hero image. */
function coverPhoto(dataUrl: string, tint: string, alt: string): [ImageElement, ShapeElement] {
  return [
    photo({ dataUrl, alt, xIn: 0, yIn: 0, wIn: DECK_LAYOUT.widthIn, hIn: DECK_LAYOUT.heightIn }),
    box({ shape: "rect", fill: tint, opacity: 55, xIn: 0, yIn: 0, wIn: DECK_LAYOUT.widthIn, hIn: DECK_LAYOUT.heightIn }),
  ];
}

/** "Pitch Deck (Modern)" - the essential investor-pitch slide set (Problem, Solution,
 * Market/Traction, Team, Ask) research turned up as the standard structure, laid out with
 * 2026's bold-typography/bento-grid/single-stat-callout conventions instead of the
 * classic bullet list "Business Pitch" template already covers. */
export function pitchDeckModern(primary: string, accent: string): Slide[] {
  const cover = slide(primary, [
    ...coverPhoto(SAMPLE_IMAGES.officeBoardroom, primary, "Modern boardroom - replace with your own photo"),
    box({ shape: "roundRect", fill: accent, opacity: 18, xIn: 6.6, yIn: -1.4, wIn: 4.6, hIn: 4.6, rotate: 12 }),
    text({ role: "title", text: "Your Company", xIn: 0.7, yIn: 1.85, wIn: 8.4, hIn: 1.5, fontSize: 54, bold: true, color: "FFFFFF" }),
    text({ text: "One bold line about what you do and who it's for", xIn: 0.7, yIn: 3.3, wIn: 7.8, hIn: 0.55, fontSize: 16, color: accent }),
    text({ text: "[Founder name]  ·  [Month Year]", xIn: 0.7, yIn: 4.85, wIn: 6, hIn: 0.4, fontSize: 12, color: "FFFFFF" }),
  ]);

  const problem = slide("FFFFFF", [
    text({ text: "THE PROBLEM", xIn: 0.7, yIn: 0.55, wIn: 4, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    text({ text: "73%", xIn: 0.55, yIn: 1.3, wIn: 4.3, hIn: 2.2, fontSize: 110, bold: true, color: primary }),
    text({
      text: "of [target customers] say [the core pain point] costs them real time and money every single week.",
      xIn: 5.3,
      yIn: 1.9,
      wIn: 4.1,
      hIn: 1.9,
      fontSize: 18,
      color: "101914",
    }),
    box({ shape: "rect", fill: accent, xIn: 0.7, yIn: 5.1, wIn: 1.4, hIn: 0.06 }),
  ]);

  const solution = slide("FFFFFF", [
    text({ text: "OUR SOLUTION", xIn: 0.7, yIn: 0.55, wIn: 4, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    text({
      role: "title",
      text: "What we built, in one sentence.",
      xIn: 0.7,
      yIn: 1.15,
      wIn: 4.2,
      hIn: 1.8,
      fontSize: 28,
      bold: true,
      color: "101914",
    }),
    text({
      text: "Why it's different from everything they've tried before - the core value, plainly stated.",
      xIn: 0.7,
      yIn: 3.05,
      wIn: 4.0,
      hIn: 1.2,
      fontSize: 14,
      color: "101914",
    }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3, yIn: 0.55, wIn: 4.0, hIn: 1.3 }),
    text({ text: "Feature one", xIn: 5.6, yIn: 0.75, wIn: 3.5, hIn: 0.4, fontSize: 16, bold: true, color: primary }),
    text({ text: "Short benefit line explaining the win.", xIn: 5.6, yIn: 1.15, wIn: 3.5, hIn: 0.6, fontSize: 12, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3, yIn: 2.1, wIn: 4.0, hIn: 1.3 }),
    text({ text: "Feature two", xIn: 5.6, yIn: 2.3, wIn: 3.5, hIn: 0.4, fontSize: 16, bold: true, color: primary }),
    text({ text: "Short benefit line explaining the win.", xIn: 5.6, yIn: 2.7, wIn: 3.5, hIn: 0.6, fontSize: 12, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3, yIn: 3.65, wIn: 4.0, hIn: 1.3 }),
    text({ text: "Feature three", xIn: 5.6, yIn: 3.85, wIn: 3.5, hIn: 0.4, fontSize: 16, bold: true, color: primary }),
    text({ text: "Short benefit line explaining the win.", xIn: 5.6, yIn: 4.25, wIn: 3.5, hIn: 0.6, fontSize: 12, color: "101914" }),
  ]);

  const traction = slide("FFFFFF", [
    text({ text: "MARKET & TRACTION", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "$4.2B", xIn: 0.85, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Total addressable market", xIn: 0.85, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "150K", xIn: 5.4, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Active users", xIn: 5.4, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "+40%", xIn: 0.85, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Month-over-month growth", xIn: 0.85, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "12", xIn: 5.4, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Countries with paying customers", xIn: 5.4, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
  ]);

  const team = slide("FFFFFF", [
    text({ text: "TEAM", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.7875, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "[Name]", xIn: 0.6, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "[Role]", xIn: 0.6, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 3.0625, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "[Name]", xIn: 2.875, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "[Role]", xIn: 2.875, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3375, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "[Name]", xIn: 5.15, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "[Role]", xIn: 5.15, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 7.6125, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "[Name]", xIn: 7.425, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "[Role]", xIn: 7.425, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
  ]);

  const ask = slide(primary, [
    box({ shape: "ellipse", fill: accent, opacity: 16, xIn: 7.2, yIn: -1.5, wIn: 4, hIn: 4 }),
    text({ role: "title", text: "Raising $[Amount]", xIn: 0.7, yIn: 1.7, wIn: 8.4, hIn: 1.3, fontSize: 44, bold: true, color: "FFFFFF" }),
    text({
      text: "to reach [milestone] within [timeframe] - joining us means [why now].",
      xIn: 0.7,
      yIn: 3.0,
      wIn: 7.6,
      hIn: 0.8,
      fontSize: 16,
      color: accent,
    }),
    text({ text: "[email]  ·  [website]", xIn: 0.7, yIn: 4.9, wIn: 6, hIn: 0.4, fontSize: 12, color: "FFFFFF" }),
  ]);

  return [cover, problem, solution, traction, team, ask];
}

/** "Marketing Report" - a KPI-dashboard-style deck: a bento grid of headline metrics, one
 * chart with the conclusion stated in its own headline rather than left for the reader to
 * find (2026's "narrate the data" convention), and a pull-quote/testimonial slide. */
export function marketingReport(primary: string, accent: string): Slide[] {
  const cover = slide(primary, [
    ...coverPhoto(SAMPLE_IMAGES.citySkyline, primary, "City skyline - replace with your own photo"),
    box({ shape: "roundRect", fill: accent, opacity: 18, xIn: -1.5, yIn: -1.2, wIn: 4.2, hIn: 4.2, rotate: -10 }),
    text({ role: "title", text: "Marketing Report", xIn: 0.7, yIn: 2.0, wIn: 8.4, hIn: 1.3, fontSize: 46, bold: true, color: "FFFFFF" }),
    text({ text: "[Reporting period]  ·  Prepared by [Your team]", xIn: 0.7, yIn: 3.25, wIn: 7.8, hIn: 0.5, fontSize: 15, color: accent }),
  ]);

  const kpis = slide("FFFFFF", [
    text({ text: "KEY METRICS", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "$128K", xIn: 0.85, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "Revenue this period", xIn: 0.85, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "+18%", xIn: 5.4, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "Growth vs. last period", xIn: 5.4, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "24,800", xIn: 0.85, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "New users", xIn: 0.85, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "3.4%", xIn: 5.4, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "Conversion rate", xIn: 5.4, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
  ]);

  const chartSlide: Slide = {
    id: newId(),
    background: "FFFFFF",
    elements: [
      text({ text: "MONTHLY ACTIVE USERS", xIn: 0.6, yIn: 0.5, wIn: 6, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
      text({
        role: "title",
        text: "Steady growth, up 18% month over month.",
        xIn: 0.6,
        yIn: 0.85,
        wIn: 8.6,
        hIn: 0.7,
        fontSize: 22,
        bold: true,
        color: "101914",
      }),
      {
        id: newId(),
        type: "chart",
        chartKind: "line",
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        values: [40, 46, 55, 63, 74, 88],
        color: primary,
        xIn: 0.6,
        yIn: 1.7,
        wIn: 8.8,
        hIn: 3.3,
      },
    ],
  };

  const quote = slide("FFFFFF", [
    text({ text: "“", xIn: 0.4, yIn: 0.2, wIn: 3, hIn: 2.2, fontSize: 140, bold: true, color: QUOTE_GLYPH_COLOR }),
    text({
      text: "This is the quarter our retention finally caught up with our growth.",
      xIn: 1.2,
      yIn: 1.9,
      wIn: 7.6,
      hIn: 1.4,
      fontSize: 24,
      italic: true,
      align: "center",
      color: "101914",
    }),
    text({ text: "— [Name, Title, Company]", xIn: 1.2, yIn: 3.5, wIn: 7.6, hIn: 0.5, fontSize: 14, align: "center", color: primary }),
  ]);

  return [cover, kpis, chartSlide, quote];
}

/** "Case Study" - a portfolio/agency-style deck built around real photo space: a curated
 * CC0 sample (lib/presentation/assets.ts - see public/presentation-assets/SOURCES.md for
 * licensing) fills every image zone so the template downloads as a finished-looking
 * sample, exactly like Canva's own template previews do; every photo is a real
 * ImageElement the user selects and replaces (DeckEditor.tsx's Format tab has a
 * "Replace photo" action) rather than a fake placeholder box. */
export function caseStudy(primary: string, accent: string): Slide[] {
  const cover = slide("FFFFFF", [
    photo({ dataUrl: SAMPLE_IMAGES.workspaceLaptop, alt: "Project workspace - replace with your own photo", xIn: 0, yIn: 0, wIn: 5, hIn: 5.63 }),
    box({ shape: "rect", fill: primary, xIn: 5, yIn: 0, wIn: 0.06, hIn: 5.63 }),
    text({ text: "CASE STUDY", xIn: 5.5, yIn: 1.5, wIn: 4, hIn: 0.35, fontSize: 12, bold: true, color: accent }),
    text({ role: "title", text: "[Client / Project Name]", xIn: 5.5, yIn: 1.9, wIn: 4.0, hIn: 1.7, fontSize: 32, bold: true, color: primary }),
    text({ text: "[One-line summary of the outcome]", xIn: 5.5, yIn: 3.5, wIn: 4.0, hIn: 0.8, fontSize: 14, color: "101914" }),
  ]);

  const challengeSolution = slide("FFFFFF", [
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 0.7, wIn: 4.1, hIn: 4.3 }),
    text({ text: "THE CHALLENGE", xIn: 0.95, yIn: 1.0, wIn: 3.5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    text({
      text: "What the client was struggling with before this project, in plain terms.",
      xIn: 0.95,
      yIn: 1.5,
      wIn: 3.4,
      hIn: 3.2,
      fontSize: 14,
      color: "101914",
    }),
    box({ shape: "roundRect", fill: primary, opacity: 8, xIn: 5.3, yIn: 0.7, wIn: 4.1, hIn: 4.3 }),
    text({ text: "THE SOLUTION", xIn: 5.65, yIn: 1.0, wIn: 3.5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    text({
      text: "What was built or changed, and why it directly addressed the challenge above.",
      xIn: 5.65,
      yIn: 1.5,
      wIn: 3.4,
      hIn: 3.2,
      fontSize: 14,
      color: "101914",
    }),
  ]);

  const results = slide("FFFFFF", [
    text({ text: "RESULTS", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 1.3, wIn: 2.733, hIn: 2.6 }),
    text({ text: "+64%", xIn: 0.75, yIn: 1.9, wIn: 2.43, hIn: 0.85, fontSize: 32, bold: true, align: "center", color: primary }),
    text({ text: "[Metric one]", xIn: 0.75, yIn: 2.75, wIn: 2.43, hIn: 0.5, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 3.633, yIn: 1.3, wIn: 2.733, hIn: 2.6 }),
    text({ text: "3.2x", xIn: 3.783, yIn: 1.9, wIn: 2.43, hIn: 0.85, fontSize: 32, bold: true, align: "center", color: primary }),
    text({ text: "[Metric two]", xIn: 3.783, yIn: 2.75, wIn: 2.43, hIn: 0.5, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 6.667, yIn: 1.3, wIn: 2.733, hIn: 2.6 }),
    text({ text: "6 wks", xIn: 6.817, yIn: 1.9, wIn: 2.43, hIn: 0.85, fontSize: 32, bold: true, align: "center", color: primary }),
    text({ text: "[Metric three]", xIn: 6.817, yIn: 2.75, wIn: 2.43, hIn: 0.5, fontSize: 11, align: "center", color: "101914" }),
  ]);

  const gallery = slide("FFFFFF", [
    text({ text: "SELECTED WORK", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    photo({ dataUrl: SAMPLE_IMAGES.officeBoardroom, alt: "Project photo one - replace with your own", xIn: 0.6, yIn: 1.15, wIn: 2.733, hIn: 3.85 }),
    photo({ dataUrl: SAMPLE_IMAGES.workspaceLaptop, alt: "Project photo two - replace with your own", xIn: 3.633, yIn: 1.15, wIn: 2.733, hIn: 3.85 }),
    photo({ dataUrl: SAMPLE_IMAGES.citySkyline, alt: "Project photo three - replace with your own", xIn: 6.667, yIn: 1.15, wIn: 2.733, hIn: 3.85 }),
  ]);

  return [cover, challengeSolution, results, gallery];
}

/** "Minimalist" - pure typography, deliberately undecorated (the one template style
 * research also called out for 2026: huge type as the entire visual, no shape
 * compositions at all, matching lib/presentation/elements.ts's "none" cover style). */
export function minimalist(primary: string): Slide[] {
  const cover = slide("FFFFFF", [
    text({
      role: "title",
      text: "Title.",
      xIn: 0.8,
      yIn: 1.9,
      wIn: 8.4,
      hIn: 1.8,
      fontSize: 64,
      bold: true,
      align: "center",
      color: "101914",
    }),
    text({ text: "A short, quiet subtitle.", xIn: 0.8, yIn: 3.5, wIn: 8.4, hIn: 0.5, fontSize: 14, align: "center", color: "6B7280" }),
  ]);

  const section = slide("FFFFFF", [
    text({ text: "01", xIn: 0.3, yIn: 0.6, wIn: 5, hIn: 3, fontSize: 200, bold: true, color: FAINT_NUMBER_COLOR }),
    text({ role: "title", text: "Section heading", xIn: 3.6, yIn: 2.2, wIn: 5.6, hIn: 0.8, fontSize: 30, bold: true, color: "101914" }),
    text({
      text: "One clear supporting line - the point of this section, said once.",
      xIn: 3.6,
      yIn: 2.95,
      wIn: 5.6,
      hIn: 0.6,
      fontSize: 14,
      color: "101914",
    }),
  ]);

  const quote = slide("FFFFFF", [
    box({ shape: "line", fill: primary, xIn: 2.5, yIn: 1.9, wIn: 5, hIn: 0.02 }),
    text({
      text: "Simple is a finished state, not a starting one.",
      xIn: 1.2,
      yIn: 2.2,
      wIn: 7.6,
      hIn: 1.0,
      fontSize: 22,
      italic: true,
      align: "center",
      color: "101914",
    }),
    box({ shape: "line", fill: primary, xIn: 2.5, yIn: 3.4, wIn: 5, hIn: 0.02 }),
  ]);

  const closing = slide("FFFFFF", [
    text({ text: "Thank you.", xIn: 0.8, yIn: 2.1, wIn: 8.4, hIn: 1.3, fontSize: 50, bold: true, align: "center", color: "101914" }),
    text({ text: "[email]  ·  [website]", xIn: 0.8, yIn: 3.5, wIn: 8.4, hIn: 0.5, fontSize: 13, align: "center", color: "6B7280" }),
  ]);

  return [cover, section, quote, closing];
}
