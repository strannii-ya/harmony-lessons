import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,CATEGORIES,ROOTS,example,intervalName,inversionNames} from '../site/chord-model.js';
import {compile,parseChord,KEYS,noteName,mod} from '../site/music.js';
import {compileExercise} from '../site/bass.js';
import {prepareMeasure,planEngraving} from '../site/engraving.js';
import {GENRES,selectExercises} from '../site/genre-library.js';

test('44 distinct reference entries in seven categories; no duplicate IDs, missing tones or mislabeled tertian inversions',()=>{
 assert.equal(TYPES.length,44);assert.equal(CATEGORIES.length,7);assert.equal(new Set(TYPES.map(t=>t.id)).size,44);
 for(const t of TYPES){assert(CATEGORIES.some(c=>c.id===t.category));assert.equal(new Set(t.semi.map(n=>n%12)).size,t.semi.length);
  assert.equal(inversionNames(t.semi.length,t).length,t.semi.length);
  if(!t.tertian)assert(!inversionNames(t.semi.length,t).some(n=>/Квинтсекст|Секундаккорд/.test(n)));
 }
});
test('added, suspended, sixth and ninth symbols have different explicitly spelled structures',()=>{
 assert.deepEqual(example('add9').tones.map(noteName),['C','E','G','D']);
 assert.deepEqual(example('ninth').tones.map(noteName),['C','E','G','B♭','D']);
 assert.deepEqual(example('sus2').tones.map(noteName),['C','D','G']);
 assert.deepEqual(example('sixth').tones.map(noteName),['C','E','G','A']);
 assert.deepEqual(example('minor6').tones.map(noteName),['C','E♭','G','A']);
 assert.deepEqual(example('sixNine').fromRoot,['б.3','ч.5','б.6','б.9']);
 assert.deepEqual(example('thirteenth').fromRoot,['б.3','ч.5','м.7','б.9','ч.11','б.13']);
 assert.deepEqual(example('seventhSharp9').tones.map(noteName),['C','E','G','B♭','D♯']);
 assert.equal(example('major9').tones[3].midi-example('ninth').tones[3].midi,1);
});
test('compound intervals stay compound; inversion preserves every tone and double accidental',()=>{
 let count=0;
 for(const root of ROOTS)for(const t of TYPES)for(let i=0;i<t.semi.length;i++){
  const x=example(t.id,root,i);
  assert.equal(x.notes[0].letter,x.tones[i].letter);assert.equal(x.notes[0].alter,x.tones[i].alter);
  assert.deepEqual(x.notes.map(n=>mod(n.midi-x.root.midi)).sort((a,b)=>a-b),t.semi.map(n=>n%12).sort((a,b)=>a-b));
  x.notes.forEach((n,j)=>{if(j)assert(n.midi>x.notes[j-1].midi);assert(Math.abs(n.alter)<=2);});
  prepareMeasure(x.score.bars[0],{first:true,showLabels:false});count++;
 }
 assert(count>2000);assert.equal(intervalName(example('ninth').root,example('ninth').tones.at(-1)),'б.9');
});
test('Roman first-inversion 6 is not an added sixth; nonstandard input fails rather than guessing',()=>{
 assert.equal(parseChord('I6').name,'C/E');
 assert.equal(parseChord('I(add6)').name,'C6');assert.equal(parseChord('I(add6)').tones.length,4);
 assert.equal(parseChord('i(add6)').name,'Cm6');assert.equal(parseChord('I(add6,9)').name,'C6/9');
 for(const s of ['I99','V7alt','I6/9','Iadd','Imaj11'])assert.throws(()=>parseChord(s));
});
test('extended genre sequences preserve all tones, spelling, bass and durations in 12 keys and both textures',()=>{
 const progressions=[['ii9','V9','Imaj9','Imaj9'],['iiø7','V7(♭9)','i(add6)','i(add6)'],['Iadd9','V','vi7','IVadd9'],['I5','♭VII5','IV5','I5'],['i7','IV7','i7','IV7']];
 for(const progression of progressions)for(const mode of ['major','minor'])for(const tonic of KEYS[mode])for(const pattern of ['chords','arpeggio'])for(const inversions of [false,true]){
  const e={progression,mode,loop:true},s=compileExercise(e,{mode,tonic,pattern,inversions});
  assert.equal(s.bars.length,4);assert.equal(s.totalBeats,16);
  const ordinary=compile(progression,{mode,tonic,pattern});
  assert.deepEqual(s.events.filter(e=>e.hand==='left'),ordinary.events.filter(e=>e.hand==='left'));
  for(const b of s.bars){
   assert.deepEqual([...new Set(b.rh.flatMap(e=>e.notes.map(n=>mod(n.midi))))].sort(),b.tones.map(n=>mod(n.midi)).sort());
   for(const e of b.rh){assert(s.events.includes(e));for(const n of e.notes)assert(b.tones.some(t=>t.letter===n.letter&&t.alter===n.alter));}
   for(const showBass of [false,true])prepareMeasure(b,{first:true,showBass,showMeter:true});
  }
 }
});
test('3/4 has dotted halves and six eighths; the old 4/4 model is untouched',()=>{
 const e={progression:['I','IV','V7','I'],theory:{meter:3}};
 for(const pattern of ['chords','arpeggio']){
  const s=compileExercise(e,{pattern,inversions:true});assert.equal(s.totalBeats,12);
  assert.deepEqual(s.bars.map(b=>b.beat),[0,3,6,9]);
  for(const b of s.bars){assert.equal(b.left.duration,3);assert.equal(b.rh.length,pattern==='chords'?1:6);
   const m=prepareMeasure(b,{first:true,showMeter:true,showBass:true});assert.equal(m.left.notes[0].getTicks().value(),12288);
   if(pattern==='chords')assert.equal(m.right.notes[0].getTicks().value(),12288);
  }
  assert.equal(planEngraving(s,700,{showBass:true}).meter,true);
 }
 assert.equal(compile(['I','IV','V','I']).totalBeats,16);
 assert.throws(()=>compile([{symbol:'I',beats:5}]));
});
test('genre filters do not attach examples to a course or mix favorites between users',()=>{
 const fixtures=[{id:'course-1',lesson_id:1,title:'Тема',goal:'',discuss:'',progression:['I']},
  {id:'genre-1',lesson_id:null,library_section:'genres',genre:'jazz',title:'Нона',goal:'',discuss:'',progression:['ii9','V9','Imaj9']},
  {id:'genre-2',lesson_id:null,library_section:'genres',genre:'blues',title:'Блюз',goal:'',discuss:'',progression:['I7']}];
 assert.equal(GENRES.length,10);
 assert.deepEqual(selectExercises(fixtures,{collection:'course'}).map(x=>x.id),['course-1']);
 assert.deepEqual(selectExercises(fixtures,{collection:'genres',genre:'jazz'}).map(x=>x.id),['genre-1']);
 assert.deepEqual(selectExercises(fixtures,{query:'Джаз'}).map(x=>x.id),['genre-1']);
 assert.equal(selectExercises(fixtures,{lesson:1}).length,1);
 assert.equal(selectExercises(fixtures,{favorites:new Set()}).length,0);
 assert.deepEqual(selectExercises(fixtures,{favorites:new Set(['genre-2'])}).map(x=>x.id),['genre-2']);
});
