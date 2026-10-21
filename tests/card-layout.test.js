import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile,KEYS} from '../site/music.js';
import {planEngraving} from '../site/engraving.js';

test('portrait block chords use five measures in every standard key without changing music',()=>{
 for(const mode of ['major','minor'])for(const tonic of KEYS[mode])for(const actual of [276,331,346,386])for(const showBass of [false,true]){
  const progression=mode==='major'?['I','IV','V7','I','vi','ii7','V7','I']:['i','iv','V7','i','VI','iiø7','V7','i'];
  const score=compile(progression,{tonic,mode}),before=JSON.stringify(score),options={showBass,compact:true,barsPerSystem:5};
  const needed=Math.ceil(Math.max(...planEngraving(score,10000,options).rows.map(r=>r.used+32)))+1;
  const plan=planEngraving(score,Math.max(actual/.75,Math.min(needed,actual/.49)),options);
  if(needed<=actual/.49+.01)assert.deepEqual(plan.rows.map(r=>r.measures.length),[5,3],mode+' '+tonic+' '+actual);
  else assert(plan.rows.every(r=>r.measures.length<=5));
  if(actual>=331)assert.deepEqual(plan.rows.map(r=>r.measures.length),[5,3]);
  assert.deepEqual(plan.rows.flatMap(r=>r.measures.map(m=>m.bar)),score.bars);
  assert.equal(JSON.stringify(score),before);
  for(const row of plan.rows)for(const m of row.measures)assert(m.width>=m.minimum-.01);
 }
});
test('dense arpeggios reflow without squeezing glyphs or dropping bars',()=>{
 const score=compile(['I','IV','V7','I','vi','ii7','V7','I'],{tonic:'F#',mode:'major',pattern:'arpeggio'});
 const p=planEngraving(score,331/.75,{compact:true,barsPerSystem:5,showBass:true});
 assert.deepEqual(p.rows.flatMap(r=>r.measures.map(m=>m.bar.index)),score.bars.map(b=>b.index));
 for(const row of p.rows){assert(row.measures.length<=5);for(const m of row.measures)assert(m.width>=m.minimum-.01);}
});
test('card footer, header favorite and text-only navigation are structural, not hidden duplicates',()=>{
 const app=readFileSync('site/app.js','utf8'),html=readFileSync('site/index.html','utf8');
 assert.match(app,/favorite-control/);assert.match(app,/card-footer exercise-footer/);
 assert(app.indexOf('data-star=')<app.indexOf('class="exercise-actions"'));
 assert(!app.includes('card-arrow'));assert(!html.includes('id="focus"'));
 assert(!html.includes('<span>Аккаунт</span>'));assert.match(html,/id="signout" type="button">Выйти/);
 assert(!/data-view="[a-z]+"[^>]*>[♮♬♫☆♧▦]/.test(html));
 assert.match(readFileSync('site/modes.js','utf8'),/card-footer mode-footer/);
 assert.match(readFileSync('site/chord-guide.js','utf8'),/card-footer guide-footer/);
});
