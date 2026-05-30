const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSdeB9dzSRs5deGSfMBg75lc8gpW6GFOQ07fF_w-b5ZoDrHvJp-A6i5QZG9dL26NBX7wJGr2YN60aol';
const PAGE_GIDS = {
  'pentathlon.html': '1704234305',
  'last-chance.html': '0',
  'njlmsc-scy.html':  '1806285355',
  'njlmsc-scm.html':  '438569775',
  'njlmsc-lcm.html':  '1603815205'
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
  const page = window.location.pathname.split('/').pop().toLowerCase() || 'pentathlon.html';
  return PAGE_GIDS[page] || PAGE_GIDS['pentathlon.html'];
}

function getElement(id) { return document.getElementById(id); }
function normalizeText(value) { return String(value ?? '').trim(); }

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
  const rows = [];
  let cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        cells.push(current);
        current = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') {
          i++;
        }
        cells.push(current);
        // Only add non-empty rows
        if (cells.some(c => c.trim() !== '')) {
          rows.push(cells);
        }
        cells = [];
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  if (current !== '' || cells.length > 0) {
    cells.push(current);
    if (cells.some(c => c.trim() !== '')) {
      rows.push(cells);
    }
  }
  
  return rows;
}

function buildRecords(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => normalizeText(h));
  return rows.slice(1).map(row => {
    const values = headers.reduce((acc, header, index) => {
      acc[header] = normalizeText(row[index] ?? '');
      return acc;
    }, {});
    const rawEvent  = getColumnValue(values, ['Event Name', 'Event', 'event', 'Record', 'Description', 'Race']);
    const rawTime   = getColumnValue(values, ['Time', 'time', 'Result', 'Results', 'Performance', 'Mark']);
    const rawName   = getColumnValue(values, ['Name', 'name', 'Swimmer', 'Athlete', 'Record Holder', 'Competitor']);
    const rawAge    = getColumnValue(values, ['Age Group', 'Age', 'Category', 'Age Group/Category']);
    const rawGender = getColumnValue(values, ['Gender', 'Sex', 'M/F']);
    const ageGroup  = rawAge    || parseAgeGroup(rawEvent);
    const gender    = rawGender || parseGender(rawEvent);
    const event     = rawEvent  || buildFallbackEvent(values);
    let name        = rawName   || buildFallbackName(values, event);

    // NJLMSC: Add age from Column I if present
    const page = window.location.pathname.split('/').pop().toLowerCase();
    if (['njlmsc-scy.html', 'njlmsc-scm.html', 'njlmsc-lcm.html'].includes(page)) {
      const ageColI = normalizeText(row[8]); // Column I is index 8
      if (ageColI) {
        name += ' (' + ageColI + ')';
      }
    }

    const details   = Object.entries(values)
      .filter(([key, value]) => {
        const lower = key.toLowerCase();
        return value && !['event','event name','time','result','results','performance','mark',
          'name','swimmer','athlete','record','age group','age','category','gender','sex',
          'm/f','date','club'].includes(lower);
      })
      .map(([key, value]) => key + ': ' + value).join(' • ');
    
    // Column J (index 9) contains "*" for unofficial events
    const isUnofficial = row[9] === '*';
    
    return { ageGroup, event, time: rawTime || '', name, gender, details, source: values, isUnofficial, rawTime, rawName };
  }).filter(r => r.rawTime && r.rawName); // Only keep records with both time and name
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
  const gender = parseGender(match[1]);
  const ageRange = match[2] ? ' ' + match[2] : '';
  return (gender + ageRange).trim();
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
  const url = PUBLISHED_BASE + '/pub?output=csv&gid=' + encodeURIComponent(sheetGid);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load sheet data: ' + response.status + ' ' + response.statusText);
  const text = await response.text();
  return buildRecords(parseCsv(text));
}

