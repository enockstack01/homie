import PptxGenJS from "pptxgenjs";
import { SHAPE_KINDS, type Slide } from "./elements";
import { DECK_LAYOUT } from "./layout";

const PPTX_SHAPE_TYPE: Record<string, string> = Object.fromEntries(SHAPE_KINDS.map((k) => [k.id, k.pptx]));

// A deck is now a plain array of freeform Slide/SlideElement objects (see
// lib/presentation/elements.ts) rather than a fixed {title, bullets} layout - this
// renderer is a thin, generic translation from that shape to PptxGenJS calls, with no
// content logic of its own. It's the counterpart to components/presentation/SlideCanvas.tsx,
// which renders the exact same elements as an editable on-screen canvas; both read
// positions in inches directly off each element, so nothing here can drift from what the
// editor shows.

export async function renderDeck(slides: Slide[], title: string): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "HOMIE_16X9", width: DECK_LAYOUT.widthIn, height: DECK_LAYOUT.heightIn });
  pres.layout = "HOMIE_16X9";
  pres.title = title;

  for (const slide of slides) {
    const s = pres.addSlide();
    s.background = { color: slide.background };
    if (slide.notes) s.addNotes(slide.notes);

    for (const el of slide.elements) {
      if (el.type === "text") {
        s.addText(el.text, {
          x: el.xIn,
          y: el.yIn,
          w: el.wIn,
          h: el.hIn,
          fontSize: el.fontSize,
          color: el.color,
          bold: el.bold,
          italic: el.italic,
          align: el.align,
          fontFace: el.fontFamily ?? "Arial",
          valign: "top",
          lineSpacingMultiple: 1.3,
        });
      } else if (el.type === "shape") {
        // PptxGenJS types shapeName as a big string-literal union (SHAPE_NAME) - this is
        // built from pres.ShapeType's own runtime values via PPTX_SHAPE_TYPE, so it's
        // always one of those literals in practice; TS just can't see that through a
        // dynamic Record lookup.
        const shapeType = (pres.ShapeType as unknown as Record<string, string>)[
          PPTX_SHAPE_TYPE[el.shape] ?? "rect"
        ] as Parameters<typeof s.addShape>[0];
        if (el.shape === "line") {
          s.addShape(shapeType, {
            x: el.xIn,
            y: el.yIn,
            w: el.wIn,
            h: el.hIn,
            line: { color: el.fill, width: 2, transparency: 100 - (el.opacity ?? 100) },
            rotate: el.rotate,
          });
        } else {
          s.addShape(shapeType, {
            x: el.xIn,
            y: el.yIn,
            w: el.wIn,
            h: el.hIn,
            fill: { color: el.fill, transparency: 100 - (el.opacity ?? 100) },
            line: { type: "none" },
            rotate: el.rotate,
          });
        }
      } else if (el.type === "table") {
        s.addTable(
          el.rows.map((row, ri) =>
            row.map((cell) => ({
              text: cell,
              options:
                el.headerRow && ri === 0
                  ? { bold: true, fill: { color: "F1F5F4" }, color: "101914" }
                  : { color: "101914" },
            })),
          ),
          {
            x: el.xIn,
            y: el.yIn,
            w: el.wIn,
            h: el.hIn,
            fontSize: 12,
            border: { type: "solid", color: "D8DEDA", pt: 1 },
            autoPage: false,
          },
        );
      } else {
        s.addImage({ data: el.dataUrl, x: el.xIn, y: el.yIn, w: el.wIn, h: el.hIn });
      }
    }
  }

  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}
