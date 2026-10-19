import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODES} from '../site/mode-types.js';
import {MODE_ROOTS,modeScore} from '../site/mode-model.js';
import {planModeNotation} from '../site/mode-notation.js';

test('whole-note scale engraving preserves all pitches and the original listening pulse',()=>{
 let variants=0;
 for(const mode of MODES)for(const root of MODE_ROOTS){
  const s=modeScore(mode.id,root),before=JSON.stringify(s);
  for(const width of [280,460,1000]){
   const plan=planModeNotation(s,width),notes=plan.rows.flatMap(r=>r.notes);
   assert.equal(notes.length,s.notes.length);
   assert.deepEqual(plan.rows.flatMap(r=>r.items.map(d=>d.n)),s.notes);
   for(const row of plan.rows){
    assert(row.minimum<=plan.width+.01);
    assert(row.voice.isComplete());
    for(const n of row.notes){assert.equal(n.getDuration(),'w');assert.equal(n.getGlyph().code_head,'noteheadWhole');assert.equal(n.hasStem(),false);}
   }
   variants++;
  }
  assert.equal(JSON.stringify(s),before);
  assert(s.events.every((e,i)=>e.beat===i && e.duration===1));
 }
 assert.equal(variants,1980);
});
test('paper style is last and preserves button/focus boundaries',()=>{
 const html=readFileSync('site/index.html','utf8'),css=readFileSync('site/paper.css','utf8');
 assert(html.indexOf('./paper.css')>html.indexOf('./modes.css'));
 assert.match(css,/--paper: #fff/);assert.match(css,/\.access-panel/);assert.match(css,/@media print/);
 assert(!/outline\s*:\s*(?:none|0)/.test(css));
});
