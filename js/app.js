// View logic, routing between tabs and the attack form.

import * as store from './store.js';
import { barChart } from './charts.js';
import {
  toInputValue, fromInputValue, formatDayShort, formatDayFull, formatTimeOfDay,
  formatMonthYear, formatMonthShort, monthKey, formatDuration, formatDurationLive,
  formatNumber, intensityInfo, DAY, MINUTE,
} from './format.js';

const VIEW_TITLES = {
  logg: 'Logg',
  statistikk: 'Statistikk',
  innstillinger: 'Innstillinger',
};

const viewEl = document.getElementById('view');
const titleEl = document.getElementById('view-title');
const tabButtons = [...document.querySelectorAll('.tab')];
const dialog = document.getElementById('attack-dialog');
const form = document.getElementById('attack-form');
const dialogTitle = document.getElementById('dialog-title');
const errorEl = document.getElementById('form-error');
const startInput = document.getElementById('f-start');
const endInput = document.getElementById('f-end');
const endField = document.getElementById('end-field');
const ongoingInput = document.getElementById('f-ongoing');
const intensityInput = document.getElementById('f-intensity');
const intensityValue = document.getElementById('f-intensity-value');
const intensityLabel = document.getElementById('f-intensity-label');
const noteInput = document.getElementById('f-note');
const deleteBtn = document.getElementById('delete-btn');
const importInput = document.getElementById('import-input');

let currentView = 'logg';
let editingId = null;
let statusMessage = '';
let backupText = '';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function durationOf(attack, now = Date.now()) {
  const start = new Date(attack.start).getTime();
  const end = attack.end ? new Date(attack.end).getTime() : now;
  return Math.max(0, end - start);
}

/* ---------- View: Logg ---------- */

function renderAttackRow(attack) {
  const start = new Date(attack.start);
  const info = intensityInfo(attack.intensity);
  const parts = [formatDuration(durationOf(attack)), info.label];
  if (attack.note.trim()) parts.push(attack.note.trim());

  // Without an explicit label a screen reader reads the badge as a bare
  // number before the rest of the row.
  const spoken = [
    `${formatDayFull(start)} klokka ${formatTimeOfDay(start)}`,
    `styrke ${attack.intensity} av 10, ${info.label}`,
    attack.end ? `varighet ${formatDuration(durationOf(attack))}` : 'pågår fortsatt',
  ];
  if (attack.note.trim()) spoken.push(`notat: ${attack.note.trim()}`);

  return `
    <button type="button" class="row" data-action="edit" data-id="${escapeHtml(attack.id)}"
            aria-label="${escapeHtml(spoken.join(', '))}">
      <span class="badge" style="--badge-color: var(${info.cssVar})">${attack.intensity}</span>
      <span class="row-main">
        <span class="row-title">${escapeHtml(formatDayShort(start))} · ${escapeHtml(formatTimeOfDay(start))}</span>
        <span class="row-sub">${escapeHtml(parts.join(' · '))}</span>
      </span>
      <span class="row-chev" aria-hidden="true">›</span>
    </button>`;
}

function renderOngoingCard(attack) {
  const start = new Date(attack.start);
  const info = intensityInfo(attack.intensity);
  return `
    <section class="ongoing" aria-label="Pågående anfall">
      <p class="ongoing-label">Pågår nå</p>
      <p class="ongoing-time" id="ongoing-time">${escapeHtml(formatDurationLive(durationOf(attack)))}</p>
      <p class="ongoing-sub">Startet ${escapeHtml(formatTimeOfDay(start))} · styrke ${attack.intensity} (${escapeHtml(info.label)})</p>
      <div class="ongoing-actions">
        <button type="button" class="btn primary" data-action="end-now" data-id="${escapeHtml(attack.id)}">Avslutt nå</button>
        <button type="button" class="btn ghost" data-action="edit" data-id="${escapeHtml(attack.id)}">Rediger</button>
      </div>
    </section>`;
}

