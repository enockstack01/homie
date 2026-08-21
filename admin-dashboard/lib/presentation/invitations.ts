import { newId, type Slide, type SlideElement, type TextElement, type ShapeElement } from "./elements";
import { findPalette } from "./layout";
import { PRINT_FORMATS, BLEED_IN } from "./printFormats";

// The wedding invitation suite - a genuinely new print-format category (see
// lib/presentation/printFormats.ts for why the canvas itself is trim-size-plus-bleed),
// not a repurposed slide deck. Deliberately fixed to its own palette and font pairing
// rather than the generic 6-color deck-theme picker: a formal invitation suite is a
// coherent, art-directed system a couple picks once, the same way a real stationery
// studio's "Classic Ivory" suite isn't something you recolor with a business-deck theme
// switcher. One 3-page "deck" at a uniform 5x7 size *is* the suite - invitation, RSVP
// card, details card - sharing one editing session, one undo history, and one PDF export
// that produces all three pages together, exactly how a couple would send them to print.

const FORMAT = PRINT_FORMATS.invitation5x7;
const W = FORMAT.widthIn;
const H = FORMAT.heightIn;
const FRAME_INSET = 0.35; // inside the trim line (BLEED_IN), a decorative border sits here
const CONTENT_INSET = 0.6; // inside the frame, where text actually starts

const SCRIPT = "Monotype Corsiva";
const SERIF_HEAD = "Garamond";
const SERIF_BODY = "Constantia";

function text(partial: Omit<TextElement, "id" | "type">): TextElement {
  return { id: newId(), type: "text", ...partial };
}
function box(partial: Omit<ShapeElement, "id" | "type">): ShapeElement {
  return { id: newId(), type: "shape", ...partial };
}
function slide(background: string, elements: SlideElement[]): Slide {
  return { id: newId(), background, elements };
}

/** A thin rectangular rule frame built from 4 line shapes (ShapeElement has no unfilled-
 * rectangle/stroke option, so a border is 4 lines forming one) - the standard "framed
 * card" finishing detail real invitation stationery uses, inset inside the bleed/trim so
 * it prints exactly where intended regardless of a printer's small trim variance. */
function frame(color: string): ShapeElement[] {
  const inset = FRAME_INSET;
  return [
    box({ shape: "line", fill: color, xIn: inset, yIn: inset, wIn: W - inset * 2, hIn: 0.012 }),
    box({ shape: "line", fill: color, xIn: inset, yIn: H - inset, wIn: W - inset * 2, hIn: 0.012 }),
    box({ shape: "line", fill: color, xIn: inset, yIn: inset, wIn: 0.012, hIn: H - inset * 2 }),
    box({ shape: "line", fill: color, xIn: W - inset, yIn: inset, wIn: 0.012, hIn: H - inset * 2 }),
  ];
}

/** "Classic / Formal" - the first of the brief's three requested aesthetics, built to
 * gold-standard quality first (per the brief's own Step 2 methodology) rather than
 * shipping three thinner ones; Modern Minimal and Botanical are the natural next
 * additions once this one is validated. Sample content: a fictional couple, Amara Whitfield
 * and Julian Osei, at a fictional venue. */
