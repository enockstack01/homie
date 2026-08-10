import { app, BrowserWindow, ipcMain, shell } from "electron";
import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { clearStoredApiKey, getStoredApiKey, setStoredApiKey } from "./credentialStore";

// The orchestrator is a local-only sidecar (see xcrop/orchestrator/app/main.py's CORS
// comment) - Electron's main process owns its lifecycle so it starts/stops with the app
// window instead of needing to be run separately by the user.
const ORCHESTRATOR_PORT = 8756;
const ORCHESTRATOR_DIR = path.join(__dirname, "..", "..", "orchestrator");

// The web page that completes Clerk sign-in and hands a Homie API key back to this app
// (see admin-dashboard/app/desktop-signin/) - overridable for pointing at a local dev
// server instead of the deployed one.
const SIGNIN_URL = process.env.XCROP_SIGNIN_URL || "https://homie-frontend-pphb.onrender.com/desktop-signin";
const PROTOCOL = "xcrop";

let orchestratorProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

const ORCHESTRATOR_EXE_NAME = process.platform === "win32" ? "xcrop-orchestrator.exe" : "xcrop-orchestrator";

interface OrchestratorCommand {
  command: string;
  args: string[];
  cwd: string;
}

// app.isPackaged (not NODE_ENV) is the signal here - it's Electron's own reliable way to
// tell "running from an electron-builder install" from "running unpacked from this repo",
// which is exactly the question that matters: does a Python venv exist to run the
// orchestrator from source, or must we use the self-contained binary (see
// orchestrator/build.ps1) bundled as an extraResource for end users who have no Python
// installed at all.
function resolveOrchestratorCommand(): OrchestratorCommand {
  const commonArgs = ["--port", String(ORCHESTRATOR_PORT), "--host", "127.0.0.1"];

  if (app.isPackaged) {
    const packagedExe = path.join(process.resourcesPath, ORCHESTRATOR_EXE_NAME);
    return { command: packagedExe, args: commonArgs, cwd: path.dirname(packagedExe) };
  }

  const venvPython =
    process.platform === "win32"
      ? path.join(ORCHESTRATOR_DIR, ".venv", "Scripts", "python.exe")
      : path.join(ORCHESTRATOR_DIR, ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) {
    return { command: venvPython, args: ["-m", "uvicorn", "app.main:app", ...commonArgs], cwd: ORCHESTRATOR_DIR };
  }
  // Falls back to whatever "python" resolves to on PATH - only hit if the orchestrator's
  // own .venv (see xcrop/orchestrator/README.md setup step) hasn't been created yet.
  const systemPython = process.platform === "win32" ? "python" : "python3";
  return { command: systemPython, args: ["-m", "uvicorn", "app.main:app", ...commonArgs], cwd: ORCHESTRATOR_DIR };
}

function startOrchestrator(): void {
  const { command, args, cwd } = resolveOrchestratorCommand();
  // windowsHide matters specifically for a real installed app: Electron itself has no
  // console when launched by double-clicking from Explorer (no terminal to inherit), so
  // without this, spawning a console-subsystem child (python.exe, or the compiled
  // xcrop-orchestrator.exe) pops a separate visible black terminal window behind the app.
  //
  // OPENBLAS_NUM_THREADS/OMP_NUM_THREADS=1: numpy (a shapely dependency) links OpenBLAS,
  // which allocates per-thread scratch buffers sized for the CPU's full core count by
  // default - on a machine already low on free memory this throws "OpenBLAS error:
  // Memory allocation still failed after 10 retries", crashing the orchestrator on
  // startup before it ever binds its port. Single-threaded BLAS has no measurable cost
  // here (shapely's per-request geometry ops on an AOI polygon are tiny), so there's no
  // real tradeoff - just a startup-crash class this rules out entirely, on this
  // developer's machine and on any similarly memory-constrained end-user machine.
  const env = { ...process.env, OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" };
  orchestratorProcess = spawn(command, args, { cwd, env, stdio: "inherit", windowsHide: true });
  orchestratorProcess.on("exit", (code) => {
    console.log(`orchestrator exited with code ${code}`);
  });
  orchestratorProcess.on("error", (err) => {
    console.error("failed to spawn orchestrator:", err);
  });
}

async function waitForOrchestrator(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${ORCHESTRATOR_PORT}/health`);
      if (res.ok) return;
    } catch {
      // Not up yet - keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Orchestrator did not become healthy in time");
}

// The orchestrator keeps the API key in memory only (see orchestrator/app/config.py) - a
// fresh process spawn has forgotten it, so re-push the encrypted-at-rest copy every time
// one starts. Failure here just means the Settings panel shows "no key configured" and
// the user re-enters it - not fatal to app startup.
async function primeOrchestratorApiKey(): Promise<void> {
  const apiKey = getStoredApiKey();
  if (!apiKey) return;
  try {
    await fetch(`http://127.0.0.1:${ORCHESTRATOR_PORT}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homie_api_key: apiKey }),
    });
  } catch (err) {
    console.error("failed to prime orchestrator with stored API key:", err);
  }
}

