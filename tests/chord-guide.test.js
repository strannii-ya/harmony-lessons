import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, ROOTS, example, inversionNames } from '../site/chord-model.js';
import { compile, noteName, KEYS } from '../site/music.js';
import { layoutScore } from '../site/score-layout.js';
import { renderScore, clearScores } from '../site/notation-legacy.js';
test('every type/root/inversion preserves spelling, ordered pitches and root-relative pitch classes',()=>{
 for(const root of ROOTS)for(const type of TYPES)for(let i=0;i<type.semi.length;i++){
  const x=example(type.id,root,i);assert.equal(x.notes.length,type.semi.length);assert.equal(x.bass.letter,x.tones[i].letter);assert.equal(x.bass.alter,x.tones[i].alter);
  assert.deepEqual(x.notes.map(n=>(n.midi-x.root.midi+120)%12).sort((a,b)=>a-b),type.semi);assert.ok(x.notes.every((n,j)=>!j||n.midi>x.notes[j-1].midi));
  assert.equal(x.score.events.length,1);assert.equal(x.score.events[0].hand,'right');assert.equal(inversionNames(type.semi.length).length,type.semi.length);
  for(const width of [240,320,375,760,1440]){const l=layoutScore(x.score,width,{trebleOnly:true,showLabels:false});assert.ok(Number.isFinite(l.height));assert.equal(l.rows[0].bass,null);}
 }
});
test('major triad and major seventh inversions have their actual bass and interval labels',()=>{
 const c=example('major','C',1);assert.equal(c.name,'C/E');assert.deepEqual(c.notes.map(noteName),['E','G','C']);assert.deepEqual(c.fromBass,['м.3','м.6']);
 const c7=example('major7','C',3);assert.equal(c7.name,'Cmaj7/B');assert.deepEqual(c7.fromBass,['м.2','ч.4','м.6']);
 assert.deepEqual(example('seventh','C').chain,['б.3','м.3','м.3']);assert.deepEqual(example('minorMajor7','C').chain,['м.3','б.3','б.3']);
});
test('diminished seventh uses B double-flat and preserves it in third inversion',()=>{
 const d=example('diminished7','C',3);assert.equal(d.name,'Cdim7/B♭♭');assert.deepEqual(d.fromRoot,['м.3','ум.5','ум.7']);assert.deepEqual(d.fromBass,['ув.2','ув.4','б.6']);
 assert.deepEqual(example('halfDiminished7','C').fromRoot,['м.3','ум.5','м.7']);assert.equal(example('augmented','F#').tones[2].alter,2);
});
test('invalid inversion/type/root fails instead of rendering an unrelated chord',()=>{for(const args of [['major','C',3],['seventh','C',4],['minor','C',-1],['major','C',.5],['x','C',0],['major','X',0]])assert.throws(()=>example(...args));});
class Element{
 constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.clientWidth=750;this.classList={contains:()=>false,remove(){},add(){}};}
 setAttribute(k,v){this.attrs[k]=v;}append(n){this.children.push(n);}replaceChildren(...n){this.children=n;}querySelector(){return null;}set textContent(v){this.content=v;}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}
}
test('rollback engraving retains RH pitches, hollow heads and real 75 percent scale',()=>{
 const old=globalThis.document;globalThis.document={createElementNS:(_,t)=>new Element(t)};
 try{for(const mode of ['major','minor'])for(const tonic of KEYS[mode])for(const pattern of ['chords','arpeggio']){
  const score=compile(mode==='major'?['I','V65','I6','ii7','V7','I']:['i','iiø7','V7','i'],{tonic,mode,pattern}),root=new Element('div');renderScore(root,score);
  const all=root.all(),svg=root.children[0];assert.equal(svg.attrs['data-note-scale'],.75);assert.equal(+svg.attrs['data-layout-width'],1000);assert.ok(all.some(n=>n.attrs['data-clef']==='treble'));assert.ok(!all.some(n=>n.attrs['data-clef']==='bass'));
  assert.deepEqual(all.filter(n=>n.attrs['data-midi']!==undefined).map(n=>n.attrs['data-midi']),score.events.filter(e=>e.hand==='right').flatMap(e=>e.notes.map(n=>n.midi)));
  assert.ok(all.filter(n=>n.attrs['data-duration']>=2).every(n=>n.attrs.fill==='none'));assert.ok(all.filter(n=>n.tag==='rect').every(n=>n.attrs.fill==='transparent'));
 }}finally{clearScores();globalThis.document=old;}
});