export function weddingInvitationClassic(): Slide[] {
  const palette = findPalette("editorial-emerald");
  const ink = palette.primary;
  const gold = palette.accent;
  const bg = palette.background;

  const invitation = slide(bg, [
    ...frame(gold),
    box({ shape: "ellipse", fill: gold, opacity: 55, xIn: W / 2 - 0.03, yIn: 1.35, wIn: 0.06, hIn: 0.06 }),
    text({
      text: "TOGETHER WITH THEIR FAMILIES",
      xIn: CONTENT_INSET,
      yIn: 1.5,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.3,
      fontSize: 11,
      align: "center",
      color: gold,
      fontFamily: SERIF_BODY,
      bold: true,
    }),
    text({
      role: "title",
      text: "Amara & Julian",
      xIn: CONTENT_INSET - 0.2,
      yIn: 1.95,
      wIn: W - (CONTENT_INSET - 0.2) * 2,
      hIn: 1.1,
      fontSize: 46,
      align: "center",
      color: ink,
      fontFamily: SCRIPT,
    }),
    text({
      text: "request the pleasure of your company\nat their wedding celebration",
      xIn: CONTENT_INSET,
      yIn: 3.15,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.7,
      fontSize: 13,
      align: "center",
      color: ink,
      fontFamily: SERIF_BODY,
    }),
    box({ shape: "line", fill: gold, xIn: W / 2 - 0.5, yIn: 4.05, wIn: 1, hIn: 0.012 }),
    text({
      text: "Saturday, the Twentieth of June\nTwo Thousand Twenty-Six\nFour O'Clock in the Afternoon",
      xIn: CONTENT_INSET,
      yIn: 4.25,
      wIn: W - CONTENT_INSET * 2,
      hIn: 1.1,
      fontSize: 15,
      align: "center",
      color: ink,
      fontFamily: SERIF_HEAD,
    }),
    text({
      text: "The Grand Conservatory\n118 Magnolia Lane, Charleston, SC",
      xIn: CONTENT_INSET,
      yIn: 5.7,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.7,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: SERIF_BODY,
    }),
  ]);

  const rsvp = slide(bg, [
    ...frame(gold),
    text({ text: "RSVP", xIn: CONTENT_INSET, yIn: 1.1, wIn: W - CONTENT_INSET * 2, hIn: 0.6, fontSize: 30, align: "center", color: ink, fontFamily: SCRIPT }),
    box({ shape: "line", fill: gold, xIn: W / 2 - 0.4, yIn: 1.75, wIn: 0.8, hIn: 0.012 }),
    text({
      text: "Kindly reply by the First of May",
      xIn: CONTENT_INSET,
      yIn: 1.95,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.4,
      fontSize: 13,
      align: "center",
      color: ink,
      fontFamily: SERIF_BODY,
    }),
    text({ text: "M", xIn: CONTENT_INSET, yIn: 2.7, wIn: 0.4, hIn: 0.4, fontSize: 16, color: ink, fontFamily: SERIF_HEAD, italic: true }),
    box({ shape: "line", fill: ink, xIn: CONTENT_INSET + 0.45, yIn: 3.0, wIn: W - CONTENT_INSET * 2 - 0.45, hIn: 0.012 }),
    text({
      text: "___ accepts with pleasure",
      xIn: CONTENT_INSET,
      yIn: 3.35,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.4,
      fontSize: 13,
      color: ink,
      fontFamily: SERIF_BODY,
    }),
    text({
      text: "___ declines with regret",
      xIn: CONTENT_INSET,
      yIn: 3.85,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.4,
      fontSize: 13,
      color: ink,
      fontFamily: SERIF_BODY,
    }),
    text({
      text: "Number of guests attending",
      xIn: CONTENT_INSET,
      yIn: 4.5,
      wIn: W - CONTENT_INSET * 2 - 0.9,
      hIn: 0.4,
      fontSize: 13,
      color: ink,
      fontFamily: SERIF_BODY,
    }),
    box({ shape: "line", fill: ink, xIn: W - CONTENT_INSET - 0.7, yIn: 4.82, wIn: 0.7, hIn: 0.012 }),
    text({
      text: "Please note any dietary restrictions on the back of this card.",
      xIn: CONTENT_INSET,
      yIn: 5.6,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.6,
      fontSize: 10,
      align: "center",
      italic: true,
      color: ink,
      fontFamily: SERIF_BODY,
    }),
  ]);

  const details = slide(bg, [
    ...frame(gold),
    text({ text: "Wedding Weekend Details", xIn: CONTENT_INSET, yIn: 1.0, wIn: W - CONTENT_INSET * 2, hIn: 0.55, fontSize: 22, align: "center", color: ink, fontFamily: SCRIPT }),
    box({ shape: "line", fill: gold, xIn: W / 2 - 0.5, yIn: 1.55, wIn: 1, hIn: 0.012 }),

    text({ text: "CEREMONY", xIn: CONTENT_INSET, yIn: 1.85, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 11, align: "center", color: gold, fontFamily: SERIF_BODY, bold: true }),
    text({
      text: "4:00 PM, The Grand Conservatory\n118 Magnolia Lane, Charleston, SC",
      xIn: CONTENT_INSET,
      yIn: 2.15,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.6,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: SERIF_BODY,
    }),

    text({ text: "RECEPTION", xIn: CONTENT_INSET, yIn: 2.9, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 11, align: "center", color: gold, fontFamily: SERIF_BODY, bold: true }),
    text({
      text: "6:00 PM, immediately following the ceremony\nSame location - cocktail hour on the garden terrace",
      xIn: CONTENT_INSET,
      yIn: 3.2,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.6,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: SERIF_BODY,
    }),

    text({ text: "ACCOMMODATIONS", xIn: CONTENT_INSET, yIn: 3.95, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 11, align: "center", color: gold, fontFamily: SERIF_BODY, bold: true }),
    text({
      text: "A room block is held at the Harbor House Hotel\nthrough May 20 - mention \"Whitfield-Osei Wedding\"",
      xIn: CONTENT_INSET,
      yIn: 4.25,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.6,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: SERIF_BODY,
    }),

    text({ text: "REGISTRY", xIn: CONTENT_INSET, yIn: 5.0, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 11, align: "center", color: gold, fontFamily: SERIF_BODY, bold: true }),
    text({
      text: "Your presence is the only gift we ask for -\nfor those who'd still like to, our registry is at amarajulian.com",
      xIn: CONTENT_INSET,
      yIn: 5.3,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.6,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: SERIF_BODY,
    }),
  ]);

  return [invitation, rsvp, details];
}

