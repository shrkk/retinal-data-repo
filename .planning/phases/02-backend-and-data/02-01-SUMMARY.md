---
phase: 02-backend-and-data
plan: "01"
subsystem: database
tags: [migration, cleanup, verification]
dependency_graph:
  requires: []
  provides: [upload_log-table, DATA-03-done, BACK-02-verified, INFRA-03-verified]
  affects: [02-03-PLAN, 02-04-PLAN]
tech_stack:
  added: []
  patterns: [asyncpg-direct-connection, CREATE-TABLE-IF-NOT-EXISTS]
key_files:
  created: []
  modified:
    - app/create_schema.py
  deleted:
    - distribute_meridians.py
    - update_meridians.py
decisions:
  - upload_log uses a single subject_id TEXT field per upload (v1 acceptable per RESEARCH.md open question 3)
metrics:
  duration: 10min
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_changed: 3
---

# Phase 2 Plan 01: Schema Migration and Cleanup Summary

**One-liner:** upload_log table created in Supabase with 8 columns and uploaded_at DESC index; fake meridian scripts deleted; BACK-02 and INFRA-03 verified already implemented.

## What Was Done

Created the `upload_log` table required by Plan 03 (BackgroundTask upload refactor) and Plan 04 (Updates timeline page). Deleted two fake meridian scripts that are superseded by real cone classification data. Verified that the two "already implemented" requirements (BACK-02 and INFRA-03) are truly in place.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add upload_log table to schema and run migration | 3e3453d | app/create_schema.py |
| 2 | Delete fake meridian scripts and verify BACK-02 + INFRA-03 | 9b1c7dc | distribute_meridians.py (deleted), update_meridians.py (deleted) |

## Verification Results

- `upload_log` table confirmed in Supabase with 8 columns: id, uploaded_at, subject_id, eye, event_type, commit_message, rows_ingested, uploaded_by
- `idx_upload_log_uploaded_at` index confirmed (uploaded_at DESC)
- `distribute_meridians.py` and `update_meridians.py` deleted from repo
- BACK-02: `grep -r "localhost:800" retinal-ui/src/` returned no matches; `VITE_API_URL` env var in use at `api/index.ts` line 5
- INFRA-03: `app/main.py` uses `allow_origins=settings.cors_origins`; `app/config.py` has `allowed_origins: str` reading from env

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is purely database migration and file cleanup with no UI or API stubs introduced.

## Self-Check: PASSED

- [x] `app/create_schema.py` contains `CREATE TABLE IF NOT EXISTS upload_log` — confirmed
- [x] `app/create_schema.py` contains `await conn.execute(UPLOAD_LOG_SQL)` — confirmed
- [x] `distribute_meridians.py` absent — confirmed (git rm'd, commit 9b1c7dc)
- [x] `update_meridians.py` absent — confirmed (git rm'd, commit 9b1c7dc)
- [x] Commits 3e3453d and 9b1c7dc exist in git log — confirmed
