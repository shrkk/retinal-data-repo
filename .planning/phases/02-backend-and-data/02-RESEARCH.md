# Phase 2: Backend and Data — Research

**Researched:** 2026-03-23
**Domain:** FastAPI / asyncpg / PostgreSQL / React Router / TypeScript
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Upload Detection Logic (Backend — BACK-04 Extension)**
- `POST /admin/upload` must detect before inserting whether the uploaded data is "new patient" or "update"
- Update case: if a `(patient_id, eye)` pair already exists in `cone_data` → `event_type = 'update'`
- New patient case: if neither `patient_id` nor `eye` exist for any row → `event_type = 'new_patient'`
- Detection must happen inside the BackgroundTask, after bytes are read and before rows are written
- A `commit_message` field (optional string, max 500 chars) is accepted in the upload form and stored alongside the event

**Upload Log Table (Database)**
New table `upload_log` with:
- `id` (serial or uuid primary key)
- `uploaded_at` TIMESTAMPTZ DEFAULT now()
- `subject_id` TEXT (the patient/subject identifier from the CSV)
- `eye` TEXT
- `event_type` TEXT — 'new_patient' or 'update'
- `commit_message` TEXT NULLABLE
- `rows_ingested` INTEGER
- `uploaded_by` TEXT NULLABLE (store IP or 'admin' for now)

**Upload Form Change (Admin Page)**
The admin upload form gains a **Commit message** text input (optional, single-line `<input type="text">`, placeholder: "Describe this upload…"). Sent as form field alongside the CSV.

**Updates Page (Frontend)**
New standalone page `/updates` — public read-only vertical timeline of all `upload_log` entries, ordered newest-first.
- Timeline card: timestamp (relative + absolute), event type badge (green "New Patient" / amber "Update"), subject ID + eye, rows ingested count, commit message (shown if present)
- Visual: vertical dashed left border, time nodes as small pill chips, white cards with subtle shadow

**Navbar Restructure (Frontend)**
Replace current single-page layout with persistent top navbar:
1. Viewer (main page `/`)
2. Updates (`/updates`)
3. Admin (login button → `/admin`)
Active route highlighted. Use existing routing setup (React state-based), do NOT introduce a new routing library.

**Backend endpoint:** `GET /upload-log` returning all entries sorted by `uploaded_at DESC`

**Table created via SQL migration**, consistent with how Phase 1 created `cone_data` (add to `app/create_schema.py` or a new migration script)

### Claude's Discretion

- Navbar styling (exact colors, fonts) — match existing app design system from `retinal-ui/src/styles/globals.css`
- React Router (or existing routing setup) — use existing state-based routing, do not introduce a new routing library
- Timeline animation (fade-in on scroll) — optional, keep it simple
- Pagination on upload_log — a limit of 100 most recent entries is acceptable for v1
- `GET /upload-log` returns all entries sorted by `uploaded_at DESC`

### Deferred Ideas (OUT OF SCOPE)

- Per-user attribution (currently store 'admin' as uploaded_by placeholder)
- Filtering/search on the Updates page (v2)
- Pagination on the Updates page (v1 cap: 100 entries)
- Undo/rollback from the timeline (out of scope)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-02 | Hardcoded `localhost:8000` URL removed from frontend; API base URL reads from `VITE_API_URL` env var | Already implemented in `retinal-ui/src/api/index.ts` line 5 — verify no other hardcoded URLs remain |
| BACK-03 | Bulk endpoint `GET /subjects/data` returns all subjects' cone data in a single query | New endpoint in `app/main.py`; asyncpg GROUP BY or JSON aggregation pattern |
| BACK-04 | `POST /admin/upload` accepts CSV, runs filecleaner.py via BackgroundTask (bytes-first), returns ingestion summary | Endpoint exists but uses synchronous transaction; needs BackgroundTask refactor + upload_log insert |
| DATA-02 | All 13 subjects from `Cone_classification_data/` ingested into Supabase with real meridian and NC cone data | Run `load_data.py` against live Supabase; verify with SELECT DISTINCT |
| DATA-03 | `distribute_meridians.py` and `update_meridians.py` deleted from repository | Git rm both files |
| DATA-04 | Every admin CSV upload processed through filecleaner.py before data touches the database | `app/csv_parser.py` already is the cleaned version of filecleaner.py — BackgroundTask must use it |
| INFRA-03 | CORS configured with explicit allowed origins from env var, enabling Vercel frontend → Render backend | `app/config.py` already reads `ALLOWED_ORIGINS`; verify CORS middleware is correct and env var is documented |
</phase_requirements>

