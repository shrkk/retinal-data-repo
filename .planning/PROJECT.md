# UWOPH Retinal Cone Viewer

## What This Is

A web-based research viewer for adaptive optics (AO) retinal imaging data, used by ophthalmology researchers to visualize cone photoreceptor classifications across the human retina. Researchers browse subjects, view cone density vs. eccentricity scatter plots colored by spectral type (L/M/S/NC), filter by meridian, and inspect per-subject statistics like L/M ratio and % S-cones.

## Core Value

Researchers can instantly see how cone density and spectral composition vary with retinal eccentricity for any subject — without running scripts or managing files.

## Requirements

### Validated

- ✓ Display cone density vs eccentricity scatter plots per subject — existing
- ✓ Subject selector with left/right eye toggle — existing
- ✓ Eccentricity range filtering per subject — existing
- ✓ Multi-block AO CSV parsing via filecleaner.py — existing

### Active

- [ ] Migrate data pipeline from SQLite to Supabase PostgreSQL
- [ ] Ingest new cone classification CSVs (Cone_classification_data/) using filecleaner.py
- [ ] Fix broken CSV download (missing lib/supabase.ts)
- [ ] Fix hardcoded localhost:8000 API URL — use env variable
- [ ] Remove hardcoded credentials from test_db.py
- [ ] Fix fake meridian distribution (distribute_meridians.py)
- [ ] Color scatter points by cone spectral type (L/M/S/NC)
- [ ] Add meridian filter (Temporal/Nasal/Superior/Inferior)
- [ ] Add L/M ratio & % S-cones stats panel per subject
- [ ] Admin UI — password-protected page to upload new CSVs and trigger ingestion
- [ ] Deploy frontend to Vercel, backend to Render/Railway, DB to Supabase

### Out of Scope

- User accounts / auth beyond admin password gate — single-team internal tool
- Mobile-optimized design — desktop research use only
- Real-time data streaming — batch upload workflow is sufficient
- Multiple projects or datasets — single-cohort viewer for now

## Context

- **Existing codebase:** Python FastAPI backend (`app/main.py`) + React 19 + Vite frontend (`retinal-ui/`)
- **Current data pipeline:** filecleaner.py parses wide multi-block AO CSVs into tidy rows (one row per cone), outputting columns: `cone_x_microns`, `cone_y_microns`, `cone_spectral_type`, `subject_id`, `age`, `eye`, `meridian`, `eccentricity_deg`, `eccentricity_mm`, `lm_ratio`, `scones`, `lcone_density`, `mcone_density`, `scone_density`, `numcones`, plus Zernike/FOV/origin metadata
- **New data:** 13 subjects in `/Users/shrey/Downloads/Cone_classification_data/` — format matches what filecleaner.py already handles
- **Sample output schema:** `sampleAO001fix.csv` in repo root defines canonical column order
- **Dead code:** `ConePlot.tsx`, `EccentricityRangeSelector.tsx`, `axios`, `react-select` — unused, should be removed
- **Known backend issues:** N+1 query pattern in EccentricitySubPlots (one API call per subject), missing DB indexes

## Constraints

- **Stack:** Python FastAPI + React 19 + TypeScript + Plotly.js — keep existing tech, don't rewrite
- **Database:** Migrate SQLite → Supabase PostgreSQL (existing Supabase references in codebase confirm intent)
- **Deployment:** Vercel (frontend) + Render or Railway (FastAPI backend) + Supabase (DB + Storage)
- **Admin auth:** Single env-var password (ADMIN_PASSWORD) — no Supabase Auth needed
- **Data format:** filecleaner.py is the canonical parser — any new ingestion must use it, not reinvent parsing
- **MCP:** Supabase MCP is configured at project scope — use it for DB schema and migrations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep FastAPI backend (don't migrate to Edge Functions) | Existing Python parsing logic is complex; rewriting in JS would be risky | — Pending |
| Single password gate for admin | Small internal team, no need for full auth system | — Pending |
| filecleaner.py as canonical parser | Already handles the exact multi-block AO format | — Pending |
| Replace SQLite with Supabase PostgreSQL | Production readiness, managed hosting, existing broken Supabase integration | — Pending |

---
*Last updated: 2026-03-22 after initialization*
