"use client";

import { useEffect, useState } from "react";
import { TEMPLATES } from "@/lib/templates";

const API_KEY_STORAGE_KEY = "homie-presentation:api-key";

export default function HomePage() {
  const [apiKey, setApiKey] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [designIntent, setDesignIntent] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // The API key never touches this app's server except as a per-request forwarded header
  // (see app/api/generate/route.ts) - persisting it here, client-side only, is the same
  // trust boundary Homie GIS's Settings tab already uses.
  useEffect(() => {
    const stored = window.localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    if (apiKey) window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }, [apiKey]);

  async function handleGenerate() {
    setError(null);
    setStatus("Reading your source material and drafting an outline...");
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, sourceText, designIntent, deckTitle }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${response.status}`);
      }

      setStatus("Rendering your deck...");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? "deck.pptx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(`Downloaded ${fileName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = !!apiKey.trim() && !!sourceText.trim() && !generating;

  return (
    <div className="shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Homie Presentation
      </div>

      <div>
        <h1>Start from a template, or draft one with AI</h1>
        <p className="subtitle">
          Every template downloads instantly as a real, editable .pptx - no API key or
          credits needed. Or paste your own material below and let AI draft one from it.
        </p>
      </div>

      <div className="field">
        <label>Templates</label>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <a key={t.id} className="template-card" href={`/api/template?id=${t.id}`}>
              <span className={`template-kind template-kind-${t.kind}`}>
                {t.kind === "deck" ? "Deck" : "Flyer"}
              </span>
              <p className="template-name">{t.name}</p>
              <p className="template-description">{t.description}</p>
              <span className="template-download">Download →</span>
            </a>
          ))}
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 20 }}>Or generate one from your own material</h1>
        <p className="subtitle">
          Paste source material and a design intent - Homie Presentation drafts a
          grounded outline and renders it as a real, downloadable .pptx.
        </p>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="apiKey">Homie API key</label>
          <input
            id="apiKey"
            type="password"
            placeholder="ak_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="hint">
            The same key used by Homie GIS - issue one from your Homie dashboard&apos;s
            Applications page.
          </p>
        </div>

        <div className="field">
          <label htmlFor="deckTitle">Deck title</label>
          <input
            id="deckTitle"
            placeholder="Q3 operations review"
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="designIntent">Design intent (optional)</label>
          <input
            id="designIntent"
            placeholder="Formal, for a board of directors"
            value={designIntent}
            onChange={(e) => setDesignIntent(e.target.value)}
          />
          <p className="hint">Tone and audience - not colors or fonts yet in this early version.</p>
        </div>

        <div className="field">
          <label htmlFor="sourceText">Source material</label>
          <textarea
            id="sourceText"
            placeholder="Paste a report, notes, or any text the deck should be grounded in..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
          <p className="hint">
            Every slide is drafted only from what you paste here - nothing is invented.
          </p>
        </div>

        {error && <p className="error">{error}</p>}
        {status && !error && <p className="status">{status}</p>}

        <button onClick={handleGenerate} disabled={!canGenerate}>
          {generating ? "Generating..." : "Generate deck"}
        </button>
      </div>
    </div>
  );
}
