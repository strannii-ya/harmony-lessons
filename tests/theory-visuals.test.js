import test from 'node:test';
import assert from 'node:assert/strict';
import { visualHTML } from '../site/theory-visuals.js';
import { engravingKind, parsePitch, parseAscendingChord } from '../site/theory-visual-model.js';

const DEMOS = [
  { kind: 'flow', nodes: [{label: 'T'}, {label: 'S'}, {label: 'D'}] },
  { kind: 'motion', labels: ['V7', 'I'], notes: ['B4', 'C5'] },
  { kind: 'compare', panels: [{label: 'I', notes: 'C–E–G'}, {label: 'i', notes: 'C–E♭–G'}] },
  { kind: 'layers', rows: [{label: 'Бас', cells: ['1', '2', '3']}] },
  { kind: 'form', rows: [{label: 'Раздел', cells: ['A', 'B', 'A′']}] },
  { kind: 'branch', start: ['I'], paths: [{label: 'A'}, {label: 'B'}] },
  { kind: 'pivot', chord: 'A–C–E', equivalence: 'vi = ii' },
  { kind: 'enharmonic', sameKey: 'A♭ = G♯', first: {label: 'C', notes: 'B–D–F–A♭'}, second: {label: 'a', notes: 'B–D–F–G♯'} },
  { kind: 'sequence', blocks: [{label: 'C', pattern: 'vi–ii–V–I'}, {label: 'D', pattern: 'vi–ii–V–I'}] },
  {kind: 'score', title: 'Согласованный нотный пример', systems: [{
    functions:['I','V','I'], upper:[['C4','E4','G4'],['B3','D4','G4'],['C4','E4','G4']],
    bass:['C3','G2','C3'],
  }], miniMode:'treble'}
];

test('each supported illustration works on a lesson card and inside theory', () => {
  for (const spec of DEMOS) {
    for (const compact of [false, true]) {
      const markup = visualHTML({...spec, title: 'Схема'}, {compact});
      assert.match(markup, new RegExp(`lesson-visual--${spec.kind}`), spec.kind);
      assert.match(markup, compact ? /^<span\b/ : /^<figure\b/, spec.kind);
      assert.ok(!markup.includes('undefined'), spec.kind);
      if (engravingKind(spec)) {
        assert.match(markup, /data-theory-engraving="/);
        assert.match(markup, /vis-engraving/);
        assert.doesNotMatch(markup, /<ellipse/);
      } else {
        assert.match(markup, /<svg\b[^>]*role="img"/);
      }
    }
  }
});

test('lesson data stays text and cannot inject markup or attributes', () => {
  const markup = visualHTML({kind: 'flow', title: '\"><script>alert(1)</script>',
    caption: '<img src=x onerror=alert(1)>', nodes: [{label: '</text><a href="evil">X</a>'}]});
  assert.ok(!markup.includes('<script>'));
  assert.ok(!markup.includes('<img'));
  assert.ok(!markup.includes('<a href='));
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /&lt;\/text&gt;/);
  const engraved = visualHTML({kind:'motion', title:'"><script>alert(2)</script>',
    labels:['<img src=x onerror=alert(1)>','I'], notes:['B4','C5']});
  assert.doesNotMatch(engraved, /<script|<img/);
  assert.match(engraved, /&lt;script&gt;/);
});

test('pitch spelling preserves accidental and diatonic staff placement', () => {
  assert.equal(parsePitch('A♭4').key, 'ab/4');
  assert.equal(parsePitch('G♯4').key, 'g#/4');
  assert.equal(parsePitch('G#4').key, 'g#/4');
  assert.equal(parsePitch('F♯4').diatonic, parsePitch('F4').diatonic);
  assert.equal(parsePitch('A♭4').diatonic, parsePitch('A4').diatonic);
  assert.notEqual(parsePitch('A♭4').diatonic, parsePitch('G♯4').diatonic);
  assert.equal(parsePitch('C#nan'), null);
});

test('ascending chords assign correct octaves to leading-tone sevenths', () => {
  assert.deepEqual(parseAscendingChord('B–D–F–A♭').map(p => p.key),
    ['b/3','d/4','f/4','ab/4']);
  assert.deepEqual(parseAscendingChord('E–G♯–B–D').map(p => p.key),
    ['e/4','g#/4','b/4','d/5']);
  assert.deepEqual(parseAscendingChord('D–F–A♭–C').map(p => p.key),
    ['d/4','f/4','ab/4','c/5']);
});

test('seventh chords cannot be mistaken for pedal or ostinato figures', () => {
  assert.equal(engravingKind({kind:'compare',panels:[
    {notes:'D–F–A–C'}, {notes:'D–F–A♭–C'}]}), 'chords');
  assert.equal(engravingKind({kind:'compare',panels:[
    {notes:'C — C — C'}, {notes:'C–G–C–G'}]}), 'patterns');
  assert.equal(engravingKind({kind:'compare',panels:[
    {notes:'F → F♯',detail:'4 → ♯4'}, {notes:'E → F',detail:'3 → 4'}]}), 'movements');
});

const PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function midiPitch(p) {
  return 12*(p.octave+1)+PC[p.letter]+(p.accidental === '#' ? 1 : p.accidental === 'b' ? -1 : 0);
}

test('theory examples are musically correct, not merely plausible diagrams', () => {
  // Parallel major/minor II7: only the 6th scale degree is altered.
  const major = parseAscendingChord('D–F–A–C').map(midiPitch);
  const minor = parseAscendingChord('D–F–A♭–C').map(midiPitch);
  assert.deepEqual(major.map((m,i) => m-minor[i]), [0,0,1,0]);
  // V7 in A harmonic minor must contain G sharp, not natural G.
  assert.deepEqual(parseAscendingChord('E–G♯–B–D').map(midiPitch).map(m => m%12), [4,8,11,2]);
  // Enharmonic re-interpretation changes the spelling, not pitch height.
  assert.deepEqual(parseAscendingChord('B–D–F–A♭').map(midiPitch),
    parseAscendingChord('B–D–F–G♯').map(midiPitch));
  // C harmonic major lowers only the seventh of the natural-major viiø7.
  const halfDim = parseAscendingChord('B–D–F–A').map(midiPitch);
  const fullDim = parseAscendingChord('B–D–F–A♭').map(midiPitch);
  assert.deepEqual(halfDim.map((m,i) => m-fullDim[i]), [0,0,0,1]);
  // Same-sized semitones: one chromatic (F–F#), one diatonic (E–F).
  assert.equal(midiPitch(parsePitch('F♯4'))-midiPitch(parsePitch('F4')), 1);
  assert.equal(midiPitch(parsePitch('F4'))-midiPitch(parsePitch('E4')), 1);
});

test('unknown or incomplete diagrams are omitted safely', () => {
  assert.equal(visualHTML(null), '');
  assert.equal(visualHTML({kind: 'javascript'}), '');
  assert.equal(visualHTML({kind: 'motion', labels: ['I']}), '');
  assert.equal(visualHTML({kind: 'enharmonic', first: null, second: null}), '');
  assert.equal(visualHTML({kind: 'score', systems: [{functions:['I'], upper:[['not-a-note']], bass:['C3']}]}), '');
});
