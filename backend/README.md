# xGIS Proxy Gateway

FastAPI backend for xGIS's hosted mode: Clerk-authenticated users call `/v1/chat`, the
gateway holds the only real Anthropic API key, meters usage against a MongoDB-backed
credit balance at a guaranteed 40% margin, and an admin grants credits manually after
being paid outside the system. See `../docs/BLUEPRINT.md` for the full engineering
blueprint this followed. The ArcGIS Pro Add-in (`../src/xGIS.AddIn`) calls this gateway instead of
holding an Anthropic key itself - see `docs/ARCHITECTURE.md`'s "Why no Anthropic SDK"
section for how that's wired up.

The margin-guarantee mechanism (why this isn't just the original blueprint verbatim) is
documented in `app/services/credit_engine.py`.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in real values (`.env` is gitignored - never commit
real credentials). Requires a MongoDB Atlas cluster (or self-hosted replica set -
transactions need a replica set, not a standalone instance) and a Clerk application.

## First run

```powershell
.venv\Scripts\python -m scripts.seed_model_pricing
.venv\Scripts\python -m scripts.create_super_admin --clerk-user-id <your Clerk user id> --email you@example.com
.venv\Scripts\uvicorn app.main:app --reload
```

`GET /health` needs no auth. Everything else accepts either a Clerk session JWT (the admin
dashboard's browser sign-in) or an `ak_...` Clerk Machine secret key as a Bearer token (the
ArcGIS Pro Add-in's credential - see `app/auth.py`; Clerk's per-user "API Keys" feature is
plan-gated, Machines does the same job and was available). `/v1/admin/*` additionally
requires the caller's user document to have `role: admin` (set by `create_admin.py`
above). To create a Machine credential for the Add-in:

```powershell
.venv\Scripts\python -c "
import asyncio
from clerk_backend_api import Clerk
from clerk_backend_api.models.createmachineop import CreateMachineRequestBody
from app.config import get_settings

async def main():
    async with Clerk(bearer_auth=get_settings().clerk_secret_key) as clerk:
        m = await clerk.machines.create_async(request=CreateMachineRequestBody(name='xGIS Desktop'))
        print('secret_key (paste into xGIS Settings):', m.secret_key)
        print('identity id (for the users collection):', m.id)

asyncio.run(main())
"
```

Then either let the Add-in auto-provision a `users` document on first call (0 balance,
`role: analyst`) and grant it credits via the admin dashboard, or upsert one directly with
a starting balance the same way `create_admin.py` does.

## Testing

```powershell
.venv\Scripts\pytest
```

`tests/test_credit_engine.py` is pure logic - no live MongoDB/Clerk/Anthropic needed, and
is the most important suite here: it directly tests the margin-leak fix (a low-balance
request must get its `max_tokens` capped before the Anthropic call, never discovered as an
uncollectible overage after).

## Deploying

`Dockerfile` builds a standard Uvicorn container; point it at a host that gives you
`MONGODB_URI` / `CLERK_SECRET_KEY` / `ANTHROPIC_API_KEY` as environment variables (Render,
Fly.io, or AWS ECS all work - Render is the simplest to get running for a small user base).

For the Sonnet 5 intro-rate cutover (2026-09-01), schedule `scripts/flip_sonnet_rate.py`
via cron or your host's scheduled-job feature - it's a data change, not a deploy.
