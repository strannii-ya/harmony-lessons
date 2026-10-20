import { LOWER_ICON, HIGHER_ICON } from './score-controls.js';
import { MODES, MODE_CATEGORIES, MODE_SOURCES } from './mode-types.js';
import { MODE_ROOTS, modeById, modeScore, rootLabel, transposeModeRoot, selectModes, solfegeName } from './mode-model.js';
import { renderModeScore, clearModeScores } from './mode-notation.js';
import { cardPlayback, playIcon as icon } from './card-playback.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={category:'all',query:'',root:'C',roots:new Map()};
let mounted=null,abort=null;
const tonic=id=>state.roots.get(id)||state.root;
const options=root=>MODE_ROOTS.map(k=>`<option value="${k}" ${root===k?'selected':''}>${rootLabel(k)}</option>`).join('');
function sources(keys){return keys.map(k=>{const s=MODE_SOURCES[k];return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`;}).join(' · ');}
export function stopModes(){if(cardPlayback.active?.key.startsWith('mode:'))cardPlayback.stop();}
export function clearModes(){stopModes();abort?.abort();abort=null;clearModeScores();mounted=null;}
function card(m){
 return `<article class="mode-card" data-mode-card="${m.id}"><header><h3>${esc(m.name)}</h3><p class="mode-feature">${esc(m.feature)}</p></header><div class="mode-formula" aria-label="Ступени относительно натурального мажора">${esc(m.formula.split(' ').join(' – '))}</div><div class="mode-score score-sheet" data-mode-score="${m.id}"></div><div class="card-footer mode-footer"><div class="mode-actions"><button type="button" class="primary icon-play" data-scale-play="${m.id}" aria-label="Воспроизвести: ${esc(m.name)}" aria-pressed="false">${icon(false)}</button><div class="key-control"><button type="button" data-scale-shift="-1" data-scale-id="${m.id}" aria-label="Тоника на полтона ниже" title="Тоника на полтона ниже">${LOWER_ICON}</button><select data-scale-root="${m.id}" aria-label="Тоника: ${esc(m.name)}">${options(tonic(m.id))}</select><button type="button" data-scale-shift="1" data-scale-id="${m.id}" aria-label="Тоника на полтона выше" title="Тоника на полтона выше">${HIGHER_ICON}</button></div><span class="mode-size">${m.formula.split(' ').length} звуков</span></div><details class="mode-details"><summary>О ладе и практика</summary><p>${esc(m.description)}</p><dl><div><dt>Шаги в полутонах</dt><dd data-mode-steps></dd></div><div><dt>Ноты от выбранной тоники</dt><dd data-mode-notes></dd></div></dl><p><strong>Попробуй.</strong> ${esc(m.practice)}</p><p class="mode-sources">${sources(m.sources)}</p></details></div></article>`;
}
function draw(id){
 const root=mounted.querySelector(`[data-mode-card="${id}"]`),score=modeScore(id,tonic(id));
 if(root){renderModeScore(root.querySelector('[data-mode-score]'),score);root.querySelector('[data-scale-root]').value=tonic(id);root.querySelector('[data-mode-steps]').textContent=score.steps.join(' – ');root.querySelector('[data-mode-notes]').textContent=score.notes.map(solfegeName).join(' – ');}
 return score;
}
function results(){
 stopModes();clearModeScores();const modes=selectModes(state.category,state.query);
 mounted.querySelector('[data-mode-count]').textContent=`${modes.length} из ${MODES.length}`;
 mounted.querySelector('[data-mode-results]').innerHTML=modes.length?MODE_CATEGORIES.map(c=>{
  const list=modes.filter(m=>m.category===c.id);return list.length?`<section class="mode-category" data-mode-category="${c.id}"><div class="mode-category-heading"><h2>${c.name}</h2><p>${esc(c.note)}</p></div><div class="mode-grid">${list.map(card).join('')}</div></section>`:'';
 }).join(''):'<p class="empty" role="status">Ничего не найдено. Попробуй другое название или формулу.</p>';
 modes.forEach(m=>draw(m.id));
}
async function play(id){
 const root=mounted,card=root.querySelector(`[data-mode-card="${id}"]`);
 await cardPlayback.toggle({key:'mode:'+id,score:draw(id),button:card.querySelector('[data-scale-play]'),label:modeById(id).name,
  onChord:index=>{
   card.querySelectorAll('.current-note').forEach(n=>n.classList.remove('current-note'));
   card.querySelector(`[data-scale-note-index="${index}"]`)?.classList.add('current-note');
  },clear:()=>card.querySelectorAll('.current-note').forEach(n=>n.classList.remove('current-note'))});
}
export function mountModes(container,notify=()=>{}){
 clearModes();mounted=container;abort=new AbortController();const {signal}=abort;
 container.innerHTML=`<section class="page-heading"><h1>Лады</h1><p class="page-count">Восходящие звукоряды и их характерные ступени</p></section><section class="mode-controls" aria-label="Фильтры справочника ладов"><label>Тоника всех примеров<select data-modes-root>${options(state.root)}</select></label><label>Категория<select data-modes-category><option value="all">Все категории</option>${MODE_CATEGORIES.map(c=>`<option value="${c.id}" ${state.category===c.id?'selected':''}>${c.name}</option>`).join('')}</select></label><label class="mode-search-label">Поиск<input type="search" data-modes-search placeholder="Лад, другое название или формула" value="${esc(state.query)}" autocomplete="off"></label></section><details class="mode-intro"><summary>Как читать и сравнивать</summary><p>Здесь лад показан через свой <strong>восходящий звукоряд</strong>: от тоники до её повторения через октаву. В мелодии важны также устои и тяготения; одной смены начальной ноты недостаточно, чтобы слух принял новую тонику.</p><p>В формулах числа отсчитываются от одноимённого натурального мажора: 3 — большая терция, ♭3 — малая, ♭7 — малая септима. В пентатонике пропущенные числа не перенумеровываются. В нотах знаки стоят перед звуками, без ключевых знаков и размера: так удобнее сравнивать составы. Равные длительности здесь нужны для чтения, а не задают обязательный ритм лада.</p><p>Выбор C, D, Fis и т. д. меняет <strong>тонику</strong>, а не превращает любой лад в мажор. H — си, B — си-бемоль. Можно изменить все примеры сразу или тонику одной карточки. Cis и Des звучат одинаково на фортепиано, но ноты записываются по-разному.</p><p>Сначала сравни два лада от одной тоники. Сыграй её отдельно и удерживай в памяти, затем выдели отличающуюся ступень. Предложения «Попробуй» — упражнения для знакомства, не универсальные правила гармонизации.</p><p><strong>О традиционных названиях.</strong> Все ноты и звук адаптированы к 12-ступенному равномерно темперированному фортепиано. Макам и рага включают характерные мелодические обороты, интонацию и другие правила. Такие системы не равны одной гамме, а реальная интонация может отличаться от клавиш инструмента.</p><p class="mode-sources">${sources(['diatonic','maqam','hijaz','hamsadhwani'])}</p></details><p class="mode-count" data-mode-count role="status" aria-live="polite"></p><div data-mode-results></div>`;
 results();
 const guarded=fn=>async event=>{try{await fn(event);}catch(e){stopModes();notify(e.message||'Не удалось построить звукоряд');}};
 container.addEventListener('click',guarded(async event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.scalePlay)await play(b.dataset.scalePlay);
  if(b.dataset.scaleShift){stopModes();const id=b.dataset.scaleId;state.roots.set(id,transposeModeRoot(tonic(id),Number(b.dataset.scaleShift)));draw(id);}
 }),{signal});
 container.addEventListener('change',guarded(event=>{
  const t=event.target;
  if(t.hasAttribute('data-modes-root')){rootLabel(t.value);stopModes();state.root=t.value;state.roots.clear();mounted.querySelectorAll('[data-mode-card]').forEach(c=>draw(c.dataset.modeCard));}
  if(t.hasAttribute('data-modes-category')){state.category=t.value;results();}
  if(t.dataset.scaleRoot){rootLabel(t.value);stopModes();state.roots.set(t.dataset.scaleRoot,t.value);draw(t.dataset.scaleRoot);}
 }),{signal});
 container.addEventListener('input',guarded(event=>{if(event.target.hasAttribute('data-modes-search')){state.query=event.target.value;results();}}),{signal});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')stopModes();},{signal});
 window.addEventListener('pagehide',stopModes,{signal});
}
