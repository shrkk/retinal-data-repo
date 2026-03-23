# Requirements: UWOPH Retinal Cone Viewer

**Defined:** 2026-03-22
**Core Value:** Researchers can instantly see how cone density and spectral composition vary with retinal eccentricity for any subject — without running scripts or managing files.

## v1 Requirements

Requirements for production-ready deployment. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Supabase PostgreSQL replaces SQLite as the primary database, with asyncpg connection pool initialized at FastAPI startup
- [ ] **INFRA-02**: All configuration (DB URL, admin password, allowed origins) is loaded via pydantic-settings from environment variables — no hardcoded values in source code
- [ ] **INFRA-03**: CORS is configured with explicit allowed origins from an env var, enabling Vercel frontend → Render backend communication
- [ ] **INFRA-04**: Database has composite indexes on `(subject_id, meridian)` and `(subject_id, eccentricity_deg)` for query performance

### Data Integrity

- [ ] **DATA-01**: Live Supabase password is removed from `test_db.py`, rotated in Supabase, and purged from git history
- [ ] **DATA-02**: All 13 subjects from `Cone_classification_data/` are ingested into Supabase via filecleaner.py with real meridian and NC cone data
- [ ] **DATA-03**: Fake meridian generator scripts (`distribute_meridians.py`, `update_meridians.py`) are deleted — meridian data comes exclusively from CSV ingestion
- [ ] **DATA-04**: Every admin CSV upload is automatically processed through filecleaner.py before any data touches the database — no raw or unclean data can be inserted

### Backend

- [ ] **BACK-01**: FastAPI routes use asyncpg pool for all database queries, replacing aiosqlite
- [ ] **BACK-02**: Hardcoded `localhost:8000` URL is removed from the frontend; API base URL is read from `VITE_API_URL` environment variable
- [ ] **BACK-03**: A bulk endpoint `GET /subjects/data` returns all subjects' cone data in a single query, replacing the N+1 per-subject call pattern
- [ ] **BACK-04**: `POST /admin/upload` endpoint accepts a CSV file, runs filecleaner.py via BackgroundTask (using the UploadFile bytes-first pattern), and returns an ingestion summary (rows per subject, errors)

### Frontend — Bug Fixes

- [ ] **FE-01**: `lib/supabase.ts` is created with the Supabase client; CSV download feature works correctly
- [ ] **FE-02**: Dead code removed — `ConePlot.tsx`, `EccentricityRangeSelector.tsx`, `axios`, `react-select` are deleted from the codebase

### Frontend — Features

- [ ] **FE-03**: Scatter plot points are colored by cone spectral type (L=red, M=green, S=blue, NC=grey) with per-type toggle checkboxes
- [ ] **FE-04**: Meridian filter allows selecting Temporal/Nasal/Superior/Inferior to filter scatter points per subject
- [ ] **FE-05**: Per-subject stats panel displays L/M ratio and % S-cones from the database record

### Admin

- [ ] **ADMIN-01**: `/admin` route is protected by a password (compared via `secrets.compare_digest()`); password is set via `ADMIN_PASSWORD` env var
- [ ] **ADMIN-02**: Admin page has a CSV file upload input; on submit it calls `POST /admin/upload` and displays a structured result table (subject IDs, rows ingested, errors)

### Deployment

- [ ] **DEPLOY-01**: `render.yaml` at repo root configures the FastAPI service for Render deployment
- [ ] **DEPLOY-02**: `retinal-ui/vercel.json` includes SPA rewrite rules so direct URL navigation works
- [ ] **DEPLOY-03**: Environment variable requirements are documented in a `README` or `.env.example` file for both the backend (Render) and frontend (Vercel)

## v2 Requirements

Deferred to future release.

### Auth

- **AUTH-01**: Researcher login with Supabase Auth (magic link) — currently single-team, public read is acceptable
- **AUTH-02**: Per-user bookmarks or saved filter configurations

### Visualization

- **VIZ-01**: Individual cone location map (2D scatter of `cone_x_microns` vs `cone_y_microns` per measurement block)
- **VIZ-02**: Density heatmap overlay on cone location map
- **VIZ-03**: Cross-subject comparison view (two subjects side by side)

### Data

- **DATA-05**: Automated ingestion via Supabase Storage trigger (upload to bucket → auto-process) instead of manual admin page

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts beyond admin gate | Single-team internal tool; over-engineering |
| Mobile-optimized design | Desktop-only research use case |
| Real-time data streaming | Batch upload is sufficient for this workflow |
| supabase-py for DB queries | asyncpg is 10-100x faster for bulk cone data |
| Supabase Edge Functions | Python parsing logic must stay in FastAPI process |
| OAuth / SSO | No requirement from team; env-var password is sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| BACK-01 | Phase 1 | Pending |
| BACK-02 | Phase 2 | Pending |
| BACK-03 | Phase 2 | Pending |
| INFRA-03 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| BACK-04 | Phase 2 | Pending |
| ADMIN-01 | Phase 3 | Pending |
| ADMIN-02 | Phase 3 | Pending |
| FE-01 | Phase 3 | Pending |
| FE-02 | Phase 3 | Pending |
| FE-03 | Phase 3 | Pending |
| FE-04 | Phase 3 | Pending |
| FE-05 | Phase 3 | Pending |
| DEPLOY-01 | Phase 4 | Pending |
| DEPLOY-02 | Phase 4 | Pending |
| DEPLOY-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 — phase mapping updated to 4-phase compressed roadmap*
