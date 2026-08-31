// Norwegian date, time and duration formatting.

const LOCALE = 'nb-NO';

const fmtDayShort = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short', day: 'numeric', month: 'short',
});
const fmtDayFull = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const fmtTime = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit', minute: '2-digit',
});
const fmtMonthYear = new Intl.DateTimeFormat(LOCALE, {
  month: 'long', year: 'numeric',
});
const fmtMonthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short' });

export const MINUTE = 60000;
export const HOUR = 3600000;
export const DAY = 86400000;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Date -> "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
export function toInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(), '-', pad2(date.getMonth() + 1), '-', pad2(date.getDate()),
    'T', pad2(date.getHours()), ':', pad2(date.getMinutes()),
  ].join('');
}

/** "YYYY-MM-DDTHH:mm" -> Date in local time, or null. */
export function fromInputValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDayShort(date) {
  return capitalize(fmtDayShort.format(date));
}

export function formatDayFull(date) {
  return capitalize(fmtDayFull.format(date));
}

export function formatTimeOfDay(date) {
  return fmtTime.format(date);
}

export function formatMonthYear(date) {
  return capitalize(fmtMonthYear.format(date));
}

export function formatMonthShort(date) {
  return fmtMonthShort.format(date).replace('.', '');
}

/** Stable sort/group key for a month, e.g. "2026-08". */
export function monthKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
}

/**
 * Milliseconds -> "3 t 30 min". Days are used above 24 hours so long
 * attacks stay readable.
 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const totalMinutes = Math.floor(ms / MINUTE);
  if (totalMinutes < 1) return 'under 1 min';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days} d ${hours} t` : `${days} d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} t ${minutes} min` : `${hours} t`;
  }
  return `${minutes} min`;
}

/** Running duration for an ongoing attack: "2:14:07" style is too busy - keep words. */
export function formatDurationLive(ms) {
  const totalMinutes = Math.floor(ms / MINUTE);
  if (totalMinutes < 1) return 'nettopp startet';
  return formatDuration(ms);
}

const INTENSITY_LEVELS = [
  { max: 3, label: 'mild', cssVar: '--i-mild' },
  { max: 6, label: 'moderat', cssVar: '--i-moderat' },
  { max: 8, label: 'kraftig', cssVar: '--i-kraftig' },
  { max: 10, label: 'svært kraftig', cssVar: '--i-svaert' },
];

/** Intensity 1-10 -> { label, cssVar } used for badges, sliders and charts. */
export function intensityInfo(value) {
  const n = Math.min(10, Math.max(1, Math.round(Number(value) || 1)));
  return INTENSITY_LEVELS.find((level) => n <= level.max) ?? INTENSITY_LEVELS[0];
}

/** 5.25 -> "5,3" (Norwegian decimal comma). */
export function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
