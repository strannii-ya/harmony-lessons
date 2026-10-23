import test from 'node:test';
import assert from 'node:assert/strict';
import {compileExercise, defaultBass} from '../site/bass.js';
import {KEYS, mod, noteName, midiBytes} from '../site/music.js';
import {planEngraving} from '../site/engraving.js';
const note=(degree,duration=1,octave=0)=>({degree,duration,octave});
const rest=duration=>({rest:true,duration});
const lesson={mode:'major',progression:['I','IV','V','I'],theory:{notation:{show_bass:true,bass_line:[
 [note('1',2),note('3'),note('5')],
 [note('4'),note('6'),note('1',1),note('#4')],
 [note('5',1.5),rest(.5),note('7'),note('2')],
 [note('1'),rest(.5),note('5',.5),note('1',2)]
]}}};
test('bass notes and rests are independent from held upper harmonies',()=>{
 assert.equal(defaultBass(lesson),true);
 const a=compileExercise(lesson,{tonic:'C',pattern:'chords',inversions:true});
 assert.deepEqual(a.bars.map(b=>b.bassEvents.length),[3,4,4,4]);
 assert.equal(a.totalBeats,16);
 assert.equal(a.bars[1].bassEvents[3].notes[0].midi,42);
 assert.equal(a.bars[2].bassEvents[1].rest,true);
 assert.equal(a.bars[2].bassEvents[1].notes.length,0);
 assert.equal(a.events.filter(e=>e.hand==='left').length,15);
 assert.deepEqual(a.bars.map(b=>b.rh[0].duration),[4,4,4,4]);
 assert.deepEqual(a.bars[1].bassEvents.map(e=>e.beat),[4,5,6,7]);
 assert.deepEqual(a.bars[2].bassEvents.map(e=>e.beat),[8,9.5,10,11]);
 assert.ok(midiBytes(a,90).includes(0x91));
 const model=planEngraving(a,640,{showBass:true});
 assert.deepEqual(model.rows.flatMap(r=>r.measures).map(m=>m.left.notes.length),[3,4,4,4]);
 assert.equal(model.rows.flatMap(r=>r.measures)[2].left.notes[1].isRest(),true);
});
test('all major keys, both right-hand textures, voice leading retain bass timing and pitch classes',()=>{
 for(const tonic of KEYS.major)for(const pattern of ['chords','arpeggio'])for(const inversions of [false,true]){
  const a=compileExercise(lesson,{tonic,pattern,inversions});
  assert.deepEqual(a.bars.map(b=>b.bassEvents.map(e=>e.beat)),[[0,2,3],[4,5,6,7],[8,9.5,10,11],[12,13,13.5,14]]);
  assert.equal(mod(a.bars[1].bassEvents[3].notes[0].midi+1),mod(a.bars[2].bassEvents[0].notes[0].midi));
  assert.equal(a.bars[2].bassEvents[1].rest,true);
  assert.equal(a.events.filter(e=>e.hand==='left').length,15);
 }
});
test('relative registers keep the descending 1–7–6–5 contour across keys',()=>{
 const seq={progression:['I','V6','vi','I64'],theory:{notation:{show_bass:true,bass_line:[
  [{degree:'1',duration:4,semitones:12}],
  [{degree:'7',duration:4,semitones:11}],
  [{degree:'6',duration:4,semitones:9}],
  [{degree:'5',duration:4,semitones:7}]
 ]}}};
 for(const tonic of KEYS.major){const s=compileExercise(seq,{tonic,inversions:true});
  const midi=s.bars.map(b=>b.bass.midi);
  assert.deepEqual(midi.slice(1).map((x,i)=>x-midi[i]),[-1,-2,-2]);
 }
});
test('reject incomplete bars, invalid accidental spellings, bad rests and inconsistent intervals',()=>{
 const base=()=>structuredClone(lesson);
 for(const row of [[],[note('1',2)],[note('1',4),note('5')],[note('8',4)],[note('1',.25)],[{rest:true,duration:4}], [{rest:true,duration:1,degree:'1'},note('1',3)],[note('1',4,3)], [{degree:'7',duration:4,semitones:9}]]){
  const x=base();x.theory.notation.bass_line[0]=row;assert.throws(()=>compileExercise(x,{tonic:'C'}));
 }
 const x=base();x.theory.notation.bass_offsets=[0,5,7,0];assert.throws(()=>compileExercise(x));
 const y=base();y.theory.notation.bass_line=[];assert.throws(()=>compileExercise(y));
});
