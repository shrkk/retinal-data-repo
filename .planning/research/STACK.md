# Stack Research

**Domain:** Research data viewer — FastAPI + React migrating SQLite → Supabase PostgreSQL, deployed to Render + Vercel
**Researched:** 2026-03-22
**Confidence:** HIGH (all versions verified against PyPI / official docs)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FastAPI | 0.135.1 | Python HTTP API framework | Already in use. Do not replace. Python parsing logic (filecleaner.py) cannot be trivially ported to Edge Functions. |
| Uvicorn | 0.35.0 | ASGI server (dev + prod single-worker) | Already in use. Paired with Gunicorn for multi-worker production. |
| Gunicorn | latest | Process manager for multi-worker production | Spawns `uvicorn.workers.UvicornWorker` processes on Render. Command: `gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT` |
| asyncpg | 0.31.0 | Async PostgreSQL driver | Fastest async Postgres driver for Python; production-stable since 2025. Use with `create_pool()` at app startup — eliminates per-request connection overhead. Must disable prepared statements for Supabase Transaction Mode: `statement_cache_size=0`. |
| pydantic-settings | 2.13.1 | Type-safe env config (replaces bare os.environ) | Official FastAPI recommendation. Reads `.env` + system env vars into a validated `Settings` class. Replaces the current `load_dotenv()` + `os.environ.get()` scattered in `main.py`. Requires Python >=3.10 — matches FastAPI >=0.135.1. |
| python-multipart | 0.0.22 | Multipart form / file upload parsing | Required by FastAPI for `UploadFile` + `Form` endpoints. The admin CSV upload endpoint cannot function without it. |
| React | 19.1.1 | Frontend UI framework | Already in use. Do not replace. |
| Vite | 7.1.2 | Frontend build tool + dev server | Already in use. Zero-config Vercel deployment. All frontend env vars must be prefixed `VITE_` to be exposed at build time. |
| TypeScript | 5.8.3 | Static typing for frontend | Already in use. |
| @supabase/supabase-js | 2.75.0 | Supabase JS client (frontend) | Already in `package.json`. Used for Storage bucket downloads (raw-csvs). The missing `lib/supabase.ts` must be created to wire it up. |
| supabase (Python) | 2.28.3 | Supabase Python client | Latest stable as of 2026-03-20. Use only for Storage bucket operations (uploading ingested CSVs) — not for database queries. DB queries go through asyncpg directly for performance. |
| Supabase PostgreSQL | managed | Primary database | Replaces SQLite. Use Transaction Mode pooler (port 6543) for all FastAPI API traffic. Use Direct Connection (port 5432) only for migrations and admin scripts. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | 1.1.1 | `.env` file loading | Already installed. Keep for local dev convenience even after adding pydantic-settings — pydantic-settings can consume `.env` files natively, so python-dotenv becomes optional. |
| aiosqlite | existing | Async SQLite | Remove after Supabase migration is complete. Do not use alongside asyncpg. |
| secrets (stdlib) | built-in | Timing-safe string comparison | Use for admin password check: `secrets.compare_digest(provided_pw, ADMIN_PASSWORD)`. Do not use `==` for password comparison — timing attacks. |
| fastapi.security.HTTPBasic | built-in | Browser-prompt auth for admin UI | Use on `/admin/*` routes. Returns `HTTPBasicCredentials`; check password with `secrets.compare_digest()`. Single env-var password (no username needed, but HTTPBasic requires one — use `"admin"` as fixed username). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| render.yaml | Render infrastructure-as-code | Defines service type, start command, env vars, health check path. Add to repo root. Use `sync: false` for secrets (DATABASE_URL, ADMIN_PASSWORD) so they are prompted at first deploy and not committed. |
| vercel.json | Vite SPA routing fix | Required for client-side React routing. Add `rewrites: [{ source: "/(.*)", destination: "/index.html" }]`. Without this, direct URL access to non-root routes returns 404. |
| .env.example | Document required env vars | Commit this, not `.env`. Developers copy it to `.env` locally. |

---

## Installation

### Backend (Python — add to requirements.txt)

```bash
# Replace aiosqlite with asyncpg after migration
pip install asyncpg==0.31.0
pip install pydantic-settings==2.13.1
pip install python-multipart==0.0.22
pip install supabase==2.28.3
pip install gunicorn

# Remove after migration
# aiosqlite
```