function renderLog() {
  const attacks = store.all();
  const ongoing = attacks.find((a) => a.end === null) ?? null;
  const finished = attacks.filter((a) => a !== ongoing);

  let html = '';
  if (ongoing) html += renderOngoingCard(ongoing);

  html += `
    <button type="button" class="btn primary" data-action="new">
      <span class="btn-plus" aria-hidden="true">+</span> Registrer anfall
    </button>`;

  if (attacks.length === 0) {
    return html + `
      <div class="empty">
        <h2>Ingen anfall registrert</h2>
        <p>Trykk på knappen over når du får et anfall. Du kan registrere det mens det pågår, eller i etterkant.</p>
      </div>`;
  }

  const groups = new Map();
  for (const attack of finished) {
    const key = monthKey(new Date(attack.start));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(attack);
  }

  for (const [, group] of groups) {
    const heading = formatMonthYear(new Date(group[0].start));
    const count = group.length === 1 ? '1 anfall' : `${group.length} anfall`;
    html += `
      <section class="month-group">
        <h2 class="month-heading">${escapeHtml(heading)} · ${count}</h2>
        <div class="rows">${group.map(renderAttackRow).join('')}</div>
      </section>`;
  }

  return html;
}

/* ---------- View: Statistikk ---------- */

function renderKpis(attacks) {
  const cutoff = Date.now() - 30 * DAY;
  const last30 = attacks.filter((a) => new Date(a.start).getTime() >= cutoff).length;

  const avgIntensity = attacks.length
    ? attacks.reduce((sum, a) => sum + a.intensity, 0) / attacks.length
    : NaN;

  const finished = attacks.filter((a) => a.end !== null);
  const durations = finished.map((a) => durationOf(a));
  const avgDuration = durations.length
    ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length
    : NaN;
  const longest = durations.length ? Math.max(...durations) : NaN;

  const tiles = [
    [String(last30), 'anfall siste 30 dager'],
    [Number.isNaN(avgIntensity) ? '–' : formatNumber(avgIntensity), 'snittstyrke (1–10)'],
    [Number.isNaN(avgDuration) ? '–' : formatDuration(avgDuration), 'snittvarighet'],
    [Number.isNaN(longest) ? '–' : formatDuration(longest), 'lengste anfall'],
  ];

  return `<div class="kpi-grid">${tiles.map(([value, label]) => `
    <div class="kpi">
      <span class="kpi-value">${escapeHtml(value)}</span>
      <span class="kpi-label">${escapeHtml(label)}</span>
    </div>`).join('')}</div>`;
}

function renderMonthlyChart(attacks) {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  const counts = months.map((month) => attacks.filter((a) => {
    const start = new Date(a.start);
    return start.getFullYear() === month.getFullYear()
      && start.getMonth() === month.getMonth();
  }).length);

  const total = counts.reduce((sum, n) => sum + n, 0);
  const spoken = months
    .map((month, i) => (counts[i] > 0 ? `${formatMonthYear(month)}: ${counts[i]}` : null))
    .filter(Boolean)
    .join('. ');

  const svg = barChart({
    values: counts,
    labels: months.map(formatMonthShort),
    ariaLabel: `Anfall per måned, siste 12 måneder. Totalt ${total} anfall. ${spoken}`,
  });

  return `
    <section class="card chart-card">
      <h2>Anfall per måned</h2>
      <p class="chart-sub">Siste 12 måneder · ${total} anfall totalt</p>
      ${svg}
    </section>`;
}

function renderIntensityChart(attacks) {
  const counts = Array.from({ length: 10 }, (_, i) =>
    attacks.filter((a) => a.intensity === i + 1).length);

  const colors = counts.map((_, i) => `var(${intensityInfo(i + 1).cssVar})`);
  const spoken = counts
    .map((count, i) => (count > 0 ? `styrke ${i + 1}: ${count}` : null))
    .filter(Boolean)
    .join('. ');

  const svg = barChart({
    values: counts,
    labels: counts.map((_, i) => String(i + 1)),
    colors,
    ariaLabel: `Fordeling av styrke fra 1 til 10. ${spoken}`,
  });

  return `
    <section class="card chart-card">
      <h2>Fordeling av styrke</h2>
      <p class="chart-sub">Antall anfall per styrkegrad</p>
      ${svg}
    </section>`;
}

function renderStats() {
  const attacks = store.all();
  if (attacks.length === 0) {
    return `
      <div class="empty">
        <h2>Ingen tall ennå</h2>
        <p>Statistikken fylles ut etter hvert som du registrerer anfall.</p>
      </div>`;
  }

  return renderKpis(attacks) + renderMonthlyChart(attacks) + renderIntensityChart(attacks);
}

