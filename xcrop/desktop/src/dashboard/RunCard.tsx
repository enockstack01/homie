import type { RunResult } from "../lib/api";
import { CLASS_COLORS, CLASS_ORDER, dominantClass } from "../lib/suitabilityColors";

interface Props {
  run: RunResult;
  onClick: () => void;
}

export function RunCard({ run, onClick }: Props) {
  const { summary, crop_name } = run.result;
  const total = Object.values(summary.class_distribution).reduce((a, b) => a + b, 0) || 1;
  const best = dominantClass(summary.class_distribution);

  return (
    <div className="card run-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="run-card-top">
        <div>
          <div className="run-card-crop">{crop_name}</div>
          <div className="run-card-project">{run.project_name ?? "Unnamed project"}</div>
        </div>
        <span className={`class-badge class-${best}`}>{best}</span>
      </div>

      <div className="run-card-score">
        <span className="value">{summary.mean_suitability}</span>
        <span className="unit">/ 100</span>
      </div>

      <div className="suitability-bar">
        {CLASS_ORDER.map((cls) => {
          const count = summary.class_distribution[cls] ?? 0;
          if (!count) return null;
          return <span key={cls} style={{ width: `${(count / total) * 100}%`, background: CLASS_COLORS[cls] }} />;
        })}
      </div>

      <div className="run-card-date">{new Date(run.created_at).toLocaleString()}</div>
    </div>
  );
}
