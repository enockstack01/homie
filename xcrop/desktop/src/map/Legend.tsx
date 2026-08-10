import { CLASS_COLORS, CLASS_LABELS, CLASS_ORDER } from "../lib/suitabilityColors";

interface Props {
  visible: boolean;
}

export function Legend({ visible }: Props) {
  if (!visible) return null;
  return (
    <div className="map-control legend">
      <div className="legend-title">Suitability</div>
      {CLASS_ORDER.map((cls) => (
        <div key={cls} className="legend-row">
          <span className="legend-swatch" style={{ background: CLASS_COLORS[cls] }} />
          <span>
            {cls} — {CLASS_LABELS[cls]}
          </span>
        </div>
      ))}
    </div>
  );
}
