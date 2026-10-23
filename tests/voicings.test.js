import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExercise } from '../site/bass.js';
import { compile, KEYS, mod, midiBytes } from '../site/music.js';
import { applyRightHandVoicings, planRightHand, voicingCandidates, transitionCost } from '../site/voicings.js';
import { keyLabel, academicKeyNames } from '../site/key-labels.js';
import { prepareMeasure } from '../site/engraving.js';
const midis=ns=>ns.map(n=>n.midi);
const spelling=ns=>ns.map(n=>n.letter+':'+n.alter).sort();
const events=s=>s.events.map(e=>({hand:e.hand,beat:e.beat,duration:e.duration,index:e.index,notes:e.notes}));
const exercise=progression=>({progression,loop:false});

test('right-hand switch is opt-in and restores the original notation/audio bit for bit',()=>{
 const e=exercise(['I','IV','V7','I']);
 for(const pattern of ['chords','arpeggio']) {
  const original=compileExercise(e,{tonic:'C',pattern});
  const off=compileExercise(e,{tonic:'C',pattern,inversions:false});
  assert.deepEqual(off,original);
  const before=JSON.stringify(original);
  const on=applyRightHandVoicings(original);
  assert.equal(JSON.stringify(original),before);
  assert.notDeepEqual(events(on),events(original));
  assert.deepEqual(compileExercise(e,{tonic:'C',pattern,inversions:false}),off);
 }
});

test('I IV V I gets close connected shapes, not a separate root-position jump at every chord',()=>{
 const s=compileExercise(exercise(['I','IV','V','I']),{inversions:true});
 assert.deepEqual(s.bars.map(b=>midis(b.rh[0].notes)),[[60,64,67],[60,65,69],[59,62,67],[60,64,67]]);
 assert.deepEqual(s.bars.map(b=>b.name),['C','F','G','C']);
 assert.deepEqual(s.bars.map(b=>b.inversion),[0,0,0,0]);
 assert.deepEqual(s.bars.map(b=>b.rhInversion),[0,2,1,0]);
});

test('cadential K64 remains in second inversion in RH during automatic voice-leading',()=>{
 for(const mode of ['major','minor'])for(const tonic of KEYS[mode]){
  const progression=mode==='major'?['I','IV6','K64','V7','I']:['i','iv6','K64','V7','i'];
  const score=compileExercise(exercise(progression),{tonic,mode,pattern:'chords',inversions:true});
  const cadential=score.bars[2];
  assert.equal(cadential.inversion,2);
  assert.equal(cadential.rhInversion,2);
  assert.equal(mod(cadential.rhPosition[0].midi),mod(cadential.bass.midi));
  assert.equal(cadential.rhPosition.length,3);
 }
});

test('all supported keys, textures, seventh qualities and authored bass contours preserve pitches and timings',()=>{
 const examples=[
  exercise(['I','IV','V','I']),
  {progression:['Imaj7','vi7','ii7','V7'],loop:true},
  exercise(['I','iv','iiø7','vii°7','V7','I']),
  {progression:['I','V6','vi','iii6','IV','I6','ii7','V7','I'],theory:{notation:{bass_offsets:[12,11,9,7,5,4,2,7,12]}}},
  exercise([{symbol:'I',bass:'1'},{symbol:'IV',bass:'1'},{symbol:'V7',bass:'1'},'I']),
  exercise(['i','iv','iiø7','K64','V42','i6','V7','i']),
  exercise(['I','vii°7',{symbol:'vii°65',offset:9,mode:'minor'},{symbol:'i',offset:9,mode:'minor'}]),
  exercise(['I','vii°7',{symbol:'vii°42',offset:3,mode:'minor'},{symbol:'i',offset:3,mode:'minor'}]),
  exercise(['I','vii°7/ii',{symbol:'i',offset:2,mode:'minor'},'V7/vi','vi']),
  exercise([{symbol:'I',beats:2},{symbol:'V7',beats:1},{symbol:'I',beats:4}])
 ];
 let cases=0;
 for(const e of examples)for(const mode of ['major','minor'])for(const tonic of KEYS[mode])for(const pattern of ['chords','arpeggio']) {
  // The explicit bass contour above is the annotated MAJOR variant.
  if(e.theory&&mode==='minor')continue;
  const a=compileExercise(e,{tonic,mode,pattern}), b=compileExercise(e,{tonic,mode,pattern,inversions:true});
  assert.equal(a.totalBeats,b.totalBeats);assert.equal(a.events.length,b.events.length);
  assert.deepEqual(b.events.filter(e=>e.hand==='left'),a.events.filter(e=>e.hand==='left'));
  for(let i=0;i<a.bars.length;i++) {
   const before=a.bars[i],after=b.bars[i];
   assert.deepEqual(after.tones,before.tones);assert.deepEqual(after.bass,before.bass);
   assert.equal(after.symbol,before.symbol);assert.equal(after.inversion,before.inversion);assert.equal(after.name,before.name);
   assert.deepEqual(spelling(after.rhPosition),spelling(before.tones));
   assert(after.rhPosition.at(-1).midi-after.rhPosition[0].midi<=11);
   assert(after.rhPosition[0].midi>after.bass.midi);
   for(const [j,event] of after.rh.entries()) {
    assert.equal(event.beat,before.rh[j].beat);assert.equal(event.duration,before.rh[j].duration);
    assert(b.events.includes(event),'notation and audio share event objects');
    for(const n of event.notes)assert(before.tones.some(t=>t.letter===n.letter&&t.alter===n.alter),'no enharmonic substitution');
   }
   if(after.beats===4)assert.deepEqual([...new Set(after.rh.flatMap(e=>e.notes.map(n=>mod(n.midi))))].sort(),before.tones.map(n=>mod(n.midi)).sort());
   const prepared=prepareMeasure(after,{first:true,showBass:true});
   assert.equal(prepared.right.notes.length,after.rh.length);
  }
  assert(midiBytes(b,72,'both').length>14);
  assert.deepEqual(events(compileExercise(e,{tonic,mode,pattern,inversions:true})),events(b),'deterministic');cases++;
 }
 assert(cases>=400);
});

