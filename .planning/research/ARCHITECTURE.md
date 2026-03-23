# Architecture Research

**Domain:** Research data viewer — FastAPI + Supabase PostgreSQL + Vercel/Render deployment with admin CSV ingestion pipeline
**Researched:** 2026-03-22
**Confidence:** HIGH (component boundaries, patterns); MEDIUM (ingestion pipeline specifics); HIGH (database connection strategy)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER (Researcher)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  React 19 + Vite (Vercel CDN)                           │    │
│  │  FilterBar | EccentricitySubPlots | AdminUpload          │    │
│  └────────────────┬────────────────────────────────────────┘    │
│                   │ HTTPS REST (VITE_API_URL)                    │
└───────────────────┼─────────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────────┐
│                 FastAPI Backend (Render/Railway)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Read Routes  │  │ Admin Routes │  │  BackgroundTasks      │  │
│  │ /patients    │  │ POST /admin/ │  │  run_ingestion(bytes) │  │
│  │ /cones       │  │  upload      │  │  → filecleaner.py     │  │
│  │ /plot-data   │  │ (ADMIN_PW)   │  │  → INSERT cone_data   │  │
│  │ /metadata    │  └──────────────┘  └──────────────────────┘  │
│  │ /cones/export│                                               │
│  └──────────────┘                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  asyncpg connection pool (via DATABASE_URL)              │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────────────┘
                    │ PostgreSQL wire protocol (port 5432 direct
                    │ or port 6543 transaction pooler)
┌───────────────────▼─────────────────────────────────────────────┐
│                 Supabase                                          │
│  ┌──────────────────────────┐  ┌──────────────────────────┐     │
│  │  PostgreSQL (cone_data   │  │  Storage bucket           │     │
│  │  table)                  │  │  raw-csvs/                │     │
│  └──────────────────────────┘  └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

**Key constraint:** The Python ingestion logic (filecleaner.py) lives in the FastAPI process — not in the browser, not in Supabase Edge Functions. This is the right call: the multi-block AO CSV parsing is complex pandas/numpy code that would be high risk to rewrite.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React frontend (Vercel) | Visualization, filter UI, admin upload form | React 19, Vite, Plotly.js, fetch() against VITE_API_URL |
| FastAPI backend (Render/Railway) | REST API, CSV ingestion trigger, CORS, auth gate | app/main.py + app/admin.py, uvicorn, asyncpg |
| filecleaner.py | Parse multi-block AO CSV → tidy cone rows | Standalone Python function called synchronously by the ingestion background task |
| Supabase PostgreSQL | Persistent storage of cone_data rows | Single `cone_data` table with composite indexes |
| Supabase Storage | Hold raw uploaded CSV files | `raw-csvs` bucket; direct download by frontend for researcher export |
| BackgroundTasks (FastAPI built-in) | Run ingestion after upload response is sent | Read UploadFile bytes into io.BytesIO before adding task (see pitfall below) |

## Recommended Project Structure

```
retinal-data-repo/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app factory, CORS, route mounts
│   ├── config.py             # pydantic-settings Settings class (reads env vars)
│   ├── database.py           # asyncpg pool creation, get_db() dependency
│   ├── models.py             # Pydantic response schemas
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── cones.py          # /patients, /cones, /plot-data, /metadata, /eccentricity-ranges
│   │   ├── export.py         # /cones/export (streaming CSV)
│   │   └── admin.py          # POST /admin/upload — password-gated ingestion trigger
│   └── ingestion/
│       ├── __init__.py
│       ├── pipeline.py       # Orchestrates: filecleaner → upsert rows
│       └── filecleaner.py    # Existing parser (moved here, unchanged)
├── retinal-ui/
│   ├── src/
│   │   ├── api/
│   │   │   └── index.ts      # All fetch calls; reads VITE_API_URL
│   │   ├── components/
│   │   │   ├── FilterBar.tsx
│   │   │   ├── EccentricitySubPlots.tsx
│   │   │   └── AdminUpload.tsx   # NEW — password + file input
│   │   ├── lib/
│   │   │   └── supabase.ts   # CREATE THIS — supabase-js client for Storage
│   │   └── types/
│   │       └── index.ts
│   ├── .env.local            # VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│   └── vite.config.ts
├── .env                      # DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS
├── requirements.txt
└── render.yaml / railway.toml
```

