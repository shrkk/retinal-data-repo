# Project Research Summary

**Project:** UWOPH Retinal Cone Viewer — Production Migration
**Domain:** Scientific research data viewer (ophthalmology / adaptive optics cone mosaic analysis)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

This is a subsequent milestone on an existing internal research tool — not greenfield work. The codebase is a FastAPI backend + React/Vite frontend that currently runs on SQLite locally and needs to migrate to Supabase PostgreSQL with production deployment on Render (backend) and Vercel (frontend). The existing Python parsing logic (`filecleaner.py`) processes complex multi-block adaptive optics CSV files and must stay in the FastAPI process — it cannot be moved to Supabase Edge Functions or the browser. The recommended architecture is well-established: asyncpg connection pool for all database queries (never supabase-py for DB queries), supabase-js on the frontend for Storage downloads, and pydantic-settings for environment configuration.

The migration has two hard blockers that must be resolved before any feature work begins. First, a Supabase database password is committed in plaintext in `test_db.py` — rotate it immediately before any further commits. Second, `lib/supabase.ts` does not exist, which silently breaks the existing CSV download feature. Both must be fixed in a pre-work phase. After unblocking, the build order dictated by architecture is: database schema + connection first, then FastAPI refactor, then existing routes migration, then ingestion pipeline, then admin UI, then frontend config, then deployment, then feature additions (NC cones, stats panel).

The primary risks are infrastructure-level: asyncpg prepared statement cache incompatibility with Supabase's transaction pooler, CORS misconfiguration blocking Vercel from reaching Render, and the N+1 query pattern in `EccentricitySubPlots` that worsens significantly once PostgreSQL network latency is introduced. All three have clear, known fixes. The feature work (NC cone type, L/M ratio stats panel, admin upload page) is straightforward once the database layer is solid — the stats columns already exist in the schema, and the admin endpoint pattern is well-documented.

---

## Key Findings

### Recommended Stack

The stack is largely fixed — FastAPI, React, Vite, and TypeScript are all in use and should not be replaced. The migration adds asyncpg (replacing aiosqlite) as the async PostgreSQL driver, pydantic-settings for type-safe environment config, and python-multipart (required by FastAPI for file upload endpoints). For the Supabase connection, use the Transaction Mode pooler (port 6543) with `statement_cache_size=0` disabled for API traffic; use the direct connection (port 5432) only for migrations and admin scripts. The frontend already has `@supabase/supabase-js` in `package.json` — it just needs `lib/supabase.ts` created.

All versions verified against PyPI as of 2026-03-22. Python runtime on Render must be 3.11 (FastAPI 0.135.1 requires Python >=3.10).

**Core technologies:**
- asyncpg 0.31.0: async PostgreSQL driver — 10-100x faster than supabase-py for bulk cone data queries; use `create_pool()` at startup with `statement_cache_size=0` for transaction pooler compatibility
- pydantic-settings 2.13.1: type-safe env config — replaces scattered `os.environ.get()` calls; raises at startup if required vars are missing
- python-multipart 0.0.22: multipart form parsing — required by FastAPI for `UploadFile`; admin CSV upload cannot function without it
- supabase-py 2.28.3: Supabase Python client — use only for Storage bucket operations (uploading ingested CSVs); never for database queries
- Gunicorn + UvicornWorker: production process manager — spawns multiple uvicorn workers on Render for multi-core utilization
- @supabase/supabase-js 2.75.0: already in package.json — use for Storage bucket downloads from browser; needs `lib/supabase.ts` wiring

**Critical version constraint:** FastAPI 0.135.1 requires Python >=3.10. Verify Render is configured for Python 3.11.

See `.planning/research/STACK.md` for full environment variable reference and deployment config files.

### Expected Features

The milestone has a well-defined scope. All P1 features are required for the milestone to be considered complete; P2 features follow once P1 is stable.