// --- Modern Minimal -------------------------------------------------------
// A genuinely different structure from Classic, not a recolor (brief principle G):
// left-aligned/asymmetric instead of centered, one thin vertical rule instead of a
// 4-sided frame, geometric all-caps sans instead of a script monogram, and far more
// unused whitespace - the restrained, editorial-minimalist wedding-stationery look.

const SANS_HEAD = "Segoe UI";
const SANS_BODY = "Verdana";
const MODERN_LEFT = 1.05;
const MODERN_RIGHT = 0.7;

/** The single asymmetric vertical rule that stands in for Classic's full frame - the
 * whole "this page has an edge" cue comes from one line near the left margin, not a
 * border running the full perimeter. */
function verticalRule(color: string): ShapeElement {
  return box({ shape: "line", fill: color, xIn: MODERN_LEFT - 0.3, yIn: 0.6, wIn: 0.016, hIn: H - 1.2 });
}

export function weddingInvitationModern(): Slide[] {
  const palette = findPalette("ivory-noir");
  const ink = palette.primary;
  const gold = palette.accent;
  const bg = palette.background;
  const wIn = W - MODERN_LEFT - MODERN_RIGHT;

  const invitation = slide(bg, [
    verticalRule(gold),
    text({ text: "SAVE THE DATE", xIn: MODERN_LEFT, yIn: 1.1, wIn, hIn: 0.3, fontSize: 10, color: gold, fontFamily: SANS_BODY, bold: true }),
    text({
      role: "title",
      text: "NOA\n&\nTHEO",
      xIn: MODERN_LEFT,
      yIn: 1.55,
      wIn,
      hIn: 2.5,
      fontSize: 44,
      color: ink,
      fontFamily: SANS_HEAD,
      bold: true,
    }),
    box({ shape: "line", fill: gold, xIn: MODERN_LEFT, yIn: 4.15, wIn: 0.6, hIn: 0.02 }),
    text({
      text: "ARE GETTING MARRIED",
      xIn: MODERN_LEFT,
      yIn: 4.3,
      wIn,
      hIn: 0.3,
      fontSize: 10,
      color: ink,
      fontFamily: SANS_BODY,
      bold: true,
    }),
    text({
      text: "SATURDAY, SEPTEMBER 12, 2026\n5:00 PM",
      xIn: MODERN_LEFT,
      yIn: 4.85,
      wIn,
      hIn: 0.6,
      fontSize: 13,
      color: ink,
      fontFamily: SANS_BODY,
    }),
    text({
      text: "THE FOUNDRY\n900 DOCK STREET, PORTLAND, OR",
      xIn: MODERN_LEFT,
      yIn: 5.55,
      wIn,
      hIn: 0.6,
      fontSize: 11,
      color: palette.secondary,
      fontFamily: SANS_BODY,
    }),
  ]);

  const rsvp = slide(bg, [
    verticalRule(gold),
    text({ text: "RSVP", xIn: MODERN_LEFT, yIn: 1.1, wIn, hIn: 0.4, fontSize: 22, color: ink, fontFamily: SANS_HEAD, bold: true }),
    text({
      text: "PLEASE REPLY BY AUGUST 1",
      xIn: MODERN_LEFT,
      yIn: 1.65,
      wIn,
      hIn: 0.3,
      fontSize: 10,
      color: gold,
      fontFamily: SANS_BODY,
      bold: true,
    }),
    text({ text: "NAME", xIn: MODERN_LEFT, yIn: 2.4, wIn: 1, hIn: 0.3, fontSize: 10, color: palette.secondary, fontFamily: SANS_BODY }),
    box({ shape: "line", fill: ink, xIn: MODERN_LEFT + 0.75, yIn: 2.68, wIn: wIn - 0.75, hIn: 0.012 }),
    text({
      text: "[  ]  ATTENDING\n[  ]  NOT ATTENDING",
      xIn: MODERN_LEFT,
      yIn: 3.1,
      wIn,
      hIn: 0.8,
      fontSize: 13,
      color: ink,
      fontFamily: SANS_BODY,
    }),
    text({ text: "GUESTS", xIn: MODERN_LEFT, yIn: 4.1, wIn: 1.1, hIn: 0.3, fontSize: 10, color: palette.secondary, fontFamily: SANS_BODY }),
    box({ shape: "line", fill: ink, xIn: MODERN_LEFT + 0.85, yIn: 4.38, wIn: wIn - 0.85, hIn: 0.012 }),
    text({
      text: "Send by mail or scan the code on the details card.",
      xIn: MODERN_LEFT,
      yIn: 5.9,
      wIn,
      hIn: 0.4,
      fontSize: 10,
      italic: true,
      color: palette.secondary,
      fontFamily: SANS_BODY,
    }),
  ]);

  const details = slide(bg, [
    verticalRule(gold),
    text({ text: "DETAILS", xIn: MODERN_LEFT, yIn: 1.1, wIn, hIn: 0.4, fontSize: 22, color: ink, fontFamily: SANS_HEAD, bold: true }),

    text({ text: "CEREMONY", xIn: MODERN_LEFT, yIn: 1.9, wIn, hIn: 0.25, fontSize: 10, color: gold, fontFamily: SANS_BODY, bold: true }),
    text({
      text: "5:00 PM - The Foundry, 900 Dock Street",
      xIn: MODERN_LEFT,
      yIn: 2.15,
      wIn,
      hIn: 0.5,
      fontSize: 12,
      color: ink,
      fontFamily: SANS_BODY,
    }),

    text({ text: "RECEPTION", xIn: MODERN_LEFT, yIn: 2.85, wIn, hIn: 0.25, fontSize: 10, color: gold, fontFamily: SANS_BODY, bold: true }),
    text({
      text: "7:00 PM - same address, rooftop level",
      xIn: MODERN_LEFT,
      yIn: 3.1,
      wIn,
      hIn: 0.5,
      fontSize: 12,
      color: ink,
      fontFamily: SANS_BODY,
    }),

    text({ text: "STAY", xIn: MODERN_LEFT, yIn: 3.8, wIn, hIn: 0.25, fontSize: 10, color: gold, fontFamily: SANS_BODY, bold: true }),
    text({
      text: "Room block at The Society Hotel through Aug 20 - code LINDQVIST",
      xIn: MODERN_LEFT,
      yIn: 4.05,
      wIn,
      hIn: 0.6,
      fontSize: 12,
      color: ink,
      fontFamily: SANS_BODY,
    }),

    text({ text: "REGISTRY", xIn: MODERN_LEFT, yIn: 4.85, wIn, hIn: 0.25, fontSize: 10, color: gold, fontFamily: SANS_BODY, bold: true }),
    text({
      text: "noaandtheo.com",
      xIn: MODERN_LEFT,
      yIn: 5.1,
      wIn,
      hIn: 0.4,
      fontSize: 12,
      color: ink,
      fontFamily: SANS_BODY,
    }),
  ]);

  return [invitation, rsvp, details];
}

