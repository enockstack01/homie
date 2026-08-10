// Verifies the browser -> xcrop:// protocol handoff end-to-end without a real Clerk
// session: launches the app (primary instance), then spawns a second electron.exe process
// with a synthetic "xcrop://auth-callback?key=..." argv - exactly what Windows does when a
// user clicks/auto-navigates a xcrop:// link in their browser after admin-dashboard's
// desktop-signin page renders. The second process should lose the single-instance-lock
// race and hand its argv to the first via Electron's "second-instance" event (see
// electron/main.ts), which should then store the key, prime the orchestrator, focus the
// window, and notify the renderer - all observable from the primary instance's window.
import { _electron as electron } from "playwright-core";
import { spawn } from "node:child_process";
import path from "node:path";

const APP_DIR = path.resolve(import.meta.dirname, "../../..");
const electronBin = path.join(APP_DIR, "node_modules/electron/dist/electron.exe");
const mainJs = path.join(APP_DIR, "dist-electron/main.js");
const FAKE_KEY = "ak_smoketest_" + Date.now();

async function main() {
  const env = { ...process.env, NODE_ENV: "development" };
  delete env.ELECTRON_RUN_AS_NODE;

  console.log("launching primary instance...");
  const app = await electron.launch({
    executablePath: electronBin,
    args: [mainJs],
    cwd: APP_DIR,
    env,
    timeout: 30_000,
  });
  const proc = app.process();
  proc.stdout?.on("data", (d) => console.log("[main stdout]", d.toString().trim()));
  proc.stderr?.on("data", (d) => console.log("[main stderr]", d.toString().trim()));

  await new Promise((r) => setTimeout(r, 4_000));
  const page = app.windows().find((w) => !w.url().startsWith("devtools://")) ?? (await app.firstWindow());
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const settingsBefore = await page.evaluate(() => window.xcropSecure.getApiKey());
  console.log("api key before handoff:", settingsBefore);

  console.log("spawning second process with xcrop://auth-callback argv (simulating browser handoff)...");
  const callbackUrl = `xcrop://auth-callback?key=${encodeURIComponent(FAKE_KEY)}`;
  const second = spawn(electronBin, [mainJs, callbackUrl], { cwd: APP_DIR, env, stdio: "ignore" });
  await new Promise((resolve) => second.on("exit", resolve));
  console.log("second process exited (expected - it should lose the single-instance lock)");

  await new Promise((r) => setTimeout(r, 1500));

  const storedKey = await page.evaluate(() => window.xcropSecure.getApiKey());
  console.log("api key after handoff (via safeStorage):", storedKey);
  console.log("MATCH:", storedKey === FAKE_KEY);

  const settingsState = await page.evaluate(async () => {
    const res = await fetch("http://127.0.0.1:8756/settings");
    return res.json();
  });
  console.log("orchestrator /settings has_api_key:", settingsState.has_api_key);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("--- dashboard body text after handoff ---");
  console.log(bodyText.slice(0, 400));

  // Restore whatever key (or absence of one) was there before this test, so the smoke
  // test doesn't clobber a real developer's already-configured key.
  if (settingsBefore) {
    await page.evaluate((k) => window.xcropSecure.setApiKey(k), settingsBefore);
    console.log("restored original stored key");
  } else {
    await page.evaluate(() => window.xcropSecure.clearApiKey());
    console.log("cleared test key (none was stored before)");
  }

  await app.close();
  console.log("done.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
