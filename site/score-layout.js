import { keyPitches } from './music.js';

export const sameKey = (a, b) => a.tonic === b.tonic && a.mode === b.mode;
export function signature(bar) {
  const notes = keyPitches(bar.tonic, bar.mode).filter(n => n.alter !== 0);
  const order = notes[0]?.alter > 0 ? [3, 0, 4, 1, 5, 2, 6] : [6, 2, 5, 1, 4, 0, 3];
  return notes.sort((a, b) => order.indexOf(a.letter) - order.indexOf(b.letter));
}
export function signatureChange(previous, next) {
  const old = signature(previous), now = keyPitches(next.tonic, next.mode);
  return [...old.filter(n => now.find(v => v.letter === n.letter)?.alter !== n.alter)
    .map(n => ({ ...n, originalAlter: n.alter, alter: 0 })), ...signature(next)];
}
export function staffY(note, bass = false) {
  const bottom = bass ? 2 * 7 + 4 : 4 * 7 + 2;
  return 40 - (note.octave * 7 + note.letter - bottom) * 5;
}
function keyWidth(notes) { return notes.length ? 12 + notes.length * 10 : 0; }
export function headWidth(bar, meter = false) { return 54 + keyWidth(signature(bar)) + (meter ? 22 : 0); }
function barWidth(bar, previous, arpeggio) {
  const keys = previous && !sameKey(previous, bar) ? keyWidth(signatureChange(previous, bar)) + 6 : 0;
  const labels = Math.max(String(bar.symbol).length * 8, bar.name.length * 7);
  const music = arpeggio ? 48 + bar.rh.length * 22 : 94;
  return keys + Math.max(music, labels + 32);
}
/** Full progression, never pages or a single active-chord viewport. */
export function layoutScore(score, width) {
  if (!score?.bars?.length) throw new Error('Пустая последовательность');
  if (!Number.isFinite(width)) throw new Error('Неверная ширина нот');
  width = Math.max(320, Math.round(width));
  const meter = score.bars.every(b => b.beats === 4);
  const rows = []; let row;
  for (const bar of score.bars) {
    let previous = row?.bars.at(-1)?.bar;
    let min = barWidth(bar, previous, score.pattern === 'arpeggio');
    if (!row || row.used + min > width - 16) {
      row = { bars: [], prefix: headWidth(bar, meter), used: 16 + headWidth(bar, meter), meter };
      rows.push(row); previous = null; min = barWidth(bar, null, score.pattern === 'arpeggio');
    }
    row.bars.push({ bar, minimum: min, previous }); row.used += min;
  }
  // A narrow viewport may need a slightly wider SVG, scaled once as a whole.
  width = Math.max(width, ...rows.map(r => r.used + 16));
  let cursor = 12;
  rows.forEach((r, i) => {
    const room = width - 32 - r.prefix;
    const natural = r.bars.reduce((n, b) => n + b.minimum, 0);
    // Last short system isn't stretched into huge empty measures.
    const filled = i < rows.length - 1 || natural / room > .58;
    const ratio = filled ? room / natural : Math.min(room / natural, 1.5);
    let x = 16 + r.prefix;
    r.bars.forEach(b => { b.x = x; b.width = b.minimum * ratio; x += b.width; });
    r.end = x;
    const right = r.bars.flatMap(b => b.bar.rh.flatMap(e => e.notes.map(n => staffY(n))));
    const left = r.bars.flatMap(b => b.bar.left.notes.map(n => staffY(n, true)));
    r.top = cursor;
    r.treble = cursor + Math.max(70, 65 - Math.min(...right));
    r.bass = r.treble + Math.max(96, Math.max(...right) - Math.min(...left) + 54);
    r.bottom = r.bass + Math.max(60, Math.max(...left) + 12);
    cursor = r.bottom + 28;
  });
  return { width, height: cursor - 10, rows, meter };
}
