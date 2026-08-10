import type { RunResult } from "../lib/api";

interface Props {
  run: RunResult | null;
  onAskAiToExplain: () => void;
}

export function ResultsPanel({ run, onAskAiToExplain }: Props) {
  if (!run) return null;
  const { summary, crop_name } = run.result;

  return (
    <section className="panel">
      <h2>Results — {crop_name}</h2>
      <p className="stat-line">
        Mean suitability: <strong>{summary.mean_suitability}</strong> / 100
      </p>
      <div className="class-distribution">
        {Object.entries(summary.class_distribution).map(([cls, count]) => (
          <span key={cls} className={`class-badge class-${cls}`}>
            {cls}: {count}
          </span>
        ))}
      </div>
      {summary.dominant_limiting_factor && (
        <p className="stat-line">
          Dominant limiting factor: <strong>{summary.dominant_limiting_factor}</strong>
        </p>
      )}

      <button onClick={onAskAiToExplain}>Explain this analysis</button>
    </section>
  );
}
