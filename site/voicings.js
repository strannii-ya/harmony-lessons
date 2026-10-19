import { mod, shiftNote } from './music.js';

/** Right-hand position planning, NOT a rewrite of harmonic inversion (which is set by bass).
 * Every candidate contains each chord tone exactly once in close position within an octave.
 * A bounded dynamic program chooses the whole sequence, including the seam of authored loops.
 * This is a hand-travel/span heuristic, not individual finger numbers or strict SATB harmony.
 */
export const VOICING_HELP='Удобные расположения правой руки: меньше скачков, общие звуки по возможности остаются на месте. Бас и состав аккордов не меняются.';
export const voicingButtonLabel=enabled=>enabled?'Вернуть исходную правую руку':'Подобрать обращения правой руки';
const mean=ns=>ns.reduce((s,n)=>s+n.midi,0)/ns.length;
const pcSet=ns=>ns.map(n=>mod(n.midi)).sort((a,b)=>a-b).join(',');
const exact=(a,b)=>a.length===b.length&&a.every((n,i)=>n.midi===b[i].midi);
const moveCost=d=>d+.18*Math.max(0,d-2)**2;

export function voicingCandidates(bar) {
 const tones=bar.tones;
 if(!Array.isArray(tones)||![3,4].includes(tones.length)||new Set(tones.map(n=>mod(n.midi))).size!==tones.length)
  throw new Error('Для подбора расположений нужно трезвучие или септаккорд.');
 const result=[];
 for(let inversion=0;inversion<tones.length;inversion++) {
  const rotated=[...tones.slice(inversion),...tones.slice(0,inversion).map(n=>shiftNote(n,12))];
  // Absolute bounds avoid a register jump when crossing a transposition's C boundary.
  for(let octave=-3;octave<=2;octave++) {
   const notes=rotated.map(n=>shiftNote(n,12*octave));
   if(notes[0].midi<55 || notes.at(-1).midi>84 || notes[0].midi<=bar.bass.midi)continue;
   const span=notes.at(-1).midi-notes[0].midi;
   if(span>11||notes.some((n,i)=>i&&n.midi<=notes[i-1].midi))continue;
   result.push({notes,inversion,span,center:mean(notes)});
  }
 }
 if(!result.length)throw new Error('Не удалось подобрать расположение правой руки над заданным басом.');
 return result.sort((a,b)=>a.notes[0].midi-b.notes[0].midi||a.inversion-b.inversion);
}

/** Ordered voice matching. A 3-to-4 tone transition may split one voice; no tone is omitted. */
export function transitionCost(a,b) {
 const left=a.notes||a,right=b.notes||b;
 if(exact(left,right))return 0;
 // An enharmonic re-interpretation must keep the SAME keys, not merely pitch classes.
 if(pcSet(left)===pcSet(right))return Infinity;
 const short=left.length<=right.length?left:right,long=left.length<=right.length?right:left;
 let movement=Infinity;
 if(short.length===long.length)movement=short.reduce((s,n,i)=>s+moveCost(Math.abs(n.midi-long[i].midi)),0);
 else {
  for(let split=0;split<short.length;split++) {
   const expanded=short.flatMap((n,i)=>i===split?[n,n]:[n]);
   movement=Math.min(movement,expanded.reduce((s,n,i)=>s+moveCost(Math.abs(n.midi-long[i].midi)),0));
  }
 }
 const commonPC=left.filter(n=>right.some(m=>mod(n.midi)===mod(m.midi))).length;
 const held=left.filter(n=>right.some(m=>n.midi===m.midi)).length;
 return movement+1.8*(commonPC-held)+.6*Math.abs(mean(left)-mean(right))
  +.35*Math.abs(left.at(-1).midi-right.at(-1).midi);
}
function positionCost(c) {
 // Compactness + a comfortable central register. No blanket ban on a thumb on black keys.
 return .18*Math.max(0,c.span-7)**2+.045*Math.abs(c.center-67);
}
function initialCost(c,bar) {
 const original=bar.tones.map((n,i)=>i<bar.inversion?shiftNote(n,12):n).sort((a,b)=>a.midi-b.midi);
 let shift=0;
 while(mean(original)+shift>74)shift-=12;
 while(mean(original)+shift<62)shift+=12;
 return original.reduce((s,n,i)=>s+Math.abs(n.midi+shift-c.notes[i].midi),0)*1.6;
}
export function planRightHand(score,{loop=false}={}) {
 if(!score?.bars?.length||score.bars.length>64)throw new Error('Неверная последовательность');
 const choices=score.bars.map(voicingCandidates);
 const edges=choices.slice(1).map((row,i)=>choices[i].map(a=>row.map(b=>transitionCost(a,b))));
 const seam=loop?choices.at(-1).map(a=>choices[0].map(b=>transitionCost(a,b))):null;
 let best=null;
 // Fix each possible first position when closing a loop. Ordinary progressions need one pass.
 for(const first of (loop?choices[0].map((_,i)=>i):[null])) {
  let costs=choices[0].map((c,i)=>first!==null&&i!==first?Infinity:initialCost(c,score.bars[0])+positionCost(c));
  const parents=[];
  for(let k=1;k<choices.length;k++) {
   const links=[];
   costs=choices[k].map((c,j)=>{
    let value=Infinity,parent=-1;
    for(let i=0;i<choices[k-1].length;i++) {
     const n=costs[i]+edges[k-1][i][j]+positionCost(c);
     if(n<value){value=n;parent=i;}
    }
    links[j]=parent;return value;
   });parents.push(links);
  }
  costs.forEach((cost,last)=>{
   const total=cost+(loop?seam[last][first]:0);
   if(!Number.isFinite(total)||best&&total>=best.cost)return;
   const path=[last];for(let k=parents.length-1;k>=0;k--)path.unshift(parents[k][path[0]]);
   best={cost:total,positions:path.map((j,i)=>choices[i][j])};
  });
 }
 if(!best)throw new Error('Не удалось соединить расположения правой руки.');
 return best;
}

function arpeggioNotes(notes) {
 // Preserve the existing wide eight-note texture, starting on the selected chord member.
 // All seventh-chord tones are retained; "Обращения" never reduces seventh chords to triads.
 const upper=notes.at(-1);
 return [notes[0],notes[2],shiftNote(notes[1],12),shiftNote(upper,12),
  shiftNote(notes[0],24),shiftNote(upper,12),shiftNote(notes[1],12),notes[2]];
}
export function applyRightHandVoicings(score,options={}) {
 const plan=planRightHand(score,options),replacements=new Map();
 const bars=score.bars.map((bar,i)=>{
  const chosen=plan.positions[i];
  const line=score.pattern==='arpeggio'?arpeggioNotes(chosen.notes):null;
  const rh=bar.rh.map((e,j)=>{
   const next={...e,notes:line?[line[j%line.length]]:chosen.notes};
   replacements.set(e,next);return next;
  });
  return {...bar,rh,rhInversion:chosen.inversion,rhPosition:chosen.notes};
 });
 return {...score,bars,events:score.events.map(e=>replacements.get(e)||e),rightHandVoicings:true};
}
