---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
stopped_at: Completed 02-01-PLAN.md — upload_log table created, fake meridian scripts deleted, BACK-02 and INFRA-03 verified
last_updated: "2026-03-24T03:11:24.996Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 6
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Researchers can instantly see how cone density and spectral composition vary with retinal eccentricity for any subject — without running scripts or managing files.
**Current focus:** Phase 02 — backend-and-data

## Current Position

Phase: 02 (backend-and-data) — EXECUTING
Plan: 2 of 4

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: `lib/supabase.ts` is missing — CSV download silently broken in current app (to be addressed in 01-02)
- [Phase 2]: NC cone presence in real data is unconfirmed — validate with `SELECT DISTINCT cone_spectral_type` after ingestion before building UI
- [Phase 2]: Supabase free tier limits connections to ~15 — may need Pro tier or reduce asyncpg `max_size` to 2-3 per worker
- [Phase 4]: CORS `ALLOWED_ORIGINS` on Render can only be set after Vercel URL is known — sequence matters

## Session Continuity

Last session: 2026-03-24T03:11:24.994Z
Stopped at: Completed 02-01-PLAN.md — upload_log table created, fake meridian scripts deleted, BACK-02 and INFRA-03 verified
Resume file: None
