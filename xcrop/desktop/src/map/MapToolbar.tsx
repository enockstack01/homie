interface Props {
  measuring: boolean;
  onToggleMeasure: () => void;
  measureReadout: string | null;
  measureDisabled: boolean;
  drawing: boolean;
  drawPointCount: number;
  onUndoPoint: () => void;
  onCancelDrawing: () => void;
}

export function MapToolbar({
  measuring,
  onToggleMeasure,
  measureReadout,
  measureDisabled,
  drawing,
  drawPointCount,
  onUndoPoint,
  onCancelDrawing,
}: Props) {
  return (
    <div className="map-control-panel map-toolbar">
      <button
        className={measuring ? "toolbar-btn active" : "toolbar-btn"}
        onClick={onToggleMeasure}
        disabled={measureDisabled}
        title={measureDisabled ? "Finish drawing/editing the AOI first" : "Measure distance and area"}
      >
        {measuring ? "Stop measuring" : "Measure"}
      </button>
      {measuring && measureReadout && <div className="toolbar-readout">{measureReadout}</div>}
      {drawing && (
        <div className="toolbar-draw-actions">
          <button
            className="toolbar-btn"
            onClick={onUndoPoint}
            disabled={drawPointCount === 0}
            title="Undo last point (Backspace)"
          >
            Undo point
          </button>
          <button className="toolbar-btn" onClick={onCancelDrawing} title="Cancel drawing (Esc)">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