// --- Botanical --------------------------------------------------------------
// No licensed floral photography or illustration library is available to this app (the
// same constraint documented in elements.ts's cover-graphic compositions), so "botanical"
// here means what that file's coverAccents already does honestly: a loose, asymmetric
// cluster of overlapping native shapes in garden tones standing in for a greenery
// sprig - placed in two opposite corners rather than a symmetric frame, so the page still
// reads as organic/off-balance rather than a stock clip-art wreath.

function botanicalSpray(green: string, blush: string, corner: "topLeft" | "bottomRight"): ShapeElement[] {
  const flip = corner === "bottomRight";
  const ox = flip ? W : 0;
  const oy = flip ? H : 0;
  const sx = flip ? -1 : 1;
  const sy = flip ? -1 : 1;
  const spots: Array<{ x: number; y: number; d: number; c: string; o: number }> = [
    { x: 0.15, y: 0.2, d: 0.55, c: green, o: 70 },
    { x: 0.5, y: 0.1, d: 0.35, c: green, o: 55 },
    { x: 0.1, y: 0.55, d: 0.3, c: blush, o: 65 },
    { x: 0.42, y: 0.42, d: 0.2, c: blush, o: 80 },
    { x: 0.65, y: 0.28, d: 0.22, c: green, o: 40 },
    { x: 0.28, y: 0.05, d: 0.16, c: blush, o: 55 },
  ];
  return spots.map(({ x, y, d, c, o }) =>
    box({ shape: "ellipse", fill: c, opacity: o, xIn: ox + sx * x - (flip ? d : 0), yIn: oy + sy * y - (flip ? d : 0), wIn: d, hIn: d }),
  );
}