/* ---------- View: Innstillinger ---------- */

function renderSettings() {
  const count = store.all().length;
  const status = statusMessage
    ? `<p class="status-msg" role="status">${escapeHtml(statusMessage)}</p>`
    : '';
  const backup = backupText
    ? `<textarea class="backup-text" readonly aria-label="Sikkerhetskopi som tekst">${escapeHtml(backupText)}</textarea>`
    : '';

  return `
    <h2 class="section-heading">Sikkerhetskopi</h2>
    <div class="stack">
      <button type="button" class="btn primary" data-action="share-backup">Lagre eller del sikkerhetskopi</button>
      <button type="button" class="btn" data-action="import">Gjenopprett fra fil</button>
      <button type="button" class="btn ghost" data-action="show-backup">Vis som tekst</button>
    </div>
    ${status}
    ${backup}
    <p class="note-text">Loggen ligger kun på denne enheten. Tar du en sikkerhetskopi nå og da, mister du ikke dataene hvis du bytter telefon eller sletter nettleserdata.</p>

    <h2 class="section-heading">Data</h2>
    <button type="button" class="btn danger" data-action="clear-all">Slett alle data</button>
    <p class="note-text">${count === 1 ? '1 anfall' : `${count} anfall`} lagret.</p>

    <h2 class="section-heading">Om appen</h2>
    <div class="card">
      <p class="note-text" style="margin-top:0">Migrenelogg 1.0 · Alt lagres lokalt på enheten. Ingen konto, ingen server, ingen sporing.</p>
      <p class="note-text">Appen er et personlig loggverktøy, ikke medisinsk utstyr. Ta kontakt med lege ved endring i anfallsmønsteret.</p>
    </div>`;
}

/* ---------- Rendering ---------- */