---

## Summary

Phase 2 is largely mechanical: the hard infrastructure work was done in Phase 1. The asyncpg pool, schema, and routes are already in place in `app/main.py`. The CSV parser (`app/csv_parser.py`) is a clean copy of filecleaner.py's logic and is already wired to `POST /admin/upload`. The ingestion script `load_data.py` already handles all 13 subjects correctly.

The substantive new work in this phase is: (1) refactoring `POST /admin/upload` to use BackgroundTask so the endpoint returns quickly and records the upload event in a new `upload_log` table, (2) adding a `GET /subjects/data` bulk endpoint to eliminate N+1 fetching, (3) running the ingestion pipeline for all 13 CSVs, (4) creating the `upload_log` table, (5) a new `GET /upload-log` backend endpoint, and (6) adding a Navbar + `/updates` timeline page to the frontend using the existing state-based routing pattern (no react-router installed or needed).

**Primary recommendation:** Build in three clean layers — database (migration for upload_log), backend (bulk endpoint + BackgroundTask refactor + upload-log endpoint), frontend (Navbar refactor + Updates page). Ingestion runs as a one-shot Python script at the end.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncpg | already installed | PostgreSQL async driver | Chosen in Phase 1; `statement_cache_size=0` mandatory |
| FastAPI | already installed | API framework | Project standard; BackgroundTasks built-in |
| pydantic-settings | already installed | Config via env vars | Already in `app/config.py` |
| React | 19.1.1 | UI framework | Project standard |
| TypeScript | 5.8.3 | Type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FastAPI BackgroundTasks | built-in | Deferred task execution | For the upload endpoint so HTTP response returns before DB write |
| python-multipart | already installed (FastAPI dep) | Form data + file upload | Already used for `POST /admin/upload` |
| date-fns or native JS | — | Timestamp formatting on Updates page | Use `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat` (no new library needed) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BackgroundTasks (FastAPI built-in) | Celery / ARQ | Overkill; BackgroundTasks runs in same process which is acceptable for this load |
| State-based routing (existing) | react-router-dom | User locked decision: do not introduce new routing library |
| Native JS Intl API | date-fns | date-fns adds a dep; Intl is built into modern browsers and sufficient |

**Installation:** No new dependencies required — everything needed is already in the project.

---

## Architecture Patterns

### Recommended Project Structure (no changes needed)
```
app/
├── config.py         # pydantic-settings — already exists
├── database.py       # asyncpg pool — already exists
├── csv_parser.py     # parse_csv_bytes + to_row — already exists
├── create_schema.py  # schema creation — ADD upload_log table here
└── main.py           # FastAPI routes — ADD /subjects/data, refactor /admin/upload, ADD /upload-log

retinal-ui/src/
├── api/index.ts      # fetch helpers — ADD getUploadLog(), update adminUploadCSV()
├── components/
│   ├── Navbar.tsx    # NEW — top navbar with Viewer/Updates/Admin links
│   ├── UpdatesPage.tsx  # NEW — vertical timeline
│   └── AdminPage.tsx # MODIFY — add commit_message input, wire new upload API shape
└── App.tsx           # MODIFY — add Navbar, add "updates" view to state router
```

### Pattern 1: FastAPI BackgroundTask with bytes-first upload

**What:** Read file bytes synchronously before queuing the background task. This is the mandatory pattern because `UploadFile` is consumed on first read — if you pass the UploadFile object into a BackgroundTask, it will already be closed by the time the task runs.

**When to use:** Every time you need to run a slow operation after an HTTP response has been sent.

```python
# Source: FastAPI official docs — Background Tasks
from fastapi import BackgroundTasks, UploadFile, File, Form
from typing import Optional

@app.post("/admin/upload")
async def admin_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    commit_message: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    _require_admin(authorization)
    content = await file.read()           # bytes read BEFORE task queued
    filename = file.filename or ""
    df = _parse_upload(content, filename) # validate synchronously
    rows = [to_row(r) for _, r in df.iterrows()]

    background_tasks.add_task(
        _ingest_and_log, rows, df, commit_message
    )
    # Return immediately with preview info
    subjects = df["subject_id"].dropna().unique().tolist() if "subject_id" in df.columns else []
    return {"queued": True, "row_count": len(rows), "subjects": subjects}
```

