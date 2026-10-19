"""Synthetic identities only. Verify actual notation, sound, filters and cleanup."""
import asyncio,functools,threading,os,json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Test','title':'Тестовый урок','goal':'Тест','preparation':[],'topics':[]}],'exercises':[{'id':'test-scale-baseline','lesson_id':1,'position':1,'title':'Исходный пример','goal':'Тест','discuss':'Тест','mode':'major','progression':['I','IV','V7','I'],'loop':False}],'progress':[],'favorites':[]}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 launch={'executable_path':os.environ['CHROMIUM_EXECUTABLE']} if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE') else {}
 browser=await engine.launch(**launch);context=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<1025)
 writes=[]
 async def mock(route):
  url=route.request.url.split('?')[0];method=route.request.method
  if method!='GET':writes.append((method,url))
  if url.endswith('/auth/v1/user'):data={'id':USER,'email':'test@example.invalid','email_confirmed_at':'2026-01-01'}
  elif url.endswith('/auth/v1/settings'):data={'external':{'google':True}}
  elif url.endswith('/rest/v1/members'):data=[{'user_id':USER,'is_owner':False,'active':True}]
  elif url.endswith('/auth/v1/logout'):data={}
  else:
   name=url.rsplit('/',1)[-1];assert name in FIXTURE,url;data=FIXTURE[name]
  await route.fulfill(json=data)
 await context.route('https://*.supabase.co/**',mock)
 page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 async def fits():
  # Renderers resize in a requestAnimationFrame after ResizeObserver; inspect settled pixels.
  await page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
  fits_width=await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  if not fits_width:
   diagnostics=await page.evaluate('''()=>({viewport:[innerWidth,innerHeight],scroll:[scrollX,scrollY],document:[document.documentElement.scrollWidth,document.body.scrollWidth],category:document.querySelector('[data-modes-category]')?.value,overflow:[...document.querySelectorAll('body *')].flatMap(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width&&b.right>innerWidth+1&&s.display!=='none'?[{tag:e.tagName,id:e.id,classes:e.getAttribute('class'),text:e.children.length?'':e.textContent.slice(0,100),left:b.left,right:b.right,width:b.width,cssWidth:s.width,minWidth:s.minWidth,position:s.position,transform:s.transform,overflowX:s.overflowX}]:[]}).slice(0,35)})''')
   print('MODE_LAYOUT_DIAGNOSTIC',engine.name,w,h,json.dumps(diagnostics,ensure_ascii=False),flush=True)
   (OUT/f'modes-overflow-{engine.name}-{w}x{h}.json').write_text(json.dumps(diagnostics,ensure_ascii=False,indent=2))
   await page.screenshot(path=str(OUT/f'modes-overflow-{engine.name}-{w}x{h}.png'),full_page=True)
  assert fits_width,(engine.name,w,h,'Document overflow')
  geometry=await page.evaluate('''()=>[...document.querySelectorAll('.mode-document')].flatMap(svg=>{const v=svg.viewBox.baseVal,m=svg.getScreenCTM().inverse();return [...svg.querySelectorAll('.scale-pitch,.vf-accidental,.vf-clef,.vf-stem')].flatMap(n=>{const b=n.getBoundingClientRect(),a=new DOMPoint(b.left,b.top).matrixTransform(m),z=new DOMPoint(b.right,b.bottom).matrixTransform(m);return a.x< -1||a.y< -1||z.x>v.width+1||z.y>v.height+1?[{mode:svg.dataset.modeId,tonic:svg.dataset.tonic,note:n.dataset.note,classes:n.getAttribute('class'),a:[a.x,a.y],z:[z.x,z.y],view:[v.width,v.height]}]:[]});})''')
  if geometry:await page.screenshot(path=str(OUT/f'modes-geometry-error-{engine.name}-{w}x{h}.png'),full_page=True)
  assert not geometry,geometry[:8]
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view={view}]').click()
 try:
  await page.goto(base+'#modes',wait_until='networkidle');await expect(page.locator('.mode-card')).to_have_count(44)
  await expect(page.locator('[data-view=reference] + [data-view=modes]')).to_have_count(1)
  assert not await page.locator('[data-view=access]').is_visible()
  assert await page.locator('.mode-document ellipse').count()==0
  assert await page.locator('.mode-document .vf-timesignature,.mode-document .vf-keysignature').count()==0
  # Controls still follow the score; the intentional footer now groups them with the explanation.
  assert await page.locator('.mode-score + .mode-footer > .mode-actions').count()==44
  assert await page.locator('.mode-card details[open]').count()==0
  await fits()
  await page.evaluate('''async()=>{const v=(await (await fetch('./version.json')).json()).version;const {Player}=await import('./audio.js?v='+v);const play=Player.prototype.play;window.modePlays=[];Player.prototype.play=function(s,o){window.modePlays.push(JSON.parse(JSON.stringify(s)));window.modePlayer=this;return play.call(this,s,o)};}''')
  await page.select_option('[data-modes-category]','diatonic');await expect(page.locator('.mode-card')).to_have_count(7)
  await page.select_option('[data-modes-root]','D');await fits()
  await page.locator('[data-mode-card=dorian]').screenshot(path=str(OUT/f'modes-dorian-{engine.name}-{w}x{h}.png'))
  await page.select_option('[data-modes-category]','all');await page.locator('[data-modes-search]').fill('фригийская доминанта');await expect(page.locator('.mode-card')).to_have_count(1)
  await page.select_option('[data-scale-root]','E');await expect(page.locator('.mode-document')).to_have_attribute('data-tonic','E')
  names=await page.locator('.scale-pitch').evaluate_all('ns=>ns.map(n=>n.dataset.note)');assert names==['E/4','F/4','G#/4','A/4','B/4','C/5','D/5','E/5'],names
  await page.locator('.mode-details>summary').click();await expect(page.locator('[data-mode-notes]')).to_contain_text('соль♯')
  await page.locator('[data-scale-play]').click();await expect(page.locator('[data-scale-play]')).to_have_attribute('aria-pressed','true')
  actual=await page.locator('.scale-pitch').evaluate_all('ns=>ns.map(n=>+n.dataset.midi)')
  assert await page.evaluate('modePlays.at(-1).events.map(e=>e.notes[0].midi)')==actual
  assert await page.evaluate("modePlays.at(-1).events.every(e=>e.hand==='right'&&e.duration===1)")
  await page.select_option('[data-scale-root]','F#');assert not await page.evaluate('modePlayer.running');await fits()
  await page.locator('[data-mode-card]').screenshot(path=str(OUT/f'modes-phrygian-dominant-{engine.name}-{w}x{h}.png'))
  await page.locator('[data-scale-shift="-1"]').click();await expect(page.locator('[data-scale-root]')).to_have_value('F')
  await page.locator('[data-modes-search]').fill('');await page.select_option('[data-modes-category]','world');await expect(page.locator('.mode-card')).to_have_count(6);await fits()
  await page.locator('[data-mode-card=hirajoshi]').screenshot(path=str(OUT/f'modes-hirajoshi-{engine.name}-{w}x{h}.png'))
  await page.locator('[data-modes-search]').fill('<img src=x onerror=alert(1)>');await expect(page.locator('.mode-card')).to_have_count(0);assert await page.locator('[data-mode-results] img').count()==0
  await page.locator('[data-modes-search]').fill('');await page.select_option('[data-modes-category]','all')
  for root in ['C#','Db','F#','Gb','G#','Ab','B','Bb','C']:
   await page.select_option('[data-modes-root]',root);await fits()
   assert await page.locator('.mode-document').count()==44
  await page.select_option('[data-modes-category]','symmetric');await fits()
  await page.locator('[data-mode-card=chromatic]').screenshot(path=str(OUT/f'modes-chromatic-{engine.name}-{w}x{h}.png'))
  if w>h and w<1025:assert not await page.locator('.topbar').is_visible()
  await page.locator('[data-scale-play]').first.click();await nav('reference');assert not await page.evaluate('modePlayer.running')
  await expect(page.locator('.guide-card')).to_have_count(44)
  await nav('course');await page.locator('.course-card').first.click();await expect(page.locator('.exercise')).to_have_count(1)
  await page.locator('[data-voicing]').click();await page.locator('[data-bass]').click();await page.locator('[data-play]').click();await expect(page.locator('#player')).to_be_visible()
  await nav('modes');await expect(page.locator('#player')).to_be_hidden();await page.locator('[data-scale-play]').first.click()
  await page.keyboard.press('Escape');assert not await page.evaluate('modePlayer.running')
  await page.reload(wait_until='networkidle');await expect(page.locator('.mode-card')).to_have_count(44);await fits()
  assert not writes,writes
  assert not errors,errors
  print(f'PASS {engine.name} {w}x{h}: 44 ascending Bravura scales, unmetered notation, transposition, written signs, audio identity, search, filters, navigation and no database writes',flush=True)
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