### Structure Rationale

- **app/routes/:** Separate modules prevent main.py from becoming a monolith; read routes vs admin routes have different auth requirements
- **app/ingestion/:** Isolating filecleaner.py here makes the parsing logic testable without running the full web server
- **app/config.py:** pydantic-settings reads env vars automatically with type coercion — eliminates ad-hoc `os.environ.get()` calls scattered through main.py
- **app/database.py:** Centralizes asyncpg pool; prevents per-request connection open/close (the current aiosqlite pattern)

## Architectural Patterns

### Pattern 1: asyncpg with application-side connection pool

**What:** Create an asyncpg connection pool on startup, inject it via FastAPI dependency, never create per-request connections.
**When to use:** Always — it is the correct pattern for FastAPI + PostgreSQL.
**Trade-offs:** More upfront setup than the current aiosqlite pattern, but eliminates per-request TCP handshake overhead and avoids blocking the event loop.

**Example:**
```python
# app/database.py
import asyncpg
from fastapi import FastAPI
from app.config import settings

pool: asyncpg.Pool | None = None

async def create_pool():
    global pool
    pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)

async def close_pool():
    if pool:
        await pool.close()

def get_pool() -> asyncpg.Pool:
    return pool

# app/main.py
from contextlib import asynccontextmanager
from app.database import create_pool, close_pool

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_pool()
    yield
    await close_pool()

app = FastAPI(lifespan=lifespan)
```

**Connection string choice:** Use the Supabase Transaction Pooler (port 6543) for Render deployments — it handles multiple concurrent connections from a single-instance server better than holding open direct connections. Direct connection (port 5432) is fine for local dev. Set this via DATABASE_URL env var.

### Pattern 2: Read UploadFile bytes before adding BackgroundTask

**What:** Since FastAPI v0.106.0, `UploadFile` is closed before background tasks run. The fix is to read all bytes into memory synchronously within the endpoint, then pass `io.BytesIO` to the background function.
**When to use:** Every file upload that triggers background processing.
**Trade-offs:** Whole CSV file lives in memory during processing; acceptable for the expected file sizes (AO CSV files are typically <10 MB each).

**Example:**
```python
# app/routes/admin.py
import io
from fastapi import APIRouter, UploadFile, BackgroundTasks, Header, HTTPException
from app.ingestion.pipeline import run_ingestion

router = APIRouter(prefix="/admin")

@router.post("/upload")
async def upload_csv(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    x_admin_password: str = Header(...),
):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Read NOW — before FastAPI closes the file
    file_bytes = await file.read()
    file_buffer = io.BytesIO(file_bytes)
    filename = file.filename or "upload.csv"

    background_tasks.add_task(run_ingestion, file_buffer, filename)
    return {"status": "accepted", "message": f"Processing {filename} in background"}
```

### Pattern 3: Environment-based CORS configuration

**What:** ALLOWED_ORIGINS env var is a comma-separated list; FastAPI reads it and applies specific origins rather than wildcards.
**When to use:** Always in production — `allow_origins=["*"]` with `allow_credentials=True` is rejected by browsers.
**Trade-offs:** Requires explicitly adding each Vercel preview URL or using a wildcard for the subdomain, but more secure.

**Example:**
```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    admin_password: str
    allowed_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"

# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**ALLOWED_ORIGINS on Render:** Set to `https://your-app.vercel.app` (and the custom domain if any). On Vercel, set `VITE_API_URL` to the Render/Railway backend URL.

### Pattern 4: supabase-py only for Storage, asyncpg for database queries

**What:** Use the `supabase-py` Python client only for Supabase Storage operations (uploading raw CSVs to the `raw-csvs` bucket). Use asyncpg directly for all `cone_data` table operations.
**When to use:** This project's architecture — the ingestion pipeline needs direct SQL control (bulk inserts, upserts, transactions) that supabase-py's query builder makes awkward.
**Trade-offs:** Two clients, but cleanly separated concerns. supabase-py is not needed in the backend at all if Storage upload is done from the frontend directly (see Data Flow section).

