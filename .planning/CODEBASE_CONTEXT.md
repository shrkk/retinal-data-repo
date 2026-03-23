# Codebase Context: SabLab Retinal Cones Viewer

**Generated:** 2026-03-22
**Repository:** `/Users/shrey/uwoph-retinal-viewer/retinal-data-repo`

---

## 1. Architecture Overview

### What the System Does

SabLab Retinal Cones Viewer is a scientific data visualization tool built for an ophthalmology research lab (UW Ophthalmology / "SabLab"). It allows researchers to:

- Browse retinal cone photoreceptor data from adaptive optics (AO) imaging studies
- Filter by subject, eye meridian (temporal/nasal/superior/inferior), and cone spectral type (L/M/S)
- Visualize cone spatial positions as 2D scatter plots organized by eccentricity (distance from fovea in degrees)
- View per-sample metadata (FOV, L/M ratio, cone densities, etc.)
- Download raw CSV files from cloud storage

The data represents individual cone photoreceptor cells classified by spectral type (Long/Medium/Short wavelength, i.e., red/green/blue cones) with their precise x/y locations in microns on the retina.

### High-Level Architecture

```
┌─────────────────────────────┐     HTTP (port 5173)
│  React Frontend (Vite)      │ ◄──────────────────── Browser
│  retinal-ui/                │
│  - FilterBar                │
│  - EccentricitySubPlots     │
│  - ConePlot (unused)        │
└──────────┬──────────────────┘
           │ REST API calls (http://127.0.0.1:8001)
           ▼
┌─────────────────────────────┐
│  FastAPI Backend (Python)   │
│  app/main.py                │
│  - /patients                │
│  - /cones                   │
│  - /plot-data               │
│  - /metadata                │
│  - /eccentricity-ranges     │
│  - /cones/export            │
└──────────┬──────────────────┘
           │ aiosqlite (async)
           ▼
┌─────────────────────────────┐
│  SQLite Database            │
│  retinal_data.db            │
│  - cone_data table          │
└─────────────────────────────┘

   ┌──────────────────────────┐
   │  Supabase Storage        │
   │  bucket: "raw-csvs"      │ ◄── CSV download (frontend only)
   └──────────────────────────┘
```

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Backend language | Python 3 |
| Backend framework | FastAPI 0.116.1 |
| ASGI server | Uvicorn 0.35.0 |
| Database | SQLite (via `aiosqlite` async driver) |
| Frontend language | TypeScript 5.8 |
| Frontend framework | React 19 |
| Frontend build tool | Vite 7 |
| Charting | Plotly.js 3 + react-plotly.js 2.6 |
| Cloud storage | Supabase Storage (for CSV downloads) |
| Fonts | Space Grotesk (Google Fonts) |

---

## 2. File Structure

