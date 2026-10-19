"""Synthetic fixture only: white borderless surfaces, whole-note scales, and responsive engraving."""
import asyncio,functools,threading,os
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
THEORY={'sections':[{'title':'Сначала послушай','paragraphs':['Сыграй последовательность, сохраняя общие звуки на месте. Затем сравни расположения правой руки.']}], 'figure':{'steps':[{'label':'T','note':'Тоника'},{'label':'S','note':'Субдоминанта'},{'label':'D','note':'Доминанта'}],'caption':'Учебная схема.'}}
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Практика','title':'Гармонические обороты','goal':'Сравнить расположения.','preparation':['Сыграть оборот.'],'topics':['Голосоведение'],'theory':THEORY}], 'exercises':[{'id':'paper-major','lesson_id':1,'position':1,'title':'Общие звуки и движение голосов','mode':'major','progression':['I','vi7','ii7','V7','I'],'goal':'Сравнить окончания.','discuss':'Проследить движение голосов.','theory':THEORY},{'id':'paper-bass','lesson_id':1,'position':2,'title':'Нисходящий бас','mode':'minor','progression':[{'symbol':'i','bass':'1'},{'symbol':'V6','bass':'7'},'iv','V7','i'],'goal':'Проследить бас.','discuss':'Сравнить обе руки.','theory':THEORY}], 'favorites':[{'exercise_id':'paper-major'}], 'progress':[], 'library_access':[]}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 opts={'executable_path':os.environ['CHROMIUM_EXECUTABLE']} if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE') else {}
 browser=await engine.launch(**opts);context=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<1025)
 writes=[]
 async def mock(route):
  path=route.request.url.split('?')[0]
  if route.request.method!='GET':writes.append(route.request.method)
  if path.endswith('/auth/v1/user'):data={'id':USER,'email':'paper@example.invalid','email_confirmed_at':'2026-01-01'}
  elif path.endswith('/auth/v1/settings'):data={'external':{'google':True}}
  elif path.endswith('/rest/v1/members'):data=[{'user_id':USER,'active':True,'is_owner':True}]
  else:
   name=path.rsplit('/',1)[-1];assert name in FIXTURE,path;data=FIXTURE[name]
  await route.fulfill(json=data)
 await context.route('https://*.supabase.co/**',mock)
 page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif page.viewport_size['width']<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view={view}]').click()
 async def fits():
  await page.wait_for_function('document.documentElement.scrollWidth<=innerWidth+1')
  bad=await page.locator('.score-document').evaluate_all('''svgs=>svgs.flatMap(svg=>{const v=svg.viewBox.baseVal,m=svg.getScreenCTM().inverse();return [...svg.querySelectorAll('[data-note],.vf-accidental,.vf-clef,.vf-stem')].filter(n=>{const b=n.getBoundingClientRect();if(!b.width&&!b.height)return false;const a=new DOMPoint(b.left,b.top).matrixTransform(m),z=new DOMPoint(b.right,b.bottom).matrixTransform(m);return a.x< -1||a.y< -1||z.x>v.width+1||z.y>v.height+1}).map(n=>n.outerHTML.slice(0,160));})''')
  assert not bad,bad[:4]
 async def surfaces(selector,shadow=True):
  nodes=page.locator(selector);assert await nodes.count()>0,selector
  results=await nodes.evaluate_all('ns=>ns.map(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth,s.boxShadow]})')
  for result in results:
   assert result[0]=='rgb(255, 255, 255)',(selector,result)
   assert result[1:5]==['0px']*4,(selector,result)
   assert (result[5]!='none')==shadow,(selector,result)
 async def staff_ink():
  assert await page.locator('.score-document .vf-stave > path').count()>0
  colors=await page.locator('.score-document .vf-stave > path').evaluate_all('ns=>[...new Set(ns.map(n=>getComputedStyle(n).stroke))]')
  assert colors==['rgb(140, 133, 122)'],colors
 try:
  await page.goto(base+'#modes',wait_until='networkidle');await expect(page.locator('.mode-card')).to_have_count(44)
  await surfaces('.mode-card,.mode-intro');await surfaces('.mode-score',False)
  await expect(page.locator('.mode-document .vf-stem path')).to_have_count(0)
  assert await page.locator('.scale-pitch').evaluate_all("ns=>ns.every(n=>n.dataset.duration==='4' && n.dataset.hollow==='true' && n.dataset.glyph==='noteheadWhole')")
  assert await page.locator('.mode-document ellipse').count()==0
  await staff_ink();await fits()
  await page.select_option('[data-modes-category]','diatonic');await page.screenshot(path=str(OUT/f'paper-modes-{engine.name}-{w}x{h}.png'))
  await page.select_option('[data-modes-category]','all');await page.locator('[data-modes-search]').fill('фригийская доминанта');await page.select_option('[data-scale-root]','E')
  assert await page.locator('.scale-pitch').evaluate_all('ns=>ns.map(n=>n.dataset.note)')==['E/4','F/4','G#/4','A/4','B/4','C/5','D/5','E/5']
  await page.locator('.mode-details>summary').click();await fits()
  await page.locator('[data-mode-card]').screenshot(path=str(OUT/f'paper-mode-detail-{engine.name}-{w}x{h}.png'))
  await page.locator('[data-scale-play]').click();await expect(page.locator('[data-scale-play]')).to_have_attribute('aria-pressed','true')
  await page.keyboard.press('Escape');await expect(page.locator('[data-scale-play]')).to_have_attribute('aria-pressed','false')
  await page.locator('[data-modes-search]').fill('');await page.select_option('[data-modes-category]','all')
  for root in ['C#','Db','F#','Gb','G#','Ab','B','Bb','C']:
   await page.select_option('[data-modes-root]',root);await fits()
  await page.select_option('[data-modes-category]','symmetric');await fits()
  await nav('reference');await expect(page.locator('.guide-card')).to_have_count(44)
  await surfaces('.guide-card');await surfaces('.guide-card .score',False);await staff_ink()
  await page.select_option('[data-guide-category]','ninths');await fits()
  await page.screenshot(path=str(OUT/f'paper-chords-{engine.name}-{w}x{h}.png'))
  await nav('course');await surfaces('.course-card,.resume-row');await page.keyboard.press('Tab');await page.locator('.course-card').first.focus()
  assert await page.locator('.course-card').first.evaluate('e=>getComputedStyle(e).outlineStyle')!='none'
  await page.locator('.course-card').first.click();await expect(page.locator('.exercise')).to_have_count(2)
  await surfaces('.exercise,.prep,.lesson-theory,.notes-editor');await surfaces('.exercise .score',False);await staff_ink();await fits()
  await page.screenshot(path=str(OUT/f'paper-lesson-{engine.name}-{w}x{h}.png'))
  await page.locator('[data-bass]').first.click();await page.locator('[data-voicing]').first.click();await page.locator('[data-key]').first.select_option('Db')
  await page.select_option('#pattern','arpeggio');await fits();await page.locator('[data-play]').first.click();await expect(page.locator('#player')).to_be_visible();await page.locator('#close-player').click()
  await nav('favorites');await expect(page.locator('.exercise')).to_have_count(1);await surfaces('.exercise');await fits()
  await nav('access');await expect(page.locator('.access-panel')).to_have_count(3);await surfaces('.access-panel');await fits()
  if w>h and w<1025:await expect(page.locator('.topbar')).to_be_hidden()
  assert not errors,errors;assert not writes,writes
  print(f'PASS paper {engine.name} {w}x{h}: whole notes, contours, transposition, white surfaces, soft staves, shadows, controls, all views',flush=True)
 finally:await context.close();await browser.close()
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,320,812),(p.chromium,1440,960),(p.webkit,375,812),(p.webkit,932,430)]:
    if os.environ.get('CHROMIUM_ONLY') and engine.name!='chromium':continue
    await scenario(engine,w,h,f'http://127.0.0.1:{server.server_port}/')
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
