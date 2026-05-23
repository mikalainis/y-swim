# Somerset County YMCA Swim Records
### Live records site for Pentathlon and Last Chance meets

**🌐 Live Site:** [y-swim.com](https://y-swim.com)

---

## Overview

A modern, mobile-responsive web application that replaced a static PDF system for tracking Somerset County YMCA Masters swimming records. Records are fetched live from Google Sheets — no code changes needed when records are updated.

Two meet types are supported, each with their own tab and Google Sheet data source:

| Tab | Meet | Sheet |
|---|---|---|
| Pentathlon Records | SCYM Pentathlon (25 SCM) | GID `1704234305` |
| Last Chance Records | SHY Last Chance Meet (25 SCY) | GID `0` |

---

## Features

- **Live data** — fetches directly from Google Sheets CSV on every page load
- **Smart filtering** — Age Group, Event, Gender, Club, and Swimmer Name filters
- **Publication order** — events sorted Free → Back → Breast → Fly → IM → Relay
- **Mirrored layout** — Women on left, Men on right when both exist; single column when only one gender has records
- **Mixed section** — relay and mixed gender records shown separately at the bottom of each age group
- **Age group sorting** — standard ranges (18-24 → 95-99), then open+ groups (18+, 25+...), then combined relay groups (72-99) last
- **Swimmer styling** — bold Montserrat name with Roboto Mono club underneath
- **Mobile responsive** — works on phones at poolside
- **Auto-deploys** — every push to `main` triggers Firebase deployment via GitHub Actions CI/CD

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
│   ├── index.html          # Pentathlon Records page
│   ├── last-chance.html    # Last Chance Records page
│   ├── main.js             # All shared app logic
│   └── style.css           # Shared styles for both pages
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD — auto-deploy to Firebase on push
├── firebase.json           # Firebase hosting config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── validate_records.py     # Validation script (see below)
└── GEMINI.md               # AI agent instructions for this project
```

> ⚠️ All JavaScript logic lives in `main.js` — both HTML pages load it via `<script src="main.js" defer>`. Never duplicate logic between HTML files.

---

## Data Architecture

Records are fetched live from a published Google Sheet on every page load:

```
Google Sheet (published CSV)
        ↓
   fetch() in main.js
        ↓
  parseCsv() → buildRecords()
        ↓
  setFilterOptions() + renderTable()
        ↓
     Browser DOM
```

**Column structure expected in the Sheet:**

| Column | Description |
|---|---|
| `Event` | Event number |
| `Gender` | `Women`, `Men`, or `Mixed` |
| `Age Group` | e.g. `18-24`, `75+`, `100-119` (relay combined age) |
| `Event Name` | e.g. `100 Free`, `200 Medley Relay` |
| `Time` | Record time e.g. `55.85` or `2:23.90` |
| `Date` | Date set e.g. `5/18/2025` |
| `Name` | Swimmer name (or relay team names, comma-separated in quotes) |
| `Club` | Club abbreviation e.g. `SCYM`, `GSM` |

---

## How to Update Records

**No code changes needed.** Just update the Google Sheet:

1. Open the Google Sheet
2. Add or edit records following the column format above
3. The site reflects changes automatically on next page load

> Make sure **File → Share → Publish to web** remains enabled with "Automatically republish when changes are made" checked.

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

To deploy manually:
```bash
firebase login --no-localhost
firebase deploy --project pentathlon-records
```

---

## Validation Script

Run `validate_records.py` to validate both tabs against the live Google Sheet:

```bash
python3 validate_records.py
```

**What it checks:**
- All required columns present
- No blank Gender, Age Group, Time, or Name fields
- No duplicate records (same Gender + Age Group + Event)
- Record counts by age group and gender
- Full relay team detail
- Events in correct publication order

---

## CI/CD Pipeline

```
git push → GitHub Actions → firebase deploy → y-swim.com live
```

Configured in `.github/workflows/deploy.yml`. Requires `FIREBASE` secret in GitHub repository settings (Firebase service account JSON).

---

## Firebase Project

**Project ID:** `pentathlon-records`
**Hosting:** Firebase Hosting (free tier)
**Public directory:** `frontend/`

---

## Contributing

This project is maintained by [Paulius Mikalainis](https://mikalainis.com) for Somerset County YMCA Masters Swimming.

To report a data issue, contact the team coach directly to update the Google Sheet.

© 2025 Somerset County YMCA. All rights reserved.