**Anti-pattern:** Passing `file: UploadFile` directly into `background_tasks.add_task()` — the UploadFile stream is consumed before the task executes.

### Pattern 2: Upload detection (new_patient vs update)

**What:** Before inserting rows, query `cone_data` for any `(subject_id, eye)` combination present in the new data. If a match exists → `'update'`, else → `'new_patient'`.

```python
async def _ingest_and_log(rows, df, commit_message, pool):
    # Extract unique (subject_id, eye) pairs from incoming data
    subject_ids = df["subject_id"].dropna().unique().tolist() if "subject_id" in df.columns else []
    eye_vals = df["eye"].dropna().unique().tolist() if "eye" in df.columns else []

    async with pool.acquire() as conn:
        # Detection query
        existing = await conn.fetch(
            "SELECT 1 FROM cone_data WHERE subject_id = ANY($1::text[]) AND eye = ANY($2::text[]) LIMIT 1",
            subject_ids, eye_vals
        )
        event_type = "update" if existing else "new_patient"

        async with conn.transaction():
            await conn.executemany(INSERT_SQL, rows)
            await conn.execute(
                """INSERT INTO upload_log
                   (subject_id, eye, event_type, commit_message, rows_ingested, uploaded_by)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                subject_ids[0] if subject_ids else None,
                eye_vals[0] if eye_vals else None,
                event_type,
                commit_message[:500] if commit_message else None,
                len(rows),
                "admin",
            )
```

### Pattern 3: Bulk endpoint for all subjects

**What:** `GET /subjects/data` returns all subjects' cone data aggregated per subject, or a flat list — depending on what the frontend needs. For the N+1 elimination goal, the key is one SQL query that covers all subjects.

```python
@app.get("/subjects/data")
async def get_subjects_data():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT subject_id, eye, meridian, eccentricity_deg,
                      cone_spectral_type, cone_x_microns, cone_y_microns,
                      lm_ratio, scones
               FROM cone_data
               ORDER BY subject_id, meridian, eccentricity_deg
               LIMIT 500000"""
        )
    return JSONResponse(content=[dict(r) for r in rows])
```

**Note:** The planner should decide the exact shape (flat rows vs. grouped by subject) based on what the frontend consumes. The query itself is straightforward.

### Pattern 4: State-based routing for Updates page (no react-router)

The app currently uses `useState<"main" | "admin">` in `App.tsx` to switch views. Extend the union type to include `"updates"`.

```typescript
// App.tsx — extend existing pattern
const [view, setView] = useState<"main" | "admin" | "updates">("main");

if (view === "admin") return <AdminPage onBack={() => setView("main")} />;
if (view === "updates") return <UpdatesPage onBack={() => setView("main")} />;

return (
  <>
    <Navbar view={view} onNavigate={setView} />
    {/* main content */}
  </>
);
```

Navbar receives `view` and `onNavigate` as props; highlights the active item with a CSS class or inline style matching the existing `var(--foreground)` / `var(--border)` tokens.

### Pattern 5: upload_log SQL migration

Add to `app/create_schema.py` SCHEMA_SQL constant (or a new `app/migrate_upload_log.py`):

```sql
CREATE TABLE IF NOT EXISTS upload_log (
    id             BIGSERIAL PRIMARY KEY,
    uploaded_at    TIMESTAMPTZ DEFAULT now(),
    subject_id     TEXT,
    eye            TEXT,
    event_type     TEXT NOT NULL,
    commit_message TEXT,
    rows_ingested  INTEGER,
    uploaded_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_upload_log_uploaded_at
    ON upload_log (uploaded_at DESC);
```

