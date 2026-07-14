# CMUDE Registry

Check-in and lunch-tracking system for CMUDE — a 9-day, ~460-person debate tournament. Every participant gets a QR code; scanning it at the welcome-kit table or the lunch line tells staff instantly whether to hand something over.

## How it works

- **Welcome kit** unlocks everything else. No kit scanned yet → no lunch, no matter what day it is.
- **Lunches are tracked per event day**, not per calendar date — the schedule has a rest day and a combined semis/finals day with no lunch service, so `arrival_date` (set once, in the admin dashboard) is the only date anyone ever types in. Everything else — which day it is, whether today has lunch, whether a participant's package covers it — is computed from that.
- **Full package** covers lunch through semis/finals (day 8). **Partial package** stops after rounds 7–9 (day 5).
- Every scan is a **live, permanent decision** — the moment a scan is eligible, it's written to the database. There's no undo screen; corrections happen in `/admin`.

## Architecture

```
┌─────────────┐        ┌──────────────┐        ┌─────────────────┐
│   Vercel     │        │    Render     │        │    Supabase      │
│  (frontend)  │───────▶│  (backend)    │───────▶│ Postgres + Auth   │
│ React + Vite │  CSV   │   FastAPI      │ service│ + Realtime        │
│              │ import │               │  key   │                  │
└──────┬───────┘        └──────────────┘        └────────▲─────────┘
       │                                                    │
       └───────────────── everything else ──────────────────┘
                        (direct, via Supabase client)
```

The backend only exists for one thing: bulk CSV participant import (needs the Supabase **service key**, which must never reach the browser). Everything else — scanning, the admin table, realtime sync across 20+ devices — talks to Supabase directly from the frontend.

| Piece | Where | Why |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) — `registry-cmude.vercel.app` | Static Vite build, free tier, global CDN |
| Backend | [Render](https://render.com) — `registry-cmude.onrender.com` | Needs to run as a persistent process (no cold starts on Starter plan) |
| Database | [Supabase](https://supabase.com) — project `kcjrcwoqvxmgbdbxhytd` | Postgres + Row Level Security + Realtime + Auth, all in one |

## Local development

```bash
# Frontend
cd frontend
npm install
npm run dev          # → http://localhost:3000

# Backend (only needed to test CSV import)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Both need a local `.env` — copy `.env.example` in each folder and fill in real values (ask whoever has them; **never** commit a filled-in `.env`, both are already gitignored).

## Roles & authentication

There is no per-person login for scanning — one shared account is used across every scan station, and it's kept deliberately low-privilege. Everything is enforced by Supabase Row Level Security, keyed off a `role` claim on each account, **not** by anything the frontend decides:

| Role | Can do | Used for |
|---|---|---|
| `admin` | Full read/write on everything | `/admin/*` — one account per real admin |
| `scanner` | Read one participant at a time, update lunch/kit fields only. **No insert, no delete.** | `/scan`, `/p/:id` — one shared account for all scan stations |
| *(signed out)* | Nothing at all | The public anon key has **zero** access to participant data — it was removed on purpose so scanning can't be done by anyone who isn't actually logged in |

### Creating a new admin account

There's no UI for this — it's a one-time API call. **The `app_metadata.role: "admin"` field is not optional** — without it, the account can log in but Supabase will silently grant it *zero* access (not admin access) under the current RLS policies.

**macOS/Linux/Git Bash:**
```bash
curl -X POST "https://kcjrcwoqvxmgbdbxhytd.supabase.co/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"NEW_EMAIL","password":"NEW_PASSWORD","email_confirm":true,"app_metadata":{"role":"admin"}}'
```

**Windows PowerShell** — plain `curl` there is an alias for `Invoke-WebRequest` and doesn't understand any of the above; use `curl.exe` explicitly, one line at a time:
```powershell
$key = "SUPABASE_SERVICE_KEY_VALUE_HERE"
$body = '{"email":"NEW_EMAIL","password":"NEW_PASSWORD","email_confirm":true,"app_metadata":{"role":"admin"}}'
curl.exe -X POST "https://kcjrcwoqvxmgbdbxhytd.supabase.co/auth/v1/admin/users" -H "apikey: $key" -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d $body
```

A successful response includes `"app_metadata":{"role":"admin"}` in the returned JSON — if `role` isn't in there, the account exists but has no access, so double-check the body before assuming it worked.

`SUPABASE_SERVICE_KEY` lives in `backend/.env` locally, and in Render's environment variables in production.

### Changing the shared scanner password

Same idea — update via the Supabase Auth admin API (or the Supabase dashboard → Authentication → Users), keeping `app_metadata.role: "scanner"` intact. The frontend maps whatever "username" a volunteer types to `username@cmude.local` automatically — it isn't a real inbox, just how Supabase Auth wants an identifier shaped.

## Database migrations

Schema lives in `supabase/migrations/`, applied in order. To add one:

```bash
# write supabase/migrations/00N_description.sql, then:
supabase link --project-ref kcjrcwoqvxmgbdbxhytd   # once per machine
supabase db push
```

Never edit an already-pushed migration file — add a new one, even for a one-line fix. The history is the source of truth for what actually happened to the live schema.

## Scripts (`scripts/`)

All read credentials from `backend/.env`.

| Script | Purpose |
|---|---|
| `import_participants.py roster.xlsx` | Bulk import from the organizers' Excel roster. Refuses to run if participants already exist unless `--force` is passed — this only ever runs once per event. |
| `backfill_roles.py roster.xlsx` | One-off: patches `role` onto already-imported participants by matching name. Only needed because `role` was added to the schema after the first import. |
| `generate_qr.py --output qr_codes.pdf` | Generates the printable QR code sheet, one card per participant, colored border by diet type. Pulls live data from Supabase — run this **last**, after the roster is fully imported and correct. |

## Deployment checklist

**Render** (`backend/render.yaml` describes the service, but env vars must be set manually in the dashboard):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — from Supabase dashboard → Settings → API
- `FRONTEND_URL` — the Vercel URL, **no trailing slash** (CORS does exact string matching against the browser's `Origin` header — a trailing slash silently breaks every request)

**Vercel** (root directory = `frontend`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same Supabase project, but the **publishable/anon** key, not the service key
- `VITE_API_URL` — the Render URL
- Any `VITE_*` var is bundled into the public JS and visible to anyone — only the anon key belongs there, never the service key

Env var changes on Vercel need a **redeploy** to take effect (Vite bakes them in at build time, not runtime).

## Before every event

1. Import the roster: `python scripts/import_participants.py roster.xlsx`
2. Set the diet color legend and confirm the 5 diet categories still match the roster's codes (`generate_qr.py`, `DIET_COLORS`)
3. Set `arrival_date` in `/admin/dashboard` — this drives which lunch day is "today" everywhere in the app
4. Generate and print QR codes: `python scripts/generate_qr.py`
5. Double-check `is_minor` and `room` data is filled in and correct before printing anything

## Security notes

- The roster spreadsheet (real names, diet/allergy info, minor status) must **never** be committed — it's gitignored (`supabase/*.xlsx`). This repo is public.
- Nothing in `frontend/.env` is truly secret — everything there is visible to anyone using the site. The real secret (`SUPABASE_SERVICE_KEY`) only ever lives in `backend/.env` and Render's env vars.
- If a scan device is lost or compromised, the shared scanner account can only read/update lunch and kit fields for one participant at a time — it cannot see the full roster, export data, or delete anything.