```
retinal-data-repo/
│
├── app/                          # Python FastAPI backend
│   ├── __init__.py               # Empty init file
│   ├── main.py                   # ALL backend logic, API routes, DB queries
│   ├── models.py                 # PlotData Pydantic model (largely redundant with main.py)
│   └── static/
│       └── plot.html             # Legacy standalone HTML prototype (not served in production)
│
├── retinal-ui/                   # React/TypeScript frontend
│   ├── src/
│   │   ├── main.tsx              # App entry point, wraps App in ThemeProvider
│   │   ├── App.tsx               # Root component: layout + filter state + EccentricitySubPlots
│   │   ├── App.css               # Legacy Vite scaffold CSS (mostly unused)
│   │   ├── index.css             # Legacy Vite scaffold CSS (mostly unused)
│   │   ├── vite-env.d.ts         # Vite type declarations
│   │   ├── styles/
│   │   │   └── globals.css       # Active design system: CSS custom properties, dark mode, base styles
│   │   ├── types.ts              # Old/minimal type file (superseded by types/index.ts)
│   │   ├── types/
│   │   │   └── index.ts          # Authoritative TypeScript types: Patient, PlotData, EccentricityRange, Filters, Metadata
│   │   ├── api/
│   │   │   └── index.ts          # All API calls to backend + Supabase CSV download
│   │   ├── assets/
│   │   │   └── react.svg         # Vite scaffold asset (unused)
│   │   └── components/
│   │       ├── FilterBar.tsx     # Top control bar: subject/meridian/cone-type selectors + download button
│   │       ├── EccentricitySubPlots.tsx  # MAIN VIEWER: tabbed plots per eccentricity range
│   │       ├── ConePlot.tsx      # Reusable single scatter plot component (currently unused in routing)
│   │       ├── EccentricityRangeSelector.tsx  # Dropdown multi-select for eccentricity ranges (currently unused)
│   │       ├── mode-toggle.tsx   # Light/dark/system theme toggle button
│   │       └── theme-provider.tsx  # React context for theme state + localStorage persistence
│   ├── public/
│   │   ├── index.html            # Vite scaffold public HTML (unused, see root index.html)
│   │   └── vite.svg              # Vite scaffold asset (unused)
│   ├── index.html                # Actual HTML entry point (root div #root)
│   ├── vite.config.ts            # Vite config: react plugin only
│   ├── tsconfig.json             # TS project references config
│   ├── tsconfig.app.json         # TS strict config for src/
│   ├── tsconfig.node.json        # TS config for vite.config.ts
│   ├── eslint.config.js          # ESLint with react-hooks + react-refresh plugins
│   ├── package.json              # Frontend dependencies
│   └── package-lock.json
│
├── sampleAO001fix.csv            # Sample data file: 1229 cone records for subject AO001
├── requirements.txt              # Python dependencies (wide-character encoding - appears UTF-16)
├── setup_db.py                   # One-time script: creates SQLite DB + imports sampleAO001fix.csv
├── filecleaner.py                # Data pipeline: parses raw AO instrument CSV → normalized flat CSV
├── distribute_meridians.py       # One-off migration: randomly assigns cones to meridians (AO001 only)
├── fix_metadata_and_limits.py    # One-off migration: propagates metadata to all rows for AO001
├── update_meridians.py           # One-off migration: sets NULL meridians to 'temporal'
├── update_subjects.py            # One-off migration: sets NULL subject_ids to 'AO001'
├── check_data.py                 # Diagnostic script: queries DB to verify data integrity
├── debug_csv.py                  # Diagnostic script: inspects CSV field values
├── simple_server.py              # Alternate/earlier version of main.py (no export, simpler metadata)
├── test_api.py                   # Manual integration test: calls /patients endpoint
├── test_db.py                    # Manual DB connection test using asyncpg + Supabase PostgreSQL URL
├── package.json                  # Root-level package.json (only @types/react-plotly.js dev dep)
├── package-lock.json
└── .gitignore                    # Ignores: .db, .sqlite3, .env, node_modules, __pycache__
```

---

## 3. Data Models

### SQLite Schema: `cone_data` table

Defined in `setup_db.py`, populated from CSV files.

```sql
CREATE TABLE cone_data (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Cone position data (primary visualization values)
    cone_x_microns      REAL,         -- X coordinate of cone center on retina (microns)
    cone_y_microns      REAL,         -- Y coordinate of cone center on retina (microns)
    cone_spectral_type  TEXT,         -- 'L', 'M', or 'S'

    -- Subject metadata
    subject_id          TEXT,         -- e.g., 'AO001'
    age                 INTEGER,      -- Subject age in years
    eye                 TEXT,         -- 'OD' (right) or 'OS' (left)
    meridian            TEXT,         -- 'temporal', 'nasal', 'superior', 'inferior'

    -- Eccentricity (distance from foveal center)
    eccentricity_deg    REAL,         -- Distance from fovea in degrees
    eccentricity_mm     TEXT,         -- Distance from fovea in mm (stored as tuple string or scalar)
    ret_mag_factor      REAL,         -- Retinal magnification factor (microns/degree)

    -- Imaging metadata
    fov                 TEXT,         -- Field of view (e.g., "0.08 x 0.19" degrees)
    lm_ratio            REAL,         -- L-to-M cone ratio (e.g., 2.1)
    scones              REAL,         -- Percentage of S cones
    lcone_density       REAL,         -- L cone density (cones/mm²)
    mcone_density       REAL,         -- M cone density (cones/mm²)
    scone_density       REAL,         -- S cone density (cones/mm²)
    numcones            INTEGER,      -- Total number of selected cones in this sample
    nonclass_cones      INTEGER,      -- Number of unclassified cones
    cone_origin         TEXT,         -- Description of image origin (e.g., "Top-left corner of FOV")

    -- Zernike wavefront correction parameters
    zernike_pupil_diam  REAL,         -- Pupil diameter for Zernike measurement (mm)
    zernike_measure_wave REAL,        -- Wavelength used for Zernike measurement (nm)
    zernike_optim_wave  REAL          -- Wavelength optimized for Zernike correction (nm)
)
```

