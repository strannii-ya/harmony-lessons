import { academicKeyNames } from './key-labels.js';
import { TYPES,CATEGORIES,ROOTS,example,inversionNames,ruNote } from './chord-model.js';
import { KEY_RU } from './music.js';
import { renderScore,clearScores } from './notation.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const guideHTML=(standalone=false)=>standalone?'<section class="chord-guide standalone-guide" aria-label="Справочник аккордов"><div class="guide-content"></div></section>':'<details class="chord-guide notation-key"><summary>Обозначения аккордов и обращения</summary><div class="guide-content"></div></details>';
const roles={1:'основной тон',2:'добавленная секунда',3:'терцовый тон',4:'кварта',5:'квинтовый тон',6:'добавленная секста',7:'септимовый тон',9:'нона',11:'ундецима',13:'терцдецима'};
function redraw(guide,card){
 const x=example(card.dataset.chordType,guide.querySelector('[data-guide-root]').value,Number(card.querySelector('[data-inversion]').value));
 card.querySelector('[data-chord-name]').textContent=x.name;
 card.querySelector('[data-guide-notes]').textContent=x.notes.map(ruNote).join(' – ');
 card.querySelector('[data-guide-bass]').textContent=ruNote(x.bass)+' — '+roles[Number(x.type.degrees[x.inversion].replace(/[^0-9]/g,''))];
 card.querySelector('[data-bass-intervals]').textContent=x.fromBass.join(' · ');
 renderScore(card.querySelector('[data-guide-score]'),x.score,{scale:1,showMeter:false,showLabels:false});
}
function cardHTML(t,inversion){
 const x=example(t.id);
 return `<article class="guide-card" data-chord-type="${t.id}"><header><strong>${esc(t.label)}</strong><h3>${esc(t.name)}</h3><span data-chord-name></span></header><div data-guide-score class="score"></div><div class="guide-actions"><label>${t.tertian?'Обращение':'Нижний звук'}<select data-inversion aria-label="Нижний звук или обращение: ${esc(t.name)}">${inversionNames(t.semi.length,t).map((n,i)=>`<option value="${i}" ${i===inversion?'selected':''}>${esc(n)}</option>`).join('')}</select></label></div><dl><dt>Формула от основного тона</dt><dd>${esc(t.formula)}</dd><dt>Интервалы снизу вверх, исходный состав</dt><dd>${x.chain.join(' + ')}</dd><dt>Интервалы от основного тона</dt><dd>${x.fromRoot.join(' · ')}</dd><dt>Звуки снизу вверх</dt><dd data-guide-notes></dd><dt>Нижний звук</dt><dd data-guide-bass></dd><dt>Интервалы над ним</dt><dd data-bass-intervals></dd></dl>${t.semi.length>4?'<p class="guide-complete-note">Полный состав, не аппликатура для одной руки.</p>':''}<details class="guide-explanation"><summary>Пояснение</summary><p>${esc(academicKeyNames(t.hint))}</p></details></article>`;
}
export function mountGuide(guide){
 if(guide.dataset.ready)return;
 guide.dataset.ready='true';
 const inversions=new Map(),container=guide.querySelector('.guide-content');
 container.innerHTML=`<div class="reference-controls"><label class="guide-root">Основной тон<select data-guide-root aria-label="Основной тон примеров">${ROOTS.map(r=>`<option value="${r}">${KEY_RU[r]||r} · ${r}</option>`).join('')}</select></label><label>Категория<select data-guide-category aria-label="Категория аккордов"><option value="all">Все · ${TYPES.length}</option>${CATEGORIES.map(c=>`<option value="${c.id}">${c.name} · ${TYPES.filter(t=>t.category===c.id).length}</option>`).join('')}</select></label><label>Поиск<input data-guide-search type="search" placeholder="add9, уменьшённый, sus…" aria-label="Поиск аккордов"></label></div><details class="guide-explanation guide-reading"><summary>Как читать обозначения</summary><p>C, D, E, F, G, A, B — до, ре, ми, фа, соль, ля, си. В буквенных обозначениях аккордов B — си, B♭ — си-бемоль. В названиях тональностей действует академическая система: H-dur — си мажор, B-dur — си-бемоль мажор, a-moll — ля минор.</p><p>Формулы 1–3–5 и подобные отсчитываются от основного тона аккорда по мажорной шкале, а не от тоники текущей тональности. б. — большой, м. — малый, ч. — чистый, ув. — увеличенный, ум. — уменьшённый интервал. 9, 11 и 13 — нона, ундецима и терцдецима: секунда, кварта и секста через октаву.</p><p><b>9 ≠ add9 ≠ sus2.</b> В C9 есть малая септима; в Cadd9 её нет, но терция сохранена; в Csus2 секунда заменяет терцию. В C6 и C6/9 септима тоже не подразумевается. C6 — трезвучие с добавленной секстой, тогда как I6 в схемах курса — секстаккорд.</p><p>maj7 и maj9 означают большую септиму, m — минорную терцию. Без дополнительного указания 7 означает малую септиму, 9 и 13 — большие интервалы, 11 — чистый. ♭9, ♯9, ♯11 и ♭13 изменяют соответствующий интервал на полутон. Знак ♯11 не обязательно означает ноту с диезом.</p><p>У трезвучия два обращения: секстаккорд и квартсекстаккорд. У септаккорда три: квинтсекстаккорд, терцквартаккорд и секундаккорд. Для добавленных тонов, sus и расширенных составов здесь выбирается нижний звук; названия обращений септаккорда не переносятся на них автоматически. C/E задаёт ми в басу; V7/ii — побочную доминанту ко II ступени, не обращение.</p><p>В расширенных аккордах показан полный состав, чтобы были видны интервалы. В реальной фактуре не обязательно играть все звуки одновременно одной рукой: бас можно отделить, квинту и некоторые промежуточные надстройки опустить. Терция, септима и характерная надстройка обычно наиболее существенны; выбор зависит от мелодии и функции. 13 не требует неизменно играть все семь звуков. Обозначение alt задаёт семейство альтераций, а не единственный аккорд: точный вариант нужно оговаривать.</p><p>Кнопка «Обращения» в последовательностях меняет только расположение правой руки, не бас. Поэтому гармонические обозначения остаются прежними. В справочнике все звуки показаны на одном стане: «нижний звук» относится к самому примеру.</p></details><p class="reference-count" data-guide-count role="status"></p><div data-guide-results></div><div class="theory-sources"><a href="https://musictheory.pugetsound.edu/mt21c/LeadSheetSymbols.html" target="_blank" rel="noopener noreferrer">Music Theory for the 21st-Century Classroom — обозначения</a><a href="https://viva.pressbooks.pub/openmusictheory/chapter/chord-symbols/" target="_blank" rel="noopener noreferrer">Open Music Theory — add, sus и надстройки</a><a href="https://viva.pressbooks.pub/openmusictheory/chapter/jazz-voicings/" target="_blank" rel="noopener noreferrer">Open Music Theory — расположение аккордов</a></div>`;
 const drawAll=()=>guide.querySelectorAll('[data-chord-type]').forEach(c=>redraw(guide,c));
 const render=()=>{
  clearScores();
  const category=guide.querySelector('[data-guide-category]').value,q=guide.querySelector('[data-guide-search]').value.trim().toLocaleLowerCase('ru');
  const selected=TYPES.filter(t=>(category==='all'||t.category===category)&&(!q||[t.name,t.label,t.hint,t.formula,t.id].join(' ').toLocaleLowerCase('ru').includes(q)));
  guide.querySelector('[data-guide-count]').textContent=`Аккордов: ${selected.length} / ${TYPES.length}`;
  guide.querySelector('[data-guide-results]').innerHTML=CATEGORIES.map(c=>{
   const ts=selected.filter(t=>t.category===c.id);return ts.length?`<section class="guide-category"><h2>${c.name}</h2><p>${esc(c.note)}</p><div class="guide-grid">${ts.map(t=>cardHTML(t,inversions.get(t.id)||0)).join('')}</div></section>`:'';
  }).join('')||'<p class="empty">Ничего не найдено.</p>';
  drawAll();
 };
 guide.addEventListener('change',e=>{
  if(e.target.matches('[data-guide-root]'))drawAll();
  else if(e.target.matches('[data-inversion]')){const card=e.target.closest('[data-chord-type]');inversions.set(card.dataset.chordType,Number(e.target.value));redraw(guide,card);}
  else if(e.target.matches('[data-guide-category]'))render();
 });
 guide.addEventListener('input',e=>{if(e.target.matches('[data-guide-search]'))render();});
 render();
}
