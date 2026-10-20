/** Adapter only: the score's spelled pitches, rhythms and audio events are never rewritten. */
import { VF } from './vexflow.js';
import { asciiName, keyPitches } from './music.js';
import { staffY, sameKey } from './score-layout.js';
const DURATIONS=new Map([[4,'w'],[3,'h'],[2,'h'],[1,'q'],[.5,'8']]);
const SIGNS=new Map([[-2,'bb'],[-1,'b'],[0,'n'],[1,'#'],[2,'##']]);
/** Shared by the planner and renderer so larger labels reserve real horizontal and vertical room. */
export const SCORE_LABEL_STYLE=Object.freeze({symbolSize:21,nameSize:18,symbolY:36,nameY:62,topRoom:106});
let labelContext;
export function scoreLabelWidth(value,size,weight=400){
 const text=String(value??'');
 if(!text)return 0;
 try{
  if(!labelContext&&typeof document!=='undefined'&&typeof document.createElement==='function')labelContext=document.createElement('canvas').getContext('2d');
  if(labelContext){labelContext.font=`${weight} ${size}px Georgia, serif`;const width=labelContext.measureText(text).width;if(Number.isFinite(width)&&width>0)return width;}
 }catch{/* Non-browser model tests use the conservative estimate below. */}
 return [...text].reduce((sum,c)=>sum+(/[MWmw@♯♭]/.test(c)?1:/[Iil1 .,'/]/.test(c)?.42:.78)*size,0);
}
export function vexKey(n){
 if(!Number.isInteger(n.letter)||n.letter<0||n.letter>6||!Number.isInteger(n.octave)||!SIGNS.has(n.alter))throw new Error('Неверное нотное написание');
 return asciiName(n).toLowerCase()+'/'+n.octave;
}
export const keyName=b=>b.tonic+(b.mode==='minor'?'m':'');
export function makeVoice(events,bar,clef){
 const state=new Map(),signature=new Map(keyPitches(bar.tonic,bar.mode).map(n=>[n.letter,n.alter]));
 const notes=events.map(event=>{
  const duration=DURATIONS.get(event.duration);
  if(!duration||!event.notes?.length)throw new Error('Неподдерживаемая длительность или пустой аккорд');
  const note=new VF.StaveNote({keys:event.notes.map(vexKey),duration,clef,auto_stem:true,dots:event.duration===3?1:0});
  if(event.duration===3)VF.Dot.buildAndAttach([note],{all:true});
  // Validity is per written pitch and octave and resets at each bar line.
  // VexFlow determines the signs' engraved form, columns and optical spacing.
  event.notes.forEach((n,i)=>{
   const id=n.letter+':'+n.octave,previous=state.has(id)?state.get(id):signature.get(n.letter);
   if(n.alter!==previous){note.addModifier(new VF.Accidental(SIGNS.get(n.alter)),i);state.set(id,n.alter);}
  });
  return note;
 });
 const voice=new VF.Voice({num_beats:bar.beats,beat_value:4}).addTickables(notes);
 const beams=notes.length>1?VF.Beam.generateBeams(notes,{groups:[new VF.Fraction(bar.beats===3?1:2,4)]}):[];
 return {voice,notes,beams,events,clef};
}
export function prepareMeasure(bar,{first=false,previous=null,showBass=false,showMeter=false,showLabels=true,compact=false}={}){
 const right=makeVoice(bar.rh,bar,'treble'),left=showBass?makeVoice([bar.left],bar,'bass'):null;
 const changed=previous&&!sameKey(previous,bar);
 const staves=[new VF.Stave(0,0,300),...(left?[new VF.Stave(0,130,300)]:[])];
 staves.forEach((stave,i)=>{
  stave.setBegBarType(VF.Barline.type.NONE);
  // Set pitch interpretation without drawing a repeated clef on continuation bars.
  stave.clef=i?'bass':'treble';
  if(first)stave.addClef(i?'bass':'treble');
  if(first||changed)stave.addKeySignature(keyName(bar),changed?keyName(previous):undefined);
  if(showMeter)stave.addTimeSignature(`${bar.meter||bar.beats}/4`);
 });
 right.notes.forEach(n=>n.setStave(staves[0]));left?.notes.forEach(n=>n.setStave(staves[1]));
 const voices=[right.voice,...(left?[left.voice]:[])],formatter=new VF.Formatter();
 formatter.joinVoices([right.voice]);if(left)formatter.joinVoices([left.voice]);
 const minNotes=formatter.preCalculateMinTotalWidth(voices);
 const prefix=Math.max(...staves.map(s=>s.getNoteStartX()))+8;
 const labelWidth=showLabels?Math.max(scoreLabelWidth(bar.symbol,SCORE_LABEL_STYLE.symbolSize,600),scoreLabelWidth(bar.name,SCORE_LABEL_STYLE.nameSize))+48:0;
 const musicWidth=Math.max(minNotes+24,bar.rh.length>1?bar.rh.length*26:52,labelWidth);
 // On portrait phones the labels can use the space ABOVE the clef/signature.
 // Reserve their own width, rather than adding it after the entire staff prefix.
 // Never reduce VexFlow's minimum glyph/accidental spacing to fit a row.
 const compactLabel=showLabels?Math.max(scoreLabelWidth(bar.symbol,SCORE_LABEL_STYLE.symbolSize,600),scoreLabelWidth(bar.name,SCORE_LABEL_STYLE.nameSize))+20:0;
 const compactMusic=prefix+Math.max(minNotes+18,bar.rh.length>1?bar.rh.length*24:42)+10;
 const minimum=compact?Math.max(compactMusic,compactLabel):prefix+musicWidth+14;
 return {bar,right,left,voices,staves,formatter,prefix,minimum,first,changed,compact};
}
/** Every measure is visible. Reflow breaks systems at bar lines, never pages chords. */
export function planEngraving(score,width,options={}){
 if(!score?.bars?.length||!Number.isFinite(width))throw new Error('Неверная партитура');
 width=Math.max(240,width);
 const showBass=options.showBass===true&&score.bars.every(b=>b.left?.notes?.length);
 const meter=options.showMeter!==false&&!score.noMeter&&score.bars.every(b=>b.beats===(score.bars[0].meter||score.bars[0].beats))&&[3,4].includes(score.bars[0].meter||score.bars[0].beats);
 const rows=[];let row={measures:[],used:0};
 for(let i=0;i<score.bars.length;i++){
  const bar=score.bars[i],previous=score.bars[i-1]||null;
  const make=first=>prepareMeasure(bar,{first,previous,showBass,showMeter:meter&&i===0,showLabels:options.showLabels!==false,compact:options.compact===true});
  let m=make(row.measures.length===0);
  if(row.measures.length&&(row.used+m.minimum>width-32 || row.measures.length>=(options.barsPerSystem||Infinity))){rows.push(row);row={measures:[],used:0};m=make(true);}
  row.measures.push(m);row.used+=m.minimum;
 }
 if(row.measures.length)rows.push(row);
 width=Math.max(width,...rows.map(r=>r.used+32));
 for(const [ri,r] of rows.entries()){
  const factor=ri<rows.length-1||r.measures.length>=3?(width-32)/r.used:Math.min((width-32)/r.used,1.35);
  let x=16;r.measures.forEach(m=>{m.x=x;m.width=m.minimum*factor;x+=m.width;});r.end=x;
  const right=r.measures.flatMap(m=>m.bar.rh.flatMap(e=>e.notes.map(n=>staffY(n))));
  const labelRoom=options.showLabels===false?32:SCORE_LABEL_STYLE.topRoom;
  r.treble=Math.max(labelRoom,labelRoom-Math.min(...right));
  if(showBass){
   const left=r.measures.flatMap(m=>m.bar.left.notes.map(n=>staffY(n,true)));
   r.bass=r.treble+Math.max(110,Math.max(...right)-Math.min(...left)+75);
   r.bottom=r.bass+Math.max(65,Math.max(...left)+42);
  }else{r.bass=null;r.bottom=r.treble+Math.max(65,Math.max(...right)+42);}
 }
 return {rows,width,showBass,meter};
}
