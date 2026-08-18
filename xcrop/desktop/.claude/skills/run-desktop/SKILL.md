---
name: run-desktop
description: Build, run, and drive the xcrop Electron desktop app. Use when asked to start the desktop app, take a screenshot of it, build it, or interact with its UI.
---

xcrop is an Electron + React + TypeScript desktop app (see `../../../README.md` for what
it does). For agent/automated use, drive it via the Playwright `_electron` scripts in this
directory - no xvfb needed (this is Windows), but two environment quirks below are real
and will silently break a naive launch.

All paths are relative to `desktop/` (the directory this skill lives under, at
`desktop/.claude/skills/run-desktop/`).

## Prerequisites / one-time setup

```bash
cd orchestrator && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cd desktop && npm install --ignore-scripts   # see Gotchas: why --ignore-scripts
npx tsc -p electron/tsconfig.json            # compiles electron/*.ts -> dist-electron/
```

If `node_modules/electron/dist/electron.exe` doesn't exist after `npm install
--ignore-scripts` (it won't - that flag skips Electron's own binary-download postinstall),
see **Gotchas: Electron binary install** below.

## Run (agent path)

```bash
# 1. orchestrator (background)
cd orchestrator && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8756 --host 127.0.0.1

# 2. vite dev server (background)
cd desktop && node_modules/.bin/vite --port 5173

