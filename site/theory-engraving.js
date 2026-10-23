/** VexFlow engraving for authenticated lesson illustrations.
 * All concrete musical examples arrive with the lessons, not in this module.
 */
import { VF } from './vexflow.js';
import { parsePitch, parseAscendingChord, engravingKind } from './theory-visual-model.js';
import { drawContextualScore } from './theory-score.js';

const NS = 'http://www.w3.org/2000/svg';
const INK = '#342d25';
const STAFF = '#8c8275';
const MUTED = '#73695b';
const ACCENT = '#a15b32';
const SECONDARY = '#60755f';

function node(tag, attributes = {}, value) {
  const element = document.createElementNS(NS, tag);
  for (const [key, attribute] of Object.entries(attributes)) element.setAttribute(key, String(attribute));
  if (value !== undefined) element.textContent = String(value);
  return element;
}

function text(svg, x, y, content, options = {}) {
  svg.append(node('text', {
    x, y, 'text-anchor': options.anchor || 'middle',
    'font-family': options.serif ? 'Georgia, serif' : "Inter, 'Segoe UI', Arial, sans-serif",
    'font-size': options.size || 15,
    'font-weight': options.weight || 500,
    fill: options.color || INK,
  }, content));
}

function canvas(root, width, height, accessibleName) {
  root.replaceChildren();
  const renderer = new VF.Renderer(root, VF.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();
  context.setFillStyle(INK);
  context.setStrokeStyle(INK);
  const svg = root.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', accessibleName);
  svg.setAttribute('data-renderer', 'vexflow-bravura');
  svg.prepend(node('title', {}, accessibleName));
  svg.prepend(node('rect', {
    x: 0.7, y: 0.7, width: width - 1.4, height: height - 1.4,
    rx: 10, fill: '#fbf8f2', stroke: '#e4d9c9', 'stroke-width': 1.25,
  }));
  return { context, svg };
}

function note(keys, clef = 'treble', duration = 'q', highlight = []) {
  const pitches = keys.map(pitch => typeof pitch === 'string' ? parsePitch(pitch, clef === 'bass' ? 3 : 4) : pitch);
  if (pitches.some(pitch => !pitch)) throw new Error('Неизвестная нота в иллюстрации');
  const staveNote = new VF.StaveNote({ clef, keys: pitches.map(p => p.key), duration, auto_stem: true });
  pitches.forEach((pitch, index) => {
    if (pitch.accidental) staveNote.addModifier(new VF.Accidental(pitch.accidental), index);
    if (highlight.includes(index)) staveNote.setKeyStyle(index, {fillStyle: ACCENT, strokeStyle: ACCENT});
  });
  return staveNote;
}

function stave(context, x, y, width, clef = 'treble') {
  const s = new VF.Stave(x, y, width).addClef(clef);
  s.setBegBarType(VF.Barline.type.NONE);
  s.setEndBarType(VF.Barline.type.NONE);
  s.setStyle({strokeStyle: STAFF, fillStyle: INK, lineWidth: 1.05});
  s.setDefaultLedgerLineStyle({strokeStyle: STAFF, lineWidth: 1.2});
  s.setContext(context);
  return s;
}

function drawNotes(context, s, notes, options = {}) {
  notes.forEach(n => n.setStave(s));
  const voice = new VF.Voice({num_beats: notes.length, beat_value: 4}).addTickables(notes);
  new VF.Formatter().joinVoices([voice]).format([voice], Math.max(30, s.getNoteEndX() - s.getNoteStartX() - (options.inset ?? 10)));
  s.draw();
  voice.draw(context, s);
  return notes;
}

function noteXY(n, index = 0) {
  const head = n.noteHeads[index];
  return {x: head.getAbsoluteX(), y: head.getY()};
}

/** An elbow-free, short arc in whitespace. Never connect across an accidental. */
function curvedArrow(svg, from, to, side = 'below', compact = false) {
  if (!from || !to || to.x - from.x < 24) return;
  const sign = side === 'above' ? -1 : 1;
  const start = {x: from.x + 8, y: from.y + sign * 16};
  const end = {x: to.x - 8, y: to.y + sign * 17};
  const bulge = sign * (compact ? 11 : 16);
  const middleX = (start.x + end.x) / 2;
  const middleY = (start.y + end.y) / 2 + bulge;
  const color = side === 'above' ? SECONDARY : ACCENT;
  svg.append(node('path', {
    d: `M ${start.x} ${start.y} Q ${middleX} ${middleY * 2 - (start.y + end.y) / 2} ${end.x} ${end.y}`,
    fill: 'none', stroke: color, 'stroke-width': compact ? 1.65 : 1.9, 'stroke-linecap': 'round',
    class: 'theory-voice-arrow',
  }));
  // The tangent near the end points towards the destination, not the modifier at its left.
  const vx = end.x - middleX, vy = end.y - (middleY * 2 - (start.y + end.y) / 2);
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len, uy = vy / len;
  const tip = compact ? 4.3 : 5.2;
  const wing = compact ? 2.6 : 3.0;
  svg.append(node('path', {
    d: `M ${end.x - tip * ux + wing * uy} ${end.y - tip * uy - wing * ux} L ${end.x} ${end.y} L ${end.x - tip * ux - wing * uy} ${end.y - tip * uy + wing * ux}`,
    fill: 'none', stroke: color, 'stroke-width': compact ? 1.65 : 1.9,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
}

function compactLabels(svg, notes, labels, y, compact, options = {}) {
  notes.forEach((n, i) => text(svg, noteXY(n).x, y, labels[i] || '', {
    size: compact ? 13.2 : 16, serif: options.serif !== false, weight: 600,
    color: options.color || INK,
  }));
}

function lineMotion(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 184 : 224;
  const {context, svg} = canvas(root, width, height, spec.title || 'Движение голосов');
  const lines = spec.lines?.length ? spec.lines : [{ notes: spec.notes || [] }];
  const stageCount = spec.labels?.length || lines[0].notes.length;
  const stageNotes = Array.from({length: stageCount}, (_, i) =>
    lines.map(line => parsePitch(line.notes[i])).filter(Boolean));
  if (stageNotes.some(notes => notes.length !== lines.length)) throw new Error('Неполный музыкальный пример');
  const indices = stageNotes.map(pitches => pitches.map((p, i) => ({pitch:p, line:i}))
    .sort((a, b) => a.pitch.diatonic - b.pitch.diatonic));
  const notes = indices.map(keys => note(keys.map(item => item.pitch), 'treble', 'q', keys.map((_, i) => i)));
  // Compact horizontal spacing also shortens the voice-leading arrows.
  const staffWidth = compact ? width - 20 : Math.min(width - 56, stageCount * 116 + 80);
  const s = stave(context, compact ? 10 : (width - staffWidth) / 2, compact ? 38 : 47, staffWidth);
  drawNotes(context, s, notes);
  const labels = spec.miniLabels && compact ? spec.miniLabels : spec.labels;
  compactLabels(svg, notes, labels || [], compact ? 27 : 32, compact);
  const hasTwo = lines.length > 1;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    for (let i = 1; i < notes.length; i++) {
      const previousHeadIndex = indices[i - 1].findIndex(item => item.line === lineIndex);
      const nextHeadIndex = indices[i].findIndex(item => item.line === lineIndex);
      curvedArrow(svg, noteXY(notes[i - 1], previousHeadIndex), noteXY(notes[i], nextHeadIndex),
        hasTwo && lineIndex === 1 ? 'above' : 'below', compact);
    }
  }
  const legendY = compact ? 171 : 210;
  if (hasTwo) {
    lines.forEach((line, i) => {
      if (line.label) text(svg, width * (i ? .73 : .27), legendY,
        (i ? '● ' : '● ') + line.label,
        {size: compact ? 10.3 : 13.3, color: i ? SECONDARY : ACCENT, weight: 550});
    });
  } else if (spec.degrees?.length) {
    compactLabels(svg, notes, spec.degrees, legendY, compact, {color: MUTED});
  }
}

function chordCompare(root, panels, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 181 : 206;
  const {context, svg} = canvas(root, width, height, spec.title || 'Сравнение аккордов');
  const chords = panels.map(panel => parseAscendingChord(panel.notes));
  if (chords.some(chord => !chord)) throw new Error('Ошибка звукового состава');
  if (compact) {
    const s = stave(context, 12, 39, 272);
    const notes = chords.map(chord => note(chord, 'treble', 'q', chord.map((p, i) => p.accidental ? i : -1)));
    drawNotes(context, s, notes, {inset: 16});
    compactLabels(svg, notes, panels.map(panel => panel.miniLabel || panel.label), 28, true);
    // The full-size diagram explains the chord quality in words. Those long
    // descriptions collided in the thumbnail; here labels and actual notes
    // are readable without squeezing or overlapping glyphs.
  } else {
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i], x = 20 + i * 332;
      text(svg, x + 149, 34, p.label, {size: 19, serif: true, weight: 600});
      const s = stave(context, x + 59, 56, 228);
      drawNotes(context, s, [note(chords[i], 'treble', 'q', chords[i].flatMap((p, j) => p.accidental ? [j] : []))]);
      text(svg, x + 149, 180, p.detail || '', {size: 14, color: MUTED});
    }
    svg.append(node('line', {x1:334, y1:41, x2:334, y2:191, stroke:'#e6dbcb', 'stroke-width':1}));
  }
}

function equalityCompare(root, spec, compact) {
  const panels = spec.panels, width = compact ? 296 : 668, height = compact ? 172 : 213;
  const {context, svg} = canvas(root, width, height, spec.title || 'Ладовое сравнение');
  const pitches = panels.map(p => {
    const found = /([A-G][#♯b♭]?)\s*$/.exec(p.notes || '');
    return found ? parsePitch(found[1]) : null;
  });
  if (pitches.some(p => !p)) throw new Error('Ошибка названия ступени');
  const s = stave(context, compact ? 8 : 25, compact ? 34 : 54, width - (compact ? 16 : 50));
  const notes = pitches.map(p => note([p], 'treble', 'q', p.accidental ? [0] : []));
  drawNotes(context, s, notes, {inset: compact ? 8 : 18});
  compactLabels(svg, notes, panels.map(p => compact ? p.miniLabel || p.label : p.label), compact ? 22 : 38, compact);
  compactLabels(svg, notes, panels.map(p => p.notes.split('=').at(0).trim()), compact ? 161 : 181, compact, {color: MUTED});
}

function patternCompare(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 240 : 285;
  const {context, svg} = canvas(root, width, height, spec.title || 'Сравнение басовых рисунков');
  spec.panels.forEach((panel, index) => {
    const y = (compact ? 16 : 18) + index * (compact ? 111 : 129);
    const tokens = (panel.notes || '').split(/\s*[–—]\s*/).filter(Boolean);
    const pitchNames = tokens.map(p => parsePitch(p, 3));
    if (pitchNames.some(p => !p)) throw new Error('Ошибка басовой ноты');
    text(svg, width / 2, y + 17, compact ? panel.miniLabel || panel.label : panel.label, {size: compact ? 13.4 : 17, weight: 650});
    const s = stave(context, compact ? 11 : 38, y + 21, width - (compact ? 22 : 76), 'bass');
    const notes = drawNotes(context, s, pitchNames.map(p => note([p], 'bass')));
    if (index === 0) {
      for (let i = 1; i < notes.length; i++) {
        new VF.StaveTie({first_note:notes[i - 1], last_note:notes[i], first_indices:[0], last_indices:[0]})
          .setContext(context).draw();
      }
    }
  });
}

function pitchMovementPanels(root, spec, compact) {
  const panels = spec.panels, vertical = compact;
  const width = compact ? 296 : 668;
  // Separate tall staves on narrow cards would crowd arrows into the next
  // label (or clip the last row). Place just the interval pairs on one staff.
  if (compact && panels.length > 1) {
    const {context, svg} = canvas(root, width, 187, spec.title || 'Разрешение вводных тонов');
    const pairs = panels.map(panel => {
      const detailTokens = String(panel.detail || '').split(/\s*→\s*/);
      const source = detailTokens.length === 2 && detailTokens.every(token => parsePitch(token))
        ? panel.detail : panel.notes;
      const tokens = String(source || '').split(/\s*→\s*/);
      if (tokens.length !== 2 || !tokens.every(token => parsePitch(token))) {
        throw new Error('Ошибка разрешения в нотном примере');
      }
      return tokens.map(token => parsePitch(token));
    });
    const s = stave(context, 8, 38, width - 16);
    const notes = drawNotes(context, s, pairs.flatMap(pair => pair.map((pitch, i) => note([pitch], 'treble', 'q', i === 0 ? [0] : []))), {inset: 1});
    for (let index = 0; index < panels.length; index++) {
      const from = noteXY(notes[2 * index]);
      const to = noteXY(notes[2 * index + 1]);
      text(svg, (from.x + to.x) / 2, 25, panels[index].miniLabel || panels[index].label,
        {size: 12.6, weight: 650});
      curvedArrow(svg, from, to, 'below', true);
    }
    return;
  }
  const height = compact ? 22 + panels.length * 103 : 220;
  const {context, svg} = canvas(root, width, height, spec.title || 'Разрешение звуков');
  panels.forEach((panel, index) => {
    const label = compact ? panel.miniLabel || panel.label : panel.label;
    const detailTokens = String(panel.detail || '').split(/\s*→\s*/);
    const source = detailTokens.length === 2 && detailTokens.every(p => parsePitch(p)) ? panel.detail : panel.notes;
    const pitches = String(source).split(/\s*→\s*/).map(p => parsePitch(p.trim(), 4));
    if (pitches.length !== 2 || pitches.some(p => !p)) throw new Error('Ошибка нотного движения');
    const x = vertical ? 8 : 10 + index * (width / panels.length);
    const y = vertical ? index * 103 + 18 : 42;
    const w = vertical ? width - 16 : width / panels.length - 19;
    text(svg, x + w / 2, y + 8, label, {size: compact ? 14 : 16, weight: 650});
    const s = stave(context, x, y + 17, w);
    const notes = drawNotes(context, s, pitches.map((p, i) => note([p], 'treble', 'q', i === 0 ? [0] : [])), {inset: 4});
    curvedArrow(svg, noteXY(notes[0]), noteXY(notes[1]), 'below', compact);
    if (!compact && panel.detail && !/→/.test(panel.detail)) {
      text(svg, x + w / 2, height - 23, panel.detail, {size: 13, color: MUTED});
    }
  });
}

function fifths(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 185 : 230;
  const {context, svg} = canvas(root, width, height, spec.title || 'Движение баса по квинтам');
  // Alternate registers to keep a circle-of-fifths illustration inside the
  // bass staff; the roots and their harmonic functions come from lesson data.
  const roots = spec.nodes.map((item, i) => parsePitch(item.detail, i % 2 ? 2 : 3));
  if (roots.some(root => !root)) throw new Error('Неверная основная нота аккорда');
  const s = stave(context, compact ? 8 : 30, compact ? 47 : 58, width - (compact ? 16 : 60), 'bass');
  const notes = drawNotes(context, s, roots.map(p => note([p], 'bass')));
  compactLabels(svg, notes, spec.nodes.map(n => n.label), compact ? 27 : 38, compact);
  text(svg, width / 2, compact ? 169 : 204, roots.map(p => p.letter).join(' → '),
    {size: compact ? 14 : 17, color: MUTED, serif: true});
}

function bassMotionRows(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 230 : 278;
  const {context, svg} = canvas(root, width, height, spec.title || 'Движение баса');
  spec.rows.slice(0, 2).forEach((row, index) => {
    const y = index * (compact ? 107 : 126) + 20;
    text(svg, width / 2, y + 8, compact ? row.miniLabel || row.label : row.label, {size: compact ? 13 : 16, weight: 600});
    const s = stave(context, compact ? 10 : 36, y + 12, width - (compact ? 20 : 72), 'bass');
    const notes = row.cells.map(c => note([parsePitch(c, 3)], 'bass'));
    drawNotes(context, s, notes);
  });
}

function cadential(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 252 : 290;
  const {context, svg} = canvas(root, width, height, spec.title || 'Кадансовый квартсекстаккорд');
  const harmonies = spec.rows[0].cells;
  const bass = spec.rows[1].cells.map(value => {
    const letter = String(value).trim();
    return parsePitch(letter, /^[C-F]/.test(letter) ? 3 : 2);
  });
  const upper = spec.rows[2].cells.map(value => String(value).split(/[,()+\s]+/)
    .filter(Boolean).map(token => parsePitch(token, token.startsWith('B') ? 3 : 4))
    .sort((a, b) => a.diatonic - b.diatonic));
  if (bass.some(p => !p) || upper.some(chord => chord.some(p => !p))) {
    throw new Error('Не удалось определить голоса K64');
  }
  const upperStaff = stave(context, compact ? 10 : 40, compact ? 35 : 52, width - (compact ? 20 : 80));
  const bassStaff = stave(context, compact ? 10 : 40, compact ? 132 : 154, width - (compact ? 20 : 80), 'bass');
  const highNotes = upper.map((p, i) => note(p, 'treble', 'q', i === 1 ? [0, 2] : []));
  drawNotes(context, upperStaff, highNotes);
  drawNotes(context, bassStaff, bass.map(p => note([p], 'bass')));
  compactLabels(svg, highNotes, harmonies, compact ? 22 : 36, compact);
  if (!compact) text(svg, width / 2, 275,
    `${bass[0].letter} в басу сохраняется при K⁶₄ → V₇`, {size: 14, color: MUTED});
}

function reharmonization(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 216 : 243;
  const {context, svg} = canvas(root, width, height, spec.title || 'Мелодия и гармония');
  const melody = spec.rows[0].cells.map(c => note([parsePitch(c, 4)]));
  const s = stave(context, compact ? 8 : 30, compact ? 32 : 39, width - (compact ? 16 : 60));
  drawNotes(context, s, melody);
  text(svg, 18, 23, 'Мелодия', {size: compact ? 11 : 14, anchor: 'start', color: MUTED});
  spec.rows.slice(1, 3).forEach((row, i) => {
    const y = (compact ? 163 : 179) + i * (compact ? 29 : 30);
    text(svg, compact ? 6 : 20, y, row.miniLabel || row.label,
      {size: compact ? 11.2 : 14, anchor: 'start', color: MUTED});
    row.cells.forEach((cell, j) => text(svg, noteXY(melody[j]).x, y, cell,
      {size: compact ? 13 : 17, serif: true, weight: 600, color: i && row.emphasis?.includes(j) ? ACCENT : INK}));
  });
}

function pivot(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 188 : 214;
  const {context, svg} = canvas(root, width, height, spec.title || 'Общий аккорд');
  const chordName = /\(([^)]+)\)/.exec(spec.chord || '')?.[1] || 'Am';
  const pitches = parseAscendingChord((spec.chord || '').split('(')[0].trim());
  if (!pitches) throw new Error('Ошибка общего аккорда');
  text(svg, width / 2, compact ? 25 : 28, chordName, {size: compact ? 20 : 24, serif: true, weight: 600});
  const s = stave(context, compact ? 11 : 211, compact ? 37 : 44, compact ? 274 : 246);
  drawNotes(context, s, [note(pitches)]);
  text(svg, width / 2, compact ? 163 : 165, spec.equivalence || 'vi = ii', {size: compact ? 18 : 22, serif: true, weight: 600, color: ACCENT});
  if (!compact) {
    text(svg, 95, 97, spec.before || '', {size: 18, weight: 600});
    text(svg, width - 92, 97, spec.after || '', {size: 18, weight: 600});
    text(svg, width / 2, 195, spec.continuation || '', {size: 14, color: MUTED});
  }
}

function enharmonic(root, spec, compact) {
  const width = compact ? 296 : 668, height = compact ? 189 : 219;
  const panels = [spec.first, spec.second];
  const {context, svg} = canvas(root, width, height, spec.title || 'Энгармоническая замена');
  const chords = panels.map(panel => parseAscendingChord(panel.notes));
  if (chords.some(chord => !chord)) throw new Error('Ошибка энгармонического созвучия');
  if (compact) {
    const s = stave(context, 12, 40, 272);
    const notes = drawNotes(context, s, chords.map(chord => note(chord, 'treble', 'q', [3])));
    compactLabels(svg, notes, ['vii°₇', 'vii°₆₅'], 27, true);
    text(svg, width / 2, 170, spec.sameKey || 'A♭ = G♯', {size: 17, color: ACCENT, serif: true, weight: 600});
  } else {
    panels.forEach((panel, i) => {
      const x = 20 + i * 332;
      text(svg, x + 149, 33, panel.label, {size: 16, weight: 600});
      const s = stave(context, x + 59, 51, 228);
      drawNotes(context, s, [note(chords[i], 'treble', 'q', [3])]);
      text(svg, x + 149, 172, panel.resolution || '', {size: 14, color: MUTED});
    });
    text(svg, width / 2, 205, spec.sameKey || 'A♭ = G♯', {size: 18, color: ACCENT, serif: true, weight: 600});
    svg.append(node('line', {x1:334, y1:39, x2:334, y2:183, stroke:'#e6dbcb', 'stroke-width':1}));
  }
}

export function drawTheoryEngraving(root, spec, {compact = false} = {}) {
  switch (engravingKind(spec)) {
    case 'score': return drawContextualScore(root, spec, {compact});
    case 'motion': return lineMotion(root, spec, compact);
    case 'chords': return chordCompare(root, spec.panels, spec, compact);
    case 'equality': return equalityCompare(root, spec, compact);
    case 'patterns': return patternCompare(root, spec, compact);
    case 'movements': return pitchMovementPanels(root, spec, compact);
    case 'fifths': return fifths(root, spec, compact);
    case 'bassRows': return bassMotionRows(root, spec, compact);
    case 'cadential': return cadential(root, spec, compact);
    case 'reharmonization': return reharmonization(root, spec, compact);
    case 'pivot': return pivot(root, spec, compact);
    case 'enharmonic': return enharmonic(root, spec, compact);
    default: throw new Error('Нет нотной схемы для этой иллюстрации');
  }
}

export function mountTheoryVisuals(root = document) {
  for (const target of root.querySelectorAll('[data-theory-engraving]')) {
    try {
      const spec = JSON.parse(target.dataset.theoryEngraving);
      drawTheoryEngraving(target, spec, {compact: target.dataset.compact === 'true'});
    } catch (error) {
      // Do not make the lesson itself unavailable if a drawing fails.
      target.textContent = 'Иллюстрация временно недоступна';
      target.classList.add('vis-engraving-error');
      console.warn('Theory engraving:', error);
    }
  }
}
