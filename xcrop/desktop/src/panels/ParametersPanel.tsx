import { useEffect, useState } from "react";
import { api, type CriterionWeights, type CropProfile } from "../lib/api";
import { RangeEditor } from "./RangeEditor";

const EMPTY_RANGE = { min: 0, optimal_min: 0, optimal_max: 0, max: 0 };

function blankCrop(): CropProfile {
  return {
    id: "",
    name: "",
    annual_rainfall_mm: { ...EMPTY_RANGE },
    mean_temp_c: { ...EMPTY_RANGE },
    elevation_m: { ...EMPTY_RANGE },
    max_slope_percent: 30,
  };
}

interface Props {
  crops: CropProfile[];
  onCropsChanged: () => void;
  /** Dashboard use: skip the collapse toggle and render permanently expanded, since
   * editing parameters is a primary Dashboard action, not a tucked-away option the way
   * it is in the Map view's already-dense sidebar. */
  alwaysOpen?: boolean;
}

export function ParametersPanel({ crops, onCropsChanged, alwaysOpen = false }: Props) {
  const [openState, setOpenState] = useState(false);
  const open = alwaysOpen || openState;
  const [weights, setWeights] = useState<CriterionWeights | null>(null);
  const [weightsStatus, setWeightsStatus] = useState<string | null>(null);

  const [selectedCropId, setSelectedCropId] = useState("");
  const [draft, setDraft] = useState<CropProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [cropStatus, setCropStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open && !weights) {
      api.getWeights().then(setWeights).catch(() => {});
    }
  }, [open, weights]);

  function selectCrop(id: string) {
    setSelectedCropId(id);
    setIsNew(false);
    setCropStatus(null);
    const found = crops.find((c) => c.id === id);
    setDraft(found ? JSON.parse(JSON.stringify(found)) : null);
  }

  function startNewCrop() {
    setIsNew(true);
    setSelectedCropId("");
    setCropStatus(null);
    setDraft(blankCrop());
  }

  async function saveWeights() {
    if (!weights) return;
    try {
      setWeights(await api.setWeights(weights));
      setWeightsStatus("Saved.");
    } catch (err) {
      setWeightsStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveCrop() {
    if (!draft) return;
    try {
      if (isNew) {
        if (!draft.id.trim() || !draft.name.trim()) {
          setCropStatus("id and name are required.");
          return;
        }
        const created = await api.createCrop(draft);
        setCropStatus(`Created "${created.name}".`);
        setIsNew(false);
        setSelectedCropId(created.id);
      } else {
        const updated = await api.updateCrop(draft.id, draft);
        setCropStatus(`Saved "${updated.name}".`);
      }
      onCropsChanged();
    } catch (err) {
      setCropStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeCrop() {
    if (!draft || isNew) return;
    try {
      await api.deleteCrop(draft.id);
      setCropStatus(`Deleted "${draft.name}".`);
      setDraft(null);
      setSelectedCropId("");
      onCropsChanged();
    } catch (err) {
      setCropStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="panel">
      {alwaysOpen ? (
        <h2>Parameters</h2>
      ) : (
        <button className="panel-toggle" onClick={() => setOpenState(!openState)}>
          {open ? "▾" : "▸"} Parameters
        </button>
      )}
      {open && (
        <div className="stack params-panel">
          {weights && (
            <div className="stack">
              <h3>Criterion weights</h3>
              <p className="hint">Relative importance in the suitability score - any positive numbers, normalized automatically.</p>
              <label className="range-field">
                <span>Rainfall</span>
                <input
                  type="number"
                  step="0.1"
                  value={weights.annual_rainfall_mm}
                  onChange={(e) => setWeights({ ...weights, annual_rainfall_mm: Number(e.target.value) })}
                />
              </label>
              <label className="range-field">
                <span>Temperature</span>
                <input
                  type="number"
                  step="0.1"
                  value={weights.mean_temp_c}
                  onChange={(e) => setWeights({ ...weights, mean_temp_c: Number(e.target.value) })}
                />
              </label>
              <label className="range-field">
                <span>Elevation</span>
                <input
                  type="number"
                  step="0.1"
                  value={weights.elevation_m}
                  onChange={(e) => setWeights({ ...weights, elevation_m: Number(e.target.value) })}
                />
              </label>
              <button onClick={saveWeights}>Save weights</button>
              {weightsStatus && <p className="status-line">{weightsStatus}</p>}
            </div>
          )}

          <h3>Crop profiles</h3>
          <select value={selectedCropId} onChange={(e) => (e.target.value ? selectCrop(e.target.value) : setDraft(null))}>
            <option value="">Select a crop to edit...</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={startNewCrop}>
            + New crop
          </button>

          {draft && (
            <div className="stack crop-editor">
              {isNew && (
                <label className="range-field">
                  <span>id</span>
                  <input placeholder="e.g. rice" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
                </label>
              )}
              <label className="range-field">
                <span>Name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <RangeEditor
                label="Annual rainfall"
                unit="mm"
                value={draft.annual_rainfall_mm}
                onChange={(v) => setDraft({ ...draft, annual_rainfall_mm: v })}
              />
              <RangeEditor
                label="Mean temperature"
                unit="°C"
                value={draft.mean_temp_c}
                onChange={(v) => setDraft({ ...draft, mean_temp_c: v })}
              />
              <RangeEditor
                label="Elevation"
                unit="m"
                value={draft.elevation_m}
                onChange={(v) => setDraft({ ...draft, elevation_m: v })}
              />
              <label className="range-field">
                <span>Max slope (%)</span>
                <input
                  type="number"
                  value={draft.max_slope_percent}
                  onChange={(e) => setDraft({ ...draft, max_slope_percent: Number(e.target.value) })}
                />
              </label>
              <div className="row">
                <button onClick={saveCrop}>{isNew ? "Create crop" : "Save changes"}</button>
                {!isNew && (
                  <button className="secondary" onClick={removeCrop}>
                    Delete
                  </button>
                )}
              </div>
              {cropStatus && <p className="status-line">{cropStatus}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
