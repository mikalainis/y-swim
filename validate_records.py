#!/usr/bin/env python3
"""
validate_records.py
Validates Somerset County YMCA swim records from Google Sheets
and prints a full summary for both Pentathlon and Last Chance tabs.
"""

import csv
import urllib.request
import urllib.error
import io
from collections import defaultdict

# ── Config ────────────────────────────────────────────────────────────────────
PUBLISHED_BASE = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vSdeB9dzSRs5deGSfMBg75lc8gpW6GFOQ07fF_w-b5ZoDrHvJp-A6i5QZG9dL26NBX7wJGr2YN60aol"
)
TABS = {
    "Pentathlon Records": "1704234305",
    "Last Chance Records": "0",
    "NJLMSC SCY Records": "1806285355",
    "NJLMSC SCM Records": "438569775",
    "NJLMSC LCM Records": "1603815205",
}
REQUIRED_COLUMNS = {"Event", "Gender", "Age Group", "Event Name", "Time", "Date", "Name", "Club"}

# ── Fetch sheet ───────────────────────────────────────────────────────────────
def fetch_sheet(gid):
    url = f"{PUBLISHED_BASE}/pub?output=csv&gid={gid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as response:
        content = response.read().decode("utf-8")
    
    # Use StringIO and read the raw text to handle potentially missing headers
    # The actual column J (index 9) check will be done on the raw row list
    raw_lines = content.strip().splitlines()
    if not raw_lines:
        return [], []
    
    header_row = next(csv.reader([raw_lines[0]]))
    data_rows = list(csv.DictReader(io.StringIO(content)))
    
    # Enrich DictReader rows with raw row list for index-based access (like Column J)
    raw_reader = csv.reader(io.StringIO(content))
    next(raw_reader) # skip headers
    raw_data = list(raw_reader)
    
    for i, row in enumerate(data_rows):
        # Attach raw list to the dict for index-based checks (Column J is index 9)
        row['__raw__'] = raw_data[i] if i < len(raw_data) else []

    return data_rows, header_row

