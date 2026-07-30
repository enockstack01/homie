# xGIS architecture

See `docs/SETUP.md` for install/build steps, and `../backend/README.md` for the gateway
service. This file is the map of how the pieces fit.

## Two phases, one repo

- **Phase 1** (this file's main subject): the ArcGIS Pro Add-in (`src/xGIS.AddIn`) - the
  tool-use agentic loop, geoprocessing tool wrappers, safety guardrails.
- **Phase 2**: the Add-in no longer calls Anthropic directly. A backend gateway
  (`backend/`, FastAPI) holds the only real Anthropic API key, authenticates callers via
  Clerk, and meters usage against a MongoDB-backed credit balance at a fixed margin. An
  admin dashboard (`admin-dashboard/`, Next.js) lets an admin grant credits and review
  usage. See `backend/README.md` and `backend/app/services/credit_engine.py` for that
  side; the rest of this file is about what changed in the Add-in to talk to it.

## Flow of one request

1. User types into `UI/ChatDockpane` → bound to `UI/ChatDockpaneViewModel.InputText`.
2. `SendCommand` calls `Agent/ClaudeAgentService.RunTurnAsync`.
3. `ClaudeAgentService` POSTs the conversation + `Agent/ToolDefinitions.All` to the
   backend gateway's `/v1/chat` (plain `HttpClient` + `System.Text.Json` - there is no
   Anthropic SDK on this side of the gateway at all anymore; see "Why no Anthropic SDK"
   below). The gateway forwards to Anthropic, meters credits, and returns Anthropic's own
   `Message` shape verbatim, so the response-parsing logic here is the same shape it would
   be calling Anthropic directly.
4. For every `tool_use` block in the response:
   - `Tools/ToolSafety.RequiresConfirmation` checks whether it looks destructive or
     writes outside the project's sandboxed workspaces (`Project.Current.HomeFolderPath`,
     `DefaultGeodatabasePath`, or an existing layer's workspace). If so, the user sees
     `UI/ConfirmationDialog` and can Allow or Deny.
   - `Agent/ToolDispatcher.Execute` runs the matching method in `Tools/*` inside
     `QueuedTask.Run` — every tool call, geoprocessing or mapping, goes through ArcGIS
     Pro's CIM/MCT thread the same way, one `QueuedTask.Run` per call.
   - The result (success + message, or the geoprocessing engine's own error text) is
     logged to `Logging/AuditLogger` and fed back to Claude as a `tool_result`.
5. Loop continues until Claude stops requesting tools or `MaxToolIterations` is hit.

## Where reliability actually comes from

Not from getting positional geoprocessing parameters right on the first try — from three
layers, cheapest first:

1. Curated, explicitly-typed tools (`buffer_layer`, `clip_layer`, ...) in
   `Tools/GeoprocessingTools.cs` own the parameter order into `MakeValueArray`, so Claude
   only supplies named values, never a raw positional array.
2. `run_geoprocessing_tool` is the generic escape hatch for anything not covered above —
   here Claude does supply positional args itself, in arcpy signature order.
3. Failures return the GP engine's real error message verbatim as `is_error: true`, and
   Claude is generally good at correcting parameter order from an arcpy-style error on
   the next iteration of the same turn.

## Settings

`UI/SettingsWindow` (opened via the "Settings" ribbon button) edits the single shared
`xGISModule.Current.Settings` instance: the **xGIS API key** (written straight to
`Config/CredentialStore`, never held in the JSON file below), backend URL, and the
destructive-op confirmation toggle. Model choice used to live here too, but now lives on
the account instead - it's chosen in the Homie dashboard, and the backend gateway derives
which model to bill/call from the signed-in account's own preference, never from anything
the Add-in sends (see `backend/app/routes/chat.py`'s `handle_chat_request`). URL/confirmation persist to
`%LOCALAPPDATA%\xGIS\settings.json`; `ChatDockpaneViewModel` builds a fresh
`ClaudeAgentService` on every turn (cheap - no network call in its constructor) so a
Settings change takes effect on the very next message instead of being baked into a
cached client from an earlier turn.

### Why no Anthropic SDK, and what the "xGIS API key" actually is

The Add-in used to hold the Anthropic C# SDK and the user's own Anthropic key directly.
Once the backend gateway became the only thing allowed to hold a real Anthropic key, the
SDK dependency (and the `AssemblyLoadContext` isolation hack it needed to coexist with
ArcGIS Pro's own `System.Text.Json` - see git history if curious) both became unnecessary
weight, so they were removed. The Add-in now just POSTs plain JSON.

The "xGIS API key" a user pastes into Settings is a **Clerk Machine secret key**
(`ak_...`), not an Anthropic key and not a per-user Clerk "API Key" - Clerk's API Keys
feature turned out to be plan-gated (403 `feature_not_enabled`) when this was built, while
Machines (meant for the same "one long-lived, non-interactive credential" purpose) was
available. A machine secret can't be sent directly as a bearer token to Clerk-protected
endpoints - it has to be exchanged for a short-lived (~1hr) M2M token first. Rather than
give the Add-in that token-refresh complexity, `backend/app/auth.py` does the exchange
server-side on every request: the Add-in always sends the same persistent secret, and gets
the simple "paste a key once" UX a real long-lived API key would have given it anyway.

## Known simplifications (first version, intentional)

- `ClaudeAgentService.BuildRequestMessages` only replays plain assistant/user text across
  *separate* chat turns — it does not carry prior turns' raw `tool_use`/`tool_result`
  blocks forward. Within a single turn's tool loop, full API-shape history is kept. If a
  later request needs a follow-up to recall a prior tool's exact raw output rather than
  its text summary, this is the place to change.
- `Tools/SymbologyTools.cs` only covers single-symbol solid-color renderers. Anything
  classified/graduated is out of scope for now — route it through `run_geoprocessing_tool`
  against a script tool instead of hand-building more CIM renderer shapes.
- No dry-run/simulation engine. Safety is the sandbox check + destructive-op confirmation
  + audit log + ArcGIS Pro's own Undo stack (confirm early that add-in-invoked
  `ExecuteToolAsync` calls register with `OperationManager` the same way the Geoprocessing
  pane's calls do — don't assume).
