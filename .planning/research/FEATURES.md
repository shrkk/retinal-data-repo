# Feature Research

**Domain:** Scientific retinal imaging research viewer (ophthalmology / adaptive optics)
**Researched:** 2026-03-22
**Confidence:** MEDIUM — core patterns from UX and scientific visualization literature; domain-specific norms inferred from codebase analysis and cone classification research papers

---

## Context: What Already Exists

The current codebase has a functional viewer with:
- Subject selector dropdown (with OD/OS eye suffix encoding)
- Meridian dropdown (temporal/nasal/superior/inferior)
- Cone type checkboxes (L, M, S — but NC is missing)
- Eccentricity range navigation via tab buttons
- Scatter plot of cone x/y positions per eccentricity window, colored by spectral type (L=red, M=green, S=blue)
- Metadata overlay sidebar within the plot area (eye, FOV, L/M ratio, S-cones)
- CSV download of filtered data

The milestone adds: NC cone type, a standalone stats panel (L/M ratio + % S-cones per subject), and an admin CSV upload page.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features ophthalmology researchers assume will work correctly in a data viewer. Missing these makes the tool feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All 4 cone types visible (L, M, S, NC) | NC cones are a documented classification outcome in AO densitometry; hiding them understates total cone count and misrepresents the mosaic | LOW | NC = non-classified due to low reflection (vascular shadowing). Must be a distinct color (grey or white), not mapped to an existing spectral color |
| Consistent color semantics across plots | Researchers build mental models from color. L=red, M=green, S=blue is conventional in cone photoreceptor literature (PNAS 2019, bioRxiv 2022). NC must be visually distinct but subordinate | LOW | Use fixed `color_discrete_map` — never let Plotly auto-assign colors |
| Legend showing active cone types | Every multi-category scatter plot in scientific publishing shows a legend. Without it, readers cannot identify point classes | LOW | Plotly `showlegend: true` with named traces per cone type; toggle visibility via legend click is built into Plotly |
| Meridian filter that actually works | Current codebase has `distribute_meridians.py` generating fake data. Real meridian labels in ingested data are required for filter to be meaningful | MEDIUM | This is a data correctness issue, not just a UI feature. Fix fake meridian distribution before exposing filter as meaningful |
| Filter state persists within a session | Researchers iterate: they select a subject, change meridian, compare. Resetting filters on every action is disruptive | LOW | Already partially implemented via React state in FilterBar; ensure filter state is not reset on plot re-renders |
| Empty state with clear message | When no data matches selected filters (e.g., no NC cones for a subject), show "No [NC] cones found for [subject] [meridian]" — not a blank screen | LOW | Already pattern exists in EccentricitySubPlots; extend to cover per-cone-type no-data states |
| Loading indicators during data fetch | AO datasets can be large (50k+ cones per subject). A spinner or skeleton prevents users from thinking the app crashed | LOW | Already partially implemented; ensure all fetch states are covered including the new stats panel endpoint |

### Differentiators (Competitive Advantage)