## Data Flow

### Request Flow: Researcher Views Plot

```
Researcher selects subject + meridian + cone types
    ↓
FilterBar → setFilters(state) → EccentricitySubPlots re-renders
    ↓
getEccentricityRanges(subjectId, meridian)
    ↓ GET /eccentricity-ranges?subject_id=...&meridian=...
FastAPI → asyncpg pool → SELECT DISTINCT eccentricity_deg FROM cone_data WHERE ...
    ↓ [{min, max, label}, ...]
For each eccentricity range (parallel Promise.all):
    getPlotData({subjectId, meridian, coneTypes, eccentricityMin, eccentricityMax})
    getMetadata(subjectId, meridian, ...)
    ↓ GET /plot-data + GET /metadata
FastAPI → asyncpg → SELECT cone_x_microns, cone_y_microns, cone_spectral_type ...
    ↓ {x: [...], y: [...], cone_type: [...]}
Plotly.js renders scatter subplots
```

**Critical fix needed:** The current `EccentricitySubPlots` makes one API call per eccentricity range (N+1). Replace with a single `/plot-data` call returning all ranges, let frontend split by eccentricity client-side, or add a `/plot-data/by-subject` endpoint that returns all eccentricities at once.

### Data Flow: Admin CSV Ingestion Pipeline

```
Admin opens /admin page
    ↓
AdminUpload component: password input + file picker
    ↓
POST /admin/upload
  Headers: X-Admin-Password: {ADMIN_PASSWORD}
  Body: multipart/form-data with CSV file
    ↓
FastAPI admin route:
  1. Validate X-Admin-Password header == settings.admin_password
  2. file_bytes = await file.read()   ← MUST happen before background_tasks.add_task
  3. background_tasks.add_task(run_ingestion, io.BytesIO(file_bytes), filename)
  4. Return 202 {"status": "accepted"}
    ↓ (in background, after response sent)
run_ingestion(file_buffer, filename):
  1. df = filecleaner.parse(file_buffer)  ← existing logic, returns tidy DataFrame
  2. Validate required columns present
  3. async with pool.acquire() as conn:
       await conn.executemany(
           "INSERT INTO cone_data (...) VALUES (...) ON CONFLICT DO NOTHING",
           df.to_records()
       )
  4. (Optional) Upload original CSV to Supabase Storage raw-csvs/{filename}
    ↓
Researcher data immediately visible in viewer
```

**Note on Storage upload:** The raw CSV upload to Supabase Storage (`raw-csvs` bucket) can be done from either the backend (using supabase-py) or from the frontend (using supabase-js, uploading before hitting the API). Doing it from the frontend reduces backend load and avoids storing large files in the FastAPI process. Either works; choose based on whether file storage needs to be gated behind the admin password.

### State Management (Frontend)

```
App-level useState: filters (subjectId, meridian, coneTypes)
    ↓ passed as props to EccentricitySubPlots
EccentricitySubPlots: local state per subplot (data, loading, error)
    ↓
No global state manager needed — prop-drilling is fine at this scale
```

## Database Schema

The existing `cone_data` table structure in SQLite maps directly to PostgreSQL. The key schema decisions:

```sql
CREATE TABLE cone_data (
    id                  BIGSERIAL PRIMARY KEY,
    -- Core cone data (per-row, high cardinality)
    cone_x_microns      FLOAT,
    cone_y_microns      FLOAT,
    cone_spectral_type  VARCHAR(4),   -- 'L', 'M', 'S', 'NC'
    -- Subject/session identifiers
    subject_id          VARCHAR(32)   NOT NULL,
    eye                 VARCHAR(4),   -- 'OD', 'OS'
    meridian            VARCHAR(16),  -- 'Temporal', 'Nasal', 'Superior', 'Inferior'
    eccentricity_deg    FLOAT,
    eccentricity_mm     FLOAT,
    -- Derived statistics (denormalized per-row from filecleaner.py output)
    lm_ratio            FLOAT,
    scones              FLOAT,
    lcone_density       FLOAT,
    mcone_density       FLOAT,
    scone_density       FLOAT,
    numcones            INTEGER,
    nonclass_cones      INTEGER,
    age                 FLOAT,
    fov                 VARCHAR(64),
    -- Metadata
    ret_mag_factor      FLOAT,
    cone_origin         VARCHAR(32),
    zernike_pupil_diam  FLOAT,
    zernike_measure_wave FLOAT,
    zernike_optim_wave  FLOAT
);

-- Required indexes for all current query patterns:
CREATE INDEX idx_cone_data_subject_meridian
    ON cone_data (subject_id, meridian);

CREATE INDEX idx_cone_data_subject_ecc
    ON cone_data (subject_id, eccentricity_deg);

CREATE INDEX idx_cone_data_spectral_type
    ON cone_data (cone_spectral_type);

-- Composite for the main plot-data query:
CREATE INDEX idx_cone_data_plot_query
    ON cone_data (subject_id, meridian, eccentricity_deg, cone_spectral_type);
```

**Schema note on denormalization:** filecleaner.py outputs `lm_ratio`, `scone_density`, etc. as per-row metadata (same value repeated for all cones in a block). This is intentional — it allows the `/metadata` endpoint to `SELECT DISTINCT` these fields without a JOIN. Do not normalize them out to a separate `subjects` table unless query performance demands it.

**Upsert strategy:** On `INSERT ... ON CONFLICT DO NOTHING` using a unique constraint on `(subject_id, meridian, eccentricity_deg, cone_x_microns, cone_y_microns)`. This prevents duplicate rows from re-uploads without requiring a full delete + re-insert.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase PostgreSQL | asyncpg connection pool, DATABASE_URL env var | Use transaction pooler (port 6543) on Render; direct (port 5432) for local dev |
| Supabase Storage | supabase-js (frontend) for raw-csv downloads; supabase-py optional for backend uploads | `raw-csvs` bucket must be public-readable or use signed URLs for researcher CSV download |
| Vercel | Deploy retinal-ui/; VITE_API_URL set to Render/Railway URL | No server-side rendering needed — pure static SPA |
| Render / Railway | Deploy FastAPI backend; set DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS env vars | Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React frontend ↔ FastAPI | HTTPS REST, JSON responses | All URLs read from `VITE_API_URL` — no hardcoded localhost |
| FastAPI routes ↔ asyncpg pool | Dependency injection via `Depends(get_pool)` | Pool created at startup via lifespan; never create per-request connections |
| Admin route ↔ ingestion pipeline | `background_tasks.add_task(run_ingestion, bytes, filename)` | Read file bytes in endpoint before adding task; pass `io.BytesIO` not `UploadFile` |
| ingestion pipeline ↔ filecleaner.py | Direct Python function call | filecleaner parses CSV → returns DataFrame; pipeline handles DB writes |
| Frontend ↔ Supabase Storage | supabase-js `.storage.from("raw-csvs").download(filename)` | Already partially implemented in `api/index.ts`; needs `lib/supabase.ts` to be created |

## Build Order (Phase Dependencies)

The migration has hard dependencies that dictate implementation order:

```
1. Database schema + Supabase connection
   (nothing else works without this)
        ↓
2. FastAPI config + database.py refactor
   (asyncpg pool replaces aiosqlite; env-based config)
        ↓
3. Existing read routes migrated to PostgreSQL
   (verify data layer works before building new features)
        ↓
4. Ingestion pipeline (filecleaner.py → Supabase)
   (prerequisite: working DB connection + schema)
        ↓
5. Admin upload endpoint + AdminUpload UI
   (prerequisite: working ingestion pipeline to call)
        ↓
6. Frontend hardcoded URL fix + CORS config
   (can technically be done anytime, but blocks Vercel deployment)
        ↓
7. Deploy frontend (Vercel) + backend (Render/Railway)
   (prerequisite: all of the above)
        ↓
8. Feature work: color by spectral type, meridian filter, stats panel
   (pure frontend + minor backend work; no more migration risk)
```

## Anti-Patterns

### Anti-Pattern 1: Per-request asyncpg connection (current aiosqlite pattern)