**Important data quirk:** Metadata fields (subject_id, age, eye, meridian, eccentricity_deg, fov, etc.) are denormalized — they are stored on the **first row only** of each data block in the source CSV. The migration scripts (`fix_metadata_and_limits.py`) propagate metadata across all rows for a given subject. Some records may still have NULL metadata fields depending on migration state.

### TypeScript Types (`retinal-ui/src/types/index.ts`)

```typescript
interface Patient {
  subject_id: string;     // e.g., "AO001"
  age: number;
  eye: string;            // "OD" or "OS"
  eye_description: string; // "Right Eye" or "Left Eye"
}

interface PlotData {
  x: number[];            // cone_x_microns values
  y: number[];            // cone_y_microns values
  cone_type: string[];    // "L", "M", or "S" for each point
}

interface EccentricityRange {
  min: number;   // lower bound in degrees
  max: number;   // upper bound in degrees
  label: string; // display string, e.g., "0.4°"
}

interface Filters {
  subjectId?: string;
  meridian?: string;
  coneTypes?: string[];
  eccentricityRanges?: EccentricityRange[];
}

interface Metadata {
  fov?: string;
  lm_ratio?: number;
  scones?: number;
  lcone_density?: number;
  mcone_density?: number;
  scone_density?: number;
  numcones?: number;
  filtered_total_cones?: number;
  filtered_l_cones?: number;
  filtered_m_cones?: number;
  filtered_s_cones?: number;
  eye?: string;
  eye_description?: string;
}
```

**Note:** There is a legacy `retinal-ui/src/types.ts` file with a minimal `Patient` type (missing `eye`/`eye_description`) and `PlotData`. The active types are in `retinal-ui/src/types/index.ts`. The legacy file is imported by `EccentricityRangeSelector.tsx` (which is itself unused in the current routing).

### Pydantic Models (`app/models.py` and inline in `app/main.py`)

```python
class PlotData(BaseModel):
    x: List[float]
    y: List[float]
    cone_type: List[str]
```

This model is defined twice — once in `app/models.py` and once inline at the top of `app/main.py`. Only the inline version in `main.py` is actually used. `models.py` is an unused artifact.

---

## 4. API Endpoints

All endpoints are on the FastAPI server at `http://127.0.0.1:8001`. Defined in `app/main.py`.

### `GET /patients`

Returns distinct subjects in the database.

**Query params:** None

**Response:** Array of patient objects
```json
[
  {
    "subject_id": "AO001",
    "age": 41,
    "eye": "OD",
    "eye_description": "Right Eye"
  }
]
```
**SQL:** `SELECT DISTINCT subject_id, age, eye, ... FROM cone_data WHERE subject_id IS NOT NULL ORDER BY subject_id LIMIT 1000`

---

### `GET /cones`

Returns full cone records with flexible filtering. Used for raw data access (not primary visualization path).

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `subject_id` | string | Filter by subject |
| `meridian` | string | Filter by meridian |
| `cone_spectral_type` | string | Filter by single cone type |
| `age_min` | int | Minimum subject age |
| `age_max` | int | Maximum subject age |
| `limit` | int | Max records (default 50000, max 100000) |
| `offset` | int | Pagination offset (default 0) |

**Response:** Array of full `cone_data` row objects (all columns).

---

### `GET /plot-data`

Returns cone x/y coordinates optimized for Plotly scatter visualization.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `subject_id` | string | Filter by subject |
| `meridian` | string | Filter by meridian |
| `cone_spectral_type` | string[] | Multiple allowed (repeating param) |
| `eccentricity_min` | float | Min eccentricity in degrees |
| `eccentricity_max` | float | Max eccentricity in degrees |
| `limit` | int | Max records (default 50000) |

**Response:**
```json
{
  "x": [1.6, 2.3, 2.8],
  "y": [41.1, 47.3, 53.5],
  "cone_type": ["M", "L", "S"]
}
```
Arrays are parallel — index `i` in `x`, `y`, and `cone_type` all refer to the same cone.

---

### `GET /metadata`

Returns statistical summary for a filtered subset of data.

**Query params:** Same as `/plot-data` (subject_id, meridian, cone_spectral_type[], eccentricity_min, eccentricity_max)

