// Extended one-shot smoke test: covers the safeStorage-backed credential flow and a full
// draw-AOI -> save-project -> run-analysis path, on top of what smoke.mjs already checks.
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

  const safeStorageInfo = await app.evaluate(({ safeStorage }) => ({
    available: safeStorage.isEncryptionAvailable(),
  }));
  console.log("safeStorage.isEncryptionAvailable():", safeStorageInfo.available);

  await new Promise((r) => setTimeout(r, 4_000));
  const page = app.windows().find((w) => !w.url().startsWith("devtools://")) ?? (await app.firstWindow());
  await page.waitForLoadState("domcontentloaded");

  // --- settings: reject path (no backend / bad key) ---
  await page.fill('input[type="password"]', "ak_fake_test_key_not_real");
  await page.click('button:has-text("Save API key")');
  await page.waitForTimeout(2000);
  const settingsStatus = await page.evaluate(() => {
    const lines = [...document.querySelectorAll(".status-line")].map((el) => el.textContent);
    return lines;
  });
  console.log("settings status lines:", settingsStatus);

  // --- draw AOI: a small rectangle over Musanze, Rwanda ---
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

  const shot1 = path.join(SHOT_DIR, "smoke2-01-drawn-aoi.png");
  await page.screenshot({ path: shot1 });
  console.log("screenshot:", shot1);

  await page.fill('input[placeholder="Project name"]', "Musanze smoke-test plot");
  await page.click('button:has-text("Save project")');
  await page.waitForTimeout(1000);

  const projectListed = await page.evaluate(() =>
    [...document.querySelectorAll(".list-item")].map((el) => el.textContent)
  );
  console.log("projects after save:", projectListed);

  // --- select crop + run analysis (real Open-Meteo calls) ---
  await page.selectOption("select", "avocado");
  await page.click('button:has-text("Run suitability analysis")');
  console.log("waiting for analysis to complete (real network calls, can take ~15-20s)...");
  await page.waitForSelector(".class-distribution", { timeout: 45_000 }).catch(() => {
    console.log("TIMEOUT waiting for results panel");
  });
  await page.waitForTimeout(500);

  const resultsText = await page.evaluate(() => document.body.innerText);
  console.log("--- body text after analyze ---");
  console.log(resultsText);
  console.log("--- end ---");

  const shot2 = path.join(SHOT_DIR, "smoke2-02-results.png");
  await page.screenshot({ path: shot2 });
  console.log("screenshot:", shot2);

  await app.close();
  console.log("done.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
