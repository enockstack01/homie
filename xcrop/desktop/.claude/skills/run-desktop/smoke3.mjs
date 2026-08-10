// Extended smoke test covering the new features: basemap switching, terrain-painted
// visualization (real /analyze at GRID_SIZE=12), the parameters panel (weight + crop
// editing), and the chat panel (open + a message, even without a valid API key - error
// path still proves the UI wiring).
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

  // --- basemap switcher ---
  await page.click('button[title="Satellite"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT_DIR, "smoke3-01-satellite-basemap.png") });
  console.log("basemap switched to satellite, screenshot taken");
  await page.click('button[title="Street"]');
  await page.waitForTimeout(1000);

  // --- parameters panel: edit weights, add a crop ---
  await page.click('button:has-text("Parameters")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, "smoke3-02-parameters-open.png") });

  await page.click('button:has-text("+ New crop")');
  await page.fill('input[placeholder="e.g. rice"]', "banana");
  const nameInputs = page.locator(".crop-editor input").nth(1);
  await nameInputs.fill("Banana");
  await page.click('button:has-text("Create crop")');
  await page.waitForTimeout(800);
  const cropStatus = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".params-panel .status-line")];
    return els.map((e) => e.textContent);
  });
  console.log("crop editor status:", cropStatus);

  // --- draw AOI, save project, run analysis at the new denser grid ---
  await page.click('button:has-text("New project")');
  const mapBox = await page.locator(".map-container").boundingBox();
  const cx = mapBox.x + mapBox.width / 2;
  const cy = mapBox.y + mapBox.height / 2;
  const corners = [
    [cx - 70, cy - 70],
    [cx + 70, cy - 70],
    [cx + 70, cy + 70],
    [cx - 70, cy + 70],
  ];
  for (const [x, y] of corners) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
  }
  await page.mouse.dblclick(corners[0][0], corners[0][1]);
  await page.waitForTimeout(300);
  await page.fill('input[placeholder="Project name"]', "Smoke3 terrain test");
  await page.click('button:has-text("Save project")');
  await page.waitForTimeout(800);

  await page.selectOption("select >> nth=1", "avocado").catch(async () => {
    // Fall back to matching by the crop dropdown specifically if selector index shifts.
    const selects = await page.locator("select").all();
    for (const s of selects) {
      const opts = await s.locator("option").allTextContents();
      if (opts.includes("Avocado")) {
        await s.selectOption("avocado");
        break;
      }
    }
  });
  await page.click('button:has-text("Run suitability analysis")');
  console.log("waiting for analysis (real network calls)...");
  await page.waitForSelector(".class-distribution", { timeout: 60_000 }).catch(() => console.log("TIMEOUT on results"));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOT_DIR, "smoke3-03-terrain-painted-results.png") });
  console.log("terrain visualization screenshot taken");

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("--- results summary snippet ---");
  console.log(bodyText.split("RESULTS")[1]?.slice(0, 300));

  // --- chat: quick action "Explain this analysis" ---
  await page.click('button:has-text("Explain this analysis")');
  await page.waitForTimeout(2000);
  const chatText = await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll(".chat-bubble")];
    return bubbles.map((b) => b.textContent);
  });
  console.log("chat bubbles after quick action:", chatText);
  await page.screenshot({ path: path.join(SHOT_DIR, "smoke3-04-chat.png") });

  await app.close();
  console.log("done.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