// ── Event sort helpers ────────────────────────────────────────────────────────
function getStrokeRank(eventStr) {
  const lower = eventStr.toLowerCase();
  if (lower.includes('i.m') || /\bim\b/.test(lower) || lower.includes('individual medley')) return 4;
  if (lower.includes('medley relay') || lower.includes('medley')) return 6;
  if (lower.includes('relay')) return 5;
  if (lower.includes('free')) return 0;
  if (lower.includes('back')) return 1;
  if (lower.includes('breast')) return 2;
  if (lower.includes('fly') || lower.includes('butterfly')) return 3;
  return 99;
}

function getDistance(eventStr) {
  const match = eventStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 9999;
}

function sortEvents(entries) {
  return entries.slice().sort(([a], [b]) => {
    const d = getStrokeRank(a) - getStrokeRank(b);
    return d !== 0 ? d : getDistance(a) - getDistance(b);
  });
}

// ── Swimmer / Club HTML ───────────────────────────────────────────────────────
function swimmerHtml(name, club) {
  return '<span style="display:block;font-family:Montserrat,sans-serif;font-weight:800;font-size:1rem;color:#0c4a6e;letter-spacing:0.01em;">' + escapeHtml(name) + '</span>'
    + (club ? '<span style="display:block;font-family:Roboto Mono,monospace;font-size:0.65rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">' + escapeHtml(club) + '</span>' : '');
}

