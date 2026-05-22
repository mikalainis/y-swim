const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSdeB9dzSRs5deGSfMBg75lc8gpW6GFOQ07fF_w-b5ZoDrHvJp-A6i5QZG9dL26NBX7wJGr2YN60aol';
const PAGE_GIDS = {
  'index.html': '1704234305',
  'last-chance.html': '0'
};

const ELEMENT_IDS = {
  recordsContainer: 'records-container',
  ageFilter:    'filter-age',
  eventFilter:  'filter-event',
  genderFilter: 'filter-gender',
  clubFilter:   'filter-club',
  nameFilter:   'filter-name',
  clearFilters: 'clear-filters'
};

function getSheetGid() {
  const page = window.location.pathname.split('/').pop().toLowerCase();
  return PAGE_GIDS[page] || '1704234305';
}

function getElement(id) {
  return document.getElementById(id);
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function getColumnValue(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = normalizeText(row[key]);
      if (value) return value;
    }
  }
  return '';
}

function parseCsv(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"') {
            if (line[i + 1] === '"') { current += '"'; i += 1; }
            else { inQuotes = false; }
          } else { current += char; }
        } else if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          cells.push(current); current = '';
        } else {
          current += char;
        }
      }
      cells.push(current);
      return cells;
    });
}

function buildRecords(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => normalizeText(header));
  return rows.slice(1).map((row) => {
    const values = headers.reduce((acc, header, index) => {
      acc[header] = normalizeText(row[index] ?? '');
      return acc;
    }, {});

    const rawEvent  = getColumnValue(values, ['Event Name', 'Event', 'event', 'Record', 'Description', 'Race']);
    const rawTime   = getColumnValue(values, ['Time', 'time', 'Result', 'Results', 'Performance', 'Mark']);
    const rawName   = getColumnValue(values, ['Name', 'name', 'Swimmer', 'Athlete', 'Record Holder', 'Competitor']);
    const rawAge    = getColumnValue(values, ['Age Group', 'Age', 'Category', 'Age Group/Category']);
    const rawGender = getColumnValue(values, ['Gender', 'Sex', 'M/F']);

    const ageGroup = rawAge  || parseAgeGroup(rawEvent);
    const gender   = rawGender || parseGender(rawEvent);
    const event    = rawEvent  || buildFallbackEvent(values);
    const name     = rawName   || buildFallbackName(values, event);

    const details = Object.entries(values)
      .filter(([key, value]) => {
        const lower = key.toLowerCase();
        return value && !['event', 'event name', 'time', 'result', 'results', 'performance',
          'mark', 'name', 'swimmer', 'athlete', 'record', 'age group', 'age', 'category',
          'gender', 'sex', 'm/f', 'date', 'club'].includes(lower);
      })
      .map(([key, value]) => `${key}: ${value}`)
      .join(' • ');

    return { ageGroup, event, time: rawTime || '', name, gender, details, source: values };
  });
}

function parseGender(text) {
  const match = normalizeText(text).match(/\b(Women|Men|Mixed|W|M|X)\b/i);
  if (!match) return 'All';
  const n = match[1].toLowerCase();
  if (n === 'w') return 'Women';
  if (n === 'm') return 'Men';
  if (n === 'x') return 'Mixed';
  return (n === 'women' || n === 'men' || n === 'mixed') ? capitalize(n) : 'All';
}

function parseAgeGroup(text) {
  const match = normalizeText(text).match(/\b(Women|Men|Mixed|W|M|X)\b\s*([0-9]{1,2}-[0-9]{1,2})?/i);
  if (!match) return '';
  const gender   = parseGender(match[1]);
  const ageRange = match[2] ? ` ${match[2]}` : '';
  return `${gender}${ageRange}`.trim();
}

