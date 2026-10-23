import { applyRightHandVoicings } from './voicings.js';
import { bassDegree, compile, mod, normalizeSymbol, pitch, shiftNote } from './music.js';

/** Editorial choices arrive with the authenticated exercise, not a public lesson list. */
export function defaultBass(exercise) {
 const chosen=exercise.theory?.notation?.show_bass;
 if(typeof chosen==='boolean')return chosen;
 return exercise.progression.some(item=>{
  if(typeof item==='object' && item.bass)return true;
  const symbol=normalizeSymbol(typeof item==='string'?item:item.symbol).split('/')[0];
  return symbol==='K64' || /(?:65|64|43|42|6)$/.test(symbol);
 });
}
export function bassReason(exercise) {
 return String(exercise.theory?.notation?.bass_reason||'');
}
export function bassButtonLabel(visible){return visible?'Скрыть бас':'Показать бас';}

/** Keep the intended bass contour through transposition. Only octave placement changes.
 * The rendered notes and the player share these SAME left-hand event objects.
 * Visibility is purely visual and never changes playback or this event model.
 */
export function compileExercise(exercise,options) {
 const score=compile(exercise.progression,{...options,...(exercise.theory?.meter?{meter:exercise.theory.meter}:{})});

 const notation=exercise.theory?.notation||{};
 const bassLine=notation.bass_line;
 if(bassLine!==undefined){
  if(notation.bass_offsets!==undefined)throw new Error('Нельзя одновременно задавать два варианта басовой линии.');
  if(!Array.isArray(bassLine)||bassLine.length!==score.bars.length)throw new Error('Число тактов басовой партии не совпадает с гармонией.');
  const replacement=new Map();
  score.bars.forEach((bar,i)=>{
   const row=bassLine[i];
   if(!Array.isArray(row)||!row.length||row.length>16)throw new Error('Неверное количество басовых событий в такте.');
   let elapsed=0,hasNote=false;
   const events=row.map(item=>{
    if(!item||typeof item!=='object'||![.5,1,1.5,2,3,4].includes(item.duration))throw new Error('Неверная длительность басовой ноты.');
    if(item.rest===true){
     if(item.degree!==undefined||item.octave!==undefined||item.semitones!==undefined)throw new Error('Пауза баса не содержит высоты.');
    }else if(typeof item.degree!=='string'||!/^([♭♯b#]*[1-7])$/.test(item.degree)||
      (item.octave!==undefined&&(!Number.isInteger(item.octave)||item.octave < -1||item.octave > 1))||
      (item.semitones!==undefined&&(!Number.isInteger(item.semitones)||item.semitones < -12||item.semitones > 12||item.octave!==undefined)))
      throw new Error('Неверная ступень басовой партии.');
    let note;
    if(item.rest!==true){
     const base=bassDegree(item.degree,bar.tonic);
     const desired=item.semitones===undefined?base.midi+(item.octave||0)*12:(36+mod(pitch(bar.tonic).midi))+item.semitones;
     if(mod(desired)!==mod(base.midi))throw new Error('Интервал и ступень баса не совпадают.');
     note=shiftNote(base,desired-base.midi);
     if(note.midi<28||note.midi>59)throw new Error('Басовая нота вне допустимого регистра.');
     hasNote=true;
    }
    const event={hand:'left',notes:note?[note]:[],beat:bar.beat+elapsed,duration:item.duration,index:bar.index,...(item.rest===true?{rest:true}:{})};
    elapsed+=item.duration;return event;
   });
   if(Math.abs(elapsed-bar.beats)>1e-8||!hasNote)throw new Error('Длительности басовых нот не заполняют такт.');
   replacement.set(bar.left,events);
   bar.bassEvents=events;
   bar.left=events.find(e=>e.notes.length);
   bar.bass=bar.left.notes[0];
  });
  score.events=score.events.flatMap(event=>replacement.get(event)||[event]);
  return options?.inversions?applyRightHandVoicings(score,{loop:exercise.loop===true}):score;
 }
 const offsets=exercise.theory?.notation?.bass_offsets;
 if(offsets===undefined)return options?.inversions?applyRightHandVoicings(score,{loop:exercise.loop===true}):score;
 if(!Array.isArray(offsets)||offsets.length!==score.bars.length||
    offsets.some(n=>!Number.isInteger(n)||n < -24 || n > 36))
  throw new Error('Некорректная запись басовой линии.');
 const anchor=36+mod(pitch(score.tonic).midi);
 const targets=offsets.map(n=>anchor+n);
 // The same register in both textures; leave room below the lowest possible RH arpeggio.
 let octaveShift=0;
 while(Math.max(...targets)+octaveShift>53)octaveShift-=12;
 score.bars.forEach((bar,i)=>{
  const midi=targets[i]+octaveShift;
  if(midi<21||midi>53||mod(midi)!==mod(bar.bass.midi))
   throw new Error('Басовая линия не соответствует аккорду или заданной ступени.');
  bar.bass=shiftNote(bar.bass,midi-bar.bass.midi);
  bar.left.notes=[bar.bass];
 });
 return options?.inversions?applyRightHandVoicings(score,{loop:exercise.loop===true}):score;
}
