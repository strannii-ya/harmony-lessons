"""Synthetic fixtures: light UI, continuous VexFlow scores, reference, and private theory rendering."""
import asyncio,functools,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
THEORY={'sections':[{'title':'Сначала послушай','paragraphs':['Сыграй оборот целиком, затем найди его тонику. Это синтетический пример для проверки страницы.']},{'title':'Голосоведение','paragraphs':['Основной тон и бас различаются в обращениях.']}], 'sources':[{'url':'https://example.org','label':'Справочный материал'},{'url':'javascript:alert(1)','label':'must-not-render'}], 'figure':{'steps':[{'label':'T','note':'Тоника'},{'label':'S','note':'Субдоминанта'},{'label':'D','note':'Доминанта'},{'label':'T','note':'Возвращение'}],'caption':'Тестовая схема.'}}
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Проверка','title':'Септаккорды и обращения','goal':'Тестовая подготовка.','preparation':['Построить аккорды.'],'topics':['Основной тон и бас.'],'theory':THEORY}], 'exercises':[{'id':'sample-1','lesson_id':1,'position':1,'title':'Разрешение и продолжение','mode':'major','loop':False,'progression':['I','vi7','ii7','V7','I','IV','iv','I'],'goal':'Сравнить окончания.','discuss':'Проследить движение голосов.','theory':THEORY},{'id':'sample-2','lesson_id':1,'position':2,'title':'Минорная каденция','mode':'minor','loop':False,'progression':['i','iiø7','V7','i'],'goal':'Найти вводный тон.','discuss':'Сыграть окончание.','theory':THEORY},{'id':'sample-3','lesson_id':1,'position':3,'title':'Половинные ноты','mode':'major','loop':False,'progression':[{'symbol':'I','beats':2},{'symbol':'V7','beats':2}],'goal':'Проверить запись.','discuss':'Сравнить длительности.','theory':THEORY}], 'progress':[], 'favorites':[]}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,width,height,base,mode):
 browser=await engine.launch()
 ctx=await browser.new_context(viewport={'width':width,'height':height},has_touch=width<1025)
 state={'favorites':[],'progress':[],'private_calls':0}
 async def mock(route):
  path=route.request.url.split('?')[0]
  if '/auth/v1/user' in path:data={'id':USER,'email':'fixture@example.invalid','email_confirmed_at':'2026-01-01'}
  elif '/rest/v1/members' in path:data=[{'user_id':USER}]
  elif '/auth/v1/settings' in path:data={'external':{'google':True}}
  elif '/rest/v1/' in path:
   name=path.rsplit('/',1)[-1];assert name in FIXTURE,path
   state['private_calls']+=1
   if route.request.method=='POST':row=route.request.post_data_json;state[name]=[row];data=[row]
   elif route.request.method=='DELETE':state[name]=[];data=[]
   else:data=state[name] if name in state else FIXTURE[name]
  else:raise AssertionError('Unexpected live API call: '+path)
  await route.fulfill(json=data)
 await ctx.route('https://*.supabase.co/**',mock)
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'fixture-only',refresh_token:'fixture-only',expires_at:4102444800}));")
 async def fits(stage):
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(engine.name,width,height,stage)
  for svg in await page.locator('.score-document').all():
   assert await svg.get_attribute('data-renderer')=='vexflow-bravura'
   assert not await svg.evaluate('svg=>{const v=svg.viewBox.baseVal,m=svg.getScreenCTM().inverse();return [...svg.querySelectorAll("[data-note]")].some(n=>{const b=n.getBoundingClientRect(),a=new DOMPoint(b.left,b.top).matrixTransform(m),z=new DOMPoint(b.right,b.bottom).matrixTransform(m);return a.x < -1 || a.y < -1 || z.x > v.width+1 || z.y > v.height+1})}'),stage
 async def nav(view):
  landscape=await page.evaluate('matchMedia("(orientation: landscape) and (max-height: 520px) and (max-width: 1024px)").matches')
  if landscape:await page.locator('#landscape-menu').click()
  elif page.viewport_size['width']<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view="{view}"]').click()
 try:
  await page.goto(base,wait_until='networkidle')
  await page.locator('.course-card').first.click()
  await expect(page.locator('[data-score] .score-document')).to_have_count(3)
  assert await page.locator('.chord-guide,[data-guide-root]').count()==0
  assert await page.locator('[data-zoom],[data-download],#midi').count()==0
  assert await page.locator('[data-clef=bass]').count()==0
  assert await page.evaluate('getComputedStyle(document.documentElement).colorScheme')=='light'
  assert await page.locator('[data-duration="4"][data-hollow=true]').count()>0
  assert await page.locator('[data-duration="2"][data-hollow=true]').count()>0
  for card,e in zip(await page.locator('.exercise').all(),FIXTURE['exercises']):
   await expect(card.locator('[data-score-bar]')).to_have_count(len(e['progression']))
   assert await card.locator('[data-play]').inner_text()==''
   assert await card.locator('[data-play]').get_attribute('aria-label')
   sc=await card.locator('[data-score]').bounding_box();ac=await card.locator('.exercise-actions').bounding_box()
   assert ac['y']>=sc['y']+sc['height']-1
   assert await card.locator('.progression-frame').evaluate('n=>getComputedStyle(n).borderTopWidth')=='1px'
   assert await card.locator('.score-document').get_attribute('data-note-scale')=='0.75'
  landscape=width>height and height<=520 and width<=1024
  if landscape:
   await expect(page.locator('.topbar')).to_be_hidden()
   await page.locator('#landscape-menu').click()
   await expect(page.locator('#sidebar')).to_have_attribute('aria-modal','true')
   await page.locator('.nav-close').click()
   await expect(page.locator('#landscape-menu')).to_have_attribute('aria-expanded','false')
  await fits('lesson')
  await page.locator('.lesson-theory>summary').click()
  await expect(page.locator('.lesson-theory .theory-figure')).to_be_visible()
  assert await page.locator('.theory-figure button').count()==0
  assert not await page.locator('a[href^="javascript:"]').count()
  await page.locator('.exercise-notes>summary').first.click()
  await expect(page.locator('.exercise-notes .theory-body').first).to_be_visible()
  await fits('theory')
  if mode=='mobile':await page.screenshot(path=str(OUT/f'light-theory-{engine.name}-{width}x{height}.png'),full_page=True)
  await page.locator('.lesson-theory>summary').click();await page.locator('.exercise-notes>summary').first.click()
  sheet=page.locator('[data-score]').first
  initial=await sheet.locator('[data-midi]').evaluate_all('ns=>ns.map(n=>+n.dataset.midi)')
  await page.locator('[data-shift="1"]').first.click()
  await expect(page.locator('[data-key]').first).to_have_value('Db')
  shifted=await sheet.locator('[data-midi]').evaluate_all('ns=>ns.map(n=>+n.dataset.midi)')
  assert [(b-a)%12 for a,b in zip(initial,shifted)]==[1]*len(initial)
  await page.select_option('#pattern','arpeggio');await fits('arpeggio')
  await page.locator('[data-play]').first.click()
  await expect(page.locator('#player')).to_be_visible();await expect(sheet.locator('.playing')).to_have_count(1)
  await sheet.locator('svg').evaluate('n=>n.dataset.sentinel="same"')
  if mode=='score':await page.wait_for_timeout(3700)
  assert await sheet.locator('svg').get_attribute('data-sentinel')=='same'
  await expect(sheet.locator('[data-score-bar]')).to_have_count(8)
  await page.locator('#hand').select_option('left');await fits('player')
  await page.locator('#close-player').click();await page.select_option('#pattern','chords')
  await page.locator('[data-key]').first.select_option('C')
  await page.screenshot(path=str(OUT/f'light-lesson-{engine.name}-{width}x{height}.png'),full_page=True)
  if mode=='engraving':
   await nav('reference');await expect(page.locator('.guide-card')).to_have_count(10)
   assert await page.locator('[data-score]').count()==0
   major=page.locator('[data-chord-type=major]');await major.locator('[data-inversion]').select_option('1')
   await expect(major.locator('[data-chord-name]')).to_have_text('C/E')
   assert await major.locator('[data-note]').evaluate_all('ns=>ns.map(n=>n.dataset.note)')==['E4','G4','C5']
   dim=page.locator('[data-chord-type=diminished7]');await dim.locator('[data-inversion]').select_option('3')
   await expect(dim.locator('[data-chord-name]')).to_have_text('Cdim7/B♭♭')
   assert await dim.locator('[data-note]').first.get_attribute('data-note')=='B♭♭4'
   await page.locator('[data-guide-root]').select_option('D')
   await expect(major.locator('[data-chord-name]')).to_have_text('D/F♯')
   await fits('guide')
   await page.screenshot(path=str(OUT/f'light-guide-{engine.name}-{width}x{height}.png'),full_page=True)
   await page.reload();await expect(page.locator('.guide-card')).to_have_count(10)
   assert page.url.endswith('#reference')
   await nav('library');await expect(page.locator('[data-score]')).to_have_count(3)
   assert await page.locator('.chord-guide').count()==0
   await page.locator('[data-star]').first.click();assert state['favorites']
   await nav('favorites');await expect(page.locator('[data-score]')).to_have_count(1)
  elif mode=='mobile':
   await page.locator('#notes').fill('Synthetic saved note')
   await page.locator('#save-notes').click();await expect(page.locator('#note-status')).to_have_text('Сохранено')
   assert state['progress'][0]['notes']=='Synthetic saved note'
   await page.set_viewport_size({'width':844,'height':390})
   await expect(page.locator('.topbar')).to_be_hidden();await fits('rotate')
   await page.locator('#landscape-menu').click();await page.locator('.nav-close').click()
   await page.set_viewport_size({'width':375,'height':812})
   await expect(page.locator('.topbar')).to_be_visible();await fits('portrait again')
  assert not errors,(engine.name,width,height,errors)
  print(f'PASS {mode} {engine.name} {width}x{height}: light UI, engraved score, controls, theory, playback, navigation',flush=True)
 finally:await ctx.close();await browser.close()
async def suite(mode):
 public=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT/'site'
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(public)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   cases={'mobile':[(p.chromium,320,812),(p.chromium,768,1024),(p.chromium,844,390),(p.webkit,932,430)],'score':[(p.chromium,1440,960),(p.webkit,375,812)],'engraving':[(p.chromium,1440,960),(p.webkit,375,812)]}[mode]
   for engine,w,h in cases:await scenario(engine,w,h,f'http://127.0.0.1:{server.server_port}/',mode)
 finally:server.shutdown()
def run_suite(mode):asyncio.run(suite(mode))
if __name__=='__main__':
 import sys
 run_suite(sys.argv[1] if len(sys.argv)>1 else 'mobile')
