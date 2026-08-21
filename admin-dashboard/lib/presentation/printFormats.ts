/** Real print page sizes for the wedding invitation suite - each canvas is already
 * trim size *plus* 0.125" bleed on every edge (the industry-standard bleed allowance:
 * background/photo elements should extend to the full canvas edge so a printer's
 * unavoidable +/-0.03" trim variance never leaves a sliver of white edge). `safeIn` is
 * how far in from the canvas edge important content (text, a monogram) should stay, so
 * nothing reads as cut off even if trimmed slightly generously - 0.25" past the trim
 * line, matching common print-shop guidance.
 *
 * No genuine CMYK color mode is possible here: PowerPoint/OOXML (what PptxGenJS writes)
 * and the browser/canvas pipeline behind the PDF export are both RGB-only end to end -
 * there is no prepress step in this app to convert into. What IS real: every palette in
 * lib/presentation/layout.ts's PALETTES was chosen avoiding the very saturated,
 * out-of-CMYK-gamut colors (neon greens/oranges, pure blues) that shift most visibly
 * when a commercial printer's RGB-to-CMYK conversion runs - "print-safe RGB," not true
 * CMYK. A user who needs guaranteed exact color matching should still soft-proof with
 * their print shop before a real print run, the same as they would from any other RGB
 * design tool without a dedicated prepress pipeline. */

export const BLEED_IN = 0.125;
export const SAFE_MARGIN_IN = 0.25;

export interface PrintFormat {
  id: string;
  name: string;
  /** Trim size - the size the piece is actually cut to after printing. */
  trimWidthIn: number;
  trimHeightIn: number;
  /** Trim size + bleed on all sides - what the Slide's own canvas/export size should be. */
  widthIn: number;
  heightIn: number;
}

function printFormat(id: string, name: string, trimWidthIn: number, trimHeightIn: number): PrintFormat {
  return {
    id,
    name,
    trimWidthIn,
    trimHeightIn,
    widthIn: trimWidthIn + BLEED_IN * 2,
    heightIn: trimHeightIn + BLEED_IN * 2,
  };
}

export const PRINT_FORMATS = {
  invitation5x7: printFormat("invitation-5x7", "Invitation (5\" x 7\")", 5, 7),
  card4x6: printFormat("card-4x6", "Response/details card (4\" x 6\")", 4, 6),
} as const;
