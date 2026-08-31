// Hand-drawn inline SVG bar charts. No chart library, so nothing to load
// over the network - the app has to work offline.

const VIEW_W = 320;
const VIEW_H = 170;
const PAD_X = 4;
const TOP = 18;      // room for the value labels above each bar
const BASELINE = 148;
const LABEL_Y = 163;

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {object} options
 * @param {number[]} options.values      one bar per entry
 * @param {string[]} options.labels      x-axis label per bar
 * @param {string} options.ariaLabel     spoken summary of the whole chart
 * @param {(string|null)[]} [options.colors]  CSS color per bar, null = accent
 * @param {(n: number) => string} [options.format]  bar value label
 * @returns {string} SVG markup
 */
export function barChart({ values, labels, ariaLabel, colors, format }) {
  const n = values.length;
  if (n === 0) return '';

  const max = Math.max(...values, 0);
  const slot = (VIEW_W - PAD_X * 2) / n;
  const barW = Math.min(28, slot * 0.62);
  const usableH = BASELINE - TOP;
  const fmt = format ?? ((v) => String(v));

  const parts = [];

  for (let i = 0; i < n; i++) {
    const value = values[i];
    const cx = PAD_X + slot * i + slot / 2;
    const x = round(cx - barW / 2);

    let h = max > 0 ? (value / max) * usableH : 0;
    if (value > 0 && h < 3) h = 3;   // keep small non-zero values visible
    const y = round(BASELINE - h);

    if (h > 0) {
      // Inline style, not a fill attribute: the .chart-bar class rule would
      // otherwise win over a presentation attribute.
      const fill = colors?.[i] ? ` style="fill: ${escapeText(colors[i])}"` : '';
      parts.push(
        `<rect class="chart-bar" x="${x}" y="${y}" width="${round(barW)}" ` +
        `height="${round(h)}" rx="3"${fill}/>`
      );
      parts.push(
        `<text class="chart-value" x="${round(cx)}" y="${round(y - 4)}" ` +
        `text-anchor="middle">${escapeText(fmt(value))}</text>`
      );
    }

    parts.push(
      `<text class="chart-tick" x="${round(cx)}" y="${LABEL_Y}" ` +
      `text-anchor="middle">${escapeText(labels[i])}</text>`
    );
  }

  parts.push(
    `<line class="chart-grid" x1="${PAD_X}" y1="${BASELINE + 0.5}" ` +
    `x2="${VIEW_W - PAD_X}" y2="${BASELINE + 0.5}"/>`
  );

  return (
    `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" ` +
    `aria-label="${escapeText(ariaLabel)}">${parts.join('')}</svg>`
  );
}
