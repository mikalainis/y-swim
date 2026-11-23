# Somerset County YMCA Pentathlon Records — AI Development Guide

## 🚨 CRITICAL — READ BEFORE MAKING ANY CHANGES

### DO NOT CHANGE THESE — EVER

1. **Data source is LIVE Google Sheets** — records are fetched in real-time via CSV.
   - `PUBLISHED_BASE` URL in `main.js` is the Google Sheets published CSV endpoint
   - `PAGE_GIDS` maps each HTML page to its correct Sheet tab GID
   - **NEVER replace this with static/hardcoded data**
   - **NEVER embed records directly in HTML or JS**
   - **NEVER switch to Firestore or any other database**

2. **Two live Sheet tabs feed two pages:**
   | Page | Sheet GID | Meet |
   |---|---|---|
   | `index.html` | `1704234305` | Pentathlon Records |
   | `last-chance.html` | `0` | Last Chance Records |

3. **Frontend design is LOCKED** — the live site at https://y-swim.com is the source of truth.
   - Do NOT change fonts (Montserrat + Roboto)
   - Do NOT change accent color (`#0ea5e9` sky-500)
   - Do NOT change layout structure (nav → header → filters → table → footer)
   - Do NOT change filter behavior (Age Group, Event, Gender dropdowns + Name search)
   - Do NOT change the nav active state logic

4. **`main.js` owns ALL logic** — both HTML pages are layout only.
   - Do NOT add `<script>` logic blocks inside HTML files
   - Do NOT duplicate functions between files
   - All changes to filtering, rendering, fetching go in `main.js` only

### VERIFY BEFORE DEPLOYING
After ANY change, confirm:
- [ ] `index.html` loads live data from Google Sheets
- [ ] `last-chance.html` loads live data from Google Sheets
- [ ] Filters work on both pages
- [ ] Design matches https://y-swim.com exactly

---

## 🏊 Project Overview

This is a mobile-responsive web app displaying swimming pentathlon records for Somerset County YMCA. It replaces a static PDF system with a live, searchable interface.

- **Live site:** https://y-swim.com
- **GitHub repo:** y-swim
- **Hosting:** Google Cloud Run (project `pentathlon-records`, region `us-east4`); see README "Deployment"

## 📂 Project Structure

```
/
├── frontend/
│   ├── index.html        # Pentathlon Records page
│   ├── last-chance.html  # Last Chance Meet Records page
│   ├── main.js           # ALL shared app logic (fetch, parse, filter, render)
│   └── style.css         # Additional custom styles (beyond Tailwind)
├── Dockerfile            # nginx image serving frontend/ (Cloud Run)
├── nginx.conf            # web server config (caching, www → apex redirect)
├── infra/gcp/            # one-time Google Cloud setup + domain scripts
└── GEMINI.md
```

> ⚠️ `main.js` contains ALL shared logic. Both HTML pages load it via `<script src="main.js" defer>`.
> HTML files contain only layout/UI. Never duplicate logic between pages — always put it in `main.js`.

## 🗃️ Data Source

Records are fetched **live from Google Sheets** via CSV export — NOT embedded JSON.

```javascript
const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-...';
const PAGE_GIDS = {
  'index.html': '1704234305',   // Pentathlon Records tab
  'last-chance.html': '0'       // Last Chance Records tab
};
```

**How it works:**
1. `main.js` detects which page is loaded via `window.location.pathname`
2. Fetches the correct Google Sheet tab as CSV
3. Parses CSV → builds record objects → renders table

**To add new records:** Update the Google Sheet directly — no code changes needed.
**To add a new page/tab:** Add a new entry to `PAGE_GIDS` in `main.js` and create a new HTML file.

## 📋 Record Object Shape

```javascript
{
  ageGroup: string,   // e.g. "Men 30-34"
  event: string,      // e.g. "100 Free"
  time: string,       // e.g. "55.85"
  name: string,       // e.g. "Lovro Bilonic - UC07"
  gender: string,     // "Men" | "Women" | "Mixed" | "All"
  details: string,    // extra key:value pairs joined with " • "
  source: object      // raw row values from sheet
}
```

## 🎨 Design System

- **Font:** Montserrat (headings) + Roboto (body) via Google Fonts
- **Accent color:** `#0ea5e9` (sky-500)
- **Background:** `#f8fafc` (slate-50)
- **Text:** `#1e293b` (slate-800)
- **Table header bg:** `#f1f5f9` (slate-100)
- **Row hover:** `#f0f9ff` (sky-50)
- **Active nav link:** `#0284c7` with bottom border
- **Styling:** Tailwind CSS CDN + custom `<style>` block in each HTML file

## ✨ Current Features

