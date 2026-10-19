/** Interval structure is independent of harmonic function. Pitches retain their spelling. */
import { pitch, shiftNote, noteName, KEYS } from './music.js';
const PC=[0,2,4,5,7,9,11];
export const ROOTS=[...new Set([...KEYS.major,...KEYS.minor])];
export { TYPES, CATEGORIES } from './chord-types.js';
import { TYPES } from './chord-types.js';
export function inversionNames(size,type=null){
 if(!Number.isInteger(size)||size<2||size>7)throw new Error('Неподдерживаемый состав');
 if(!type||type.tertian){
  if(size===3)return ['Основной вид','Секстаккорд · 6','Квартсекстаккорд · 6₄'];
  if(size===4)return ['Основной вид · 7','Квинтсекстаккорд · 6₅','Терцквартаккорд · 4₃','Секундаккорд · 4₂'];
 }
 return Array.from({length:size},(_,i)=>i===0?'Основной тон внизу':`Тон ${type?.degrees[i]||i+1} внизу`);
}
export function intervalName(a,b){
 const steps=(b.octave-a.octave)*7+b.letter-a.letter,number=steps+1;
 if(steps<0||steps>28)throw new Error('Ожидается восходящий интервал');
 const base=PC[steps%7]+12*Math.floor(steps/7),diff=b.midi-a.midi-base;
 const perfect=[0,3,4].includes(steps%7);
 const prefix=perfect?({0:'ч.',1:'ув.','-1':'ум.',2:'дв.ув.','-2':'дв.ум.'}[diff]):({0:'б.','-1':'м.',1:'ув.','-2':'ум.',2:'дв.ув.','-3':'дв.ум.'}[diff]);
 if(!prefix)throw new Error('Не поддерживается качество интервала');
 return prefix+number;
}
/** Root position and all inversions; no separate LH part in these isolated examples. */
export function example(typeId,rootName='C',inversion=0){
 const type=TYPES.find(t=>t.id===typeId);
 if(!type||!ROOTS.includes(rootName))throw new Error('Неизвестный аккорд');
 if(!Number.isInteger(inversion)||inversion<0||inversion>=type.semi.length)throw new Error('Недопустимое обращение');
 const root=pitch(rootName,4);
 const tones=type.semi.map((s,i)=>{
  const position=root.letter+type.steps[i],letter=position%7,octave=root.octave+Math.floor(position/7);
  const midi=root.midi+s,alter=midi-(12*(octave+1)+PC[letter]);
  if(Math.abs(alter)>2)throw new Error('Слишком сложное написание');
  return {letter,octave,midi,alter};
 });
 let notes;
 if(!inversion)notes=tones.slice();
 else {
  const anchor=tones[inversion];
  notes=tones.map(n=>{let result={...n};while(result.midi<anchor.midi)result=shiftNote(result,12);while(result.midi>=anchor.midi+12)result=shiftNote(result,-12);return result;}).sort((a,b)=>a.midi-b.midi);
 }
 // Octave displacement preserves the inversion and keeps examples within comfortable treble range.
 while(notes[0].midi>72)notes=notes.map(n=>shiftNote(n,-12));
 if(notes.at(-1).midi>91)notes=notes.map(n=>shiftNote(n,-12));
 const bass=notes[0],name=noteName(root)+type.suffix+(inversion?'/'+noteName(bass):'');
 const event={hand:'right',notes,beat:0,duration:4,index:0};
 const bar={index:0,beat:0,beats:4,tonic:'C',mode:'major',root,tones,bass,inversion,symbol:name,name:'',rh:[event],left:{hand:'left',notes:[],beat:0,duration:4,index:0}};
 return {type,root,tones,notes,bass,name,inversion,
  chain:tones.slice(1).map((n,i)=>intervalName(tones[i],n)),
  fromRoot:tones.slice(1).map(n=>intervalName(root,n)),
  fromBass:notes.slice(1).map(n=>intervalName(bass,n)),
  score:{bars:[bar],events:[event],totalBeats:4,tonic:'C',mode:'major',pattern:'chords',noMeter:true}
 };
}
export const ruNote=n=>['до','ре','ми','фа','соль','ля','си'][n.letter]+(n.alter>0?'♯'.repeat(n.alter):'♭'.repeat(-n.alter));
