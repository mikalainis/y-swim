# Somerset County YMCA Pentathlon Records

A modern, mobile-responsive web application for displaying and filtering swimming pentathlon records. This project replaces the old static PDF system with a live, searchable database built on Firebase.

## 🚀 Live Website

**[https://pentathlon-records.web.app/](https://pentathlon-records.web.app/)**

## ✨ Features

* **Live Search:** Instantly filter records by Swimmer Name.
* **Smart Filtering:** Dropdowns for Age Group, Event, and Gender.
* **Mobile Optimized:** Responsive layout that looks great on phones (cards) and desktops (tables).
* **Smart Sorting:** Events are automatically sorted by Stroke (Fly -> Back -> Breast -> Free -> IM) and Distance.
* **Separate Sections:** Clearly divides "Women", "Men", and "Mixed" records.
* **Self-Contained Data:** Records are loaded directly from a structured javascript data block (easier to maintain than a complex database UI).

## 🛠️ Tech Stack

* **Frontend:** HTML5, JavaScript (ES6 Modules)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) (via CDN)
* **Hosting:** Google Firebase Hosting
* **Database:** (Optional) Configured for Firestore, though current version uses embedded JSON for speed/simplicity.

## 📂 Project Structure

```text
/
├── frontend/
│   ├── index.html       # The main application code
│   ├── style.css        # (Optional) Additional custom styles
│   └── main.js          # (Optional) External script file
├── firebase.json        # Firebase hosting configuration
├── .firebaserc          # Firebase project aliases
└── README.md            # Project documentation

```

## ⚙️ Setup & Installation

### 1. Prerequisites

* Node.js installed
* Firebase CLI installed (`npm install -g firebase-tools`)
* A Google Firebase account

### 2. Local Development

Clone the repository and enter the directory:

```bash
git clone https://github.com/YOUR_USERNAME/pentathlon-records.git
cd pentathlon-records

```

To verify the site locally before deploying:

```bash
cd frontend
python3 -m http.server 8080
# Open your browser to http://localhost:8080

```

## 🚀 Deployment

This project is hosted on Firebase. To update the live site:

1. **Make your changes** to `frontend/index.html`.
2. **Deploy** using the Firebase CLI:

```bash
firebase deploy --project pentathlon-records
# Make changes
CI/CD Automation

git add .
git commit -m "Update records"
git push
# Done — Firebase deploys automatically in ~60 seconds

```

If you are using a cloud terminal and need to authenticate manually:

```bash
firebase login:ci
# Copy the token it gives you
firebase deploy --token "YOUR_LONG_TOKEN_HERE" --project scym-pentathlon-records-2025

```

## 📝 How to Update Records (Yearly Maintenance)

The records are stored directly inside `frontend/index.html` for simplicity.

1. Open `frontend/index.html`.
2. Scroll down to the `<script>` tag to find the `const rawData = ...` block.
3. Add new records following this exact format:
```javascript
"#EventNumber Gender AgeGroup Distance Stroke","Time","Date Team Name"

```


*Example:*
```javascript
"#11 Men 30-34 100 Free","55.85","12/11/2022 Lovro Bilonic - UC07"

```


4. Save and Deploy.

## 🎨 Color Coding Guide

* **Blue Times:** Standard records (Men's / Women's).
* **Purple Times:** Mixed Relay records (distinguishes them from single-gender events).

## 📄 License

© 2025 Somerset County YMCA. All rights reserved.# y-swim
