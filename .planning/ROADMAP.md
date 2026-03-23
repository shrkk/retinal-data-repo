# Roadmap: UWOPH Retinal Cone Viewer

## Overview

Starting from a partially-broken local SQLite app with a committed database password, this roadmap takes the retinal cone viewer to a deployed, production-ready research tool on Vercel + Render + Supabase. The build order is dictated by hard architecture dependencies: credentials and broken files must be fixed first, the database must exist before routes can query it, real data must be ingested before features can display it, and deployment comes last once all code is stable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Security and Foundation** - Rotate committed credentials, fix broken files, wire Supabase PostgreSQL with asyncpg pool
- [ ] **Phase 2: Backend and Data** - Migrate all FastAPI routes to PostgreSQL, build ingestion pipeline, load all 13 subjects with real cone data
- [ ] **Phase 3: Frontend and Admin** - Fix frontend bugs, build NC cone coloring + stats panel + meridian filter, add password-protected admin upload UI
- [ ] **Phase 4: Deployment** - Ship to Vercel + Render + Supabase with validated CORS and documented env vars

## Phase Details

### Phase 1: Security and Foundation
**Goal**: The repository is clean of secrets, the existing app has no broken imports, and the Supabase PostgreSQL connection is established with the correct schema
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, INFRA-01, INFRA-02, INFRA-04, BACK-01
**Success Criteria** (what must be TRUE):
  1. `test_db.py` contains no credentials; the leaked password has been rotated in Supabase and purged from git history
  2. FastAPI starts up, connects to Supabase PostgreSQL via asyncpg pool, and serves `/subjects` without error
  3. The `cone_data` table exists in Supabase with correct column types (including `eccentricity_mm` as FLOAT) and all 4 composite indexes
  4. All configuration (DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS) is loaded from environment variables via pydantic-settings; the app refuses to start if required vars are missing
**Plans:** 2 plans
Plans:
- [ ] 01-01-PLAN.md — Credential purge from test_db.py, git history clean, Supabase password rotation
- [ ] 01-02-PLAN.md — Pydantic-settings config, asyncpg pool, PostgreSQL schema with indexes, migrate all routes from aiosqlite

### Phase 2: Backend and Data
**Goal**: All existing API routes return real data from Supabase, a bulk endpoint eliminates the N+1 query pattern, the ingestion pipeline processes all 13 subjects, and fake meridian scripts are deleted
**Depends on**: Phase 1
**Requirements**: BACK-02, BACK-03, BACK-04, DATA-02, DATA-03, DATA-04, INFRA-03
**Success Criteria** (what must be TRUE):
  1. The subject list and cone scatter data load from Supabase PostgreSQL — no SQLite references remain in the codebase
  2. A single `GET /subjects/data` call returns all subjects' data; page load fires one HTTP request instead of N per subject
  3. All 13 subjects from `Cone_classification_data/` are in the database with real meridian values and NC cone classifications visible via `SELECT DISTINCT cone_spectral_type FROM cone_data`
  4. `POST /admin/upload` accepts a CSV, runs filecleaner.py via BackgroundTask (bytes read before task is queued), and returns per-subject row counts
  5. `distribute_meridians.py` and `update_meridians.py` are deleted from the repository
**Plans**: TBD

### Phase 3: Frontend and Admin
**Goal**: Researchers see a fully functional viewer with cone type coloring, meridian filtering, and stats — and the admin operator can upload new CSVs through a password-protected UI
**Depends on**: Phase 2
**Requirements**: ADMIN-01, ADMIN-02, FE-01, FE-02, FE-03, FE-04, FE-05
**Success Criteria** (what must be TRUE):
  1. Scatter plot points are colored by cone type (L=red, M=green, S=blue, NC=grey) with per-type toggle checkboxes; NC cones appear when present in the data
  2. Meridian filter (Temporal/Nasal/Superior/Inferior) correctly filters scatter points using real ingested meridian values
  3. Stats panel below FilterBar shows L/M ratio and % S-cones for the selected subject
  4. CSV download button works without runtime errors (`lib/supabase.ts` exists and is wired correctly)
  5. Visiting `/admin`, entering the correct password, uploading a CSV, and submitting shows a structured result table with rows ingested per subject
**Plans**: TBD

### Phase 4: Deployment
**Goal**: The application is publicly accessible on Vercel and Render with a documented setup so the next operator can reproduce the environment
**Depends on**: Phase 3
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. The frontend loads on Vercel at its production URL; direct navigation to any route works without a 404
  2. API calls from the Vercel frontend reach the Render backend — `Access-Control-Allow-Origin` header is present and correct in browser DevTools
  3. A `.env.example` or README documents every required environment variable for both Render and Vercel deployments
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security and Foundation | 0/2 | Planning complete | - |
| 2. Backend and Data | 0/TBD | Not started | - |
| 3. Frontend and Admin | 0/TBD | Not started | - |
| 4. Deployment | 0/TBD | Not started | - |
