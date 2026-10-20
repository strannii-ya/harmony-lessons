from pathlib import Path
import re
root=Path.cwd()
def update(path,fn):
 p=root/path; old=p.read_text(); new=fn(old); assert old!=new,path; p.write_text(new)
(root/'site/card-playback.js').write_text('''import { Player } from './audio.js';
/** One transport for all score cards. Fixed tempo; never opens a floating panel. */
export const CARD_TEMPO=90;
export const playIcon=playing=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${playing?'M6 6h12v12H6z':'M8 5v14l11-7z'}" fill="currentColor"/></svg>`;
export function setPlayButton(button,playing,label){
 if(!button)return;
 button.innerHTML=playIcon(playing);
 button.setAttribute('aria-pressed',String(playing));
 button.setAttribute('aria-label',(playing?'Остановить: ':'Воспроизвести: ')+label);
 button.title=playing?'Остановить':'Воспроизвести';
}
export class CardPlayback {
 constructor(engine=new Player()){this.engine=engine;this.active=null;}
 isPlaying(key){return this.active?.key===key;}
 stop(){
  const previous=this.active;this.active=null;
  this.engine.stop();
  if(previous){setPlayButton(previous.button,false,previous.label);previous.clear?.();}
 }
 async toggle(options){
  if(this.isPlaying(options.key)){this.stop();return;}
  return this.start(options);
 }
 async start({key,score,button,label,onChord=()=>{},clear=()=>{}}){
  this.stop();
  const current={key,button,label,clear};this.active=current;
  setPlayButton(button,true,label);
  try{
   await this.engine.play(score,{bpm:CARD_TEMPO,hand:'both',loop:false,
    onChord:index=>{if(this.active===current)onChord(index);},
    onStop:()=>{
     if(this.active!==current)return;
     this.active=null;setPlayButton(button,false,label);clear();
    }});
  }catch(error){
   // A stale failure must not stop or reset a newer card.
   if(this.active!==current)return;
   this.stop();throw error;
  }
 }
}
export const cardPlayback=new CardPlayback();
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',()=>cardPlayback.stop());
 window.addEventListener('beforeprint',()=>cardPlayback.stop());
}
''')
update('site/audio.js',lambda s:s.replace('this.running=false;}','this.running=false;this.generation=0;}').replace('this.stop();this.context??=new AudioContext();await this.context.resume();this.running=true;','this.stop();const generation=this.generation;this.context??=new AudioContext();await this.context.resume();if(generation!==this.generation)return;this.running=true;').replace('stop(){clearInterval(this.timer);','stop(){this.generation++;clearInterval(this.timer);').replace('this.stopCallback?.();this.stopCallback=null;','const callback=this.stopCallback;this.stopCallback=null;callback?.();'))
def app(s):
 s=s.replace("import { Player } from './audio.js';","import { cardPlayback as player, playIcon } from './card-playback.js';")
 s=s.replace("import { KEYS, transposeKey }", "import { transposeKey }").replace("loop:false,bpm:72,hand:'both',",'')
 s=s.replace('const player=new Player(),explainVoicing=makeVoicingHint();','const explainVoicing=makeVoicingHint();').replace('inversions:false','inversions:true')
 s=s.replace("$('#player').hidden=true;",'').replace(" $('#lesson-count').textContent=state.data.lessons.length;\n",'')
 s=s.replace("mountGuide(document.querySelector('.chord-guide'));", "mountGuide(document.querySelector('.chord-guide'),notify);")
 s=s.replace('<small>Упражнений: ${exercisesFor(l.id).length}</small>','').replace('class="roman progression-frame"','class="roman progression-frame mode-formula"')
 s=s.replace('data-play="${esc(e.id)}" title="Воспроизвести"','data-play="${esc(e.id)}" aria-pressed="false" title="Воспроизвести"')
 s=s.replace('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>', '${playIcon(false)}')
 s=re.sub(r'<select aria-label="Тональность упражнения" data-key="\$\{esc\(e.id\)\}">.*?</select>', '<span class="key-name" data-key="${esc(e.id)}" data-tonic="${esc(s.tonic)}" aria-label="Тональность упражнения" aria-live="polite">${keyLabel(s.tonic,s.mode)}</span>', s, count=1)
 s=s.replace('function renderResults(){\n clearScores();','function renderResults(){\n player.stop();clearScores();')
 start=s.index('async function startPlayback(id)');end=s.index('async function persistProgress',start)
 s=s[:start]+'''async function startPlayback(id,{restart=false}={}){
 const key='exercise:'+id;
 if(!restart&&player.isPlaying(key)){player.stop();return;}
 state.selected=id;
 const e=exerciseBy(id),score=draw(id),card=document.querySelector(`[data-eid="${CSS.escape(id)}"]`);
 if(!card)return;
 await player.start({key,score,button:card.querySelector('[data-play]'),label:academicKeyNames(e.title),
  onChord:i=>card.querySelectorAll('.score-measure').forEach(n=>n.classList.toggle('playing',Number(n.dataset.scoreBar)===i)),
  clear:()=>card.querySelectorAll('.playing').forEach(n=>n.classList.remove('playing'))});
}
async function refreshExercise(id){
 player.stop();draw(id);
 const e=exerciseBy(id),s=settings(e),label=document.querySelector(`[data-key="${CSS.escape(id)}"]`);
 if(label){label.textContent=keyLabel(s.tonic,s.mode);label.dataset.tonic=s.tonic;}
}
'''+s[end:]
 s=s.replace('const playing=player.running&&state.selected===e.id;',"const playing=player.isPlaying('exercise:'+e.id);")
 s=s.replace('if(playing)await startPlayback(e.id);','if(playing)await startPlayback(e.id,{restart:true});')
 for prefix in [" if(b.id==='play-toggle')", " if(b.id==='close-player')", " if(b.id==='loop')", "$('#tempo').addEventListener"]:
  s='\n'.join(line for line in s.split('\n') if not line.startswith(prefix))
 s=s.replace("if(t.dataset.key){const e=exerciseBy(t.dataset.key);state.settings.set(e.id,{...settings(e),tonic:t.value});await refreshExercise(e.id);}",'')
 s=s.replace("if(t.id==='hand'){state.hand=t.value;if(player.running)await startPlayback(state.selected);}",'')
 s=s.replace('if(player.running)player.stop();else protect(startPlayback)(state.selected);',"if(player.active)player.stop();else protect(startPlayback)(state.selected);")
 assert "$('#player')" not in s
 return s
