import { keyLabel } from './key-labels.js';
/** VexFlow + Bravura. One complete SVG per exercise; score data remains the audio source. */
import { VF } from './vexflow.js';
import { planEngraving, SCORE_LABEL_STYLE, scoreLabelWidth } from './engraving.js';
import { noteName } from './music.js';
const NS='http://www.w3.org/2000/svg',INK='#332f28',STAFF_INK='#8c857a';
function node(tag,attrs={},value){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(value!==undefined)n.textContent=value;return n;}
function label(parent,x,y,value,size=13,extra={}){parent.append(node('text',{x,y,fill:INK,'font-family':'Georgia, serif','font-size':size,...extra},value));}
function annotateHand(group,model){
 model.notes.forEach((note,i)=>{
  const event=model.events[i];
  note.noteHeads.forEach((head,j)=>{
   const headGroup=group.querySelector('#'+CSS.escape('vf-'+head.getAttribute('id')));
   const el=headGroup?.querySelector(':scope > path');if(!el)throw new Error('Головка ноты не отрисована');
   const n=event.notes[j];
   el.setAttribute('data-midi',n.midi);el.setAttribute('data-note',noteName(n)+n.octave);
   el.setAttribute('data-duration',event.duration);el.setAttribute('data-hollow',event.duration>=2);
   el.setAttribute('data-beat',event.beat);el.setAttribute('data-onset-x',note.getAbsoluteX());el.setAttribute('data-note-x',head.getAbsoluteX());
   el.setAttribute('data-note-y',head.getY());el.setAttribute('data-glyph',head.glyph_code);
  });
 });
}
let records=new WeakMap();const roots=new Set(),pending=new Set();let observer,frame=0;
function paint(container,score,forcedWidth,options={}){
 const actual=container.clientWidth||800,scale=options.scale??.75;
 if(!Number.isFinite(scale)||scale<=0)throw new Error('Неверный масштаб нот');
 const portrait=!forcedWidth&&options.showLabels!==false&&typeof matchMedia==='function'&&matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
 const layoutOptions=portrait?{...options,compact:true,barsPerSystem:4}:options;
 let layoutWidth=(forcedWidth||actual)/scale;
 if(portrait&&score.bars.every(b=>b.rh.length===1)){
  // Four block-chord measures form a complete phrase on phones. Use tighter
  // spacing first; allow only a modest scale change for dense key signatures.
  // Wide arpeggios keep natural line breaks rather than microscopic noteheads.
  const phrase=planEngraving(score,10000,layoutOptions);
  const needed=Math.max(...phrase.rows.map(row=>row.used+32));
  layoutWidth=Math.max(layoutWidth,Math.min(needed,actual/.62));
 }
 const plan=planEngraving(score,layoutWidth,layoutOptions);
 const active=container.querySelector('.playing')?.dataset.scoreBar;
 // Atomic detached construction: a failed render never wipes the previous score.
 const mount=document.createElement('div');
 const renderer=new VF.Renderer(mount,VF.Renderer.Backends.SVG);renderer.resize(plan.width,1000);
 const ctx=renderer.getContext();ctx.setFillStyle(INK);ctx.setStrokeStyle(INK);ctx.setLineWidth(1);
 const svg=mount.querySelector('svg');
 svg.setAttribute('class','score-document');svg.setAttribute('role','img');
 svg.setAttribute('data-renderer','vexflow-bravura');svg.setAttribute('data-note-scale',scale);
 svg.setAttribute('data-rh-voicings',score.rightHandVoicings===true);svg.setAttribute('data-key-label',keyLabel(score.tonic,score.mode));
 svg.setAttribute('data-portrait-layout',portrait);svg.setAttribute('data-layout-width',plan.width);svg.setAttribute('data-bass-visible',plan.showBass);
 svg.setAttribute('aria-label',score.bars.map(b=>`${b.symbol}: ${b.tones.map(noteName).join(', ')}${plan.showBass?'; бас '+noteName(b.bass):''}`).join('. '));
 svg.prepend(node('title',{},score.bars.map(b=>b.name||b.symbol).join(' — ')));
 let cursor=8;
 plan.rows.forEach((row,ri)=>{
  const system=ctx.openGroup('system');system.setAttribute('data-system',ri);system.setAttribute('transform',`translate(0 ${cursor})`);
  for(const m of row.measures){
   const {bar,right,left,staves,voices,formatter}=m;
   const measure=ctx.openGroup('measure');measure.setAttribute('class','score-measure'+(active===String(bar.index)?' playing':''));
   measure.setAttribute('data-score-bar',bar.index);measure.setAttribute('aria-label',`${bar.symbol}, ${bar.name}`);
   measure.append(node('rect',{x:m.x,y:0,width:m.width,height:row.bottom,rx:4,fill:'transparent',stroke:'none',class:'beat-highlight'}));
   staves.forEach((stave,i)=>{
    stave.setX(m.x).setY((i?row.bass:row.treble)-40).setWidth(m.width);
    stave.setEndBarType(bar.index===score.bars.length-1?VF.Barline.type.END:VF.Barline.type.SINGLE);
    stave.setContext(ctx);stave.setStyle({strokeStyle:STAFF_INK,fillStyle:INK,lineWidth:1});
    stave.setDefaultLedgerLineStyle({strokeStyle:STAFF_INK,lineWidth:1.25});
   });
   const start=Math.max(...staves.map(s=>s.getNoteStartX()))+8;staves.forEach(s=>s.setNoteStartX(start));
   right.notes.forEach(n=>n.setStave(staves[0]));left?.notes.forEach(n=>n.setStave(staves[1]));
   const end=Math.min(...staves.map(s=>s.getNoteEndX()))-12;formatter.format(voices,end-start);
   staves.forEach((stave,i)=>{
    const g=ctx.openGroup('staff');g.setAttribute('data-staff',i?'bass':'treble');stave.draw();
    if(m.first){const clef=g.querySelector('.vf-clef');if(clef)clef.setAttribute('data-clef',i?'bass':'treble');}
    ctx.closeGroup();
   });
   if(plan.showBass){
    if(m.first){new VF.StaveConnector(staves[0],staves[1]).setType(VF.StaveConnector.type.BRACE).setContext(ctx).draw();new VF.StaveConnector(staves[0],staves[1]).setType(VF.StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();}
    new VF.StaveConnector(staves[0],staves[1]).setType(bar.index===score.bars.length-1?VF.StaveConnector.type.BOLD_DOUBLE_RIGHT:VF.StaveConnector.type.SINGLE_RIGHT).setContext(ctx).draw();
   }
   for(const [i,part] of [right,left].entries()){
    if(!part)continue;
    const g=ctx.openGroup('hand');g.setAttribute('data-hand',i?'left':'right');
    part.voice.draw(ctx,staves[i]);part.beams.forEach(b=>b.setContext(ctx).draw());annotateHand(g,part);ctx.closeGroup();
   }
   if(options.showLabels!==false){
    const x=start+right.notes[0].getTickContext().getX();
    const labelX=(text,size,weight=400)=>m.compact?Math.max(m.x+8,Math.min(x,m.x+m.width-10-scoreLabelWidth(text,size,weight))):x;
    label(measure,labelX(bar.symbol,SCORE_LABEL_STYLE.symbolSize,600),SCORE_LABEL_STYLE.symbolY,bar.symbol,SCORE_LABEL_STYLE.symbolSize,{'font-weight':'600',class:'score-degree'});
    if(bar.name)label(measure,labelX(bar.name,SCORE_LABEL_STYLE.nameSize),SCORE_LABEL_STYLE.nameY,bar.name,SCORE_LABEL_STYLE.nameSize,{fill:'#736c63',class:'score-caption score-chord'});
    if(m.changed)label(measure,m.x+5,10,keyLabel(bar.tonic,bar.mode),10,{'font-family':'Arial, sans-serif',fill:'#736c63',class:'score-caption score-key-caption'});
   }
   ctx.closeGroup();
  }
  ctx.closeGroup();cursor+=row.bottom+20;
 });
 const height=Math.max(80,cursor-10);
 svg.setAttribute('viewBox',`0 0 ${plan.width} ${height}`);svg.setAttribute('width','100%');svg.removeAttribute('height');svg.removeAttribute('style');
 container.replaceChildren(svg);container.classList.remove('score-grid');container.classList.add('score-sheet');
 records.set(container,{score,width:actual,options});roots.add(container);
}
export function renderScore(container,score,options={}){
 paint(container,score,undefined,options);
 if(typeof ResizeObserver!=='undefined'){
  observer??=new ResizeObserver(entries=>{
   for(const {target} of entries){const r=records.get(target);if(r&&target.clientWidth>0&&Math.abs(target.clientWidth-r.width)>1)pending.add(target);}
   if(pending.size&&!frame)frame=requestAnimationFrame(()=>{
    frame=0;const batch=[...pending];pending.clear();for(const root of batch){const r=records.get(root);if(r&&root.isConnected&&root.clientWidth>0)paint(root,r.score,undefined,r.options);}
   });
  });observer.observe(container);
 }
}
export function clearScores(){observer?.disconnect();if(frame)cancelAnimationFrame(frame);frame=0;pending.clear();roots.clear();records=new WeakMap();}
if(typeof window!=='undefined'){
 window.addEventListener('beforeprint',()=>{for(const root of roots){const r=records.get(root);if(r)paint(root,r.score,760,r.options);}});
 window.addEventListener('afterprint',()=>{for(const root of roots){const r=records.get(root);if(r)paint(root,r.score,undefined,r.options);}});
}
