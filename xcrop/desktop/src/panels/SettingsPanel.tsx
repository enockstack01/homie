import { useState } from "react";
import { api } from "../lib/api";

interface Props {
  hasApiKey: boolean;
  onSaved: () => void;
}

export function SettingsPanel({ hasApiKey, onSaved }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const trimmed = apiKey.trim();
      const result = await api.putSettings(trimmed);
      if (result.saved) {
        // Persist at rest only after the orchestrator has confirmed it's a real, working
        // key (see credentialStore.ts for the OS-backed encryption itself) - a rejected
        // key is never written to disk.
        await window.xcropSecure.setApiKey(trimmed);
        setStatus(`Connected as ${result.account?.email ?? "unknown"} - ${result.account?.credit_balance ?? "?"} credits`);
        setApiKey("");
        onSaved();
      } else {
        setStatus(`Failed: ${result.error}`);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <h2>Homie account</h2>
      <p className="hint">
        xcrop's AI explanations run through your Homie account's API key (Settings on the Homie dashboard, or the
        xGIS Add-in's own Settings panel issues the same key).
      </p>
      <p className="status-line">{hasApiKey ? "✓ API key configured" : "No API key configured yet"}</p>
      <input
        type="password"
        placeholder="ak_..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <button onClick={handleSave} disabled={saving || !apiKey.trim()}>
        {saving ? "Verifying..." : "Save API key"}
      </button>
      {status && <p className="status-line">{status}</p>}
    </section>
  );
}