Features that move this viewer beyond a generic scatter plot tool. These are what make SabLab's viewer specifically useful for cone mosaic research rather than replicable with a spreadsheet.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-subject L/M ratio and % S-cones stats panel | L/M ratio is a primary research metric in cone spectral composition studies. Displaying it prominently per subject (not buried in a metadata overlay) makes cross-subject comparison instant | MEDIUM | Pull from existing `lm_ratio` and `scones` columns. Panel should live outside the plot area — a sidebar or below-filter card. Show both the ratio (e.g., 2.3:1) and % S-cones (e.g., 5.2%). Include the eccentricity range and meridian scope these stats reflect |
| NC cone visibility with muted styling | NC cones are meaningful data — they indicate where classification failed and why. Showing them as grey/muted points alongside classified cones gives researchers spatial context for classification quality | LOW | Color: `#aaaaaa` or similar. Size: same as other markers. Make NC toggleable independently from L/M/S |
| Consistent fixed axis scales per subject | When comparing across eccentricity windows of the same subject, axis scales should be locked or at least labeled consistently so cone density gradients are visually comparable | MEDIUM | Currently each sub-plot auto-scales. For cone mosaic analysis, researchers care about relative density across eccentricity. Consider a "same scale" toggle |
| Admin CSV upload with per-row ingestion feedback | Research labs upload batches of subject data. Knowing which rows failed (and why) vs. which succeeded prevents silent data corruption — a common frustration in lab-managed data tools | MEDIUM | Backend: call filecleaner.py, return structured results (rows ingested, rows failed, subject IDs created). Frontend: show a results table, not just "success" toast |
| Eccentricity range tab navigation | Already implemented. Distinguishes this tool from static plots by letting researchers step through the mosaic at different eccentricities without re-querying manually | ALREADY BUILT | Preserve as-is |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like good ideas but would create technical debt, scope creep, or user confusion for a v1 internal tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-user login / accounts | Feels like proper security | This is a single-team internal research tool. Supabase Auth adds complexity, OAuth flows, session management. Overkill for a password-gated admin page | Single `ADMIN_PASSWORD` env var checked server-side. No user accounts needed |
| Real-time upload progress (byte-by-byte) | Looks polished | Requires WebSocket or SSE stream from FastAPI, adds significant backend complexity for files that are typically <10MB | Show a spinner during upload + a structured result summary after completion |
| Column mapping UI (CSV → DB schema) | Generic CSV import tools show this | filecleaner.py is the canonical parser and owns the schema mapping. Exposing manual column mapping would allow mismatches and corrupt data | Trust filecleaner.py. Show clear error if a CSV doesn't match the expected format instead |
| Cross-subject comparison scatter overlay | Interesting scientifically | Combining multiple subjects in one plot risks overplotting with 50k+ points per subject. Performance and readability both suffer | Subjects are best compared via the stats panel (L/M ratio, % S-cones) side-by-side, not via raw scatter overlay |
| Mobile-responsive layout | Modern web default | Desktop research use only per project constraints. Optimizing for mobile would require redesigning the filter bar and plot layout with no user benefit | Keep desktop-first layout. Use `min-width` on the plot container |
| Exporting plots as PDF/SVG | Researchers want publication-ready figures | Plotly's built-in PNG export (camera icon in modebar) covers 80% of this need. PDF/SVG export requires server-side rendering or complex client-side work | Enable Plotly's `toImage` button in modebar config. Document that PNG output is available |
| Pagination of subjects in dropdown | Good practice for large lists | This cohort has 13 subjects. Pagination adds complexity for negligible benefit at this scale | Simple dropdown is correct. Revisit if subject count reaches 100+ |

---

## Feature Dependencies

```
[NC Cone Type Display]
    └──requires──> [filecleaner.py produces NC rows in ingested data]
                       └──requires──> [Supabase migration complete]

[Meridian Filter (meaningful)]
    └──requires──> [Fix distribute_meridians.py / real meridian labels in DB]
                       └──requires──> [Supabase migration + re-ingestion of real data]

[L/M Ratio + % S-cones Stats Panel]
    └──requires──> [lm_ratio, scones columns present in Supabase DB]
    └──enhances──> [Subject selector] (stats update when subject changes)

[Admin CSV Upload Page]
    └──requires──> [FastAPI /admin/upload endpoint with ADMIN_PASSWORD auth]
    └──requires──> [filecleaner.py callable from FastAPI process]
    └──requires──> [Supabase DB writable from backend]

[CSV Download (existing, broken)]
    └──requires──> [lib/supabase.ts exists] (currently missing — known bug)

[Color by spectral type (L/M/S/NC)]
    └──enhances──> [NC Cone Type Display]
    └──conflicts with──> [Auto-color assignment] (must use fixed color_discrete_map)
```

### Dependency Notes

- **NC cone display requires real ingested data:** NC cones only appear if filecleaner.py produces rows with `cone_spectral_type = "NC"`. If the DB only has L/M/S from current data, NC toggle will always be empty. Verify after ingestion.
- **Meridian filter requires real data:** Current `distribute_meridians.py` assigns fake meridians. The filter UI exists but is misleading until real meridians are ingested from new CSVs in `Cone_classification_data/`.
- **Stats panel requires no new DB schema:** `lm_ratio` and `scones` are already columns in the existing schema. This is a pure frontend + API endpoint addition.
- **Admin page is self-contained:** It does not affect the main viewer. Can be built and deployed independently behind `ADMIN_PASSWORD`.

---

## MVP Definition

This is a subsequent milestone, not greenfield. MVP here means "minimum change set that makes the active requirements correct and complete."

### Launch With (v1 of this milestone)

- [ ] NC cone type in FilterBar checkboxes + COLOR_MAP entry (grey `#aaaaaa`) — unblocks researchers from seeing full classification output
- [ ] L/M ratio + % S-cones stats panel as a card below the FilterBar, updating when subject/meridian changes — the primary new research value
- [ ] Fix `lib/supabase.ts` missing file so CSV download works — existing feature was silently broken
- [ ] Admin page: password-protected route `/admin`, drag-and-drop or file-picker CSV upload, calls backend `/admin/upload` endpoint, shows per-subject ingestion summary (rows ingested, errors)
- [ ] Fix hardcoded `localhost:8000` API URL to use `VITE_API_BASE_URL` env var — required for Vercel deployment to work at all

