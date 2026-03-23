---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 01-01-PLAN.md — credential purge, password rotation, and asyncpg fix complete
last_updated: "2026-03-23T02:49:03.134Z"
last_activity: 2026-03-22 — Roadmap created
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Researchers can instantly see how cone density and spectral composition vary with retinal eccentricity for any subject — without running scripts or managing files.
**Current focus:** Phase 1 — Security and Foundation

## Current Position

Phase: 1 of 4 (Security and Foundation)
Plan: 1 of 2 complete in current phase
Status: In Progress
Last activity: 2026-03-22 — Plan 01-01 complete (credential purge + password rotation)

Progress: [█████░░░░░] 50%

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: Keep FastAPI backend — Python parsing logic (filecleaner.py) must stay in-process
- [Setup]: asyncpg + transaction pooler (port 6543) with `statement_cache_size=0` — avoids prepared statement cache incompatibility
- [Setup]: Single ADMIN_PASSWORD env var — no Supabase Auth needed for single-team tool
- [Phase 01-security-and-foundation]: Used git-filter-repo --replace-text to purge leaked password from all git history — faster and more precise than BFG or filter-branch
- [Phase 01-security-and-foundation]: asyncpg requires statement_cache_size=0 for Supabase transaction pooler (port 6543) — mandatory in all asyncpg connections

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: `lib/supabase.ts` is missing — CSV download silently broken in current app (to be addressed in 01-02)
- [Phase 2]: NC cone presence in real data is unconfirmed — validate with `SELECT DISTINCT cone_spectral_type` after ingestion before building UI
- [Phase 2]: Supabase free tier limits connections to ~15 — may need Pro tier or reduce asyncpg `max_size` to 2-3 per worker
- [Phase 4]: CORS `ALLOWED_ORIGINS` on Render can only be set after Vercel URL is known — sequence matters

## Session Continuity

Last session: 2026-03-23T02:49:03.132Z
Stopped at: Completed 01-01-PLAN.md — credential purge, password rotation, and asyncpg fix complete
Resume file: None