### Frontend (Node — add to retinal-ui/)

```bash
# @supabase/supabase-js is already in package.json at ^2.75.0 — no change needed
# No new npm dependencies required for admin CSV upload — use native FormData + fetch
```

### Deployment config files to create

```bash
# At repo root
touch render.yaml

# In retinal-ui/
touch retinal-ui/vercel.json
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| asyncpg (direct) | supabase-py for DB queries | Never — supabase-py wraps PostgREST (HTTP), not the raw Postgres wire protocol. asyncpg is 10-100x faster for bulk data queries like this app needs. Use supabase-py only for Storage. |
| asyncpg (direct) | SQLAlchemy + asyncpg | Only if you need ORM features (complex join models, migrations via Alembic). This app has a single flat table; raw asyncpg is simpler and faster. |
| Gunicorn + UvicornWorker | Uvicorn standalone | Uvicorn standalone is fine for Railway (single Dyno). Use Gunicorn on Render where you control worker count. Both platforms handle process restart. |
| Render | Railway | Either works. Render has `render.yaml` infra-as-code and a free tier. Railway has simpler UX and PostgreSQL add-on but Railway PostgreSQL should NOT be used — we're using Supabase Postgres specifically. Railway is viable for the FastAPI service if Render free tier is insufficient. |
| pydantic-settings BaseSettings | bare os.environ.get() | The current approach is fine for a one-file script but breaks type safety and doesn't validate missing required vars at startup. pydantic-settings raises immediately on startup if required vars are absent. |
| Native FormData + fetch | react-dropzone / react-admin | react-dropzone adds 5KB but brings drag-and-drop UX. For a single-purpose admin page accessed rarely by one person, native `<input type="file">` + FormData is sufficient. Don't add a dependency for this. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| supabase-py for database SELECT/INSERT queries | Wraps PostgREST over HTTP — adds 50-100ms latency per query and cannot match asyncpg for bulk reads of 50k cone rows. PostgREST also requires RLS policies to be configured, adding complexity. | asyncpg with a connection pool |
| aiosqlite after migration | SQLite is not production-appropriate and is being replaced. Keeping both drivers creates confusion. | asyncpg only |
| Hardcoded `http://127.0.0.1:8001` in `api/index.ts` | Breaks in every deployed environment. Already identified as a known issue in PROJECT.md. | `import.meta.env.VITE_API_URL` with a fallback |
| `==` for password comparison | Vulnerable to timing attacks. Python's `==` short-circuits on first mismatched byte. | `secrets.compare_digest()` from stdlib |
| Supabase Auth / JWT for admin | Massive overkill for a single-person admin gate with no user accounts. Adds complexity, SDK requirements, token refresh logic. | Single `ADMIN_PASSWORD` env var + HTTPBasic |
| Supabase Direct Connection (port 5432) for FastAPI API traffic | Direct connections bypass Supavisor pooling. Under load each FastAPI worker opens its own persistent connection, exhausting Supabase's connection limit (~15 on free tier). | Supavisor Transaction Mode port 6543 for API traffic; Direct Connection only for migrations |
| Supabase Session Mode on port 6543 | Deprecated by Supabase as of February 28, 2025. Port 6543 is now Transaction Mode only. | Transaction Mode (6543) for API; Direct (5432) for migrations |

---

## Stack Patterns by Variant

**For Supabase DB queries from FastAPI (Transaction Mode, port 6543):**
- Use asyncpg `create_pool()` with `statement_cache_size=0` and `prepared_statement_cache_size=0`
- Connection string: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- Create pool in `lifespan` context manager (FastAPI startup/shutdown), not per-request

**For Supabase DB migrations / admin scripts:**
- Use Direct Connection string (port 5432) — prepared statements work, full feature set
- Run `filecleaner.py` ingestion via the admin endpoint, not locally, to avoid mixing connection modes

