"use client";

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
  boxToPx,
  PX_PER_INCH,
} from "@/lib/presentation/layout";

export const FLYER_CANVAS_WIDTH = FLYER_LAYOUT.widthIn * PX_PER_INCH;
export const FLYER_CANVAS_HEIGHT = FLYER_LAYOUT.heightIn * PX_PER_INCH;

const centeredTextarea = "w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-center leading-tight outline-none";

interface Props {
  headline: string;
  subheadline?: string;
  body: string[];
  cta?: string;
  footer?: string;
  imageUrl?: string;
  editable: boolean;
  onHeadlineChange?: (value: string) => void;
  onSubheadlineChange?: (value: string | undefined) => void;
  onBodyChange?: (index: number, value: string) => void;
  onBodyAdd?: () => void;
  onBodyRemove?: (index: number) => void;
  onCtaChange?: (value: string | undefined) => void;
  onFooterChange?: (value: string | undefined) => void;
  onImageChange?: (dataUrl: string | undefined) => void;
  onImagePick?: () => void;
}

/** Renders the flyer "page" at its true pixel size - see DeckCanvas.tsx's header comment
 * for why (same principle, single-page layout instead of multi-slide). Subheadline/CTA/
 * footer are optional fields, same as in FlyerContent: absent ones show an inline
 * "+ Add..." affordance in their would-be position rather than an empty box, and the
 * headline's own box grows to fill the space when there's no subheadline - exactly
 * mirroring lib/presentation/renderFlyer.ts's own conditional layout. */
