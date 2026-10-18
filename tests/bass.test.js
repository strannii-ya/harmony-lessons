import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBass, compileExercise } from '../site/bass.js';
import { compile, KEYS, noteName } from '../site/music.js';
import { renderScore, clearScores } from '../site/notation-legacy.js';
const exercise=(progression,notation={})=>({progression,theory:{notation}});
test('editorial defaults override structural hints; explicit bass and inversions are otherwise detected',()=>{
 assert.equal(defaultBass(exercise(['I','IV','V','I'])),false);
 for(const p of [['I','V65','I'],['I','ii6','K64','V7','I'],[{symbol:'I',bass:'5'},'V']])assert.equal(defaultBass(exercise(p)),true);
 assert.equal(defaultBass(exercise(['V7/ii','ii7'])),false);
 assert.equal(defaultBass(exercise(['I','I6'],{show_bass:false})),false);
 assert.equal(defaultBass(exercise(['I'],{show_bass:true})),true);
});
test('directed bass motion preserves its contour in every key and texture; upper notes do not change',()=>{
 const cases=[
  ['major',['I','V6','vi','iii6','IV','I6','ii7','V7','I'],[12,11,9,7,5,4,2,7,12]],
  ['minor',['i','♭VII','♭VI','V7','i'],[12,10,8,7,12]],
  ['major',['I','vii°65','I6','IV','V7','I'],[0,2,4,5,7,0]],
  ['major',['I','IV','V42','I6','ii6','V7','I'],[0,5,5,4,5,7,0]],
  ['major',['I','V65','I'],[12,11,12]],
  ['major',['I','vii°7/ii',{symbol:'i',offset:2,mode:'minor'}],[0,1,2]]
 ];
 for(const [mode,p,bass_offsets] of cases)for(const tonic of KEYS[mode]){
  let bassNotes;
  for(const pattern of ['chords','arpeggio']){
   const options={tonic,mode,pattern},base=compile(p,options),s=compileExercise(exercise(p,{bass_offsets}),options);
   assert.deepEqual(s.events.filter(e=>e.hand==='right'),base.events.filter(e=>e.hand==='right'));
   const midis=s.bars.map(b=>b.bass.midi);
   assert.deepEqual(midis.slice(1).map((n,i)=>n-midis[i]),bass_offsets.slice(1).map((n,i)=>n-bass_offsets[i]));
   assert.deepEqual(s.bars.map(b=>noteName(b.bass)),base.bars.map(b=>noteName(b.bass)));
   assert.deepEqual(s.events.filter(e=>e.hand==='left').map(e=>e.notes[0].midi),midis);
   if(bassNotes)assert.deepEqual(midis,bassNotes);bassNotes=midis;assert.ok(midis.every(m=>m>=21&&m<=53));
  }
 }
});
test('pedal remains fixed; cadence and enharmonic respelling retain actual bass identity',()=>{
 for(const tonic of KEYS.major){
  const pedal=compileExercise(exercise(['I','IV','ii7','V7','I'].map(symbol=>({symbol,bass:'5'}))),{tonic});assert.equal(new Set(pedal.bars.map(b=>b.bass.midi)).size,1);
  const cadence=compileExercise(exercise(['ii6','K64','V7','I']),{tonic});assert.equal(cadence.bars[1].bass.midi,cadence.bars[2].bass.midi);
  for(const [offset,symbol] of [[9,'vii°65'],[3,'vii°42']]){const s=compileExercise(exercise(['vii°7',{symbol,mode:'minor',offset}]),{tonic});assert.equal(s.bars[0].bass.midi,s.bars[1].bass.midi);}
 }
});
test('incorrect annotations fail loudly instead of substituting an unrelated bass',()=>{for(const bass_offsets of [[0],[0,2],[0,'7'],[99,7]])assert.throws(()=>compileExercise(exercise(['I','V'],{bass_offsets}),{tonic:'C'}));});
class Element{
 constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.clientWidth=750;this.classList={contains:()=>false,remove(){},add(){}};}
 setAttribute(k,v){this.attrs[k]=v;}append(n){this.children.push(n);}replaceChildren(...n){this.children=n;}querySelector(){return null;}set textContent(v){this.content=v;}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}
}
test('rollback renderer keeps both staves, pitches and aligned timing; toggle remains visual',()=>{
 const previous=globalThis.document;globalThis.document={createElementNS:(_,t)=>new Element(t)};
 try{
  for(const tonic of KEYS.major)for(const pattern of ['chords','arpeggio'])for(const width of [320,375,750,1440]){
   const s=compileExercise(exercise(['I','ii65','K64','V7','I']),{tonic,pattern}),snapshot=JSON.stringify(s),root=new Element('div');root.clientWidth=width;
   renderScore(root,s,{showBass:true});const nodes=root.all();assert.equal(root.children[0].attrs['data-bass-visible'],true);assert.ok(nodes.some(n=>n.attrs['data-clef']==='bass'));assert.equal(nodes.filter(n=>n.attrs['data-score-bar']!==undefined).length,s.bars.length);
   const left=nodes.filter(n=>n.attrs['data-hand']==='left').flatMap(n=>n.all().filter(t=>t.attrs['data-midi']!==undefined));assert.deepEqual(left.map(n=>n.attrs['data-midi']),s.bars.map(b=>b.bass.midi));
   for(const bar of nodes.filter(n=>n.attrs['data-score-bar']!==undefined)){const noteX=hand=>bar.all().find(n=>n.attrs['data-hand']===hand).all().find(n=>n.attrs['data-midi']!==undefined).attrs.cx;assert.equal(noteX('left'),noteX('right'));}
   const h=+root.children[0].attrs.viewBox.split(' ')[3];assert.ok(nodes.filter(n=>n.attrs['data-midi']!==undefined).every(n=>n.attrs.cy>0&&n.attrs.cy<h));
   renderScore(root,s,{showBass:false});assert.ok(!root.all().some(n=>n.attrs['data-clef']==='bass'));assert.equal(JSON.stringify(s),snapshot);assert.equal(root.children[0].attrs['data-note-scale'],.75);
  }
 }finally{clearScores();globalThis.document=previous;}
});