function registerCredentialIpc(): void {
  ipcMain.handle("xcrop:getApiKey", () => getStoredApiKey());
  ipcMain.handle("xcrop:setApiKey", (_event, apiKey: string) => setStoredApiKey(apiKey));
  ipcMain.handle("xcrop:clearApiKey", () => clearStoredApiKey());
  ipcMain.handle("xcrop:openSignIn", () => shell.openExternal(SIGNIN_URL));
}

// Standard desktop-app OAuth-style handoff: shell.openExternal(SIGNIN_URL) opens the
// system browser to complete a real Clerk sign-in, and that page redirects back to
// xcrop://auth-callback?key=... to hand the account's Homie API key to this process (see
// admin-dashboard/app/desktop-signin/DesktopHandoff.tsx). Same pattern VS Code/GitHub
// Desktop/Slack use for browser-based sign-in - there is no supported way to embed
// Clerk's own hosted sign-in UI directly inside an Electron BrowserWindow and get a
// trustworthy session out of it.
function registerProtocolHandler(): void {
  if (process.defaultApp) {
    // Unpacked dev mode: argv[0] is the electron.exe itself, argv[1] is this script - the
    // OS needs the *electron.exe command line that re-launches this exact app* to know
    // what "opening xcrop://..." even means, since there's no dedicated xcrop.exe yet.
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

async function handleAuthCallbackUrl(url: string): Promise<void> {
  let apiKey: string | null;
  try {
    apiKey = new URL(url).searchParams.get("key");
  } catch {
    console.error("received malformed auth callback URL:", url);
    return;
  }
  if (!apiKey) return;

  setStoredApiKey(apiKey);
  try {
    await fetch(`http://127.0.0.1:${ORCHESTRATOR_PORT}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homie_api_key: apiKey }),
    });
  } catch (err) {
    console.error("failed to prime orchestrator after sign-in:", err);
  }

  mainWindow?.webContents.send("xcrop:signed-in");
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

function findProtocolUrl(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
}

// win.signAndEditExecutable is disabled in package.json's build config (see that file's
// comment) - rcedit, which would otherwise bake this into xcrop.exe's own file properties,
// needs a winCodeSign download that fails in this environment (no SeCreateSymbolicLinkPrivilege
// / not running elevated - see the extraction errors if that's ever revisited). Setting the
// icon here at the BrowserWindow level instead means the taskbar/title-bar icon is still
// correct at runtime; only the .exe's own static file icon (as seen in Explorer before
// launching it) is affected.
function resolveWindowIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "build", "icon.png");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: resolveWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Same app.isPackaged signal as resolveOrchestratorCommand - kept consistent so "dev"
  // and "packaged" mean the same thing everywhere in this file rather than mixing that
  // check with NODE_ENV (which a real installed app never has reason to set).
  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

registerProtocolHandler();

// Windows/Linux deliver a xcrop://... launch as a brand-new OS process - without a
// single-instance lock, that would open a second, orchestrator-spawning copy of xcrop
// instead of handing the callback to the one already running. The losing instance below
// (gotLock === false) has nothing further to do; the winning instance's "second-instance"
// listener receives the URL from it.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = findProtocolUrl(argv);
    if (url) void handleAuthCallbackUrl(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // macOS delivers a custom-protocol launch through this event instead of argv/second-instance.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void handleAuthCallbackUrl(url);
  });

  app.whenReady().then(async () => {
    registerCredentialIpc();
    startOrchestrator();
    try {
      await waitForOrchestrator();
      await primeOrchestratorApiKey();
    } catch (err) {
      console.error(err);
    }
    createWindow();

    // The very first launch of this instance can itself be a xcrop://... invocation
    // (rather than a *second* one caught by "second-instance" above) - e.g. the user had
    // no xcrop window open at all when they clicked "Open xcrop" on the sign-in page.
    const startupUrl = findProtocolUrl(process.argv);
    if (startupUrl) void handleAuthCallbackUrl(startupUrl);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    orchestratorProcess?.kill();
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    orchestratorProcess?.kill();
  });
}
