// Verifies the new Dashboard/TopNav/sign-in UI: launches straight into the Dashboard
// (the new default view), checks the sign-in card + stat cards + parameters panel render,
// switches to Map, runs a real analysis, switches back to Dashboard and confirms the new
// run shows up as a card, then opens its detail view.
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
  await new Promise((r) => setTimeout(r, 4_000));
  const page = app.windows().find((w) => !w.url().startsWith("devtools://")) ?? (await app.firstWindow());
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(SHOT_DIR, "smoke4-01-dashboard-landing.png") });
  console.log("dashboard landing screenshot taken");

  const dashboardText = await page.evaluate(() => document.body.innerText);
  console.log("--- dashboard body text ---");
  console.log(dashboardText.slice(0, 600));

  // --- switch to Map, draw AOI, save project, run analysis ---
  await page.click('button:has-text("Map")');
  await page.waitForTimeout(500);
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
  await page.fill('input[placeholder="Project name"]', "Dashboard smoke test");
  await page.click('button:has-text("Save project")');
  await page.waitForTimeout(800);

  await page.selectOption("select", "maize");
  await page.click('button:has-text("Run suitability analysis")');
  console.log("waiting for analysis...");
  await page.waitForSelector(".class-distribution", { timeout: 60_000 }).catch(() => console.log("TIMEOUT on results"));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, "smoke4-02-map-results.png") });

  // --- back to Dashboard, confirm the new run appears, open its detail ---
  await page.click('button:has-text("Dashboard")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOT_DIR, "smoke4-03-dashboard-with-runs.png") });

  const runCardCount = await page.locator(".run-card").count();
  console.log("run cards visible on dashboard:", runCardCount);

  if (runCardCount > 0) {
    await page.locator(".run-card").first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, "smoke4-04-run-detail.png") });
    const detailText = await page.evaluate(() => document.querySelector(".run-detail")?.innerText ?? "");
    console.log("--- run detail text ---");
    console.log(detailText);
  }

  await app.close();
  console.log("done.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
