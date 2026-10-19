/** Unmetered ascending scales. The existing VexFlow/Bravura bundle is reused, not a text font. */
import { VF } from './vexflow.js';
import { vexKey } from './engraving.js';
import { asciiName } from './music.js';
import { staffY } from './score-layout.js';
import { rootLabel, solfegeName } from './mode-model.js';
const INK='#332f28',NS='http://www.w3.org/2000/svg',SIGNS={'-2':'bb','-1':'b',0:'n',1:'#',2:'##'};
function descriptors(score){
 const state=new Map();
 return score.notes.map((n,index)=>{
  const key=n.letter+':'+n.octave,old=state.get(key)||0;
  const sign=n.alter!==0||old!==n.alter?SIGNS[n.alter]:null;
  state.set(key,n.alter);return {n,index,sign};
 });
}
function prepare(items,width){
 const stave=new VF.Stave(14,40,width-28).addClef('treble');
 stave.setBegBarType(VF.Barline.type.NONE).setEndBarType(VF.Barline.type.NONE);
 const notes=items.map(item=>{const note=new VF.StaveNote({clef:'treble',keys:[vexKey(item.n)],duration:'q',auto_stem:true});if(item.sign)note.addModifier(new VF.Accidental(item.sign),0);note.setStave(stave);return note;});
 const voice=new VF.Voice({num_beats:notes.length,beat_value:4}).addTickables(notes);
 const formatter=new VF.Formatter().joinVoices([voice]);
 const prefix=stave.getNoteStartX()-stave.getX()+10;
 const minimum=28+prefix+Math.max(formatter.preCalculateMinTotalWidth([voice])+22,items.length*26);
 return {items,notes,voice,formatter,stave,minimum};
}
export function planModeNotation(score,width){
 if(!score?.notes?.length||!Number.isFinite(width)||width<=0)throw new Error('Неверный нотный пример');
 const items=descriptors(score),rows=[];width=Math.max(220,width);
 for(let start=0;start<items.length;){
  let count=items.length-start,row=prepare(items.slice(start),width);
  while(count>1&&row.minimum>width){count--;row=prepare(items.slice(start,start+count),width);}
  rows.push(row);start+=count;
 }
 return {rows,width:Math.max(width,...rows.map(r=>r.minimum))};
}
let records=new Map(),observer,pending=new Set(),frame=0;
function paint(root,score,forcedWidth){
 const actual=root.clientWidth||600,scale=.75,plan=planModeNotation(score,(forcedWidth||actual)/scale);
 const mount=document.createElement('div'),renderer=new VF.Renderer(mount,VF.Renderer.Backends.SVG);renderer.resize(plan.width,1000);
 const ctx=renderer.getContext();ctx.setFillStyle(INK);ctx.setStrokeStyle(INK);
 const svg=mount.querySelector('svg');svg.setAttribute('class','score-document mode-document');svg.setAttribute('role','img');
 svg.setAttribute('data-renderer','vexflow-bravura');svg.setAttribute('data-mode-id',score.id);svg.setAttribute('data-tonic',score.tonic);
 svg.setAttribute('aria-label',`${rootLabel(score.tonic)} — ${score.modeName}. Восходящий звукоряд: ${score.notes.map(solfegeName).join(', ')}.`);
 const title=document.createElementNS(NS,'title');title.textContent=rootLabel(score.tonic)+' — '+score.modeName;svg.prepend(title);
 let cursor=6;
 for(const [ri,row] of plan.rows.entries()){
  const ys=row.items.map(d=>staffY(d.n)),top=Math.max(38,35-Math.min(...ys)),height=top+Math.max(76,Math.max(...ys)+40);
  const group=ctx.openGroup('scale-system');group.setAttribute('data-scale-system',ri);group.setAttribute('transform',`translate(0 ${cursor})`);
  const {stave,voice,notes,formatter}=row;stave.setWidth(plan.width-28).setY(top-40).setContext(ctx).setStyle({strokeStyle:INK,fillStyle:INK,lineWidth:1});
  stave.setDefaultLedgerLineStyle({strokeStyle:INK,lineWidth:1.25});stave.setNoteStartX(stave.getNoteStartX()+10);
  notes.forEach(n=>n.setStave(stave));formatter.format([voice],stave.getNoteEndX()-stave.getNoteStartX()-14);
  stave.draw();voice.draw(ctx,stave);
  notes.forEach((note,i)=>{
   const head=note.noteHeads[0],path=group.querySelector('#'+CSS.escape('vf-'+head.getAttribute('id'))+' > path');
   if(!path)throw new Error('Не удалось отрисовать ноту');
   const {n,index}=row.items[i];path.setAttribute('class','scale-pitch');path.setAttribute('data-scale-note-index',index);path.setAttribute('data-note',asciiName(n)+'/'+n.octave);path.setAttribute('data-midi',n.midi);path.setAttribute('data-degree',n.degree);path.setAttribute('data-duration','1');
  });
  ctx.closeGroup();cursor+=height+10;
 }
 svg.setAttribute('viewBox',`0 0 ${plan.width} ${cursor}`);svg.setAttribute('width','100%');svg.removeAttribute('height');svg.removeAttribute('style');
 root.replaceChildren(svg);records.set(root,{score,width:actual});
}
export function renderModeScore(root,score){
 paint(root,score);
 if(typeof ResizeObserver!=='undefined'){
  observer??=new ResizeObserver(entries=>{
   for(const {target} of entries){const r=records.get(target);if(r&&target.clientWidth>0&&Math.abs(target.clientWidth-r.width)>1)pending.add(target);}
   if(pending.size&&!frame)frame=requestAnimationFrame(()=>{frame=0;const batch=[...pending];pending.clear();for(const root of batch){const r=records.get(root);if(r&&root.isConnected&&root.clientWidth>0)paint(root,r.score);}});
  });observer.observe(root);
 }
}
export function clearModeScores(){observer?.disconnect();if(frame)cancelAnimationFrame(frame);frame=0;pending.clear();records.clear();}
if(typeof window!=='undefined'){
 window.addEventListener('beforeprint',()=>{for(const [root,r] of records)paint(root,r.score,740);});
 window.addEventListener('afterprint',()=>{for(const [root,r] of records)paint(root,r.score);});
}
