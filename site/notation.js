import { keyPitches, noteName, KEY_RU } from './music.js';
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
const line=(svg,x1,y1,x2,y2,stroke='#5d574c',width=1)=>svg.append(el('line',{x1,y1,x2,y2,stroke,'stroke-width':width}));
function text(svg,x,y,s,size=13,extra={}){svg.append(el('text',{x,y,'font-size':size,fill:'#3b342b','font-family':'Georgia, serif',...extra},s));}
function clef(svg,x,y,bass){
 if(bass){svg.append(el('path',{d:`M ${x+3} ${y+13} C ${x+10} ${y-2}, ${x+33} ${y+8}, ${x+20} ${y+27} Q ${x+13} ${y+36}, ${x+4} ${y+40} C ${x+26} ${y+30}, ${x+24} ${y+7}, ${x+10} ${y+10}`,fill:'none',stroke:'#342e26','stroke-width':2.5}));svg.append(el('circle',{cx:x+6,cy:y+14,r:4,fill:'#342e26'}));[9,19].forEach(d=>svg.append(el('circle',{cx:x+32,cy:y+d,r:1.8,fill:'#342e26'})));}
 else{svg.append(el('path',{d:`M ${x+19} ${y+55} C ${x+8} ${y+60}, ${x+8} ${y+44}, ${x+17} ${y+46} C ${x+29} ${y+50}, ${x+22} ${y+69}, ${x+16} ${y+54} L ${x+12} ${y-4} C ${x+11} ${y-19}, ${x+28} ${y-22}, ${x+22} ${y-9} C ${x+19} ${y+2}, ${x-2} ${y+13}, ${x+2} ${y+27} C ${x+5} ${y+42}, ${x+33} ${y+37}, ${x+29} ${y+24} C ${x+25} ${y+12}, ${x+10} ${y+18}, ${x+12} ${y+28}`,fill:'none',stroke:'#342e26','stroke-width':2.3,'stroke-linecap':'round'}));}
}
function yNote(n,staffY,bass){const bottom=bass?2*7+4:4*7+2;return staffY+40-(n.octave*7+n.letter-bottom)*5;}
function accidental(svg,x,y,alter){const symbol=alter===0?'♮':alter===1?'♯':alter===-1?'♭':alter===2?'𝄪':'𝄫';text(svg,x,y+5,symbol,19,{'font-family':'Arial, serif'});}
function note(svg,n,x,y,staffY,duration,stem=true,color='#302a23'){
 for(let l=staffY-10;y<=l;l-=10)line(svg,x-11,l,x+11,l,color,1);
 for(let l=staffY+50;y>=l;l+=10)line(svg,x-11,l,x+11,l,color,1);
 svg.append(el('ellipse',{cx:x,cy:y,rx:duration>=4?7:5.5,ry:3.8,transform:`rotate(-19 ${x} ${y})`,fill:duration>=2?'#ece5d8':color,stroke:color,'stroke-width':duration>=2?1.8:1}));
 if(stem&&duration<4)line(svg,x+5,y,x+5,y-30,color,1.2);
}
/** Engraves the exact spelled pitches and durations used by playback. SVG contains no bitmap or external font. */
export function renderScore(container,score){
 container.replaceChildren();container.classList.add('score-grid');
 score.bars.forEach(bar=>{
  const wide=score.pattern==='arpeggio',w=wide?480:360,h=316,top=103,lower=231;
  const svg=el('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`${bar.symbol}: ${bar.tones.map(noteName).join(', ')}; бас ${noteName(bar.bass)}`,'data-score-bar':bar.index,class:'score-measure'});
  svg.append(el('title',{},`${bar.name}. ${bar.tonic} ${bar.mode==='minor'?'минор':'мажор'}. ${bar.beats} доли.`));
  text(svg,17,24,String(bar.index+1).padStart(2,'0'),12,{'font-family':'Arial, sans-serif',fill:'#867c6a'});
  text(svg,48,25,bar.symbol,19,{'font-weight':'bold'});text(svg,w-18,24,bar.name,14,{'text-anchor':'end'});
  [top,lower].forEach((y,i)=>{for(let l=0;l<5;l++)line(svg,15,y+l*10,w-15,y+l*10);clef(svg,21,y,i===1);});
  line(svg,15,top,15,lower+40);line(svg,w-15,top,w-15,lower+40);
  const sig=keyPitches(bar.tonic,bar.mode),altered=sig.filter(n=>n.alter!==0).sort((a,b)=>{const order=a.alter>0?[3,0,4,1,5,2,6]:[6,2,5,1,4,0,3];return order.indexOf(a.letter)-order.indexOf(b.letter);});
  altered.forEach((n,i)=>{const trebleOct=(n.alter>0?[5,5,5,5,5,4,4]:[5,5,5,4,4,4,4])[n.letter];const bassOct=(n.alter>0?[3,3,3,3,3,2,2]:[3,3,3,2,2,2,2])[n.letter];accidental(svg,60+i*9,yNote({...n,octave:trebleOct},top,false),n.alter);accidental(svg,60+i*9,yNote({...n,octave:bassOct},lower,true),n.alter);});
  const start=76+altered.length*9,room=w-start-24;
  for(const hand of ['right','left']){
   const isBass=hand==='left',staffY=isBass?lower:top,ev=isBass?[bar.left]:bar.rh,seen=new Map();
   ev.forEach((e,i)=>{
    const x=ev.length===1?(wide?start+13:start+room*.42):start+13+i*room/ev.length;
    const ys=e.notes.map(n=>yNote(n,staffY,isBass));
    e.notes.forEach((n,j)=>{const y=ys[j],nk=n.letter+':'+n.octave,previous=seen.has(nk)?seen.get(nk):sig[n.letter>=0?((n.letter-sig[0].letter+7)%7):0]?.alter;
     if(n.alter!==previous){accidental(svg,x-19-(j%2)*5,y,n.alter);seen.set(nk,n.alter);}
     note(svg,n,x,y,staffY,e.duration,false);
    });
    if(ev.length===1&&e.duration<4)line(svg,x+5,Math.max(...ys),x+5,Math.min(...ys)-30,'#302a23',1.2);
    if(ev.length>1){const beamY=Math.min(top-12,...ev.map(e=>yNote(e.notes[0],staffY,isBass)-27));const y=ys[0];line(svg,x+5,y,x+5,beamY,'#302a23',1.2);if(i%4<3&&i<ev.length-1)line(svg,x+5,beamY,x+5+room/ev.length,beamY,'#302a23',3.4);}
   });
  }
  text(svg,17,h-10,`${KEY_RU[bar.tonic]||bar.tonic} ${bar.mode==='minor'?'минор':'мажор'} · ${bar.beats} доли`,10,{'font-family':'Arial, sans-serif',fill:'#877b68'});
  container.append(svg);
 });
}