// ── Render table ──────────────────────────────────────────────────────────────
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

  // Sort age groups
  const getAge = s => { const m = s.match(/(\d+)/); return m ? parseInt(m[1], 10) : 9999; };
  const sortedByAge = Object.entries(byAge).sort(([a], [b]) => {
    const aRelay = a.includes('72-99'), bRelay = b.includes('72-99');
    if (aRelay && !bRelay) return 1;
    if (!aRelay && bRelay) return -1;
    const aPlus = a.includes('+'), bPlus = b.includes('+');
    if (aPlus && !bPlus) return 1;
    if (!aPlus && bPlus) return -1;
    return getAge(a) - getAge(b);
  });

  const html = sortedByAge.map(([ageGroup, ageRecords]) => {

    // Group by event — three buckets
    const byEvent = {};
    ageRecords.forEach(r => {
      const evt = r.event || 'Unknown';
      if (!byEvent[evt]) byEvent[evt] = { women: null, men: null, mixed: null };
      const g = (r.gender || '').toLowerCase();
      if (g === 'women')      byEvent[evt].women = r;
      else if (g === 'mixed') byEvent[evt].mixed = r;
      else                    byEvent[evt].men   = r;
    });

    // Separate regular vs mixed-only
    const regularEvents = Object.entries(byEvent).filter(([, s]) => s.women !== null || s.men !== null);
    const mixedEvents   = Object.entries(byEvent).filter(([, s]) => s.mixed !== null);

    // Determine layout — mirrored only when BOTH Women and Men exist
    const hasWomen = regularEvents.some(([, s]) => s.women !== null);
    const hasMen   = regularEvents.some(([, s]) => s.men   !== null);
    const mirrored = hasWomen && hasMen;
    const empty    = '<span class="text-slate-300">—</span>';

    // Helper for event cell with unofficial badge
    const eventCellHtml = (event, isUnofficial) => {
      const badge = isUnofficial 
        ? '<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider">Unofficial</span>'
        : '';
      const name = isUnofficial ? '<i class="text-slate-500">' + escapeHtml(event) + '</i>' : escapeHtml(event);
      return '<td class="event-cell">' + name + badge + '</td>';
    };

    // Regular rows
    const regularRows = sortEvents(regularEvents).map(([event, sides]) => {
      const w = sides.women;
      const m = sides.men;
      const isUnofficial = (w && w.isUnofficial) || (m && m.isUnofficial);
      
      if (mirrored) {
        return '<tr class="record-row border-b border-slate-100">'
          + '<td class="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">' + (w ? escapeHtml(w.source['Date'] || '') : empty) + '</td>'
          + '<td class="px-3 py-3">'                                           + (w ? swimmerHtml(w.name, w.source['Club']) : empty) + '</td>'
          + '<td class="px-3 py-3 time-cell text-right border-r-2 border-pink-100">' + (w ? escapeHtml(w.time) : empty) + '</td>'
          + eventCellHtml(event, isUnofficial)
          + '<td class="px-3 py-3 time-cell border-l-2 border-blue-100">'     + (m ? escapeHtml(m.time) : empty) + '</td>'
          + '<td class="px-3 py-3">'                                           + (m ? swimmerHtml(m.name, m.source['Club']) : empty) + '</td>'
          + '<td class="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">' + (m ? escapeHtml(m.source['Date'] || '') : empty) + '</td>'
          + '</tr>';
      } else {
        const rec = w || m;
        return '<tr class="record-row border-b border-slate-100">'
          + eventCellHtml(event, isUnofficial)
          + '<td class="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">' + (rec ? escapeHtml(rec.source['Date'] || '') : empty) + '</td>'
          + '<td class="px-3 py-3">'                                           + (rec ? swimmerHtml(rec.name, rec.source['Club']) : empty) + '</td>'
          + '<td class="px-3 py-3 time-cell">'                                 + (rec ? escapeHtml(rec.time) : empty) + '</td>'
          + '</tr>';
      }
    }).join('');

    // Mixed rows at the bottom — always single format: EVENT | Date | Name | Time
    const mixedCols = mirrored ? 7 : 4;
    const mixedHeaderRow = regularEvents.length
      ? '<tr><td colspan="' + mixedCols + '" class="px-3 pt-6 pb-1" style="text-align:center;">'
          + '<div style="display:inline-block;background:linear-gradient(90deg,#faf5ff,#ede9fe);color:#6b21a8;font-family:Montserrat,sans-serif;font-size:0.72rem;font-weight:800;letter-spacing:0.12em;padding:0.4rem 0.75rem;border-radius:0.25rem;">⚡ MIXED</div>'
          + '</td></tr>'
      : ''; // no divider needed if mixed is the only gender
    const mixedRows = mixedEvents.length
      ? mixedHeaderRow
        + sortEvents(mixedEvents).map(([event, sides]) => {
            const mx = sides.mixed;
            return '<tr class="record-row border-b border-slate-100">'
              + eventCellHtml(event, mx ? mx.isUnofficial : false)
              + '<td class="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">' + (mx ? escapeHtml(mx.source['Date'] || '') : empty) + '</td>'
              + '<td class="px-3 py-3">'                                           + (mx ? swimmerHtml(mx.name, mx.source['Club']) : empty) + '</td>'
              + '<td class="px-3 py-3 time-cell">'                                 + (mx ? escapeHtml(mx.time) : empty) + '</td>'
              + (mirrored ? '<td colspan="3"></td>' : '')
              + '</tr>';
          }).join('')
      : '';

    const ageLabel = ageGroup.replace(/^(Men|Women|Mixed)\s*/i, '');

    const hasMixed = mixedEvents.length > 0;

    // Headers — mirrored or single
    const thead1 = mirrored
      ? '<tr>'
        + '<th colspan="3" class="gender-header-women">WOMEN</th>'
        + '<th colspan="1" class="gender-header-spacer"></th>'
        + '<th colspan="3" class="gender-header-men">MEN</th>'
        + '</tr>'
      : '<tr>'
        + (hasWomen ? '<th colspan="4" class="gender-header-women">WOMEN</th>' : '')
        + (hasMen   ? '<th colspan="4" class="gender-header-men">MEN</th>' : '')
        + (!hasWomen && !hasMen && hasMixed
          ? '<th colspan="4" style="background:linear-gradient(90deg,#faf5ff,#ede9fe);color:#6b21a8;font-family:Montserrat,sans-serif;font-size:0.78rem;font-weight:800;letter-spacing:0.12em;text-align:center;padding:0.5rem 0.75rem;">⚡ MIXED</th>'
          : '')
        + '</tr>';

    const thead2 = mirrored
      ? '<tr>'
        + '<th class="sub-header">Date</th><th class="sub-header">Swimmer / Club</th><th class="sub-header text-right border-r-2 border-pink-200">Time</th>'
        + '<th class="sub-header-event">Event</th>'
        + '<th class="sub-header border-l-2 border-blue-200">Time</th><th class="sub-header">Swimmer / Club</th><th class="sub-header">Date</th>'
        + '</tr>'
      : '<tr>'
        + '<th class="sub-header-event">Event</th>'
        + '<th class="sub-header">Date</th>'
        + '<th class="sub-header">Swimmer / Club</th>'
        + '<th class="sub-header">Time</th>'
        + '</tr>';

    return '<div class="mb-10">'
      + '<div class="age-group-banner">🏊 Age Group: ' + escapeHtml(ageLabel) + '</div>'
      + '<div class="table-wrapper"><table class="min-w-full text-left">'
      + '<thead>' + thead1 + thead2 + '</thead>'
      + '<tbody class="divide-y divide-slate-100 bg-white">' + regularRows + mixedRows + '</tbody>'
      + '</table></div></div>';
  }).join('');

  container.innerHTML = html;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]+/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m)
  );
}

