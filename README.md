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
- **Auto-deploys** — every push to `main` builds and deploys to Google Cloud Run via GitHub Actions (no stored keys).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, JavaScript (ES6 Modules) |
| Styling | Tailwind CSS (CDN) + shared `style.css` |
| Fonts | Montserrat, Roboto, Roboto Mono (Google Fonts) |
| Data | Google Sheets (live CSV API) |
| Hosting | Google Cloud Run (nginx container), project `pentathlon-records`, region `us-east4` |
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
│       ├── deploy-cloud-run.yml  # CI/CD — build + deploy to Cloud Run on push to main
│       └── deploy.yml            # old Firebase Hosting deploy (removed after the DNS switch)
├── Dockerfile              # nginx image that serves frontend/ as-is (no build step)
├── nginx.conf              # web server config: caching, www → y-swim.com redirect
├── infra/gcp/
│   ├── bootstrap.sh        # one-time Google Cloud setup (run in Cloud Shell)
│   ├── domain.sh           # maps y-swim.com + www to Cloud Run, prints DNS records
│   └── production.env      # project/region/service-account names (not secrets)
├── firebase.json           # old Firebase config (removed after the DNS switch)
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

Deployment is fully automated: every push to `main` runs `.github/workflows/deploy-cloud-run.yml`,
which builds the nginx image, deploys it to Cloud Run, and checks every page loads (~2 minutes).

```bash
git add .
git commit -m "Your change description"
git push
```

GitHub signs in to Google Cloud through Workload Identity Federation, limited to this repo's
`main` branch, so there is no service-account key to store, rotate or leak. Updating records
in the Google Sheet never needs a deploy.

To test the exact production container locally (needs Docker):

```bash
docker build -t y-swim . && docker run --rm -p 8080:8080 y-swim
# Open http://localhost:8080
```

---

## Moving from Firebase Hosting to Cloud Run (one-time checklist)

The site stays live on Firebase until step 4, so there is no downtime.

1. **Billing.** In the Firebase console for project `pentathlon-records`, upgrade to the
   Blaze (pay-as-you-go) plan if it isn't already. Optional: set a budget alert of a few dollars.
   A site this size normally stays inside Cloud Run's free tier.
2. **Google Cloud setup.** Open [Cloud Shell](https://shell.cloud.google.com) as a project Owner and run:
   ```bash
   git clone https://github.com/mikalainis/y-swim && cd y-swim
   bash infra/gcp/bootstrap.sh
   ```
   Paste the lines it prints into `infra/gcp/production.env` and push to `main`.
3. **First deploy.** That push deploys to Cloud Run. Open the `*.run.app` URL shown on the
   Actions run and check every page.
4. **Domain.** In Cloud Shell: `gcloud domains verify y-swim.com` (once), then
   `bash infra/gcp/domain.sh`. At Squarespace Domains, replace the Firebase records for `@` and
   `www` with the ones the script prints (keep the Google Workspace MX/TXT records).
   HTTPS certificates for both `y-swim.com` and `www.y-swim.com` are issued automatically
   within about an hour; `www` redirects to `y-swim.com`.
5. **Retire Firebase Hosting** once y-swim.com loads from Cloud Run: delete
   `.github/workflows/deploy.yml`, `firebase.json`, `.firebaserc` and `firestore.*`, delete the
   `FIREBASE_SERVICE_ACCOUNT` secret in GitHub, delete that service account's key in
   Google Cloud IAM, and run `firebase hosting:disable --project pentathlon-records`.
