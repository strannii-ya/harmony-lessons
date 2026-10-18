/** Interval structure is independent of harmonic function. Pitches retain their spelling. */
import { pitch, shiftNote, noteName, KEYS } from './music.js';
const PC=[0,2,4,5,7,9,11];
export const ROOTS=[...new Set([...KEYS.major,...KEYS.minor])];
export const TYPES=[
 {id:'major',label:'maj / без суффикса',name:'Мажорное трезвучие',suffix:'',semi:[0,4,7],formula:'1–3–5',hint:'Обозначение C без суффикса означает мажорное трезвучие. Вариант Cmaj встречается реже.'},
 {id:'minor',label:'m / min',name:'Минорное трезвучие',suffix:'m',semi:[0,3,7],formula:'1–♭3–5',hint:'m относится к минорному трезвучию. Строчная буква m и maj имеют разный смысл.'},
 {id:'diminished',label:'dim / °',name:'Уменьшённое трезвучие',suffix:'dim',semi:[0,3,6],formula:'1–♭3–♭5',hint:'Две малые терции образуют уменьшённую квинту между крайними звуками.'},
 {id:'augmented',label:'aug / +',name:'Увеличенное трезвучие',suffix:'aug',semi:[0,4,8],formula:'1–3–♯5',hint:'Две большие терции образуют увеличенную квинту. При обращении сохраняем исходное нотное написание.'},
 {id:'seventh',label:'7',name:'Малый мажорный септаккорд',suffix:'7',semi:[0,4,7,10],formula:'1–3–5–♭7',hint:'Мажорное трезвучие с малой септимой от основного тона. Доминантсептаккордом в функциональном анализе он становится в доминантовой роли: например, G7 в до мажоре. Само C7 не обозначает доминанту до мажора.'},
 {id:'major7',label:'maj7 / Δ7',name:'Большой мажорный септаккорд',suffix:'maj7',semi:[0,4,7,11],formula:'1–3–5–7',hint:'maj7 указывает на большую септиму; трезвучие здесь мажорное. Cmaj7 и C7 различаются септимовым тоном.'},
 {id:'minor7',label:'m7 / min7',name:'Малый минорный септаккорд',suffix:'m7',semi:[0,3,7,10],formula:'1–♭3–5–♭7',hint:'Минорное трезвучие сочетается с малой септимой от основного тона.'},
 {id:'minorMajor7',label:'m(maj7)',name:'Большой минорный септаккорд',suffix:'m(maj7)',semi:[0,3,7,11],formula:'1–♭3–5–7',hint:'m задаёт минорное трезвучие, maj7 — большую септиму. Это не большой мажорный септаккорд.'},
 {id:'halfDiminished7',label:'ø7 / m7♭5',name:'Малый септаккорд с уменьшённой квинтой',suffix:'m7♭5',semi:[0,3,6,10],formula:'1–♭3–♭5–♭7',hint:'Уменьшённое трезвучие с малой септимой. Другое распространённое название — полууменьшённый септаккорд. Вводная функция определяется ступенью и контекстом, а не знаком ø7 самим по себе.'},
 {id:'diminished7',label:'°7 / dim7',name:'Уменьшённый септаккорд',suffix:'dim7',semi:[0,3,6,9],formula:'1–♭3–♭5–♭♭7',hint:'Три малые терции. Септима уменьшённая: от до это си-дубль-бемоль, а не ля. На фортепиано клавиша совпадает, но интервальное значение и написание различны.'}
];
export function inversionNames(size){
 if(size===3)return ['Основной вид','Секстаккорд · 6','Квартсекстаккорд · 6₄'];
 if(size===4)return ['Основной вид · 7','Квинтсекстаккорд · 6₅','Терцквартаккорд · 4₃','Секундаккорд · 4₂'];
 throw new Error('Ожидается трезвучие или септаккорд');
}
export function intervalName(a,b){
 const steps=(b.octave-a.octave)*7+b.letter-a.letter,number=steps+1;
 if(steps<0||steps>7)throw new Error('Ожидается восходящий простой интервал');
 const base=[0,2,4,5,7,9,11,12][steps],diff=b.midi-a.midi-base;
 const perfect=[1,4,5,8].includes(number);
 const prefix=perfect?({0:'ч.',1:'ув.','-1':'ум.'}[diff]):({0:'б.','-1':'м.',1:'ув.','-2':'ум.'}[diff]);
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
  const position=root.letter+2*i,letter=position%7,octave=root.octave+Math.floor(position/7);
  const midi=root.midi+s,alter=midi-(12*(octave+1)+PC[letter]);
  if(Math.abs(alter)>2)throw new Error('Слишком сложное написание');
  return {letter,octave,midi,alter};
 });
 let notes=[...tones.slice(inversion),...tones.slice(0,inversion).map(n=>shiftNote(n,12))];
 // Octave displacement preserves the inversion and keeps examples within comfortable treble range.
 if(notes.at(-1).midi>86)notes=notes.map(n=>shiftNote(n,-12));
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
