// Verifies the actual packaged app (release/win-unpacked/xcrop.exe or an installed copy)
// works standalone - app.isPackaged=true path: compiled orchestrator exe spawn (not the
// dev venv), built dist/index.html (not the Vite dev server), no NODE_ENV needed.
import { _electron as electron } from "playwright-core";
import * as fs from "node:fs";
import * as path from "node:path";

const APP_DIR = path.resolve(import.meta.dirname, "../../..");
const exePath = process.argv[2] || path.join(APP_DIR, "release", "win-unpacked", "xcrop.exe");
const SHOT_DIR = process.env.SCREENSHOT_DIR || "C:/Users/ENOCKNSHIMIYIMANA/AppData/Local/Temp/xcrop-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

async function main() {
  console.log("launching packaged app:", exePath);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath: exePath,
    args: [],
    env,
    timeout: 30_000,
  });

  await new Promise((r) => setTimeout(r, 5_000));
  const page = app.windows().find((w) => !w.url().startsWith("devtools://")) ?? (await app.firstWindow());
  await page.waitForLoadState("domcontentloaded");
  console.log("window url:", page.url());

  await page.screenshot({ path: path.join(SHOT_DIR, "packaged-01-landing.png") });

  const orchestratorHealth = await fetch("http://127.0.0.1:8756/health")
    .then((r) => r.json())
    .catch((e) => ({ error: String(e) }));
  console.log("orchestrator /health:", JSON.stringify(orchestratorHealth));

  // Full flow: draw AOI, save project, run analysis - same as smoke2.mjs but against the
  // packaged build specifically.
  await page.click('button:has-text("New project")');
  const mapBox = await page.locator(".map-container").boundingBox();
  const cx = mapBox.x + mapBox.width / 2;
  const cy = mapBox.y + mapBox.height / 2;
  const corners = [
    [cx - 60, cy - 60],
    [cx + 60, cy - 60],
    [cx + 60, cy + 60],
    [cx - 60, cy + 60],
  ];
  for (const [x, y] of corners) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
  }
  await page.mouse.dblclick(corners[0][0], corners[0][1]);
  await page.waitForTimeout(300);
  await page.fill('input[placeholder="Project name"]', "Packaged build test");
  await page.click('button:has-text("Save project")');
  await page.waitForTimeout(1000);

  await page.selectOption("select", "maize");
  await page.click('button:has-text("Run suitability analysis")');
  console.log("waiting for analysis (real network calls)...");
  await page.waitForSelector(".class-distribution", { timeout: 45_000 }).catch(() => {
    console.log("TIMEOUT waiting for results");
  });
  await page.waitForTimeout(500);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("--- body text ---");
  console.log(bodyText);
  console.log("--- end ---");

  await page.screenshot({ path: path.join(SHOT_DIR, "packaged-02-results.png") });
  console.log("screenshots written to", SHOT_DIR);

  await app.close();
  console.log("done.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
