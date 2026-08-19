import type { CSSProperties } from "react";

// Single source of truth for both the real .pptx renderers (renderDeck.ts, renderFlyer.ts
// - PptxGenJS positions in inches) and the on-screen canvas editor (DeckCanvas,
// FlyerCanvas - CSS pixels). Keeping one file means the online editor can never visually
// drift from what actually downloads - a position or font size changed here changes both
// at once instead of needing two hand-kept-in-sync copies.

export const PRIMARY = "005C3D"; // Homie brand dark green
export const ACCENT = "F8B712"; // Homie brand gold
export const TEXT_DARK = "101914";

/** Curated deck-wide color themes (PresentationStudio's theme picker) - each is a
 * {primary, accent} pair fed into elements.ts's titleSlide/slideFromPlan/deckFromPlans,
 * the same way the fixed Homie brand colors always were, just no longer hardcoded to one
 * choice. Kept small and hand-picked (all readable white-on-primary, dark-on-white)
 * rather than a full color-wheel picker - a "does this actually look good together"
 * curation step a raw picker can't give you. */
export const DECK_THEMES = [
  { id: "homie", name: "Homie", primary: PRIMARY, accent: ACCENT },
  { id: "midnight", name: "Midnight", primary: "111827", accent: "38BDF8" },
  { id: "berry", name: "Berry", primary: "6D28D9", accent: "F472B6" },
  { id: "sunset", name: "Sunset", primary: "9A3412", accent: "FCD34D" },
  { id: "ocean", name: "Ocean", primary: "075985", accent: "5EEAD4" },
  { id: "slate", name: "Slate", primary: "334155", accent: "E2E8F0" },
] as const;

export interface Box {
  xIn: number;
  yIn: number;
  wIn: number;
  hIn: number;
  fontSize: number;
}

export const DECK_LAYOUT = { widthIn: 10, heightIn: 5.63 };
export const DECK_TITLE_BOX: Box = { xIn: 0.6, yIn: 2.0, wIn: 8.8, hIn: 1.4, fontSize: 36 };
export const DECK_SUBTITLE_BOX: Box = { xIn: 0.6, yIn: 3.4, wIn: 8.8, hIn: 0.5, fontSize: 14 };
export const DECK_SLIDE_TITLE_BOX: Box = { xIn: 0.5, yIn: 0.4, wIn: 9, hIn: 0.9, fontSize: 28 };
export const DECK_BULLETS_BOX: Box = { xIn: 0.6, yIn: 1.5, wIn: 8.8, hIn: 3.7, fontSize: 18 };

export const FLYER_LAYOUT = { widthIn: 8.5, heightIn: 11 };
export function flyerHeadlineBox(hasSubheadline: boolean): Box {
  return { xIn: 0.6, yIn: 0.9, wIn: 7.3, hIn: hasSubheadline ? 1.4 : 1.8, fontSize: 40 };
}
export const FLYER_SUBHEADLINE_BOX: Box = { xIn: 0.6, yIn: 2.3, wIn: 7.3, hIn: 0.6, fontSize: 18 };
export const FLYER_PANEL_BOX = { xIn: 0.5, yIn: 3.2, wIn: 7.5, hIn: 7.2 };
export function flyerBodyBox(hasCta: boolean): Box {
  return { xIn: 0.9, yIn: 3.6, wIn: 6.7, hIn: hasCta ? 5.6 : 6.4, fontSize: 16 };
}
export const FLYER_CTA_BOX: Box = { xIn: 0.9, yIn: 9.3, wIn: 6.7, hIn: 0.7, fontSize: 15 };
export const FLYER_FOOTER_BOX: Box = { xIn: 0.5, yIn: 10.55, wIn: 7.5, hIn: 0.35, fontSize: 10 };

// 72 CSS px per inch - chosen because it's also 72 *points* per inch (the unit
// PptxGenJS's fontSize is in), so a box's fontSize can be used directly as a CSS px
// value with no separate conversion factor, at this canvas's native (unscaled) size.
export const PX_PER_INCH = 72;

export function boxToPx(box: Box, pxPerIn: number = PX_PER_INCH): CSSProperties {
  const scale = pxPerIn / PX_PER_INCH;
  return {
    position: "absolute",
    left: box.xIn * pxPerIn,
    top: box.yIn * pxPerIn,
    width: box.wIn * pxPerIn,
    height: box.hIn * pxPerIn,
    fontSize: box.fontSize * scale,
  };
}