**What people do:** `async with aiosqlite.connect(db_path) as db:` inside every route handler (exactly what current main.py does).
**Why it's wrong:** Opens and closes a TCP connection for every single HTTP request. In production with PostgreSQL over a network, this is 20–100ms of overhead per request, and burns through Supabase's connection limit.
**Do this instead:** Create an asyncpg connection pool at startup (lifespan), acquire from the pool per-request, release back to pool automatically.

### Anti-Pattern 2: Passing UploadFile to BackgroundTask

**What people do:** `background_tasks.add_task(process_csv, file)` where `file` is `UploadFile`.
**Why it's wrong:** Since FastAPI v0.106.0, the file is closed by the framework after the response is sent — before the background task runs. The task receives a closed file handle and fails silently or raises an IO error.
**Do this instead:** `file_bytes = await file.read(); background_tasks.add_task(process_csv, io.BytesIO(file_bytes))`.

### Anti-Pattern 3: Hardcoded API URL in frontend source

**What people do:** `const API_BASE = "http://127.0.0.1:8001"` in `api/index.ts` (exactly what exists now).
**Why it's wrong:** Every deployment environment requires a code change. The Vercel frontend can never talk to Render without editing source.
**Do this instead:** `const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001"` with the fallback for local dev.

### Anti-Pattern 4: Supabase-py for database reads in this app

**What people do:** Use `supabase.table("cone_data").select("*").execute()` via supabase-py for all queries.
**Why it's wrong:** The query builder cannot handle the complex multi-filter queries (`cone_spectral_type IN (...)`, eccentricity range, `ORDER BY`, `LIMIT`) as cleanly as raw SQL. It also adds the Supabase REST API layer (PostgREST) as a middleman with its own overhead.
**Do this instead:** asyncpg with raw SQL for all `cone_data` queries. Only use supabase-py (or supabase-js on the frontend) for Storage operations.

## Scaling Considerations

This is an internal research tool. Expected concurrent users: 1–5. The architecture decisions below are about correctness and deployment reliability, not traffic scaling.

| Scale | Architecture Notes |
|-------|--------------------|
| Current (1–5 users) | asyncpg pool with min_size=2, max_size=10 is sufficient. Supabase free tier handles this with room to spare. |
| 50–100 users | The N+1 query pattern in EccentricitySubPlots becomes the bottleneck first — fix it with a batch endpoint before worrying about infrastructure. |
| 1,000+ users | Would require: cache layer for repeated subject queries (Redis), composite indexes are already planned, consider materialized views for the per-subject aggregate stats. Not relevant for this project. |

**First bottleneck for this project:** The N+1 pattern in `EccentricitySubPlots` (one API call per eccentricity range per render). With 5–10 eccentricity ranges per subject, a single plot view triggers 10–20 simultaneous HTTP requests. Fix this in Phase 1 of feature work, not later.

## Sources

- FastAPI CORS middleware: https://fastapi.tiangolo.com/tutorial/cors/ (HIGH confidence — official docs)
- FastAPI background tasks: https://fastapi.tiangolo.com/tutorial/background-tasks/ (HIGH confidence — official docs)
- UploadFile + BackgroundTasks closure issue: https://github.com/fastapi/fastapi/discussions/10936 (HIGH confidence — confirmed in multiple FastAPI GitHub discussions)
- Supabase connection methods: https://supabase.com/docs/guides/database/connecting-to-postgres (HIGH confidence — official Supabase docs)
- supabase-py capabilities: https://supabase.com/docs/reference/python/introduction (HIGH confidence — official docs)
- asyncpg vs psycopg2 for FastAPI: https://github.com/fastapi/fastapi/discussions/13732 (HIGH confidence — official FastAPI discussion)
- PostgreSQL composite index ordering: https://medium.com/threadsafe/unleashing-the-power-of-composite-indexes-in-postgresql-909ac95fc476 (MEDIUM confidence — community article, consistent with PostgreSQL docs)
- Render FastAPI deployment: https://render.com/articles/fastapi-deployment-options (MEDIUM confidence — platform docs)

---
*Architecture research for: UWOPH Retinal Cone Viewer — FastAPI + Supabase PostgreSQL + Vercel migration*
*Researched: 2026-03-22*