# ── Validation ────────────────────────────────────────────────────────────────
def validate_tab(tab_name, gid):
    print(f"\n{'='*60}")
    print(f"  TAB: {tab_name}")
    print(f"{'='*60}")

    try:
        rows, headers = fetch_sheet(gid)
    except urllib.error.URLError as e:
        print(f"  ❌ ERROR: Could not fetch sheet — {e}")
        return

    print(f"\n📋 COLUMNS FOUND: {', '.join(headers)}")

    # Check required columns
    missing_cols = REQUIRED_COLUMNS - set(headers)
    if missing_cols:
        print(f"  ⚠️  MISSING COLUMNS: {', '.join(sorted(missing_cols))}")
    else:
        print(f"  ✅ All required columns present")

    # ── Totals ────────────────────────────────────────────────────────────────
    total = len(rows)
    unofficial_count = sum(1 for r in rows if len(r.get('__raw__', [])) > 9 and r['__raw__'][9] == '*')
    print(f"\n📊 TOTALS")
    print(f"  Total records: {total}")
    print(f"  Unofficial records (* in Col J): {unofficial_count}")

    # Gender breakdown
    gender_counts = defaultdict(int)
    for r in rows:
        gender_counts[r.get("Gender", "").strip()] += 1
    for gender, count in sorted(gender_counts.items()):
        print(f"  {gender or '(blank)'}: {count}")

    # ── Incomplete Record Check (Missing Time or Name) ───────────────────────
    # This mirrors main.js filter: .filter(r => r.rawTime && r.rawName)
    print(f"\n🔍 INCOMPLETE RECORD CHECK (Missing Time or Name)")
    incomplete = []
    for i, r in enumerate(rows, start=2):
        if not r.get("Time", "").strip() or not r.get("Name", "").strip():
            incomplete.append(f"  Row {i}: Missing {'Time' if not r.get('Time','').strip() else 'Name'} — {r.get('Event Name', 'Unknown Event')}")
    
    if incomplete:
        print(f"  ⚠️  {len(incomplete)} record(s) will be HIDDEN by main.js:")
        for issue in incomplete[:10]:
            print(issue)
        if len(incomplete) > 10:
            print(f"  ... and {len(incomplete) - 10} more")
    else:
        print(f"  ✅ All records are complete (have Time and Name)")

    # ── Blank field check (Other Fields) ──────────────────────────────────────
    print(f"\n🔍 BLANK FIELD CHECK (Gender, Age Group, Event Name)")
    issues = []
    for i, r in enumerate(rows, start=2):
        for col in ["Gender", "Age Group", "Event Name"]:
            if not r.get(col, "").strip():
                issues.append(f"  Row {i}: blank '{col}' — {dict(list(r.items())[:4])}")
    if issues:
        print(f"  ⚠️  {len(issues)} blank field(s) found:")
        for issue in issues[:10]:
            print(issue)
    else:
        print(f"  ✅ Fields present")

    # ── Duplicate check ───────────────────────────────────────────────────────
    print(f"\n🔁 DUPLICATE CHECK (same Gender + Age Group + Event Name)")
    seen = defaultdict(list)
    for i, r in enumerate(rows, start=2):
        key = (r.get("Gender","").strip(), r.get("Age Group","").strip(), r.get("Event Name","").strip())
        seen[key].append(i)
    dupes = {k: v for k, v in seen.items() if len(v) > 1}
    if dupes:
        print(f"  ⚠️  {len(dupes)} duplicate(s) found:")
        for key, line_nums in list(dupes.items())[:10]:
            print(f"  Rows {line_nums}: {key}")
    else:
        print(f"  ✅ No duplicates found")

    # ── Age Group summary ─────────────────────────────────────────────────────
    print(f"\n👥 AGE GROUP SUMMARY")
    age_gender = defaultdict(lambda: defaultdict(int))
    for r in rows:
        # Only count records that are NOT hidden
        if r.get("Time", "").strip() and r.get("Name", "").strip():
            age = r.get("Age Group", "").strip()
            gender = r.get("Gender", "").strip()
            age_gender[age][gender] += 1

    def age_sort_key(age):
        import re
        if "72-99" in age: return (3, 0)
        if "+" in age:     return (2, int(re.search(r'\d+', age).group()) if re.search(r'\d+', age) else 0)
        m = re.search(r'\d+', age)
        return (1, int(m.group()) if m else 0)

    for age in sorted(age_gender.keys(), key=age_sort_key):
        genders = age_gender[age]
        parts = ", ".join(f"{g}: {c}" for g, c in sorted(genders.items()))
        total_age = sum(genders.values())
        print(f"  {age:<12} — {total_age:>3} records  ({parts})")

    # ── Event summary ─────────────────────────────────────────────────────────
    print(f"\n🏊 EVENT SUMMARY (Visible Records)")
    event_counts = defaultdict(int)
    for r in rows:
        if r.get("Time", "").strip() and r.get("Name", "").strip():
            event_counts[r.get("Event Name", "").strip()] += 1

    def event_sort_key(e):
        lower = e.lower()
        if "i.m" in lower or " im" in lower: rank = 4
        elif "medley relay" in lower:        rank = 6
        elif "relay" in lower:               rank = 5
        elif "free" in lower:                rank = 0
        elif "back" in lower:                rank = 1
        elif "breast" in lower:              rank = 2
        elif "fly" in lower:                 rank = 3
        else:                                rank = 9
        import re
        m = re.search(r'\d+', e)
        dist = int(m.group()) if m else 9999
        return (rank, dist)

    for event in sorted(event_counts.keys(), key=event_sort_key):
        print(f"  {event:<30} — {event_counts[event]:>3} record(s)")

    # ── Relay detail ──────────────────────────────────────────────────────────
    relay_rows = [r for r in rows if "relay" in r.get("Event Name","").lower() and r.get("Time","").strip() and r.get("Name","").strip()]
    if relay_rows:
        print(f"\n🔗 RELAY DETAIL ({len(relay_rows)} visible records)")
        for r in relay_rows:
            name = r.get("Name", "").strip()
            print(f"  {r.get('Gender',''):<7} | {r.get('Age Group',''):<8} | {r.get('Event Name',''):<22} | {r.get('Time',''):<8} | {r.get('Date',''):<12} | {name}")

    print(f"\n✅ Validation complete for {tab_name}")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🏊 Somerset County YMCA & NJLMSC Records — Validation Report")
    print(f"{'='*60}")
    for tab_name, gid in TABS.items():
        validate_tab(tab_name, gid)
    print(f"\n{'='*60}")
    print("  Report complete")
    print(f"{'='*60}\n")