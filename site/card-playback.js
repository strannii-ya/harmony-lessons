import { Player } from './audio.js';
/** One transport for all score cards. Fixed tempo; never opens a floating panel. */
export const CARD_TEMPO=90;
export const playIcon=playing=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${playing?'M6 6h12v12H6z':'M8 5v14l11-7z'}" fill="currentColor"/></svg>`;
export function setPlayButton(button,playing,label){
 if(!button)return;
 button.innerHTML=playIcon(playing);
 button.setAttribute('aria-pressed',String(playing));
 button.setAttribute('aria-label',(playing?'Остановить: ':'Воспроизвести: ')+label);
 button.title=playing?'Остановить':'Воспроизвести';
}
export class CardPlayback {
 constructor(engine=new Player()){this.engine=engine;this.active=null;}
 isPlaying(key){return this.active?.key===key;}
 stop(){
  const previous=this.active;this.active=null;
  this.engine.stop();
  if(previous){setPlayButton(previous.button,false,previous.label);previous.clear?.();}
 }
 async toggle(options){
  if(this.isPlaying(options.key)){this.stop();return;}
  return this.start(options);
 }
 async start({key,score,button,label,onChord=()=>{},clear=()=>{}}){
  this.stop();
  const current={key,button,label,clear};this.active=current;
  setPlayButton(button,true,label);
  try{
   await this.engine.play(score,{bpm:CARD_TEMPO,hand:'both',loop:false,
    onChord:index=>{if(this.active===current)onChord(index);},
    onStop:()=>{
     if(this.active!==current)return;
     this.active=null;setPlayButton(button,false,label);clear();
    }});
  }catch(error){
   // A stale failure must not stop or reset a newer card.
   if(this.active!==current)return;
   this.stop();throw error;
  }
 }
}
export const cardPlayback=new CardPlayback();
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',()=>cardPlayback.stop());
 window.addEventListener('beforeprint',()=>cardPlayback.stop());
}
