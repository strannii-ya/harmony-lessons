import test from 'node:test';
import assert from 'node:assert/strict';
import {compileExercise} from '../site/bass.js';
import {planEngraving} from '../site/engraving.js';
import {KEYS} from '../site/music.js';
test('default connected voicings retain four-measure portrait phrases with readable glyph spacing',()=>{
 for(const mode of ['major','minor'])for(const tonic of KEYS[mode])for(const actual of [276,331,346,386])for(const showBass of [false,true]){
  const progression=mode==='major'?['I','IV','V7','I','vi','ii7','V7','I']:['i','iv','V7','i','VI','iiø7','V7','i'];
  const score=compileExercise({progression,theory:{}},{tonic,mode,pattern:'chords',inversions:true});
  const original=JSON.stringify(score),options={showBass,compact:true,barsPerSystem:4};
  const needed=Math.max(...planEngraving(score,10000,options).rows.map(r=>r.used+32));
  const plan=planEngraving(score,Math.max(actual/.75,Math.min(needed,actual/.62)),options);
  if(actual>=331||needed<=actual/.62+.01)assert.deepEqual(plan.rows.map(r=>r.measures.length),[4,4]);
  assert.equal(JSON.stringify(score),original);
  for(const row of plan.rows)for(const measure of row.measures)assert(measure.width>=measure.minimum-.01);
 }
});
