# Unfinished / known gaps

Last updated 2026-07-28. Most of the original list (recorded the same day) is now fixed -
see each item below for what changed. One item (streaming) remains open by deliberate
choice, not oversight.

## 1. Intentional simplifications already called out in `docs/ARCHITECTURE.md`

Unchanged - these are documented, not hidden, and repeating them here keeps one place to
check:

- **Cross-turn tool history isn't replayed.** `ClaudeAgentService.BuildRequestMessages`
  only carries plain assistant/user text across *separate* chat turns - a later turn can't
  recall an earlier turn's raw `tool_use`/`tool_result` blocks, only their text summary.
- **Symbology is solid-color only.** `Tools/SymbologyTools.cs` has no classified/graduated
  renderer support; those requests must go through `run_geoprocessing_tool` against a
  script tool instead.
- **No dry-run/simulation engine.** Safety is only the sandbox-path check +
  destructive-op confirmation + audit log + ArcGIS Pro's own Undo stack.

## 2. FIXED - Sonnet 5 rate cutover is now scheduled

`.github/workflows/scheduled-sonnet-cutover.yml` runs `scripts.flip_sonnet_rate` on a
yearly Sept-1 cron (plus `workflow_dispatch` for manual runs), reading `MONGODB_URI` /
`CLERK_SECRET_KEY` / `ANTHROPIC_API_KEY` from repo secrets. **Caveat:** this working tree
isn't a git repository yet (no `.git`), so the workflow file exists but GitHub Actions has
nothing to run it against until this is pushed to an actual GitHub repo with those secrets
configured there.

## 3. FIXED - engineering blueprint reconstructed as `docs/BLUEPRINT.md`

The original blueprint document cited by section number across the backend couldn't be
recovered, so `docs/BLUEPRINT.md` was written to consolidate the actual implemented design
(roles/lifecycle, the two-credential identity model, the 40% margin math, the margin-leak
fix, the credit-transfer ledger, and the model-pricing lifecycle - numbered so "Section 4"
and "Section 9 step 6" citations in `credit_engine.py`, `seed_model_pricing.py`, and
`flip_sonnet_rate.py` point at real content again. `backend/README.md` now links it
directly instead of the generic `../docs/`.

## 4. FIXED - stale command in `backend/README.md`

Corrected `scripts.create_admin` to `scripts.create_super_admin`, matching the actual file
and its real `--clerk-user-id`/`--email` flags.

## 5. OPEN (deferred by choice) - no response streaming

Both sides of the `/v1/chat` call are still full-request/full-response:
`backend/app/routes/chat.py`'s `handle_chat_request` awaits the entire Anthropic message
before returning, and `src/xGIS.AddIn/Agent/ClaudeAgentService.cs` has no streaming/SSE
handling. Deliberately not implemented in the 2026-07-28 fix pass: it changes the
credit-deduction timing on both the backend (final cost is only known when the whole
response finishes, not per-chunk) and the Add-in (incremental UI updates instead of one
final message), which is a larger, separate piece of work rather than a bounded fix. Still
the single largest remaining gap.

## 6. PARTIALLY FIXED - CI exists for the backend; still no deploy automation

`.github/workflows/backend-tests.yml` runs `backend/tests` via pytest on every push/PR
touching `backend/**`. The .NET Add-in suite deliberately isn't in that workflow (or any
other CI) - `xGIS.AddIn.csproj` needs the full Visual Studio MSBuild
(`CodeTaskFactory`, not supported by `dotnet build`) and the ArcGIS Pro SDK's
locally-installed DLLs, neither of which a GitHub-hosted runner can provide; running it
still requires a real Windows dev box per `docs/SETUP.md`. There is still no
`render.yaml`/`fly.toml`/equivalent for automatic backend deploys.

## 7. PARTIALLY FIXED - targeted test coverage added on the highest-risk paths

Per the chosen scope (targeted, not exhaustive):

- `backend/tests/`: added `test_auth.py` (account auto-provisioning, pending-invite
  linking, banned/blocked rejection), `test_chat_route.py` (the pre-Anthropic-call billing
  guard clauses in `handle_chat_request` - status/balance/model gating, and the
  margin-leak-fix rejection path specifically), and `test_credit_transfer.py` (all four
  credit-movement functions, including the rounding-noise clamp both `revoke_credits` and
  `reclaim_from_member` apply). 29 tests total, all passing. Still no tests for
  `org_admin`/`super_admin`/`invitations` routes or `clerk_provisioning`/
  `anthropic_client`.
- `src/xGIS.AddIn.Tests/`: added `ToolDispatcherTests.cs` (asserts the dispatcher's routing
  table and `ToolDefinitions.All` name Claude sees stay exactly in sync - required
  refactoring `ToolDispatcher`'s switch into an exposed lookup table, since the switch
  itself was only reachable through ArcGIS Pro's `QueuedTask.Run`) and
  `ClaudeAgentServiceTests.cs` (`BuildRequestMessages`, made `internal` to test - the one
  piece of that class with no live HTTP/ArcGIS Pro dependency). 22 tests total, all
  passing. Still no tests for `GeoprocessingTools`, `LayerTools`, `MapViewTools`,
  `SymbologyTools`, or `AuditLogger` - these all need a live ArcGIS Pro host to exercise
  meaningfully, which a plain xUnit run can't provide.
- `admin-dashboard/`: still no test runner configured and no test files exist. Not touched
  in this pass (out of the chosen "highest-risk paths" scope - the dashboard has no
  money-moving logic of its own, only calls to the already-tested backend).

## 8. FIXED - Add-in installer download now bundles a real one-click installer

Not in the original list (found while implementing the "download from every dashboard"
request): `admin-dashboard/app/download/xgis-addin/route.ts` had a dead, unused `archiver`
import and served only the bare `.esriAddinX` - triggering Esri's manual click-through
Add-In Installation Utility, not the fully automatic `Install.bat` flow
`lib/addinRelease.ts`'s own doc comment said it should. The route now zips the
`.esriAddinX` with `Install.bat`/`Uninstall.bat`/`INSTALL.md` from `dist/xGIS-<version>/`
and serves that; `Install.bat` silently registers the add-in and relaunches ArcGIS Pro, so
running it is the entire install step. `AddinDownloadCard.tsx`'s instructions were updated
to match. Verified: the zip's four files were checked directly with `unzip -l`, and the
route builds against a real `dist/xGIS-0.1.0` produced by `scripts/build-release.ps1`.
