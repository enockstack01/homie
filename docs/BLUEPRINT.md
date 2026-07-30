# xGIS engineering blueprint

Several modules cite "the blueprint" by section number (`credit_engine.py`, `auth.py`,
`seed_model_pricing.py`, `flip_sonnet_rate.py`, `test_credit_engine.py`,
`backend/README.md`) for a design document that predates this file and isn't in the repo
- either it was never committed, or it lived outside this tree. This document reconstructs
it from what's actually built, numbered to match the section references already in code
comments, so those citations point somewhere real. Where the running system diverges from
what a section originally specified, that's called out explicitly rather than silently
matching the code.

## 1. What this platform is

xGIS is an ArcGIS Pro Add-in (`src/xGIS.AddIn`) that runs an agentic tool-use loop against
Claude to drive real geoprocessing and mapping operations in-process. `backend/` is the
gateway that lets an organization run this for its own users without every user needing
their own Anthropic key: it holds the one real Anthropic API key, authenticates callers via
Clerk, and meters usage against a MongoDB-backed credit balance at a guaranteed margin. See
`docs/ARCHITECTURE.md` for the Add-in's internal request flow.

## 2. Accounts, roles, and organizations

Four roles (`app/auth.py`):

- **super_admin** - the whole platform: all organizations, all users, platform resources
  (model pricing, the Anthropic key). `organization_id` always `None`.
- **platform_admin** - identical to super_admin (same organizations/users/credits/roles
  access, gated by the same `require_platform_staff` dependency) except it cannot change
  platform resources - model pricing and the Anthropic API key stay behind the stricter
  `require_super_admin` dependency specifically. `organization_id` always `None`, same as
  super_admin. The only role whose entire reason to exist is one narrower permission set
  than super_admin's.
- **org_admin** - manages exactly one organization's members and allocates that org's
  credit pool out to them. `organization_id` always set.
