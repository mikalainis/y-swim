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
            if (line[i + 1] === '"') {
              current += '"';
              i += 1;
            } else {
              inQuotes = false;
            }
          } else {
            current += char;
          }
        } else if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          cells.push(current);
          current = '';
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

    // FIX 1: Event Name is prioritized first in lookup
    const rawEvent = getColumnValue(values, ['Event Name', 'Event', 'event', 'Record', 'Description', 'Race']);
    const rawTime  = getColumnValue(values, ['Time', 'time', 'Result', 'Results', 'Performance', 'Mark']);
    const rawName  = getColumnValue(values, ['Name', 'name', 'Swimmer', 'Athlete', 'Record Holder', 'Competitor']);
    const rawAge   = getColumnValue(values, ['Age Group', 'Age', 'Category', 'Age Group/Category']);
    const rawGender = getColumnValue(values, ['Gender', 'Sex', 'M/F']);

    const ageGroup = rawAge || parseAgeGroup(rawEvent);
    const gender   = rawGender || parseGender(rawEvent);
    const event    = rawEvent || buildFallbackEvent(values);
    const name     = rawName || buildFallbackName(values, event);

    const details = Object.entries(values)
      .filter(([key, value]) => {
        const lower = key.toLowerCase();
        return value && !['event', 'event name', 'time', 'result', 'results', 'performance', 'mark', 'name', 'swimmer', 'athlete', 'record', 'age group', 'age', 'category', 'gender', 'sex', 'm/f', 'date', 'club'].includes(lower);
      })
      .map(([key, value]) => `${key}: ${value}`)
      .join(' • ');

    return {
      ageGroup,
      event,
      time:   rawTime || '',
      name,
      gender,
      details,
      source: values   // raw row — used to pull Date and Club directly
    };
  });
}

function parseGender(text) {
  const match = normalizeText(text).match(/\b(Women|Men|Mixed|W|M|X)\b/i);
  if (!match) return 'All';
  const normalized = match[1].toLowerCase();
  if (normalized === 'w') return 'Women';
  if (normalized === 'm') return 'Men';
  if (normalized === 'x') return 'Mixed';
  return normalized === 'women' || normalized === 'men' || normalized === 'mixed'
    ? capitalize(normalized)
    : 'All';
}

function parseAgeGroup(text) {
  const trimmed = normalizeText(text);
  const match = trimmed.match(/\b(Women|Men|Mixed|W|M|X)\b\s*([0-9]{1,2}-[0-9]{1,2})?/i);
  if (!match) return '';
  const gender = parseGender(match[1]);
  const ageRange = match[2] ? ` ${match[2]}` : '';
  return `${gender}${ageRange}`.trim();
}