**Response:**
```json
{
  "fov": "0.08 x 0.19",
  "lm_ratio": 2.1,
  "scones": 3.3,
  "lcone_density": 53057.8,
  "mcone_density": 25018.6,
  "scone_density": 2626.6,
  "numcones": 1229,
  "eye": "OD",
  "eye_description": "Right Eye",
  "filtered_total_cones": 856,
  "filtered_l_cones": 612,
  "filtered_m_cones": 244,
  "filtered_s_cones": 0
}
```
Returns `{}` if no matching data. The non-`filtered_*` fields come from the first matching row (denormalized metadata). The `filtered_*` counts are computed dynamically via `COUNT(CASE WHEN ...)`.

---

### `GET /eccentricity-ranges`

Returns available eccentricity measurement points for a subject+meridian combination. Each distinct `eccentricity_deg` value becomes a ±0.05° range window.

**Query params:** `subject_id` (required), `meridian` (required)

**Response:**
```json
{
  "ranges": [
    { "min": 0.35, "max": 0.45, "label": "0.4°" },
    { "min": 1.45, "max": 1.55, "label": "1.5°" }
  ]
}
```
The range window is hardcoded at `range_size = 0.1` degrees centered on each distinct eccentricity value.

---

### `GET /cones/export`

Streaming CSV download of filtered cone data.

**Query params:** `subject_id` (required), `meridian` (required), `cone_spectral_type[]`, `eccentricity_min`, `eccentricity_max`, `limit` (default 10000)

**Response:** `text/csv` streaming response with `Content-Disposition: attachment; filename=...`

Filename format: `{subject_id}_{meridian}_{cone_types}{_eccMin-Max}_cones.csv`

**Note:** This endpoint exists but the frontend's "Download CSV" button does **NOT** call it. The frontend uses Supabase Storage instead (see Section 8 on limitations).

---

## 5. Business Logic

### Backend (`app/main.py`)

**Database connection:** Uses `aiosqlite` for async access. The database path is resolved to absolute at startup relative to `main.py`'s location (`../retinal_data.db` from the app/ directory). Configurable via `DATABASE_URL` env var.

**CORS:** Hardcoded to allow `http://localhost:5173` and `http://127.0.0.1:5173` (Vite dev server defaults) plus any origins in `ALLOWED_ORIGINS` env var.

**Port:** Configurable via `PORT` env var, defaults to `8001`.

**Query building pattern:** All endpoints dynamically build `WHERE` clauses by appending to `where_clauses` list and `params` list, then joining with `AND`. This prevents SQL injection via parameterized queries. The `cone_spectral_type` multi-value filter uses `IN (?, ?, ?)` with dynamic placeholders.

**Eccentricity range algorithm** (in `/eccentricity-ranges`):
1. Query all distinct `eccentricity_deg` values for the subject+meridian
2. Sort them
3. For each value `ecc`, create window: `min = max(0, ecc - 0.05)`, `max = ecc + 0.05`
4. Label as `"X.X°"`

This means plots from `/eccentricity-ranges` will only contain cones from a very narrow 0.1° band. This is intentional — each eccentricity in the raw data represents a distinct imaging session/location.

**CSV export logic:** Separates "cone fields" (x, y, type) from "meta fields" (everything else), puts cone fields first in output columns. Uses `asyncio.sleep(0)` between rows to yield control in the async generator.

### Data Pipeline Scripts

**`filecleaner.py`** (the most complex script):
- Input: Raw AO instrument CSV (`AO001R_v1.csv`) with multi-block layout
- The raw format has repeating column groups per eccentricity measurement: `Cone x location (microns)`, `Cone y location (microns)`, `Cone spectral type`, plus `Parameter_Name.*` / `Values.*` metadata columns
- Algorithm: Iterates column suffixes (`.0`, `.1`, `.2`, ...) to find all cone data blocks
- Maps each `Parameter_Name.*` column to the nearest `Values.*` column by column index proximity
- Parses tuple strings like `"(0.4,0)"` for eccentricity values using regex
- Calculates scalar eccentricity from x/y components: `eccentricity_deg = hypot(x_deg, y_deg)`
- Outputs a normalized flat CSV matching `sampleAO001fix.csv` column order

**One-off migration scripts (all operate on `retinal_data.db`):**
- `update_subjects.py`: Fills NULL `subject_id` → `'AO001'` (compensates for CSV denormalization)
- `update_meridians.py`: Fills NULL `meridian` → `'temporal'`
- `distribute_meridians.py`: Randomly assigns cones across 4 meridians (this was for demo/testing — real data has actual meridian values)
- `fix_metadata_and_limits.py`: Copies metadata from first non-null row to all rows for AO001

### Frontend Logic

