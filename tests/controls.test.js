import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile,KEYS} from '../site/music.js';
import {planEngraving,scoreLabelWidth,SCORE_LABEL_STYLE} from '../site/engraving.js';
import {LOWER_ICON,HIGHER_ICON,VOICING_ICON,VOICING_INTRO,makeVoicingHint} from '../site/score-controls.js';

test('larger in-score labels reserve space without changing musical events',()=>{
 assert.equal(SCORE_LABEL_STYLE.symbolSize,21);assert.equal(SCORE_LABEL_STYLE.nameSize,18);
 assert(SCORE_LABEL_STYLE.topRoom>SCORE_LABEL_STYLE.nameY+40);
 assert(scoreLabelWidth('Cmaj9',18)>scoreLabelWidth('C',18));
 for(const tonic of KEYS.major)for(const pattern of ['chords','arpeggio']){
  for(const progression of [['I','IV','V7','I'],['ii9','V9','Imaj9','Imaj9'],['I','V7/vi',{symbol:'i',mode:'minor',offset:9},{symbol:'V7',mode:'minor',offset:9}]]){
   const score=compile(progression,{tonic,mode:'major',pattern}),original=JSON.stringify(score);
   for(const showBass of [false,true])for(const width of [360,460,1000]){
    const plan=planEngraving(score,width,{showBass});
    assert.deepEqual(plan.rows.flatMap(r=>r.measures.map(m=>m.bar)),score.bars);
    assert(plan.rows.every(r=>r.treble>=SCORE_LABEL_STYLE.topRoom));
    for(const row of plan.rows)for(const m of row.measures)assert(m.width>=m.minimum-.01);
   }
   assert.equal(JSON.stringify(score),original);
  }
 }
});
test('bass and voicing icons keep stable accessible names and real buttons',()=>{
 const app=readFileSync('site/app.js','utf8'),css=readFileSync('site/paper.css','utf8');
 assert.match(app,/CLEF_PATHS\.bass/);assert.match(app,/bass-control-icon/);
 assert.match(app,/\$\{VOICING_ICON\}<\/button>/);assert(!app.includes('>с обращениями</button>'));
 assert.match(app,/aria-label="Басовая строка"/);assert.match(app,/aria-label="С обращениями правой руки"/);
 assert(!app.includes("b.setAttribute('aria-label',bassButtonLabel"));
 assert(!app.includes("b.setAttribute('aria-label',voicingButtonLabel"));
 assert.match(css,/height: 44px; min-height: 44px; max-height: 44px/);
 assert.match(css,/:focus-visible/);
 assert.equal((VOICING_ICON.match(/class="voice-head"/g)||[]).length,6);
 assert.match(VOICING_ICON,/voice-connections/);assert.notEqual(LOWER_ICON,HIGHER_ICON);
 for(const icon of [LOWER_ICON,HIGHER_ICON,VOICING_ICON]){assert.match(icon,/aria-hidden="true"/);assert(!/\bid=|<text|<script/.test(icon));}
 const modes=readFileSync('site/modes.js','utf8');
 for(const source of [app,modes]){assert.match(source,/\$\{LOWER_ICON\}/);assert.match(source,/\$\{HIGHER_ICON\}/);}
});
test('touch explanation is once per browser; optional storage never breaks the controls',()=>{
 const memory=new Map(),messages=[];
 const env={matchMedia:()=>({matches:true}),localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)}};
 const hint=makeVoicingHint(env);hint(t=>messages.push(t));hint(t=>messages.push(t));
 makeVoicingHint(env)(t=>messages.push(t));assert.deepEqual(messages,[VOICING_INTRO]);
 const blocked=makeVoicingHint({matchMedia:()=>({matches:true}),get localStorage(){throw Error('private mode');}});
 blocked(t=>messages.push(t));blocked(t=>messages.push(t));assert.equal(messages.length,2);
 makeVoicingHint({matchMedia:()=>({matches:false})})(()=>assert.fail('not on desktop'));
 makeVoicingHint({})(()=>assert.fail('not in a browser'));
});
