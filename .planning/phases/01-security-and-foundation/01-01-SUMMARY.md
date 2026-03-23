---
phase: 01-security-and-foundation
plan: 01
subsystem: infra
tags: [security, credentials, git-history, asyncpg, env-vars]

# Dependency graph
requires: []
provides:
  - "test_db.py reads DATABASE_URL from environment (no hardcoded credentials)"
  - "Git history purged of leaked Supabase password using git-filter-repo"
  - ".env.example documents required env vars (DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS)"
affects: [01-02, backend, deployment]

# Tech tracking
tech-stack:
  added: [git-filter-repo]
  patterns: ["Environment variable injection for DB credentials via os.environ.get"]

key-files:
  created: [.env.example]
  modified: [test_db.py]

key-decisions:
  - "Used git-filter-repo --replace-text to purge password token from all history rather than BFG or filter-branch (faster, more precise)"
  - "Password replaced with literal token REDACTED_PASSWORD in history rewrites for auditability"

patterns-established:
  - "All credentials read from environment variables — never hardcoded in source"

requirements-completed: [DATA-01]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 1 Plan 01: Credential Purge Summary

**Hardcoded Supabase password removed from test_db.py and purged from all 8 git commits using git-filter-repo; awaiting user password rotation in Supabase dashboard**

## Performance

- **Duration:** ~2 min (Task 1 complete; paused at Task 2 checkpoint)
- **Started:** 2026-03-23T02:26:27Z
- **Completed (partial):** 2026-03-23T02:28:00Z
- **Tasks:** 1/2 complete (paused at checkpoint:human-action)
- **Files modified:** 2 (test_db.py, .env.example created)

## Accomplishments

- Rewrote test_db.py to read DATABASE_URL from `os.environ.get("DATABASE_URL")` with a RuntimeError guard when the var is unset
- Installed git-filter-repo and purged the password string `uwophthalmology2025` from all 8 commits in git history (0 occurrences remain)
- Created .env.example at repo root with DATABASE_URL, ADMIN_PASSWORD, and ALLOWED_ORIGINS placeholders
- Verified: `git log --all -p | grep -c "uwophthalmology2025"` returns 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip credentials from test_db.py and purge git history** - `e81639d` (fix)

**Plan metadata:** (pending — awaiting Task 2 completion by user)

## Files Created/Modified

- `test_db.py` - Replaced hardcoded DATABASE_URL string with `os.environ.get("DATABASE_URL")` and RuntimeError guard
- `.env.example` - New file documenting required environment variables for operators

## Decisions Made

- Used `git-filter-repo --replace-text` over BFG Repo-Cleaner — simpler installation (Homebrew), handles binary-safe text replacement across all refs in one pass
- Note: git-filter-repo removes the `origin` remote as a safety measure to prevent accidental push of poisoned history

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- git-filter-repo rewrote the working tree to match rewritten history (expected behavior), so test_db.py was restored to the REDACTED_PASSWORD version after the history rewrite — required re-writing the credential-free version again after the rewrite completed.

## User Setup Required

**Task 2 requires manual action in the Supabase dashboard.** Password rotation steps:

1. Go to: https://supabase.com/dashboard
2. Select project (ref: ytglrmyvdzhidwcutrtn)
3. Navigate to Settings -> Database
4. Click "Reset database password" — generate a new password
5. Create a `.env` file (gitignored) at repo root with the new password:
   ```
   DATABASE_URL=postgresql://postgres.ytglrmyvdzhidwcutrtn:[NEW_PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
   ```
   Note: use port **6543** (transaction pooler), not 5432
6. Test: `source .env && python test_db.py` — should print "Connection successful"
7. Type "password rotated" to resume plan execution

## Next Phase Readiness

- Task 1 complete: repository is clean of credentials, git history purged
- Task 2 blocked on user action: Supabase password must be rotated before plan 01-01 is complete
- Once Task 2 is confirmed, plan 01-02 can begin (pydantic-settings config, asyncpg pool, schema)

---
*Phase: 01-security-and-foundation*
*Completed: 2026-03-23 (partial — awaiting Task 2 human-action)*
