import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, KEYS } from '../site/music.js';
import { layoutScore, signature, signatureChange } from '../site/score-layout.js';
const sequence=['I','vi7','ii7','V7','I','IV','iv','I'];
test('one continuous layout contains every chord, in order, at all sizes',()=>{
 for(const pattern of ['chords','arpeggio']) for(const width of [240,320,375,768,1100,1440]){
  const score=compile(sequence,{tonic:'C',pattern});const layout=layoutScore(score,width);
  assert.deepEqual(layout.rows.flatMap(r=>r.bars.map(x=>x.bar.index)),[0,1,2,3,4,5,6,7]);
  for(const row of layout.rows){assert.ok(row.end<=layout.width-15);assert.ok(row.treble<row.bass);assert.ok(row.bottom<layout.height);}
 }
});
test('eight block chords share a system on a desktop',()=>{
 const layout=layoutScore(compile(sequence),1100);assert.equal(layout.rows.length,1);
});
test('changing width reflows the full progression without changing the pitches',()=>{
 const s=compile(sequence,{pattern:'arpeggio'}),json=JSON.stringify(s);
 assert.ok(layoutScore(s,375).rows.length>layoutScore(s,1100).rows.length);
 assert.equal(JSON.stringify(s),json);
});
test('every supported transposition fits and preserves all bars',()=>{
 for(const mode of ['major','minor'])for(const tonic of KEYS[mode]){
  const s=compile(mode==='major'?sequence:['i','iiø7','V7','i','iv','vii°7','V7','i'],{tonic,mode,pattern:'arpeggio'});
  for(const width of [320,375,1100])assert.equal(layoutScore(s,width).rows.flatMap(r=>r.bars).length,8);
 }
});
test('key changes are retained inside the progression',()=>{
 const s=compile(['I','V7/V',{symbol:'I',offset:7}, {symbol:'V7',offset:7},{symbol:'I',offset:7}]);
 const rows=layoutScore(s,1100).rows;assert.equal(rows[0].bars[2].bar.tonic,'G');
 const back=signatureChange({tonic:'G',mode:'major'},{tonic:'C',mode:'major'});assert.equal(back[0].alter,0);assert.equal(back[0].letter,3);
 assert.equal(signature({tonic:'C',mode:'major'}).length,0);
});
test('no bar is dropped from a long 64-chord progression',()=>{
 const s=compile(Array.from({length:64},(_,i)=>sequence[i%8]));const l=layoutScore(s,375);
 assert.equal(l.rows.flatMap(r=>r.bars).length,64);
});
