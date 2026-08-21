import PptxGenJS from "pptxgenjs";
import { SHAPE_KINDS, type Slide } from "./elements";
import { DECK_LAYOUT } from "./layout";
import { resolveImageData } from "./assetResolve";

const PPTX_SHAPE_TYPE: Record<string, string> = Object.fromEntries(SHAPE_KINDS.map((k) => [k.id, k.pptx]));

// A deck is now a plain array of freeform Slide/SlideElement objects (see
// lib/presentation/elements.ts) rather than a fixed {title, bullets} layout - this
// renderer is a thin, generic translation from that shape to PptxGenJS calls, with no
// content logic of its own. It's the counterpart to components/presentation/SlideCanvas.tsx,
// which renders the exact same elements as an editable on-screen canvas; both read
// positions in inches directly off each element, so nothing here can drift from what the
// editor shows.

/** `pageSize` defaults to the normal 16:9 deck layout - pass a print-format size (see
 * lib/presentation/printFormats.ts) to render a portrait card instead, for the wedding
 * invitation suite. Every element position is already just inches, with no inherent
 * landscape assumption, so this is the only thing that needed to change here. */
export async function renderDeck(slides: Slide[], title: string, pageSize: { widthIn: number; heightIn: number } = DECK_LAYOUT): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "HOMIE_CUSTOM", width: pageSize.widthIn, height: pageSize.heightIn });
  pres.layout = "HOMIE_CUSTOM";
  pres.title = title;

  for (const slide of slides) {
    const s = pres.addSlide();
    s.background = { color: slide.background };
    if (slide.notes) s.addNotes(slide.notes);

    for (const el of slide.elements) {
      if (el.type === "text") {
        const textOpts = {
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
          valign: "top" as const,
          lineSpacingMultiple: 1.3,
          shadow: el.shadow ? { type: "outer" as const, color: "000000", opacity: 0.45, blur: 3, offset: 2, angle: 45 } : undefined,
          outline: el.outline ? { color: el.color, size: 0.75 } : undefined,
        };
        // Real PptxGenJS bullet/number formatting (not literal "• " characters) - each
        // line becomes its own paragraph, with leading tabs (see SlideCanvas.tsx's
        // Tab/Shift+Tab handling) setting that line's indent level and then stripped
        // from the visible text.
        if (el.listStyle && el.listStyle !== "none") {
          const paragraphs = el.text.split("\n").map((line) => {
            const indentLevel = Math.min(4, line.match(/^\t*/)?.[0].length ?? 0);
            return {
              text: line.replace(/^\t*/, ""),
              options: {
                bullet: el.listStyle === "number" ? { type: "number" as const, numberType: "arabicPeriod" as const } : true,
                indentLevel,
              },
            };
          });
          s.addText(paragraphs, textOpts);
        } else {
          s.addText(el.text, textOpts);
        }
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
      } else if (el.type === "chart") {
        const chartType = pres.ChartType[el.chartKind];
        s.addChart(chartType, [{ name: "Series 1", labels: el.labels, values: el.values }], {
          x: el.xIn,
          y: el.yIn,
          w: el.wIn,
          h: el.hIn,
          showLegend: false,
          showTitle: false,
          ...(el.chartKind === "pie" ? {} : { chartColors: [el.color] }),
        });
      } else {
        // sizing:"cover" matches SlideCanvas.tsx's object-fit:cover on the <img> preview -
        // without it PptxGenJS stretches the source image to exactly fill w x h, distorting
        // its aspect ratio whenever the frame's proportions don't match the photo's.
        s.addImage({
          data: await resolveImageData(el.dataUrl),
          x: el.xIn,
          y: el.yIn,
          w: el.wIn,
          h: el.hIn,
          altText: el.alt,
          sizing: { type: "cover", w: el.wIn, h: el.hIn },
        });
      }
    }
  }

  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}
