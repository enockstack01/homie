import PptxGenJS from "pptxgenjs";
import type { FlyerContent } from "./templates";
import {
  PRIMARY,
  ACCENT,
  TEXT_DARK,
  FLYER_LAYOUT,
  flyerHeadlineBox,
  FLYER_SUBHEADLINE_BOX,
  FLYER_PANEL_BOX,
  flyerBodyBox,
  FLYER_CTA_BOX,
  FLYER_FOOTER_BOX,
} from "./layout";
import { resolveImageData } from "./assetResolve";

// A flyer is a single portrait page rather than a 16:9 slide deck - its own layout/render
// path rather than shoehorning it through renderDeck.ts's widescreen assumptions.
// pptxgenjs still outputs .pptx (a single-slide one here) rather than a raster image or
// PDF - consistent with this app's one rendering dependency, and still fully editable in
// PowerPoint afterward, matching the spec's "native chart parts stay editable" principle
// applied to the whole document, not just charts.
//
// Every position/size/color below comes from lib/presentation/layout.ts, shared with the
// on-screen canvas editor (components/presentation/FlyerCanvas.tsx) - see renderDeck.ts's
// header comment for why.

export async function renderFlyer(content: FlyerContent, title: string): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "HOMIE_FLYER", width: FLYER_LAYOUT.widthIn, height: FLYER_LAYOUT.heightIn });
  pres.layout = "HOMIE_FLYER";
  pres.title = title;

  const slide = pres.addSlide();
  slide.background = { color: PRIMARY };

  // Real hero photo (a curated CC0 sample, or the user's own upload - see
  // lib/presentation/assets.ts and FlyerEditor.tsx) fills the same top zone the flat
  // PRIMARY color used to, with a translucent tint over it so the headline/subheadline
  // text - unchanged below - stays legible either way.
  if (content.imageUrl) {
    slide.addImage({
      data: await resolveImageData(content.imageUrl),
      x: 0,
      y: 0,
      w: FLYER_LAYOUT.widthIn,
      h: FLYER_PANEL_BOX.yIn,
      sizing: { type: "cover", w: FLYER_LAYOUT.widthIn, h: FLYER_PANEL_BOX.yIn },
    });
    slide.addShape(pres.ShapeType.rect, {
      x: 0,
      y: 0,
      w: FLYER_LAYOUT.widthIn,
      h: FLYER_PANEL_BOX.yIn,
      fill: { color: PRIMARY, transparency: 40 },
      line: { type: "none" },
    });
  }

  const headlineBox = flyerHeadlineBox(!!content.subheadline);
  slide.addText(content.headline, {
    x: headlineBox.xIn,
    y: headlineBox.yIn,
    w: headlineBox.wIn,
    h: headlineBox.hIn,
    fontSize: headlineBox.fontSize,
    bold: true,
    color: "FFFFFF",
    fontFace: "Arial",
    align: "center",
    valign: "bottom",
  });

  if (content.subheadline) {
    slide.addText(content.subheadline, {
      x: FLYER_SUBHEADLINE_BOX.xIn,
      y: FLYER_SUBHEADLINE_BOX.yIn,
      w: FLYER_SUBHEADLINE_BOX.wIn,
      h: FLYER_SUBHEADLINE_BOX.hIn,
      fontSize: FLYER_SUBHEADLINE_BOX.fontSize,
      color: ACCENT,
      fontFace: "Arial",
      align: "center",
      bold: true,
    });
  }

  // White content panel over the lower ~2/3 of the page, holding the body copy and CTA.
  slide.addShape(pres.ShapeType.rect, {
    x: FLYER_PANEL_BOX.xIn,
    y: FLYER_PANEL_BOX.yIn,
    w: FLYER_PANEL_BOX.wIn,
    h: FLYER_PANEL_BOX.hIn,
    fill: { color: "FFFFFF" },
  });

  const bodyBox = flyerBodyBox(!!content.cta);
  slide.addText(
    content.body.map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
    {
      x: bodyBox.xIn,
      y: bodyBox.yIn,
      w: bodyBox.wIn,
      h: bodyBox.hIn,
      fontSize: bodyBox.fontSize,
      color: TEXT_DARK,
      fontFace: "Arial",
      valign: "top",
      lineSpacingMultiple: 1.4,
    },
  );

  if (content.cta) {
    slide.addShape(pres.ShapeType.rect, {
      x: FLYER_CTA_BOX.xIn,
      y: FLYER_CTA_BOX.yIn,
      w: FLYER_CTA_BOX.wIn,
      h: FLYER_CTA_BOX.hIn,
      fill: { color: ACCENT },
    });
    slide.addText(content.cta, {
      x: FLYER_CTA_BOX.xIn,
      y: FLYER_CTA_BOX.yIn,
      w: FLYER_CTA_BOX.wIn,
      h: FLYER_CTA_BOX.hIn,
      fontSize: FLYER_CTA_BOX.fontSize,
      bold: true,
      color: "101914",
      fontFace: "Arial",
      align: "center",
      valign: "middle",
    });
  }

  if (content.footer) {
    slide.addText(content.footer, {
      x: FLYER_FOOTER_BOX.xIn,
      y: FLYER_FOOTER_BOX.yIn,
      w: FLYER_FOOTER_BOX.wIn,
      h: FLYER_FOOTER_BOX.hIn,
      fontSize: FLYER_FOOTER_BOX.fontSize,
      color: TEXT_DARK,
      fontFace: "Arial",
      align: "center",
    });
  }

  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}