**Must have (P1 — table stakes for this milestone):**
- NC cone type in FilterBar checkboxes with `#aaaaaa` grey color — NC cones are a documented classification outcome; hiding them misrepresents the cone mosaic
- L/M ratio + % S-cones stats panel as a card below FilterBar — the primary new research value; columns already exist in schema, pure frontend + API endpoint work
- Fix `lib/supabase.ts` missing file — silently breaks existing CSV download feature on every click
- Admin CSV upload page at `/admin` behind `ADMIN_PASSWORD` env var — password-gated, calls `/admin/upload` endpoint, shows per-subject ingestion summary
- Fix hardcoded `localhost:8000` API URL to use `VITE_API_URL` env var — hard deployment blocker; Vercel frontend cannot reach Render backend without this

**Should have (P2 — after P1 validated):**
- Meridian filter made meaningful — currently `distribute_meridians.py` assigns fake meridians; fix only after real data is re-ingested
- Legend visible on cone position plots — `showlegend: false` currently; enabling is one-line change but needs visual QA with metadata overlay
- Fixed-scale axis toggle for eccentricity sub-plots — helps cross-eccentricity comparison once researchers report confusion

**Defer (v2+):**
- Per-eccentricity-window breakdown of cone ratios (requires backend aggregation work)
- Batch download of all subjects
- Cross-subject scatter overlay (severe overplotting risk at 50k+ cones per subject)
- Mobile-responsive layout (desktop research use only per project constraints)

**Anti-features confirmed:** Supabase Auth/JWT for admin (overkill for single-password gate), real-time byte-by-byte upload progress (requires SSE/WebSocket for files that are <10MB), column mapping UI (filecleaner.py owns schema mapping and must remain authoritative).

See `.planning/research/FEATURES.md` for dependency graph and prioritization matrix.

### Architecture Approach

The architecture is a standard three-tier research tool: React SPA on Vercel CDN, FastAPI backend on Render with an asyncpg connection pool, and Supabase PostgreSQL as the database. The Python ingestion pipeline (`filecleaner.py`) lives inside the FastAPI process — this is correct and must not change. No global state manager is needed on the frontend; prop-drilling is sufficient at this scale. The admin route is a separate FastAPI router (`app/routes/admin.py`) with its own auth dependency, keeping it cleanly separated from read routes.

**Major components:**
1. React frontend (Vercel) — visualization, filter UI, admin upload form; all API calls via `VITE_API_URL`
2. FastAPI backend (Render) — REST API, CSV ingestion trigger, CORS config, HTTPBasic auth gate for admin
3. asyncpg connection pool — created at app startup via `lifespan` context manager; never per-request connections
4. filecleaner.py (inside FastAPI process) — parses multi-block AO CSV into tidy cone rows; called synchronously by BackgroundTask
5. Supabase PostgreSQL — single `cone_data` table with 4 composite indexes covering all current query patterns
6. Supabase Storage (`raw-csvs` bucket) — holds raw uploaded CSV files; downloaded by frontend via supabase-js

**Key architectural constraint:** When using `BackgroundTasks` for ingestion, `file_bytes = await file.read()` must happen inside the endpoint before `background_tasks.add_task()` is called. Since FastAPI v0.106.0, `UploadFile` is closed by the framework before background tasks run — passing the `UploadFile` object directly to a background task causes silent IO failures.

**N+1 fix required:** `EccentricitySubPlots.tsx` fires one API call per eccentricity range (currently up to 13 simultaneous HTTP requests per subject view). Must be addressed with a bulk endpoint before user-facing deployment — over Vercel-to-Render-to-Supabase network hops this becomes 650-1300ms minimum latency per page load.

See `.planning/research/ARCHITECTURE.md` for full schema DDL, project structure, and data flow diagrams.

### Critical Pitfalls

1. **Hardcoded Supabase password committed in `test_db.py`** — rotate the database password immediately via the Supabase dashboard before any further work; run `git filter-repo` to purge from history before making the repo visible to anyone; replace with `os.environ.get("DATABASE_URL")`

2. **asyncpg prepared statement cache breaks on Supabase Transaction Pooler** — when using port 6543, add `statement_cache_size=0` and `prepared_statement_cache_size=0` to the asyncpg `create_pool()` call; alternatively use the direct connection (port 5432) for the persistent Render server; validate with 10 concurrent queries before declaring migration complete

