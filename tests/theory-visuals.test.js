import test from 'node:test';
import assert from 'node:assert/strict';
import { visualHTML } from '../site/theory-visuals.js';

const DEMOS = [
  { kind: 'flow', nodes: [{label: 'T'}, {label: 'S'}, {label: 'D'}] },
  { kind: 'motion', labels: ['V7', 'I'], notes: ['B4', 'C5'] },
  { kind: 'compare', panels: [{label: 'I', notes: 'C–E–G'}, {label: 'i', notes: 'C–E♭–G'}] },
  { kind: 'layers', rows: [{label: 'Бас', cells: ['1', '2', '3']}] },
  { kind: 'form', rows: [{label: 'Раздел', cells: ['A', 'B', 'A′']}] },
  { kind: 'branch', start: ['I'], paths: [{label: 'A'}, {label: 'B'}] },
  { kind: 'pivot', chord: 'A–C–E', equivalence: 'vi = ii' },
  { kind: 'enharmonic', sameKey: 'A♭ = G♯', first: {label: 'C', notes: 'B–D–F–A♭'}, second: {label: 'a', notes: 'B–D–F–G♯'} },
  { kind: 'sequence', blocks: [{label: 'C', pattern: 'vi–ii–V–I'}, {label: 'D', pattern: 'vi–ii–V–I'}] }
];

test('each supported illustration works on a lesson card and inside theory', () => {
  for (const spec of DEMOS) {
    for (const compact of [false, true]) {
      const markup = visualHTML({...spec, title: 'Схема'}, {compact});
      assert.match(markup, /<svg\b[^>]*role="img"[^>]*>/, spec.kind);
      assert.match(markup, new RegExp(`lesson-visual--${spec.kind}`), spec.kind);
      assert.match(markup, compact ? /^<span\b/ : /^<figure\b/, spec.kind);
      assert.ok(!markup.includes('undefined'), spec.kind);
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
});

test('note positions follow staff pitch, and accidentals do not change staff steps', () => {
  const normal = visualHTML({kind: 'motion', labels: ['a', 'b'], notes: ['F4', 'G4']});
  const altered = visualHTML({kind: 'motion', labels: ['a', 'b'], notes: ['F#4', 'Gb4']});
  const positions = markup => [...markup.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)"/g)]
    .map(match => Number(match[2]));
  assert.deepEqual(positions(normal), positions(altered));
  assert.ok(positions(normal)[1] < positions(normal)[0]);
  assert.match(altered, /♯/);
  assert.match(altered, /♭/);
});

test('unknown or incomplete diagrams are omitted safely', () => {
  assert.equal(visualHTML(null), '');
  assert.equal(visualHTML({kind: 'javascript'}), '');
  assert.equal(visualHTML({kind: 'motion', labels: ['I']}), '');
  assert.equal(visualHTML({kind: 'enharmonic', first: null, second: null}), '');
});
