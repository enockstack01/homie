import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

// Encrypts the Homie API key at rest via Electron's safeStorage, which is backed by the
// OS's own credential facility (DPAPI on Windows, Keychain on macOS, libsecret on Linux) -
// this replaces the orchestrator's earlier plaintext-JSON storage (see
// xcrop/orchestrator/app/config.py's module docstring for the full rationale). The
// orchestrator itself never writes the key to disk at all now; this file - encrypted, and
// living in Electron's own userData directory rather than the orchestrator's - is the only
// at-rest copy.
const CREDENTIAL_PATH = path.join(app.getPath("userData"), "homie-api-key.enc");

export function getStoredApiKey(): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  if (!fs.existsSync(CREDENTIAL_PATH)) return null;
  try {
    const encrypted = fs.readFileSync(CREDENTIAL_PATH);
    return safeStorage.decryptString(encrypted);
  } catch {
    // Corrupt file, or encrypted under a since-rotated OS key (e.g. a different Windows
    // user profile) - treat as "no key stored" rather than crashing startup over it.
    return null;
  }
}

export function setStoredApiKey(apiKey: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  fs.mkdirSync(path.dirname(CREDENTIAL_PATH), { recursive: true });
  fs.writeFileSync(CREDENTIAL_PATH, safeStorage.encryptString(apiKey));
  return true;
}

export function clearStoredApiKey(): void {
  if (fs.existsSync(CREDENTIAL_PATH)) fs.unlinkSync(CREDENTIAL_PATH);
}
