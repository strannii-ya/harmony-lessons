/** Contextual music examples. Music and captions are supplied by private lesson data. */
import { VF } from './vexflow.js';
import { parsePitch } from './theory-visual-model.js';

const NS = 'http://www.w3.org/2000/svg';
const COLORS = {
  ink: '#302b26', staff: '#938577', muted: '#655d52', accent: '#a95a32',
  surface: '#fcf9f3', border: '#e6dbce',
};

function svgNode(tag, attrs = {}, value) {
  const element = document.createElementNS(NS, tag);
  for (const [key, val] of Object.entries(attrs)) element.setAttribute(key, String(val));
  if (value !== undefined) element.textContent = String(value);
  return element;
}

function label(svg, x, y, value, options = {}) {
  svg.append(svgNode('text', {
    x, y, 'text-anchor': options.anchor || 'middle',
    'font-family': options.serif ? 'Georgia, serif' : 'Arial, sans-serif',
    'font-size': options.size || 16, 'font-weight': options.bold ? 650 : 450,
    fill: options.color || COLORS.ink,
  }, value));
}

function staff(ctx, x, y, width, clef) {
  const s = new VF.Stave(x, y, width).addClef(clef);
  s.setBegBarType(VF.Barline.type.NONE);
  s.setEndBarType(VF.Barline.type.NONE);
  s.setStyle({strokeStyle: COLORS.staff, fillStyle: COLORS.ink, lineWidth: 1.05});
  s.setDefaultLedgerLineStyle({strokeStyle: COLORS.staff, lineWidth: 1.15});
  s.setContext(ctx);
  return s;
}

function chord(pitches, clef, highlight = []) {
  const values = pitches.map(pitch => parsePitch(pitch));
  if (values.some(value => !value)) throw new Error('Неизвестная высота в нотном примере');
  const note = new VF.StaveNote({
    clef, keys: values.map(value => value.key), duration: 'q', auto_stem: true,
  });
  values.forEach((value, index) => {
    if (value.accidental) note.addModifier(new VF.Accidental(value.accidental), index);
    if (highlight.includes(pitches[index])) {
      note.setKeyStyle(index, {fillStyle: COLORS.accent, strokeStyle: COLORS.accent});
    }
  });
  return note;
}

function baseSvg(root, width, height, title) {
  root.replaceChildren();
  const renderer = new VF.Renderer(root, VF.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  ctx.setFillStyle(COLORS.ink);
  ctx.setStrokeStyle(COLORS.ink);
  const svg = root.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.removeAttribute('height');
  svg.removeAttribute('width');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  svg.setAttribute('data-renderer', 'vexflow-bravura');
  svg.prepend(svgNode('rect', {
    x: 1, y: 1, width: width - 2, height: height - 2, rx: 12,
    fill: COLORS.surface, stroke: COLORS.border, 'stroke-width': 1.3,
  }));
  svg.prepend(svgNode('title', {}, title));
  return {ctx, svg};
}

function drawSystem(ctx, svg, system, y, width, compact, mode, offsetX = 0) {
  const n = system.upper.length;
  if (!n || n > 8 || system.functions.length !== n ||
      (mode === 'grand' && system.bass.length !== n)) {
    throw new Error('Неполная или слишком длинная нотная система');
  }
  const left = offsetX + (compact ? 9 : 41);
  const staveWidth = width - (compact ? 18 : 82);
  const treble = staff(ctx, left, y + (compact ? 58 : 68), staveWidth, 'treble');
  const upper = system.upper.map((pitches, i) => chord(pitches, 'treble', system.highlight?.[i] || []));
  upper.forEach(note => note.setStave(treble));
  const voices = [new VF.Voice({num_beats: n, beat_value: 4}).addTickables(upper)];
  let bassStaff, bassNotes;
  if (mode === 'grand') {
    bassStaff = staff(ctx, left, y + (compact ? 158 : 185), staveWidth, 'bass');
    bassNotes = system.bass.map(pitch => chord([pitch], 'bass'));
    bassNotes.forEach(note => note.setStave(bassStaff));
    voices.push(new VF.Voice({num_beats: n, beat_value: 4}).addTickables(bassNotes));
  }
  const available = treble.getNoteEndX() - treble.getNoteStartX() - (compact ? 5 : 22);
  const formatter = new VF.Formatter();
  voices.forEach(voice => formatter.joinVoices([voice]));
  formatter.format(voices, Math.max(24, available));
  treble.draw();
  bassStaff?.draw();
  voices.forEach((voice, index) => voice.draw(ctx, index ? bassStaff : treble));
  upper.forEach((note, index) => label(svg, note.getAbsoluteX(), y + (compact ? 41 : 54),
    system.functions[index], {
      size: compact ? 12.8 : 17.5, bold: true, serif: true,
      color: system.functionColor?.[index] || COLORS.ink,
    }));
  if (system.heading && !compact) label(svg, offsetX + 43, y + 23, system.heading,
    {anchor: 'start', size: 15.5, bold: true, color: COLORS.muted});

  if (mode === 'grand' && system.pedal && system.bass.every(pitch => pitch === system.bass[0])) {
    for (let i = 1; i < n; i++) {
      new VF.StaveTie({
        first_note: bassNotes[i - 1], last_note: bassNotes[i],
        first_indices: [0], last_indices: [0],
      }).setContext(ctx).draw();
    }
  }
}

/** A compact preview uses a purpose-written excerpt, never shrinks a full multi-system score. */
export function drawContextualScore(root, spec, {compact = false} = {}) {
  const systems = compact ? (spec.mini || [spec.systems[0]]) : spec.systems;
  const mode = compact ? (spec.miniMode || spec.mode || 'treble') : (spec.mode || 'grand');
  if (!Array.isArray(systems) || !systems.length || systems.length > 5) {
    throw new Error('Нет нотного материала');
  }
  const columns = compact ? 1 : (spec.columns === 2 ? 2 : 1);
  const maxStageCount = Math.max(...systems.map(system => system.upper.length));
  const width = compact ? 330 : columns === 2 ? 918 : Math.min(918, Math.max(480, maxStageCount * 118 + 210));
  const columnWidth = columns === 2 ? 452 : width;
  const gap = mode === 'treble' ? (compact ? 171 : 187) : (compact ? 265 : 303);
  const height = Math.ceil(systems.length / columns) * gap + (compact ? 14 : 18);
  const {ctx, svg} = baseSvg(root, width, height, spec.title || 'Нотная иллюстрация');
  systems.forEach((system, index) => {
    drawSystem(ctx, svg, system, (compact ? 10 : 14) + Math.floor(index / columns) * gap,
      columnWidth, compact, mode, (index % columns) * 466);
  });
  return svg;
}
