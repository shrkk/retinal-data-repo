---
phase: 2
slug: backend-and-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test suite exists; validation via curl smoke tests + DB queries |
| **Config file** | none |
| **Quick run command** | `curl -s "$API_BASE/subjects" \| python3 -c "import sys,json; print(json.load(sys.stdin))"` |
| **Full suite command** | See Manual-Only Verifications table below |
| **Estimated runtime** | ~30 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Run quick curl smoke test against local FastAPI (`uvicorn app.main:app --reload`)
- **After every plan wave:** Run full smoke suite (all endpoints + DB row counts)
- **Before `/gsd:verify-work`:** All 13 subjects visible in `/subjects/data`; upload_log entries visible
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-xx | 01 | 1 | BACK-02 | grep | `grep -r "localhost:800" retinal-ui/src/` | N/A | ⬜ pending |
| 02-01-xx | 01 | 1 | BACK-03 | smoke | `curl -s "$API_BASE/subjects/data" \| python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d),'rows')"` | ❌ Wave 0 | ⬜ pending |
| 02-01-xx | 01 | 1 | BACK-04 | smoke | Manual: upload CSV, check upload_log in Supabase SQL editor | ❌ Wave 0 | ⬜ pending |
| 02-01-xx | 01 | 1 | DATA-02 | SQL | `SELECT COUNT(DISTINCT subject_id) FROM cone_data` → must return 13 | ❌ Wave 0 | ⬜ pending |
| 02-01-xx | 01 | 1 | DATA-03 | grep | `ls distribute_meridians.py update_meridians.py 2>&1` → files must be absent | N/A | ⬜ pending |
| 02-01-xx | 01 | 1 | DATA-04 | code review | BackgroundTask wraps parse_csv_bytes call in main.py | N/A | ⬜ pending |
| 02-01-xx | 01 | 1 | INFRA-03 | smoke | `curl -H "Origin: http://localhost:5173" -I "$API_BASE/subjects"` → Access-Control-Allow-Origin present | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test framework exists in this project. Validation is smoke-test based (curl + Supabase SQL editor). No pytest files are required for Phase 2 — real DB validation is more meaningful than mocked unit tests for this data-migration phase.

*Existing infrastructure covers all phase requirements via manual smoke tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/subjects/data` returns all subjects' cone data | BACK-03 | No test suite; live DB required | `curl "$API_BASE/subjects/data" \| python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d), 'rows')"` |
| 13 subjects in cone_data with real meridians | DATA-02 | Requires live Supabase connection | Run in Supabase SQL editor: `SELECT COUNT(DISTINCT subject_id), COUNT(DISTINCT cone_spectral_type) FROM cone_data` |
| upload_log receives entries on CSV upload | BACK-04 extension | UI interaction required | Upload a CSV via /admin, then: `SELECT * FROM upload_log ORDER BY uploaded_at DESC LIMIT 5` |
| CORS header present | INFRA-03 | Browser network tab or curl | `curl -H "Origin: http://localhost:5173" -I "$API_BASE/subjects"` → check Access-Control-Allow-Origin |
| Updates page shows timeline entries | UI | Browser visual check | Navigate to /updates; confirm events appear in reverse-chronological order |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
