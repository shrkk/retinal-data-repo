---
phase: 01-security-and-foundation
plan: 02
subsystem: backend
tags: [asyncpg, postgresql, pydantic-settings, fastapi, supabase, schema-migration]
dependency_graph:
  requires: [01-01]
  provides: [working-postgresql-backend, cone_data-schema, asyncpg-pool]
  affects: [all-subsequent-plans]
tech_stack:
  added: [asyncpg==0.31.0, pydantic-settings==2.13.1, python-multipart==0.0.22]
  patterns: [asyncpg-pool-with-lifespan, pydantic-settings-env-validation, numbered-sql-placeholders]
key_files:
  created: [app/config.py, app/database.py, app/create_schema.py]
  modified: [app/main.py, requirements.txt]
decisions:
  - "asyncpg connection pool max_size=5 to stay within Supabase free tier (~15 total connections)"
  - "statement_cache_size=0 applied to both pool (database.py) and direct connection (create_schema.py) for full pgbouncer compatibility"
  - "settings = Settings() at module level — app crashes at import if DATABASE_URL or ADMIN_PASSWORD missing (intentional fail-fast)"
metrics:
  duration: "3 minutes"
  completed: "2026-03-23"
  tasks_completed: 3
  files_modified: 5
---

# Phase 1 Plan 2: Asyncpg Migration and PostgreSQL Schema Summary

One-liner: FastAPI migrated from aiosqlite to asyncpg pool with pydantic-settings config validation and cone_data PostgreSQL schema with 4 composite indexes.

## What Was Built

- **app/config.py** — pydantic-settings `Settings` class requiring `database_url` and `admin_password` from environment; app fails at import if either is missing. `cors_origins` property parses comma-separated `allowed_origins`.
- **app/database.py** — asyncpg connection pool with `statement_cache_size=0` (mandatory for Supabase pgbouncer transaction pooler on port 6543), `max_size=5` for free tier limits. Exports `create_pool`, `close_pool`, `get_pool` for lifespan and route handler use.
- **app/create_schema.py** — idempotent one-time DDL script creating the `cone_data` table (23 columns) and 4 composite indexes. Verified: schema applied to Supabase with `eccentricity_mm` as `double precision` (FLOAT) and 5 total indexes (including pkey).
- **app/main.py** — all 6 endpoints migrated: removed aiosqlite/sqlite3, added lifespan context manager for pool lifecycle, CORS from `settings.cors_origins`, all SQL placeholders converted from `?` to `$1/$2/$N` numbered style.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create pydantic-settings config + asyncpg database module + update requirements.txt | 2d43bc1 |
| 2 | Create cone_data table and indexes in Supabase PostgreSQL | 5a5d831 |
| 3 | Migrate app/main.py from aiosqlite to asyncpg with pydantic-settings | 2a67201 |

## Verification Results

- Schema created in Supabase: 23 columns, 5 indexes (cone_data_pkey, idx_cone_data_subject_meridian, idx_cone_data_subject_ecc, idx_cone_data_spectral_type, idx_cone_data_plot_query)
- `eccentricity_mm` type: `double precision` (FLOAT as required)
- `age` type: `double precision` (FLOAT as required — corrects SQLite INTEGER bug)
- DB connection test: `SELECT 1` returns 1 via asyncpg pool
- All 6 endpoints present and no `?` placeholders remain
- All 3 Python files parse without syntax errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Config] Added statement_cache_size=0 to create_schema.py single connection**
- **Found during:** Task 2
- **Issue:** Plan's code snippet for `create_schema.py` used `asyncpg.connect(database_url, ssl="require")` without `statement_cache_size=0`. The important context states ALL asyncpg connections must include this parameter for Supabase pgbouncer compatibility.
- **Fix:** Added `statement_cache_size=0` to the `asyncpg.connect()` call in `app/create_schema.py`. Also removed `ssl="require"` since the DATABASE_URL (transaction pooler format) handles SSL in the connection string.
- **Files modified:** app/create_schema.py
- **Commit:** 5a5d831

## Known Stubs

None — all endpoints are fully wired to asyncpg pool. The database is empty (no data ingested yet, that is Phase 2), but the endpoints return correct empty responses rather than hardcoded placeholders.

## Self-Check: PASSED