# 3. drive it
cd desktop && node .claude/skills/run-desktop/smoke.mjs
```

`smoke.mjs` is a one-shot top-to-bottom script (launch, screenshot, read body text, click
"New project", screenshot again, quit) - use it for a quick verify-it-still-works pass.
`smoke2.mjs` goes further: checks `safeStorage.isEncryptionAvailable()` in the main
process, submits a bad API key and confirms it's rejected without being persisted, then
draws a real AOI rectangle via mouse clicks on the map, saves it as a project, runs a live
suitability analysis (real Open-Meteo calls, ~15-20s), and screenshots the result - this is
the one that actually exercises the map rendering, not just the sidebar. `smoke3.mjs` goes
further still: basemap switching, the Parameters panel (creates a crop profile), the
denser 12x12-grid analysis, and the chat panel's "Explain this analysis" quick action.
`smoke4.mjs` covers the Dashboard (the app's default view): landing state, switching to
Map and back, and confirming a freshly-run analysis shows up as a run card.
Screenshots land in `%LOCALAPPDATA%\Temp\xcrop-shots\` (override: `SCREENSHOT_DIR`).

Open-Meteo's free tier rate-limits under heavy back-to-back testing (`429` specifically on
`archive-api.open-meteo.com`, not the elevation endpoint) - if repeated `smoke2`/`smoke3`
runs in one session start failing analysis with a 429, that's the connector's own clean
error surfacing correctly, not a regression. To verify the *rendering* code (as opposed to
the network connectors, which don't need re-proving once already confirmed) without
burning quota, inject synthetic `PointResult`-shaped data straight into the map via
`page.evaluate(() => window.__xcropMap.getSource("suitability-results").setData(...))` -
`window.__xcropMap` is exposed in dev builds only (`import.meta.env.DEV` in
`MapView.tsx`).

For actual interactive poking, `driver.mjs` is a REPL (same commands as the reference
skill: `launch`, `ss [name]`, `click <sel>`, `click-text <text>`, `type`, `press`, `wait
<sel>`, `eval <js>`, `text [sel]`, `windows`, `quit`). Feed it commands via a heredoc:

```bash
node .claude/skills/run-desktop/driver.mjs <<'EOF'
launch
ss landing
click-text New project (draw AOI)
ss drawing-mode
quit
EOF
```

### Verifying the packaged installer build specifically

`smoke_packaged.mjs` is a separate one-shot script for testing the *actual packaged app*
(`release/win-unpacked/xcrop.exe`, or the equivalent path after a real install) rather
than the dev-mode Electron+Vite combo - it launches with no orchestrator/Vite servers
pre-started (the packaged app is self-contained: `app.isPackaged` is true, so
`electron/main.ts` spawns the compiled `resources/xcrop-orchestrator.exe` and loads
`resources/app.asar/dist/index.html` on its own) and runs the full draw-AOI → save-project
→ analyze flow against it:

```bash
npm run dist                                    # see ../../../README.md's "Building an installer"
node .claude/skills/run-desktop/smoke_packaged.mjs
# or against a different exe path:
node .claude/skills/run-desktop/smoke_packaged.mjs "C:\path\to\installed\xcrop.exe"
```

See the parent README's "Building an installer" section for the `signAndEditExecutable`
and working-directory-lock gotchas hit while getting `npm run dist` to succeed - they're
build-time issues, not runtime ones, so they're documented there rather than here.

### Run (human path)

```bash
npm run dev   # starts vite + electron together, opens a real window
```

## Gotchas

- **`ELECTRON_RUN_AS_NODE=1` is set globally in this sandbox.** Electron's main process
  then behaves as plain Node - `require("electron")` returns a path *string*, not
  `{app, BrowserWindow, ...}`, so `app.whenReady()` throws "Cannot read properties of
  undefined". Both driver scripts already `delete env.ELECTRON_RUN_AS_NODE` before
  launching - if you write a new launcher, do the same, or Electron silently degrades to
  a Node script instead of opening a window.

- **Electron's postinstall binary download (`node_modules/electron/install.js`) fails
  with `ECONNRESET`** on this network, reliably, across retries and alternate mirrors -
  the ~115MB zip download itself usually *completes* into
  `%LOCALAPPDATA%\electron\Cache\<hash>\electron-vX.X.X-win32-x64.zip` (verify with
  Python's `zipfile.ZipFile(...).testzip()` - `None` means it's actually intact), but
  `extract-zip`'s own extraction step then fails silently (exit 0, only
  `LICENSES.chromium.html` lands in `dist/`). Work around it: `npm install
  --ignore-scripts` (skips the broken postinstall entirely, everything else installs
  fine), then manually `Expand-Archive -Path <cached-zip> -DestinationPath
  node_modules/electron/dist -Force`, then write `electron.exe` (Windows) as the content
  of `node_modules/electron/path.txt` (`isInstalled()` in `install.js` checks both `dist/
  version` - already inside the zip - and this file). No need to re-run `install.js`
  after that; the binary just works from `node_modules/electron/dist/electron.exe`.

- **`node_modules/.bin/electron` re-execs through a JS shim that, combined with
  `ELECTRON_RUN_AS_NODE`, doesn't reliably launch the real binary in this sandbox** - both
  scripts call `node_modules/electron/dist/electron.exe` directly instead.

- **`Content-Security-Policy` in `index.html` must list the exact tile host for every
  basemap in `src/map/basemaps.ts`** - `tile.openstreetmap.org`,
  `server.arcgisonline.com`, `tile.opentopomap.org`, `basemaps.cartocdn.com`, one bare
  hostname each, no subdomain wildcards. A CSP entry of `https://*.tile.openstreetmap.org`
  (wildcard-subdomain form) does **not** match the bare host, and silently blocks every
  tile image with no visible error outside the (inaccessible, in a script) devtools
  console - that basemap renders as a blank pane with only the attribution control
  showing, and switching to it from the basemap switcher looks like nothing happened. If
  a basemap looks blank in a screenshot, check its exact host is in the CSP before
  assuming a network problem - this is exactly the kind of thing that resurfaces if a new
  basemap is ever added to `basemaps.ts` without a matching CSP update.

