# Y-Swim Records Hub
### Live records site for NJ LMSC and Local Meet Records

**🌐 Live Site:** [y-swim.com](https://y-swim.com)

---

## Overview

A modern, mobile-responsive web application for tracking swimming records across New Jersey and Somerset County YMCA. Records are fetched live from Google Sheets — no code changes needed when records are updated in the source sheets.

The site features a central Hub page providing access to two main record sets:

### 1. NJ LMSC Records
New Jersey Local Masters Swimming Committee records for:
- **SCY Records** (Short Course Yards - 25y)
- **SCM Records** (Short Course Meters - 25m)
- **LCM Records** (Long Course Meters - 50m)

### 2. Local Meet Records
Historical and meet-specific records for Somerset County YMCA:
- **Pentathlon Records**
- **Last Chance Records**

---

## Features

- **Central Hub** — Landing page for easy navigation between different record sets.
- **Live data** — fetches directly from Google Sheets CSV on every page load.
- **Smart filtering** — Age Group, Event, Gender, Club, and Swimmer Name filters.
- **Unofficial Event Highlighting** — Events marked with `*` in the source sheet display an "Unofficial" badge and italicized names.
- **Strict Data Filtering** — Automatically hides rows where the Swimmer Name or Time is missing, ensuring a clean display of verified records.
- **Mirrored layout** — Women on left, Men on right when both exist; single column when only one gender has records.
- **Mixed section** — relay and mixed gender records shown separately at the bottom of each age group.
- **Mobile responsive** — works on phones at poolside.
- **Auto-deploys** — every push to `main` triggers Firebase deployment via GitHub Actions CI/CD.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, JavaScript (ES6 Modules) |
| Styling | Tailwind CSS (CDN) + shared `style.css` |
| Fonts | Montserrat, Roboto, Roboto Mono (Google Fonts) |
| Data | Google Sheets (live CSV API) |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions |

---

## Project Structure

```
/
├── frontend/
│   ├── index.html          # Central Hub / Landing Page
│   ├── pentathlon.html     # Pentathlon Records page
│   ├── last-chance.html    # Last Chance Records page
│   ├── njlmsc-scy.html     # NJ LMSC SCY Records page
│   ├── njlmsc-scm.html     # NJ LMSC SCM Records page
│   ├── njlmsc-lcm.html     # NJ LMSC LCM Records page
│   ├── main.js             # All shared app logic (fetch, parse, filter, render)
│   └── style.css           # Shared styles for all pages
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD — auto-deploy to Firebase on push
├── firebase.json           # Firebase hosting config
└── GEMINI.md               # AI agent instructions for this project
```

> ⚠️ All JavaScript logic lives in `main.js` — all record pages load it via `<script src="main.js" defer>`. The hub page (`index.html`) also uses it but skips record-fetching logic.

---

## Data Architecture

Records are fetched live from a published Google Sheet on every page load using specific GIDs defined in `main.js`:

```
Google Sheet (published CSV)
        ↓
   fetch() in main.js (using PAGE_GIDS)
        ↓
  parseCsv() → buildRecords()
        ↓
  setFilterOptions() + renderTable()
        ↓
     Browser DOM
```

**Record Filtering:**
The `buildRecords` function in `main.js` includes a filter that excludes any row missing a **Time** or **Swimmer Name**, even if the Event name is present. This prevents "placeholder" rows from appearing on the live site.

---

## How to Update Records

**No code changes needed.** Just update the Google Sheet:

1. Open the Google Sheet corresponding to the records page.
2. Add or edit records following the established column format.
3. To mark an event as "Unofficial", add a `*` to **Column J**.
4. The site reflects changes automatically on the next page load.

---

## Local Development

```bash
cd frontend
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## Deployment

Deployment is fully automated via GitHub Actions CI/CD:

```bash
git add .
git commit -m "Your change description"
git push
# Firebase deploys automatically in ~60 seconds
```

Manual deployment:
```bash
firebase deploy --project scym-pentathlon-records-2025
```