function render() {
  titleEl.textContent = VIEW_TITLES[currentView];
  const scrollTop = viewEl.scrollTop;

  if (currentView === 'logg') viewEl.innerHTML = renderLog();
  else if (currentView === 'statistikk') viewEl.innerHTML = renderStats();
  else viewEl.innerHTML = renderSettings();

  viewEl.scrollTop = scrollTop;

  for (const tab of tabButtons) {
    if (tab.dataset.view === currentView) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}

function setView(view) {
  if (currentView === view) return;
  currentView = view;
  statusMessage = '';
  backupText = '';
  viewEl.scrollTop = 0;
  render();
}

/* ---------- Form ---------- */

function updateIntensityDisplay() {
  const value = Number(intensityInput.value);
  const info = intensityInfo(value);
  intensityValue.textContent = String(value);
  intensityLabel.textContent = info.label;
  intensityInput.style.setProperty('--slider-color', `var(${info.cssVar})`);
  intensityValue.style.setProperty('--slider-color', `var(${info.cssVar})`);
}

function updateOngoingState() {
  const isOngoing = ongoingInput.checked;
  endField.hidden = isOngoing;
  endInput.disabled = isOngoing;
  if (isOngoing) endInput.value = '';
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

function openDialog(id = null) {
  editingId = id;
  showError('');
  form.reset();

  if (id) {
    const attack = store.get(id);
    if (!attack) return;
    dialogTitle.textContent = 'Rediger anfall';
    startInput.value = toInputValue(new Date(attack.start));
    ongoingInput.checked = attack.end === null;
    endInput.value = attack.end ? toInputValue(new Date(attack.end)) : '';
    intensityInput.value = String(attack.intensity);
    noteInput.value = attack.note;
    deleteBtn.hidden = false;
  } else {
    dialogTitle.textContent = 'Nytt anfall';
    const now = new Date();
    now.setSeconds(0, 0);
    startInput.value = toInputValue(now);
    ongoingInput.checked = true;
    endInput.value = '';
    intensityInput.value = '5';
    noteInput.value = '';
    deleteBtn.hidden = true;
  }

  updateOngoingState();
  updateIntensityDisplay();
  dialog.showModal();
}

function handleSubmit(event) {
  event.preventDefault();
  showError('');

  const start = fromInputValue(startInput.value);
  if (!start) {
    showError('Fyll inn når anfallet startet.');
    return;
  }

  const isOngoing = ongoingInput.checked;
  let end = null;

  if (!isOngoing) {
    end = fromInputValue(endInput.value);
    if (!end) {
      showError('Fyll inn når anfallet sluttet, eller slå på «Pågår fortsatt».');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      showError('Sluttidspunktet må være etter starttidspunktet.');
      return;
    }
  } else {
    const otherOngoing = store.ongoing();
    if (otherOngoing && otherOngoing.id !== editingId) {
      showError('Du har allerede et anfall som pågår. Avslutt det først.');
      return;
    }
  }

  if (start.getTime() > Date.now() + MINUTE) {
    const proceed = confirm('Starttidspunktet er fram i tid. Vil du lagre likevel?');
    if (!proceed) return;
  }

  const data = {
    start: start.toISOString(),
    end: end ? end.toISOString() : null,
    intensity: Number(intensityInput.value),
    note: noteInput.value,
  };

  try {
    if (editingId) store.update(editingId, data);
    else store.add(data);
  } catch (err) {
    showError(err.message);
    return;
  }

  dialog.close();
  render();
}

function handleDelete() {
  if (!editingId) return;
  if (!confirm('Slette dette anfallet? Handlingen kan ikke angres.')) return;
  store.remove(editingId);
  dialog.close();
  render();
}

/* ---------- Backup actions ---------- */

async function shareBackup() {
  const json = store.exportJSON();
  const filename = `migrenelogg-${new Date().toISOString().slice(0, 10)}.json`;

  try {
    const file = new File([json], filename, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Migrenelogg sikkerhetskopi' });
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    // Fall through to the download link below.
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function showBackup() {
  backupText = store.exportJSON();
  try {
    await navigator.clipboard.writeText(backupText);
    statusMessage = 'Kopiert til utklippstavlen.';
  } catch {
    statusMessage = 'Merk teksten under og kopier den manuelt.';
  }
  render();
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = store.importJSON(String(reader.result));
      statusMessage = `Gjenopprettet: ${result.added} nye, ${result.replaced} oppdatert. Totalt ${result.total} anfall.`;
    } catch (err) {
      statusMessage = `Import mislyktes: ${err.message}`;
    }
    render();
  };
  reader.onerror = () => {
    statusMessage = 'Klarte ikke å lese filen.';
    render();
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!confirm('Slette hele loggen? Alle registrerte anfall forsvinner.')) return;
  if (!confirm('Er du helt sikker? Dette kan ikke angres.')) return;
  store.clearAll();
  statusMessage = 'Alle data er slettet.';
  backupText = '';
  render();
}

/* ---------- Events ---------- */

const ACTIONS = {
  new: () => openDialog(null),
  edit: (el) => openDialog(el.dataset.id),
  'end-now': (el) => {
    const attack = store.get(el.dataset.id);
    if (!attack) return;
    const now = new Date();
    now.setSeconds(0, 0);
    if (now.getTime() <= new Date(attack.start).getTime()) {
      // Attack started less than a minute ago - end it one minute later.
      now.setTime(new Date(attack.start).getTime() + MINUTE);
    }
    store.update(attack.id, { ...attack, end: now.toISOString() });
    render();
  },
  cancel: () => dialog.close(),
  'share-backup': shareBackup,
  'show-backup': showBackup,
  import: () => importInput.click(),
  'clear-all': clearAll,
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = ACTIONS[target.dataset.action];
  if (action) action(target);
});

for (const tab of tabButtons) {
  tab.addEventListener('click', () => setView(tab.dataset.view));
}

form.addEventListener('submit', handleSubmit);
deleteBtn.addEventListener('click', handleDelete);
ongoingInput.addEventListener('change', updateOngoingState);
intensityInput.addEventListener('input', updateIntensityDisplay);

importInput.addEventListener('change', () => {
  const file = importInput.files?.[0];
  if (file) importFromFile(file);
  importInput.value = '';
});

// Keep the running duration of an ongoing attack fresh without re-rendering
// the whole list (which would drop the scroll position).
function tickOngoing() {
  if (currentView !== 'logg') return;
  const timeEl = document.getElementById('ongoing-time');
  const attack = store.ongoing();
  if (!timeEl || !attack) return;
  timeEl.textContent = formatDurationLive(durationOf(attack));
}

setInterval(tickOngoing, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tickOngoing();
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker ble ikke registrert.', err);
    });
  });
}