**Subject ID display convention:** The database stores `subject_id` as bare string (e.g., `"AO001"`) and `eye` separately (`"OD"`/`"OS"`). The UI combines these into display IDs like `"AO001R"` (OD → R) or `"AO001L"` (OS → L). When sending API calls, the display ID is parsed back to bare `subject_id` by stripping trailing `R` or `L`.

```typescript
// FilterBar.tsx
const getDisplayId = (patient: Patient): string => {
  const eyeSuffix = patient.eye === 'OD' ? 'R' : patient.eye === 'OS' ? 'L' : '';
  return `${patient.subject_id}${eyeSuffix}`;
};

const parseSubjectId = (displayId: string): string => {
  return displayId.replace(/[RL]$/, '');
};
```

**EccentricitySubPlots orchestration:**
1. On filter change (subject, meridian, coneTypes): fetch `/eccentricity-ranges`
2. For each range returned: simultaneously fetch `/plot-data` + `/metadata` (via `Promise.all`)
3. Store results as `SubPlotData[]` array
4. Render tab navigation buttons (one per range)
5. Show one plot at a time via `selectedRange` index

**Plotly configuration (in EccentricitySubPlots.tsx):**
- Aspect ratio locked 1:1 (`scaleanchor: "y"`, `scaleratio: 1`)
- X/Y axes have no tick labels (just spatial positions)
- Axis range: `[min(data) - 2, max(data) + 2]` microns
- No pan/lasso/select tools; zoom and download allowed
- Fixed 100μm scale bar overlaid as absolute-positioned div

---

## 6. Frontend Components

### Component Tree

```
main.tsx
└── ThemeProvider (theme-provider.tsx)
    └── App (App.tsx)
        ├── <h1>SabLab: Retinal Cones Viewer</h1>
        ├── ModeToggle (mode-toggle.tsx)
        ├── FilterBar (FilterBar.tsx)
        │   ├── <select> Subject dropdown
        │   ├── <select> Meridian dropdown
        │   ├── <checkbox> L/M/S cone type toggles
        │   └── <button> Download CSV
        └── EccentricitySubPlots (EccentricitySubPlots.tsx)  [conditional on filters]
            ├── View info bar ("N ranges found")
            ├── Range nav buttons (one per eccentricity)
            └── renderSinglePlot()
                ├── <Plot> (react-plotly.js scatter)
                ├── Scale bar overlay (100μm)
                └── Metadata overlay panel
                    ├── Eccentricity range label
                    ├── Cone type counts (L/M/S with color dots)
                    └── Summary (eye, FOV, L/M ratio, S cone %)
```

### Components Not Used in Current Routing

- **`ConePlot.tsx`**: A full-featured single plot with metadata overlay. It accepts `data: PlotData | null` and `metadata?: Metadata`. Similar to the plot rendered inside `EccentricitySubPlots.tsx` but has axis labels ("X (microns)", "Y (microns)") and slightly larger markers (size 9 vs 8). It is not imported anywhere in the current app.

- **`EccentricityRangeSelector.tsx`**: A dropdown multi-select component for choosing multiple eccentricity ranges. It is not imported anywhere. It uses the old `../types` import path (legacy type file).

### State Management

No external state library (no Redux, Zustand, etc.). All state is component-local React `useState`:

| Component | State |
|-----------|-------|
| `App.tsx` | `filters: any` — the selected filter values passed to EccentricitySubPlots |
| `FilterBar.tsx` | `patients[]`, `subjectId`, `meridian`, `coneTypes[]`, `eccMin`, `eccMax` |
| `EccentricitySubPlots.tsx` | `subPlots: SubPlotData[]`, `selectedRange: number`, `loading: boolean` |
| `EccentricityRangeSelector.tsx` | `availableRanges[]`, `isOpen`, `loading` (unused component) |
| `ThemeProvider` | `theme: "light" | "dark" | "system"` (persisted to localStorage) |

**Filter flow:** `FilterBar` → `onChange(filters)` callback → `App.filters` state → `EccentricitySubPlots` props. App-level `filters` type is `any` (not typed).

### Theme System

CSS custom properties (design tokens) defined in `retinal-ui/src/styles/globals.css` using `oklch()` color space. Two sets: `:root` (light) and `.dark` (dark). Applied by `ThemeProvider` toggling `light`/`dark` class on `document.documentElement`. Storage key: `"retinal-ui-theme"` in localStorage.

**Color tokens:** `--background`, `--foreground`, `--card`, `--border`, `--primary`, `--muted`, `--muted-foreground`, `--ring`, `--destructive`, plus chart and sidebar tokens.

