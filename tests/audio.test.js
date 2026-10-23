import test from 'node:test';
import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import {PIANO_ANCHORS, Player, pianoSampleFor} from '../site/audio.js';

test('nearest real-piano samples preserve exact chromatic tuning',()=>{
 assert.deepEqual(PIANO_ANCHORS[0],[21,'A0']);
 assert.deepEqual(PIANO_ANCHORS.at(-1),[96,'C7']);
 assert.deepEqual(pianoSampleFor(60,.9),{midi:60,name:'C4',layer:'forte',rate:1,key:'forte/C4'});
 assert.equal(pianoSampleFor(61,.7).key,'soft/C4');
 assert.ok(Math.abs(pianoSampleFor(61).rate-2**(1/12))<1e-12);
 assert.equal(pianoSampleFor(62).key,'forte/Ds4');
 assert.ok(Math.abs(pianoSampleFor(62).rate-2**(-1/12))<1e-12);
 assert.throws(()=>pianoSampleFor(20),/диапазона/);
});

test('all advertised piano recordings exist locally for both velocity layers',async()=>{
 for(const layer of ['soft','forte'])for(const [,name] of PIANO_ANCHORS){
  const file=new URL('../site/samples/grand/'+layer+'/'+name+'.mp3',import.meta.url);
  assert.ok((await stat(file)).size>1024,file.href);
 }
});

function mockAudio(){
 const requests=[],sources=[];
 class Param {
  constructor(){this.value=0;}
  setValueAtTime(value){this.value=value;}
  linearRampToValueAtTime(value){this.value=value;}
  setTargetAtTime(value){this.value=value;}
 }
 class Node {
  connect(){return this;}
  disconnect(){}
 }
 class Gain extends Node {constructor(){super();this.gain=new Param();}}
 class Limiter extends Node {constructor(){super();for(const key of ['threshold','knee','ratio','attack','release'])this[key]=new Param();}}
 class Source extends Node {
  constructor(){super();this.playbackRate=new Param();sources.push(this);}
  start(time){this.started=time;}
  stop(time){this.stopped=time;}
 }
 class Context {
  constructor(){this.currentTime=2;this.destination=new Node();}
  async resume(){}
  createGain(){return new Gain();}
  createDynamicsCompressor(){return new Limiter();}
  createBufferSource(){return new Source();}
  async decodeAudioData(bytes){return {decoded:bytes.byteLength};}
 }
 return {Context,requests,sources,fetch:async url=>{
  requests.push(String(url));
  return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
 }};
}

test('card playback schedules sample buffers, retains tempo and reuses decoded samples',async()=>{
 const oldContext=globalThis.AudioContext,oldFetch=globalThis.fetch;
 const mock=mockAudio();
 globalThis.AudioContext=mock.Context;globalThis.fetch=mock.fetch;
 const score={totalBeats:4,bars:[{beat:0,index:0}],events:[
  {hand:'right',beat:0,duration:2,index:0,notes:[{midi:60}]},
  {hand:'right',beat:2,duration:2,index:0,notes:[{midi:62}]},
  {hand:'left',beat:0,duration:4,index:0,notes:[{midi:48}]}
 ]};
 const player=new Player();let stops=0;
 try{
  await player.play(score,{bpm:90,onStop:()=>stops++});
  assert.equal(player.running,true);
  assert.equal(mock.sources.length,3);
  assert.deepEqual(mock.requests.map(url=>url.split('/').slice(-2).join('/')).sort(),
   ['forte/C4.mp3','forte/Ds4.mp3','soft/C3.mp3']);
  assert.ok(Math.abs(mock.sources[0].started-(2+.075))<1e-9);
  assert.ok(Math.abs(mock.sources[1].started-(2+.075+2*60/90))<1e-9);
  assert.ok(Math.abs(mock.sources[1].playbackRate.value-2**(-1/12))<1e-12);
  player.stop();player.stop();assert.equal(stops,1);
  await player.play(score,{bpm:90});
  assert.equal(mock.requests.length,3,'decoded samples should be cached');
 }finally{
  player.stop();globalThis.AudioContext=oldContext;globalThis.fetch=oldFetch;
 }
});

test('stopping while samples load cannot start stale playback',async()=>{
 const oldContext=globalThis.AudioContext,oldFetch=globalThis.fetch;
 const mock=mockAudio();let release;
 globalThis.AudioContext=mock.Context;
 globalThis.fetch=async url=>{mock.requests.push(String(url));await new Promise(resolve=>release=resolve);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};};
 const player=new Player();
 try{
  const pending=player.play({totalBeats:4,bars:[],events:[
   {hand:'right',beat:0,duration:4,index:0,notes:[{midi:60}]}
  ]});
  for(let i=0;i<10&&!release;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof release,'function');
  player.stop();release();await pending;
  assert.equal(player.running,false);
  assert.equal(mock.sources.length,0);
 }finally{
  player.stop();globalThis.AudioContext=oldContext;globalThis.fetch=oldFetch;
 }
});
