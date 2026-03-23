# Pitfalls Research

**Domain:** FastAPI + SQLite → Supabase PostgreSQL migration with Vercel/Render deployment and CSV ingestion pipeline
**Researched:** 2026-03-22
**Confidence:** HIGH (most pitfalls verified against official docs or multiple sources; codebase-specific ones verified by direct code inspection)

---

## Critical Pitfalls

### Pitfall 1: asyncpg Prepared Statement Cache Breaks on Supabase Transaction Pooler

**What goes wrong:**
The existing `test_db.py` connects directly to the Supabase PostgreSQL endpoint. When the production app moves to use Supabase's transaction pooler (port 6543, which PgBouncer/Supavisor runs on), asyncpg's default behavior of caching prepared statements breaks. Every query after the first throws a `prepared statement "..." already exists` error or silent failures, depending on asyncpg version.

**Why it happens:**
Transaction mode pooling reuses connections across different clients. Prepared statements are session-scoped in PostgreSQL — a statement prepared in session A is not valid in session B. When PgBouncer hands your connection to a new server session mid-flight, asyncpg's internal statement cache references stale prepared statements. This is a documented incompatibility specific to the Supabase transaction pooler, not a general asyncpg issue.

**How to avoid:**
- Connect via the **direct connection string** (port 5432) for the Render-hosted FastAPI backend. The direct connection is appropriate for a persistent server (not serverless), and avoids PgBouncer entirely.
- If you do use the transaction pooler (port 6543), disable asyncpg's statement cache by passing `statement_cache_size=0` in the connection arguments.
- Never use a hardcoded port 5432 connection string from `test_db.py` and assume it will work at scale — validate the specific pooler mode early.

**Warning signs:**
- `asyncpg.exceptions.InvalidSQLStatementNameError` in backend logs
- Queries succeed locally but fail intermittently under concurrent load
- Connection string in environment uses port 6543 but code does not disable statement cache

**Phase to address:**
Database migration phase — must resolve before any PostgreSQL queries are written.

---

### Pitfall 2: Hardcoded Supabase Credentials Already Committed to Git

**What goes wrong:**
`test_db.py` line 4 contains a live PostgreSQL connection string with password in plaintext: `postgresql://postgres.ytglrmyvdzhidwcutrtn:REDACTED_PASSWORD@aws-1-us-east-2.pooler.supabase.com:5432/postgres`. This is currently in the git history. The password is now compromised regardless of whether the file is deleted — git history preserves it.

**Why it happens:**
Test scripts are written quickly and not treated as production code. Developers use literal strings to get something working and forget to parameterize before committing.

**How to avoid:**
1. Rotate the Supabase database password immediately before any further work. The credentials are publicly visible in the repository.
2. Add `test_db.py` to `.gitignore`, or replace the hardcoded string with `os.environ.get("DATABASE_URL")` before any new commits.
3. Use `git filter-repo` or BFG Repo-Cleaner to purge the credentials from git history if the repo is or will become public.
4. Set up a `.env` file with `DATABASE_URL` and never commit it. Add `.env` to `.gitignore`.