---

## 7. Data Pipeline

### End-to-End Flow

```
AO Instrument Output
│   (Raw CSV: multi-block layout with Parameter_Name/Values columns)
│
▼ filecleaner.py
│   - Parse all cone data blocks (column suffix iteration)
│   - Extract & parse metadata from Parameter_Name rows
│   - Compute scalar eccentricity from (x,y) tuples
│   - Output: normalized flat CSV (sampleAO001fix.csv format)
│
▼ setup_db.py  (one-time, or to reset)
│   - Create SQLite cone_data table
│   - Import normalized CSV
│   - Type-cast fields (int/float/str)
│
▼ Migration scripts (one-off fixes)
│   - update_subjects.py: fill NULL subject_id
│   - update_meridians.py: fill NULL meridian
│   - fix_metadata_and_limits.py: propagate metadata to all rows
│
▼ retinal_data.db (SQLite)
│   - cone_data table (~1229 rows for sample subject)
│
▼ FastAPI backend (app/main.py)
│   - Async SQLite queries via aiosqlite
│   - Dynamic WHERE clause construction
│
▼ REST API (JSON)
│
▼ React frontend (retinal-ui/)
│   - FilterBar: user selects subject + meridian + cone types
│   - EccentricitySubPlots: fetches ranges → fetches plot+metadata per range
│   - react-plotly.js: renders scatter plot
│
▼ User sees: 2D cone position map with metadata overlay
```

### CSV Download Flow (separate path)

```
User clicks "Download CSV" in FilterBar
│
▼ downloadCSV() in retinal-ui/src/api/index.ts
│   - Checks for VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY env vars
│   - Lazy imports ../lib/supabase (getSupabaseClient)  ← THIS FILE DOES NOT EXIST
│   - Downloads from Supabase Storage bucket "raw-csvs"
│   - File name: "{displayId}.csv" (e.g., "AO001R.csv")
│   - Creates blob URL → triggers browser download
```

---

## 8. Dependencies

### Python Backend

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.116.1 | Web framework, route definitions, dependency injection |
| `uvicorn` | 0.35.0 | ASGI server |
| `aiosqlite` | 0.30.0 | Async SQLite adapter |
| `pydantic` | 2.11.7 | Request/response validation (`PlotData` model) |
| `python-dotenv` | 1.1.1 | Load env vars from `.env` file |
| `starlette` | 0.47.3 | ASGI toolkit (FastAPI dependency) |
| `asyncpg` | 0.30.0 | Async PostgreSQL client (used only in `test_db.py`) |
| `pandas` | (not in requirements.txt) | Used in `filecleaner.py` — must be installed separately |
| `numpy` | (not in requirements.txt) | Used in `filecleaner.py` — must be installed separately |

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.1.1 | UI framework |
| `react-dom` | 19.1.1 | DOM rendering |
| `plotly.js` | 3.1.0 | Charting engine |
| `react-plotly.js` | 2.6.0 | React wrapper for Plotly |
| `@supabase/supabase-js` | 2.75.0 | Supabase client for CSV downloads |
| `axios` | 1.12.0 | HTTP client (installed but not used — all fetches use native `fetch`) |
| `react-select` | 5.10.2 | Fancy select component (installed but not used anywhere) |

### Dev Dependencies (Frontend)

| Package | Purpose |
|---------|---------|
| `vite` 7.1.2 | Build tool + dev server |
| `@vitejs/plugin-react` | React HMR + JSX transform for Vite |
| `typescript` 5.8.3 | TypeScript compiler |
| `eslint` 9.33.0 | Linting |
| `eslint-plugin-react-hooks` | React hooks rules |
| `eslint-plugin-react-refresh` | Vite fast-refresh compatibility |

---

## 9. Current Limitations and Gaps

### Critical Broken Feature

**CSV Download is non-functional.** `retinal-ui/src/api/index.ts` line 98 does:
```typescript
const { getSupabaseClient } = await import('../lib/supabase');
```
The file `retinal-ui/src/lib/supabase.ts` (or `.js`) **does not exist**. This will throw a runtime module-not-found error when the user clicks "Download CSV". The download flow also requires Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) to be set. The backend `/cones/export` endpoint (which works) is completely bypassed.

### Data Issues

1. **Artificial meridian distribution.** `distribute_meridians.py` randomly assigns cones to meridians. Real scientific data should have actual meridian labels from the imaging session. This is a demo scaffold, not real data organization.