- **readline's `"line"` event does not wait for an async listener to finish before firing
  the next one when stdin is piped** (not a TTY) - `driver.mjs` queues commands through a
  `chain = chain.then(...)` promise chain for exactly this reason; a naive
  `rl.on("line", async (line) => { await run(line) })` runs every piped command
  concurrently instead of in order. Two follow-on traps once you queue like this:
  - Piped stdin **auto-fires `"close"` on EOF almost immediately** - for a heredoc, that's
    before any queued command has actually run, not after. The `"close"` handler must
    `await chain` before exiting, or the process exits before anything in the chain runs.
  - Once `"close"` has fired, `rl` is dead - **any later `rl.prompt()` call (every command
    ends with one) throws `ERR_USE_AFTER_CLOSE`**, and since nothing in the `.then()` chain
    handles that rejection, it silently drops every command queued after the one that
    threw. `driver.mjs`'s `promptSafely()` swallows exactly that one error code for this
    reason - don't call `rl.prompt()` directly in a new command.

- Two Electron windows show up under `app.windows()` in dev/unpacked mode: the real UI
  (`http://localhost:5173/`) and a `devtools://...` window (auto-opened by
  `electron/main.ts` whenever `!app.isPackaged`) - both scripts filter to the
  non-devtools one before interacting. A packaged run (`smoke_packaged.mjs`) only ever has
  the one real window, since devtools auto-open is gated on the same `app.isPackaged` check.

- **Force-killing the Electron process (e.g. a test script's `timeout N ...` cutting it
  off) orphans the spawned orchestrator child** - normal quit paths
  (`window-all-closed`/`before-quit` in `electron/main.ts`) call
  `orchestratorProcess?.kill()`, but a hard kill of the parent doesn't cascade to the
  child automatically. An orphaned `xcrop-orchestrator.exe` (or `python.exe` in dev) then
  holds port 8756, and the *next* launch's own orchestrator fails to bind
  (`WinError 10048`) while Electron's window still opens fine - the symptom is a working
  UI with "orchestrator /health" fetches failing. Check `tasklist` for a stray
  `xcrop-orchestrator.exe`/`python.exe` and kill it by PID before assuming something else
  is broken.

- **`map.isStyleLoaded()` transiently returns `false` for a tick right after another
  effect's own `source.setData()` call in the same React commit** - `MapView.tsx` used to
  gate its AOI-sync and results-sync effects on it (`if (!map.isStyleLoaded()) return`),
  which silently dropped a just-completed AOI polygon or a just-finished analysis's result
  points with nothing to retry the write (the results effect's fallback,
  `map.once("load", apply)`, was worse than a no-op - `"load"` only ever fires once, at
  mount, so that listener would simply never fire again). This produced a completely
  blank map after drawing an AOI or running an analysis, with **no console error** and
  correct data everywhere else (the sidebar stats, the saved project, the DB row all had
  the real numbers) - it looked like a data problem until `app.evaluate` + reading
  `map.getSource(id)._data` directly (undocumented but accessible) showed the source was
  really just empty. Found by comparing `map.getSource(id)._data` immediately after the
  draw gesture against the same read a moment later. Fixed by dropping the
  `isStyleLoaded()` gate entirely - `getSource(id)` existing is the check that actually
  matters (only false in the brief window before the map's own `"load"` handler runs), and
  `GeoJSONSource.setData()` is safe to call any time after that regardless of the broader
  style-loaded state. If a future change reintroduces an `isStyleLoaded()` check anywhere
  in a `setData`-driven effect, treat it as very likely to reproduce this exact bug.

## Troubleshooting

- **Launch throws `Cannot read properties of undefined (reading 'whenReady')`:**
  `ELECTRON_RUN_AS_NODE` is still set in the launch `env` - see Gotchas above.
- **`electron.exe` missing / only `LICENSES.chromium.html` in `dist/`:** the postinstall
  extraction failed - see the manual-extraction Gotcha above.
- **Map renders blank white:** check the CSP host match in `index.html` before anything
  else.
- **`smoke.mjs`/`driver.mjs` can't reach the orchestrator (blank sidebar, settings never
  load):** the orchestrator isn't running on 8756, or Vite isn't running on 5173 - both
  must be started before launching Electron (see Run steps 1-2).
- **Sidebar shows correct stats/project but the map itself stays blank after drawing an
  AOI or running an analysis:** see the `isStyleLoaded()` Gotcha above - check
  `src/map/MapView.tsx`'s effects don't have that guard reintroduced.