3. **Missing `lib/supabase.ts` silently breaks CSV download** — the dynamic import in `api/index.ts` fails at runtime with no build-time error; create the file with `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` before starting migration work; smoke-test the download button before any phase is declared complete

4. **SQLite `?` placeholder syntax breaks in PostgreSQL** — replace all `?` placeholders with asyncpg's `$1, $2, ...` syntax; fix `eccentricity_mm TEXT` column to `FLOAT`; run a smoke test inserting one full `filecleaner.py` output row into PostgreSQL

5. **CORS misconfiguration blocks Vercel frontend on first deploy** — set `ALLOWED_ORIGINS` on Render to the production Vercel URL only after the frontend is deployed; validate by checking `Access-Control-Allow-Origin` header in DevTools, not just by reviewing config

6. **Render free tier cold starts** — budget for Render Starter tier ($7/month) for a research tool used intermittently; free tier spins down after 15 minutes and takes 30-120 seconds to restart, which researchers will interpret as the app being broken

See `.planning/research/PITFALLS.md` for full recovery strategies and the "Looks Done But Isn't" verification checklist.

---

## Implications for Roadmap

Based on research, the architecture file explicitly defines a build order with hard dependencies. The roadmap should follow this ordering because each phase is a prerequisite for the next.

### Phase 1: Pre-work and Bug Fixes

**Rationale:** Two items block all subsequent work and must be resolved first: the committed credentials are a security emergency requiring immediate rotation; the missing `lib/supabase.ts` means the existing app is already partially broken and will stay broken through migration unless fixed now.
**Delivers:** Clean repository with no committed secrets, working CSV download feature, hardcoded API URL replaced with env var
**Addresses:** Fix hardcoded `localhost:8000` (deployment blocker), fix `lib/supabase.ts` (broken existing feature)
**Avoids:** Committed credentials pitfall, silent CSV download failure pitfall, deployment URL pitfall
**Research flag:** Standard patterns — no phase research needed

### Phase 2: Database Schema and Supabase Connection

**Rationale:** Nothing else in the system can function until the PostgreSQL connection is established and the schema is validated. This must come before any route migration or feature work.
**Delivers:** `cone_data` table created in Supabase with correct column types (notably `eccentricity_mm` as FLOAT, not TEXT), all 4 composite indexes created, asyncpg connection pool wired into FastAPI lifespan, pydantic-settings `Settings` class replacing scattered `os.environ.get()` calls
**Avoids:** SQLite-to-PostgreSQL type mismatch pitfall, asyncpg prepared statement cache pitfall (set `statement_cache_size=0` here)
**Research flag:** Standard patterns — asyncpg pool setup and pydantic-settings are well-documented

### Phase 3: FastAPI Refactor and Route Migration

**Rationale:** Existing read routes work against SQLite; they must be migrated to PostgreSQL before any new features are built on top of them. Restructuring into `app/routes/` also prevents main.py from becoming unmanageable.
**Delivers:** `app/config.py`, `app/database.py`, `app/routes/cones.py`, `app/routes/export.py` — all existing endpoints returning correct data from PostgreSQL; `SELECT ?` replaced with `SELECT $1`; `SELECT *` narrowed to explicit column lists on high-cardinality endpoints
**Avoids:** N+1 query pattern (address bulk endpoint here or in next phase), `SELECT *` performance trap
**Research flag:** Standard patterns — asyncpg raw SQL and FastAPI dependency injection are well-documented

### Phase 4: Ingestion Pipeline

**Rationale:** The admin upload UI depends on this pipeline. The pipeline depends on the database connection (Phase 2/3). The data loaded here also unblocks NC cone display and real meridian filter in feature work.
**Delivers:** `app/ingestion/pipeline.py` wrapping filecleaner.py, `app/routes/admin.py` with `POST /admin/upload` endpoint (HTTPBasic auth, file bytes read before BackgroundTask, structured ingestion result), real cone data loaded into Supabase with NC cones and real meridians
**Avoids:** UploadFile BackgroundTask closure pitfall, fake meridian data pitfall, no file size/type validation security mistake
**Research flag:** The BackgroundTask + file bytes pattern needs careful implementation — see ARCHITECTURE.md Pattern 2 for the exact code