export function FlyerCanvas({
  headline,
  subheadline,
  body,
  cta,
  footer,
  imageUrl,
  editable,
  onHeadlineChange,
  onSubheadlineChange,
  onBodyChange,
  onBodyAdd,
  onBodyRemove,
  onCtaChange,
  onFooterChange,
  onImageChange,
  onImagePick,
}: Props) {
  const headlineBox = flyerHeadlineBox(subheadline !== undefined);
  const bodyBox = flyerBodyBox(cta !== undefined);
  const photoZoneHeightPx = FLYER_PANEL_BOX.yIn * PX_PER_INCH;

  return (
    <div
      className="relative"
      style={{ width: FLYER_CANVAS_WIDTH, height: FLYER_CANVAS_HEIGHT, backgroundColor: `#${PRIMARY}` }}
    >
      {imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            style={{ position: "absolute", left: 0, top: 0, width: FLYER_CANVAS_WIDTH, height: photoZoneHeightPx, objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: FLYER_CANVAS_WIDTH,
              height: photoZoneHeightPx,
              backgroundColor: `#${PRIMARY}`,
              opacity: 0.4,
            }}
          />
        </>
      )}

      {editable && (
        <div className="absolute right-2 top-2 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={onImagePick}
            className="rounded bg-black/40 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/60"
          >
            {imageUrl ? "Change photo" : "+ Add photo"}
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onImageChange?.(undefined)}
              className="rounded bg-black/40 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/60"
            >
              Remove
            </button>
          )}
        </div>
      )}

      <div style={{ ...boxToPx(headlineBox), display: "flex", alignItems: "flex-end" }}>
        <textarea
          value={headline}
          readOnly={!editable}
          onChange={(e) => onHeadlineChange?.(e.target.value)}
          rows={1}
          style={{ color: "#fff", fontSize: headlineBox.fontSize }}
          className={`${centeredTextarea} font-bold`}
          placeholder="Headline"
        />
      </div>

      {subheadline !== undefined ? (
        <div style={{ ...boxToPx(FLYER_SUBHEADLINE_BOX), display: "flex", alignItems: "center" }} className="group">
          <textarea
            value={subheadline}
            readOnly={!editable}
            onChange={(e) => onSubheadlineChange?.(e.target.value)}
            rows={1}
            style={{ color: `#${ACCENT}`, fontSize: FLYER_SUBHEADLINE_BOX.fontSize }}
            className={`${centeredTextarea} font-bold`}
            placeholder="Subheadline"
          />
          {editable && (
            <button
              type="button"
              onClick={() => onSubheadlineChange?.(undefined)}
              className="absolute right-1 top-1 text-xs text-white/40 opacity-0 hover:text-white group-hover:opacity-100"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        editable && (
          <button
            type="button"
            onClick={() => onSubheadlineChange?.("")}
            style={boxToPx(FLYER_SUBHEADLINE_BOX)}
            className="text-xs font-medium text-white/50 hover:text-white"
          >
            + Add subheadline
          </button>
        )
      )}

      <div style={{ position: "absolute", ...boxToPx({ ...FLYER_PANEL_BOX, fontSize: 0 }), backgroundColor: "#fff" }} />

      <div style={{ ...boxToPx(bodyBox), display: "flex", flexDirection: "column", gap: 6 }}>
        {body.map((line, i) => (
          <div key={i} className="group flex items-start gap-1.5">
            <span style={{ color: `#${TEXT_DARK}`, fontSize: bodyBox.fontSize, lineHeight: 1.4 }}>•</span>
            <textarea
              value={line}
              readOnly={!editable}
              onChange={(e) => onBodyChange?.(i, e.target.value)}
              rows={1}
              style={{ color: `#${TEXT_DARK}`, fontSize: bodyBox.fontSize, lineHeight: 1.4 }}
              className="min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
              placeholder="Body line"
            />
            {editable && body.length > 1 && (
              <button
                type="button"
                onClick={() => onBodyRemove?.(i)}
                className="shrink-0 text-xs text-foreground/30 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {editable && (
          <button type="button" onClick={() => onBodyAdd?.()} className="self-start text-xs font-medium hover:underline" style={{ color: `#${PRIMARY}` }}>
            + Add line
          </button>
        )}
      </div>

      {cta !== undefined ? (
        <>
          <div style={{ position: "absolute", ...boxToPx({ ...FLYER_CTA_BOX, fontSize: 0 }), backgroundColor: `#${ACCENT}` }} />
          <div style={{ ...boxToPx(FLYER_CTA_BOX), display: "flex", alignItems: "center" }} className="group">
            <textarea
              value={cta}
              readOnly={!editable}
              onChange={(e) => onCtaChange?.(e.target.value)}
              rows={1}
              style={{ color: "#101914", fontSize: FLYER_CTA_BOX.fontSize }}
              className={`${centeredTextarea} font-bold`}
              placeholder="Call to action"
            />
            {editable && (
              <button
                type="button"
                onClick={() => onCtaChange?.(undefined)}
                className="absolute right-1 top-1 text-xs text-black/30 opacity-0 hover:text-red-600 group-hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        </>
      ) : (
        editable && (
          <button
            type="button"
            onClick={() => onCtaChange?.("")}
            style={boxToPx(FLYER_CTA_BOX)}
            className="rounded border border-dashed border-white/40 text-xs font-medium text-white/60 hover:text-white"
          >
            + Add call to action
          </button>
        )
      )}

      {footer !== undefined ? (
        <div style={{ ...boxToPx(FLYER_FOOTER_BOX), display: "flex", alignItems: "center" }} className="group">
          <textarea
            value={footer}
            readOnly={!editable}
            onChange={(e) => onFooterChange?.(e.target.value)}
            rows={1}
            style={{ color: `#${TEXT_DARK}`, fontSize: FLYER_FOOTER_BOX.fontSize }}
            className={centeredTextarea}
            placeholder="Footer"
          />
          {editable && (
            <button
              type="button"
              onClick={() => onFooterChange?.(undefined)}
              className="absolute right-1 top-0.5 text-xs text-foreground/30 opacity-0 hover:text-red-600 group-hover:opacity-100"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        editable && (
          <button
            type="button"
            onClick={() => onFooterChange?.("")}
            style={boxToPx(FLYER_FOOTER_BOX)}
            className="text-xs font-medium text-foreground/40 hover:text-foreground/70"
          >
            + Add footer
          </button>
        )
      )}
    </div>
  );
}
