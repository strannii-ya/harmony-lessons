/** Educational illustrations. Their lesson-specific data is loaded after authentication. */
import { CLEF_PATHS } from './notation-glyphs.js';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const ALLOWED = new Set(['flow', 'motion', 'compare', 'layers', 'branch', 'pivot', 'enharmonic', 'sequence', 'form']);
const FONT_SIZES = {
  'vis-main': 24, 'vis-main-small': 18, 'vis-heading': 17, 'vis-heading-small': 16,
  'vis-tiny-heading': 14, 'vis-detail': 13, 'vis-detail-mini': 15, 'vis-chord': 22,
  'vis-row': 13, 'vis-row-small': 13, 'vis-cell-text': 16, 'vis-cell-text-small': 14
};
const t = (x, y, value, cls = 'vis-label', anchor = 'middle', maxWidth = 0) => {
  const text = String(value ?? '');
  // A compact layout may need a restrained width adjustment; full labels stay in the data.
  const fit = maxWidth > 0 && [...text].length * (FONT_SIZES[cls] || 16) * .56 > maxWidth;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}"${fit ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : ''}>${escapeHTML(text)}</text>`;
};
const r = (x, y, width, height, cls = 'vis-block') =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9" class="${cls}"/>`;
const ln = (x1, y1, x2, y2, cls = 'vis-connector') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
function arrow(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy) || 1;
  const ux = dx / length, uy = dy / length, hx = x2 - 8 * ux, hy = y2 - 8 * uy;
  return ln(x1, y1, hx, hy, 'vis-arrow') +
    `<path d="M ${hx - 4 * uy} ${hy + 4 * ux} L ${x2} ${y2} L ${hx + 4 * uy} ${hy - 4 * ux}" class="vis-arrow-tip"/>`;
}

function flow(spec, width, small) {
  const nodes = (spec.nodes || []).slice(0, 7), count = nodes.length;
  if (!count) return '';
  const margin = small ? 8 : 18, gap = small ? 13 : 22;
  const box = (width - margin * 2 - (count - 1) * gap) / count;
  const y = small ? 23 : 43, height = small ? 49 : 86;
  return nodes.map((node, i) => {
    const x = margin + i * (box + gap), center = x + box / 2;
    const label = typeof node === 'string' ? node : (small ? node.miniLabel || node.label : node.label);
    const detail = typeof node === 'string' ? '' : node.detail;
    return r(x, y, box, height, i === count - 1 ? 'vis-block vis-block-final' : 'vis-block') +
      t(center, y + (small ? 30 : 38), label, small ? 'vis-main-small' : 'vis-main', 'middle', box - 6) +
      (!small && detail ? t(center, y + 62, detail, 'vis-detail', 'middle', box - 8) : '') +
      (i < count - 1 ? arrow(x + box + 3, y + height / 2, x + box + gap - 3, y + height / 2) : '');
  }).join('');
}

