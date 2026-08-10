// REPL driver for the xcrop Electron desktop app.
// Windows, headless-terminal friendly (no xvfb needed) - but the sandbox this was built
// in sets ELECTRON_RUN_AS_NODE=1 globally, which makes Electron behave as plain Node
// (require('electron') returns a path string, not {app, BrowserWindow}) - must be
// launched with that unset, see launch() below.
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
import { _electron as electron } from "playwright-core";
import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";

const APP_DIR = path.resolve(import.meta.dirname, "../../..");
const SHOT_DIR = process.env.SCREENSHOT_DIR || "C:/Users/ENOCKNSHIMIYIMANA/AppData/Local/Temp/xcrop-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

let app = null;
let page = null;

const electronBin = path.join(APP_DIR, "node_modules/electron/dist/electron.exe");

const COMMANDS = {
  async launch() {
    if (app) return console.log("already launched");
    const env = { ...process.env, NODE_ENV: "development" };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      executablePath: electronBin,
      args: [path.join(APP_DIR, "dist-electron/main.js")],
      cwd: APP_DIR,
      env,
      timeout: 30_000,
    });
    // Electron main.ts polls the orchestrator's /health for up to 15s before creating the
    // window, then loads Vite - give it real time rather than guessing.
    await new Promise((r) => setTimeout(r, 6_000));
    page = app.windows().find((w) => !w.url().startsWith("devtools://")) ?? (await app.firstWindow());
    console.log("launched.", app.windows().length, "windows:");
    for (const w of app.windows()) console.log(" ", w.url());
  },

  async ss(name) {
    if (!page) return console.log("ERROR: launch first");
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + ".png");
    await page.screenshot({ path: f });
    console.log("screenshot:", f);
  },

  async click(sel) {
    if (!page) return console.log("ERROR: launch first");
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return "NOT_FOUND";
      el.click();
      return "OK";
    }, sel);
    console.log("click", sel, "\u2192", r);
  },

  async "click-text"(text) {
    if (!page) return console.log("ERROR: launch first");
    const r = await page.evaluate((t) => {
      const els = [...document.querySelectorAll("button, a, [role=\"button\"]")];
      const el = els.find((e) => e.textContent?.trim() === t) ?? els.find((e) => e.textContent?.includes(t));
      if (!el) return "NOT_FOUND";
      el.click();
      return "OK: " + el.tagName;
    }, text);
    console.log("click-text", JSON.stringify(text), "\u2192", r);
  },

  async type(text) {
    if (page) await page.keyboard.type(text, { delay: 30 });
  },
  async press(key) {
    if (page) await page.keyboard.press(key);
  },

  async wait(sel) {
    if (!page) return console.log("ERROR: launch first");
    try {
      await page.waitForSelector(sel, { timeout: 10_000 });
      console.log("found:", sel);
    } catch {
      console.log("TIMEOUT:", sel);
    }
  },

  async eval(expr) {
    if (!page) return console.log("ERROR: launch first");
    try {
      console.log(JSON.stringify(await page.evaluate(expr)));
    } catch (e) {
      console.log("ERROR:", e.message);
    }
  },

  async text(sel) {
    if (!page) return console.log("ERROR: launch first");
    console.log(
      await page.evaluate((s) => (s ? document.querySelector(s) : document.body)?.innerText ?? "(null)", sel || null)
    );
  },

  async windows() {
    if (!app) return console.log("ERROR: launch first");
    for (const w of app.windows()) console.log(" ", w.url());
  },

  async quit() {
    if (app) await app.close().catch(() => {});
    app = null;
    page = null;
  },
  help() {
    console.log("commands:", Object.keys(COMMANDS).join(", "));
  },
};

// The /dev/stdin fd trick from the Linux skill skeleton doesn't apply here: this driver
// runs as its own separate Node process (not embedded in Electron via `electron .`), so
// there's no risk of Electron stealing this process's stdin - plain process.stdin is fine.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "driver> " });

// readline fires "line" for every buffered line as soon as it arrives when stdin is
// piped (not a TTY) - it does NOT wait for an async listener to finish before firing the
// next one, unlike a human typing interactively one line at a time. Without this queue,
// piping several commands via a heredoc runs them all concurrently (e.g. "quit" calling
// process.exit(0) while "launch" is still 6 seconds into starting Electron) instead of
// in order - queuing here makes piped and interactive use behave the same way.
let chain = Promise.resolve();

rl.on("line", (line) => {
  chain = chain.then(() => runLine(line));
});

// Piped (non-TTY) stdin auto-closes readline as soon as it hits EOF - which, for a
// heredoc, is almost immediately, well before the (queued, still-running) commands have
// executed. rl.prompt() throws ERR_USE_AFTER_CLOSE once that's happened, and an uncaught
// throw here would poison the `chain` promise and skip every command queued after it -
// promptSafely swallows exactly that one error so the rest of the chain still runs.
function promptSafely() {
  try {
    rl.prompt();
  } catch (e) {
    if (e.code !== "ERR_USE_AFTER_CLOSE") throw e;
  }
}

async function runLine(line) {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return promptSafely();
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.log("unknown:", cmd, "\u2014 try: help");
    return promptSafely();
  }
  try {
    await fn(rest.join(" "));
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  if (cmd === "quit") {
    rl.close();
    process.exit(0);
  }
  promptSafely();
}
rl.on("close", async () => {
  // For piped (non-TTY) stdin, this fires almost immediately on EOF - well before the
  // queued chain has run - so wait for it before exiting, or the process ends before
  // "launch" (or anything after it) ever gets to run.
  await chain.catch(() => {});
  await COMMANDS.quit();
  process.exit(0);
});

console.log("xcrop driver \u2014 \"help\" for commands, \"launch\" to start");
rl.prompt();
