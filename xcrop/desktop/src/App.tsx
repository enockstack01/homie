import { useCallback, useEffect, useState } from "react";
import { MapView } from "./map/MapView";
import { TopNav, type View } from "./TopNav";
import { DashboardView } from "./dashboard/DashboardView";
import { SettingsPanel } from "./panels/SettingsPanel";
import { ProjectPanel } from "./panels/ProjectPanel";
import { ParametersPanel } from "./panels/ParametersPanel";
import { CropPanel } from "./panels/CropPanel";
import { ResultsPanel } from "./panels/ResultsPanel";
import { ChatPanel } from "./panels/ChatPanel";
import { api, type Account, type CropProfile, type Project, type RunResult } from "./lib/api";
import "./app.css";

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [orchestratorReady, setOrchestratorReady] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pendingAoi, setPendingAoi] = useState<GeoJSON.Polygon | null>(null);

  const [crops, setCrops] = useState<CropProfile[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);

  const [run, setRun] = useState<RunResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [chatSeed, setChatSeed] = useState<{ text: string; nonce: number } | null>(null);

  const refreshAccount = useCallback(async () => {
    try {
      setAccount(await api.getAccount());
    } catch {
      setAccount(null);
    }
  }, []);

  // Clears both halves of the stored key - the orchestrator's in-memory copy (this
  // process's lifetime only) and Electron's at-rest one (see credentialStore.ts) -
  // otherwise a fresh orchestrator spawn or the next settings read would resurrect
  // whichever half survived. Best-effort: an unreachable orchestrator shouldn't block
  // clearing the at-rest copy, since either failure mode is much worse than "sign out
  // did less than it could" - the alternative is not signing out the user at all.
  const handleSignOut = useCallback(async () => {
    try {
      await api.clearSettings();
    } catch {
      // Orchestrator may already be down - still clear the at-rest key below.
    }
    await window.xcropSecure.clearApiKey();
    setHasApiKey(false);
    setAccount(null);
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setHasApiKey(s.has_api_key);
      setOrchestratorReady(true);
      if (s.has_api_key) void refreshAccount();
      else setAccount(null);
    } catch {
      setOrchestratorReady(false);
    }
  }, [refreshAccount]);

  const refreshCrops = useCallback(() => {
    api.listCrops().then(setCrops).catch(() => {});
  }, []);

  useEffect(() => {
    // The orchestrator sidecar can take a moment to bind its port after Electron spawns
    // it (see electron/main.ts's waitForOrchestrator) - poll from the renderer too rather
    // than assuming it's already up on first render. Stops once ready instead of polling
    // forever - after that, refreshSettings only runs on demand (SettingsPanel's onSaved,
    // or the sign-in callback below).
    if (orchestratorReady) return;
    const interval = setInterval(refreshSettings, 1000);
    refreshSettings();
    return () => clearInterval(interval);
  }, [orchestratorReady, refreshSettings]);

  useEffect(() => {
    if (!orchestratorReady) return;
    api.listProjects().then(setProjects).catch(() => {});
    refreshCrops();
  }, [orchestratorReady, refreshCrops]);

  // Fires once the xcrop://auth-callback handoff (browser sign-in -> Electron main
  // process, see electron/main.ts) has stored the new key - refresh here rather than
  // polling, since the callback can land at any time, not just around app startup. A
  // failed priming (e.g. backend unreachable) surfaces as signInError instead of leaving
  // the user staring at an unchanged "Sign in" button with no explanation.
  useEffect(
    () =>
      window.xcropSecure.onSignedIn((result) => {
        if (result.success) {
          setSignInError(null);
          void refreshSettings();
        } else {
          setSignInError(result.error ?? "Sign-in didn't complete - please try again.");
        }
      }),
    [refreshSettings]
  );

  // Backstop for the IPC event above: the orchestrator-readiness poll (previous effect)
  // stops the moment the orchestrator responds at all, which happens almost immediately -
  // long before the user has finished the browser sign-in round-trip. If the "signed-in"
  // IPC message is ever missed (e.g. the fresh-launch race in electron/main.ts's
  // sendSignedInResult, or the user switching back to xcrop before it fires), nothing
  // would otherwise re-check settings and the dashboard would sit showing "Sign in"
  // forever despite the key having actually saved. Refreshing on window focus - the exact
  // moment the user returns from completing sign-in in their browser - closes that gap.
  useEffect(() => {
    window.addEventListener("focus", refreshSettings);
    return () => window.removeEventListener("focus", refreshSettings);
  }, [refreshSettings]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  function handlePolygonComplete(polygon: GeoJSON.Polygon) {
    setPendingAoi(polygon);
    setDrawing(false);
  }

  // Shared by ProjectPanel's "Cancel" (shown once a polygon is complete and named) and
  // MapView's Escape/"Cancel" (usable mid-draw too, before any polygon exists yet) - either
  // way, back out of both drawing and review state entirely rather than leaving one half-set.
  function handleCancelDrawing() {
    setDrawing(false);
    setPendingAoi(null);
  }

  async function handleSaveProject(name: string) {
    if (!pendingAoi) return;
    const project = await api.createProject(name, pendingAoi);
    setProjects((prev) => [project, ...prev]);
    setActiveProjectId(project.id);
    setPendingAoi(null);
    setRun(null);
  }

  async function handleAnalyze() {
    if (!activeProjectId || !selectedCropId) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await api.analyze(activeProjectId, selectedCropId);
      setRun(result);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  function handleAskAiToExplain() {
    setChatSeed({ text: "Explain this suitability analysis: what stands out, and why?", nonce: Date.now() });
  }

  function handleOpenRunInMap(selected: RunResult) {
    setActiveProjectId(selected.project_id);
    setRun(selected);
    setSelectedCropId(selected.crop_id);
    setView("map");
  }

  return (
    <div className="app-shell">
      <TopNav
        view={view}
        onViewChange={setView}
        account={account}
        onSignIn={() => window.xcropSecure.openSignIn()}
        onSignOut={handleSignOut}
      />
      <div className="app-body">
        {view === "dashboard" ? (
          <DashboardView
            account={account}
            signInError={signInError}
            onSignIn={() => {
              setSignInError(null);
              window.xcropSecure.openSignIn();
            }}
            onSignOut={handleSignOut}
            crops={crops}
            onCropsChanged={refreshCrops}
            onOpenRunInMap={handleOpenRunInMap}
            onGoToMap={() => setView("map")}
          />
        ) : (
          <>
            <aside className="sidebar">
              {!orchestratorReady && <p className="hint">Starting orchestrator...</p>}
              <SettingsPanel hasApiKey={hasApiKey} onSaved={refreshSettings} />
              <ProjectPanel
                projects={projects}
                activeProjectId={activeProjectId}
                onSelect={(id) => {
                  setActiveProjectId(id);
                  setRun(null);
                }}
                drawing={drawing}
                onStartDrawing={() => setDrawing(true)}
                pendingAoi={pendingAoi}
                onSaveProject={handleSaveProject}
                onCancelDrawing={handleCancelDrawing}
              />
              <ParametersPanel crops={crops} onCropsChanged={refreshCrops} />
              {activeProject && (
                <CropPanel
                  crops={crops}
                  selectedCropId={selectedCropId}
                  onSelect={setSelectedCropId}
                  onAnalyze={handleAnalyze}
                  // Only chat/"Explain" needs a Homie key - the analysis itself is pure
                  // Open-Meteo + local scoring, no account required.
                  canAnalyze={!!selectedCropId}
                  analyzing={analyzing}
                />
              )}
              {analyzeError && <p className="error">{analyzeError}</p>}
              <ResultsPanel run={run} onAskAiToExplain={handleAskAiToExplain} />
              <ChatPanel runId={run?.id ?? null} hasApiKey={hasApiKey} seed={chatSeed} />
            </aside>
            <main className="map-container">
              <MapView
                drawing={drawing}
                onPolygonComplete={handlePolygonComplete}
                onCancelDrawing={handleCancelDrawing}
                editable={!!pendingAoi}
                onPolygonEdited={setPendingAoi}
                activeAoi={pendingAoi ?? activeProject?.aoi_geojson ?? null}
                results={run?.result.points ?? []}
              />
            </main>
          </>
        )}
      </div>
    </div>
  );
}
