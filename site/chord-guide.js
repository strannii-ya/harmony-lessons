import { TYPES,ROOTS,example,inversionNames,ruNote } from './chord-model.js';
import { KEY_RU } from './music.js';
import { renderScore } from './notation.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const guideHTML=(standalone=false)=>standalone?'<section class="chord-guide standalone-guide" aria-label="Справочник аккордов"><div class="guide-content"></div></section>':'<details class="chord-guide notation-key"><summary>Обозначения аккордов и обращения</summary><div class="guide-content"></div></details>';
function redraw(guide,card){
 const x=example(card.dataset.chordType,guide.querySelector('[data-guide-root]').value,Number(card.querySelector('[data-inversion]').value));
 card.querySelector('[data-chord-name]').textContent=x.name;
 card.querySelector('[data-guide-notes]').textContent=x.notes.map(ruNote).join(' – ');
 card.querySelector('[data-guide-bass]').textContent=ruNote(x.bass)+' — '+['основной','терцовый','квинтовый','септимовый'][x.inversion]+' тон';
 card.querySelector('[data-bass-intervals]').textContent=x.fromBass.join(' · ');
 renderScore(card.querySelector('[data-guide-score]'),x.score,{scale:1,showMeter:false,showLabels:false});
}
export function mountGuide(guide){
 if(guide.dataset.ready)return;
 guide.dataset.ready='true';
 const container=guide.querySelector('.guide-content');
 container.innerHTML=`<p>Выбери основной тон, затем сравни строение аккордов и их обращения. Названия, интервалы и ноты меняются вместе.</p><label class="guide-root">Основной тон примеров<select data-guide-root aria-label="Основной тон примеров">${ROOTS.map(r=>`<option value="${r}">${KEY_RU[r]||r}</option>`).join('')}</select></label><details class="guide-explanation"><summary>Как читать обозначения</summary><p>C, D, E, F, G, A, B — до, ре, ми, фа, соль, ля, си. Здесь B — си, B♭ — си-бемоль; в немецкой традиции си обозначают H.</p><p>maj, m, dim и aug описывают строение, а не гармоническую функцию. Формулы 1–3–5 и подобные отсчитываются от основного тона аккорда по мажорной шкале; это не номера ступеней текущей тональности. б. — большой, м. — малый, ч. — чистый, ув. — увеличенный, ум. — уменьшённый интервал. Большая терция содержит 4 полутона, малая — 3.</p><p>Римская цифра отвечает на вопрос: на какой ступени тональности построен аккорд? Вид аккорда уточняют регистр цифры и дополнительные знаки. Функция зависит от контекста. В схемах этого курса ♭III, ♭VI и ♭VII отсчитываются от одноимённого мажора; в миноре vii обозначает повышенную VII ступень.</p><p>В обращении нижним становится терцовый, квинтовый или септимовый тон; основной тон и вид аккорда сохраняются. В примерах все звуки показаны в скрипичном ключе: басом здесь называется нижний звук этого созвучия, а не отдельная партия левой руки.</p><p>У трезвучия два обращения: секстаккорд (6) и квартсекстаккорд (6₄). У септаккорда три: квинтсекстаккорд (6₅), терцквартаккорд (4₃), секундаккорд (4₂). Цифры помогают прочитать характерные интервалы над басом. Большими, малыми или уменьшёнными они будут в зависимости от строения самого аккорда.</p><p>C/E означает до-мажорный аккорд с ми в басу. V7/ii означает побочную доминанту ко II ступени, а не бас обращения. C6 в буквенно-цифровой записи — аккорд с добавленной секстой; I6 в наших ступеневых схемах — секстаккорд I ступени. Эти системы нельзя смешивать.</p></details><div class="guide-grid">${TYPES.map(t=>{
 const x=example(t.id);
 return `<article class="guide-card" data-chord-type="${t.id}"><header><strong>${esc(t.label)}</strong><h3>${esc(t.name)}</h3><span data-chord-name>${esc(x.name)}</span></header><div data-guide-score class="score"></div><div class="guide-actions"><label>Обращение<select data-inversion aria-label="Обращение: ${esc(t.name)}">${inversionNames(t.semi.length).map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('')}</select></label></div><dl><dt>Формула</dt><dd>${t.formula}</dd><dt>Терции снизу вверх, основной вид</dt><dd>${x.chain.join(' + ')}</dd><dt>Интервалы от основного тона</dt><dd>${x.fromRoot.join(' · ')}</dd><dt>Звуки снизу вверх</dt><dd data-guide-notes></dd><dt>Нижний звук</dt><dd data-guide-bass></dd><dt>Интервалы над ним</dt><dd data-bass-intervals></dd></dl><details class="guide-explanation"><summary>Пояснение</summary><p>${esc(t.hint)}</p></details></article>`;
 }).join('')}</div><div class="theory-sources"><a href="https://old.bigenc.ru/music/text/2674683" target="_blank" rel="noopener noreferrer">Обращение аккорда — БРЭ</a> · <a href="https://musictheory.pugetsound.edu/mt21c/SeventhChordsIntroduction.html" target="_blank" rel="noopener noreferrer">Строение септаккордов</a> · <a href="https://musictheory.pugetsound.edu/mt21c/LeadSheetSymbols.html" target="_blank" rel="noopener noreferrer">Буквенные обозначения</a></div>`;
 const drawAll=()=>guide.querySelectorAll('[data-chord-type]').forEach(c=>redraw(guide,c));
 guide.addEventListener('change',e=>{
  if(e.target.matches('[data-guide-root]'))drawAll();
  else if(e.target.matches('[data-inversion]'))redraw(guide,e.target.closest('[data-chord-type]'));
 });
 drawAll();
}