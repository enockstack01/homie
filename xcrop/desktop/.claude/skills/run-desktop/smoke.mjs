// One-shot smoke test: launch xcrop's Electron app, screenshot it, poke the UI, quit.
// Same launch mechanics as driver.mjs (see that file for why ELECTRON_RUN_AS_NODE must
// be unset) but a plain top-to-bottom script instead of a REPL - simpler to run
// non-interactively than fighting readline's piped-stdin semantics.
import { _electron as electron } from "playwright-core";
import * as fs from "node:fs";
import * as path from "node:path";

const APP_DIR = path.resolve(import.meta.dirname, "../../..");
const SHOT_DIR = process.env.SCREENSHOT_DIR || "C:/Users/ENOCKNSHIMIYIMANA/AppData/Local/Temp/xcrop-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, "node_modules/electron/dist/electron.exe");

async function main() {
  const env = { ...process.env, NODE_ENV: "development" };
  delete env.ELECTRON_RUN_AS_NODE;

  console.log("launching...");
  const app = await electron.launch({
    executablePath: electronBin,
    args: [path.join(APP_DIR, "dist-electron/main.js")],
    cwd: APP_DIR,
    env,
    timeout: 30_000,
  });

  console.log("waiting for renderer...");
  await new Promise((r) => setTimeout(r, 4_000));

  console.log(
    "windows:",
    app.windows().map((w) => w.url())
  );
  const page = app.windows().find((w) => !w.url().startsWith("devtools://")) ?? (await app.firstWindow());
  await page.waitForLoadState("domcontentloaded");

  const shot1 = path.join(SHOT_DIR, "01-landing.png");
  await page.screenshot({ path: shot1 });
  console.log("screenshot:", shot1);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("--- body text ---");
  console.log(bodyText);
  console.log("--- end body text ---");

  const clickResult = await page.evaluate(() => {
    const els = [...document.querySelectorAll("button")];
    const el = els.find((e) => e.textContent?.includes("New project"));
    if (!el) return "NOT_FOUND";
    el.click();
    return "OK";
  });
  console.log("click 'New project':", clickResult);

  await new Promise((r) => setTimeout(r, 500));
  const shot2 = path.join(SHOT_DIR, "02-drawing-mode.png");
  await page.screenshot({ path: shot2 });
  console.log("screenshot:", shot2);

  await app.close();
  console.log("done.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
