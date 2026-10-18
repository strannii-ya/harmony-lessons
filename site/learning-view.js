/** Presentation-only layer. Runs on lesson/library renders; never changes scores, auth or stored data. */
import { guideHTML, mountGuide } from './chord-guide.js';
const content=document.querySelector('#content');
function arrange(){
 for(const card of content.querySelectorAll('.exercise:not([data-arranged])')){
  card.dataset.arranged='true';
  const score=card.querySelector('[data-score]'),actions=card.querySelector('.exercise-actions');
  if(score&&actions)actions.before(score);
  card.querySelector('.roman')?.classList.add('progression-frame');
  const bassLabel=card.querySelector('.exercise-heading .small-caption');
  if(bassLabel&&actions)actions.after(bassLabel);
 }
 const old=content.querySelector('.notation-key:not(.chord-guide)');
 if(old){const template=document.createElement('template');template.innerHTML=guideHTML();old.replaceWith(template.content);}
 const controls=content.querySelector('.lesson-toolbar .toolbar-controls');
 if(controls){
  const footer=document.createElement('div');footer.className='all-score-controls';
  const notes=content.querySelector('.notes-editor'),results=content.querySelector('#results');
  if(notes)notes.before(footer);else if(results)results.after(footer);else content.append(footer);
  footer.append(controls);
  const option=controls.querySelector('option[value="arpeggio"]');if(option)option.textContent='Широкое арпеджио';
 }
}
new MutationObserver(arrange).observe(content,{childList:true,subtree:true});
content.addEventListener('toggle',e=>{if(e.target.matches?.('.chord-guide')&&e.target.open)mountGuide(e.target);},true);
arrange();
