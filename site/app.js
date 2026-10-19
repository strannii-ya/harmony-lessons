import { GENRES, isGenre, genreLabel, selectExercises } from './genre-library.js';
import { keyLabel, academicKeyNames } from './key-labels.js';
import { VOICING_HELP, voicingButtonLabel } from './voicings.js';
import { defaultBass, bassReason, bassButtonLabel, compileExercise } from './bass.js';
import { mountAccess } from './access.js';
import { guideHTML, mountGuide } from './chord-guide.js';
import { KEYS, transposeKey } from './music.js';
import { renderScore, clearScores } from './notation.js';
import { Player } from './audio.js';
import { LibraryAPI } from './api.js';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const courseText=s=>esc(academicKeyNames(s));
const state={data:null,user:null,view:'course',lesson:1,pattern:'chords',selected:null,settings:new Map(),loop:false,bpm:72,hand:'both',search:'',filter:'all',collection:'all',genre:'all'};
const player=new Player();let api,toastTimer;
const notify=s=>{clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);};
const protect=fn=>async(...args)=>{try{await fn(...args);}catch(e){console.error(e.message);notify(e.message||'Не удалось выполнить действие');}};
const lessonBy=id=>state.data.lessons.find(l=>String(l.id)===String(id));
const exerciseBy=id=>state.data.exercises.find(e=>e.id===id);
const exercisesFor=id=>state.data.exercises.filter(e=>String(e.lesson_id)===String(id));
const progressFor=id=>state.data.progress.find(p=>String(p.lesson_id)===String(id));
const isFavorite=id=>state.data.favorites.some(f=>f.exercise_id===id);
function settings(e){if(!state.settings.has(e.id))state.settings.set(e.id,{tonic:e.mode==='minor'?'A':'C',mode:e.mode||'major',showBass:defaultBass(e),inversions:false});return {...state.settings.get(e.id),pattern:state.pattern};}
const roman=e=>e.progression.map(x=>typeof x==='string'?x:x.symbol).join(isGenre(e)?' | ':' – ');
const chapterRoman=n=>['','I','II','III','IV','V','VI','VII'][n]||n;
function navigate(view,lesson){player.stop();$('#player').hidden=true;state.selected=null;state.view=view;if(lesson)state.lesson=lesson;history.replaceState(null,'','#'+(view==='lesson'?'lesson-'+state.lesson:view));document.body.classList.remove('menu-open');render();window.scrollTo({top:0,behavior:'instant'});}
function nav(){
 $('[data-view=access]').hidden=!api.isOwner;
 $('#lesson-count').textContent=state.data.lessons.length;
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view||(b.dataset.view==='course'&&state.view==='lesson')));
 let html='',chapter=null;for(const l of state.data.lessons){if(l.chapter!==chapter){chapter=l.chapter;html+=`<div class="chapter-label">${chapterRoman(chapter)} / ${courseText(l.chapter_title)}</div>`;}html+=`<button class="lesson-link ${state.view==='lesson'&&String(state.lesson)===String(l.id)?'active':''}" data-lesson="${esc(l.id)}"><span class="num">${String(l.position).padStart(2,'0')}</span><span>${courseText(l.title)}</span>${progressFor(l.id)?.completed?'<span class="done">✓</span>':''}</button>`;}
 $('#lesson-nav').innerHTML=html;
}
function render(){clearScores();nav();if(state.view==='course')course();else if(state.view==='lesson')lesson();else if(state.view==='reference')reference();else if(state.view==='access')access();else library();}
function access(){
 $('#breadcrumb').textContent='Доступ';
 mountAccess($('#content'),api);
}
function reference(){
 $('#breadcrumb').textContent='Аккорды и обращения';
 $('#content').innerHTML='<section class="page-heading"><h1>Аккорды и обращения</h1></section>'+guideHTML(true);
 mountGuide(document.querySelector('.chord-guide'));
}
function course(){
 $('#breadcrumb').textContent='Мой курс';const complete=state.data.progress.filter(p=>p.completed).length,current=state.data.lessons.find(l=>!progressFor(l.id)?.completed)||state.data.lessons[0];
 let html=`<section class="page-heading"><h1>Курс гармонии</h1><p class="page-count">${complete} / ${state.data.lessons.length} пройдено · ${state.data.exercises.filter(e=>!isGenre(e)).length} упражнений</p></section><div class="resume-row"><span>Урок ${current.position}. ${courseText(current.title)}</span><button data-lesson="${esc(current.id)}">Продолжить →</button></div>`;
 const chapters=[...new Set(state.data.lessons.map(l=>l.chapter))];for(const c of chapters){const ls=state.data.lessons.filter(l=>l.chapter===c);html+=`<div class="section-heading"><h2>${chapterRoman(c)}. ${courseText(ls[0].chapter_title)}</h2><span>${ls.length}</span></div><div class="course-grid">${ls.map(l=>`<button class="course-card" data-lesson="${esc(l.id)}"><span class="card-num">${String(l.position).padStart(2,'0')}</span><span class="card-arrow">↗</span><h3>${courseText(l.title)}</h3><small>Упражнений: ${exercisesFor(l.id).length}</small>${progressFor(l.id)?.completed?'<span class="status-pill">Пройдено</span>':''}</button>`).join('')}</div>`;}
 $('#content').innerHTML=html;
}
function figureHTML(figure){
 if(!figure || !Array.isArray(figure.steps) || !figure.steps.length)return '';
 const steps=figure.steps.slice(0,6).map((step,i)=>`${i?'<span class="figure-arrow" aria-hidden="true">→</span>':''}<div class="figure-step"><strong>${courseText(step.label)}</strong><span>${courseText(step.note||'')}</span></div>`).join('');
 return `<figure class="theory-figure"><div class="figure-flow">${steps}</div>${figure.caption?`<figcaption>${courseText(figure.caption)}</figcaption>`:''}</figure>`;
}
function theoryHTML(theory) {
 if (!theory || !Array.isArray(theory.sections)) return '';
 const sections=theory.sections.map(section=>`<section class="theory-section"><h4>${courseText(section.title)}</h4>${(Array.isArray(section.paragraphs)?section.paragraphs:[]).map(p=>`<p>${courseText(p)}</p>`).join('')}</section>`).join('');
 const sources=(Array.isArray(theory.sources)?theory.sources:[]).flatMap(source=>{
  try {const url=new URL(source.url);if(url.protocol!=='https:')return [];return [`<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(source.label||url.hostname)}</a>`];}catch{return [];}
 });
 return `<div class="theory-body">${sections}${figureHTML(theory.figure)}${sources.length?`<div class="theory-sources"><span>Справочные материалы:</span> ${sources.join(' · ')}</div>`:''}</div>`;
}
function exerciseHTML(e,i){const s=settings(e);return `<article class="exercise" data-eid="${esc(e.id)}"><header class="exercise-heading"><span class="exercise-index">${String(i+1).padStart(2,'0')}</span><div>${isGenre(e)?`<p class="genre-badge">${esc(genreLabel(e))} · ${e.progression.length} тактов · ${e.theory?.meter||4}/4</p>`:''}<h3 class="exercise-title">${courseText(e.title)}</h3><div class="roman progression-frame">${esc(roman(e))}${e.loop?' ↻':''}</div></div></header><div class="exercise-content"><div class="score" id="score-${esc(e.id)}" data-score="${esc(e.id)}"></div><div class="exercise-actions"><button class="primary icon-play" data-play="${esc(e.id)}" title="Воспроизвести" aria-label="Воспроизвести: ${courseText(e.title)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button><div class="key-control"><button data-shift="-1" data-id="${esc(e.id)}" aria-label="На полтона ниже">−</button><select aria-label="Тональность упражнения" data-key="${esc(e.id)}">${KEYS[s.mode].map(k=>`<option value="${k}" ${s.tonic===k?'selected':''}>${keyLabel(k,s.mode)}</option>`).join('')}</select><button data-shift="1" data-id="${esc(e.id)}" aria-label="На полтона выше">＋</button></div><button data-bass="${esc(e.id)}" aria-controls="score-${esc(e.id)}" aria-pressed="${s.showBass}" aria-label="${bassButtonLabel(s.showBass)}" title="${esc(bassButtonLabel(s.showBass)+(bassReason(e)?'. '+bassReason(e):''))}">Бас</button><button data-voicing="${esc(e.id)}" aria-controls="score-${esc(e.id)}" aria-pressed="${s.inversions}" aria-label="${voicingButtonLabel(s.inversions)}" title="${esc(VOICING_HELP)}">Обращения</button><button data-star="${esc(e.id)}" class="${isFavorite(e.id)?'saved':''}" aria-label="Избранное" aria-pressed="${isFavorite(e.id)}">${isFavorite(e.id)?'★':'☆'}</button></div>${e.progression.some(x=>typeof x==='object'&&x.bass)?'<div class="small-caption bass-caption">Бас: '+esc(e.progression.map(x=>typeof x==='object'&&x.bass?x.bass:'—').join(' → '))+'</div>':''}<details class="exercise-notes"><summary>Разбор</summary>${theoryHTML(e.theory)}<div class="task-row"><div><h4>Задача</h4><p>${courseText(e.goal)}</p></div><div><h4>Обсудить</h4><p>${courseText(e.discuss)}</p></div></div></details></div></article>`;}
function mountScores(){document.querySelectorAll('.exercise').forEach(d=>{try{draw(d.dataset.eid);}catch(e){const root=d.querySelector('.score');root.textContent=e.message;root.classList.add('score-error');}});}
function draw(id){const e=exerciseBy(id),s=compileExercise(e,settings(e));const root=document.querySelector(`[data-score="${CSS.escape(id)}"]`);if(root)renderScore(root,s,{showBass:settings(e).showBass});return s;}
function patternControl(){return `<div class="toolbar-controls"><select id="pattern" aria-label="Фактура нот и звука"><option value="chords" ${state.pattern==='chords'?'selected':''}>Аккорды целиком</option><option value="arpeggio" ${state.pattern==='arpeggio'?'selected':''}>Широкое арпеджио</option></select><button id="print">Печать нот</button></div>`;}
function lesson(){
 const l=lessonBy(state.lesson);if(!l){navigate('course');return;}
 $('#breadcrumb').textContent=`Урок ${l.position}`;const progress=progressFor(l.id),prev=state.data.lessons.find(x=>x.position===l.position-1),next=state.data.lessons.find(x=>x.position===l.position+1);
 $('#content').innerHTML=`<section class="page-heading"><h1>${courseText(l.title)}</h1><div class="lesson-meta"><button id="complete" aria-pressed="${!!progress?.completed}">${progress?.completed?'✓ Пройдено':'Отметить пройденным'}</button></div></section><details class="prep"><summary>Подготовка и темы</summary><p class="lesson-goal">${courseText(l.goal)}</p><div class="prep-body"><div><h3>Дома</h3><ul>${(l.preparation||[]).map(t=>`<li>${courseText(t)}</li>`).join('')}</ul></div><div><h3>На уроке</h3><ul>${(l.topics||[]).map(t=>`<li>${courseText(t)}</li>`).join('')}</ul></div></div></details>${l.theory?.sections?.length?`<details class="lesson-theory"><summary>Теория</summary>${theoryHTML(l.theory)}</details>`:''}<div class="lesson-toolbar"><h2>Последовательности</h2></div>${exercisesFor(l.id).map(exerciseHTML).join('')}<div class="all-score-controls">${patternControl()}</div><section class="notes-editor"><label for="notes">Заметки</label><textarea id="notes" maxlength="20000">${esc(progress?.notes||'')}</textarea><button id="save-notes">Сохранить</button><span id="note-status" class="note-status" role="status"></span></section><div class="lesson-pagination">${prev?`<button data-lesson="${esc(prev.id)}">← Урок ${prev.position}</button>`:'<span></span>'}${next?`<button data-lesson="${esc(next.id)}">Урок ${next.position} →</button>`:''}</div>`;
 mountScores();
}
function library(){
 const favorites=state.view==='favorites';$('#breadcrumb').textContent=favorites?'Избранное':'Последовательности';
 $('#content').innerHTML=`<section class="page-heading"><h1>${favorites?'Избранное':'Последовательности'}</h1></section><div class="library-collections" role="group" aria-label="Подборка последовательностей">${[['all','Все'],['course','Из уроков'],['genres','По жанрам']].map(([id,name])=>`<button data-collection="${id}" aria-pressed="${state.collection===id}">${name}</button>`).join('')}</div><div class="search-row library-search"><input id="search" type="search" placeholder="Название, жанр или ступени" value="${esc(state.search)}" aria-label="Поиск последовательностей"><select id="filter" aria-label="Фильтр по уроку" ${state.collection==='genres'?'hidden':''}><option value="all">Все уроки</option>${state.data.lessons.map(l=>`<option value="${l.id}" ${String(state.filter)===String(l.id)?'selected':''}>${l.position}. ${esc(l.title)}</option>`).join('')}</select><select id="genre-filter" aria-label="Жанр" ${state.collection==='course'?'hidden':''}><option value="all">Все жанры</option>${GENRES.map(g=>`<option value="${g.id}" ${state.genre===g.id?'selected':''}>${g.label}</option>`).join('')}</select></div><details class="genre-explanation" ${state.collection==='course'?'hidden':''}><summary>О жанровых примерах</summary><p>Это учебные варианты типовых гармонических моделей, не транскрипции конкретных песен. Один оборот встречается в разных жанрах: характер задают также ритм, мелодия, темп и фактура. Плеер воспроизводит гармоническую схему, не готовую стилистическую аранжировку.</p><p>Вертикальная черта в жанровой схеме разделяет такты. В блюзе их 12, в вальсовых примерах размер 3/4. В варианте «Аккорды целиком» трёхдольный такт записан половинной с точкой; рисунок «бас — аккорд — аккорд» попробуй на инструменте. Арпеджио воспроизводится ровными восьмыми, без автоматического свинга.</p><p>add9 сохраняет терцию и не добавляет септиму; 9 включает септиму. I(add6) в новых схемах — трезвучие с добавленной секстой, а I6, как и прежде, — обращение. Кнопка «Обращения» сохраняет все аккордовые тоны и меняет только расположение правой руки.</p></details><div class="lesson-toolbar"><span id="results-count" class="small-caption" role="status"></span></div><div id="results"></div><div class="all-score-controls">${patternControl()}</div>`;
 renderResults();
}
function renderResults(){
 clearScores();
 const list=selectExercises(state.data.exercises,{collection:state.collection,genre:state.genre,lesson:state.filter,query:state.search,favorites:state.view==='favorites'?new Set(state.data.favorites.map(f=>f.exercise_id)):null});
 $('#results-count').textContent=`Найдено: ${list.length}`;
 $('#results').innerHTML=list.length?(state.collection==='genres'?GENRES.map(g=>{
  const group=list.filter(e=>e.genre===g.id);return group.length?`<section class="genre-group"><h2>${g.label}</h2>${group.map(exerciseHTML).join('')}</section>`:'';
 }).join(''):list.map(exerciseHTML).join('')):'<div class="empty">Нет последовательностей.</div>';
 mountScores();
}
async function startPlayback(id){player.stop();state.selected=id;const e=exerciseBy(id),s=draw(id);$('#player').hidden=false;$('#playing-title').textContent=academicKeyNames(e.title);$('#play-toggle').textContent='■';$('#play-toggle').setAttribute('aria-label','Остановить');await player.play(s,{bpm:state.bpm,hand:state.hand,loop:state.loop,onChord:i=>document.querySelectorAll('.score-measure').forEach(n=>n.classList.toggle('playing',n.closest('[data-eid]')?.dataset.eid===id&&Number(n.dataset.scoreBar)===i)),onStop:()=>{$('#play-toggle').textContent='▶';$('#play-toggle').setAttribute('aria-label','Играть');document.querySelectorAll('.playing').forEach(n=>n.classList.remove('playing'));}});}
async function refreshExercise(id){player.stop();draw(id);const e=exerciseBy(id),sel=document.querySelector(`[data-key="${CSS.escape(id)}"]`);if(sel)sel.value=settings(e).tonic;}
async function persistProgress(patch){const rows=await api.saveProgress(state.user.id,state.lesson,patch);const entry=rows?.[0];if(entry){const i=state.data.progress.findIndex(x=>String(x.lesson_id)===String(state.lesson));if(i>=0)state.data.progress[i]=entry;else state.data.progress.push(entry);}nav();}
document.addEventListener('click',protect(async ev=>{
 const b=ev.target.closest('button');if(!b)return;
 if(b.dataset.collection){player.stop();state.collection=b.dataset.collection;state.filter='all';state.genre='all';library();return;}
 if(b.dataset.view){navigate(b.dataset.view);return;}if(b.dataset.lesson){navigate('lesson',b.dataset.lesson);return;}
 if(b.dataset.play){await startPlayback(b.dataset.play);return;}
 if(b.dataset.bass){const e=exerciseBy(b.dataset.bass),s=settings(e),showBass=!s.showBass;state.settings.set(e.id,{...s,showBass});draw(e.id);b.setAttribute('aria-pressed',String(showBass));b.setAttribute('aria-label',bassButtonLabel(showBass));b.title=bassButtonLabel(showBass)+(bassReason(e)?'. '+bassReason(e):'');return;}
 if(b.dataset.voicing){const e=exerciseBy(b.dataset.voicing),s=settings(e),inversions=!s.inversions;const playing=player.running&&state.selected===e.id;state.settings.set(e.id,{...s,inversions});b.disabled=true;try{if(playing)await startPlayback(e.id);else draw(e.id);}catch(err){state.settings.set(e.id,s);throw err;}finally{b.disabled=false;}b.setAttribute('aria-pressed',String(inversions));b.setAttribute('aria-label',voicingButtonLabel(inversions));return;}
 if(b.dataset.star){const id=b.dataset.star,enabled=!isFavorite(id);await api.favorite(state.user.id,id,enabled);if(enabled)state.data.favorites.push({exercise_id:id});else state.data.favorites=state.data.favorites.filter(f=>f.exercise_id!==id);b.textContent=enabled?'★':'☆';b.classList.toggle('saved',enabled);b.setAttribute('aria-pressed',enabled);return;}
 if(b.dataset.shift){const e=exerciseBy(b.dataset.id),s=settings(e);state.settings.set(e.id,{...s,tonic:transposeKey(s.tonic,s.mode,Number(b.dataset.shift))});await refreshExercise(e.id);return;}
 if(b.id==='focus'){document.body.classList.toggle('focus');b.textContent=document.body.classList.contains('focus')?'Вернуть меню':'Скрыть меню';}
 if(b.id==='menu'||b.id==='landscape-menu')document.body.classList.toggle('menu-open');
 if(b.id==='play-toggle'){if(player.running)player.stop();else if(state.selected)await startPlayback(state.selected);}
 if(b.id==='close-player'){player.stop();$('#player').hidden=true;}
 if(b.id==='loop'){state.loop=!state.loop;b.setAttribute('aria-pressed',state.loop);if(player.running)await startPlayback(state.selected);}
 if(b.id==='print'){player.stop();window.print();}
 if(b.id==='save-notes'){b.disabled=true;try{await persistProgress({notes:$('#notes').value});$('#note-status').textContent='Сохранено';}finally{b.disabled=false;}}
 if(b.id==='complete'){const completed=!progressFor(state.lesson)?.completed;await persistProgress({completed});b.textContent=completed?'✓ Пройдено':'Отметить пройденным';b.setAttribute('aria-pressed',completed);}
 if(b.id==='signout'){player.stop();clearScores();let remoteError;try{await api.signOut();}catch(e){remoteError=e;}state.data=null;state.user=null;state.settings.clear();$('[data-view=access]').hidden=true;$('#content').replaceChildren();$('#lesson-nav').replaceChildren();$('#player').hidden=true;$('#shell').hidden=true;$('#gate').hidden=false;$('#email').value='';$('#login-status').textContent=remoteError?'Сессия на этом устройстве очищена. Серверный выход не подтверждён: '+remoteError.message:'Вы вышли.';state.selected=null;}
}));
document.addEventListener('change',protect(async ev=>{const t=ev.target;if(t.dataset.key){const e=exerciseBy(t.dataset.key);state.settings.set(e.id,{...settings(e),tonic:t.value});await refreshExercise(e.id);}if(t.id==='pattern'){state.pattern=t.value;player.stop();document.querySelectorAll('.exercise').forEach(d=>draw(d.dataset.eid));}if(t.id==='hand'){state.hand=t.value;if(player.running)await startPlayback(state.selected);}if(t.id==='filter'){state.filter=t.value;if(t.value!=='all'){state.genre='all';$('#genre-filter').value='all';}renderResults();}if(t.id==='genre-filter'){state.genre=t.value;if(t.value!=='all'){state.filter='all';$('#filter').value='all';}renderResults();}}));
$('#tempo').addEventListener('input',ev=>{state.bpm=Number(ev.target.value);$('#tempo-value').textContent=state.bpm;});$('#tempo').addEventListener('change',protect(async()=>{if(player.running)await startPlayback(state.selected);}));
document.addEventListener('input',ev=>{if(ev.target.id==='search'){state.search=ev.target.value;renderResults();}});
document.addEventListener('keydown',ev=>{if(ev.code==='Space'&&!['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY'].includes(document.activeElement.tagName)&&state.selected){ev.preventDefault();if(player.running)player.stop();else protect(startPlayback)(state.selected);}if(ev.key==='Escape'){document.body.classList.remove('menu-open');player.stop();}});
async function enter(user){state.user=user;state.data=await api.load();if(!state.data.lessons?.length)throw new Error('Личная библиотека пока не заполнена. Вход подтверждён, материалы ещё не загружены.');$('#gate').hidden=true;$('#shell').hidden=false;const m=/^#lesson-(\d+)$/.exec(location.hash);if(m){state.view='lesson';state.lesson=Number(m[1]);}else if(['#reference','#library','#favorites','#access'].includes(location.hash)){state.view=location.hash.slice(1);}render();}
$('#login-form').addEventListener('submit',async ev=>{ev.preventDefault();const b=$('#send');b.disabled=true;try{await api.send($('#email').value);$('#login-status').textContent='Открой ссылку из нового письма.';$('#code-form').hidden=false;}catch(e){$('#login-status').textContent=e.message;}finally{setTimeout(()=>b.disabled=!api.configured,60000);}});
$('#code-form').addEventListener('submit',async ev=>{ev.preventDefault();const b=ev.target.querySelector('button');b.disabled=true;try{await enter(await api.verify($('#email').value,$('#code').value));}catch(e){$('#login-status').textContent=e.message;}finally{b.disabled=false;}});
(async()=>{try{const c=await fetch('./config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Настройки сайта недоступны');return r.json();});api=new LibraryAPI(c);$('#send').disabled=!api.configured;
 $('#login-status').textContent=api.configured?'':'Библиотека не подключена.';
 if(api.configured){const user=await api.restore();if(user)await enter(user);}
 }catch(e){$('#login-status').textContent=e.message;$('#send').disabled=true;}})();