const BOTANICAL_HEAD = "Cambria";
const BOTANICAL_BODY = "Georgia";

export function weddingInvitationBotanical(): Slide[] {
  const palette = findPalette("blush-botanical");
  const ink = palette.text;
  const green = palette.primary;
  const blush = palette.accent;
  const bg = palette.background;

  const invitation = slide(bg, [
    ...botanicalSpray(green, blush, "topLeft"),
    ...botanicalSpray(green, blush, "bottomRight"),
    text({
      text: "TOGETHER WITH THEIR FAMILIES",
      xIn: CONTENT_INSET,
      yIn: 1.6,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.3,
      fontSize: 10,
      align: "center",
      color: palette.secondary,
      fontFamily: BOTANICAL_BODY,
      bold: true,
    }),
    text({
      role: "title",
      text: "Wren & Silas",
      xIn: CONTENT_INSET - 0.2,
      yIn: 2.0,
      wIn: W - (CONTENT_INSET - 0.2) * 2,
      hIn: 1.0,
      fontSize: 42,
      align: "center",
      color: green,
      fontFamily: SCRIPT,
    }),
    text({
      text: "invite you to celebrate their wedding\nsurrounded by family and friends",
      xIn: CONTENT_INSET,
      yIn: 3.1,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.7,
      fontSize: 13,
      align: "center",
      color: ink,
      fontFamily: BOTANICAL_BODY,
      italic: true,
    }),
    text({
      text: "Sunday, the Ninth of May\nTwo Thousand Twenty-Seven\nHalf Past Four in the Afternoon",
      xIn: CONTENT_INSET,
      yIn: 4.15,
      wIn: W - CONTENT_INSET * 2,
      hIn: 1.1,
      fontSize: 15,
      align: "center",
      color: ink,
      fontFamily: BOTANICAL_HEAD,
    }),
    text({
      text: "Meadowbrook Farm\nHudson Valley, New York",
      xIn: CONTENT_INSET,
      yIn: 5.6,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.7,
      fontSize: 12,
      align: "center",
      color: palette.secondary,
      fontFamily: BOTANICAL_BODY,
    }),
  ]);

  const rsvp = slide(bg, [
    ...botanicalSpray(green, blush, "topLeft"),
    text({ text: "RSVP", xIn: CONTENT_INSET, yIn: 1.3, wIn: W - CONTENT_INSET * 2, hIn: 0.6, fontSize: 28, align: "center", color: green, fontFamily: SCRIPT }),
    text({
      text: "Kindly reply by the First of April",
      xIn: CONTENT_INSET,
      yIn: 2.05,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.4,
      fontSize: 13,
      align: "center",
      color: ink,
      fontFamily: BOTANICAL_BODY,
      italic: true,
    }),
    text({ text: "Name", xIn: CONTENT_INSET, yIn: 2.9, wIn: 0.7, hIn: 0.4, fontSize: 13, color: ink, fontFamily: BOTANICAL_BODY, italic: true }),
    box({ shape: "line", fill: green, xIn: CONTENT_INSET + 0.75, yIn: 3.2, wIn: W - CONTENT_INSET * 2 - 0.75, hIn: 0.012 }),
    text({
      text: "___ joyfully accepts",
      xIn: CONTENT_INSET,
      yIn: 3.55,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.4,
      fontSize: 13,
      color: ink,
      fontFamily: BOTANICAL_BODY,
    }),
    text({
      text: "___ regretfully declines",
      xIn: CONTENT_INSET,
      yIn: 4.05,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.4,
      fontSize: 13,
      color: ink,
      fontFamily: BOTANICAL_BODY,
    }),
    text({
      text: "Number attending",
      xIn: CONTENT_INSET,
      yIn: 4.7,
      wIn: W - CONTENT_INSET * 2 - 0.9,
      hIn: 0.4,
      fontSize: 13,
      color: ink,
      fontFamily: BOTANICAL_BODY,
    }),
    box({ shape: "line", fill: green, xIn: W - CONTENT_INSET - 0.7, yIn: 5.02, wIn: 0.7, hIn: 0.012 }),
    ...botanicalSpray(green, blush, "bottomRight"),
  ]);

  const details = slide(bg, [
    ...botanicalSpray(green, blush, "topLeft"),
    text({ text: "Wedding Weekend Details", xIn: CONTENT_INSET, yIn: 1.15, wIn: W - CONTENT_INSET * 2, hIn: 0.55, fontSize: 21, align: "center", color: green, fontFamily: SCRIPT }),

    text({ text: "CEREMONY", xIn: CONTENT_INSET, yIn: 2.0, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 10, align: "center", color: palette.secondary, fontFamily: BOTANICAL_BODY, bold: true }),
    text({
      text: "4:30 PM, the orchard at Meadowbrook Farm",
      xIn: CONTENT_INSET,
      yIn: 2.3,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.5,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: BOTANICAL_BODY,
    }),

    text({ text: "RECEPTION", xIn: CONTENT_INSET, yIn: 3.0, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 10, align: "center", color: palette.secondary, fontFamily: BOTANICAL_BODY, bold: true }),
    text({
      text: "6:00 PM, dinner in the restored barn",
      xIn: CONTENT_INSET,
      yIn: 3.3,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.5,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: BOTANICAL_BODY,
    }),

    text({ text: "STAY", xIn: CONTENT_INSET, yIn: 4.0, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 10, align: "center", color: palette.secondary, fontFamily: BOTANICAL_BODY, bold: true }),
    text({
      text: "A few farmhouse rooms are held for out-of-town guests -\nask us for the list, or stay in nearby Hudson",
      xIn: CONTENT_INSET,
      yIn: 4.3,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.6,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: BOTANICAL_BODY,
    }),

    text({ text: "REGISTRY", xIn: CONTENT_INSET, yIn: 5.15, wIn: W - CONTENT_INSET * 2, hIn: 0.3, fontSize: 10, align: "center", color: palette.secondary, fontFamily: BOTANICAL_BODY, bold: true }),
    text({
      text: "wrenandsilas.com",
      xIn: CONTENT_INSET,
      yIn: 5.45,
      wIn: W - CONTENT_INSET * 2,
      hIn: 0.4,
      fontSize: 12,
      align: "center",
      color: ink,
      fontFamily: BOTANICAL_BODY,
    }),
    ...botanicalSpray(green, blush, "bottomRight"),
  ]);

  return [invitation, rsvp, details];
}

export const WEDDING_INVITATION_LAYOUT = { widthIn: W, heightIn: H, bleedIn: BLEED_IN };
