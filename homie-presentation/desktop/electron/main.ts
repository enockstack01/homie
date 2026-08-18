import { app, BrowserWindow } from "electron";
import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";

// The desktop shell doesn't reimplement Homie Presentation's UI - it spawns the same
// Next.js app the web portal serves (../ from this file's compiled location) and displays
// it in a native window. This is the spec's "one pipeline, two clients" architecture
// (Section 4.1: Web Portal and Desktop App as thin clients over the same backend) applied
// literally: nothing in this file is product logic, only process lifecycle + a window.
const APP_PORT = 4173;
const APP_DIR = path.join(__dirname, "..", "..");

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function startNextServer(): void {
  // Dev mode runs the app's own dev server, the only path actually exercised so far. A
  // packaged build would run "start" against a pre-built .next instead - that branch is
  // here so this file is ready for an electron-builder pass later (bundling the built
  // homie-presentation/ tree as an extraResource, same pattern as
  // xcrop/desktop/electron/main.ts's orchestrator), but no installer config exists yet,
  // so app.isPackaged is always false in practice today.
  const script = app.isPackaged ? "start" : "dev";
  // Not node_modules/.bin/next(.cmd) - spawn() can't exec a .cmd shim directly on Windows
  // without shell:true (fails with EINVAL), and shell:true opens its own quoting/escaping
  // problems. Spawning Electron's own binary as plain Node instead (ELECTRON_RUN_AS_NODE
  // in the child's env only, not this process's) against next's actual JS entry point
  // sidesteps both - a real .exe, no shell involved, same shape as `node script.js`.
  const nextEntry = path.join(APP_DIR, "node_modules", "next", "dist", "bin", "next");
  serverProcess = spawn(process.execPath, [nextEntry, script, "--port", String(APP_PORT)], {
    cwd: APP_DIR,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  serverProcess.on("exit", (code) => console.log(`Next.js server exited with code ${code}`));
  serverProcess.on("error", (err) => console.error("failed to spawn Next.js server:", err));
}

async function waitForServer(timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${APP_PORT}`);
      if (res.ok) return;
    } catch {
      // Not up yet - keep polling until timeout, matching xcrop/desktop/electron/main.ts's
      // waitForOrchestrator.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Homie Presentation's Next.js server did not become healthy in time");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}`);
  if (!app.isPackaged) mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  startNextServer();
  try {
    await waitForServer();
  } catch (err) {
    console.error(err);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  serverProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  serverProcess?.kill();
});
