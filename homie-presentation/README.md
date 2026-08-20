# Homie Presentation

A first, real vertical slice of the "AI presentation operating system" described in
`Homie_Presentation_Spec.pdf` - not the full multi-stage pipeline, job queue, design
canvas, or desktop app the full spec describes. This README says plainly what's real and
what's a placeholder.

## What actually works right now

- **A real Next.js web app**, calling the same `/v1/chat` gateway on `backend/` that
  Homie GIS uses - never Anthropic directly (see `lib/homieClient.ts`), metered against
  the account's own credit balance like every other Homie surface.
- **A single AI call drafts a grounded outline**: paste source text and an optional
  design intent, and the model returns 3-6 slides (title + bullets), instructed not to
  invent facts outside the pasted material (`lib/outline.ts`).
- **A real, deterministic `.pptx` renderer** (`lib/renderDeck.ts`, via `pptxgenjs`) turns
  that structured outline into an actual downloadable PowerPoint file - no AI call in this
  step, matching the spec's core "AI proposes structure and content; deterministic code
  renders layout" principle (Section 1).
- **Auth via a pasted Homie API key**, stored in the browser only (`localStorage`) and
  forwarded per-request - the same trust boundary Homie GIS's Settings tab already uses,
  not a new pattern.

## What's a deliberate stand-in, not the real thing yet

| Spec's plan | What's here instead | Why |
|---|---|---|
| Stage 1: real multi-file ingestion (PDF/DOCX/XLSX/images) with per-block provenance | A single pasted-text box, no provenance tracking | Proves the outline->render path without a parser stack (and its disk footprint) before it's needed |
| Stage 2: design-system extraction from a template/description/images | One fixed, hardcoded Homie-brand color scheme in `renderDeck.ts` | No template upload or design-token pipeline yet |
| Stage 3/4 split, with outline shown for approval before drafting | Combined into a single model call, no approval step | No job queue/WebSocket progress infra yet - see the spec's Section 4.3 |
| Stage 6/7: automated visual QA + fact-check pass | Not built | No headless-render/LibreOffice step yet |
| Stage 8: scoped per-slide editing after generation | Not built - regenerate the whole deck | No structured-deck database/content-graph yet (Section 8) |
| Clerk-backed web sessions, matching admin-dashboard | Pasted API key only | Keeps this app's dependency tree (and disk footprint) minimal for the first slice |
| Native desktop app (Tauri per the spec, or Electron) | Not built | Web-first, per product decision - desktop app is the next phase |

## Running it

```
cd homie-presentation
npm install
npm run dev
```

Needs a Homie API key with an active account, credit balance, and a model already
selected (via `admin-dashboard`'s Member page) - `/v1/chat` rejects requests missing any
of those with a clear error, surfaced as-is in this app's UI.

Override the backend it talks to with `HOMIE_API_BASE` (defaults to the real deployed
`https://homie-platform.onrender.com`).

## Suggested next steps, in order

1. Split outline (Stage 3) and drafting (Stage 4) back into two calls with an
   approval step in between - the spec's own "critical UX decision" (Section 5).
2. Real file ingestion (start with PDF) instead of a paste-only text box.
3. A structured deck record (Postgres or even SQLite, local-first) so a generated deck
   can be re-opened and scoped-edited instead of only ever downloaded once.
4. Desktop shell once there's headroom for a second toolchain - Electron rather than the
   spec's Tauri pick, unless there's a specific reason to introduce Rust tooling here.