### Add After Validation (v1.x)

- [ ] Meridian filter meaningful — only once fake meridian data is replaced by real meridians from new CSV batch
- [ ] Fixed-scale axis option on eccentricity sub-plots — once researchers report that cross-eccentricity comparison is confusing
- [ ] Legend visible on cone position plots — currently `showlegend: false`; enabling it is one line change but needs visual QA with the metadata overlay positioning

### Future Consideration (v2+)

- [ ] Stats panel showing per-eccentricity-window breakdown of cone ratios (not just subject-level) — scientifically interesting but requires backend aggregation work
- [ ] Batch download of all subjects — useful for lab-wide data export
- [ ] Image export enhancements beyond Plotly's built-in PNG

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| NC cone type display | HIGH (data correctness) | LOW | P1 |
| L/M ratio + % S-cones stats panel | HIGH (primary research metric) | MEDIUM | P1 |
| Fix CSV download (missing supabase.ts) | HIGH (existing feature broken) | LOW | P1 |
| Admin CSV upload page | HIGH (new data ingestion workflow) | MEDIUM | P1 |
| Fix hardcoded API URL | HIGH (deployment blocker) | LOW | P1 |
| Meridian filter (real data) | HIGH (filter is currently misleading) | MEDIUM (data pipeline) | P2 |
| Legend on cone position plots | MEDIUM (scientific convention) | LOW | P2 |
| Fixed-scale axis toggle | MEDIUM (comparative analysis) | MEDIUM | P2 |
| Remove dead code (ConePlot.tsx, etc.) | LOW (technical hygiene) | LOW | P3 |

**Priority key:**
- P1: Must have for this milestone to be considered complete
- P2: Should have, include if time permits without blocking P1
- P3: Nice to have, defer to cleanup phase

---

## Competitor Feature Analysis

No direct commercial competitors exist for this specific use case (internal AO cone mosaic research viewer). The closest reference points are:

| Feature | ImageJ/FIJI (desktop) | MATLAB AO scripts | This Tool |
|---------|----------------------|-------------------|-----------|
| Multi-class scatter coloring | Manual, static | Manual scripting | Automatic via Plotly traces — HIGH value |
| Filter by meridian | Not applicable | Script parameter | Dropdown UI — reduces need for scripting |
| Stats panel (L/M, S%) | Computed separately | Script output | Inline with viewer — eliminates copy-paste |
| Admin data upload | N/A (file-based) | N/A (file-based) | Web UI — enables non-programmer lab members |
| Interactive zoom/pan | Limited | Via MATLAB figure | Plotly modebar built-in |

**Key insight:** The primary value of this web viewer over existing desktop tools is eliminating the need for every researcher to run Python/MATLAB scripts locally. The stats panel and admin upload page directly address this — they make data ingestion and metric inspection accessible without code.

---

## Sources

- Cone spectral classification and NC definition: [Characterizing cone spectral classification by optoretinography (PMC 2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9774847/) — MEDIUM confidence
- NC cone definition (densitometry limitation): [Cone photoreceptor classification in the living human eye (PNAS 2019)](https://www.pnas.org/doi/10.1073/pnas.1816360116) — MEDIUM confidence
- Plotly discrete color and legend behavior: [Discrete Colors in Python — Plotly official docs](https://plotly.com/python/discrete-color/) — HIGH confidence
- Plotly legend toggle (visible/legendonly): [Legends in Python — Plotly official docs](https://plotly.com/python/legend/) — HIGH confidence
- Segmented buttons vs dropdowns for filtering: [Why Segmented Buttons Are Better Filters Than Dropdowns — UX Movement](https://uxmovement.com/buttons/why-segmented-buttons-are-better-filters-than-dropdowns/) — MEDIUM confidence
- CSV import UX patterns (5-step workflow, error handling): [Data import UX: designing spreadsheet imports users don't hate — ImportCSV](https://www.importcsv.com/blog/data-import-ux) — MEDIUM confidence
- File upload feedback best practices: [Best Practices for Secure File Uploads — PixelFree Studio](https://blog.pixelfreestudio.com/best-practices-for-secure-file-uploads-on-websites/) — MEDIUM confidence
- Colorblind accessibility in scatter plots: [Generating colorblind-friendly scatter plots for single-cell data (PMC 2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9829408/) — MEDIUM confidence
- Codebase analysis: `FilterBar.tsx`, `EccentricitySubPlots.tsx`, `App.tsx`, `api/index.ts` — HIGH confidence (direct inspection)

---

*Feature research for: UWOPH Retinal Cone Viewer — Subsequent Milestone (multi-class coloring, stats panel, admin upload)*
*Researched: 2026-03-22*