function buildFallbackEvent(values) {
  const raw = getColumnValue(values, ['Record', 'Description', 'Event Name', 'Event', 'Race']);
  return raw ? raw.replace(/^#\d+\s*/i, '') : '';
}

function buildFallbackName(values, event) {
  const candidate = getColumnValue(values, ['Record Holder', 'Swimmer', 'Athlete', 'Name', 'Competitor', 'Club', 'Team']);
  return candidate || event;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

async function fetchSheetData(sheetGid) {
  const url = `${PUBLISHED_BASE}/pub?output=csv&gid=${encodeURIComponent(sheetGid)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load sheet data: ${response.status} ${response.statusText}`);
  const text = await response.text();
  return buildRecords(parseCsv(text));
}

// ── Swimmer / Club HTML helpers ───────────────────────────────────────────────
function swimmerHtml(name, club) {
  const nameSpan = `<span style="display:block;font-family:'Montserrat',sans-serif;font-weight:800;font-size:1rem;color:#0c4a6e;letter-spacing:0.01em;">${escapeHtml(name)}</span>`;
  const clubSpan = club
    ? `<span style="display:block;font-family:'Roboto Mono',monospace;font-size:0.65rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">${escapeHtml(club)}</span>`
    : '';
  return nameSpan + clubSpan;
}

function renderTable(records) {
  const container = getElement(ELEMENT_IDS.recordsContainer);
  if (!container) return;

  if (!records.length) {
    container.innerHTML = '<div class="text-center text-slate-500 py-12">No records available for the selected filters.</div>';
    return;
  }

  // Group by Age Group
  const byAge = {};
  records.forEach(r => {
    const age = r.ageGroup || 'Unknown';
    if (!byAge[age]) byAge[age] = [];
    byAge[age].push(r);
  });

  const html = Object.entries(byAge).map(([ageGroup, ageRecords]) => {

    // Group by event within each age group
    const byEvent = {};
    ageRecords.forEach(r => {
      const evt = r.event || 'Unknown';
      if (!byEvent[evt]) byEvent[evt] = { women: null, other: null };
      if ((r.gender || '').toLowerCase() === 'women') byEvent[evt].women = r;
      else byEvent[evt].other = r;
    });

    const rows = Object.entries(byEvent).map(([event, sides]) => {
      const w = sides.women;
      const m = sides.other;
      const empty = '<span class="text-slate-300">—</span>';

      const wDate = w ? escapeHtml(w.source['Date'] || '') : '';
      const wName = w ? swimmerHtml(w.name, w.source['Club']) : '';
      const wTime = w ? escapeHtml(w.time) : '';
      const mTime = m ? escapeHtml(m.time) : '';
      const mName = m ? swimmerHtml(m.name, m.source['Club']) : '';
      const mDate = m ? escapeHtml(m.source['Date'] || '') : '';

      return `
        <tr class="record-row border-b border-slate-100">
          <td class="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">${wDate || (w ? '' : empty)}</td>
          <td class="px-3 py-3">${wName || (w ? '' : empty)}</td>
          <td class="px-3 py-3 time-cell text-right border-r-2 border-pink-100">${wTime || (w ? '' : empty)}</td>
          <td class="event-cell">${escapeHtml(event)}</td>
          <td class="px-3 py-3 time-cell border-l-2 border-blue-100">${mTime || (m ? '' : empty)}</td>
          <td class="px-3 py-3">${mName || (m ? '' : empty)}</td>
          <td class="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">${mDate || (m ? '' : empty)}</td>
        </tr>`;
    }).join('');

    const ageLabel = ageGroup.replace(/^(Men|Women|Mixed)\s*/i, '');

    return `
      <div class="mb-10">
        <div class="age-group-banner">🏊 Age Group: ${escapeHtml(ageLabel)}</div>
        <div class="table-wrapper">
          <table class="min-w-full text-left">
            <thead>
              <tr>
                <th colspan="3" class="gender-header-women">♀ WOMEN</th>
                <th class="gender-header-spacer px-3 py-2"></th>
                <th colspan="3" class="gender-header-men">♂ MEN / MIXED</th>
              </tr>
              <tr>
                <th class="sub-header">Date</th>
                <th class="sub-header">Swimmer / Club</th>
                <th class="sub-header text-right border-r-2 border-pink-200">Time</th>
                <th class="sub-header-event">Event</th>
                <th class="sub-header border-l-2 border-blue-200">Time</th>
                <th class="sub-header">Swimmer / Club</th>
                <th class="sub-header">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = html;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]+/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m)
  );
}

function setFilterOptions(records) {
  const ageFilter    = getElement(ELEMENT_IDS.ageFilter);
  const eventFilter  = getElement(ELEMENT_IDS.eventFilter);
  const genderFilter = getElement(ELEMENT_IDS.genderFilter);
  const clubFilter   = getElement(ELEMENT_IDS.clubFilter);
  if (!ageFilter || !eventFilter || !genderFilter) return;

  const ageGroups = [...new Set(records.map(r => r.ageGroup).filter(Boolean))]
    .sort((a, b) => {
      const getAge = s => { const m = s.match(/(\d+)/); return m ? parseInt(m[1], 10) : 9999; };
      const aPlus = a.includes('+'), bPlus = b.includes('+');
      if (aPlus && !bPlus) return 1;
      if (!aPlus && bPlus) return -1;
      return getAge(a) - getAge(b);
    });

  const STROKE_ORDER = ['fly', 'back', 'breast', 'free', 'im'];

  function getStrokeRank(eventStr) {
    const lower = eventStr.toLowerCase();
    const idx = STROKE_ORDER.findIndex(s => lower.includes(s));
    return idx === -1 ? 99 : idx;
  }

  function getDistance(eventStr) {
    const match = eventStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 9999;
  }

  const events = [...new Set(records.map(r => r.event).filter(Boolean))]
    .sort((a, b) => {
      const strokeDiff = getStrokeRank(a) - getStrokeRank(b);
      if (strokeDiff !== 0) return strokeDiff;
      return getDistance(a) - getDistance(b);
    });
  const genders = [...new Set(records.map(r => r.gender).filter(Boolean))].sort();
  const clubs   = [...new Set(records.map(r => r.source['Club']).filter(Boolean))].sort();

  fillSelectOptions(ageFilter,    ageGroups, 'All Age Groups');
  fillSelectOptions(eventFilter,  events,    'All Events');
  fillSelectOptions(genderFilter, genders.length ? genders : ['All'], 'All');
  if (clubFilter) fillSelectOptions(clubFilter, clubs, 'All Clubs');
}

function fillSelectOptions(select, options, defaultLabel) {
  const current = select.value || 'all';
  select.innerHTML = '';
  const def = document.createElement('option');
  def.value = 'all'; def.textContent = defaultLabel;
  select.appendChild(def);
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt; el.textContent = opt;
    select.appendChild(el);
  });
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function applyFilters(records) {
  const ageFilter    = getElement(ELEMENT_IDS.ageFilter);
  const eventFilter  = getElement(ELEMENT_IDS.eventFilter);
  const genderFilter = getElement(ELEMENT_IDS.genderFilter);
  const clubFilter   = getElement(ELEMENT_IDS.clubFilter);
  const nameFilter   = getElement(ELEMENT_IDS.nameFilter);
  if (!ageFilter || !eventFilter || !genderFilter || !nameFilter) return records;

  const ageVal    = ageFilter.value;
  const eventVal  = eventFilter.value;
  const genderVal = genderFilter.value;
  const clubVal   = clubFilter ? clubFilter.value : 'all';
  const nameVal   = normalizeText(nameFilter.value).toLowerCase();

  return records.filter(r => {
    if (ageVal    !== 'all' && r.ageGroup       !== ageVal)    return false;
    if (eventVal  !== 'all' && r.event          !== eventVal)  return false;
    if (genderVal !== 'all' && r.gender         !== genderVal) return false;
    if (clubVal   !== 'all' && r.source['Club'] !== clubVal)   return false;
    if (nameVal && !`${r.name} ${r.event} ${r.details}`.toLowerCase().includes(nameVal)) return false;
    return true;
  });
}

function showMessage(message) {
  const container = getElement(ELEMENT_IDS.recordsContainer);
  if (container) container.innerHTML = `<div class="text-center text-slate-500 py-12">${escapeHtml(message)}</div>`;
}

function updateSheetMeta(message) {
  const el = getElement('sheet-meta');
  if (el) el.textContent = message;
}

function updateHeaderDate(date) {
  const el = getElement('header-date');
  if (el) el.textContent = `Records as of ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
}

function formatTimestamp(date) {
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function setupEventListeners(baseRecords) {
  const ageFilter    = getElement(ELEMENT_IDS.ageFilter);
  const eventFilter  = getElement(ELEMENT_IDS.eventFilter);
  const genderFilter = getElement(ELEMENT_IDS.genderFilter);
  const clubFilter   = getElement(ELEMENT_IDS.clubFilter);
  const nameFilter   = getElement(ELEMENT_IDS.nameFilter);
  const clearButton  = getElement(ELEMENT_IDS.clearFilters);

  const update = () => renderTable(applyFilters(baseRecords));
  [ageFilter, eventFilter, genderFilter, clubFilter].forEach(s => { if (s) s.addEventListener('change', update); });
  if (nameFilter) nameFilter.addEventListener('input', update);

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (ageFilter)    ageFilter.value    = 'all';
      if (eventFilter)  eventFilter.value  = 'all';
      if (genderFilter) genderFilter.value = 'all';
      if (clubFilter)   clubFilter.value   = 'all';
      if (nameFilter)   nameFilter.value   = '';
      renderTable(baseRecords);
    });
  }
}

async function init() {
  const sheetGid = getSheetGid();
  showMessage('Loading records data...');
  updateSheetMeta('Fetching live sheet data...');
  try {
    const records = await fetchSheetData(sheetGid);
    if (!records.length) {
      showMessage('The sheet is empty or no records were returned from the selected tab.');
      updateSheetMeta('Live sheet loaded, but no records were returned.');
      return;
    }
    setFilterOptions(records);
    setupEventListeners(records);
    renderTable(records);
    const now = new Date();
    updateSheetMeta(`Live data loaded ${formatTimestamp(now)}`);
    updateHeaderDate(now);
  } catch (error) {
    console.error(error);
    showMessage('Unable to load live sheet data. Please confirm the Google Sheet is shared publicly and that the tab names are correct.');
    updateSheetMeta('Unable to load sheet data.');
  }
}

window.addEventListener('DOMContentLoaded', init);