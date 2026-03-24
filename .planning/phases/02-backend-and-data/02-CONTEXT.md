# Phase 2: Backend and Data — Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Source:** User discussion

<domain>
## Phase Boundary

Phase 2 delivers two things:
1. **Data plumbing** — all FastAPI routes fully connected to Supabase PostgreSQL, bulk endpoint, ingestion pipeline for all 13 subjects, fake-meridian scripts deleted.
2. **Upload changelog system** — a new `upload_log` table + backend logic that records every CSV upload as a timestamped event ("new patient" or "update"), with an optional admin commit message. A new Updates page in the frontend displays these events as a vertical timeline.

</domain>

<decisions>
## Implementation Decisions

### Upload Detection Logic (Backend — BACK-04 Extension)

`POST /admin/upload` must detect **before** inserting whether the uploaded data is a "new patient" or an "update":

- **Update case**: If a `(patient_id, eye)` pair already exists in `cone_data` → flag as `event_type = 'update'`
- **New patient case**: If neither `patient_id` nor `eye` exist for any row → flag as `event_type = 'new_patient'`
- Detection must happen inside the BackgroundTask, after bytes are read and before rows are written
- A `commit_message` field (optional string, max 500 chars) is accepted in the upload form and stored alongside the event

### Upload Log Table (Database)

New table `upload_log` with at minimum:
- `id` (serial or uuid primary key)
- `uploaded_at` TIMESTAMPTZ DEFAULT now()
- `subject_id` TEXT (the patient/subject identifier from the CSV)
- `eye` TEXT
- `event_type` TEXT — 'new_patient' or 'update'
- `commit_message` TEXT NULLABLE
- `rows_ingested` INTEGER
- `uploaded_by` TEXT NULLABLE (reserved for future auth — can store IP or 'admin' for now)

### Upload Form Change (Admin Page)

The admin upload form on the existing upload page gains a **Commit message** text input (optional, placeholder: "Describe this upload…"). This value is sent as a form field alongside the CSV file to `POST /admin/upload`.

### Updates Page (Frontend)

A new standalone page `/updates` that shows a vertical timeline of all entries from `upload_log`, ordered newest-first.

**Timeline card per entry:**
- Timestamp (formatted as relative + absolute, e.g. "2 hours ago — Mar 23, 2026 14:30")
- Event type badge: green "New Patient" or amber "Update"
- Subject ID + Eye
- Rows ingested count
- Commit message (shown if present; hidden/greyed if null)

**Visual reference:** Clean vertical timeline with a dashed left border/line connecting time nodes (see attached image). Cards are white with subtle shadow. Times shown in pill/chip style on the left.

### Navbar Restructure (Frontend)

Replace the current single-page layout with a persistent top navbar containing three items:
1. **Viewer** (main page `/`) — retinal scatter viewer
2. **Updates** (`/updates`) — changelog timeline
3. **Admin** (login button → `/admin`) — shown as a lock/key icon or "Admin Login" label; navigates to the password-protected upload page

Active route should be highlighted in the navbar.

### Claude's Discretion

- Navbar styling (exact colors, fonts) should match existing app design system — check `retinal-ui/src` for current palette
- React Router (or existing routing setup) should be used — do not introduce a new routing library
- Timeline animation (fade-in on scroll) is optional, keep it simple
- Pagination or infinite scroll for upload_log is optional; a limit of 100 most recent entries is acceptable for v1
- Backend endpoint for the updates page: `GET /upload-log` returning all entries sorted by `uploaded_at DESC`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend / API
- `main.py` — FastAPI app entry point; all routes defined here
- `filecleaner.py` — CSV processing script invoked via BackgroundTask
- `config.py` or `settings.py` (if exists) — pydantic-settings config

### Frontend
- `retinal-ui/src/` — React app source; check for existing routing setup, component patterns, and design tokens
- `retinal-ui/src/App.tsx` (or `main.tsx`) — top-level routing/layout
- `retinal-ui/src/components/` — existing UI components to reuse/extend

### Planning Artifacts
- `.planning/REQUIREMENTS.md` — BACK-02, BACK-03, BACK-04, DATA-02, DATA-03, DATA-04, INFRA-03
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria

</canonical_refs>

<specifics>
## Specific Ideas

- Timeline UI reference: vertical dashed left border, time nodes as small pill chips (e.g. "10.30 AM"), cards to the right with content. Cards are clean white rectangles with minimal shadow. See attached image.
- Event type badges should be visually distinct: green pill for "New Patient", amber/orange pill for "Update"
- The commit message on the upload form should be a single-line `<input type="text">` (not textarea), optional
- The Updates page requires no authentication — it is public read-only
- The `upload_log` table should be created via a SQL migration, consistent with how Phase 1 created the `cone_data` table schema

</specifics>

<deferred>
## Deferred Ideas

- Per-user attribution (currently store 'admin' as uploaded_by placeholder)
- Filtering/search on the Updates page (v2)
- Pagination on the Updates page (v1 cap: 100 entries)
- Undo/rollback from the timeline (out of scope)

</deferred>

---

*Phase: 02-backend-and-data*
*Context gathered: 2026-03-23 via user discussion*
