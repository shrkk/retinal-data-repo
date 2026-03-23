---
phase: 01-security-and-foundation
plan: "01"
subsystem: infra
tags: [git-filter-repo, security, credentials, asyncpg, supabase, postgresql, env-vars]

# Dependency graph
requires: []
provides:
  - "test_db.py reads DATABASE_URL from environment (no hardcoded credentials)"
  - "Git history purged of leaked Supabase password using git-filter-repo"
  - ".env.example documents required env vars (DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS)"
  - "Supabase database password rotated — old credential is invalidated"
  - "statement_cache_size=0 pattern established for all asyncpg connections to Supabase"
affects:
  - 01-02 (asyncpg pool must use statement_cache_size=0)
  - deployment (all phases — git history is clean, no further purges needed)

# Tech tracking
tech-stack:
  added: [git-filter-repo]
  patterns:
    - "All credentials read from os.environ.get() with RuntimeError guard if unset"
    - "asyncpg.connect() requires statement_cache_size=0 against Supabase transaction pooler (port 6543)"

key-files:
  created:
    - .env.example
  modified:
    - test_db.py

key-decisions:
  - "Used git-filter-repo --replace-text to purge password token from all history — faster and more precise than BFG or filter-branch"
  - "statement_cache_size=0 added to asyncpg.connect() — required for Supabase pgbouncer transaction pooler on port 6543"

patterns-established:
  - "Env var guard pattern: os.environ.get() + RuntimeError if missing — used in test_db.py, extend to all future scripts"
  - "asyncpg + statement_cache_size=0 — mandatory for all Supabase asyncpg connections in this project"

requirements-completed: [DATA-01]

# Metrics
duration: ~40min (includes human checkpoint for Supabase dashboard password rotation)
completed: 2026-03-22
---

# Phase 1 Plan 01: Credential Purge and Supabase Password Rotation Summary

**Plaintext Supabase password removed from test_db.py, purged from all git history via git-filter-repo, Supabase password rotated, and asyncpg transaction pooler compatibility fix (statement_cache_size=0) applied — connection verified successful**

## Performance

- **Duration:** ~40 min (includes human checkpoint for Supabase dashboard action)
- **Started:** 2026-03-23T02:26:27Z
- **Completed:** 2026-03-22
- **Tasks:** 2 of 2
- **Files modified:** 2 (test_db.py, .env.example created)

## Accomplishments

- Rewrote test_db.py to read DATABASE_URL from `os.environ.get("DATABASE_URL")` with a RuntimeError guard when the var is unset — no hardcoded credentials remain
- Installed git-filter-repo and purged the password string from all 8 commits in git history; `git log --all -p | grep -c [password]` returns 0
- Created .env.example at repo root with DATABASE_URL, ADMIN_PASSWORD, and ALLOWED_ORIGINS placeholders
- User rotated the Supabase database password via dashboard — old credential is invalidated
- Applied `statement_cache_size=0` to asyncpg.connect() — required for Supabase transaction pooler (port 6543); `python test_db.py` now prints "Connection successful"

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip credentials from test_db.py and purge git history** - `e81639d` (fix)
2. **Task 2: Rotate Supabase database password** - human action (no code commit; .env updated locally and gitignored)
3. **Auto-fix: statement_cache_size=0 for transaction pooler compatibility** - `33c21f3` (fix)

**Plan metadata:** `ec87fb6` (docs: complete credential purge plan — checkpoint pause commit)

## Files Created/Modified

- `test_db.py` - Credentials removed; reads DATABASE_URL from env; RuntimeError guard on startup; statement_cache_size=0 for Supabase pooler compatibility
- `.env.example` - Template documenting DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS with placeholder values

## Decisions Made

- Used `git-filter-repo --replace-text` over BFG Repo-Cleaner (requires Java) and filter-branch (deprecated). Handles binary-safe text replacement across all refs in one pass.
- Added `statement_cache_size=0` to asyncpg.connect(). Supabase's pgbouncer in transaction pool mode (port 6543) does not support prepared statements — without this flag the connection always fails with "prepared statement already exists". This is now the mandatory pattern for all asyncpg connections in this project.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added statement_cache_size=0 to asyncpg.connect()**
- **Found during:** Post-Task 2 verification (connection test after password rotation)
- **Issue:** test_db.py connected to Supabase transaction pooler (port 6543) and failed with "prepared statement already exists" — asyncpg's default prepared statement caching is incompatible with pgbouncer transaction mode
- **Fix:** Added `statement_cache_size=0` keyword argument to `asyncpg.connect()` call
- **Files modified:** test_db.py
- **Verification:** `python test_db.py` printed "Connection successful" after fix
- **Committed in:** 33c21f3

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Fix was required for the plan's core acceptance criterion ("Connection successful") to be satisfied. No scope creep — directly in-scope for Task 2 verification.

## Issues Encountered

- git-filter-repo rewrote the working tree to match rewritten history (expected behavior), requiring test_db.py to be re-written after the history rewrite completed.
- `source .env && python test_db.py` in a subprocess shell did not export DATABASE_URL into the Python process until `set -a` was used before sourcing. Shell behavior detail only — the .env file and test script are correct.

## User Setup Required

Maintain a local `.env` file at the repo root (gitignored) containing:

```
DATABASE_URL=postgresql://postgres.[project-ref]:[NEW_PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
ADMIN_PASSWORD=change-me-to-a-random-32-char-string
ALLOWED_ORIGINS=http://localhost:5173
```

Verification command: `set -a && source .env && set +a && python test_db.py`
Expected output: `Connection successful`

## Next Phase Readiness

- Git history is clean — no further credential purges needed
- `statement_cache_size=0` pattern established — 01-02 must use this in all asyncpg pool configuration (e.g., `asyncpg.create_pool(..., statement_cache_size=0)`)
- .env.example provides the variable template for 01-02's pydantic-settings config module
- Blocker "Supabase database password is committed in test_db.py" is resolved and can be cleared from STATE.md

Remaining blocker for Phase 1 overall: `lib/supabase.ts` missing (CSV download broken) — to be addressed in 01-02.

---
*Phase: 01-security-and-foundation*
*Completed: 2026-03-22*
