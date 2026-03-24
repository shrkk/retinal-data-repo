---
phase: 02
phase_name: Backend and Data
status: draft
created: 2026-03-23
tool: none
registry: not applicable
---

# UI-SPEC: Phase 2 — Backend and Data

## Scope

Three frontend deliverables in this phase:

1. **Navbar** — persistent top bar replacing the current title+ModeToggle row
2. **Updates page** (`/updates`) — vertical timeline of upload events from `upload_log`
3. **Admin upload form** — add optional commit message input field to existing admin upload stage

---

## Design System

**Tool:** none (no shadcn, no tailwind)
**Source:** Custom CSS variables in `retinal-ui/src/styles/globals.css`
**Font:** Space Grotesk (already loaded via Google Fonts import)

All new components MUST use the existing CSS custom properties. Do not introduce new color literals.

### Existing Token Reference

| Token | Light value | Role |
|-------|------------|------|
| `--background` | `oklch(1 0 0)` (white) | Page surface |
| `--foreground` | `oklch(0.145 0 0)` (near-black) | Primary text |
| `--card` | `oklch(1 0 0)` (white) | Card surface |
| `--card-foreground` | `oklch(0.145 0 0)` | Card text |
| `--secondary` | `oklch(0.97 0 0)` (light grey) | Navbar surface, secondary backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` (mid grey) | Timestamps, secondary text, absent commit message |
| `--border` | `oklch(0.922 0 0)` | Borders, dividers, dashed timeline line |
| `--primary` | `oklch(0.205 0 0)` (near-black) | Active nav item fill, primary buttons |
| `--primary-foreground` | `oklch(0.985 0 0)` (off-white) | Text on primary fill |
| `--ring` | `oklch(0.708 0 0)` | Focus rings |
| `--radius` | `0.625rem` | Border radius for cards, pills, inputs |
| `--destructive` | `oklch(0.577 0.245 27.325)` (red) | Destructive actions only |

Dark mode tokens are already defined in `.dark {}` — do not override. All new CSS must inherit these variables so dark mode works without extra code.

---

## Spacing Scale

8-point scale. All spacing values in new components MUST be multiples of 4px.

| Step | Value | Typical use |
|------|-------|-------------|
| 1 | 4px | Icon gap, tight internal padding |
| 2 | 8px | Inline element gap, compact padding |
| 3 | 16px | Card internal padding (horizontal), form field gap |
| 4 | 24px | Card internal padding (vertical), section spacing |
| 5 | 32px | Between timeline cards |
| 6 | 48px | Page top/bottom padding |
| 7 | 64px | Max content column lateral margin |

**Exceptions:**
- Navbar height: 56px (not a standard step — needed for 44px touch targets + 6px top/bottom breathing room)
- Timeline node dot: 12px diameter, centered on the dashed line
- Event type badge pill: 20px height, 8px horizontal padding

---

## Typography

**Font family:** `"Space Grotesk", "Inter", -apple-system, sans-serif` (existing `font-family` on `body`)

### Sizes (4 total)

| Role | Size | Weight | Line-height | Token |
|------|------|--------|-------------|-------|
| Page heading | 20px (1.25rem) | 600 | 1.2 | — |
| Body / card content | 16px (1rem) | 400 | 1.5 | — |
| Secondary / metadata | 14px (0.875rem) | 400 | 1.5 | `--muted-foreground` |
| Timestamp pill label | 12px (0.75rem) | 500 | 1 | — |

### Weights (2 total)

- **400** (regular) — body text, metadata, commit message
- **600** (semibold) — headings, nav labels, subject ID on cards

---

## Color Contract

### 60/30/10 Split

| % | Token | Elements |
|---|-------|----------|
| 60% | `--background` | Page surface, empty areas |
| 30% | `--secondary` / `--card` | Navbar surface, timeline cards |
| 10% | `--primary` | Active nav item, primary buttons |

### Accent (reserved for specific elements only)

The existing `--accent` token (`oklch(0.97 0 0)`) is grey — effectively the same as `--secondary`. For semantic color in this phase, use the following hard-coded semantic colors (no new token introduction — inline as CSS or a scoped class):

| Semantic | Hex equivalent | Element |
|----------|---------------|---------|
| New Patient badge | `#16a34a` (green-600) | `event_type = 'new_patient'` pill background |
| New Patient badge text | `#ffffff` | Text inside green pill |
| Update badge | `#d97706` (amber-600) | `event_type = 'update'` pill background |
| Update badge text | `#ffffff` | Text inside amber pill |

These two semantic colors are ONLY used for event type badges. They must not appear anywhere else in the UI.

### Destructive

`--destructive` is reserved for future destructive actions. No destructive actions exist in this phase.

---

## Component Specifications

### 1. Navbar (`Navbar.tsx`)

