# xcrop (AICSIS) — desktop app

A working foundation and vertical slice of the AICSIS platform described in the technical
doc, not the full 10-phase build. This README says plainly what's real and what's a
placeholder, so nothing here gets mistaken for more than it is.

## What actually works right now

- **Electron + React + TypeScript desktop shell** (`desktop/`), matching the doc's
  proposed stack (Tauri was the doc's first choice; this machine has no Rust toolchain,
  so Electron — the doc's own listed alternative — is what's actually built and runnable).
- **Python FastAPI orchestrator** (`orchestrator/`), spawned by Electron as a local
  sidecar on `127.0.0.1:8756`.
- **Project Manager**: draw an AOI polygon on the map (click to place vertices,
  double-click to close), name it, and it's saved to a local SQLite file
  (`~/.xcrop/xcrop.sqlite3`).
- **Real data connectors, no API key required**: elevation and one-year climate (rainfall
  sum, mean temperature) from Open-Meteo's free public APIs, sampled over a 12x12 grid per
  AOI (`orchestrator/app/grid.py`'s `GRID_SIZE`). Open-Meteo's free tier does rate-limit
  under heavy back-to-back usage (`429 Too Many Requests` on the climate archive endpoint
  specifically) — surfaced as a clean, readable error in the UI rather than a crash, and
  it clears on its own after a short cooldown.
- **A real suitability engine**: rule-based hard exclusion on slope, weighted-overlay
  scoring (rainfall/temperature/elevation) against a persisted, user-editable set of crop
  profiles (seeded with avocado, maize, coffee arabica), FAO S1/S2/S3/N classification,
  dominant-limiting-factor identification — see `orchestrator/app/suitability.py`.
- **Editable parameters**: the Parameters panel (sidebar) lets you adjust criterion
  weights (rainfall/temperature/elevation — any positive numbers, normalized
  automatically) and create/edit/delete crop profiles (rainfall/temperature/elevation
  tolerance ranges, max slope) — persisted to `~/.xcrop/params.json`, applied to every
  subsequent analysis. See `orchestrator/app/params_store.py` and `routes/params.py`.
- **Five basemaps**: Street (OSM), Satellite (Esri World Imagery), Terrain (OpenTopoMap),
  Light and Dark (CartoDB) — all free, no API key, switchable live from the map's own
  top-left control (`desktop/src/map/basemaps.ts`).
- **Terrain-painted suitability visualization**: each grid cell renders as its own
  edge-to-edge filled polygon (not a sparse dot), colored by FAO class, directly over
  whichever basemap is active — plus a legend, click-for-detail popups, and standard map
  tools (zoom, compass, fullscreen, scale) via MapLibre's built-in controls.
- **A real conversational AI chat**, not just a one-shot explanation: the "Ask xcrop"
  panel is a full multi-turn conversation through your Homie account's `/v1/chat` gateway
  (`backend/app/routes/chat.py` — the same gateway and key mechanism the ArcGIS Pro Add-in
  already uses; nothing calls Anthropic directly, usage is billed against your real Homie
  credit balance). When a run is active, every message is grounded in that run's actual
  data (`orchestrator/app/chat_ai.py`) — it won't invent numbers for your current
  analysis — but it also answers general agronomy/climate/GIS questions from its own
  knowledge, clearly distinguishing the two. "Explain this analysis" on the Results panel
  is a one-click shortcut into the same chat, not a separate code path.
- **OS-encrypted API key storage**: the key is encrypted at rest via Electron's
  `safeStorage` (DPAPI on Windows, Keychain on macOS, libsecret on Linux) in
  `electron/credentialStore.ts`, living in Electron's own userData directory. The
  orchestrator itself never writes it to disk — it's kept in process memory only and
  re-primed by Electron (`primeOrchestratorApiKey` in `electron/main.ts`) every time a
  fresh orchestrator process spawns.
- **A real, installable Windows build**: `desktop/release/xcrop Setup 0.1.0.exe`, an NSIS
  installer with no Python dependency at all — the orchestrator is compiled to a
  standalone binary via PyInstaller (`orchestrator/build.ps1` →
  `orchestrator/dist/xcrop-orchestrator.exe`) and shipped as an electron-builder
  `extraResource`. Verified end to end: installed app spawns the compiled orchestrator,
  loads the built UI (not a dev server), and runs a full draw-AOI → analyze flow against
  real Open-Meteo data. See "Building an installer" below.
- **A Dashboard** (the app's default view), authenticated purely by pasting a **Homie API
  key** (issue one from the Homie dashboard, or the ArcGIS Pro Add-in's own Settings panel
  issues the same key) into the Settings form shown right there when no key is configured
  yet — no browser hand-off, no separate sign-in page, nothing but the key itself. Once
  it's saved (validated against the real backend by `orchestrator/app/routes/settings.py`'s
  `PUT /settings` before being accepted or persisted), the Dashboard shows account/credit
  status and a Sign-out control that clears it again, aggregate stats (total runs, average
  suitability, crops analyzed), every past run as a card (`GET /runs`, cross-project — see
  `orchestrator/app/routes/runs.py`), a full run-detail view (class distribution,
  per-criterion weights *and* average scores so it's clear which criterion actually drove
  the result, not just the final blended number), a "View on map & ask AI" handoff back
  into the Map view, and the same Parameters editor as the Map sidebar, permanently
  expanded. Live-verified with a real analysis run through the whole Dashboard → run card
  → detail → "open in map" path.
- **A redesigned, card-based, responsive UI**: a real design-token system in `app.css`
  (`--bg-*`/`--accent`/`--radius-*`/`--shadow-*` custom properties) replacing the earlier
  flat dark theme, a green accent matching the app's own leaf icon, elevated cards with
  hover states, and a top nav bar (Dashboard/Map tabs + account pill) replacing the old
  single-page sidebar-only layout. Responsive across window sizes tested from 860px to
  1800px wide - the sidebar narrows and the Dashboard's stat/run-card grids reflow
  (`grid-template-columns: repeat(auto-fit/auto-fill, minmax(...))`) rather than
  overflowing or clipping.

## What's a deliberate stand-in, not the real thing yet

| Doc's plan | What's here instead | Why |
|---|---|---|
| STAC-based catalogue connectors, SRTM/Copernicus DEM, CHIRPS/WorldClim climate normals | Open-Meteo point APIs: one recent calendar year, not a 30-year climatology | Zero setup, no API keys, works today. Real climatology needs a WorldClim/CHIRPS raster connector. |
| A raster pipeline over a continuous grid (GDAL/rasterio, COGs, reprojection, mosaicking) | A 12x12 point-sample grid per AOI, elevation/climate fetched per point, rendered as filled cells | Avoids building a full download+reproject+resample pipeline for the first working slice. Swappable later — `app/grid.py` is the seam; each point already carries real cell bounds, so a true raster only needs to replace how the grid is built and sampled, not how results render. |
| PostgreSQL + PostGIS | SQLite | No server to install for a single-user local-first tool. Revisit if/when team sync (doc Section 4.3) is built. |
| AHP pairwise-comparison weight editor with consistency-ratio validation, fuzzy logic | A plain weight editor (any positive numbers, normalized automatically), linear membership functions | Real, persisted, user-editable weights now exist (Parameters panel) — what's missing is AHP's structured pairwise-comparison *derivation* of those weights and its CR<0.10 consistency check, not editability itself. |
| Full FAO ECOCROP-sourced Crop Library | A persisted, user-editable crop-profile store (`params_store.py`), seeded with three indicative profiles | Create/edit/delete works end-to-end now — what's missing is bulk-importing real ECOCROP data as the seed set, not the editing capability itself. |
| Scenario Manager, sensitivity/uncertainty analysis, ML suitability models, reporting, plugin SDK | Not built | Out of scope for a first working slice — genuinely months of work per the doc's own roadmap (Section 16). |

## Running it

**Orchestrator** (first time):
```
cd orchestrator
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

**Desktop**:
```
cd desktop
npm install
npm run dev
```
`npm run dev` starts Vite, waits for it, and launches Electron — which in turn spawns the
orchestrator itself (see `electron/main.ts`). You don't need to start the orchestrator by
hand; it's only useful to know how in case something needs debugging directly via curl
against `http://127.0.0.1:8756`.

On first launch, the Dashboard (and the Map view's sidebar) shows a **Homie account** form
- paste in a Homie API key there (issue one from the Homie dashboard, or `POST
/v1/my-api-key/issue` against the backend). Without one, everything works except the "Ask
xcrop" chat panel.

## Building an installer

Produces a real, standalone Windows installer that needs nothing pre-installed on the
target machine — no Python, no Node, nothing:

```
cd orchestrator
.venv\Scripts\pip install -r requirements-dev.txt   # adds pyinstaller
.\build.ps1                                          # -> dist/xcrop-orchestrator.exe

cd ..\desktop
npm run dist                                         # -> release\xcrop Setup 0.1.0.exe
```

`npm run dist` builds the renderer, then runs electron-builder, which packages
`orchestrator/dist/xcrop-orchestrator.exe` in as an `extraResource` (see `package.json`'s
`build.extraResources`) — `electron/main.ts` spawns that compiled binary instead of the
dev venv whenever `app.isPackaged` is true, so the installed app never touches Python.

Two non-obvious things worth knowing if this build ever breaks:

- **`win.signAndEditExecutable: false` is load-bearing, not optional.** Without it,
  electron-builder needs `winCodeSign` (for `rcedit`, which embeds the icon/version info
  into the exe) — that package bundles macOS `.dylib` files as symlinks, and extracting
  those on Windows needs `SeCreateSymbolicLinkPrivilege` (Developer Mode, or an elevated
  shell), which a normal non-admin session doesn't have. The build then retries forever,
  downloading and failing to extract the same archive on a loop. Disabling
  `signAndEditExecutable` skips that whole step; the taskbar/title-bar icon is still set
  at runtime instead (`resolveWindowIconPath` in `electron/main.ts`), so branding isn't
  lost — only the exe's own static file icon (as seen in Explorer before launching it) is
  affected.
- **A shell with its cwd inside `release/win-unpacked/` will block electron-builder from
  overwriting it** ("Device or resource busy" / "in use" on Windows) - Windows won't let
  you delete a directory that's any live process's current working directory. `cd` out of
  `release/` (or any subfolder of it) before rebuilding.

## Suggested next steps, in order

1. Replace the point-sample grid with a real raster pipeline for one variable (start with
   elevation via a DEM connector) — this is the seam that unlocks proper terrain
   derivatives (slope from a real 3x3 kernel, aspect, TWI) instead of the current
   4-neighbor finite difference over sparse points.
2. Add a second real data connector (CHIRPS or WorldClim) to replace the one-year Open-Meteo
   climate approximation with an actual climatology.
3. Seed the crop-profile store from real FAO ECOCROP data instead of three indicative
   profiles, and add AHP pairwise-comparison weight derivation (with its CR<0.10 check) as
   an alternative to entering weights directly.
4. Give the chat real tool-use (doc Section 8): `compare_scenarios`, `rerun_with_weights`,
   etc. as callable functions rather than context-only grounding, so it can act on the
   project, not just describe it.

## Running/driving the app for verification

See `desktop/.claude/skills/run-desktop/SKILL.md` for the Playwright-driven launch scripts
(`smoke.mjs`/`smoke2.mjs`/`smoke3.mjs`/`smoke4.mjs` one-shot checks of increasing depth -
`smoke4.mjs` covers the Dashboard, `driver.mjs` REPL, `smoke_packaged.mjs` against the
actual installer output) and the environment-specific gotchas hit while building them: a
globally-set `ELECTRON_RUN_AS_NODE`, the Electron binary-download workaround, a CSP host
mismatch that blanked the map, a readline/piped-stdin race, a `map.isStyleLoaded()` race
that silently dropped map data, an orphaned orchestrator process holding port 8756 after a
hard-killed test run, `OPENBLAS_NUM_THREADS`/`OMP_NUM_THREADS` needing to be pinned to 1 to
avoid a numpy/OpenBLAS startup crash on a memory-constrained machine (now baked into
`electron/main.ts`'s orchestrator spawn, not just a test-time workaround), and a bare
`<span>`'s `width`/`height` being silently ignored (inline elements don't respect them) -
`app.css`'s `.weight-bar-fill` rendered as an invisible zero-size sliver until it got
`display: block`; if a future bar/fill element does the same, check that first.

To exercise the Dashboard's run cards/detail view without depending on Open-Meteo's rate
limit (see the connector note above), insert a synthetic run directly rather than running
a real analysis:

```python
from app import db
db.init_db()
project = db.create_project("Demo plot", {...aoi geojson...})
db.save_run(project["id"], "avocado", {
    "points": [...], "summary": {...}, "crop_name": "Avocado", "weights_used": {...},
})
```