2. **Denormalized metadata.** The sample CSV only has metadata on row 1; all other rows have empty metadata fields. Migration scripts propagate metadata, but this is a fragile design — if a new subject's CSV is loaded without running migrations, metadata queries will return only one row's data.

3. **Only one subject in database.** `sampleAO001fix.csv` has 1229 rows all for `AO001`. Multiple subjects with multiple meridians and eccentricities need to be loaded for the UI to be useful.

4. **`eccentricity_mm` stored as string.** The raw data has tuple-format eccentricity like `"(0.12,0)"`. `setup_db.py` imports this as a TEXT field, not converted to a scalar float. Only `eccentricity_deg` is used in queries.

### Code Quality Issues

1. **Duplicate `PlotData` model.** Defined identically in both `app/models.py` and `app/main.py`. `models.py` is an unused artifact.

2. **Duplicate types file.** `retinal-ui/src/types.ts` and `retinal-ui/src/types/index.ts` coexist. The root-level `types.ts` has an incomplete `Patient` type (missing `eye`, `eye_description`). `EccentricityRangeSelector.tsx` imports from the old file.

3. **Two backend implementations.** `simple_server.py` is an earlier version of `app/main.py`. It lacks the CSV export endpoint and has a simpler `/metadata` (no eccentricity or cone_type filtering). It is not the production entry point but creates maintenance confusion.

4. **`App.tsx` filters typed as `any`.** The filter state `useState<any>(null)` bypasses TypeScript. Should use the `Filters` interface from `types/index.ts`.

5. **Unused dependencies installed.** `axios` and `react-select` are in `package.json` but not imported anywhere.

6. **`EccentricityRangeSelector.tsx` and `ConePlot.tsx` are dead code.** Both components are built but not imported by any active component. They represent work-in-progress or replaced functionality.

7. **Hard-coded API base URL.** `retinal-ui/src/api/index.ts` has `const API_BASE = "http://127.0.0.1:8001"` with no environment variable override. This will fail in any deployed environment.

8. **Scale bar is cosmetic only.** The 100μm scale bar overlay in `EccentricitySubPlots.tsx` is a styled `div` with a fixed CSS width of 120px. It does not scale with the plot's actual micron-to-pixel ratio and is not accurate.

9. **requirements.txt encoding issue.** The file appears to be saved in UTF-16 wide-character format (visible as spaced-out characters). This may fail with standard `pip install -r requirements.txt`.

10. **Missing `pandas`/`numpy` in requirements.** `filecleaner.py` uses `pandas` and `numpy` but they are not in `requirements.txt`.

11. **`test_db.py` contains a PostgreSQL connection string** with what appears to be real credentials in plain text. This is version-controlled (though `.env` is gitignored). The Supabase PostgreSQL URL is directly in the file.

### Architectural Gaps

1. **No authentication/authorization.** All API endpoints are publicly accessible. For a lab data tool, access control may be needed.

2. **No database indexes.** There are no indexes on `subject_id`, `meridian`, `eccentricity_deg`, or `cone_spectral_type` — the most common filter columns. With large datasets, queries will do full table scans.

3. **No error boundary in React.** If a Plotly render or API call throws unexpectedly, the whole app will crash.

4. **No loading state for initial patient fetch.** `FilterBar.tsx` uses `alert()` on error (line 54), which is disruptive.

5. **Plot width is computed from `window.innerWidth`** at render time and not reactive to resize. The plot will not re-size if the window is resized after initial render.

6. **`EccentricitySubPlots` fires N+1 API calls per filter change.** For each eccentricity range (could be many), it fires 2 parallel requests (`/plot-data` + `/metadata`). All ranges are fetched upfront even though only one is displayed at a time. Should consider lazy loading or a single combined query.

---

## 10. Feature Hooks: Where New Features Could Plug In

### Adding a New Subject / Importing More Data

1. Run `filecleaner.py` on the new AO instrument CSV to produce a normalized flat CSV
2. Load into SQLite via `setup_db.py` (or write an append-mode import script — `setup_db.py` currently drops and recreates the DB)
3. The `/patients` endpoint will automatically serve the new subject; the frontend dropdown will pick it up with no code changes

**Gap:** No incremental import path exists — `setup_db.py` always drops the DB. Need an upsert/append script.

**Hook point:** `setup_db.py` (lines 13-16) — replace `os.remove` + `CREATE TABLE` with `CREATE TABLE IF NOT EXISTS` + upsert logic.