update('site/app.js',app)
def modes(s):
 s=s.replace("import { Player } from './audio.js';", "import { cardPlayback, playIcon as icon } from './card-playback.js';")
 s='\n'.join(l for l in s.split('\n') if not l.startswith('const icon='))
 s=s.replace('const player=new Player();let mounted=null,abort=null,active=null,generation=0,starting=false;', 'let mounted=null,abort=null;')
 a=s.index('function resetPlaying()');b=s.index('export function clearModes()',a)
 s=s[:a]+"export function stopModes(){if(cardPlayback.active?.key.startsWith('mode:'))cardPlayback.stop();}\n"+s[b:]
 a=s.index('async function play(id)');b=s.index('export function mountModes',a)
 s=s[:a]+'''async function play(id){
 const root=mounted,card=root.querySelector(`[data-mode-card="${id}"]`);
 await cardPlayback.toggle({key:'mode:'+id,score:draw(id),button:card.querySelector('[data-scale-play]'),label:modeById(id).name,
  onChord:index=>{
   card.querySelectorAll('.current-note').forEach(n=>n.classList.remove('current-note'));
   card.querySelector(`[data-scale-note-index="${index}"]`)?.classList.add('current-note');
  },clear:()=>card.querySelectorAll('.current-note').forEach(n=>n.classList.remove('current-note'))});
}
'''+s[b:]
 return s