**Warning signs:**
- Any file with a literal `postgresql://...` containing a password
- CI/CD failing because environment variables are not set (sign that someone is trying to use `os.environ` but hasn't configured it)

**Phase to address:**
First phase of work — do not proceed with any deployment until credentials are rotated and the commit is cleaned.

---

### Pitfall 3: SQLite-Specific Query Syntax Silently Breaks on PostgreSQL

**What goes wrong:**
`app/main.py` uses `?` as the SQL parameter placeholder throughout (e.g., `"subject_id = ?"`). PostgreSQL requires `$1`, `$2`, etc. Additionally, `ORDER BY cone_x_microns NULLS LAST` works in both dialects but `SELECT *` with dynamic column enumeration from `aiosqlite.Row` relies on SQLite's flexible typing — PostgreSQL columns have strict types and `NULL` coercion behavior differs.

The specific issue in `setup_db.py`: `eccentricity_mm` is defined as `TEXT` in SQLite but stored as a float in filecleaner.py. PostgreSQL will enforce the column type strictly, so any mixed-type values that SQLite silently accepts will cause insert failures.

**Why it happens:**
SQLite and PostgreSQL share SQL syntax at the surface but diverge on placeholder syntax, type strictness, and NULL ordering defaults. Developers test locally on SQLite then deploy to PostgreSQL expecting identical behavior.

**How to avoid:**
- Replace `aiosqlite` with `asyncpg` or `databases` (with asyncpg driver). Asyncpg uses `$1`-style placeholders.
- Alternatively, use SQLAlchemy Core with async support — it abstracts placeholder differences.
- Audit every column type in `setup_db.py` against actual data from `filecleaner.py`. Fix `eccentricity_mm` to be `REAL/FLOAT` not `TEXT`.
- Run a migration smoke test: insert one full filecleaner.py output row into the PostgreSQL schema and verify no type coercion errors.

**Warning signs:**
- `asyncpg.exceptions.PostgresSyntaxError` referencing `?` in query string
- Insert failures on `eccentricity_mm` or any column defined as TEXT that receives float values
- Rows returning `NULL` where SQLite returned `0` (NULL coercion differences)

**Phase to address:**
Database migration phase — the schema must be validated against PostgreSQL types before any data is loaded.

---

### Pitfall 4: N+1 Query Pattern Survives the Migration and Worsens Under PostgreSQL Network Latency

**What goes wrong:**
`EccentricitySubPlots.tsx` fetches eccentricity ranges first, then fires one `getPlotData` + one `getMetadata` API call per range in a `Promise.all`. If a subject has 6 eccentricity ranges, that is 13 HTTP requests (1 + 6×2) per component render. Over a Vercel → Render → Supabase chain, each request incurs network round-trip overhead. At 50–100ms per round trip across three hops, a single view loads in 650–1300ms minimum — before query execution time.

**Why it happens:**
The component fetches data lazily per sub-plot, which seemed reasonable in SQLite localhost mode (sub-millisecond queries, no network). Production deployment introduces network hops that magnify the N+1 cost.

**How to avoid:**
- Add a single `/plot-data/bulk` endpoint that accepts a `subject_id` + `meridian` and returns all eccentricity ranges with their cone data in one response.
- OR make `EccentricitySubPlots` fetch all data with `eccentricity_min/max` absent (i.e., the full range), then slice client-side by eccentricity.
- Add a PostgreSQL index on `(subject_id, meridian, eccentricity_deg)` — without this, each of those 12 filtered queries does a full table scan.

**Warning signs:**
- Network tab in browser DevTools showing 10+ parallel requests on a single subject selection
- Render backend logs showing rapid sequential queries with identical `subject_id` parameters
- UI appears to "load" correctly but hangs for 2–5 seconds before displaying data

**Phase to address:**
Query optimization phase (can be deferred past initial migration but should be addressed before any user-facing deployment).

---

### Pitfall 5: Render Free Tier Cold Starts Break the User Experience

**What goes wrong:**
Render's free tier spins down services after 15 minutes of inactivity. The first request after inactivity takes 30 seconds to 2+ minutes to respond as the container restarts. For a research tool used intermittently, researchers will encounter this on nearly every session start. The frontend has no timeout handling — `fetch()` calls in `api/index.ts` have no timeout configured and will hang until the browser's default timeout (~2 minutes).

**Why it happens:**
Free tier cost optimization is appropriate for a development phase, but the behavior is not obvious until the app is deployed and used by non-developers who do not know to "wait for the server to wake up."

**How to avoid:**
- Budget for Render's paid Starter tier ($7/month) which does not spin down. This is the correct choice for a research tool.
- If free tier is used during development, add a health-check ping route (`/health`) and document the cold-start behavior for researchers.
- Add an explicit timeout and retry with backoff in `api/index.ts` so the UI shows "Server is waking up, please wait..." rather than a silent hang.

**Warning signs:**
- First API request of the day takes > 30 seconds in browser DevTools
- Researchers reporting "the app is broken" intermittently
- Render dashboard showing service status cycling between "Suspended" and "Running"

**Phase to address:**
Deployment configuration phase — decide on free vs. paid tier before launching to researchers.

---

### Pitfall 6: CORS Misconfiguration Blocks the Vercel Frontend

**What goes wrong:**
`app/main.py` currently hardcodes `allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"]` plus anything in `ALLOWED_ORIGINS` env variable. The Vercel deployment URL is not known until after the first deploy, and Vercel also creates unique preview URLs for each branch deployment (`https://retinal-data-repo-git-main-xyz.vercel.app`). If `ALLOWED_ORIGINS` is not set correctly on Render before the first test, every API call from Vercel will be CORS-blocked with no useful error in the frontend.

**Why it happens:**
CORS is configured on the backend but the production frontend URL is only known after frontend deployment. The sequence matters: deploy frontend first, copy the URL, then update backend environment variable.

**How to avoid:**
- Set `ALLOWED_ORIGINS` on Render to include both the stable Vercel production URL AND a wildcard for preview URLs. In practice: set it to the production URL `https://your-app.vercel.app` explicitly.
- During development, temporarily set `ALLOWED_ORIGINS=*` on Render only — never ship wildcard CORS to production. Production must have the explicit Vercel URL.
- Validate CORS by checking the `Access-Control-Allow-Origin` response header in DevTools Network tab immediately after deployment.

**Warning signs:**
- Browser console shows `CORS policy: No 'Access-Control-Allow-Origin' header`
- API calls return `net::ERR_FAILED` with status 0 in the Network tab
- Backend logs show requests arriving but no CORS header in response

**Phase to address:**
Deployment configuration phase — validate this as the first step after deploying both frontend and backend.

---

### Pitfall 7: CSV Download Broken Due to Missing `lib/supabase.ts` Module

**What goes wrong:**
`api/index.ts` line 98 does a dynamic import: `await import('../lib/supabase')`. The file `retinal-ui/src/lib/supabase.ts` does not exist. At runtime, any click of "Download CSV" triggers a module import failure that is caught silently and shown only as `alert("Download failed: ...")`. There is no build-time error because the import is dynamic — TypeScript does not check dynamic import paths by default.

**Why it happens:**
The download function was written to use Supabase Storage but the supporting module was never created. The missing file was noted in the milestone context but the symptom (silent runtime failure, not build failure) makes it easy to miss.

**How to avoid:**
- Create `retinal-ui/src/lib/supabase.ts` with a proper Supabase client initialization using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Enable `moduleResolution: bundler` and `noUncheckedIndexedAccess` in `tsconfig.json` — some strict TS configs do catch broken dynamic imports.
- Smoke test the download button before declaring any phase complete.

**Warning signs:**
- Browser console shows `Error: Failed to fetch dynamically imported module`
- Alert box appearing on CSV download click with "Download failed: Cannot find module"
- No `lib/` directory under `retinal-ui/src/`

**Phase to address:**
Bug fixes phase — this is a known broken feature that must be fixed before migration work begins, to avoid deploying a broken UI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `SELECT *` in all queries | No need to enumerate columns | Any schema change adds columns to API response silently; breaks typed responses | Never in production; enumerate columns explicitly |
| Single `aiosqlite` connection per request | Simple, no connection pool to manage | Each request opens/closes a DB connection; under PostgreSQL this is expensive (connection setup ~5ms) | Only for SQLite dev mode |
| `eccentricity_mm TEXT` column | SQLite doesn't enforce types | Insert failures when PostgreSQL enforces TEXT for float data | Never — fix before migration |
| Admin password in env var with no rate limiting | Simple to implement | Brute-force attack on the admin upload endpoint is trivial | Only if the admin endpoint is not publicly reachable (e.g., IP-restricted) |
| `distribute_meridians.py` fake data | Allowed demo to work | Research results are scientifically invalid; real data shows different distributions | Never — must be removed before any researcher uses the tool |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Storage | Creating a public bucket for raw CSVs | Use a private bucket — raw CSVs contain subject data. Use signed URLs with short TTLs for download links |
| Supabase Storage | Naming files by `subject_id` directly from user input | Sanitize filenames; `subject_id` values from CSV metadata may contain slashes or spaces that break storage paths |
| Render + FastAPI | Using `uvicorn app.main:app --reload` in production | Use `uvicorn app.main:app --host 0.0.0.0 --port $PORT` without `--reload`; reload mode is a security and performance risk in production |
| Vercel + FastAPI | Deploying FastAPI on Vercel | Do not deploy FastAPI to Vercel — Vercel Serverless Functions have a 10-second execution limit and no persistent state. FastAPI belongs on Render/Railway. Vercel hosts only the React frontend. |
| asyncpg + Supabase | Using port 6543 (transaction pooler) without disabling statement cache | Use port 5432 for a persistent Render server, OR disable `statement_cache_size=0` on asyncpg if using port 6543 |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `(subject_id, meridian)` | Queries for a single subject scan the entire `cone_data` table | Add composite index `CREATE INDEX idx_cone_subject_meridian ON cone_data(subject_id, meridian)` during migration | With 13 subjects × ~1000 cones per eccentricity range, total rows ~50k–200k; query time goes from <1ms to 200ms+ without index |
| Fetching 50,000 cone rows per API call | Individual requests are slow; JSON serialization is the bottleneck | Add `limit` capping (already present at 50,000) but also add client-side sampling for overview plots | At full data density for 13 subjects, total rows may exceed 500k; the 50k limit prevents the worst case but should be validated |
| `SELECT *` returning Zernike/metadata columns for every cone row | 20+ columns transferred for each of 50k rows when the frontend only uses 3 (x, y, cone_type) | `/plot-data` endpoint already selects only 3 columns — ensure this pattern is preserved when migrating to asyncpg | The `/cones` endpoint uses `SELECT *`; if this is ever called for full datasets, it will transfer 20x more data than needed |
| Promise.all N+1 on EccentricitySubPlots | 10–15 simultaneous API calls per subject view | Consolidate into a single bulk endpoint | With 6+ eccentricity ranges, browser connection limits throttle the parallel requests |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Committed Supabase password in `test_db.py` | Live database accessible to anyone who reads the repo | Rotate password immediately; use `os.environ.get("DATABASE_URL")` everywhere; add to `.gitignore` |
| No file size limit on admin CSV upload | A 1GB CSV upload exhausts Render memory and causes OOM kill | Add `Content-Length` check in FastAPI before reading file; reject files > 50MB |
| No content-type validation on admin upload | Attacker uploads a `.py` or `.sh` file as a CSV; filecleaner.py's `pd.read_csv()` fails with a confusing error | Check `file.content_type == "text/csv"` AND check first bytes of file content (magic bytes); reject non-CSV |
| Storing raw CSVs in a public Supabase Storage bucket | Subject-level retinal imaging data is sensitive research data; public bucket means anyone with the URL can download | Default to private bucket; require signed URLs for frontend downloads |
| Admin password checked in frontend JavaScript | Password appears in JS bundle | Admin authentication must happen server-side in FastAPI; frontend sends password to `/admin/upload` endpoint which validates against `ADMIN_PASSWORD` env var |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` in frontend .env | Service role key bypasses Row Level Security; entire database can be read/written | Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in frontend. Service role key is backend-only. Never prefix it with `VITE_`. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No upload progress indicator on admin CSV ingestion | Researcher uploads 5MB CSV and sees nothing for 30 seconds; assumes it failed and re-uploads | Show a progress bar or "Processing..." state; disable the upload button during ingestion |
| Silent CSV download failure (alert dialog) | Researcher doesn't know whether to retry or report a bug | Replace `alert()` with an inline error message near the download button with actionable text |
| Scale bar always shows "100 μm" regardless of zoom | Researchers rely on scale bars for measurements; a fixed-label bar is scientifically misleading if it doesn't correspond to actual pixel dimensions | Compute scale bar length based on plot axis range vs pixel dimensions, or remove the scale bar overlay and rely on Plotly's built-in axis ticks |
| Render cold start with no feedback | First load of the day shows a spinning indicator for 60+ seconds | Add a backend health-check with a visible "Connecting to server..." state in the frontend |

---

## "Looks Done But Isn't" Checklist

- [ ] **Database migration:** Verify `eccentricity_mm` is stored and queried as `FLOAT` not `TEXT` in PostgreSQL — SQLite silently accepts mixed types.
- [ ] **CORS:** After deploying to Vercel, actually make an API call from the Vercel URL in a browser. Browser console showing 200s is the only real test — checking the backend config is not sufficient.
- [ ] **CSV download:** After creating `lib/supabase.ts`, test downloading a file that actually exists in the Supabase Storage bucket — the Supabase bucket name `raw-csvs` must exist with the expected file naming convention.
- [ ] **Admin password gate:** Verify the admin route returns 401 when the wrong password is sent via curl — do not trust the UI to enforce auth.
- [ ] **Fake meridians removed:** After removing `distribute_meridians.py`, verify that `SELECT DISTINCT meridian FROM cone_data` for any subject returns real values from filecleaner.py, not the fake Temporal/Nasal/Superior/Inferior distribution.
- [ ] **Indexes created:** After running migrations, run `EXPLAIN ANALYZE SELECT ... FROM cone_data WHERE subject_id = 'AO001' AND meridian = 'Temporal'` and confirm the query plan uses the index, not a sequential scan.
- [ ] **No credentials in git:** Run `git log --all --full-history -- test_db.py` and verify the plaintext password has been purged from history before making the repository visible to anyone.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| asyncpg prepared statement failures in production | MEDIUM | Switch connection string to port 5432 (direct), or add `statement_cache_size=0` to asyncpg connect args and redeploy |
| Committed credentials compromised | HIGH | Rotate Supabase DB password immediately via dashboard; audit Supabase logs for unauthorized access; purge git history with `git filter-repo` |
| Schema type mismatch causes insert failures during ingestion | MEDIUM | Add `ALTER COLUMN eccentricity_mm TYPE FLOAT USING eccentricity_mm::float` migration; re-run ingestion |
| CORS blocks all frontend requests | LOW | Update `ALLOWED_ORIGINS` env var on Render with correct Vercel URL; redeploy or restart service |
| Render cold start kills UX | LOW | Upgrade to Render Starter tier ($7/mo); no code change required |
| Supabase storage bucket is public with sensitive data | HIGH | Change bucket to private in Supabase dashboard immediately; update frontend to use signed URLs |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| asyncpg prepared statement cache | Database migration phase | Run `asyncpg.connect()` against Supabase with a burst of 10 concurrent queries; all must succeed |
| Hardcoded credentials in git | Pre-work (before any phase starts) | `git log -p -- test_db.py` shows no password; `python test_db.py` fails without `DATABASE_URL` env var |
| SQLite query syntax incompatibility | Database migration phase | All existing endpoints return correct data from PostgreSQL in integration tests |
| N+1 query pattern | Query optimization phase | Network tab shows ≤ 3 API calls per subject selection |
| Render cold starts | Deployment configuration phase | First API call after 20 minutes idle responds in < 5 seconds |
| CORS misconfiguration | Deployment configuration phase | API calls succeed from Vercel production URL in Chrome DevTools |
| Missing `lib/supabase.ts` | Bug fixes phase | CSV download button downloads a real file without errors |
| No file size/type limits on upload | Admin UI phase | Sending a 100MB file to `/admin/upload` returns HTTP 413 |
| Fake meridian data | Data ingestion phase | `SELECT DISTINCT meridian FROM cone_data` returns only values from real CSV metadata |
| Scale bar inaccuracy | UI polish phase | Verify scale bar label matches a known measurement against cone spacing data |

---

## Sources

- Supabase connection modes documentation (direct vs. pooler, prepared statements): https://supabase.com/docs/guides/database/connecting-to-postgres
- asyncpg + Supabase transaction pooler incompatibility: https://medium.com/@patrickduch93/supabase-pooling-and-asyncpg-dont-mix-here-s-the-real-fix-44f700b05249
- asyncpg burst request failures on Supabase poolers (GitHub issue): https://github.com/supabase/supabase/issues/39227
- Supabase connection scaling for FastAPI: https://dev.to/papansarkar101/supabase-connection-scaling-the-essential-guide-for-fastapi-developers-348o
- FastAPI CORS middleware (official): https://fastapi.tiangolo.com/tutorial/cors/
- Render free tier cold start behavior: https://medium.com/@saveriomazza/how-to-keep-your-fastapi-server-active-on-renders-free-tier-93767b70365c
- FastAPI file upload security (size limits, MIME validation): https://blog.greeden.me/en/2026/03/03/implementing-secure-file-uploads-in-fastapi-practical-patterns-for-uploadfile-size-limits-virus-scanning-s3-compatible-storage-and-presigned-urls/
- Supabase anon key vs service role key security: https://supabase.com/docs/guides/api/api-keys
- Supabase storage access control (public vs private buckets): https://supabase.com/docs/guides/storage/security/access-control
- 11% of vibe-coded apps leak Supabase keys (HN discussion): https://news.ycombinator.com/item?id=46662304
- SQLite vs PostgreSQL NULL ordering and type strictness: https://evertpot.com/writing-sql-for-postgres-mysql-sqlite/
- FastAPI + SQLAlchemy + PostgreSQL migration guide: https://blog.greeden.me/en/2025/08/12/no-fail-guide-getting-started-with-database-migrations-fastapi-x-sqlalchemy-x-alembic/
- Codebase inspection: `/Users/shrey/uwoph-retinal-viewer/retinal-data-repo/app/main.py`, `test_db.py`, `setup_db.py`, `retinal-ui/src/api/index.ts`, `retinal-ui/src/components/EccentricitySubPlots.tsx`

---
*Pitfalls research for: FastAPI + SQLite → Supabase PostgreSQL migration, Vercel/Render deployment, CSV ingestion pipeline*
*Researched: 2026-03-22*
