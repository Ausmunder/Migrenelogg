// Persistence layer. All data lives in localStorage on the device - no server.

const STORAGE_KEY = 'migrenelogg.v1';
const SCHEMA_VERSION = 1;

const listeners = new Set();

/** Cached in memory so rendering never has to re-parse the whole log. */
let attacks = null;

function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function isValidTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

/**
 * Drop anything that is not a usable record. A corrupted entry should cost
 * one attack, not the whole log.
 */
function sanitize(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (!isValidTimestamp(entry.start)) return null;

  const start = new Date(entry.start);
  let end = isValidTimestamp(entry.end) ? new Date(entry.end) : null;
  if (end && end.getTime() <= start.getTime()) end = null;

  const intensity = Math.min(10, Math.max(1, Math.round(Number(entry.intensity)) || 5));

  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : newId(),
    start: start.toISOString(),
    end: end ? end.toISOString() : null,
    intensity,
    note: typeof entry.note === 'string' ? entry.note.slice(0, 2000) : '',
    createdAt: isValidTimestamp(entry.createdAt) ? entry.createdAt : start.toISOString(),
    updatedAt: isValidTimestamp(entry.updatedAt) ? entry.updatedAt : start.toISOString(),
  };
}

function read() {
  if (attacks) return attacks;
  attacks = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed?.attacks;
      if (Array.isArray(list)) {
        attacks = list.map(sanitize).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn('Kunne ikke lese lagret logg, starter tom.', err);
    attacks = [];
  }
  return attacks;
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      attacks,
    }));
  } catch (err) {
    console.error('Kunne ikke lagre.', err);
    throw new Error('Klarte ikke å lagre. Enheten kan være tom for lagringsplass.');
  }
  listeners.forEach((fn) => fn());
}

/** Newest first. */
export function all() {
  return read()
    .slice()
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}

export function get(id) {
  return read().find((a) => a.id === id) ?? null;
}

/** The single attack without an end time, if any. */
export function ongoing() {
  return all().find((a) => a.end === null) ?? null;
}

export function add({ start, end, intensity, note }) {
  const now = new Date().toISOString();
  const entry = sanitize({ start, end, intensity, note, createdAt: now, updatedAt: now });
  if (!entry) throw new Error('Ugyldig starttidspunkt.');
  read().push(entry);
  write();
  return entry;
}

export function update(id, { start, end, intensity, note }) {
  const list = read();
  const index = list.findIndex((a) => a.id === id);
  if (index === -1) throw new Error('Fant ikke anfallet.');

  const entry = sanitize({
    id,
    start,
    end,
    intensity,
    note,
    createdAt: list[index].createdAt,
    updatedAt: new Date().toISOString(),
  });
  if (!entry) throw new Error('Ugyldig starttidspunkt.');

  list[index] = entry;
  write();
  return entry;
}

export function remove(id) {
  const list = read();
  const index = list.findIndex((a) => a.id === id);
  if (index === -1) return;
  list.splice(index, 1);
  write();
}

export function clearAll() {
  attacks = [];
  write();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- Backup ---------- */

export function exportJSON() {
  return JSON.stringify({
    app: 'Migrenelogg',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    attacks: all(),
  }, null, 2);
}

/**
 * Merge a backup into the current log. Entries with a known id replace the
 * local one; unknown ids are added. Returns a count summary.
 */
export function importJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Filen er ikke gyldig JSON.');
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.attacks;
  if (!Array.isArray(list)) throw new Error('Fant ingen anfall i filen.');

  const incoming = list.map(sanitize).filter(Boolean);
  if (incoming.length === 0) throw new Error('Fant ingen gyldige anfall i filen.');

  const current = read();
  const byId = new Map(current.map((a) => [a.id, a]));
  let added = 0;
  let replaced = 0;

  for (const entry of incoming) {
    if (byId.has(entry.id)) replaced++;
    else added++;
    byId.set(entry.id, entry);
  }

  attacks = [...byId.values()];
  write();
  return { added, replaced, total: attacks.length };
}