update('site/modes.js',modes)
def guide(s):
 s="import { cardPlayback, playIcon, setPlayButton } from './card-playback.js';\n"+s
 s=s.replace("renderScore(card.querySelector('[data-guide-score]'),x.score,{scale:1,showMeter:false,showLabels:false});", "renderScore(card.querySelector('[data-guide-score]'),x.score,{scale:1,showMeter:false,showLabels:false});\n setPlayButton(card.querySelector('[data-chord-play]'),false,x.name);\n return x;")
 s=s.replace('<div class="guide-actions"><label>','<div class="guide-actions"><button type="button" class="icon-play" data-chord-play="${t.id}" aria-label="Воспроизвести: ${esc(x.name)}" aria-pressed="false">${playIcon(false)}</button><label>')
 s=s.replace('export function mountGuide(guide){','export function mountGuide(guide,notify=()=>{}){').replace('  clearScores();','  cardPlayback.stop();clearScores();')
 s=s.replace(" guide.addEventListener('change',e=>{", " guide.addEventListener('change',e=>{\n  cardPlayback.stop();")
 insertion=''' guide.addEventListener('click',async e=>{
  const button=e.target.closest('[data-chord-play]');if(!button)return;
  const card=button.closest('[data-chord-type]'),key='chord:'+card.dataset.chordType;
  if(cardPlayback.isPlaying(key)){cardPlayback.stop();return;}
  try{
   const x=redraw(guide,card);
   await cardPlayback.start({key,button,score:x.score,label:x.name,
    onChord:()=>card.querySelector('.score-measure')?.classList.add('playing'),
    clear:()=>card.querySelectorAll('.playing').forEach(n=>n.classList.remove('playing'))});
  }catch(error){notify(error.message||'Не удалось воспроизвести аккорд');}
 });
'''
 return s.replace(" guide.addEventListener('input',e=>",insertion+" guide.addEventListener('input',e=>")
