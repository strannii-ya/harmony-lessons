/** Only generic diagram recognition and pitch parsing. Lesson data stays private. */
const LETTER_ORDER = 'CDEFGAB';

export function parsePitch(value, defaultOctave = 4) {
  const match = /^([A-G])([#♯b♭]?)([0-8])?$/.exec(String(value || '').trim());
  if (!match) return null;
  const accidental = match[2] === '#' || match[2] === '♯' ? '#' : match[2] === 'b' || match[2] === '♭' ? 'b' : '';
  const octave = match[3] === undefined ? defaultOctave : Number(match[3]);
  const name = match[1].toLowerCase() + accidental;
  return {key:`${name}/${octave}`, letter:match[1], accidental, octave,
    diatonic:octave * 7 + LETTER_ORDER.indexOf(match[1])};
}

/** Ascending written notes; spellings remain distinct even when enharmonic. */
export function parseAscendingChord(value) {
  const tokens = String(value || '').split(/\s*[–—,]\s*/).map(x => x.trim()).filter(Boolean);
  if (!tokens.length || tokens.length > 6) return null;
  const result = [];
  let previous = -Infinity;
  for (let i = 0; i < tokens.length; i++) {
    let pitch = parsePitch(tokens[i], i === 0 && tokens[0] === 'B' ? 3 : 4);
    if (!pitch) return null;
    if (i && !/[0-8]$/.test(tokens[i])) {
      while (pitch.diatonic <= previous) pitch = parsePitch(tokens[i], pitch.octave + 1);
    }
    result.push(pitch);
    previous = pitch.diatonic;
  }
  return result;
}

export function engravingKind(spec) {
  if (!spec || typeof spec !== 'object') return null;
  if (spec.kind === 'score' && Array.isArray(spec.systems) && spec.systems.length &&
      spec.systems.every(system => Array.isArray(system.upper) && system.upper.length > 0 &&
        system.upper.every(chord => Array.isArray(chord) && chord.length > 0 && chord.every(pitch => parsePitch(pitch))) &&
        Array.isArray(system.functions) && system.functions.length === system.upper.length &&
        (spec.mode === 'treble' || (Array.isArray(system.bass) &&
          system.bass.length === system.upper.length && system.bass.every(pitch => parsePitch(pitch)))))) return 'score';
  if (spec.kind === 'motion') {
    const lines = Array.isArray(spec.lines) && spec.lines.length ? spec.lines : [{notes:spec.notes}];
    const stages = spec.labels?.length || lines[0].notes?.length || 0;
    return stages >= 2 && lines.every(line => line.notes?.length >= stages &&
      line.notes.slice(0, stages).every(value => parsePitch(value))) ? 'motion' : null;
  }
  if (spec.kind === 'enharmonic' && spec.first && spec.second) return 'enharmonic';
  if (spec.kind === 'pivot' && spec.chord && parseAscendingChord(spec.chord.split('(')[0].trim())) return 'pivot';
  if (spec.kind === 'flow' && spec.nodes?.length === 5 && spec.nodes.every(n => /^[A-G]$/.test(n.detail || ''))) return 'fifths';
  if (spec.kind === 'layers') {
    if (spec.rows?.length >= 3 && spec.rows[0]?.cells?.[0] === 'K64') return 'cadential';
    if (spec.rows?.length >= 2 && spec.rows.slice(0,2).every(r => r.cells?.every(c => parsePitch(c, 3)))) return 'bassRows';
    if (spec.rows?.length === 3 && spec.rows[0]?.cells?.length === 4 && spec.rows[0].cells.every(c => parsePitch(c))) return 'reharmonization';
  }
  if (spec.kind === 'compare' && spec.panels?.length) {
    if (spec.panels.length === 4 && spec.panels.every(p => /=\s*[A-G][#♯b♭]?$/.test(p.notes || ''))) return 'equality';
    // A repeated-note bass figure (pedal/ostinato) is not a chord. Ordinary
    // seventh chords also arrive as dash-separated pitch lists, so looking at
    // the separators alone would misengrave ii7 and iiø7 as bass melodies.
    if (spec.panels.length === 2 && spec.panels.every(p => {
      const tokens = String(p.notes || '').split(/\s*[–—]\s*/);
      return tokens.length > 2 && tokens.every(n => parsePitch(n, 3));
    }) && spec.panels.some(p => {
      const tokens = String(p.notes).split(/\s*[–—]\s*/);
      return new Set(tokens).size < tokens.length;
    })) return 'patterns';
    if (spec.panels.every(p => parseAscendingChord(p.notes)?.length >= 3)) return 'chords';
    if (spec.panels.every(p => {
      const detailIsPitchMotion = p.detail && String(p.detail).split(/\s*→\s*/).length === 2 &&
        String(p.detail).split(/\s*→\s*/).every(n => parsePitch(n));
      const s = detailIsPitchMotion ? p.detail : p.notes;
      return String(s || '').split(/\s*→\s*/).length === 2 && String(s).split(/\s*→\s*/).every(n => parsePitch(n));
    })) return 'movements';
  }
  return null;
}