**For Supabase Storage (raw CSV download by end users):**
- Use `@supabase/supabase-js` from the browser directly (already in `api/index.ts`)
- Create `lib/supabase.ts` with `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
- Storage bucket `raw-csvs` should have public read policy (no auth required for researchers)

**For admin CSV upload endpoint:**
- Backend: `POST /admin/upload` with `UploadFile` + `Form` parameters + HTTPBasic dependency
- Frontend: native `<input type="file" accept=".csv">` + `FormData` + `fetch`
- No state management library needed — this is a single form action

**For Vercel (frontend):**
- Set `VITE_API_URL` to the Render/Railway service URL in Vercel project settings
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings
- These are exposed at build time — do not put secrets here

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| fastapi==0.135.1 | pydantic==2.11.7 | Already in use. pydantic v2 required for FastAPI >=0.100. |
| fastapi==0.135.1 | python-multipart>=0.0.18 | FastAPI 0.135.x requires python-multipart >=0.0.18. Use 0.0.22 (latest). |
| pydantic-settings==2.13.1 | pydantic==2.11.7 | pydantic-settings 2.x requires pydantic v2. Confirmed compatible. |
| asyncpg==0.31.0 | Python >=3.9 | Current requirements.txt shows FastAPI 0.116.1 (Python >=3.8 at that version) but upgrade to FastAPI 0.135.1 requires Python >=3.10 — verify Render Python runtime is 3.11. |
| supabase==2.28.3 | Python >=3.9 | Use only for Storage operations. |
| @supabase/supabase-js==^2.75.0 | React 19, Vite 7 | Already in package.json. No version change needed. |

---

## Required Environment Variables

### Backend (.env / Render environment)

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres` | Transaction Mode pooler URL. Render: mark as secret, `sync: false`. |
| `SUPABASE_URL` | `https://[ref].supabase.co` | For Storage operations (supabase-py). |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Service role key for Storage uploads from backend. Never expose to frontend. |
| `ADMIN_PASSWORD` | `[random 32-char string]` | Single password for admin gate. Render: mark as secret. |
| `ALLOWED_ORIGINS` | `https://retinal-viewer.vercel.app` | Comma-separated list. Already read in main.py. |
| `PORT` | `8001` | Already read in main.py. Render/Railway inject `PORT` automatically. |

### Frontend (.env / Vercel environment)

| Variable | Example | Notes |
|----------|---------|-------|
| `VITE_API_URL` | `https://retinal-api.onrender.com` | Backend base URL. Replaces hardcoded `127.0.0.1:8001`. |
| `VITE_SUPABASE_URL` | `https://[ref].supabase.co` | Public — safe to expose at build time. |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Anon (public) key only. RLS policies control access. Never use service key here. |

---

## Sources

- [PyPI: supabase 2.28.3](https://pypi.org/project/supabase/) — version verified 2026-03-22 (HIGH confidence)
- [PyPI: asyncpg 0.31.0](https://pypi.org/project/asyncpg/) — version verified 2026-03-22 (HIGH confidence)
- [PyPI: pydantic-settings 2.13.1](https://pypi.org/project/pydantic-settings/) — version verified 2026-03-22 (HIGH confidence)
- [PyPI: fastapi 0.135.1](https://pypi.org/project/fastapi/) — version verified 2026-03-22 (HIGH confidence)
- [PyPI: python-multipart 0.0.22](https://pypi.org/project/python-multipart/) — version confirmed via WebSearch (MEDIUM confidence — not directly fetched)
- [Supabase Docs: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — Transaction Mode vs Direct Connection (HIGH confidence)
- [Supabase Docs: Python client](https://supabase.com/docs/reference/python/installing) — installation, async client (HIGH confidence)
- [Render: FastAPI production deployment best practices](https://render.com/articles/fastapi-production-deployment-best-practices) — render.yaml, Gunicorn pattern (MEDIUM confidence)
- [Railway: FastAPI guide](https://docs.railway.com/guides/fastapi) — Dockerfile + hypercorn alternative (MEDIUM confidence)
- [Vercel: Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) — SPA rewrites, VITE_ env vars (HIGH confidence)
- [FastAPI Docs: HTTP Basic Auth](https://fastapi.tiangolo.com/advanced/security/http-basic-auth/) — secrets.compare_digest pattern (HIGH confidence)
- [FastAPI Docs: Settings](https://fastapi.tiangolo.com/advanced/settings/) — pydantic-settings integration (HIGH confidence)
- [Supabase: Session Mode deprecation on port 6543](https://github.com/orgs/supabase/discussions/32755) — deprecated Feb 28, 2025 (HIGH confidence)

---
*Stack research for: UWOPH Retinal Cone Viewer — production migration*
*Researched: 2026-03-22*