- **member** - an organization member, drawing down an allocation out of that org's shared
  credit pool. `organization_id` always set once onboarding (registering the organization,
  see `chat.py`'s `register_organization`) is complete - there is no standing "no
  organization" account type on this platform; every self-signup is required to register
  or join one.

Lifecycle (independent of role): **pending -> active**, or **banned/deleted** (terminal,
rejected outright by `get_current_user` before any route body runs). A user reaches
`pending` two ways - self-signup (auto-provisioned on first sign-in, needs an explicit
super_admin approval before they can spend credits) or an org-invite-by-email (created by
`org_admin`'s `add_member` with no Clerk identity yet, flips straight to `active` the
moment that email actually signs in, since being invited by an org already vetted them).

## 3. Identity: two credentials, one account

A person can authenticate two different ways against the same Homie account
(`app/auth.py`, `app/services/clerk_provisioning.py`):

- **Clerk session** (`user_...`) - browser sign-in to this Next.js dashboard.
- **Clerk Machine** (`mch_...`) - a long-lived secret (`ak_...`) the desktop Add-in sends
  as a bearer token on every request. Chosen over Clerk's per-user "API Keys" feature
  because that feature was plan-gated (`403 feature_not_enabled`) when this was built;
  Machines serves the same "one non-interactive long-lived credential" purpose and was
  available. A machine secret isn't itself a valid bearer token against Clerk-protected
  endpoints - it has to be exchanged for a short-lived M2M token first - so the backend
  does that exchange server-side on every request, and the Add-in never needs any
  token-refresh logic of its own.

These are stored as two separate fields (`clerk_user_id`, `machine_id`) on one `users`
document, specifically so issuing/rotating a Machine credential can never sever a member's
own dashboard sign-in.

## 4. Rate card and margin model

Currency: **1 credit = $0.001 USD** (1 USD = 1,000 credits), fixed
(`app/services/credit_engine.py`). Every active model has a `model_pricing` document
(seeded by `backend/scripts/seed_model_pricing.py`) with Anthropic's own per-million-token
input/output rates and a `markup_multiplier`. The platform's guaranteed margin is **40%**:
a user is billed at `markup_multiplier = 1 / 0.60 ≈ 1.6667` times Anthropic's raw rate, so
every credit collected covers Anthropic's cost with 40% left over, on every request,
without exception.

A pricing document's `_id` (a tier slug, e.g. `claude-sonnet-5-intro`) is distinct from its
`model_id` (the literal string sent to the Anthropic API, e.g. `claude-sonnet-5`) -
`routes/chat.py` looks pricing up by `model_id` + `is_active`, so multiple tiers can share
one `model_id` with only one active at a time (see Section 9).

## 5. The margin-leak fix (why this isn't the original design verbatim)

The original design checked `credit_balance > 0` before calling Anthropic, then only
checked whether the *actual* cost fit the balance **after** the call already happened. A
low-balance user whose response happened to run long would cause the gateway to pay
Anthropic in full and then fail to collect - a real margin leak, not an edge case.

The fix, in `credit_engine.plan_request_budget` (called from `routes/chat.py` **before**
the Anthropic call): input tokens are counted exactly via Anthropic's `count_tokens`
endpoint (not estimated), charged first, and whatever balance remains after that caps the
request's `max_tokens` so the worst-case output cost can never exceed what's left. A
request that couldn't even afford `DEFAULT_MIN_OUTPUT_TOKENS` (50) tokens of output is
rejected outright (`402`) rather than sent to Anthropic for a response that would be
truncated to near-nothing. The post-call deduction that follows (`compute_final_charge`,
inside a MongoDB transaction keyed on `credit_balance: {"$gte": ...}`) then only ever
guards a genuine concurrent-request race, never this class of bug - see
`backend/tests/test_credit_engine.py` for the case this specifically closes.

## 6. Credit movement

Four kinds of credit movement, all in `app/services/credit_transfer.py`, all logged to one
`credit_transactions` ledger, all using the same atomic
`find_one_and_update`-inside-a-transaction pattern as the spend-time deduction in Section 5:

1. **`grant_external`** - a super_admin recording money that came in *outside* the system
   (bank transfer, invoice) as credits on an organization's pool, or directly on a user's
   own balance as a support override. Unlimited; never checks a balance, only adds.
2. **`allocate_from_organization`** - an org_admin moving credits already in their
   organization's pool into one member's personal balance. Checks the pool can afford it,
   atomically (two allocations racing a near-empty pool must not both succeed).
3. **`revoke_credits`** - a super_admin removing a specified amount from a user's balance
   or an org's pool; the inverse of `grant_external`, logged as a negative entry.
4. **`reclaim_from_member`** - an org_admin moving a specified amount back from a member's
   balance into their own org's pool; the inverse of `allocate_from_organization`. Unlike
   revocation, this never destroys credits - only redistributes within the org.

## 7. Model selection

A member picks their active model from `/v1/available-models` (only models a super_admin
has activated) via `/v1/my-model`; `preferred_model_id` lives on their own account, not on
any request. `routes/chat.py`'s `ChatRequest.model_id` is accepted-but-ignored for exactly
this reason: **billing must never trust what the caller says it wants to use** - the model
actually called and billed is always the account's stored preference. This is also why
model choice moved out of the Add-in's Settings window (see `docs/ARCHITECTURE.md`) and
onto the dashboard: it has to be the thing the backend already trusts, not something the
client sends.

## 8. Add-in distribution

`scripts/build-release.ps1` packages a Release build into `dist/xGIS-<version>/`:
the `.esriAddinX`, `INSTALL.md`, and two templated scripts (`scripts/installer-templates/`)
- `Install.bat` (silently registers the add-in via `RegisterAddIn.exe /s` and relaunches
ArcGIS Pro) and `Uninstall.bat` (keyed off `Config.daml`'s fixed add-in GUID, never
hardcoded, so it can't drift out of sync). `admin-dashboard/lib/addinRelease.ts` reads that
`dist/` folder directly (same-machine deployment only - see its own doc comment for what a
real multi-machine deployment would need instead), and
`app/download/xgis-addin/route.ts` bundles all four files into one zip so downloading and
running `Install.bat` is the entire install step - no separate click-through installer.
This is gated on `status === "active"` in three places: `/member`, `/org-admin`, and
`/super-admin/account` (every account type gets it once its own status allows spending),
independently re-checked in the route itself so the dashboard's hiding the link is a
convenience, not the actual access control.

## 9. Model pricing lifecycle and scheduled cutovers

A pricing tier carries `effective_from`/`effective_until` and `is_active`; `is_active` (not
the dates) is what `routes/chat.py` and `/v1/available-models` actually check. Retiring one
tier and activating its successor is a **data change** (flip two `is_active` flags), never
a code change or a deploy, kept in one dedicated idempotent script per cutover rather than
folded into `seed_model_pricing.py`'s initial seed.

**Step 6 - the Claude Sonnet 5 intro-rate cutover**: `claude-sonnet-5-intro`
($2.00/$10.00 per M input/output) is active from 2026-01-01 through 2026-08-31;
`claude-sonnet-5-standard` ($3.00/$15.00 per M) takes over 2026-09-01. Both share
`model_id: "claude-sonnet-5"`, so the switch is invisible to a member beyond the rate
their next request is billed at. `backend/scripts/flip_sonnet_rate.py` performs the flip
and is idempotent (safe to run more than once); `.github/workflows/scheduled-sonnet-cutover.yml`
runs it automatically (see Section 10) so the cutover no longer depends on a human
remembering the date.

## 10. CI and scheduled jobs

`.github/workflows/backend-tests.yml` runs `backend/tests` (pytest) on every push/PR - see
its own comments for why the .NET Add-in suite isn't in the same workflow (it needs the
full Visual Studio MSBuild and locally-installed ArcGIS Pro SDK DLLs, not something a
GitHub-hosted runner has). `.github/workflows/scheduled-sonnet-cutover.yml` runs Section
9 Step 6's script on a schedule.