function buildFallbackEvent(values) {
  const raw = getColumnValue(values, ['Record', 'Description', 'Event Name', 'Event', 'Race']);
  if (!raw) return '';
  return raw.replace(/^#\d+\s*/i, '');
}

function buildFallbackName(values, event) {
  const candidate = getColumnValue(values, ['Record Holder', 'Swimmer', 'Athlete', 'Name', 'Competitor', 'Club', 'Team']);
  if (candidate) return candidate;
  return event;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

async function fetchSheetData(sheetGid) {
  const url = `${PUBLISHED_BASE}/pub?output=csv&gid=${encodeURIComponent(sheetGid)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load sheet data: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const table = parseCsv(text);
  return buildRecords(table);
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
  records.forEach(record => {
    const age = record.ageGroup || 'Unknown';
    if (!byAge[age]) byAge[age] = [];
    byAge[age].push(record);
  });

  const html = Object.entries(byAge).map(([ageGroup, ageRecords]) => {

    // Within each age group, group by event name
    const byEvent = {};
    ageRecords.forEach(record => {
      const evt = record.event || 'Unknown';
      if (!byEvent[evt]) byEvent[evt] = { women: null, other: null };
      const g = (record.gender || '').toLowerCase();
      if (g === 'women') {
        byEvent[evt].women = record;
      } else {
        byEvent[evt].other = record;
      }
    });

    const rows = Object.entries(byEvent).map(([event, sides]) => {
      const w = sides.women;
      const m = sides.other;
      const empty = '<span class="text-slate-300">—</span>';

      // FIX 2: Read Date and Club directly from source columns
      const wDate = w ? escapeHtml(w.source['Date'] || '') : '';
      const wName = w ? escapeHtml(w.name + (w.source['Club'] ? ' · ' + w.source['Club'] : '')) : '';
      const wTime = w ? escapeHtml(w.time) : '';

      const mTime = m ? escapeHtml(m.time) : '';
      const mName = m ? escapeHtml(m.name + (m.source['Club'] ? ' · ' + m.source['Club'] : '')) : '';
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
        </tr>
      `;
    }).join('');

    return `
      <div class="mb-10">
        <div class="age-group-banner">
          🏊 Age Group: ${escapeHtml(ageGroup.replace(/^(Men|Women|Mixed)\s*/i, ''))}
        </div>
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
            <tbody class="divide-y divide-slate-100 bg-white">
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]+/g, (match) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return map[match] || match;
  });
}

function setFilterOptions(records) {
  const ageFilter    = getElement(ELEMENT_IDS.ageFilter);
  const eventFilter  = getElement(ELEMENT_IDS.eventFilter);
  const genderFilter = getElement(ELEMENT_IDS.genderFilter);
  const clubFilter   = getElement(ELEMENT_IDS.clubFilter);

  if (!ageFilter || !eventFilter || !genderFilter) return;

  const ageGroups = [...new Set(records.map((r) => r.ageGroup).filter(Boolean))]
    .sort((a, b) => {
      const aPlus = a.includes('+');
      const bPlus = b.includes('+');
      if (aPlus && !bPlus) return 1;   // a goes after b
      if (!aPlus && bPlus) return -1;  // a goes before b
      return a.localeCompare(b);       // both same type — sort normally
    });
  const events    = [...new Set(records.map((r) => r.event).filter(Boolean))].sort();
  const genders   = [...new Set(records.map((r) => r.gender).filter(Boolean))].sort();
  const clubs     = [...new Set(records.map((r) => r.source['Club']).filter(Boolean))].sort();

  fillSelectOptions(ageFilter,    ageGroups, 'All Age Groups');
  fillSelectOptions(eventFilter,  events,    'All Events');
  fillSelectOptions(genderFilter, genders.length ? genders : ['All'], 'All');
  if (clubFilter) fillSelectOptions(clubFilter, clubs, 'All Clubs');
}

function fillSelectOptions(select, options, defaultLabel) {
  const current = select.value || 'all';
  select.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = 'all';
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);

  options.forEach((option) => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });

  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
}

function applyFilters(records) {
  const ageFilter    = getElement(ELEMENT_IDS.ageFilter);
  const eventFilter  = getElement(ELEMENT_IDS.eventFilter);
  const genderFilter = getElement(ELEMENT_IDS.genderFilter);
  const clubFilter   = getElement(ELEMENT_IDS.clubFilter);
  const nameFilter   = getElement(ELEMENT_IDS.nameFilter);

  if (!ageFilter || !eventFilter || !genderFilter || !nameFilter) return records;

  const ageValue    = ageFilter.value;
  const eventValue  = eventFilter.value;
  const genderValue = genderFilter.value;
  const clubValue   = clubFilter ? clubFilter.value : 'all';
  const nameValue   = normalizeText(nameFilter.value).toLowerCase();

  return records.filter((record) => {
    if (ageValue    !== 'all' && record.ageGroup          !== ageValue)    return false;
    if (eventValue  !== 'all' && record.event             !== eventValue)  return false;
    if (genderValue !== 'all' && record.gender            !== genderValue) return false;
    if (clubValue   !== 'all' && record.source['Club']    !== clubValue)   return false;
    if (nameValue && !`${record.name} ${record.event} ${record.details}`.toLowerCase().includes(nameValue)) return false;
    return true;
  });
}

function showMessage(message) {
  const container = getElement(ELEMENT_IDS.recordsContainer);
  if (!container) return;
  container.innerHTML = `<div class="text-center text-slate-500 py-12">${escapeHtml(message)}</div>`;
}

function updateSheetMeta(message) {
  const el = getElement('sheet-meta');
  if (el) el.textContent = message;
}

function updateHeaderDate(date) {
  const el = getElement('header-date');
  if (!el) return;
  el.textContent = `Records as of ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
}

function formatTimestamp(date) {
  return date.toLocaleString(undefined, {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function setupEventListeners(baseRecords) {
  const ageFilter    = getElement(ELEMENT_IDS.ageFilter);
  const eventFilter  = getElement(ELEMENT_IDS.eventFilter);
  const genderFilter = getElement(ELEMENT_IDS.genderFilter);
  const clubFilter   = getElement(ELEMENT_IDS.clubFilter);
  const nameFilter   = getElement(ELEMENT_IDS.nameFilter);
  const clearButton  = getElement(ELEMENT_IDS.clearFilters);

  const update = () => renderTable(applyFilters(baseRecords));

  [ageFilter, eventFilter, genderFilter, clubFilter].forEach((select) => {
    if (select) select.addEventListener('change', update);
  });

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