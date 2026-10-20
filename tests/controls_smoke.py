from inline_helpers import choose_key, stop_card
"""Synthetic accounts only. Verify minimal controls and readable, non-overlapping score labels."""
import asyncio,functools,threading,json,os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
EXAMPLES=[
 {'id':'controls-basic','lesson_id':1,'title':'Плавные переходы','mode':'major','progression':['I','IV','V7','I']},
 {'id':'controls-sevenths','lesson_id':1,'title':'Септаккорды','mode':'major','progression':['Imaj7','vi7','ii7','V7','Imaj7']},
 {'id':'controls-pedal','lesson_id':1,'title':'Органный пункт','mode':'major','progression':[{'symbol':s,'bass':'5'} for s in ['I','IV','V7','I']]},
 {'id':'controls-modulation','lesson_id':1,'title':'Смена тональности','mode':'major','progression':['I','V7/vi',{'symbol':'i','mode':'minor','offset':9},{'symbol':'V7','mode':'minor','offset':9},{'symbol':'i','mode':'minor','offset':9}]},
 {'id':'controls-jazz','lesson_id':None,'genre':'jazz','title':'Нонаккорды','mode':'major','progression':['ii9','V9','Imaj9','Imaj9']}
]
for i,e in enumerate(EXAMPLES):
 e.update(position=i+1,goal='Тестовый пример.',discuss='Сравнить звучание.',loop=False,library_section='genres' if e.get('genre') else 'course')
 e['theory']={'notation':{'show_bass':e['id']=='controls-pedal'}}
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Проверка','title':'Движение голосов','goal':'Тест.','preparation':[],'topics':[]}], 'exercises':EXAMPLES,'progress':[],'favorites':[]}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 launch={'executable_path':os.environ['CHROMIUM_EXECUTABLE']} if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE') else {}
 browser=await engine.launch(**launch);ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<=1024)
 saved=[];writes=[]
 async def mock(route):
  path=route.request.url.split('?')[0]
  if path.endswith('/auth/v1/user'):data={'id':USER,'email':'ui@example.invalid','email_confirmed_at':'2026-01-01'}
  elif path.endswith('/auth/v1/settings'):data={'external':{'google':True}}
  elif path.endswith('/rest/v1/members'):data=[{'user_id':USER,'is_owner':False,'active':True}]
  else:
   name=path.rsplit('/',1)[-1];assert name in FIXTURE,path
   if route.request.method=='POST':
    assert name=='favorites';writes.append(name);saved.append(route.request.post_data_json)
   data=saved if name=='favorites' else FIXTURE[name]
  await route.fulfill(json=data)
 await ctx.route('https://*.supabase.co/**',mock)
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view={view}]').click()
 async def fits():
  await page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  diagnostic=await page.evaluate('''()=>{
   const bad=[];
   if(document.documentElement.scrollWidth>innerWidth+1)bad.push({document:document.documentElement.scrollWidth,viewport:innerWidth});
   for(const control of document.querySelectorAll('.exercise-actions button,.exercise-actions select,.mode-actions button,.mode-actions select,.guide-actions select')){
    const s=getComputedStyle(control),b=control.getBoundingClientRect();
    if(Math.abs(b.height-44)>.5||parseFloat(s.borderTopWidth)||parseFloat(s.borderRightWidth)||parseFloat(s.borderBottomWidth)||parseFloat(s.borderLeftWidth)||s.boxShadow!=='none'||b.left<-.5||b.right>innerWidth+.5)bad.push({control:control.outerHTML.slice(0,200),box:b.toJSON(),border:s.border,shadow:s.boxShadow});
   }
   for(const m of document.querySelectorAll('.exercise .score-measure')){
    const frame=m.querySelector('.beat-highlight').getBoundingClientRect();
    const labels=[...m.querySelectorAll('.score-degree,.score-chord,.score-key-caption')];
    for(const a of labels){
     const b=a.getBoundingClientRect();
     if(b.left<frame.left-1||b.right>frame.right+1)bad.push({label:a.textContent,right:b.right,limit:frame.right});
     for(const other of [...labels,...m.querySelectorAll('[data-hand=right] [data-note],.vf-accidental,.vf-stem')]){
      if(other===a)continue;const o=other.getBoundingClientRect();
      if(b.left<o.right-.5&&b.right>o.left+.5&&b.top<o.bottom-.5&&b.bottom>o.top+.5)bad.push({collision:[a.textContent,other.textContent||other.getAttribute('class')],boxes:[b.toJSON(),o.toJSON()]});
     }
    }
   }
   return bad;
  }''')
  if diagnostic:
   (OUT/f'controls-error-{engine.name}-{w}x{h}.json').write_text(json.dumps(diagnostic,ensure_ascii=False,indent=2))
   await page.screenshot(path=str(OUT/f'controls-error-{engine.name}-{w}x{h}.png'),full_page=True)
  assert not diagnostic,diagnostic[:5]
  assert await page.locator('.score-error').count()==0
 try:
  await page.goto(base+'#lesson-1',wait_until='networkidle')
  await expect(page.locator('.exercise')).to_have_count(4)
  first=page.locator('.exercise').first
  await expect(first.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')
  await first.locator('[data-voicing]').click()
  await expect(first.locator('[data-voicing]')).to_have_text('')
  await expect(first.locator('[data-voicing] .voice-head')).to_have_count(6)
  await expect(first.locator('[data-voicing]')).to_have_attribute('aria-label','С обращениями правой руки')
  await expect(first.locator('[data-voicing]')).to_have_attribute('title','Плавное голосоведение правой руки. Подобрать обращения правой руки')
  assert await first.locator('[data-bass]').inner_text()==''
  await expect(first.locator('[data-bass] svg.bass-control-icon path')).to_have_count(1)
  await expect(first.locator('[data-bass]')).to_have_attribute('aria-label','Басовая строка')
  icon=await first.locator('.bass-control-icon').bounding_box();assert icon['width']==18 and icon['height']==22
  assert await first.locator('[data-bass]').evaluate("b=>getComputedStyle(b).color")=='rgb(140, 132, 120)'
  for delta in ['-1','1']:
   await expect(first.locator(f'[data-shift="{delta}"] .transpose-icon')).to_have_count(1)
   assert await first.locator(f'[data-shift="{delta}"]').inner_text()==''
  await expect(first.locator('.score-degree').first).to_have_attribute('font-size','21')
  await expect(first.locator('.score-chord').first).to_have_attribute('font-size','18')
  await fits()
  await first.screenshot(path=str(OUT/f'controls-lesson-{engine.name}-{w}x{h}.png'))
  await first.locator('[data-bass] svg').click();await expect(first.locator('[data-bass]')).to_have_attribute('aria-pressed','true')
  before=await first.locator('[data-hand=left] [data-note]').evaluate_all('ns=>ns.map(n=>n.dataset.midi)')
  await first.locator('[data-voicing] svg').click();await expect(first.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')
  assert await first.locator('[data-hand=left] [data-note]').evaluate_all('ns=>ns.map(n=>n.dataset.midi)')==before
  await expect(first.locator('[data-voicing]')).to_have_text('');await fits()
  for selector in ['[data-bass]','[data-voicing]']:
   assert await first.locator(selector).evaluate("b=>getComputedStyle(b,'::after').opacity")=='1'
   await expect(first.locator(selector)).to_have_css('color','rgb(133, 83, 49)')
  if await page.evaluate("matchMedia('(pointer: coarse)').matches"):
   await expect(page.locator('#toast')).to_contain_text('Бас не меняется')
   assert await page.evaluate("localStorage.getItem('harmony.voicing-icon-help.v1')")=='1'
  await first.screenshot(path=str(OUT/f'controls-active-{engine.name}-{w}x{h}.png'))
  await first.locator('[data-shift="1"] svg').click();await expect(first.locator('[data-key]')).to_have_attribute('data-tonic','Db')
  await first.locator('[data-shift="-1"] svg').click();await expect(first.locator('[data-key]')).to_have_attribute('data-tonic','C')
  await first.locator('[data-bass]').focus();await page.keyboard.press('Enter')
  await expect(first.locator('[data-bass]')).to_have_attribute('aria-pressed','false')
  await page.keyboard.press('Tab')
  assert await page.evaluate('getComputedStyle(document.activeElement).outlineStyle')=='solid'
  assert float(await page.evaluate('parseFloat(getComputedStyle(document.activeElement).outlineWidth)'))>=2
  await first.locator('[data-play]').click();await expect(page.locator('[data-play][aria-pressed="true"]')).to_have_count(1)
  await stop_card(page)
  await nav('library');await expect(page.locator('.exercise')).to_have_count(5)
  for tonic in ['C','Db','F#','B','Bb']:
   for select in await page.locator('[data-key]').all():await choose_key(select,tonic)
   await fits()
  await page.select_option('#pattern','arpeggio');await fits()
  await page.select_option('#pattern','chords')
  jazz=page.locator('[data-eid=controls-jazz]')
  await jazz.locator('[data-bass]').click();await jazz.locator('[data-voicing]').click();await fits()
  await jazz.screenshot(path=str(OUT/f'controls-jazz-{engine.name}-{w}x{h}.png'))
  # Stress the planner with realistic long labels without changing pitches or stored content.
  await page.evaluate('''async()=>{const v=(await (await fetch('./version.json')).json()).version;
   const {compile}=await import('./music.js?v='+v),{renderScore}=await import('./notation.js?v='+v);
   const score=compile(['I','IV','V7','I'],{tonic:'F#',mode:'major'});
   for(const b of score.bars){b.symbol='vii°7/♭VII';b.name='G♯m(maj7)';}
   renderScore(document.querySelector('.exercise .score'),score,{showBass:true});
  }''');await fits()
  await first.locator('[data-star]').click();await nav('favorites');await expect(page.locator('.exercise')).to_have_count(1);await fits()
  await nav('modes');await expect(page.locator('.mode-card')).to_have_count(44)
  await page.select_option('[data-modes-category]','diatonic');await fits()
  mode=page.locator('.mode-card').first
  await expect(mode.locator('[data-scale-shift] .transpose-icon')).to_have_count(2)
  await mode.locator('[data-scale-shift="-1"] svg').click();await expect(mode.locator('[data-scale-root]')).to_have_value('B')
  await mode.locator('[data-scale-shift="1"] svg').click();await expect(mode.locator('[data-scale-root]')).to_have_value('C')
  await mode.screenshot(path=str(OUT/f'controls-mode-{engine.name}-{w}x{h}.png'))
  await page.locator('[data-scale-play]').first.click();await expect(page.locator('[data-scale-play]').first).to_have_attribute('aria-pressed','true')
  await page.locator('[data-scale-play]').first.click()
  await nav('reference');await expect(page.locator('.guide-card')).to_have_count(44);await fits()
  await page.locator('.guide-card').first.screenshot(path=str(OUT/f'controls-reference-{engine.name}-{w}x{h}.png'))
  if w>h and h<=520:await expect(page.locator('.topbar')).to_be_hidden()
  # The touch explanation must not be repeated on another page load.
  await page.goto(base+'?hint-reload#lesson-1',wait_until='networkidle')
  await page.locator('[data-voicing]').first.click()
  if await page.evaluate("matchMedia('(pointer: coarse)').matches"):await expect(page.locator('#toast')).to_be_hidden()
  assert writes==['favorites'],writes
  assert not errors,errors
  print(f'PASS {engine.name} {w}x{h}: 44px borderless icon controls, smaller muted bass, active dots, direction arrows, one-time hint, keyboard focus, score labels, transposition, audio and all reference views',flush=True)
 finally:await ctx.close();await browser.close()
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,320,812),(p.chromium,768,1024),(p.chromium,1440,960),(p.webkit,375,812),(p.webkit,932,430)]:
    if os.environ.get('CHROMIUM_ONLY') and engine.name!='chromium':continue
    await scenario(engine,w,h,f'http://127.0.0.1:{server.server_port}/')
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
