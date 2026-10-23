/**
 * Real Yamaha C5 recordings from Salamander Grand Piano V3 (Alexander Holm,
 * CC BY 3.0). Samples are bundled with the site and decoded only as needed.
 * Score timing, pitch spelling and MIDI export remain in music.js.
 */
export const PIANO_ANCHORS = Object.freeze([
 [21,'A0'],[24,'C1'],[27,'Ds1'],[30,'Fs1'],[33,'A1'],[36,'C2'],
 [39,'Ds2'],[42,'Fs2'],[45,'A2'],[48,'C3'],[51,'Ds3'],[54,'Fs3'],
 [57,'A3'],[60,'C4'],[63,'Ds4'],[66,'Fs4'],[69,'A4'],[72,'C5'],
 [75,'Ds5'],[78,'Fs5'],[81,'A5'],[84,'C6'],[87,'Ds6'],[90,'Fs6'],
 [93,'A6'],[96,'C7']
]);

const MAX_CACHED_SAMPLES=36;
const RELEASE_SECONDS=.65;

export function pianoSampleFor(midi,velocity=.85){
 if(!Number.isInteger(midi)||midi<21||midi>108)throw new Error('Нота вне диапазона рояля.');
 let nearest=PIANO_ANCHORS[0];
 for(const entry of PIANO_ANCHORS){
  if(Math.abs(entry[0]-midi)<Math.abs(nearest[0]-midi))nearest=entry;
 }
 const layer=velocity>=.8?'forte':'soft';
 return {midi:nearest[0],name:nearest[1],layer,rate:2**((midi-nearest[0])/12),key:layer+'/'+nearest[1]};
}

function noteVelocity(event){
 // A little metrical phrasing without moving any note off its exact beat.
 const phrase=event.index%4===0?1:event.index%4===2?.96:.93;
 return (event.hand==='left'?.70:.90)*phrase;
}

export class Player {
 constructor(){
  this.context=null;this.active=new Set();this.cache=new Map();
  this.timer=0;this.running=false;this.generation=0;
  this.master=null;this.limiter=null;this.stopCallback=null;
 }

 async loadSample(reference){
  const key=reference.key,existing=this.cache.get(key);
  if(existing){this.cache.delete(key);this.cache.set(key,existing);return existing;}
  const url=new URL('./samples/grand/'+key+'.mp3',import.meta.url);
  const task=(async()=>{
   const response=await fetch(url);
   if(!response.ok)throw new Error('Не удалось загрузить запись рояля ('+response.status+').');
   return this.context.decodeAudioData(await response.arrayBuffer());
  })();
  this.cache.set(key,task);
  try{
   const buffer=await task;
   // Keep the most recently used decoded notes, not the entire piano in RAM.
   if(this.cache.get(key)===task){
    this.cache.delete(key);this.cache.set(key,Promise.resolve(buffer));
    while(this.cache.size>MAX_CACHED_SAMPLES)this.cache.delete(this.cache.keys().next().value);
   }
   return buffer;
  }catch(error){
   if(this.cache.get(key)===task)this.cache.delete(key);
   throw error;
  }
 }

 async play(score,{bpm=72,hand='both',loop=false,onChord=()=>{},onStop=()=>{}}={}){
  this.stop();const generation=this.generation;
  this.context??=new AudioContext();
  // Resume inside the user's click (important for iOS) before fetching audio.
  await this.context.resume();
  if(generation!==this.generation)return;

  const voices=score.events.filter(e=>hand==='both'||hand===e.hand).flatMap(event=>
   event.notes.map(note=>{
    const velocity=noteVelocity(event);
    return {event,midi:note.midi,velocity,reference:pianoSampleFor(note.midi,velocity)};
   })
  );
  const required=new Map(voices.map(voice=>[voice.reference.key,voice.reference]));
  const buffers=new Map(await Promise.all([...required].map(async([key,reference])=>
   [key,await this.loadSample(reference)])));
  if(generation!==this.generation)return;

  const c=this.context,seconds=60/bpm,start=c.currentTime+.075,total=score.totalBeats*seconds;
  const master=c.createGain(),limiter=c.createDynamicsCompressor();
  master.gain.value=.8;
  limiter.threshold.value=-14;limiter.knee.value=18;limiter.ratio.value=2.5;
  limiter.attack.value=.004;limiter.release.value=.2;
  master.connect(limiter);limiter.connect(c.destination);
  this.master=master;this.limiter=limiter;
  const schedule=base=>voices.forEach(voice=>{
   const {event,midi,velocity,reference}=voice;
   this.sound(midi,base+event.beat*seconds,event.duration*seconds,
    velocity,reference,buffers.get(reference.key),master);
  });
  schedule(start);
  this.running=true;this.stopCallback=onStop;
  let next=start+total;
  this.timer=setInterval(()=>{
   if(!this.running)return;
   const now=c.currentTime;
   if(loop&&now>next-.35){schedule(next);next+=total;}
   if(!loop&&now>start+total+RELEASE_SECONDS){this.stop();return;}
   if(now>=start){
    const beat=((now-start)%total)/seconds;
    const bar=score.bars.findLast(b=>b.beat<=beat);
    if(bar)onChord(bar.index);
   }
  },40);
 }

 sound(midi,start,duration,velocity,reference,buffer,out){
  const c=this.context,source=c.createBufferSource(),amp=c.createGain();
  source.buffer=buffer;source.playbackRate.value=reference.rate;
  // Soft and forte recordings have different native loudness: level-match them
  // while keeping their distinct hammer colour and dynamic response.
  const level=(reference.layer==='forte'?.28:.5)*velocity;
  const release=start+Math.max(.08,duration*.92);
  amp.gain.setValueAtTime(0,start);
  amp.gain.linearRampToValueAtTime(level,start+.004);
  amp.gain.setValueAtTime(level,release);
  amp.gain.setTargetAtTime(.00001,release,.115);
  source.connect(amp);amp.connect(out);
  source.start(start);
  source.stop(release+RELEASE_SECONDS);
  this.active.add(source);
  source.onended=()=>{
   source.disconnect();amp.disconnect();this.active.delete(source);
  };
 }

 stop(){
  this.generation++;clearInterval(this.timer);this.timer=0;this.running=false;
  for(const source of this.active){try{source.stop();}catch{}}
  this.active.clear();
  this.master?.disconnect();this.limiter?.disconnect();
  this.master=null;this.limiter=null;
  const callback=this.stopCallback;this.stopCallback=null;callback?.();
 }
}