Run separately from cone_data schema (it's a migration, not initial setup). Consistent with how `create_schema.py` works: `asyncio.run(main())` with a direct asyncpg connection.

### Anti-Patterns to Avoid
- **Passing UploadFile into BackgroundTask:** File stream is consumed before task runs — always read bytes synchronously first.
- **SELECT * on cone_data for bulk endpoint without a LIMIT:** cone_data could have millions of rows; always include a reasonable LIMIT.
- **Introducing react-router:** User explicitly locked this out. Use the existing `useState` view switcher.
- **Inserting to upload_log outside the transaction:** If cone_data INSERT fails but log already committed, you get a ghost log entry. Both inserts must be in the same transaction.
- **Running `load_data.py` without clearing existing data first:** If subjects were partially loaded before, re-running will duplicate rows. Check row counts before running, or use `TRUNCATE cone_data` if starting clean.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV multi-block parsing | Custom re-implementation | `app/csv_parser.py` (already exists) | It handles the AO CSV format with multiple Parameter_Name/Values column blocks; re-implementing will miss edge cases |
| Bulk CSV ingestion | New script | `load_data.py` (already exists) | Already handles all 13 CSVs, `asyncpg.executemany`, proper `to_row` mapping |
| asyncpg connection for migration | Direct `asyncpg.connect` inline | Same pattern as `app/create_schema.py` | Keeps migration style consistent |
| Relative timestamp formatting | Custom time-diff math | `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat` | Browser-native, no new deps, handles all edge cases |

**Key insight:** Most heavy lifting already exists. The phase is about wiring what's there (csv_parser → BackgroundTask), adding the log table, and building the frontend pages using the established state-router pattern.

---

## Common Pitfalls

### Pitfall 1: BackgroundTask receives stale UploadFile
**What goes wrong:** `file.read()` returns empty bytes inside the background task because the UploadFile stream was already exhausted or closed by the time the coroutine runs.
**Why it happens:** FastAPI's UploadFile is backed by a SpooledTemporaryFile; once the request handler coroutine yields or the handler completes, the file may be unavailable.
**How to avoid:** Read all bytes (`content = await file.read()`) synchronously in the endpoint handler, then pass `content: bytes` into the BackgroundTask.
**Warning signs:** Empty `rows` list in the background task, no rows inserted despite a successful response.

### Pitfall 2: upload_log INSERT outside cone_data transaction
**What goes wrong:** cone_data rows are inserted but then an error rolls back the transaction; upload_log already committed → ghost entry showing rows_ingested > 0 but no actual data.
**Why it happens:** Two separate `async with conn.transaction()` blocks.
**How to avoid:** Both INSERTs must be in the same transaction block.

### Pitfall 3: Duplicate ingestion from load_data.py
**What goes wrong:** Running `load_data.py` twice inserts all rows twice; subject list shows duplicate entries.
**Why it happens:** `cone_data` has no UNIQUE constraint on `(subject_id, meridian, eccentricity_deg, cone_x_microns)`.
**How to avoid:** Before running ingestion, check `SELECT COUNT(*) FROM cone_data WHERE subject_id = ANY(...)`. If data already exists, either TRUNCATE first or skip. The plan should include a pre-ingestion check step.

### Pitfall 4: CORS blocking the Updates page
**What goes wrong:** `/upload-log` endpoint returns 200 but browser blocks the response.
**Why it happens:** `ALLOWED_ORIGINS` env var not set on Render; defaults to `http://localhost:5173` only.
**How to avoid:** INFRA-03 explicitly requires CORS from env var. The plan must include verifying `ALLOWED_ORIGINS` includes the Vercel URL. For local dev, localhost:5173 is already covered.

### Pitfall 5: react-router not installed
**What goes wrong:** Attempting to use `<BrowserRouter>` or `useNavigate` fails at build time.
**Why it happens:** `react-router-dom` is NOT in package.json. The app uses `useState` for routing.
**How to avoid:** Do NOT add react-router. Extend the existing `view` state union type in App.tsx. The CONTEXT.md explicitly locks this decision.

### Pitfall 6: commit_message field name collision in multipart form
**What goes wrong:** FastAPI rejects the form because both `file` (UploadFile) and `commit_message` (Form) are declared but the client sends them incorrectly.
**Why it happens:** Mixing `File(...)` and `Form(...)` parameters requires `python-multipart` and the client to use `multipart/form-data` (not JSON body). This is already the case for the existing upload, but adding `commit_message` requires the frontend to append it to FormData.
**How to avoid:** In `adminUploadCSV` in `retinal-ui/src/api/index.ts`, add `formData.append("commit_message", commitMessage)` before calling fetch.

---

## Code Examples

### GET /upload-log endpoint
```python
# Source: FastAPI docs pattern + existing project conventions
@app.get("/upload-log")
async def get_upload_log():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, uploaded_at, subject_id, eye, event_type, "
            "commit_message, rows_ingested, uploaded_by "
            "FROM upload_log ORDER BY uploaded_at DESC LIMIT 100"
        )
    from datetime import datetime
    result = []
    for r in rows:
        row_dict = dict(r)
        for k, v in row_dict.items():
            if isinstance(v, datetime):
                row_dict[k] = v.isoformat()
        result.append(row_dict)
    return JSONResponse(content=result)
```

### Timeline card timestamp formatting (frontend)
```typescript
// Source: MDN Intl API — no new library needed
function formatTimestamp(isoString: string): { relative: string; absolute: string } {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative: string;
  if (diffMins < 1) relative = "just now";
  else if (diffMins < 60) relative = `${diffMins} min ago`;
  else if (diffHours < 24) relative = `${diffHours} hours ago`;
  else relative = `${diffDays} days ago`;

  const absolute = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);

  return { relative, absolute };
}
```

### Extending adminUploadCSV for commit_message
```typescript
// retinal-ui/src/api/index.ts — update existing function signature
export async function adminUploadCSV(
  token: string,
  file: File,
  commitMessage?: string,
): Promise<{ queued: boolean; row_count: number; subjects: string[] }> {
  const formData = new FormData();
  formData.append("file", file);
  if (commitMessage) formData.append("commit_message", commitMessage);
  // ...rest unchanged
}
```

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `cone_data` table in Supabase — 0 rows (13 subjects not yet ingested) | Run `load_data.py` one-shot after schema migration |
| Stored data | `upload_log` table — does not exist yet | SQL migration (create_schema.py extension or new script) |
| Live service config | `ALLOWED_ORIGINS` env var on Render — set to localhost:5173 or unset | Update when Vercel URL known (Phase 4); for Phase 2, localhost covers dev |
| OS-registered state | None | None — no scheduled tasks or registered services |
| Secrets/env vars | `DATABASE_URL`, `ADMIN_PASSWORD`, `ALLOWED_ORIGINS` — already in .env; no new backend vars needed for Phase 2 | None for backend; frontend adds no new env vars |
| Build artifacts | `distribute_meridians.py`, `update_meridians.py` — exist in repo root | `git rm distribute_meridians.py update_meridians.py` |

**BACK-02 status:** `VITE_API_URL` is already used in `retinal-ui/src/api/index.ts` line 5. BACK-02 is functionally complete — the plan should verify no other hardcoded `localhost:8000` or `localhost:8001` remain in frontend source, then mark the requirement done.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQLite + aiosqlite | asyncpg + Supabase PostgreSQL | Phase 1 | All routes are already using asyncpg pool |
| filecleaner.py (standalone script) | `app/csv_parser.py` (importable module) | Phase 1 | BackgroundTask can import parse_csv_bytes directly |
| Single-page state router | Will gain Navbar + 3-view state router | Phase 2 | No new routing library — extend existing useState pattern |

**Items to delete in this phase:**
- `distribute_meridians.py` — generated fake meridians; now superseded by real CSV ingestion
- `update_meridians.py` — same; fake meridian updater

---

## Open Questions

1. **Bulk endpoint shape for GET /subjects/data**
   - What we know: Success criterion says "one HTTP request instead of N per subject"; the frontend currently queries per-eccentricity-range per subject (multiple calls in EccentricitySubPlots)
   - What's unclear: Whether the bulk endpoint should return flat rows (simpler) or pre-grouped JSON (larger response but less frontend work). The frontend currently uses `getEccentricityRanges` then N `getPlotData` calls.
   - Recommendation: Return flat rows grouped by `subject_id` in the response JSON. The planner should decide whether the existing `EccentricitySubPlots` component is refactored to consume bulk data in Phase 2 or if the bulk endpoint is added now but the component is refactored in Phase 3. For Phase 2 alone, adding the endpoint and having it return flat rows satisfies the requirement.

2. **NC cone presence in real data**
   - What we know: STATE.md flags this as unconfirmed — "NC cone presence in real data is unconfirmed"
   - What's unclear: Whether any of the 13 CSVs contain `cone_spectral_type = 'NC'`
   - Recommendation: The plan must include a verification step after ingestion: `SELECT DISTINCT cone_spectral_type FROM cone_data` — document the result. The UI can handle missing NC values gracefully (Phase 3 concern).

3. **upload_log subject_id granularity**
   - What we know: A single CSV can contain multiple subjects (the parser extracts all blocks)
   - What's unclear: The `upload_log` schema has a single `subject_id` TEXT field, but one upload may cover multiple subjects
   - Recommendation: For v1, store the first (or primary) `subject_id` from the uploaded CSV. The CONTEXT.md schema shows a single row per upload. This is acceptable per the locked decision.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | load_data.py ingestion | Yes | 3.14.3 | — |
| Node.js | Frontend build | Yes | 25.5.0 | — |
| asyncpg | Backend DB | Already installed | in requirements | — |
| pandas + numpy | csv_parser.py | Already installed | in requirements | — |
| Supabase PostgreSQL | All DB operations | Yes (Phase 1 complete) | Supabase free tier | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

> `workflow.nyquist_validation` not present in config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no pytest.ini, no tests/ directory, no *.test.* files in project |
| Config file | None |
| Quick run command | N/A — no test infrastructure exists |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-02 | No hardcoded localhost URLs in frontend source | manual grep | `grep -r "localhost:800" retinal-ui/src/` | N/A (grep, not test) |
| BACK-03 | GET /subjects/data returns rows for all subjects | smoke (manual curl) | `curl "$API_BASE/subjects/data" \| python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d), 'rows')"` | ❌ Wave 0 |
| BACK-04 | POST /admin/upload returns quickly, background task inserts rows + log entry | smoke (manual) | Manual: upload CSV, check upload_log via Supabase SQL editor | ❌ Wave 0 |
| DATA-02 | 13 subjects in cone_data with real meridians | smoke SQL | `python3 -c "import asyncio, asyncpg, os; ..."` or Supabase SQL editor | ❌ Wave 0 |
| DATA-03 | distribute_meridians.py and update_meridians.py absent | manual | `ls distribute_meridians.py update_meridians.py 2>&1` | N/A |
| DATA-04 | Upload goes through csv_parser.py | code review | Verify BackgroundTask calls parse_csv_bytes | ❌ Wave 0 |
| INFRA-03 | CORS header present in response | smoke | `curl -H "Origin: http://localhost:5173" -I "$API_BASE/patients"` | N/A |

### Sampling Rate
- **Per task commit:** Manual curl smoke test against local FastAPI
- **Per wave merge:** Full smoke suite against local server + Supabase
- **Phase gate:** All 13 subjects visible in `/patients` response; upload_log table exists and receives entries

### Wave 0 Gaps
- [ ] No automated test infrastructure exists in this project. Given the nature of the app (data ingestion + API), smoke tests via curl and direct DB verification are the practical approach. No pytest files need to be created for Phase 2 unless the planner chooses to add them.

---

## Project Constraints (from CLAUDE.md)

> `CLAUDE.md` does not exist in the working directory. No project-specific directives to enforce. The STATE.md decisions below function as the binding constraints.

**Binding decisions from STATE.md:**
- asyncpg requires `statement_cache_size=0` for Supabase transaction pooler (port 6543) — mandatory in ALL asyncpg connections
- asyncpg pool `max_size=5` to stay within Supabase free tier connection limits
- `settings = Settings()` at module level for fail-fast startup
- FastAPI backend is the home for Python parsing logic — do not move to Supabase Edge Functions

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `app/main.py`, `app/csv_parser.py`, `app/database.py`, `app/config.py`, `app/create_schema.py`, `load_data.py` — current state of all backend code
- Direct code inspection: `retinal-ui/src/App.tsx`, `retinal-ui/src/api/index.ts`, `retinal-ui/src/components/AdminPage.tsx`, `retinal-ui/src/components/FilterBar.tsx` — current state of all frontend code
- `.planning/phases/02-backend-and-data/02-CONTEXT.md` — user decisions
- `.planning/STATE.md` — accumulated decisions from Phase 1

### Secondary (MEDIUM confidence)
- FastAPI BackgroundTasks documentation pattern — bytes-first file reading for background tasks is well-established FastAPI convention
- MDN Intl.RelativeTimeFormat / Intl.DateTimeFormat — browser-native, no external verification needed

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed and verified working in Phase 1
- Architecture: HIGH — patterns are derived directly from existing working code in the repo
- Pitfalls: HIGH — identified from direct code inspection of the BackgroundTask pattern and current AdminPage wiring

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (stable stack; 30-day window)
