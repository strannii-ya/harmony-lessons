import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CardPlayback,CARD_TEMPO} from '../site/card-playback.js';
import {Player} from '../site/audio.js';
const button=()=>({innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
class FakePlayer {
 constructor(){this.calls=[];this.running=false;}
 stop(){this.running=false;const cb=this.cb;this.cb=null;cb?.();}
 async play(score,options){this.stop();this.calls.push({score,options});this.cb=options.onStop;this.running=true;}
}
const options=(key,extra={})=>({key,score:{events:[],bars:[],totalBeats:1},button:button(),label:key,...extra});
test('one card at a time; play/stop/natural completion use the same fixed 90 BPM transport',async()=>{
 const engine=new FakePlayer(),p=new CardPlayback(engine),a=options('a'),b=options('b');
 assert.equal(CARD_TEMPO,90);
 await p.toggle(a);assert(p.isPlaying('a'));assert.equal(a.button.attrs['aria-pressed'],'true');
 await p.toggle(b);assert(!p.isPlaying('a'));assert.equal(a.button.attrs['aria-pressed'],'false');assert(p.isPlaying('b'));
 await p.toggle(b);assert.equal(p.active,null);assert.equal(b.button.attrs['aria-pressed'],'false');
 await p.start(a);engine.stop();assert.equal(p.active,null);assert.equal(a.button.attrs['aria-pressed'],'false');
 for(const {options:o} of engine.calls){assert.equal(o.bpm,90);assert.equal(o.loop,false);assert.equal(o.hand,'both');}
});
test('a late error from a stopped start cannot stop a newer card',async()=>{
 const engine=new FakePlayer();let reject;
 engine.play=()=>new Promise((_,no)=>{reject=no;});
 const p=new CardPlayback(engine),a=options('a'),b=options('b');
 const pending=p.start(a);const fail=reject;
 engine.play=FakePlayer.prototype.play;
 await p.start(b);fail(new Error('old request'));await pending;
 assert(p.isPlaying('b'));assert.equal(b.button.attrs['aria-pressed'],'true');
 p.stop();
});
test('audio resume cannot revive playback after immediate stop',async()=>{
 const old=globalThis.AudioContext;let resume;
 globalThis.AudioContext=class{resume(){return new Promise(r=>resume=r);}};
 try{
  const p=new Player(),pending=p.play({events:[],bars:[],totalBeats:1});
  p.stop();resume();await pending;
  assert.equal(p.running,false);assert.equal(p.active.length,0);
 }finally{globalThis.AudioContext=old;}
});
test('transport failures reset the card and propagate a readable error',async()=>{
 const engine=new FakePlayer();engine.play=async()=>{throw new Error('blocked');};
 const p=new CardPlayback(engine),a=options('a');
 await assert.rejects(()=>p.start(a),/blocked/);
 assert.equal(p.active,null);assert.equal(a.button.attrs['aria-pressed'],'false');
});
test('no floating transport or sequence key select; voicings are on by default only in sequence UI',()=>{
 const html=readFileSync('site/index.html','utf8'),app=readFileSync('site/app.js','utf8');
 assert(!/id="(?:player|tempo|loop|hand|lesson-count)"/.test(html));
 assert(!/\$\('#(?:player|tempo|hand|play-toggle)'\)/.test(app));
 assert.match(app,/inversions:true/);assert.match(app,/class="key-name" data-key=/);
 assert(!/<select[^>]+data-key=/.test(app));assert(!app.includes('<small>Упражнений:'));
 assert.match(readFileSync('site/chord-guide.js','utf8'),/data-chord-play/);
 assert.match(readFileSync('site/modes.js','utf8'),/cardPlayback.toggle/);
});