- Live data fetch from Google Sheets CSV (no database UI needed)
- Two meet pages: Pentathlon Records (`index.html`) + Last Chance Records (`last-chance.html`)
- Shared nav with active state highlighting per page
- Filters: Age Group, Event, Gender dropdowns + Swimmer Name search
- Clear Filters button resets all filters instantly
- Mobile card layout / desktop table layout (responsive)
- Shared `main.js` handles all logic for both pages
- Smart column mapping — handles varied Google Sheet header names
- Last updated timestamp shown after data loads

## 🛠️ Tech Stack

- **Frontend:** HTML5, JavaScript ES6 Modules — NO React, NO Vue, NO Next.js
- **Styling:** Tailwind CSS via CDN
- **Hosting:** Google Cloud Run — `Dockerfile` + `nginx.conf` serve `frontend/` as-is
- **Database:** Firestore configured but optional — current version uses embedded JSON

## 🚀 Deployment

Push to `main`. `.github/workflows/deploy-cloud-run.yml` builds the image and deploys to
Cloud Run (project `pentathlon-records`, region `us-east4`) with keyless sign-in.
Do not add `firebase deploy` steps or service-account keys.

## 🎨 Design Conventions

- Blue times: Men / Women records
- Purple times: Mixed relay records
- Mobile-first responsive design
- Tailwind CSS utility classes only — no custom CSS frameworks
- Clean, minimal UI — easy for non-technical YMCA staff to read

## ⚙️ AI Agent Rules for This Project

1. **`main.js` is the single logic file** — all JS logic lives here, shared by both pages
2. **HTML files are layout only** — no inline `<script>` logic blocks
3. **Never embed record data in HTML** — data always comes from Google Sheets CSV
4. **Never introduce a JavaScript framework** (no React, Vue, Angular)
5. **Use Tailwind CSS** for all new styling — add custom CSS to the `<style>` block only if Tailwind can't handle it
6. **Preserve `PAGE_GIDS` pattern** when adding new meet pages — add entry to `main.js` + new HTML file
7. **Column mapping is flexible** — `main.js` handles varied Sheet header names via `getColumnValue()`
8. **Match existing design system** — use sky-500 accent, slate color palette, Montserrat/Roboto fonts
9. **Both pages must work** — test `index.html` AND `last-chance.html` after any `main.js` change
10. **Deploy:** push to `main` (Cloud Run via GitHub Actions)

## 📝 How to Add a New Meet Page

1. Create `frontend/new-meet.html` copying structure from `index.html`
2. Update title, heading, and date in the new HTML file
3. Add nav link to both `index.html`, `last-chance.html`, AND the new page
4. Add the Google Sheet GID to `PAGE_GIDS` in `main.js`:
   ```javascript
   'new-meet.html': 'YOUR_SHEET_GID'
   ```
5. Deploy

## 🚀 Deployment

# AI Development Guidelines for Modern Web Projects

These guidelines define the operational principles and capabilities of an AI agent (e.g., Gemini) interacting with framework-less web projects (HTML, CSS, JavaScript) within the Firebase Studio environment.

## Environment & Context Awareness

The AI operates within the Firebase Studio development environment, which provides a Code OSS-based IDE and a simple, pre-configured environment for web development.

- **Project Structure:** Primary entry point is `frontend/index.html`
- **Hosting:** Google Cloud Run (no Firebase Hosting, no Firestore)
- **Preview Server:** Run `python3 -m http.server 8080` from the `frontend/` folder

## Code Modification & Dependency Management

- Primarily modifies `frontend/index.html`
- Uses ES Modules and CDN links with SRI hashes for third-party libraries
- Prefers Tailwind CSS CDN for styling

## Modern HTML: Web Components

Uses Web Components (Custom Elements, Shadow DOM, HTML Templates) for encapsulated, reusable UI elements without external frameworks.

## Modern CSS (Baseline Features)

Uses Container Queries, Cascade Layers, `:has()` selector, Logical Properties, modern color spaces (`oklch`), and CSS Variables.

## Modern JavaScript (Baseline Features)

Uses ES Modules, Async/Await, Fetch API, Promises, arrow functions, destructuring, spread/rest operators, and optional chaining.

## Automated Error Detection & Remediation

After every code modification:
1. Monitor IDE diagnostics for errors
2. Check browser console for runtime errors and 404s
3. Auto-fix syntax errors, incorrect file paths, and common JS runtime errors
4. Report unresolvable errors with location, message, and suggested fix

## Visual Design

- Mobile responsive, mobile-first
- Modern components with clean spacing
- Tailwind utility classes for all styling
- Accessible (A11Y) — supports diverse users

## Iterative Development

- Generate a plan before each change
- Update `blueprint.md` with current project state
- Ask clarifying questions for ambiguous prompts
- Summarize all changes made after completion

## Firebase MCP Configuration

When Firebase MCP is needed, add to `.idx/mcp.json`:

```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["-y", "firebase-tools@latest", "experimental:mcp"]
    }
  }
}
```