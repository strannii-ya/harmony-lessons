import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODES,MODE_CATEGORIES,MODE_SOURCES } from '../site/mode-types.js';
import { MODE_ROOTS,modeScore,modeById,parseFormula,rootLabel,transposeModeRoot,selectModes } from '../site/mode-model.js';
import { planModeNotation } from '../site/mode-notation.js';
import { pitch,asciiName,mod } from '../site/music.js';

test('44 documented models, eight categories, and all twelve tonic pitch classes',()=>{
 assert.equal(MODES.length,44);assert.equal(new Set(MODES.map(m=>m.id)).size,44);assert.equal(MODE_CATEGORIES.length,8);
 assert.equal(new Set(MODE_ROOTS.map(r=>mod(pitch(r).midi))).size,12);
 for(const m of MODES){assert(MODE_CATEGORIES.some(c=>c.id===m.category));assert(m.description&&m.practice&&m.feature);for(const key of m.sources)assert.equal(new URL(MODE_SOURCES[key].url).protocol,'https:');}
 assert.equal(rootLabel('B'),'H');assert.equal(rootLabel('Bb'),'B');assert.equal(rootLabel('C#'),'Cis');
});
test('every model and tonic ascends once to the octave; spelling, duration and sound agree',()=>{
 let count=0;
 for(const m of MODES)for(const tonic of MODE_ROOTS){
  const s=modeScore(m.id,tonic),f=parseFormula(m.formula),r=pitch(tonic,4);
  assert.equal(s.notes.length,f.length+1);assert.equal(s.totalBeats,s.notes.length);
  assert.equal(s.steps.reduce((a,b)=>a+b,0),12);assert(s.steps.every(x=>x>0));
  assert.deepEqual(s.notes.map(n=>n.midi-r.midi),[...f.map(n=>n.semitones),12]);
  s.notes.forEach((n,i)=>{assert.equal(pitch(asciiName(n),n.octave).midi,n.midi);assert(Math.abs(n.alter)<=2);assert.equal(s.events[i].notes[0],n);assert.equal(s.events[i].duration,1);assert.equal(s.events[i].beat,i);assert.equal(s.events[i].hand,'right');});
  assert.equal(s.notes.at(-1).letter,r.letter);assert.equal(s.notes.at(-1).octave,r.octave+1);assert.equal(s.notes.at(-1).alter,r.alter);
  if(f.length===7)assert.equal(new Set(s.notes.slice(0,-1).map(n=>n.letter)).size,7);
  for(const delta of [-1,1]){const next=transposeModeRoot(tonic,delta);assert(MODE_ROOTS.includes(next));assert.equal(mod(pitch(next).midi-r.midi),mod(delta));}
  count++;
 }
 assert.equal(count,660);
});
test('parent mode relations are checked by independent rotation',()=>{
 for(const m of MODES.filter(m=>m.parent)){
  const [id,d]=m.parent,base=parseFormula(modeById(id).formula).map(x=>x.semitones),start=d-1;
  const expected=[...base.slice(start),...base.slice(0,start).map(x=>x+12)].map(x=>x-base[start]);
  assert.deepEqual(parseFormula(m.formula).map(x=>x.semitones),expected,m.name);
 }
});
test('important contrasts are not collapsed into enharmonic or cultural equivalence',()=>{
 assert.deepEqual(modeScore('phrygian-dominant','E').notes.map(n=>asciiName(n)),['E','F','G#','A','B','C','D','E']);
 assert.deepEqual(modeScore('harmonic-minor','A').steps,[2,1,2,2,1,3,1]);
 assert.deepEqual(modeScore('melodic-minor','A').notes.map(n=>asciiName(n)),['A','B','C','D','E','F#','G#','A']);
 assert(modeScore('lydian-sharp2','C#').notes.some(n=>n.alter===2));
 assert(modeScore('ultralocrian','Db').notes.some(n=>n.alter===-2));
 assert(modeScore('altered','C').notes.some(n=>asciiName(n)==='Fb'));
 assert.equal(modeById('major-pentatonic').formula,'1 2 3 5 6');assert.equal(modeById('minor-pentatonic').formula,'1 ♭3 4 5 ♭7');
 assert.match(modeById('hamsadhwani').description,/раги/);assert.match(modeById('phrygian-dominant').description,/нельзя свести/);
});
test('unmetered Bravura rendering plans keep all notes, signs and octaves at every width',()=>{
 for(const m of MODES)for(const tonic of MODE_ROOTS){
  const s=modeScore(m.id,tonic),snapshot=JSON.stringify(s);
  for(const width of [340,900]){
   const p=planModeNotation(s,width),items=p.rows.flatMap(r=>r.items);
   assert.deepEqual(items.map(d=>d.n.midi),s.notes.map(n=>n.midi));assert.deepEqual(items.map(d=>d.index),s.notes.map((_,i)=>i));
   for(const row of p.rows){assert(row.minimum<=p.width+.01);assert(!row.stave.getModifiers().some(m=>['TimeSignature','KeySignature'].includes(m.getCategory())));}
  }
  assert.equal(JSON.stringify(s),snapshot);
 }
 const p=planModeNotation(modeScore('minor-blues','C'),280),signs=p.rows.flatMap(r=>r.items.map(d=>d.sign));assert.deepEqual(signs,[null,'b',null,'b','n','b',null]);
 const c=planModeNotation(modeScore('chromatic','C'),240);assert(c.rows.length>1);
});
test('search supports Russian aliases, ё/е, formula and no-result queries; errors fail explicitly',()=>{
 assert(selectModes('all','фригийская доминанта').some(m=>m.id==='phrygian-dominant'));
 assert(selectModes('world','хирадзеси').some(m=>m.id==='hirajoshi'));
 assert.equal(selectModes('diatonic','').length,7);assert.equal(selectModes('pentatonic','').length,7);
 assert.equal(selectModes('all','ZZ_NOT_HERE').length,0);
 assert.throws(()=>modeScore('missing','C'));assert.throws(()=>modeScore('ionian','injected'));
 assert.throws(()=>parseFormula('1 3 2 5 6'));assert.throws(()=>parseFormula('1 2 3 4 4'));
 const html=readFileSync('site/index.html','utf8'),app=readFileSync('site/app.js','utf8');
 assert.match(html,/data-view="reference"[^]*?<\/button><button data-view="modes"/);
 assert.match(app,/'#modes'/);assert.match(app,/clearModes\(\);clearScores\(\)/);assert.match(app,/signout'\)\{clearModes/);
});
