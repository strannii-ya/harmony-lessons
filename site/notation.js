import { keyPitches, noteName, KEY_RU } from './music.js';
import { layoutScore, signature, signatureChange, sameKey, staffY } from './score-layout.js';
const NS = 'http://www.w3.org/2000/svg', INK = '#332f28';
function el(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
function line(root, x1, y1, x2, y2, width = 1, color = '#918a7d') {
  root.append(el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width }));
}
function text(root, x, y, value, size = 13, attrs = {}) {
  root.append(el('text', { x, y, 'font-size': size, fill: INK, 'font-family': 'Georgia, serif', ...attrs }, value));
}
function clef(root, x, y, bass) {
  if (bass) {
    root.append(el('path', { d: `M ${x+3} ${y+13} C ${x+10} ${y-2}, ${x+33} ${y+8}, ${x+20} ${y+27} Q ${x+13} ${y+36}, ${x+4} ${y+40} C ${x+26} ${y+30}, ${x+24} ${y+7}, ${x+10} ${y+10}`, fill:'none', stroke:INK, 'stroke-width':2.5 }));
    root.append(el('circle', { cx:x+6, cy:y+14, r:4, fill:INK }));
    [9,19].forEach(d => root.append(el('circle', { cx:x+32, cy:y+d, r:1.8, fill:INK })));
  } else {
    root.append(el('path', { d:`M ${x+19} ${y+55} C ${x+8} ${y+60}, ${x+8} ${y+44}, ${x+17} ${y+46} C ${x+29} ${y+50}, ${x+22} ${y+69}, ${x+16} ${y+54} L ${x+12} ${y-4} C ${x+11} ${y-19}, ${x+28} ${y-22}, ${x+22} ${y-9} C ${x+19} ${y+2}, ${x-2} ${y+13}, ${x+2} ${y+27} C ${x+5} ${y+42}, ${x+33} ${y+37}, ${x+29} ${y+24} C ${x+25} ${y+12}, ${x+10} ${y+18}, ${x+12} ${y+28}`, fill:'none', stroke:INK, 'stroke-width':2.3, 'stroke-linecap':'round' }));
  }
}
function accidental(root, x, y, alter) {
  if (alter === 2) { // Avoid depending on a double-sharp glyph in the device's font.
    const p=el('g', { 'data-accidental':2 });
    line(p,x+1,y-4,x+8,y+4,2,INK); line(p,x+1,y+4,x+8,y-4,2,INK); root.append(p); return;
  }
  text(root,x,y+5,alter===0?'♮':alter===1?'♯':alter===-1?'♭':'♭♭',19,{'font-family':'Arial, serif','data-accidental':alter});
}
function keySymbols(root, notes, x, treble, bass) {
  notes.forEach((n,i) => {
    const sharp = (n.originalAlter ?? n.alter) > 0;
    const oct = (sharp ? [5,5,5,5,5,4,4] : [5,5,5,4,4,4,4])[n.letter];
    accidental(root,x+i*10,treble+staffY({...n,octave:oct}),n.alter);
    accidental(root,x+i*10,bass+staffY({...n,octave:oct-2},true),n.alter);
  });
}
function head(root, note, x, y, staff, duration) {
  for(let l=staff-10;y<=l;l-=10) line(root,x-9,l,x+9,l,1,INK);
  for(let l=staff+50;y>=l;l+=10) line(root,x-9,l,x+9,l,1,INK);
  root.append(el('ellipse',{cx:x,cy:y,rx:duration>=4?6.8:5.5,ry:3.7,transform:`rotate(-18 ${x} ${y})`,fill:duration>=2?'#f2ecdf':INK,stroke:INK,'stroke-width':duration>=2?1.7:1,'data-midi':note.midi,'data-note':`${noteName(note)}${note.octave}`}));
}
function events(root, list, positions, staff, isBass, key) {
  const seen=new Map(), signatureMap=new Map(key.map(n=>[n.letter,n.alter]));
  const beamed = list.length>1 && list.every(e=>e.duration===.5);
  const allY=list.flatMap(e=>e.notes.map(n=>staff+staffY(n,isBass)));
  const down=allY.reduce((a,b)=>a+b,0)/allY.length < staff+20;
  const beamGroups=[];
  list.forEach((event, i) => {
    const x=positions[i], ys=event.notes.map(n=>staff+staffY(n,isBass));
    // Place simultaneous accidentals in non-colliding columns.
    const columns=[];
    event.notes.map((n,j)=>({n,j})).sort((a,b)=>ys[a.j]-ys[b.j]).forEach(({n,j})=>{
      const id=n.letter+':'+n.octave, old=seen.has(id)?seen.get(id):signatureMap.get(n.letter);
      if(old!==n.alter){let col=0;while(columns[col]?.some(y=>Math.abs(y-ys[j])<23))col++;
        (columns[col]??=[]).push(ys[j]);accidental(root,x-19-col*11,ys[j],n.alter);seen.set(id,n.alter);
      }
    });
    const occupied=[];
    event.notes.forEach((n,j)=>{const y=ys[j], shift=occupied.some(v=>Math.abs(y-v)<6)?(down?-9:9):0;occupied.push(y);head(root,n,x+shift,y,staff,event.duration);});
    if(beamed){(beamGroups[Math.floor(i/4)]??=[]).push({x,y:ys[0]});}
    else if(event.duration<4){const end=down?Math.max(...ys)+30:Math.min(...ys)-30;const sx=x+(down?-5:5);line(root,sx,down?Math.min(...ys):Math.max(...ys),sx,end,1.2,INK);}
  });
  for(const group of beamGroups){const y=down?Math.max(...group.map(p=>p.y))+28:Math.min(...group.map(p=>p.y))-28;
    group.forEach(p=>line(root,p.x+(down?-5:5),p.y,p.x+(down?-5:5),y,1.2,INK));
    if(group.length>1)line(root,group[0].x+(down?-5:5),y,group.at(-1).x+(down?-5:5),y,3.4,INK);
  }
}
let records=new WeakMap();const roots=new Set(),pending=new Set();let observer,resizeFrame=0;
function paint(container, score, forcedWidth) {
  const zoom=container.classList.contains('is-zoomed') && !forcedWidth;
  const actual=container.clientWidth || 800;
  const available=forcedWidth || (zoom?Math.max(420,actual/1.3):actual);
  const layout=layoutScore(score,available);
  const active=container.querySelector('.playing')?.dataset.scoreBar;
  const svg=el('svg',{viewBox:`0 0 ${layout.width} ${layout.height}`,width:zoom?layout.width*1.3:'100%',role:'img',class:'score-document','aria-label':score.bars.map(b=>`${b.symbol}: ${b.tones.map(noteName).join(', ')}; бас ${noteName(b.bass)}`).join('. '),'data-layout-width':layout.width});
  svg.append(el('title',{},score.bars.map(b=>b.name).join(' — ')));
  layout.rows.forEach((r,ri)=>{
    const system=el('g',{'data-system':ri});svg.append(system);
    [r.treble,r.bass].forEach(y=>{for(let i=0;i<5;i++)line(system,16,y+i*10,r.end,y+i*10);});
    line(system,16,r.treble,16,r.bass+40,1.2,INK);
    system.append(el('path',{d:`M 12 ${r.treble} Q 3 ${r.treble+5} 8 ${(r.treble+r.bass+40)/2-8} Q 9 ${(r.treble+r.bass+40)/2} 3 ${(r.treble+r.bass+40)/2} Q 9 ${(r.treble+r.bass+40)/2} 8 ${(r.treble+r.bass+40)/2+8} Q 3 ${r.bass+35} 12 ${r.bass+40}`,fill:'none',stroke:INK,'stroke-width':1.4}));
    clef(system,22,r.treble,false);clef(system,22,r.bass,true);
    keySymbols(system,signature(r.bars[0].bar),64,r.treble,r.bass);
    if(r.meter && ri===0){[r.treble,r.bass].forEach(y=>{const x=16+r.prefix-15;text(system,x,y+17,'4',17,{'font-weight':'bold','text-anchor':'middle'});text(system,x,y+36,'4',17,{'font-weight':'bold','text-anchor':'middle'});});}
    r.bars.forEach(({bar,x,width,previous})=>{
      const g=el('g',{'data-score-bar':bar.index,class:'score-measure'+(active===String(bar.index)?' playing':''),'aria-label':`${bar.symbol}, ${bar.name}`});system.append(g);
      g.append(el('rect',{x:x+1,y:r.top+2,width:width-2,height:r.bottom-r.top-1,rx:3,class:'beat-highlight'}));
      let prefix=0;
      if(previous&&!sameKey(previous,bar)){
        const syms=signatureChange(previous,bar);keySymbols(g,syms,x+5,r.treble,r.bass);prefix=syms.length*10+18;
        text(g,x+prefix+12,r.top-1,`${KEY_RU[bar.tonic]||bar.tonic} ${bar.mode==='minor'?'moll':'dur'}`,9,{'font-family':'Arial, sans-serif',fill:'#776e5d'});
      }
      const key=keyPitches(bar.tonic,bar.mode), notesX=x+prefix+40;
      text(g,notesX-8,r.top+18,bar.symbol,15,{'font-weight':'bold'});
      text(g,notesX-8,r.top+36,bar.name,12,{fill:'#736952'});
      const room=Math.max(25,width-prefix-60);
      const positions=bar.rh.map((e,i)=>notesX+(bar.rh.length===1?0:i*room/(bar.rh.length-1)));
      events(g,bar.rh,positions,r.treble,false,key);
      events(g,[bar.left],[notesX],r.bass,true,key);
      line(system,x+width,r.treble,x+width,r.bass+40,1,INK);
      if(bar.index===score.bars.length-1)line(system,x+width-4,r.treble,x+width-4,r.bass+40,2,INK);
    });
  });
  container.replaceChildren(svg);
  container.classList.remove('score-grid');container.classList.add('score-sheet');
  records.set(container,{score,width:actual});roots.add(container);
}
export function renderScore(container, score) {
  paint(container,score);
  if(typeof ResizeObserver!=='undefined'){
    observer??=new ResizeObserver(entries=>{
      for(const {target} of entries){const r=records.get(target);if(r&&target.clientWidth>0&&Math.abs(target.clientWidth-r.width)>1)pending.add(target);}
      // SVG height changes are deferred out of the ResizeObserver delivery loop (Safari).
      if(pending.size&&!resizeFrame)resizeFrame=requestAnimationFrame(()=>{
        resizeFrame=0;const batch=[...pending];pending.clear();
        for(const target of batch){const r=records.get(target);if(r&&target.isConnected&&target.clientWidth>0)paint(target,r.score);}
      });
    });
    observer.observe(container);
  }
}
/** Release private in-memory scores when changing views or signing out. */
export function clearScores() {observer?.disconnect();if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=0;pending.clear();roots.clear();records=new WeakMap();}
if(typeof window!=='undefined'){
  window.addEventListener('beforeprint',()=>{for(const root of roots){const r=records.get(root);if(r)paint(root,r.score,760);}});
  window.addEventListener('afterprint',()=>{for(const root of roots){const r=records.get(root);if(r)paint(root,r.score);}});
}