### Adding a New API Filter Dimension (e.g., age range, cone density threshold)

The filter pattern in all endpoints follows the same `where_clauses` / `params` append pattern. Adding a new filter requires:
1. Add a `Query` parameter to the endpoint in `app/main.py`
2. Add the `if param: ... where_clauses.append(...)` block
3. Add the param to `getPlotData()` / `getMetadata()` / etc. in `retinal-ui/src/api/index.ts`
4. Add a UI control in `retinal-ui/src/components/FilterBar.tsx`

**Hook point:** `app/main.py` lines 88-101 (the filter-building block in `/cones`) — add new `if` blocks in this section.

### Replacing SQLite with PostgreSQL / Supabase PostgreSQL

The `test_db.py` file shows a Supabase PostgreSQL connection string was already tested. To migrate:
1. Change `aiosqlite.connect(db_path)` to `asyncpg` connection pool (or SQLAlchemy async)
2. Replace `?` placeholders with `$1`, `$2`, ... (PostgreSQL parameter style)
3. Update `DATABASE_URL` env var

**Hook point:** `app/main.py` line 66-72 — replace `async with aiosqlite.connect(db_path) as db:` pattern throughout.

### Fixing CSV Download (Supabase Storage)

To complete the broken download feature:
1. Create `retinal-ui/src/lib/supabase.ts` exporting `getSupabaseClient()`
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars in `retinal-ui/.env.local`
3. Upload CSV files to Supabase bucket `raw-csvs` with filenames matching `{subjectId}{R|L}.csv`

**Alternatively**, wire the download button to call `GET /cones/export` (the working backend endpoint) instead of Supabase Storage.

**Hook point:** `retinal-ui/src/api/index.ts` line 80 (`downloadCSV` function) — either create the missing `lib/supabase.ts` or replace the Supabase call with a fetch to `/cones/export`.

### Adding a "Compare Subjects" View

`EccentricitySubPlots.tsx` currently takes a single `subjectId`. To compare two subjects:
1. Add a second subject selector to `FilterBar.tsx`
2. Extend `App.tsx` state to hold `filters` and `compareFilters`
3. Render two `EccentricitySubPlots` side-by-side

**Hook point:** `App.tsx` line 54 — add second conditional render below current `EccentricitySubPlots`.

### Adding Database Indexes (Performance)

```sql
-- Run these against retinal_data.db
CREATE INDEX idx_subject ON cone_data(subject_id);
CREATE INDEX idx_meridian ON cone_data(meridian);
CREATE INDEX idx_eccentricity ON cone_data(eccentricity_deg);
CREATE INDEX idx_subject_meridian ON cone_data(subject_id, meridian);
CREATE INDEX idx_cone_type ON cone_data(cone_spectral_type);
```

**Hook point:** `setup_db.py` after `conn.commit()` on line 103 — add `cursor.execute(CREATE INDEX ...)` statements.

### Adding Statistics Panel / Density Analysis

The `/metadata` endpoint already returns density values (`lcone_density`, `mcone_density`, `scone_density`). The `ConePlot.tsx` component (currently unused) displays these. To activate a statistics view:
1. Import `ConePlot` in `App.tsx` or `EccentricitySubPlots.tsx`
2. Pass the `metadata` from `SubPlotData` to `ConePlot` props
3. Or build a dedicated stats panel component

**Hook point:** `ConePlot.tsx` is ready to use — it accepts `data: PlotData | null` and `metadata?: Metadata`.

### Supporting Additional Meridians

The hardcoded `MERIDIANS` constant in `FilterBar.tsx` (line 11):
```typescript
const MERIDIANS = ["temporal", "nasal", "superior", "inferior"];
```
This could be replaced with a dynamic fetch from the API if subjects have non-standard meridian labels.

**Hook point:** Add `GET /meridians?subject_id=...` endpoint to `app/main.py` and update `FilterBar.tsx` to fetch meridians on subject selection.

### Deploying to Production

Currently entirely local (`localhost:8001` hardcoded). To deploy:
1. Set `API_BASE` via `VITE_API_BASE_URL` env var (requires code change in `retinal-ui/src/api/index.ts`)
2. Set `ALLOWED_ORIGINS` env var on the backend to the deployed frontend URL
3. Set `PORT` env var for the backend
4. Use a proper database (PostgreSQL) instead of SQLite for concurrent access
5. Serve the Vite build output (`retinal-ui/dist/`) via a CDN or static host

---

*End of CODEBASE_CONTEXT.md*
