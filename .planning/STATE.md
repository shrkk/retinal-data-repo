---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase complete — ready for verification
stopped_at: Completed 02-04-PLAN.md tasks 1-3 — awaiting human-verify checkpoint for Phase 2 frontend
last_updated: "2026-03-24T03:20:22.252Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 6
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Researchers can instantly see how cone density and spectral composition vary with retinal eccentricity for any subject — without running scripts or managing files.
**Current focus:** Phase 02 — backend-and-data

## Current Position

Phase: 02 (backend-and-data) — EXECUTING
Plan: 4 of 4

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-security-and-foundation P01 | 40min | 2 tasks | 2 files |
| Phase 01-security-and-foundation P02 | 3min | 3 tasks | 5 files |
| Phase 02-backend-and-data P01 | 10min | 2 tasks | 3 files |
| Phase 02-backend-and-data P02 | 3min | 1 tasks | 0 files |
| Phase 02-backend-and-data P03 | 8min | 3 tasks | 2 files |
| Phase 02-backend-and-data P04 | 15 | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: Keep FastAPI backend — Python parsing logic (filecleaner.py) must stay in-process
- [Setup]: asyncpg + transaction pooler (port 6543) with `statement_cache_size=0` — avoids prepared statement cache incompatibility
- [Setup]: Single ADMIN_PASSWORD env var — no Supabase Auth needed for single-team tool
- [Phase 01-security-and-foundation]: Used git-filter-repo --replace-text to purge leaked password from all git history — faster and more precise than BFG or filter-branch
- [Phase 01-security-and-foundation]: asyncpg requires statement_cache_size=0 for Supabase transaction pooler (port 6543) — mandatory in all asyncpg connections
- [Phase 01-security-and-foundation]: asyncpg pool max_size=5 to stay within Supabase free tier connection limits
- [Phase 01-security-and-foundation]: statement_cache_size=0 applied to all asyncpg connections (pool and direct) for Supabase pgbouncer compatibility
- [Phase 01-security-and-foundation]: settings = Settings() at module level for fail-fast startup when DATABASE_URL or ADMIN_PASSWORD missing
- [Phase 02-backend-and-data]: upload_log uses single subject_id TEXT per upload row (v1 acceptable)
- [Phase 02-backend-and-data]: NC cones ARE present in real data (L, M, S, NC confirmed) — frontend Phase 3 should render NC in grey
- [Phase 02-backend-and-data]: Meridian casing inconsistency in source CSVs ('inferior' lowercase, others title-case) — case-insensitive matching already in backend handles this
- [Phase 02-backend-and-data]: Bytes-first BackgroundTask: bytes read in handler before queuing to avoid UploadFile use-after-close
- [Phase 02-backend-and-data]: upload_log INSERT in same transaction as cone_data INSERT — no ghost log entries on failure
- [Phase 02-backend-and-data]: Navbar replaces standalone ModeToggle and h1 header — all views wrapped in Navbar for persistent navigation

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: `lib/supabase.ts` is missing — CSV download silently broken in current app (to be addressed in 01-02)
- [Phase 2 RESOLVED]: NC cones ARE present in real data — cone_spectral_type = 'NC' confirmed via SELECT DISTINCT after 02-02 ingestion
- [Phase 2]: Supabase free tier limits connections to ~15 — may need Pro tier or reduce asyncpg `max_size` to 2-3 per worker
- [Phase 4]: CORS `ALLOWED_ORIGINS` on Render can only be set after Vercel URL is known — sequence matters

## Session Continuity

Last session: 2026-03-24T03:20:22.250Z
Stopped at: Completed 02-04-PLAN.md tasks 1-3 — awaiting human-verify checkpoint for Phase 2 frontend
Resume file: None
