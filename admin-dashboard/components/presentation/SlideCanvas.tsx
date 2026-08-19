"use client";

import { Rnd as RndClass, type Props as RndProps } from "react-rnd";
import type { ComponentType } from "react";
import type { Slide, SlideElement } from "@/lib/presentation/elements";
import { DECK_LAYOUT, PX_PER_INCH } from "@/lib/presentation/layout";

// react-rnd's own type definitions don't satisfy React 19's stricter JSX.ElementType
// check (a known ecosystem-wide friction point for class components under React 19's
// new types, not specific to this library) - this cast is the standard workaround, with
// no runtime effect at all, just telling TS to trust react-rnd's own documented props.
const Rnd = RndClass as unknown as ComponentType<RndProps>;

export const DECK_CANVAS_WIDTH = DECK_LAYOUT.widthIn * PX_PER_INCH;
export const DECK_CANVAS_HEIGHT = DECK_LAYOUT.heightIn * PX_PER_INCH;

function inToPx(v: number) {
  return v * PX_PER_INCH;
}
function pxToIn(v: number) {
  return v / PX_PER_INCH;
}

function StaticElement({ el }: { el: SlideElement }) {
  const style = {
    position: "absolute" as const,
    left: inToPx(el.xIn),
    top: inToPx(el.yIn),
    width: inToPx(el.wIn),
    height: inToPx(el.hIn),
  };
  if (el.type === "text") {
    return (
      <div
        style={{
          ...style,
          color: `#${el.color}`,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily ?? "Arial",
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? "italic" : "normal",
          textAlign: el.align ?? "left",
          whiteSpace: "pre-wrap",
          lineHeight: 1.3,
          overflow: "hidden",
        }}
      >
        {el.text}
      </div>
    );
  }
  if (el.type === "shape") {
    return (
      <div
        style={{
          ...style,
          backgroundColor: `#${el.fill}`,
          opacity: (el.opacity ?? 100) / 100,
          borderRadius: el.shape === "ellipse" ? "50%" : 0,
        }}
      />
    );
  }
  if (el.type === "table") {
    return (
      <table style={{ ...style, borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}>
        <tbody>
          {el.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="truncate px-1.5 py-1"
                  style={{
                    border: "1px solid #d8deda",
                    fontWeight: el.headerRow && ri === 0 ? 700 : 400,
                    backgroundColor: el.headerRow && ri === 0 ? "#f1f5f4" : "transparent",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={el.dataUrl} alt="" style={{ ...style, objectFit: "cover" }} />;
}

interface EditableProps {
  slide: Slide;
  selectedId: string | null;
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: () => void;
  /** `coalesce: true` marks a change as part of a continuous edit (typing a character) -
   * DeckEditor.tsx's undo history only takes one snapshot per coalesced run instead of
   * one per keystroke, closed out by onStopEditing. Drag/resize/toolbar changes omit it
   * (each is already exactly one discrete user action, so each gets its own undo step). */
  onElementChange: (id: string, patch: Partial<SlideElement>, coalesce?: boolean) => void;
}

function EditableElement({ el, selectedId, editingId, onSelect, onStartEditing, onStopEditing, onElementChange }: EditableProps & { el: SlideElement }) {
  const selected = selectedId === el.id;
  const editing = editingId === el.id;

  return (
    <Rnd
      bounds="parent"
      size={{ width: inToPx(el.wIn), height: inToPx(el.hIn) }}
      position={{ x: inToPx(el.xIn), y: inToPx(el.yIn) }}
      disableDragging={editing}
      enableResizing={!editing}
      onDragStart={() => onSelect(el.id)}
      onDragStop={(_e, d) => onElementChange(el.id, { xIn: pxToIn(d.x), yIn: pxToIn(d.y) })}
      onResizeStop={(_e, _dir, ref, _delta, pos) =>
        onElementChange(el.id, {
          wIn: pxToIn(parseFloat(ref.style.width)),
          hIn: pxToIn(parseFloat(ref.style.height)),
          xIn: pxToIn(pos.x),
          yIn: pxToIn(pos.y),
        })
      }
      style={{ outline: selected ? "2px solid #6d28d9" : "1px dashed transparent" }}
      className="group/el hover:outline hover:outline-1 hover:outline-primary/40"
    >
      {el.type === "text" ? (
        <textarea
          value={el.text}
          readOnly={!editing}
          autoFocus={editing}
          onFocus={(e) => (editing ? e.target.select() : undefined)}
          onMouseDown={(e) => {
            if (!editing) {
              e.preventDefault();
              onSelect(el.id);
            }
          }}
          onDoubleClick={() => onStartEditing(el.id)}
          onBlur={onStopEditing}
          onChange={(e) => onElementChange(el.id, { text: e.target.value }, true)}
          style={{
            color: `#${el.color}`,
            fontSize: el.fontSize,
            fontFamily: el.fontFamily ?? "Arial",
            fontWeight: el.bold ? 700 : 400,
            fontStyle: el.italic ? "italic" : "normal",
            textAlign: el.align ?? "left",
            lineHeight: 1.3,
            cursor: editing ? "text" : "move",
          }}
          className="h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
        />
      ) : el.type === "shape" ? (
        <div
          onMouseDown={() => onSelect(el.id)}
          className="h-full w-full cursor-move"
          style={{
            backgroundColor: `#${el.fill}`,
            opacity: (el.opacity ?? 100) / 100,
            borderRadius: el.shape === "ellipse" ? "50%" : 0,
          }}
        />
      ) : el.type === "table" ? (
        <table
          onMouseDown={() => onSelect(el.id)}
          className="h-full w-full cursor-move"
          style={{ borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}
        >
          <tbody>
            {el.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      border: "1px solid #d8deda",
                      fontWeight: el.headerRow && ri === 0 ? 700 : 400,
                      backgroundColor: el.headerRow && ri === 0 ? "#f1f5f4" : "transparent",
                      padding: 0,
                    }}
                  >
                    <input
                      value={cell}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const rows = el.rows.map((r, rri) =>
                          rri === ri ? r.map((c, cci) => (cci === ci ? e.target.value : c)) : r,
                        );
                        onElementChange(el.id, { rows }, true);
                      }}
                      className="w-full truncate border-0 bg-transparent px-1.5 py-1 text-inherit outline-none"
                      style={{ fontWeight: "inherit" }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={el.dataUrl}
          alt=""
          onMouseDown={() => onSelect(el.id)}
          className="h-full w-full cursor-move object-cover"
        />
      )}
    </Rnd>
  );
}

/** Renders one Slide - either as a fully interactive canvas (drag/resize/select/edit
 * every element, via react-rnd) or, when `editable` is false, as flat static divs for use
 * as a thumbnail. Both modes read the exact same element positions in inches, so a
 * thumbnail is a faithful (just non-interactive) preview of the real editable canvas -
 * and both are a faithful (if not pixel-perfect - browser and PowerPoint text layout
 * engines differ) preview of what lib/presentation/renderDeck.ts actually exports, since
 * all three read from the same Slide/SlideElement data. */
export function SlideCanvas(
  props:
    | { slide: Slide; editable: false }
    | ({ slide: Slide; editable: true } & EditableProps),
) {
  const { slide } = props;

  if (!props.editable) {
    return (
      <div className="relative" style={{ width: DECK_CANVAS_WIDTH, height: DECK_CANVAS_HEIGHT, backgroundColor: `#${slide.background}` }}>
        {slide.elements.map((el) => (
          <StaticElement key={el.id} el={el} />
        ))}
      </div>
    );
  }

  const { selectedId, editingId, onSelect, onStartEditing, onStopEditing, onElementChange } = props;

  return (
    <div
      className="relative"
      style={{ width: DECK_CANVAS_WIDTH, height: DECK_CANVAS_HEIGHT, backgroundColor: `#${slide.background}` }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onSelect(null);
          onStopEditing();
        }
      }}
    >
      {slide.elements.map((el) => (
        <EditableElement
          key={el.id}
          el={el}
          slide={slide}
          selectedId={selectedId}
          editingId={editingId}
          onSelect={onSelect}
          onStartEditing={onStartEditing}
          onStopEditing={onStopEditing}
          onElementChange={onElementChange}
        />
      ))}
    </div>
  );
}