### Phase 5: Admin Upload UI

**Rationale:** Depends on the ingestion pipeline (Phase 4). Self-contained — does not affect main researcher viewer. Can be deployed and tested independently.
**Delivers:** `AdminUpload.tsx` component at `/admin` route — file picker, password input (sent as header, validated server-side), ingestion summary table showing rows ingested and errors per subject
**Avoids:** Admin password in frontend JS mistake, no upload progress UX pitfall, silent upload failure
**Research flag:** Standard patterns — native FormData + fetch; no additional library needed

### Phase 6: Deployment Configuration

**Rationale:** All backend and frontend code must be complete before deployment can be validated. CORS is configured here because the Vercel URL is only known after first deploy.
**Delivers:** `render.yaml` at repo root, `vercel.json` in `retinal-ui/`, all environment variables set on Render and Vercel, CORS validated from production Vercel URL, Render Starter tier (not free) configured
**Avoids:** CORS misconfiguration pitfall, Render cold start pitfall, hardcoded URL pitfall
**Research flag:** Standard patterns — render.yaml and vercel.json formats are documented

### Phase 7: Feature Work — NC Cones, Stats Panel

**Rationale:** These are pure frontend + minor API additions that carry no migration risk. They come after deployment is stable so they can be shipped as a clean feature increment on top of a working production system.
**Delivers:** NC cone type in FilterBar with `#aaaaaa` color, L/M ratio + % S-cones stats panel as a card below FilterBar (new `/stats` endpoint pulling from existing `lm_ratio` and `scones` columns), legend enabled on cone position plots
**Addresses:** NC cone display (P1), L/M ratio stats panel (P1), legend (P2)
**Research flag:** Standard patterns — no phase research needed

### Phase 8: Data Quality and Polish

**Rationale:** Final cleanup after all features are stable. Meridian filter is only meaningful after real data is confirmed loaded; scale bar and fixed-axis toggle are polish items.
**Delivers:** `distribute_meridians.py` removed, meridian filter validated against real data, fixed-scale axis toggle option, scale bar accuracy verified or removed
**Avoids:** Fake meridian data pitfall, scale bar inaccuracy UX pitfall
**Research flag:** Standard patterns — no phase research needed

### Phase Ordering Rationale

- Phases 1-3 are strict prerequisites enforced by architecture dependencies: credentials must be rotated before any commit, DB schema before routes, routes before ingestion
- Phase 4 (ingestion pipeline) must precede Phase 5 (admin UI) because the UI has nothing to call without it
- Phase 6 (deployment) must follow all backend code being complete — CORS cannot be validated until the Vercel URL exists
- Phases 7-8 are intentionally last: they add no migration risk and are the cleanest to ship once the system is deployed and stable

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Ingestion Pipeline):** The UploadFile BackgroundTask pattern has a known version-specific gotcha (FastAPI v0.106.0+). Architecture research has the exact code pattern; roadmapper should include it as a specific task.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Bug fixes only — create a file, change a string constant
- **Phase 2:** asyncpg pool setup is in STACK.md and ARCHITECTURE.md verbatim
- **Phase 3:** FastAPI route structure and dependency injection are well-documented
- **Phase 5:** Native FormData upload is trivial
- **Phase 6:** render.yaml and vercel.json patterns are in STACK.md
- **Phase 7:** Feature additions with no new external dependencies
- **Phase 8:** Data cleanup and UI polish

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against PyPI 2026-03-22; official FastAPI and Supabase docs consulted for all integration patterns |
| Features | MEDIUM | Core patterns from UX literature and scientific visualization conventions; domain-specific norms inferred from codebase analysis and AO research papers; no direct user interviews |
| Architecture | HIGH | Component boundaries and patterns verified against official FastAPI docs; asyncpg + Supabase connection modes confirmed via official Supabase docs; UploadFile BackgroundTask issue confirmed via multiple FastAPI GitHub discussions |
| Pitfalls | HIGH | Most pitfalls verified against official docs or direct codebase inspection; committed credentials confirmed by reading `test_db.py`; missing `lib/supabase.ts` confirmed by directory inspection |

