import type { CropRange } from "../lib/api";

interface Props {
  label: string;
  unit: string;
  value: CropRange;
  onChange: (value: CropRange) => void;
}

const FIELDS: { key: keyof CropRange; label: string }[] = [
  { key: "min", label: "Min" },
  { key: "optimal_min", label: "Optimal min" },
  { key: "optimal_max", label: "Optimal max" },
  { key: "max", label: "Max" },
];

export function RangeEditor({ label, unit, value, onChange }: Props) {
  return (
    <div className="range-editor">
      <div className="range-editor-label">
        {label} <span className="hint">({unit})</span>
      </div>
      <div className="range-editor-fields">
        {FIELDS.map((f) => (
          <label key={f.key} className="range-field">
            <span>{f.label}</span>
            <input
              type="number"
              value={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
