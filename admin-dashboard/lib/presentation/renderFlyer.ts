import PptxGenJS from "pptxgenjs";
import type { FlyerContent } from "./templates";

// A flyer is a single portrait page rather than a 16:9 slide deck - its own layout/render
// path rather than shoehorning it through renderDeck.ts's widescreen assumptions.
// pptxgenjs still outputs .pptx (a single-slide one here) rather than a raster image or
// PDF - consistent with this app's one rendering dependency, and still fully editable in
// PowerPoint afterward, matching the spec's "native chart parts stay editable" principle
// applied to the whole document, not just charts.

const PRIMARY = "005C3D";
const ACCENT = "F8B712";
const TEXT_DARK = "101914";

export async function renderFlyer(content: FlyerContent, title: string): Promise<Buffer> {
  const pres = new PptxGenJS();
  // US Letter portrait, in inches - the flyer's actual print/export target.
  pres.defineLayout({ name: "HOMIE_FLYER", width: 8.5, height: 11 });
  pres.layout = "HOMIE_FLYER";
  pres.title = title;

  const slide = pres.addSlide();
  slide.background = { color: PRIMARY };

  slide.addText(content.headline, {
    x: 0.6,
    y: 0.9,
    w: 7.3,
    h: content.subheadline ? 1.4 : 1.8,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
    fontFace: "Arial",
    align: "center",
    valign: "bottom",
  });

  if (content.subheadline) {
    slide.addText(content.subheadline, {
      x: 0.6,
      y: 2.3,
      w: 7.3,
      h: 0.6,
      fontSize: 18,
      color: ACCENT,
      fontFace: "Arial",
      align: "center",
      bold: true,
    });
  }

  // White content panel over the lower ~2/3 of the page, holding the body copy and CTA.
  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 3.2, w: 7.5, h: 7.2, fill: { color: "FFFFFF" } });

  slide.addText(
    content.body.map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
    {
      x: 0.9,
      y: 3.6,
      w: 6.7,
      h: content.cta ? 5.6 : 6.4,
      fontSize: 16,
      color: TEXT_DARK,
      fontFace: "Arial",
      valign: "top",
      lineSpacingMultiple: 1.4,
    },
  );

  if (content.cta) {
    slide.addShape(pres.ShapeType.rect, { x: 0.9, y: 9.3, w: 6.7, h: 0.7, fill: { color: ACCENT } });
    slide.addText(content.cta, {
      x: 0.9,
      y: 9.3,
      w: 6.7,
      h: 0.7,
      fontSize: 15,
      bold: true,
      color: "101914",
      fontFace: "Arial",
      align: "center",
      valign: "middle",
    });
  }

  if (content.footer) {
    slide.addText(content.footer, {
      x: 0.5,
      y: 10.55,
      w: 7.5,
      h: 0.35,
      fontSize: 10,
      color: TEXT_DARK,
      fontFace: "Arial",
      align: "center",
    });
  }

  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}
