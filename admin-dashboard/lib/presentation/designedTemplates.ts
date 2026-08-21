import { newId, type Slide, type SlideElement, type TextElement, type ShapeElement, type ImageElement } from "./elements";
import { DECK_LAYOUT } from "./layout";
import { SAMPLE_IMAGES } from "./assets";

// Bespoke, hand-laid-out templates - unlike lib/presentation/templates.ts's other deck
// templates (a plain {title, bullets} SlidePlan[] run through elements.ts's
// slideFromPlan, always the same title-and-body layout), every slide here is its own
// freeform element composition. Every template's copy is a specific, real-sounding
// fictional scenario - a real company/person/number, never a bracketed placeholder - so
// the default preview already reads as a finished document a user would be proud to
// send, not a form waiting to be filled in.

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
 * classic bullet list "Business Pitch" template already covers. Sample content: Northloop,
 * a fictional supply-chain analytics startup. */
export function pitchDeckModern(primary: string, accent: string): Slide[] {
  const cover = slide(primary, [
    ...coverPhoto(SAMPLE_IMAGES.officeBoardroom, primary, "Modern boardroom - replace with your own photo"),
    box({ shape: "roundRect", fill: accent, opacity: 18, xIn: 6.6, yIn: -1.4, wIn: 4.6, hIn: 4.6, rotate: 12 }),
    text({ role: "title", text: "Northloop", xIn: 0.7, yIn: 1.85, wIn: 8.4, hIn: 1.5, fontSize: 54, bold: true, color: "FFFFFF" }),
    text({ text: "Supply-chain analytics that catch disruptions before they hit revenue", xIn: 0.7, yIn: 3.3, wIn: 7.8, hIn: 0.55, fontSize: 16, color: accent }),
    text({ text: "Jordan Ade, Founder & CEO  ·  March 2026", xIn: 0.7, yIn: 4.85, wIn: 6, hIn: 0.4, fontSize: 12, color: "FFFFFF" }),
  ]);

  const problem = slide("FFFFFF", [
    text({ text: "THE PROBLEM", xIn: 0.7, yIn: 0.55, wIn: 4, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    text({ text: "73%", xIn: 0.55, yIn: 1.3, wIn: 4.3, hIn: 2.2, fontSize: 110, bold: true, color: primary }),
    text({
      text: "of mid-size manufacturers say a supplier disruption caught them by surprise last year, costing an average of $340K in expedited shipping and missed orders.",
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
      text: "We flag supplier risk 3 weeks before it hits your line.",
      xIn: 0.7,
      yIn: 1.15,
      wIn: 4.2,
      hIn: 1.8,
      fontSize: 26,
      bold: true,
      color: "101914",
    }),
    text({
      text: "Northloop watches 2,200 public risk signals per supplier - weather, customs delays, factory shutdowns - and translates them into one weekly risk score.",
      xIn: 0.7,
      yIn: 3.05,
      wIn: 4.0,
      hIn: 1.2,
      fontSize: 14,
      color: "101914",
    }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3, yIn: 0.55, wIn: 4.0, hIn: 1.3 }),
    text({ text: "Live risk scoring", xIn: 5.6, yIn: 0.75, wIn: 3.5, hIn: 0.4, fontSize: 16, bold: true, color: primary }),
    text({ text: "Every supplier ranked weekly, updated as new signals land.", xIn: 5.6, yIn: 1.15, wIn: 3.5, hIn: 0.6, fontSize: 12, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3, yIn: 2.1, wIn: 4.0, hIn: 1.3 }),
    text({ text: "3-week early warning", xIn: 5.6, yIn: 2.3, wIn: 3.5, hIn: 0.4, fontSize: 16, bold: true, color: primary }),
    text({ text: "Median lead time between our alert and the disruption hitting.", xIn: 5.6, yIn: 2.7, wIn: 3.5, hIn: 0.6, fontSize: 12, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3, yIn: 3.65, wIn: 4.0, hIn: 1.3 }),
    text({ text: "No integration required", xIn: 5.6, yIn: 3.85, wIn: 3.5, hIn: 0.4, fontSize: 16, bold: true, color: primary }),
    text({ text: "We only need your supplier list - live in under a day.", xIn: 5.6, yIn: 4.25, wIn: 3.5, hIn: 0.6, fontSize: 12, color: "101914" }),
  ]);

  const traction = slide("FFFFFF", [
    text({ text: "MARKET & TRACTION", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "$6.1B", xIn: 0.85, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Supply-chain risk software market", xIn: 0.85, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "38", xIn: 5.4, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Paying manufacturers, up from 6 a year ago", xIn: 5.4, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "+34%", xIn: 0.85, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Month-over-month revenue growth", xIn: 0.85, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "96%", xIn: 5.4, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 34, bold: true, color: primary }),
    text({ text: "Annual logo retention", xIn: 5.4, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
  ]);

  const team = slide("FFFFFF", [
    text({ text: "TEAM", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.7875, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "Jordan Ade", xIn: 0.6, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "CEO, ex-Flexport", xIn: 0.6, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 3.0625, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "Sofia Marsh", xIn: 2.875, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "CTO, ex-Palantir", xIn: 2.875, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.3375, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "Ben Ochieng", xIn: 5.15, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "Head of Growth", xIn: 5.15, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 7.6125, yIn: 1.2, wIn: 1.6, hIn: 1.6 }),
    text({ text: "Wei Tanaka", xIn: 7.425, yIn: 2.95, wIn: 1.975, hIn: 0.35, fontSize: 14, bold: true, align: "center", color: "101914" }),
    text({ text: "Design Lead", xIn: 7.425, yIn: 3.32, wIn: 1.975, hIn: 0.3, fontSize: 11, align: "center", color: "101914" }),
  ]);

  const ask = slide(primary, [
    box({ shape: "ellipse", fill: accent, opacity: 16, xIn: 7.2, yIn: -1.5, wIn: 4, hIn: 4 }),
    text({ role: "title", text: "Raising $3.5M", xIn: 0.7, yIn: 1.7, wIn: 8.4, hIn: 1.3, fontSize: 44, bold: true, color: "FFFFFF" }),
    text({
      text: "to reach 200 manufacturers within 18 months - early investors lock in founding-customer pricing before our Series A.",
      xIn: 0.7,
      yIn: 3.0,
      wIn: 7.6,
      hIn: 0.8,
      fontSize: 16,
      color: accent,
    }),
    text({ text: "jordan@northloop.io  ·  northloop.io", xIn: 0.7, yIn: 4.9, wIn: 6, hIn: 0.4, fontSize: 12, color: "FFFFFF" }),
  ]);

  return [cover, problem, solution, traction, team, ask];
}

/** "Pitch Deck (Classic)" - a genuinely different visual direction from Modern's bento
 * grid: an asymmetric color-block cover instead of a full-bleed photo, an editorial
 * serif/grotesk font pairing instead of the default sans, a stacked-row "financial
 * report" market slide instead of stat cards, and a framed-portrait team roster instead
 * of a card grid. Sample content: Corvus Analytics, a fictional fraud-detection startup. */
export function pitchDeckClassic(primary: string, accent: string): Slide[] {
  const HEAD = "Cambria";
  const BODY = "Constantia";

  const cover = slide("FFFFFF", [
    box({ shape: "rect", fill: primary, xIn: 0, yIn: 0, wIn: 3.6, hIn: DECK_LAYOUT.heightIn }),
    box({ shape: "rect", fill: accent, xIn: 3.6, yIn: 0, wIn: 0.06, hIn: DECK_LAYOUT.heightIn }),
    text({ text: "CORVUS", xIn: 0.5, yIn: 2.15, wIn: 2.8, hIn: 0.5, fontSize: 16, bold: true, color: accent, fontFamily: HEAD }),
    text({
      role: "title",
      text: "Corvus\nAnalytics",
      xIn: 0.5,
      yIn: 2.6,
      wIn: 2.8,
      hIn: 1.6,
      fontSize: 34,
      bold: true,
      color: "FFFFFF",
      fontFamily: HEAD,
    }),
    text({ text: "Fraud detection for banks that can't wait a quarter to retrain a model", xIn: 0.5, yIn: 4.3, wIn: 2.9, hIn: 1.0, fontSize: 12, color: "FFFFFF", fontFamily: BODY }),
    photo({ dataUrl: SAMPLE_IMAGES.workspaceLaptop, alt: "Analytics workspace - replace with your own photo", xIn: 4.4, yIn: 0.85, wIn: 5.0, hIn: 3.9 }),
    text({ text: "Camille Dupree, Founder & CEO  ·  Series A deck  ·  March 2026", xIn: 4.4, yIn: 5.0, wIn: 5.0, hIn: 0.4, fontSize: 11, color: primary, fontFamily: BODY },
    ),
  ]);

  const opportunity = slide("FFFFFF", [
    text({ text: "THE OPPORTUNITY", xIn: 0.7, yIn: 0.55, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary, fontFamily: HEAD }),
    box({ shape: "line", fill: accent, xIn: 0.7, yIn: 0.95, wIn: 1.2, hIn: 0.03 }),
    text({
      role: "title",
      text: "Regional banks lose $2.1M a year to card fraud their legacy rules engine never catches - and it takes their team 11 weeks to ship a single new rule.",
      xIn: 0.7,
      yIn: 1.3,
      wIn: 5.0,
      hIn: 3.6,
      fontSize: 22,
      color: "101914",
      fontFamily: HEAD,
    }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 6.0, yIn: 1.3, wIn: 3.4, hIn: 3.6 }),
    text({
      text: "Corvus retrains its fraud model on your own transaction data every night, and ships new rules in hours through a plain-language console your risk team already knows how to use.",
      xIn: 6.3,
      yIn: 1.6,
      wIn: 2.8,
      hIn: 3.0,
      fontSize: 13,
      color: "101914",
      fontFamily: BODY,
    }),
  ]);

  const market = slide("FFFFFF", [
    text({ text: "MARKET & TRACTION", xIn: 0.7, yIn: 0.55, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary, fontFamily: HEAD }),
    text({
      text: "1,800 US regional and community banks still run fraud detection on rules engines built before 2015. Corvus is live at 14 of them.",
      xIn: 0.7,
      yIn: 1.1,
      wIn: 3.6,
      hIn: 3.8,
      fontSize: 15,
      color: "101914",
      fontFamily: BODY,
    }),
    box({ shape: "line", fill: CARD_FILL, xIn: 4.6, yIn: 1.15, wIn: 4.7, hIn: 0.02 }),
    text({ text: "Fraud caught that rules missed", xIn: 4.6, yIn: 1.35, wIn: 3.2, hIn: 0.4, fontSize: 13, color: "101914", fontFamily: BODY }),
    text({ text: "41%", xIn: 8.0, yIn: 1.3, wIn: 1.3, hIn: 0.5, fontSize: 22, bold: true, align: "right", color: primary, fontFamily: HEAD }),
    box({ shape: "line", fill: CARD_FILL, xIn: 4.6, yIn: 2.05, wIn: 4.7, hIn: 0.02 }),
    text({ text: "Time to ship a new rule", xIn: 4.6, yIn: 2.25, wIn: 3.2, hIn: 0.4, fontSize: 13, color: "101914", fontFamily: BODY }),
    text({ text: "3 hrs", xIn: 8.0, yIn: 2.2, wIn: 1.3, hIn: 0.5, fontSize: 22, bold: true, align: "right", color: primary, fontFamily: HEAD }),
    box({ shape: "line", fill: CARD_FILL, xIn: 4.6, yIn: 2.95, wIn: 4.7, hIn: 0.02 }),
    text({ text: "Annual contract value, average", xIn: 4.6, yIn: 3.15, wIn: 3.2, hIn: 0.4, fontSize: 13, color: "101914", fontFamily: BODY }),
    text({ text: "$96K", xIn: 8.0, yIn: 3.1, wIn: 1.3, hIn: 0.5, fontSize: 22, bold: true, align: "right", color: primary, fontFamily: HEAD }),
    box({ shape: "line", fill: CARD_FILL, xIn: 4.6, yIn: 3.85, wIn: 4.7, hIn: 0.02 }),
    text({ text: "Net revenue retention", xIn: 4.6, yIn: 4.05, wIn: 3.2, hIn: 0.4, fontSize: 13, color: "101914", fontFamily: BODY }),
    text({ text: "128%", xIn: 8.0, yIn: 4.0, wIn: 1.3, hIn: 0.5, fontSize: 22, bold: true, align: "right", color: primary, fontFamily: HEAD }),
  ]);

  const team = slide("FFFFFF", [
    text({ text: "TEAM", xIn: 0.7, yIn: 0.55, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary, fontFamily: HEAD }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.68, yIn: 1.28, wIn: 1.1, hIn: 1.1 }),
    box({ shape: "roundRect", fill: primary, xIn: 0.6, yIn: 1.2, wIn: 1.1, hIn: 1.1 }),
    text({ text: "Camille Dupree - Founder & CEO", xIn: 2.0, yIn: 1.35, wIn: 6.8, hIn: 0.4, fontSize: 16, bold: true, color: "101914", fontFamily: HEAD }),
    text({ text: "12 years in bank risk operations, most recently head of fraud strategy at a top-20 US bank.", xIn: 2.0, yIn: 1.72, wIn: 6.8, hIn: 0.45, fontSize: 12, color: "101914", fontFamily: BODY }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.68, yIn: 2.58, wIn: 1.1, hIn: 1.1 }),
    box({ shape: "roundRect", fill: primary, xIn: 0.6, yIn: 2.5, wIn: 1.1, hIn: 1.1 }),
    text({ text: "Malik Osei - Co-founder & CTO", xIn: 2.0, yIn: 2.65, wIn: 6.8, hIn: 0.4, fontSize: 16, bold: true, color: "101914", fontFamily: HEAD }),
    text({ text: "Built real-time ML infrastructure at Stripe; led the fraud-scoring pipeline serving 2M requests/day.", xIn: 2.0, yIn: 3.02, wIn: 6.8, hIn: 0.45, fontSize: 12, color: "101914", fontFamily: BODY }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.68, yIn: 3.88, wIn: 1.1, hIn: 1.1 }),
    box({ shape: "roundRect", fill: primary, xIn: 0.6, yIn: 3.8, wIn: 1.1, hIn: 1.1 }),
    text({ text: "Ingrid Solberg - Advisor", xIn: 2.0, yIn: 3.95, wIn: 6.8, hIn: 0.4, fontSize: 16, bold: true, color: "101914", fontFamily: HEAD }),
    text({ text: "Former Chief Risk Officer, regional bank sector; sits on two other fintech boards.", xIn: 2.0, yIn: 4.32, wIn: 6.8, hIn: 0.45, fontSize: 12, color: "101914", fontFamily: BODY }),
  ]);

  const ask = slide("FFFFFF", [
    box({ shape: "ellipse", fill: accent, opacity: 10, xIn: 6.6, yIn: -1.8, wIn: 5, hIn: 5 }),
    box({ shape: "ellipse", fill: primary, opacity: 6, xIn: -1.6, yIn: 3.2, wIn: 4.2, hIn: 4.2 }),
    box({ shape: "line", fill: primary, xIn: 2.5, yIn: 1.5, wIn: 5, hIn: 0.03 }),
    text({
      role: "title",
      text: "Raising a $6M Series A to bring Corvus to 60 banks by the end of 2027.",
      xIn: 1.2,
      yIn: 1.85,
      wIn: 7.6,
      hIn: 1.3,
      fontSize: 26,
      italic: true,
      align: "center",
      color: "101914",
      fontFamily: HEAD,
    }),
    box({ shape: "line", fill: primary, xIn: 2.5, yIn: 3.3, wIn: 5, hIn: 0.03 }),
    text({ text: "camille@corvusanalytics.com  ·  corvusanalytics.com", xIn: 1.2, yIn: 4.6, wIn: 7.6, hIn: 0.4, fontSize: 13, align: "center", color: primary, fontFamily: BODY }),
  ]);

  return [cover, opportunity, market, team, ask];
}

/** "Marketing Report" - a KPI-dashboard-style deck: a bento grid of headline metrics, one
 * chart with the conclusion stated in its own headline rather than left for the reader to
 * find (2026's "narrate the data" convention), and a pull-quote/testimonial slide. Sample
 * content: Lumen Outdoor, a fictional outdoor-gear brand's Q1 marketing report. */
export function marketingReport(primary: string, accent: string): Slide[] {
  const cover = slide(primary, [
    ...coverPhoto(SAMPLE_IMAGES.citySkyline, primary, "City skyline - replace with your own photo"),
    box({ shape: "roundRect", fill: accent, opacity: 18, xIn: -1.5, yIn: -1.2, wIn: 4.2, hIn: 4.2, rotate: -10 }),
    text({ role: "title", text: "Marketing Report", xIn: 0.7, yIn: 2.0, wIn: 8.4, hIn: 1.3, fontSize: 46, bold: true, color: "FFFFFF" }),
    text({ text: "Lumen Outdoor  ·  Q1 2026  ·  Prepared by the Growth Marketing Team", xIn: 0.7, yIn: 3.25, wIn: 7.8, hIn: 0.5, fontSize: 15, color: accent }),
  ]);

  const kpis = slide("FFFFFF", [
    text({ text: "KEY METRICS", xIn: 0.6, yIn: 0.5, wIn: 5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "$412K", xIn: 0.85, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "Revenue from paid campaigns this quarter", xIn: 0.85, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 1.15, wIn: 4.25, hIn: 1.775 }),
    text({ text: "+18%", xIn: 5.4, yIn: 1.35, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "Growth vs. Q4 2025", xIn: 5.4, yIn: 2.2, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "24,800", xIn: 0.85, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "New email subscribers", xIn: 0.85, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 5.15, yIn: 3.225, wIn: 4.25, hIn: 1.775 }),
    text({ text: "3.4%", xIn: 5.4, yIn: 3.425, wIn: 3.8, hIn: 0.85, fontSize: 32, bold: true, color: primary }),
    text({ text: "Site-wide conversion rate", xIn: 5.4, yIn: 4.3, wIn: 3.8, hIn: 0.5, fontSize: 11, color: "101914" }),
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
    box({ shape: "ellipse", fill: primary, opacity: 6, xIn: 7.3, yIn: -1.6, wIn: 4.4, hIn: 4.4 }),
    box({ shape: "ellipse", fill: accent, opacity: 14, xIn: -1.3, yIn: 3.6, wIn: 3.4, hIn: 3.4 }),
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
    box({ shape: "line", fill: accent, xIn: 4.4, yIn: 3.35, wIn: 1.2, hIn: 0.03 }),
    text({ text: "— Priya Shah, VP Marketing, Lumen Outdoor", xIn: 1.2, yIn: 3.5, wIn: 7.6, hIn: 0.5, fontSize: 14, align: "center", color: primary }),
  ]);

  return [cover, kpis, chartSlide, quote];
}

/** "Case Study" - a portfolio/agency-style deck built around real photo space: a curated
 * CC0 sample (lib/presentation/assets.ts - see public/presentation-assets/SOURCES.md for
 * licensing) fills every image zone so the template downloads as a finished-looking
 * sample, exactly like Canva's own template previews do; every photo is a real
 * ImageElement the user selects and replaces (DeckEditor.tsx's Format tab has a
 * "Replace photo" action) rather than a fake placeholder box. Sample content: how a
 * fictional retailer, Meridian Retail Co., modernized checkout. */
export function caseStudy(primary: string, accent: string): Slide[] {
  const cover = slide("FFFFFF", [
    photo({ dataUrl: SAMPLE_IMAGES.workspaceLaptop, alt: "Project workspace - replace with your own photo", xIn: 0, yIn: 0, wIn: 5, hIn: 5.63 }),
    box({ shape: "rect", fill: primary, xIn: 5, yIn: 0, wIn: 0.06, hIn: 5.63 }),
    text({ text: "CASE STUDY", xIn: 5.5, yIn: 1.5, wIn: 4, hIn: 0.35, fontSize: 12, bold: true, color: accent }),
    text({ role: "title", text: "Meridian Retail Co.", xIn: 5.5, yIn: 1.9, wIn: 4.0, hIn: 1.7, fontSize: 32, bold: true, color: primary }),
    text({ text: "How a 40-year-old retailer modernized checkout and cut cart abandonment by 31%.", xIn: 5.5, yIn: 3.5, wIn: 4.0, hIn: 0.8, fontSize: 14, color: "101914" }),
  ]);

  const challengeSolution = slide("FFFFFF", [
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 0.6, yIn: 0.7, wIn: 4.1, hIn: 4.3 }),
    text({ text: "THE CHALLENGE", xIn: 0.95, yIn: 1.0, wIn: 3.5, hIn: 0.35, fontSize: 12, bold: true, color: primary }),
    text({
      text: "Meridian's 12-year-old checkout flow required 7 steps and a forced account creation. Mobile cart abandonment had climbed to 68%, well above the retail average.",
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
      text: "We rebuilt checkout to 2 steps with guest checkout by default, added Apple Pay and saved cards, and moved shipping-cost display to the product page instead of a late surprise.",
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
    text({ text: "-31%", xIn: 0.75, yIn: 1.9, wIn: 2.43, hIn: 0.85, fontSize: 32, bold: true, align: "center", color: primary }),
    text({ text: "Cart abandonment", xIn: 0.75, yIn: 2.75, wIn: 2.43, hIn: 0.5, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 3.633, yIn: 1.3, wIn: 2.733, hIn: 2.6 }),
    text({ text: "2.1x", xIn: 3.783, yIn: 1.9, wIn: 2.43, hIn: 0.85, fontSize: 32, bold: true, align: "center", color: primary }),
    text({ text: "Faster checkout completion", xIn: 3.783, yIn: 2.75, wIn: 2.43, hIn: 0.5, fontSize: 11, align: "center", color: "101914" }),
    box({ shape: "roundRect", fill: CARD_FILL, xIn: 6.667, yIn: 1.3, wIn: 2.733, hIn: 2.6 }),
    text({ text: "9 wks", xIn: 6.817, yIn: 1.9, wIn: 2.43, hIn: 0.85, fontSize: 32, bold: true, align: "center", color: primary }),
    text({ text: "Design to full rollout", xIn: 6.817, yIn: 2.75, wIn: 2.43, hIn: 0.5, fontSize: 11, align: "center", color: "101914" }),
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
  // Still "type as the whole design" - every added element here is a single hairline
  // rule or a very faint numeral/tint, never a photo or a card, so the restraint that
  // defines this template survives; but a page with literally nothing except black text
  // on white reads as unfinished rather than deliberate, so every slide gets at least one
  // quiet mark that isn't body copy.
  const cover = slide("FFFFFF", [
    box({ shape: "line", fill: primary, xIn: 4.5, yIn: 1.55, wIn: 1, hIn: 0.025 }),
    text({
      role: "title",
      text: "Fewer, better things.",
      xIn: 0.8,
      yIn: 1.9,
      wIn: 8.4,
      hIn: 1.8,
      fontSize: 56,
      bold: true,
      align: "center",
      color: "101914",
    }),
    text({ text: "A studio journal - Spring 2026", xIn: 0.8, yIn: 3.5, wIn: 8.4, hIn: 0.5, fontSize: 14, align: "center", color: "6B7280" }),
  ]);

  const section = slide("FFFFFF", [
    text({ text: "01", xIn: 0.3, yIn: 0.6, wIn: 5, hIn: 3, fontSize: 200, bold: true, color: FAINT_NUMBER_COLOR }),
    box({ shape: "line", fill: primary, xIn: 3.6, yIn: 1.85, wIn: 0.5, hIn: 0.03 }),
    text({ role: "title", text: "Why we cut our product line in half", xIn: 3.6, yIn: 2.2, wIn: 5.6, hIn: 0.8, fontSize: 28, bold: true, color: "101914" }),
    text({
      text: "Fewer options sold better - customers spent less time comparing and more time buying.",
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
    box({ shape: "line", fill: primary, xIn: 4.3, yIn: 1.85, wIn: 1.4, hIn: 0.025 }),
    text({ text: "Thank you.", xIn: 0.8, yIn: 2.1, wIn: 8.4, hIn: 1.3, fontSize: 50, bold: true, align: "center", color: "101914" }),
    text({ text: "hello@fewerbetter.co  ·  fewerbetter.co", xIn: 0.8, yIn: 3.5, wIn: 8.4, hIn: 0.5, fontSize: 13, align: "center", color: "6B7280" }),
  ]);

  return [cover, section, quote, closing];
}
