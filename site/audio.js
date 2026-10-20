/** Small dependency-free, explicitly synthesized piano voice. Scheduling is driven by the score model. */
export class Player {
 constructor(){this.context=null;this.active=[];this.timer=0;this.running=false;this.generation=0;}
 async play(score,{bpm=72,hand='both',loop=false,onChord=()=>{},onStop=()=>{}}={}){
  this.stop();const generation=this.generation;this.context??=new AudioContext();await this.context.resume();if(generation!==this.generation)return;this.running=true;
  const seconds=60/bpm,start=this.context.currentTime+.1,total=score.totalBeats*seconds;
  const master=this.context.createGain();master.gain.value=.3;const limiter=this.context.createDynamicsCompressor();master.connect(limiter);limiter.connect(this.context.destination);this.master=master;
  const schedule=base=>score.events.filter(e=>hand==='both'||hand===e.hand).forEach(e=>e.notes.forEach(n=>this.sound(n.midi,base+e.beat*seconds,e.duration*seconds,e.hand==='left'? .7:1,master)));
  schedule(start);let next=start+total;this.stopCallback=onStop;
  this.timer=setInterval(()=>{if(!this.running)return;const now=this.context.currentTime;if(loop&&now>next-.35){schedule(next);next+=total;}
   if(!loop&&now>start+total+.05){this.stop();return;}
   if(now>=start){const beat=((now-start)%total)/seconds;const bar=score.bars.findLast(b=>b.beat<=beat);if(bar)onChord(bar.index);}
  },40);
 }
 sound(midi,start,duration,velocity,out){
  const c=this.context,amp=c.createGain();amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(.2*velocity,start+.006);amp.gain.exponentialRampToValueAtTime(.065*velocity,start+.12);amp.gain.exponentialRampToValueAtTime(.0001,start+Math.max(.17,duration*.95));amp.connect(out);
  const freq=440*2**((midi-69)/12);[1,2,3,4].forEach((partial,i)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=freq*partial;o.type='sine';g.gain.value=[1,.3,.11,.04][i];o.connect(g);g.connect(amp);o.start(start);o.stop(start+Math.max(.19,duration));this.active.push(o);o.onended=()=>{o.disconnect();g.disconnect();this.active=this.active.filter(n=>n!==o);};});
 }
 stop(){this.generation++;clearInterval(this.timer);this.running=false;for(const o of this.active){try{o.stop();}catch{}}this.active=[];if(this.master){this.master.disconnect();this.master=null;}const callback=this.stopCallback;this.stopCallback=null;callback?.();}
}
