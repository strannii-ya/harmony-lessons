import { pitch, mod, asciiName } from './music.js';
import { ACADEMIC_ROOTS } from './key-labels.js';
import { MODES } from './mode-types.js';
export const MODE_ROOTS=Object.freeze(['C','C#','Db','D','Eb','E','F','F#','Gb','G','G#','Ab','A','Bb','B']);
const MAJOR=[0,2,4,5,7,9,11];
export const modeById=id=>{const mode=MODES.find(m=>m.id===id);if(!mode)throw new Error('Неизвестный лад');return mode;};
export const rootLabel=tonic=>{if(!MODE_ROOTS.includes(tonic))throw new Error('Неизвестная тоника');return ACADEMIC_ROOTS[tonic];};
export function parseFormula(formula){
 const result=String(formula).trim().split(/\s+/).map(token=>{
  const m=/^([♭♯]{0,2})([1-7])$/.exec(token);if(!m)throw new Error('Некорректная формула лада');
  const step=+m[2]-1,alter=[...m[1]].reduce((v,s)=>v+(s==='♯'?1:-1),0);
  return {token,step,semitones:MAJOR[step]+alter};
 });
 if(result.length<5||result.length>12||result[0].token!=='1'||result.some((n,i)=>n.semitones<0||n.semitones>=12||i&&n.semitones<=result[i-1].semitones))throw new Error('Звукоряд должен возрастать в пределах октавы');
 return result;
}
export function modeScore(id,tonic='C'){
 const mode=modeById(id);rootLabel(tonic);const root=pitch(tonic,4),formula=parseFormula(mode.formula);
 const notes=[...formula,{token:'1',step:7,semitones:12}].map(d=>{
  const absolute=root.letter+d.step,letter=mod(absolute,7),octave=root.octave+Math.floor(absolute/7),midi=root.midi+d.semitones;
  const alter=midi-(12*(octave+1)+MAJOR[letter]);
  if(Math.abs(alter)>2)throw new Error('Для этой тоники требуется слишком сложная альтерация');
  const note={letter,octave,alter,midi,degree:d.token};
  if(pitch(asciiName(note),octave).midi!==midi)throw new Error('Нарушено нотное написание');
  return note;
 });
 const steps=notes.slice(1).map((n,i)=>n.midi-notes[i].midi);
 const events=notes.map((n,i)=>({hand:'right',notes:[n],beat:i,duration:1,index:i}));
 // Audio uses the exact same ascending spelled pitches. There is no harmonisation or bass.
 return {id,tonic,modeName:mode.name,notes,steps,events,totalBeats:events.length,bars:events.map(e=>({index:e.index,beat:e.beat,beats:1})),noMeter:true};
}
export function transposeModeRoot(tonic,delta){
 rootLabel(tonic);if(![-1,1].includes(delta))throw new Error('Неверный шаг транспонирования');
 const flats=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'],sharps=['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B'];
 return (tonic.includes('b')?flats:sharps)[mod(pitch(tonic).midi+delta)];
}
export function selectModes(category='all',query=''){
 const normalize=s=>String(s).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/#/g,'♯').trim();const q=normalize(query);
 return MODES.filter(m=>(category==='all'||m.category===category)&&(!q||normalize([m.name,m.aliases,m.formula,m.feature].join(' ')).includes(q)));
}
export function solfegeName(n){return ['до','ре','ми','фа','соль','ля','си'][n.letter]+(n.alter>0?'♯'.repeat(n.alter):'♭'.repeat(-n.alter));}
