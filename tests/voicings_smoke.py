from inline_helpers import choose_key, stop_card
"""Synthetic course and real engraving/audio path. Never sends live Auth requests."""
import asyncio, functools, os, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'dist';OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
THEORY={'sections':[{'title':'Проверка','paragraphs':['Сравни до мажор и ля минор. Затем сыграй в си-бемоль мажоре и си миноре.']} ]}
EXAMPLES=[
 {'id':'voice-basic','title':'Плавные переходы','mode':'major','progression':['I','IV','V','I']},
 {'id':'voice-sevenths','title':'Септаккорды','mode':'major','progression':['Imaj7','vi7','ii7','V7'],'loop':True},
 {'id':'voice-pedal','title':'Органный пункт','mode':'minor','progression':[{'symbol':'i','bass':'5'},{'symbol':'iv','bass':'5'},{'symbol':'V7','bass':'5'},{'symbol':'i','bass':'1'}]},
 {'id':'voice-line','title':'Нисходящая линия','mode':'major','progression':['I','V6','vi','iii6','IV','I6','ii7','V7','I'],'theory':{'notation':{'show_bass':True,'bass_offsets':[12,11,9,7,5,4,2,7,12]}}},
 {'id':'voice-change','title':'Смена тональности','mode':'major','progression':['I','V7/vi',{'symbol':'i','mode':'minor','offset':9},{'symbol':'V7','mode':'minor','offset':9},{'symbol':'i','mode':'minor','offset':9}]}
]
for i,e in enumerate(EXAMPLES):
 e.update(lesson_id=1,position=i+1,goal='Сравнить положения.',discuss='Обратить внимание на движение правой руки.')
 e.setdefault('theory',THEORY);e.setdefault('loop',False)
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Проверка интерфейса','title':'Расположения правой руки','goal':'Сыграть в до мажоре.','preparation':['Повторить ля минор.'],'topics':['Основной тон и бас.'],'theory':THEORY}], 'exercises':EXAMPLES,'favorites':[], 'progress':[{'user_id':USER,'lesson_id':1,'notes':'Личная заметка: до мажор.'}]}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 launch={'executable_path':os.environ['CHROMIUM_EXECUTABLE']} if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE') else {}
 browser=await engine.launch(**launch);ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<=1024)
 changes={'favorites':[],'progress':FIXTURE['progress'][:], 'writes':0}
 async def mock(route):
  path=route.request.url.split('?')[0]
  if path.endswith('/auth/v1/user'):data={'id':USER,'email':'synthetic@example.invalid','email_confirmed_at':'2026-01-01'}
  elif path.endswith('/auth/v1/settings'):data={'external':{'google':True}}
  elif path.endswith('/rest/v1/members'):data=[{'user_id':USER,'is_owner':True,'active':True}]
  else:
   name=path.rsplit('/',1)[-1];assert name in FIXTURE,path
   if route.request.method=='POST':changes['writes']+=1;changes[name]=[route.request.post_data_json];data=changes[name]
   else:data=changes.get(name,FIXTURE[name])
  await route.fulfill(json=data)
 await ctx.route('https://*.supabase.co/**',mock)
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 async def note_values(card,hand='right'):
  return await card.locator(f'[data-hand={hand}] [data-note]').evaluate_all('ns=>ns.map(n=>({midi:+n.dataset.midi,note:n.dataset.note,beat:+n.dataset.beat,duration:+n.dataset.duration}))')
 async def fits():
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert not await page.evaluate('''()=>[...document.querySelectorAll('.score-document')].some(svg=>{
   const v=svg.viewBox.baseVal,m=svg.getScreenCTM().inverse();
   return [...svg.querySelectorAll('[data-note],.vf-accidental,.vf-clef')].some(n=>{const b=n.getBoundingClientRect(),a=new DOMPoint(b.left,b.top).matrixTransform(m),z=new DOMPoint(b.right,b.bottom).matrixTransform(m);return a.x< -1||a.y< -1||z.x>v.width+1||z.y>v.height+1});})''')
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view={view}]').click()
 try:
  await page.goto(base,wait_until='networkidle');await page.locator('.course-card').first.click()
  cards=page.locator('.exercise');await expect(cards).to_have_count(5)
  await expect(page.locator('[data-bass] + [data-voicing]')).to_have_count(5)
  assert await page.locator('[data-key]').first.inner_text()=='C-dur'
  assert await page.locator('[data-key]').nth(2).inner_text()=='a-moll'
  await expect(page.locator('#notes')).to_have_value('Личная заметка: до мажор.')
  await page.locator('.lesson-theory>summary').click()
  await expect(page.locator('.lesson-theory .theory-body')).to_contain_text('C-dur и a-moll')
  await expect(page.locator('.lesson-theory .theory-body')).to_contain_text('B-dur и h-moll')
  await page.locator('.lesson-theory>summary').click()
  await page.evaluate('''async()=>{const version=(await (await fetch('./version.json')).json()).version;
   const {Player}=await import('./audio.js?v='+version);const original=Player.prototype.play;
   window.plays=[];Player.prototype.play=function(score,options){window.plays.push(JSON.parse(JSON.stringify(score)));return original.call(this,score,options)};}''')
  originals=[]
  for card in await cards.all():
   await expect(card.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')
   await card.locator('[data-voicing]').click()
   originals.append(await note_values(card));bass=await note_values(card,'left');symbol=await card.locator('.roman').inner_text()
   await card.locator('[data-voicing]').click();await expect(card.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')
   assert await note_values(card,'left')==bass
   assert await card.locator('.roman').inner_text()==symbol
   await expect(card.locator('svg.score-document')).to_have_attribute('data-rh-voicings','true')
  first=cards.first
  connected=await note_values(first);assert connected!=originals[0]
  await fits()
  if w>h and h<=520:await expect(page.locator('.topbar')).to_be_hidden()
  await first.locator('[data-bass]').click();await fits()
  await first.screenshot(path=str(OUT/f'voicings-{engine.name}-{w}x{h}.png'))
  await first.locator('[data-voicing]').click();assert await note_values(first)==originals[0]
  await first.locator('[data-voicing]').click();assert await note_values(first)==connected
  await choose_key(first.locator('[data-key]'),'B')
  await expect(first.locator('[data-key]')).to_have_text('H-dur')
  await expect(first.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')
  await choose_key(first.locator('[data-key]'),'Bb')
  await expect(first.locator('[data-key]')).to_have_text('B-dur')
  await page.select_option('#pattern','arpeggio');await fits()
  await expect(first.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')
  await first.locator('[data-play]').click();await expect(page.locator('[data-play][aria-pressed="true"]')).to_have_count(1)
  played=await page.evaluate('plays.at(-1)')
  expected=[{'midi':n['midi'],'note':'','beat':event['beat'],'duration':event['duration']} for b in played['bars'] for event in b['rh'] for n in event['notes']]
  actual=await note_values(first)
  assert [(n['midi'],n['beat'],n['duration']) for n in actual]==[(n['midi'],n['beat'],n['duration']) for n in expected]
  count=await page.evaluate('plays.length');await first.locator('[data-bass]').click()
  assert await page.evaluate('plays.length')==count
  await first.locator('[data-voicing]').click()
  assert await page.evaluate('plays.length')==count+1
  assert not (await page.evaluate('plays.at(-1)')).get('rightHandVoicings',False)
  await first.locator('[data-voicing]').click()
  assert (await page.evaluate('plays.at(-1)'))['rightHandVoicings']
  await stop_card(page);assert changes['writes']==0
  await page.select_option('#pattern','chords')
  await first.locator('[data-star]').click();await nav('favorites')
  await expect(page.locator('.exercise')).to_have_count(1)
  await expect(page.locator('[data-voicing]')).to_have_attribute('aria-pressed','true')
  await nav('library');await expect(page.locator('[data-voicing]')).to_have_count(5)
  await expect(page.locator('[data-voicing]').first).to_have_attribute('aria-pressed','true');await fits()
  assert await page.locator('[data-zoom],[data-download],#midi').count()==0
  assert not errors,errors
  print(f'PASS {engine.name} {w}x{h}: voicing toggle, exact bass preservation, shared audio pitches, German key labels, unchanged personal notes, reflow and all views',flush=True)
 finally:await ctx.close();await browser.close()
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(PUBLIC)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   cases=[(p.chromium,320,812),(p.chromium,1440,960),(p.webkit,375,812),(p.webkit,932,430)]
   for engine,w,h in cases:
    if os.environ.get('CHROMIUM_ONLY') and engine.name!='chromium':continue
    await scenario(engine,w,h,f'http://127.0.0.1:{server.server_port}/')
 finally:server.shutdown()
asyncio.run(main())
