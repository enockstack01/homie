import { useEffect, useMemo, useState } from "react";
import { api, type Account, type CropProfile, type RunResult } from "../lib/api";
import { ParametersPanel } from "../panels/ParametersPanel";
import { SettingsPanel } from "../panels/SettingsPanel";
import { AccountCard } from "./AccountCard";
import { RunCard } from "./RunCard";
import { RunDetail } from "./RunDetail";

interface Props {
  account: Account | null;
  hasApiKey: boolean;
  onSettingsSaved: () => void;
  onSignOut: () => void;
  crops: CropProfile[];
  onCropsChanged: () => void;
  onOpenRunInMap: (run: RunResult) => void;
  onGoToMap: () => void;
}

export function DashboardView({
  account,
  hasApiKey,
  onSettingsSaved,
  onSignOut,
  crops,
  onCropsChanged,
  onOpenRunInMap,
  onGoToMap,
}: Props) {
  const [runs, setRuns] = useState<RunResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunResult | null>(null);

  useEffect(() => {
    api
      .listAllRuns()
      .then(setRuns)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const stats = useMemo(() => {
    if (!runs || runs.length === 0) return null;
    const avgSuitability = runs.reduce((sum, r) => sum + r.result.summary.mean_suitability, 0) / runs.length;
    const cropsAnalyzed = new Set(runs.map((r) => r.crop_id)).size;
    return { totalRuns: runs.length, avgSuitability, cropsAnalyzed };
  }, [runs]);

  return (
    <div className="dashboard">
      <div className="dashboard-inner">
        <div className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Every crop suitability analysis you&apos;ve run, in one place.</p>
          </div>
          <button onClick={onGoToMap}>+ New analysis</button>
        </div>

        {account ? (
          <AccountCard account={account} onSignOut={onSignOut} />
        ) : (
          <SettingsPanel hasApiKey={hasApiKey} onSaved={onSettingsSaved} />
        )}

        {stats && (
          <div className="stat-cards">
            <div className="card stat-card">
              <span className="stat-value">{stats.totalRuns}</span>
              <span className="stat-label">Total runs</span>
            </div>
            <div className="card stat-card">
              <span className="stat-value">{stats.avgSuitability.toFixed(1)}</span>
              <span className="stat-label">Avg. suitability</span>
            </div>
            <div className="card stat-card">
              <span className="stat-value">{stats.cropsAnalyzed}</span>
              <span className="stat-label">Crops analyzed</span>
            </div>
          </div>
        )}

        <section className="stack">
          <div className="section-title">
            <h2>Run history</h2>
          </div>
          {error && <p className="error">{error}</p>}
          {runs === null && !error && <p className="hint">Loading run history...</p>}
          {runs && runs.length === 0 && (
            <div className="card empty-state">
              No analyses yet. Go to the Map tab, draw an area, and run your first one.
            </div>
          )}
          {runs && runs.length > 0 && (
            <div className="run-grid">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} onClick={() => setSelectedRun(run)} />
              ))}
            </div>
          )}
        </section>

        <ParametersPanel crops={crops} onCropsChanged={onCropsChanged} alwaysOpen />
      </div>

      {selectedRun && (
        <RunDetail
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onOpenInMap={() => {
            onOpenRunInMap(selectedRun);
            setSelectedRun(null);
          }}
        />
      )}
    </div>
  );
}
