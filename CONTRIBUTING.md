# Contributor & Maintenance Guide

**SabLab Retinal Cone Viewer** — University of Washington Ophthalmology

This guide is written for anyone who needs to maintain, update, or extend this site — even if you have never worked on it before. You do not need to understand every line of code. Each section tells you exactly what to change, where it lives, and why it matters.

---

## Table of Contents

1. [What This Site Does](#1-what-this-site-does)
2. [How the Pieces Fit Together](#2-how-the-pieces-fit-together)
3. [Common Maintenance Tasks](#3-common-maintenance-tasks)
   - [Adding a New Research Subject](#adding-a-new-research-subject)
   - [Removing or Correcting a Subject's Data](#removing-or-correcting-a-subjects-data)
   - [Changing the Site's Appearance](#changing-the-sites-appearance)
   - [Changing the Navbar or Page Layout](#changing-the-navbar-or-page-layout)
   - [Updating Colors for Cone Types](#updating-colors-for-cone-types)
   - [Changing the Admin Password](#changing-the-admin-password)
   - [Updating Allowed Origins (CORS)](#updating-allowed-origins-cors)
4. [Environment Variables — What They Are and Where to Set Them](#4-environment-variables--what-they-are-and-where-to-set-them)
5. [Deploying the Site](#5-deploying-the-site)
   - [Frontend (Vercel)](#frontend-vercel)
   - [Backend (Render)](#backend-render)
   - [Database (Supabase)](#database-supabase)
6. [Running the Site Locally (for Testing)](#6-running-the-site-locally-for-testing)
7. [File Map — What Every Important File Does](#7-file-map--what-every-important-file-does)
8. [The Data Pipeline — How CSV Files Become Charts](#8-the-data-pipeline--how-csv-files-become-charts)
9. [Things to Avoid Breaking](#9-things-to-avoid-breaking)
10. [Who to Contact / Where to Get Help](#10-who-to-contact--where-to-get-help)

---

## 1. What This Site Does

This is a research visualization tool for the UW Ophthalmology lab (SabLab). Researchers upload CSV files from an adaptive optics (AO) retinal imaging instrument. The site then lets them interactively explore:

- **Where** cone photoreceptors are located on the retina
- **What type** they are (L = red-sensitive, M = green-sensitive, S = blue-sensitive, NC = unclassified)
- **How density changes** as you move away from the center of the retina (eccentricity)

Filtering by subject, eye (left/right), meridian (direction across the retina), and cone type happens in real time.

---

## 2. How the Pieces Fit Together

The site has three main parts. Think of them like a restaurant:

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (retinal-ui/)                             │
│  The dining room — what researchers see and click   │
│  Built with: React, TypeScript, Plotly.js           │
│  Hosted on: Vercel                                  │
└───────────────────┬─────────────────────────────────┘
                    │ asks for data
                    ▼
┌─────────────────────────────────────────────────────┐
│  BACKEND (app/)                                     │
│  The kitchen — processes requests, queries database │
│  Built with: Python, FastAPI                        │
│  Hosted on: Render                                  │
└───────────────────┬─────────────────────────────────┘
                    │ reads/writes data
                    ▼
┌─────────────────────────────────────────────────────┐
│  DATABASE (Supabase)                                │
│  The pantry — stores all cone data permanently      │
│  Service: Supabase PostgreSQL                       │
│  Also stores: raw CSV files in Supabase Storage     │
└─────────────────────────────────────────────────────┘
```

When a researcher visits the site:
1. The frontend (Vercel) loads in their browser
2. It asks the backend (Render) for data
3. The backend queries the database (Supabase) and returns results
4. The frontend draws the charts

---

## 3. Common Maintenance Tasks

### Adding a New Research Subject

**When:** New AO imaging data arrives for a subject not yet in the system.

**How:** Use the Admin page built into the site.

1. Navigate to the site and click **Admin** in the navbar
2. Log in with the admin password (see [Changing the Admin Password](#changing-the-admin-password) if you need to reset it)
3. Drag and drop the CSV file (or click to browse)
4. Click **Upload**
5. The site will parse the file, validate it, and store it in the database
6. The subject will appear immediately in the Viewer dropdown

**What happens behind the scenes:**
- The file is read by `app/csv_parser.py`, which extracts all cone positions and metadata
- Rows are inserted into the `cone_data` table in Supabase
- An entry is added to `upload_log` so there's an audit trail of what was uploaded and when
- If the subject already exists, their old data is replaced entirely (safe to re-upload corrected files)

**If the upload fails:**
- The site will show an error message describing what went wrong
- Common causes: wrong CSV format, missing columns, or a database connection issue
- Check that the file matches the format of `sampleAO001fix.csv` in the root directory

---

### Removing or Correcting a Subject's Data

**When:** Data was uploaded incorrectly, or a subject needs to be removed from the study.

**How:** This requires direct database access via Supabase.

1. Log in to [supabase.com](https://supabase.com) and open the project
2. Go to **Table Editor → cone_data**
3. Filter by `subject_id` to find the subject's rows
4. Delete the rows, or use the **SQL Editor** and run:
   ```sql
   DELETE FROM cone_data WHERE subject_id = 'AO001' AND eye = 'OD';
   ```
5. Also remove the corresponding entry from `upload_log` if desired

**To correct data:** Simply re-upload the corrected CSV through the Admin page. The system automatically deletes the old data for that subject+eye before inserting the new rows.

---

### Changing the Site's Appearance

**File:** `retinal-ui/src/styles/globals.css`

**Why this file:** All colors, fonts, spacing, and visual variables are defined here as CSS custom properties (variables). Changing a variable here updates it everywhere on the site at once.

**Key variables to know:**

```css
/* Color palette — change these to retheme the whole site */
--primary: ...        /* main accent color (buttons, active links) */
--foreground: ...     /* text color */
--card: ...           /* card/panel background */
--background: ...     /* page background */
--border: ...         /* borders and dividers */
--muted: ...          /* subdued text (labels, placeholders) */

/* Shape */
--radius: 0.5rem      /* how rounded corners are */
```

There are two sets of these — one for **light mode** and one for **dark mode** — defined under `:root` and `.dark` respectively. Change both if you want the change to apply in both modes.

**Font:** The site uses [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) loaded from Google Fonts. To change the font, update the `@import` line at the top of `globals.css` and the `font-family` property in the `body` rule.

---

### Changing the Navbar or Page Layout

**File:** `retinal-ui/src/components/Navbar.tsx`

The navbar contains the site name, navigation links, and the theme toggle. To rename the site, find this line and edit it:

```tsx
// Around line 60 — change the text in the span
<span>SabLab: Retinal Cone Viewer</span>
```

To add or remove a nav link, find the section that renders the nav links (look for "Viewer", "Updates", "Admin") and follow the same pattern as the existing links.

**File:** `retinal-ui/src/App.tsx`

This is the root of the page layout. It controls which view is shown (Viewer, Admin, Updates) based on which nav link is active. If you add a new page, you would wire it up here.

---

### Updating Colors for Cone Types

**File:** `retinal-ui/src/components/EccentricitySubPlots.tsx`

Cone types are color-coded in the charts. The color mapping is defined inside the `SinglePlot` component. Search the file for the color values:

- **L cones** → red (`#e05a5a` or similar)
- **M cones** → green (`#5abf5a` or similar)
- **S cones** → blue (`#5a7fbf` or similar)
- **NC cones** → grey

To change a color, find the mapping object and update the hex value. The change takes effect immediately after rebuilding the frontend.

---

### Changing the Admin Password

**Where:** The password is stored as an environment variable called `ADMIN_PASSWORD` on the backend server (Render).

**Steps:**
1. Go to [render.com](https://render.com), open your backend service
2. Navigate to **Environment** in the sidebar
3. Find `ADMIN_PASSWORD` and click to edit it
4. Set a new strong password (at least 20 random characters recommended)
5. Save — Render will restart the backend automatically

> **Important:** Never put the password directly in any code file or commit it to git. Environment variables are the only safe place for it.

---

### Updating Allowed Origins (CORS)

**What this is:** CORS (Cross-Origin Resource Sharing) is a browser security rule. The backend must explicitly list which URLs are allowed to talk to it. If the frontend URL changes (e.g., you move to a new domain), you must update this.

**Where:** `ALLOWED_ORIGINS` environment variable on the backend (Render).

**Format:** A comma-separated list of URLs, e.g.:
```
https://your-vercel-app.vercel.app,https://retinalviewer.uwoph.edu
```

**Steps:**
1. Go to Render → your backend service → **Environment**
2. Find `ALLOWED_ORIGINS`
3. Add the new frontend URL to the list
4. Save

---

## 4. Environment Variables — What They Are and Where to Set Them

Environment variables are configuration values kept outside the code for security. Think of them as settings that differ between your laptop and the live server.

### Backend Variables (set on Render)

| Variable | What It Does | Where to Get It |
|---|---|---|
| `DATABASE_URL` | Connection string to the Supabase database | Supabase → Project Settings → Database → Connection Pooling (port 6543 URL) |
| `ADMIN_PASSWORD` | Password to access the Admin upload page | You choose this — make it long and random |
| `ALLOWED_ORIGINS` | Which frontend URLs can talk to this backend | Your Vercel deployment URL |

### Frontend Variables (set on Vercel)

| Variable | What It Does | Where to Get It |
|---|---|---|
| `VITE_API_URL` | URL of the backend (Render) | Your Render service URL, e.g. `https://retinal-api.onrender.com` |
| `VITE_SUPABASE_URL` | URL of the Supabase project | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public API key for Supabase Storage (CSV downloads) | Supabase → Project Settings → API → anon/public key |

> **Rule of thumb:** Any variable starting with `VITE_` is for the frontend. Everything else is for the backend.

---

## 5. Deploying the Site

### Frontend (Vercel)

The frontend is deployed automatically by Vercel whenever you push to the main git branch.

**Manual deploy steps:**
1. Install Vercel CLI: `npm install -g vercel`
2. Inside `retinal-ui/`, run `npm run build` to confirm the build passes
3. Push your changes to git — Vercel will detect the push and redeploy

**If the build fails on Vercel:**
- Check the build logs in the Vercel dashboard
- Most common cause: a TypeScript type error or a missing environment variable
- Run `npm run build` locally first to catch errors before pushing

### Backend (Render)

The backend runs as a web service on Render.

**How it starts:** Render uses the `Procfile` in the root directory:
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
You should not need to change this.

**Deploying updates:**
- Push to git — Render will detect the push and restart the service
- Or go to the Render dashboard and click **Manual Deploy**

**If the backend goes down:**
- Check Render logs for error messages
- Most common causes: database connection failure, missing environment variable, or Python dependency issue
- To check connectivity: visit `https://your-render-url.onrender.com/patients` in a browser — it should return a JSON list

### Database (Supabase)

The database runs continuously on Supabase and requires no deployment. However:

- **Free tier warning:** Supabase free projects pause after 1 week of inactivity. If the site stops working after a period of low use, log into Supabase and resume the project.
- **Connection limits:** The free tier allows ~15 simultaneous connections. If traffic grows, consider upgrading to Supabase Pro.
- **Backups:** Supabase Pro includes daily backups. On the free tier, export data periodically via the SQL Editor → Export.

---

## 6. Running the Site Locally (for Testing)

Use this when you want to test a change before deploying it live.

### Prerequisites
- Python 3.11+
- Node.js 20+
- Access to the `.env` values (ask a team member or check Render/Vercel dashboards)

### Backend

```bash
# From the project root
pip install -r requirements.txt

# Create a .env file with real values (never commit this file)
cp .env.example .env
# Edit .env and fill in DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS

# Start the backend
python -m uvicorn app.main:app --reload --port 8001
```

The backend will be running at `http://127.0.0.1:8001`. You can visit `/patients` to verify it's working.

### Frontend

```bash
# From retinal-ui/
npm install

# The file retinal-ui/.env.local already points to localhost:8001
npm run dev
```

The frontend will open at `http://localhost:5173`.

---

## 7. File Map — What Every Important File Does

```
retinal-data-repo/
│
├── app/                        ← BACKEND (Python)
│   ├── main.py                 ← All API endpoints; the heart of the backend
│   ├── config.py               ← Reads environment variables (DATABASE_URL, etc.)
│   ├── database.py             ← Manages the database connection pool
│   ├── csv_parser.py           ← Parses AO instrument CSV files into database rows
│   └── create_schema.py        ← One-time script to create database tables (already run)
│
├── retinal-ui/                 ← FRONTEND (React + TypeScript)
│   └── src/
│       ├── App.tsx             ← Root layout; controls which page is shown
│       ├── main.tsx            ← Entry point; wraps app in theme provider
│       ├── api/index.ts        ← All calls to the backend API; change API URL here
│       ├── types/index.ts      ← TypeScript data shapes (Patient, PlotData, etc.)
│       ├── styles/globals.css  ← All colors, fonts, spacing variables
│       │
│       ├── components/
│       │   ├── Navbar.tsx              ← Top navigation bar
│       │   ├── FilterBar.tsx           ← Subject/meridian/cone type selectors
│       │   ├── EccentricitySubPlots.tsx← Main chart viewer (scatter plots)
│       │   ├── AdminPage.tsx           ← Admin login + upload interface
│       │   ├── UpdatesPage.tsx         ← Upload history timeline
│       │   ├── theme-provider.tsx      ← Light/dark mode logic
│       │   └── mode-toggle.tsx         ← Sun/moon toggle button
│       └── lib/
│           └── supabase.ts             ← Supabase client (needed for CSV downloads)
│
├── Cone_classification_data/   ← Raw CSV files for 13 subjects (not served directly)
├── sampleAO001fix.csv          ← Example of the expected CSV format
├── .env.example                ← Template for environment variables
├── requirements.txt            ← Python dependencies
├── Procfile                    ← How Render starts the backend
└── vercel.json                 ← Vercel routing config for the backend wrapper
```

---

## 8. The Data Pipeline — How CSV Files Become Charts

Understanding this flow helps you debug problems when something breaks.

```
1. Researcher uploads CSV via Admin page
        ↓
2. Frontend sends the file to the backend (POST /admin/upload)
        ↓
3. Backend reads the file using csv_parser.py
   - Handles the multi-block AO format
   - Extracts: subject ID, age, eye, meridian, eccentricity, cone coordinates, spectral type
        ↓
4. Backend deletes any existing rows for that subject+eye (safe re-upload)
        ↓
5. New rows are inserted into the cone_data table in Supabase
   An entry is also added to upload_log (audit trail)
        ↓
6. Researcher opens Viewer, selects subject from dropdown
        ↓
7. Frontend asks backend for cone data (GET /cones or GET /subjects/data)
        ↓
8. Backend queries Supabase and returns filtered results
        ↓
9. Frontend renders scatter plots using Plotly.js
   Each tab = one eccentricity range; dots colored by cone type
```

**If data appears wrong in the charts:**
- Check the raw CSV for formatting issues
- Re-upload the corrected file through Admin — it will replace the old data
- Verify in Supabase Table Editor that the rows look correct

---

## 9. Things to Avoid Breaking

These are the most fragile parts of the system. Be careful when touching them.

**Database connection string format**
The `DATABASE_URL` must use port **6543** (the connection pooler), not 5432. Supabase requires this for async connections. Using the wrong port will cause the backend to fail silently on some queries.

**CSV format**
The parser (`csv_parser.py`) is tightly coupled to the exact column names and block structure produced by the AO instrument software. If the instrument software is updated and the CSV format changes, the parser will need to be updated too. Always test a new CSV format against the sample file first.

**CORS origins**
If you add a new domain for the frontend (e.g., a custom domain on Vercel), you must also add it to `ALLOWED_ORIGINS` on the backend. Forgetting this causes the browser to silently block all API calls, making the site appear broken with no obvious error.

**Supabase free tier pause**
Free Supabase projects pause after 7 days of inactivity. If the site suddenly stops loading data, this is the most likely cause. Log in to Supabase and click "Resume project."

**`statement_cache_size=0` in database.py**
This setting is required for the connection to work with Supabase's connection pooler. Do not remove it or increase it — it will cause cryptic database errors.

---

## 10. Who to Contact / Where to Get Help

| Resource | Details |
|---|---|
| **Supabase** | [supabase.com](https://supabase.com) — database, storage, and API keys |
| **Render** | [render.com](https://render.com) — backend hosting and logs |
| **Vercel** | [vercel.com](https://vercel.com) — frontend hosting and build logs |
| **Plotly.js docs** | [plotly.com/javascript](https://plotly.com/javascript/) — chart customization reference |
| **FastAPI docs** | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) — backend API framework |
| **React docs** | [react.dev](https://react.dev) — frontend framework |

**If you're stuck:**
1. Check the browser console (F12 → Console) for frontend errors
2. Check the Render logs for backend errors
3. Check the Supabase dashboard to confirm the project is active and tables have data
4. Try running the site locally with the same environment variables as production — errors are often more readable that way

---

*Last updated: April 2026*
*Project: SabLab Retinal Cone Viewer — University of Washington Ophthalmology*
