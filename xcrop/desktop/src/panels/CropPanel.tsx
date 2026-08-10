import type { CropProfile } from "../lib/api";

interface Props {
  crops: CropProfile[];
  selectedCropId: string | null;
  onSelect: (id: string) => void;
  onAnalyze: () => void;
  canAnalyze: boolean;
  analyzing: boolean;
}

export function CropPanel({ crops, selectedCropId, onSelect, onAnalyze, canAnalyze, analyzing }: Props) {
  return (
    <section className="panel">
      <h2>Crop</h2>
      <select value={selectedCropId ?? ""} onChange={(e) => onSelect(e.target.value)}>
        <option value="" disabled>
          Select a crop...
        </option>
        {crops.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button onClick={onAnalyze} disabled={!canAnalyze || analyzing}>
        {analyzing ? "Analyzing..." : "Run suitability analysis"}
      </button>
    </section>
  );
}