const letters = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
function pitchPosition(pitch, bottom, spacing) {
  const match = /^([A-G])([#b♯♭]?)([0-8])$/.exec(String(pitch || ''));
  if (!match) return null;
  const degree = Number(match[3]) * 7 + letters[match[1]];
  return { y: bottom - (degree - 30) * spacing / 2, accidental: match[2].replace('b', '♭').replace('#', '♯') };
}
function motion(spec, width, small) {
  const labels = (spec.labels || []).slice(0, 5), stages = labels.length;
  if (stages < 2) return '';
  const top = small ? 30 : 56, spacing = small ? 10 : 14, bottom = top + spacing * 4;
  const xPosition = i => 55 + (width - 110) * i / (stages - 1);
  let result = Array.from({length: 5}, (_, i) => ln(22, top + spacing * i, width - 22, top + spacing * i, 'vis-staff')).join('');
  result += `<path d="${CLEF_PATHS.treble}" transform="${small ? 'translate(14 67) scale(.025 -.025)' : 'translate(12 108) scale(.035 -.035)'}" class="vis-clef"/>`;
  const lines = Array.isArray(spec.lines) && spec.lines.length ? spec.lines.slice(0, 3) : [{notes:spec.notes || []}];
  lines.forEach((line, lineIndex) => {
    const points = (line.notes || []).slice(0, stages).map((note, i) => ({x:xPosition(i), ...pitchPosition(note, bottom, spacing)}));
    if (points.length !== stages || points.some(p => !Number.isFinite(p.y))) return;
    const cls = lineIndex === 0 ? 'vis-note-main' : 'vis-note-secondary';
    points.forEach((point, i) => {
      if (i) result += arrow(points[i - 1].x + 13, points[i - 1].y, point.x - 14, point.y);
      if (point.y > bottom + 2) result += ln(point.x - 14, bottom + spacing, point.x + 14, bottom + spacing, 'vis-staff');
      if (point.y < top - 2) result += ln(point.x - 14, top - spacing, point.x + 14, top - spacing, 'vis-staff');
      result += `<ellipse cx="${point.x}" cy="${point.y}" rx="${small ? 8 : 11}" ry="${small ? 5.5 : 7}" transform="rotate(-17 ${point.x} ${point.y})" class="${cls}"/>`;
      if (point.accidental) result += t(point.x - (small ? 17 : 22), point.y + 5, point.accidental, 'vis-accidental');
    });
  });
  labels.forEach((label, i) => {
    result += t(xPosition(i), small ? 17 : 36, small ? (spec.miniLabels?.[i] || label) : label, small ? 'vis-tiny-heading' : 'vis-heading', 'middle', (width - 110) / (stages - 1) - 8);
    if (!small && spec.degrees?.[i]) result += t(xPosition(i), 166, spec.degrees[i], 'vis-degree');
  });
  if (!small && lines.length > 1) {
    lines.forEach((line, i) => { if (line.label) result += t(30 + i * 320, 193, (i ? '● ' : '● ') + line.label, i ? 'vis-secondary-key' : 'vis-primary-key', 'start'); });
  }
  return result;
}

function compare(spec, width, small) {
  const panels = (spec.panels || []).slice(0, 4), count = panels.length;
  if (!count) return '';
  const margin = small ? 6 : 16, gap = small ? 7 : 14, w = (width - margin * 2 - (count - 1) * gap) / count;
  const y = small ? 16 : 34, h = small ? 68 : 120;
  return panels.map((panel, i) => {
    const x = margin + i * (w + gap), middle = x + w / 2;
    return r(x, y, w, h, i % 2 ? 'vis-block vis-block-alt' : 'vis-block') +
      t(middle, y + (small ? 27 : 31), small ? panel.miniLabel || panel.label || '' : panel.label || '', small ? 'vis-main-small' : 'vis-main', 'middle', w - 10) +
      (panel.notes ? t(middle, y + (small ? 51 : 72), small ? panel.miniNotes || panel.notes : panel.notes, small ? 'vis-detail-mini' : 'vis-chord', 'middle', w - 10) : '') +
      (!small && panel.detail ? t(middle, y + 102, panel.detail, 'vis-detail', 'middle', w - 12) : '');
  }).join('');
}

function layers(spec, width, small) {
  const rows = (spec.rows || []).slice(0, 4);
  if (!rows.length) return '';
  const left = small ? 72 : 139, gap = small ? 4 : 8, y0 = small ? 11 : 27;
  const rowHeight = small ? 19 : 32, rowGap = small ? 8 : 12;
  const cellWidth = Math.max(...rows.map(row => row.cells?.length || 0), 1);
  const w = (width - left - 17 - (cellWidth - 1) * gap) / cellWidth;
  return rows.map((row, i) => {
    const y = y0 + i * (rowHeight + rowGap);
    let result = t(left - 11, y + rowHeight / 2 + 4, small ? row.miniLabel || row.label : row.label, small ? 'vis-row-small' : 'vis-row', 'end', left - 16);
    (row.cells || []).slice(0, cellWidth).forEach((cell, j) => {
      const x = left + j * (w + gap);
      const selected = row.emphasis?.includes(j);
      result += r(x, y, w, rowHeight, selected ? 'vis-cell vis-cell-accent' : 'vis-cell') +
        t(x + w / 2, y + rowHeight / 2 + (small ? 4 : 5), small ? row.miniCells?.[j] || cell : cell, small ? 'vis-cell-text-small' : 'vis-cell-text', 'middle', w - 7);
    });
    return result;
  }).join('');
}

function branch(spec, width, small) {
  const prefix = (spec.start || []).slice(0, 4).join('  →  ');
  const paths = (spec.paths || []).slice(0, 2);
  if (paths.length !== 2) return '';
  const y = small ? 16 : 27, startY = small ? 44 : 67, bottomY = small ? 55 : 93;
  const gutter = small ? 4 : 16, boxW = (width - 3 * gutter) / 2;
  let result = t(width / 2, y + 5, small ? spec.miniStart || prefix : prefix, small ? 'vis-main-small' : 'vis-main', 'middle', width - 20);
  result += ln(width / 2, startY, width / 2, startY + 10, 'vis-connector');
  return result + paths.map((path, i) => {
    const x = gutter + i * (boxW + gutter);
    return arrow(width / 2, startY + 10, x + boxW / 2, bottomY - 3) +
      r(x, bottomY, boxW, small ? 39 : 78, i ? 'vis-block vis-block-alt' : 'vis-block') +
      t(x + boxW / 2, bottomY + (small ? 25 : 28), small ? path.miniLabel || path.label : path.label, small ? 'vis-main-small' : 'vis-heading', 'middle', boxW - 9) +
      (!small ? t(x + boxW / 2, bottomY + 56, path.detail || '', 'vis-detail', 'middle', boxW - 16) : '');
  }).join('');
}

function pivot(spec, width, small) {
  const boxW = small ? 116 : 190, center = width / 2;
  const y = small ? 24 : 47, h = small ? 58 : 92;
  return r(center - boxW / 2, y, boxW, h, 'vis-block vis-block-alt') +
    t(center, y + (small ? 22 : 30), small ? spec.miniChord || spec.chord || '' : spec.chord || '', small ? 'vis-main-small' : 'vis-main', 'middle', boxW - 9) +
    t(center, y + (small ? 44 : 60), spec.equivalence || '', small ? 'vis-detail-mini' : 'vis-heading', 'middle', boxW - 9) +
    t(center - boxW / 2 - 9, y + 28, spec.before || '', small ? 'vis-detail-mini' : 'vis-heading', 'end') +
    t(center + boxW / 2 + 9, y + 28, spec.after || '', small ? 'vis-detail-mini' : 'vis-heading', 'start') +
    (!small ? t(center, 178, spec.continuation || '', 'vis-detail') : '');
}

function enharmonic(spec, width, small) {
  if (small) {
    return t(width / 2, 43, spec.sameKey || 'A♭ = G♯', 'vis-enharmonic') +
      t(width / 2, 75, spec.change || 'vii°7 ⇢ vii°65', 'vis-detail-mini');
  }
  const panels = [spec.first, spec.second];
  return panels.map((panel, i) => {
    const x = 16 + i * (width / 2), w = width / 2 - 24;
    return r(x, 26, w, 105, i ? 'vis-block vis-block-alt' : 'vis-block') +
      t(x + w / 2, 55, panel.label, 'vis-heading') +
      t(x + w / 2, 86, panel.notes, 'vis-chord') +
      t(x + w / 2, 112, panel.resolution, 'vis-detail');
  }).join('') + t(width / 2, 171, spec.sameKey || 'A♭ = G♯', 'vis-enharmonic');
}

function sequence(spec, width, small) {
  const blocks = (spec.blocks || []).slice(0, 3), margin = small ? 8 : 20, gap = small ? 23 : 50;
  const w = (width - 2 * margin - (blocks.length - 1) * gap) / blocks.length;
  return blocks.map((block, i) => {
    const x = margin + (w + gap) * i, y = small ? 22 : 41, h = small ? 59 : 104;
    return r(x, y, w, h, i ? 'vis-block vis-block-alt' : 'vis-block') +
      t(x + w / 2, y + (small ? 23 : 32), block.label, small ? 'vis-heading-small' : 'vis-heading', 'middle', w - 10) +
      t(x + w / 2, y + (small ? 45 : 70), small ? block.miniPattern || block.pattern : block.pattern, small ? 'vis-detail-mini' : 'vis-chord', 'middle', w - 10) +
      (i < blocks.length - 1 ? arrow(x + w + 4, y + h / 2, x + w + gap - 5, y + h / 2) : '');
  }).join('');
}

const DRAW = {flow, motion, compare, layers, branch, pivot, enharmonic, sequence, form: layers};

export function visualHTML(spec, {compact = false} = {}) {
  if (!spec || !ALLOWED.has(spec.kind)) return '';
  const width = compact ? 296 : 668;
  let drawing = '';
  try { drawing = DRAW[spec.kind](spec, width, compact); } catch { return ''; }
  if (!drawing) return '';
  const label = [spec.title, spec.caption].filter(Boolean).join('. ');
  const tag = compact ? 'span' : 'figure';
  return `<${tag} class="lesson-visual ${compact ? 'lesson-visual--mini' : 'lesson-visual--full'} lesson-visual--${spec.kind}">` +
    (!compact && spec.title ? `<div class="lesson-visual-title">${escapeHTML(spec.title)}</div>` : '') +
    `<svg viewBox="0 0 ${width} ${compact ? 104 : 202}" role="img" aria-label="${escapeHTML(label || 'Музыкальная схема')}">${drawing}</svg>` +
    (!compact && spec.caption ? `<figcaption>${escapeHTML(spec.caption)}</figcaption>` : '') + `</${tag}>`;
}