**Layout:** Full-width horizontal bar, fixed to top of viewport. All views render beneath it with a 56px top offset.

**Dimensions:**
- Height: 56px
- Internal padding: 0 24px
- Max-width content: 1200px, centered

**Surface:** `background-color: var(--secondary)` with `border-bottom: 1px solid var(--border)`

**Items:**
| Label | View state | Icon |
|-------|-----------|------|
| Viewer | `"main"` | none |
| Updates | `"updates"` | none |
| Admin | `"admin"` | lock icon (16px, inline SVG or lucide if available) |

**Active state:** Active item gets `background-color: var(--primary)` + `color: var(--primary-foreground)` + `border-radius: var(--radius)`. Inactive items get `color: var(--foreground)` + transparent background. Hover on inactive: `background-color: var(--accent)`.

**Item dimensions:** Padding 8px 16px. Min-touch-target 44px height (use line-height + padding to reach this).

**Right slot:** `ModeToggle` component (already exists) positioned at far right, same vertical center.

**Implementation note:** Receives `view: "main" | "admin" | "updates"` and `onNavigate: (v: "main" | "admin" | "updates") => void` as props (matches RESEARCH.md Pattern 4).

---

### 2. Updates Page (`UpdatesPage.tsx`)

**Route:** `view === "updates"` in state router
**Auth:** None — public read-only
**Data source:** `GET /upload-log` → array of `UploadLogEntry` sorted newest-first

**Page layout:**
- Top heading: "Upload History" at 20px/600 weight
- Subheading: "All data uploads, newest first." at 14px/400 weight, `--muted-foreground`
- Content column: max-width 720px, centered, padding 48px 24px
- Navbar is always present (inherited from App.tsx wrapper)

**Empty state:** When `GET /upload-log` returns an empty array, show:
- Icon: a simple upload/inbox SVG (24px)
- Heading: "No uploads yet"
- Body: "Data will appear here after the first admin upload."
- Color: `--muted-foreground` for both lines

**Loading state:** Show 3 skeleton timeline cards (grey `--secondary` rectangles with the same height as a real card). No spinner. Opacity 0.5, no animation (keep it simple per CONTEXT.md).

**Error state:** When `GET /upload-log` fails, show:
- Message: "Could not load upload history. Check your connection and refresh the page."
- Color: `--muted-foreground`

#### Timeline Layout

```
  [time pill]    ┆  [card]
  [time pill]    ┆  [card]
  [time pill]    ┆  [card]
```

- **Left column width:** 96px — contains the time pill, right-aligned
- **Timeline line:** A vertical dashed line (`border-left: 2px dashed var(--border)`) running the full height of the timeline column, positioned at the right edge of the left column (i.e., between pill and card)
- **Node dot:** 12px × 12px circle, `background: var(--border)`, absolutely positioned on the dashed line at the vertical center of each card
- **Gap between left column and card:** 24px
- **Card-to-card gap:** 32px

#### Time Pill

- Container: `background: var(--secondary)`, `border: 1px solid var(--border)`, `border-radius: 999px`
- Padding: 4px 10px
- Font: 12px / weight 500 / `--foreground`
- Content: time only, e.g. `"2:30 PM"` (not date — date is inside the card)

#### Timeline Card

**Dimensions:** Full width of right column. Padding: 16px 20px. Border-radius: `var(--radius)`. Background: `var(--card)`. Box-shadow: `0 1px 3px oklch(0 0 0 / 0.08)` (subtle, matches CONTEXT.md "white cards with subtle shadow").

**Card anatomy (top to bottom):**

1. **Header row** — flex, space-between, align-items center
   - Left: Subject ID + Eye — `"Subject OD-03 — Right Eye"` format, 16px/600
   - Right: Event type badge pill (see below)

2. **Timestamp row** — 14px/400/`--muted-foreground`
   - Format: `"2 hours ago — Mar 23, 2026 2:30 PM"`
   - Use `Intl.RelativeTimeFormat` + `Intl.DateTimeFormat` (RESEARCH.md code example)

3. **Rows ingested** — 14px/400/`--muted-foreground`
   - Format: `"1,204 rows ingested"`