test('enharmonic re-interpretation uses the same pressed keys, in chords and wide arpeggios',()=>{
 for(const target of [{symbol:'vii°65',offset:9,mode:'minor'},{symbol:'vii°42',offset:3,mode:'minor'}])
 for(const tonic of KEYS.major)for(const pattern of ['chords','arpeggio']) {
  const s=compileExercise(exercise(['I','vii°7',target,{symbol:'i',offset:target.offset,mode:'minor'}]),{tonic,pattern,inversions:true});
  assert.deepEqual(s.bars[1].rh.map(e=>midis(e.notes)),s.bars[2].rh.map(e=>midis(e.notes)));
 }
});

test('loop optimisation includes the last-to-first seam, with deterministic whole-cycle selection',()=>{
 const s=compile(['I','vi7','ii7','V7']);
 const plan=planRightHand(s,{loop:true});
 assert(plan.positions.length===4);assert(Number.isFinite(plan.cost));
 assert(Number.isFinite(transitionCost(plan.positions.at(-1),plan.positions[0])));
 assert.deepEqual(planRightHand(s,{loop:true}),plan);
 const closed=planRightHand(compile(['I','IV','V','I']),{loop:true});
 assert.deepEqual(midis(closed.positions[0].notes),midis(closed.positions.at(-1).notes));
 const long=planRightHand(compile(Array.from({length:64},(_,i)=>['I','vi','ii7','V7'][i%4])),{loop:true});
 assert.equal(long.positions.length,64);
});

test('accidentals are spelled correctly in every candidate, and malformed inputs fail explicitly',()=>{
 const score=compile(['vii°7'],{tonic:'F#',mode:'minor'});
 for(const c of voicingCandidates(score.bars[0]))assert.deepEqual(spelling(c.notes),spelling(score.bars[0].tones));
 assert.throws(()=>planRightHand({bars:[]}));
 assert.throws(()=>voicingCandidates({...score.bars[0],tones:[]}));
});

test('academic key names distinguish H from B and use lowercase minor tonics',()=>{
 assert.deepEqual(KEYS.major.map(k=>keyLabel(k)),['C-dur','Des-dur','D-dur','Es-dur','E-dur','F-dur','Fis-dur','G-dur','As-dur','A-dur','B-dur','H-dur']);
 assert.deepEqual(KEYS.minor.map(k=>keyLabel(k,'minor')),['c-moll','cis-moll','d-moll','es-moll','e-moll','f-moll','fis-moll','g-moll','gis-moll','a-moll','b-moll','h-moll']);
 assert.throws(()=>keyLabel('invalid'));assert.throws(()=>keyLabel('C','dorian'));
 assert.equal(academicKeyNames('До мажор; в ля миноре, из си-бемоль мажора к фа-диез минору.'),'C-dur; в a-moll, из B-dur к fis-moll.');
 assert.equal(academicKeyNames('Ми♭ мажор и соль♯ минор; до мажорного аккорда.'),'Es-dur и gis-moll; до мажорного аккорда.');
 assert.equal(academicKeyNames('Мажорное трезвучие, C/E, B♭7, мажоро-минор.'),'Мажорное трезвучие, C/E, B♭7, мажоро-минор.');
});
