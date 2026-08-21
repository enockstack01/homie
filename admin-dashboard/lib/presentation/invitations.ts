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

export const WEDDING_INVITATION_LAYOUT = { widthIn: W, heightIn: H, bleedIn: BLEED_IN };