4. **Commit message** — shown only when non-null
   - Format: `"↳ Added right-eye baseline for OD-03"` (leading arrow prefix for visual grouping)
   - Font: 14px/400/`--foreground` (not muted — it's human content)
   - If null: element is not rendered (no placeholder text, no empty line)

**Event type badge:**
- Pill shape: `border-radius: 999px`, padding `2px 10px`, height 20px
- `new_patient`: `background: #16a34a`, `color: #ffffff`, label: `"New Patient"`
- `update`: `background: #d97706`, `color: #ffffff`, label: `"Update"`
- Font: 12px/500

---

### 3. Admin Upload Form — Commit Message Field

**Where:** Added to the existing `AdminPage.tsx` upload stage (between file drop zone and the Submit/Upload button).

**Field spec:**
- Element: `<input type="text">`
- Label: `"Commit message"` (14px/400, `--foreground`)
- Placeholder: `"Describe this upload…"`
- Optional — no asterisk, no required validation
- Max length: 500 characters (enforced via `maxLength={500}` HTML attribute)
- Width: 100% of form container
- Styling: inherits existing `globals.css` input styles (`var(--input)` background, `var(--border)` border, `var(--radius)` radius)
- Character counter: not shown in v1

**Form data wiring:** `formData.append("commit_message", commitMessage)` before the `fetch` call in `adminUploadCSV` (matches RESEARCH.md code example). Send only when non-empty.

---

## Interaction States

| Element | States |
|---------|--------|
| Navbar item | default, hover, active (current view), focus-visible |
| Timeline card | static only (no hover effect) |
| Commit message input | default, focus (2px ring `var(--ring)`), hover (border → `var(--ring)`) |
| Event badge | static only |
| Updates page | loading (skeleton), empty, error, populated |

**Focus:** All interactive elements (navbar items, commit message input) must have `outline: 2px solid var(--ring); outline-offset: 2px` on `:focus-visible`. Inherits from existing `globals.css` rule.

**No animations:** Per CONTEXT.md, timeline fade-in on scroll is optional but defaulting to none. Keep it simple. No transitions except what globals.css already applies (`transition: all 0.2s ease` on inputs/buttons).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Navbar — Viewer link | `"Viewer"` |
| Navbar — Updates link | `"Updates"` |
| Navbar — Admin link | `"Admin"` |
| Updates page heading | `"Upload History"` |
| Updates page subheading | `"All data uploads, newest first."` |
| Empty state heading | `"No uploads yet"` |
| Empty state body | `"Data will appear here after the first admin upload."` |
| Error state | `"Could not load upload history. Check your connection and refresh the page."` |
| Commit message label | `"Commit message"` |
| Commit message placeholder | `"Describe this upload…"` |
| Event badge — new patient | `"New Patient"` |
| Event badge — update | `"Update"` |
| Timestamp format | `"{N} hours ago — {Mon D, YYYY H:MM AM/PM}"` |
| Rows ingested format | `"{N,NNN} rows ingested"` |
| Subject + eye format | `"Subject {id} — {Right Eye / Left Eye}"` |
| Commit message prefix | `"↳ {message}"` |

**Eye label mapping:**
- `"OD"` or `"right"` → `"Right Eye"`
- `"OS"` or `"left"` → `"Left Eye"`
- Unknown value → render raw value as-is

---

## Accessibility

- Navbar: `<nav aria-label="Main navigation">` wrapping element. Active link gets `aria-current="page"`.
- Timeline: `<ol>` (ordered list, newest-first is meaningful order). Each entry is `<li>`.
- Event badges: rendered as `<span>` with visually complete text — no icon-only badges.
- Commit message input: `<label htmlFor="commit-message">` explicitly associated via `id`.
- Color contrast: green `#16a34a` on white = 4.6:1 (passes AA for large text at 12px/500); amber `#d97706` on white = 2.7:1. Because badge text is small (12px), use white text on both — contrast is acceptable given pill is supplemental (event type is also communicated by label text, not color alone).

---

## Registry

**shadcn:** Not initialized. No `components.json` found.
**Third-party registries:** None.
**Registry safety gate:** Not applicable.

---

## What Is NOT in Scope for This Phase

Per CONTEXT.md `<deferred>` and REQUIREMENTS.md:

- Pagination or filtering on the Updates page
- Per-user attribution (store `"admin"` as placeholder)
- Undo/rollback actions from the timeline
- NC cone coloring or stats panel (Phase 3)
- Meridian filter UI changes (Phase 3)

---

## Pre-Population Sources

| Field | Source |
|-------|--------|
| Font family | `retinal-ui/src/styles/globals.css` — direct read |
| Color tokens | `retinal-ui/src/styles/globals.css` — direct read |
| Border radius | `retinal-ui/src/styles/globals.css` — `--radius: 0.625rem` |
| Routing pattern | RESEARCH.md Pattern 4 — `useState` union type |
| Navbar items + routes | CONTEXT.md Decisions → Navbar Restructure |
| Timeline visual reference | CONTEXT.md `<specifics>` — dashed border, time pill, white cards |
| Event badge colors | CONTEXT.md `<specifics>` — green "New Patient", amber "Update" |
| Commit message field | CONTEXT.md Decisions → Upload Form Change |
| Timestamp format | CONTEXT.md Decisions → Timeline card per entry |
| Copywriting (placeholder, label) | CONTEXT.md Decisions — "Describe this upload…" |
| Deferred features | CONTEXT.md `<deferred>` — pagination, filtering, undo |
