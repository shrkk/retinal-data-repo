---
name: project_initialized
description: Project initialization complete — UWOPH Retinal Cone Viewer roadmap and requirements set
type: project
---

Project initialized 2026-03-22. 4-phase roadmap created.

**Why:** Migrating from broken SQLite dev app to production Supabase + Vercel + Render.

**How to apply:** Phase 1 is the next step. Critical pre-work: credential rotation must happen before any code changes.

Phase order:
1. Security and Foundation (DATA-01, INFRA-01-02-04, BACK-01)
2. Backend and Data (routes + ingestion pipeline + 13 subjects)
3. Frontend and Admin (NC coloring, meridian filter, stats panel, admin UI)
4. Deployment (Vercel + Render + CORS + env docs)

Key constraints:
- asyncpg 0.31.0 (NOT supabase-py) for DB queries
- Supabase direct connection port 5432 for Render (transaction mode port 6543 breaks asyncpg prepared statements)
- filecleaner.py is the ONLY allowed CSV parser — must run on every upload
- UploadFile BackgroundTask closure bug: read bytes first before queuing task
- CORS must use explicit origins from env var (wildcard + credentials = browser rejection)
- test_db.py line 4 has live plaintext Supabase password — ROTATE IMMEDIATELY
