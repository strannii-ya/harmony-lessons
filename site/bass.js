import { applyRightHandVoicings } from './voicings.js';
import { compile, mod, normalizeSymbol, pitch, shiftNote } from './music.js';

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