**Overall confidence:** HIGH

### Gaps to Address

- **Meridian filter correctness:** Research confirms that `distribute_meridians.py` assigns fake meridians, but the actual meridian values in the source `Cone_classification_data/` CSV files are not confirmed. Validate during Phase 4 (ingestion) by inspecting real CSV metadata before assuming the filter becomes meaningful.
- **NC cone presence in real data:** NC cones will only appear after real data is ingested via `filecleaner.py`. Verify after Phase 4 that `SELECT DISTINCT cone_spectral_type FROM cone_data` includes "NC" — do not build UI that assumes NC cones are present without confirming data.
- **Render Python version:** STACK.md flags that FastAPI 0.135.1 requires Python >=3.10 and recommends Python 3.11 on Render. Verify the Render service is configured for 3.11 before Phase 2 — a Python 3.8 runtime would break the dependency chain.
- **Supabase free tier connection limit:** The Supabase free tier limits connections to ~15 active connections. With asyncpg `max_size=10` and Gunicorn's 4 workers, peak connection demand is 40 — exceeding the free tier limit. Either use Supabase Pro, reduce `max_size` to 2-3 per worker, or use the transaction pooler (port 6543) which multiplexes connections. Validate during Phase 2.

---

## Sources

### Primary (HIGH confidence)
- [PyPI: asyncpg 0.31.0](https://pypi.org/project/asyncpg/) — version, pool API, statement cache parameters
- [PyPI: pydantic-settings 2.13.1](https://pypi.org/project/pydantic-settings/) — version, BaseSettings usage
- [PyPI: fastapi 0.135.1](https://pypi.org/project/fastapi/) — version, Python requirement
- [Supabase Docs: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — Transaction Mode vs Direct Connection, port 6543 vs 5432
- [FastAPI Docs: Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) — BackgroundTasks pattern
- [FastAPI Docs: HTTP Basic Auth](https://fastapi.tiangolo.com/advanced/security/http-basic-auth/) — `secrets.compare_digest()` pattern
- [FastAPI Docs: CORS](https://fastapi.tiangolo.com/tutorial/cors/) — CORSMiddleware configuration
- [Vercel Docs: Vite](https://vercel.com/docs/frameworks/frontend/vite) — SPA rewrites, VITE_ env vars
- [Supabase GitHub Discussion: Session Mode deprecation](https://github.com/orgs/supabase/discussions/32755) — port 6543 is Transaction Mode only as of Feb 28, 2025
- Codebase inspection: `app/main.py`, `test_db.py`, `setup_db.py`, `retinal-ui/src/api/index.ts`, `retinal-ui/src/components/EccentricitySubPlots.tsx`, `retinal-ui/src/components/FilterBar.tsx`

### Secondary (MEDIUM confidence)
- [PMC 2022: Cone spectral classification](https://pmc.ncbi.nlm.nih.gov/articles/PMC9774847/) — NC cone definition and classification conventions
- [PNAS 2019: Cone photoreceptor classification](https://www.pnas.org/doi/10.1073/pnas.1816360116) — L=red, M=green, S=blue color convention
- [asyncpg + Supabase pooler incompatibility](https://medium.com/@patrickduch93/supabase-pooling-and-asyncpg-dont-mix-here-s-the-real-fix-44f700b05249) — statement cache issue documented
- [Render: FastAPI deployment](https://render.com/articles/fastapi-production-deployment-best-practices) — render.yaml, Gunicorn pattern
- [Render free tier cold start behavior](https://medium.com/@saveriomazza/how-to-keep-your-fastapi-server-active-on-renders-free-tier-93767b70365c) — 15-minute spin-down behavior

### Tertiary (LOW confidence)
- [UX Movement: Segmented buttons vs dropdowns](https://uxmovement.com/buttons/why-segmented-buttons-are-better-filters-than-dropdowns/) — filter UI pattern recommendation
- [ImportCSV: Data import UX](https://www.importcsv.com/blog/data-import-ux) — CSV upload feedback patterns

---

*Research completed: 2026-03-22*
*Ready for roadmap: yes*
