import { useMemo } from "react";
import type { RunResult } from "../lib/api";

interface Props {
  run: RunResult;
  onClose: () => void;
  onOpenInMap: () => void;
}

const CRITERION_LABELS: Record<string, string> = {
  annual_rainfall_mm: "Rainfall",
  mean_temp_c: "Temperature",
  elevation_m: "Elevation",
};

// Every criterion this app currently scores against - see
// orchestrator/app/suitability.py's CRITERION_WEIGHTS keys.
const CRITERIA = ["annual_rainfall_mm", "mean_temp_c", "elevation_m"] as const;

export function RunDetail({ run, onClose, onOpenInMap }: Props) {
  const { summary, crop_name, weights_used, points } = run.result;
  const totalWeight = CRITERIA.reduce((sum, k) => sum + (weights_used[k] ?? 0), 0) || 1;
  const totalPoints = points.length || 1;

  // The score each criterion contributed *on average* across the whole AOI - this is
  // what actually explains "why" the mean suitability came out the way it did, beyond
  // just the final blended number (see suitability.py's score_point for how these and
  // the weights combine into it).
  const avgCriterionScores = useMemo(() => {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const p of points) {
      for (const [k, v] of Object.entries(p.criterion_scores)) {
        sums[k] = (sums[k] ?? 0) + v;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return Object.fromEntries(Object.keys(sums).map((k) => [k, sums[k] / counts[k]]));
  }, [points]);

  return (
    <div className="run-detail-backdrop" onClick={onClose}>
      <div className="card run-detail" onClick={(e) => e.stopPropagation()}>
        <div className="run-detail-header">
          <div>
            <h2>{crop_name} suitability</h2>
            <p className="hint">
              {run.project_name ?? "Unnamed project"} · {new Date(run.created_at).toLocaleString()}
            </p>
          </div>
          <button className="run-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="stat-cards">
          <div className="card stat-card">
            <span className="stat-value">{summary.mean_suitability}</span>
            <span className="stat-label">Mean suitability / 100</span>
          </div>
          <div className="card stat-card">
            <span className="stat-value">{points.length}</span>
            <span className="stat-label">Grid points analyzed</span>
          </div>
          <div className="card stat-card">
            <span className="stat-value">{CRITERION_LABELS[summary.dominant_limiting_factor ?? ""] ?? "None"}</span>
            <span className="stat-label">Dominant limiting factor</span>
          </div>
        </div>

        <section className="stack">
          <h3>Suitability class distribution</h3>
          <div className="class-distribution">
            {Object.entries(summary.class_distribution).map(([cls, count]) => (
              <span key={cls} className={`class-badge class-${cls}`}>
                {cls}: {count} ({((count / totalPoints) * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </section>

        <section className="stack">
          <h3>Criteria: weight and average score</h3>
          <table className="criterion-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Weight</th>
                <th>Avg. score</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((k) => (
                <tr key={k}>
                  <td>{CRITERION_LABELS[k]}</td>
                  <td>
                    <span className="weight-bar-track">
                      <span
                        className="weight-bar-fill"
                        style={{ width: `${((weights_used[k] ?? 0) / totalWeight) * 100}%` }}
                      />
                    </span>{" "}
                    {(((weights_used[k] ?? 0) / totalWeight) * 100).toFixed(0)}%
                  </td>
                  <td>{avgCriterionScores[k] !== undefined ? avgCriterionScores[k].toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Weight is this criterion's share of the blended score; average score is how well the AOI scored on it
            alone (0-100), before weighting - a low average score on a heavily-weighted criterion is what drives the
            dominant limiting factor above.
          </p>
        </section>

        <div className="row">
          <button onClick={onOpenInMap}>View on map &amp; ask AI</button>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
