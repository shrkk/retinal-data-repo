---
phase: 02-backend-and-data
plan: "03"
subsystem: backend-api
tags: [fastapi, endpoints, background-tasks, upload-log, bulk-query]
dependency_graph:
  requires: ["02-01", "02-02"]
  provides: ["bulk-subjects-endpoint", "upload-log-endpoint", "background-upload"]
  affects: ["retinal-ui/src/api/index.ts", "app/main.py"]
tech_stack:
  added: []
  patterns: ["bytes-first BackgroundTask", "upload-detection before INSERT", "transactional upload logging"]
key_files:
  created: []
  modified:
    - app/main.py
    - retinal-ui/src/api/index.ts
decisions:
  - "Bytes read synchronously in handler (not passed as UploadFile to BackgroundTask) — avoids use-after-close"
  - "upload_log INSERT inside same transaction as cone_data INSERT — no ghost log entries if cone INSERT fails"
  - "event_type detection queries cone_data BEFORE the INSERT transaction — accurate new_patient vs update"
metrics:
  duration: "8min"
  completed: "2026-03-23"
  tasks: 3
  files: 2
---

# Phase 2 Plan 03: Bulk Endpoints, BackgroundTask Upload, and Upload Log Summary

**One-liner:** GET /subjects/data bulk endpoint (LIMIT 500000) eliminates N+1 queries; POST /admin/upload refactored to BackgroundTask with new_patient/update detection and transactional upload_log writes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GET /subjects/data and GET /upload-log | 21fc0c4 | app/main.py |
| 2 | Refactor POST /admin/upload to BackgroundTask | 29cde2c | app/main.py |
| 3 | Update frontend API helpers | 10aa914 | retinal-ui/src/api/index.ts |

## What Was Built

### GET /subjects/data
Returns up to 500,000 cone rows (subject_id, eye, meridian, eccentricity_deg, cone_spectral_type, cone_x_microns, cone_y_microns, lm_ratio, scones) ordered by subject_id/meridian/eccentricity_deg. Eliminates the N+1 per-subject pattern.

### GET /upload-log
Returns last 100 upload_log entries sorted newest-first. Serializes datetime fields to ISO 8601 strings. Feeds the Updates page built in Plan 04.

### POST /admin/upload (refactored)
- Reads file bytes synchronously before queuing BackgroundTask
- Validates/parses CSV synchronously (fail fast, before queuing)
- Detects new_patient vs update by querying existing (subject_id, eye) pairs
- Background task inserts cone_data rows and upload_log entry in a single transaction
- Accepts optional commit_message form field (truncated to 500 chars)
- Returns `{queued: true, row_count, subjects}` immediately (202-style)

### Frontend API module (retinal-ui/src/api/index.ts)
- `getSubjectsData()` — fetches /subjects/data
- `UploadLogEntry` interface + `getUploadLog()` — fetches /upload-log
- `adminUploadCSV` updated — commitMessage param added (position 3), response type updated to `{queued, row_count, subjects}`

## Deviations from Plan

None — plan executed exactly as written. The `from datetime import datetime` inline imports were consolidated to top-level as specified.

## Known Stubs

None — all endpoints are fully wired to DB queries. Frontend helpers are exported but not yet consumed by UI components (that happens in Plan 04).

## Self-Check: PASSED