// ── Filter options ────────────────────────────────────────────────────────────
function setFilterOptions(records) {
  const ageFilter    = getElement(ELEMENT_IDS.ageFilter);
  const eventFilter  = getElement(ELEMENT_IDS.eventFilter);
  const genderFilter = getElement(ELEMENT_IDS.genderFilter);
  const clubFilter   = getElement(ELEMENT_IDS.clubFilter);
  if (!ageFilter || !eventFilter || !genderFilter) return;

  const getAge = s => { const m = s.match(/(\d+)/); return m ? parseInt(m[1], 10) : 9999; };
  const ageGroups = [...new Set(records.map(r => r.ageGroup).filter(Boolean))].sort((a, b) => {
    const aRelay = a.includes('72-99'), bRelay = b.includes('72-99');
    if (aRelay && !bRelay) return 1;
    if (!aRelay && bRelay) return -1;
    const aPlus = a.includes('+'), bPlus = b.includes('+');
    if (aPlus && !bPlus) return 1;
    if (!aPlus && bPlus) return -1;
    return getAge(a) - getAge(b);
  });

  const events = [...new Set(records.map(r => r.event).filter(Boolean))].sort((a, b) => {
    const d = getStrokeRank(a) - getStrokeRank(b);
    return d !== 0 ? d : getDistance(a) - getDistance(b);
  });

  const GENDER_ORDER = ['Women', 'Men', 'Mixed'];
  const rawGenders = [...new Set(records.map(r => r.gender).filter(Boolean))];
  const genders = GENDER_ORDER.filter(g => rawGenders.includes(g));

  const clubs = [...new Set(records.map(r => r.source['Club']).filter(Boolean))].sort();

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
    if (nameVal && !(r.name + ' ' + r.event + ' ' + r.details).toLowerCase().includes(nameVal)) return false;
    return true;
  });
}

function showMessage(message) {
  const container = getElement(ELEMENT_IDS.recordsContainer);
  if (container) container.innerHTML = '<div class="text-center text-slate-500 py-12">' + escapeHtml(message) + '</div>';
}

function updateSheetMeta(message) {
  const el = getElement('sheet-meta');
  if (el) el.textContent = message;
}

function updateHeaderDate(date) {
  const el = getElement('header-date');
  if (el) el.textContent = 'Records as of ' + date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
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
  const page = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';
  if (page === 'index.html' || page === '') return; // Don't run on hub page

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
    updateSheetMeta('Live data loaded ' + formatTimestamp(now));
    updateHeaderDate(now);
  } catch (error) {
    console.error(error);
    showMessage('Unable to load live sheet data. Please confirm the Google Sheet is shared publicly and that the tab names are correct.');
    updateSheetMeta('Unable to load sheet data.');
  }
}

window.addEventListener('DOMContentLoaded', init);