update('site/chord-guide.js',guide)
update('site/index.html',lambda s:re.sub(r' <section id="player"[^\n]+\n','',s).replace('<b id="lesson-count">23</b>',''))
update('site/mobile.js',lambda s:s.replace("document.querySelector('.workspace').inert=open;document.querySelector('#player').inert=open;landscapeMenu.inert=open;", "document.querySelector('.workspace').inert=open;landscapeMenu.inert=open;").replace(" const playing=!document.querySelector('#player').hidden&&signedIn;\n if(body.classList.contains('player-visible')!==playing)body.classList.toggle('player-visible',playing);\n",'').replace("for(const id of ['#player','#shell'])", "for(const id of ['#shell'])"))
css='''
/* Matching formulas, quiet favorites, and a compact text-only sidebar. */
#content .roman.progression-frame {
  display: block; border: 0; box-shadow: none; background: #f8f3e9;
  color: #694d2e; border-radius: 7px; padding: 7px 10px;
  font: 16px/1.6 var(--serif); letter-spacing: normal;
}
#content .favorite-control { color: #aaa397; }
#content .favorite-control[aria-pressed="true"] { color: #92744f; }
#content .exercise-actions .key-name {
  display: inline-flex; align-items: center; justify-content: center;
  width: 88px; min-width: 88px; height: 44px; padding: 0 3px;
  font-family: inherit; font-size: 16px; font-weight: 500; line-height: 1.4; color: var(--text); white-space: nowrap;
}
#content .guide-actions { display: flex; align-items: center; gap: 8px; }
#content .guide-actions > label { min-width: 0; flex: 1; }
#content .guide-actions .icon-play {
  display: inline-flex; align-items: center; justify-content: center;
  flex: 0 0 44px; width: 44px; height: 44px; padding: 0;
  color: var(--accent); border: 0; box-shadow: none; background: transparent;
}
#content .guide-actions .icon-play svg { width: 26px; height: 26px; }
#sidebar .primary-nav { display: grid; gap: 6px; }
#sidebar .primary-nav button {
  background: #ede7dd; border: 0; color: #514b42; box-shadow: none;
}
#sidebar .primary-nav button.active { background: #ddceb7; color: #593b20; }
#sidebar .primary-nav button:hover { background: #e5daca; color: #593b20; }
aside#sidebar { padding-bottom: max(56px, env(safe-area-inset-bottom)); }
aside#sidebar .sidebar-bottom {
  padding: 2px 0; margin-top: 8px; min-height: 0;
  bottom: max(4px, env(safe-area-inset-bottom));
}
#sidebar .sidebar-bottom #signout { min-height: 44px; height: 44px; padding: 4px 10px; font-size: 14px; }
@media (max-width: 900px), (orientation: landscape) and (max-height: 520px) and (max-width: 1024px) {
  aside#sidebar { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
  aside#sidebar .sidebar-bottom { position: static; width: 100%; margin-top: 8px; padding: 2px 0; }
}
@media (max-width: 600px) { #content .roman.progression-frame { font-size: 15px; } }
'''
update('site/card-layout.css',lambda s:s+css)
(root/'tests/inline_helpers.py').write_text('''"""Operate the user-facing arrow-only key picker, not a hidden select."""
async def choose_key(label, tonic):
    card=label.locator('xpath=ancestor::article[1]')
    for _ in range(12):
        if await label.get_attribute('data-tonic')==tonic:
            return
        await card.locator('[data-shift="1"]').click()
    assert await label.get_attribute('data-tonic')==tonic, tonic

async def stop_card(page):
    button=page.locator('[data-play][aria-pressed="true"], [data-scale-play][aria-pressed="true"], [data-chord-play][aria-pressed="true"]')
    assert await button.count()==1
    await button.click()
''')
for path in root.glob('tests/*smoke.py'):
 if path.name=='inline_smoke.py':continue
 s=path.read_text();old=s
 s=re.sub(r"await ((?:first|descent|page)\.locator\('\[data-key\]'\)(?:\.first)?)(?:\.select_option)\(([^)]+)\)",r'await choose_key(\1,\2)',s)
 s=s.replace('await select.select_option(tonic)','await choose_key(select,tonic)')
 s=s.replace(".locator('[data-key]').first.locator('option:checked')", ".locator('[data-key]').first").replace(".locator('[data-key]').nth(2).locator('option:checked')", ".locator('[data-key]').nth(2)").replace('[data-key] option:checked','[data-key]')
 s=re.sub(r"(await expect\([^\n;]*?\[data-key\][^\n;]*?\))\.to_have_value\(([^)]+)\)",r"\1.to_have_attribute('data-tonic',\2)",s)
 s=s.replace("await expect(page.locator('#player')).to_be_visible()", "await expect(page.locator('[data-play][aria-pressed=\"true\"]')).to_have_count(1)").replace("await expect(page.locator('#player')).to_be_hidden()", "await expect(page.locator('#player')).to_have_count(0)")
 s=s.replace("await page.locator('#close-player').click()", 'await stop_card(page)').replace("await expect(page.locator('#play-toggle')).to_have_text('■')", "await expect(descent.locator('[data-play]')).to_have_attribute('aria-pressed','true')")
 s=s.replace("await page.locator('#hand').select_option('left');await fits('player')", "await expect(page.locator('#hand,#tempo,#player')).to_have_count(0);await fits('inline player')")
 if path.name=='voicings_smoke.py':s=s.replace("   originals.append(await note_values(card));", "   await expect(card.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')\n   await card.locator('[data-voicing]').click()\n   originals.append(await note_values(card));")
 if path.name=='controls_smoke.py':s=s.replace("  first=page.locator('.exercise').first", "  first=page.locator('.exercise').first\n  await expect(first.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')\n  await first.locator('[data-voicing]').click()")
 if s!=old:path.write_text('from inline_helpers import choose_key, stop_card\n'+s)
p=root/'.github/workflows/pages.yml';s=p.read_text().replace('      - name: Verify session renewal, loading screens and disclosure typography','      - name: Verify inline card playback and simplified navigation\n        run: python tests/inline_smoke.py\n      - name: Verify session renewal, loading screens and disclosure typography')
s=s.replace("                  assert 'id=\"midi\"' not in html", "                  assert 'id=\"midi\"' not in html\n                  assert 'id=\"player\"' not in html and 'id=\"lesson-count\"' not in html")
s=s.replace("                  assert 'mountAccess' in app", "                  assert 'inversions:true' in app and 'class=\"key-name\"' in app\n                  assert 'CARD_TEMPO=90' in read('card-playback.js?v='+version)\n                  assert 'mountAccess' in app")
p.write_text(s)
