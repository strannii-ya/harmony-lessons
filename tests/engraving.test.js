import test from 'node:test';
import assert from 'node:assert/strict';
import { VF } from '../site/vexflow.js';
import { vexKey, makeVoice, planEngraving } from '../site/engraving.js';
import { compile, KEYS, pitch } from '../site/music.js';
import { TYPES, ROOTS, example } from '../site/chord-model.js';
test('pinned VexFlow Bravura uses engraved whole, half and black noteheads',()=>{
 assert.equal(VF.BUILD.VERSION,'4.2.5');assert.equal(VF.getMusicFont()[0],'Bravura');
 for(const [duration,glyph] of [[4,'noteheadWhole'],[2,'noteheadHalf'],[1,'noteheadBlack'],[.5,'noteheadBlack']]){
  const bar={tonic:'C',mode:'major',beats:duration};const part=makeVoice([{notes:[pitch('C')],duration}],bar,'treble');
  assert.equal(part.notes[0].noteHeads[0].glyph_code,glyph);
 }
});
test('written note names and double accidentals never pass through MIDI enharmonic normalization',()=>{
 assert.equal(vexKey(pitch('Bbb',4)),'bbb/4');assert.equal(vexKey(pitch('F##',4)),'f##/4');
 for(const root of ROOTS)for(const type of TYPES)for(let inv=0;inv<type.semi.length;inv++){
  const x=example(type.id,root,inv),snapshot=JSON.stringify(x.score);
  const p=planEngraving(x.score,350,{showLabels:false,showMeter:false});
  assert.deepEqual(p.rows[0].measures[0].right.notes[0].getKeys(),x.notes.map(vexKey));assert.equal(JSON.stringify(x.score),snapshot);
 }
});
test('accidentals respect signature, written octave, natural cancellation and measure boundaries',()=>{
 const event=(name,octave=4)=>({notes:[pitch(name,octave)],duration:1}),b={tonic:'G',mode:'major',beats:4};
 const p=makeVoice([event('F#'),event('F'),event('F'),event('F#')],b,'treble');
 assert.deepEqual(p.notes.map(n=>n.getModifiers().filter(m=>m.getCategory()==='Accidental').map(m=>m.type)),[[],['n'],[],['#']]);
 const q=makeVoice([event('F'),event('F',5),event('F'),event('F#',5)],b,'treble');
 assert.deepEqual(q.notes.map(n=>n.getModifiers().filter(m=>m.getCategory()==='Accidental').map(m=>m.type)),[['n'],['n'],[],['#']]);
});
test('all keys and textures retain every bar and event including exact left-hand pitches',()=>{
 for(const mode of ['major','minor'])for(const tonic of KEYS[mode])for(const pattern of ['chords','arpeggio']){
  const s=compile(mode==='major'?['I','V65','I6','ii7','V7','I']:['i','iiø7','V7','i'],{tonic,mode,pattern}),snapshot=JSON.stringify(s);
  for(const width of [280,500,1200])for(const showBass of [false,true]){
   const plan=planEngraving(s,width,{showBass}),ms=plan.rows.flatMap(r=>r.measures);assert.equal(ms.length,s.bars.length);assert.equal(plan.showBass,showBass);
   for(const [i,m] of ms.entries()){
    assert.deepEqual(m.right.notes.map(n=>n.getKeys()),s.bars[i].rh.map(e=>e.notes.map(vexKey)));
    if(showBass)assert.deepEqual(m.left.notes[0].getKeys(),s.bars[i].left.notes.map(vexKey));assert.ok(m.width>=m.minimum-0.001);
   }
  }assert.equal(JSON.stringify(s),snapshot);
 }
});
