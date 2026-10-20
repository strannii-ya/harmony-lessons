"""Synthetic identities and lessons only. Inline audio, arrow keys, defaults and quiet navigation."""
import asyncio,functools,threading,json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright,expect
from controls_smoke import FIXTURE, USER
from inline_helpers import choose_key, stop_card
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 browser=await engine.launch();ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<=1024)
 saved=[]
 async def mock(route):
  path=route.request.url.split('?')[0]
  if path.endswith('/auth/v1/user'):data={'id':USER,'email':'ui@example.invalid','email_confirmed_at':'2026-01-01'}
  elif path.endswith('/auth/v1/settings'):data={'external':{'google':True}}
  elif path.endswith('/rest/v1/members'):data=[{'user_id':USER,'is_owner':False,'active':True}]
  else:
   name=path.rsplit('/',1)[-1];assert name in FIXTURE,path
   if route.request.method=='POST':assert name=='favorites';saved.append(route.request.post_data_json)
   data=saved if name=='favorites' else FIXTURE[name]
  await route.fulfill(json=data)
 await ctx.route('https://*.supabase.co/**',mock)
 await ctx.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif page.viewport_size['width']<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view={view}]').click()
 async def fits():
  await page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert await page.locator('#player,#tempo,#loop,#hand,#lesson-count,select[data-key]').count()==0
  assert await page.locator('.score-error').count()==0
  assert await page.locator('[data-play][aria-pressed=true],[data-scale-play][aria-pressed=true],[data-chord-play][aria-pressed=true]').count()<=1
  assert await page.locator('.key-name').evaluate_all('ns=>ns.every(n=>n.scrollWidth<=n.clientWidth+1)')
 try:
  await page.goto(base+'#lesson-1',wait_until='networkidle')
  await expect(page.locator('.exercise')).to_have_count(4)
  await page.evaluate('''async()=>{const v=(await (await fetch('./version.json')).json()).version;
   const {Player}=await import('./audio.js?v='+v),{cardPlayback}=await import('./card-playback.js?v='+v);
   window.transport=cardPlayback;window.plays=[];const original=Player.prototype.play;
   Player.prototype.play=function(s,o){window.plays.push({score:JSON.parse(JSON.stringify(s)),bpm:o.bpm,loop:o.loop,hand:o.hand});return original.call(this,s,o)};
  }''')
  first=page.locator('[data-eid=controls-basic]');second=page.locator('[data-eid=controls-sevenths]')
  assert await page.locator('[data-voicing]').evaluate_all('ns=>ns.every(n=>n.getAttribute("aria-pressed")==="true")')
  assert await page.locator('.exercise .score-document').evaluate_all('ns=>ns.every(n=>n.dataset.rhVoicings==="true")')
  formula=await first.locator('.roman').evaluate('n=>{let s=getComputedStyle(n);return {border:s.borderTopWidth,bg:s.backgroundColor,font:s.fontSize}}')
  assert formula['border']=='0px'
  await fits()
  await first.screenshot(path=str(OUT/f'inline-lesson-{engine.name}-{w}x{h}.png'))
  await first.locator('[data-play]').click();await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','true')
  await expect(first.locator('[data-play]')).to_have_attribute('aria-label','Остановить: Плавные переходы')
  await expect(first.locator('.playing')).to_have_count(1)
  assert await page.evaluate('plays.at(-1).bpm')==90
  actual=await first.locator('[data-hand=right] [data-midi]').evaluate_all('ns=>ns.map(n=>+n.dataset.midi)')
  assert actual==await page.evaluate('plays.at(-1).score.bars.flatMap(b=>b.rh.flatMap(e=>e.notes.map(n=>n.midi)))')
  await first.locator('[data-bass]').click();assert await page.evaluate('plays.length')==1
  await first.locator('[data-voicing]').click();assert await page.evaluate('plays.length')==2
  await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','true')
  assert not await page.evaluate('plays.at(-1).score.rightHandVoicings===true')
  await second.locator('[data-play]').click();await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','false')
  await expect(second.locator('[data-play]')).to_have_attribute('aria-pressed','true')
  await second.locator('[data-play]').click();assert not await page.evaluate('transport.engine.running')
  await first.locator('[data-voicing]').click();await first.locator('[data-play]').click()
  await first.locator('[data-shift="1"]').click();await expect(first.locator('[data-key]')).to_have_attribute('data-tonic','Db')
  await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','false')
  for tonic in ['B','Bb','F#','C']:await choose_key(first.locator('[data-key]'),tonic);await fits()
  # Fast click/stop and keyboard activation keep the button in sync.
  await first.locator('[data-play]').click();await first.locator('[data-play]').click()
  await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','false')
  await first.locator('[data-play]').focus();await page.keyboard.press('Enter');await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','true')
  await page.keyboard.press('Escape');await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','false')
  await first.locator('[data-star]').click();await nav('favorites');await expect(page.locator('.exercise')).to_have_count(1);await fits()
  await nav('library');await page.locator('[data-eid=controls-jazz] [data-play]').click()
  await page.locator('#search').fill('Плавные');assert not await page.evaluate('transport.engine.running');await fits()
  await nav('modes');await page.select_option('[data-modes-category]','diatonic');await fits()
  mode=page.locator('.mode-card').first
  mf=await mode.locator('.mode-formula').evaluate('n=>{let s=getComputedStyle(n);return {border:s.borderTopWidth,bg:s.backgroundColor,font:s.fontSize}}')
  assert mf==formula,(mf,formula)
  await mode.locator('[data-scale-play]').click();await expect(mode.locator('[data-scale-play]')).to_have_attribute('aria-pressed','true')
  assert await page.evaluate('plays.at(-1).bpm')==90
  await mode.locator('[data-scale-shift="1"]').click();await expect(mode.locator('[data-scale-play]')).to_have_attribute('aria-pressed','false')
  await mode.locator('[data-scale-play]').click();await nav('reference');assert not await page.evaluate('transport.engine.running')
  major=page.locator('[data-chord-type=major]');minor=page.locator('[data-chord-type=minor]')
  await expect(page.locator('[data-chord-play]')).to_have_count(44)
  await major.locator('[data-inversion]').select_option('1');await page.select_option('[data-guide-root]','D')
  await major.locator('[data-chord-play]').click();await expect(major.locator('[data-chord-play]')).to_have_attribute('aria-pressed','true')
  assert await page.evaluate('plays.at(-1).score.events[0].notes.map(n=>n.midi)')==await major.locator('[data-midi]').evaluate_all('ns=>ns.map(n=>+n.dataset.midi)')
  await minor.locator('[data-chord-play]').click();await expect(major.locator('[data-chord-play]')).to_have_attribute('aria-pressed','false')
  await expect(minor.locator('[data-chord-play]')).to_have_attribute('aria-pressed','false',timeout=6000)
  assert not await page.evaluate('transport.engine.running');await fits()
  await major.screenshot(path=str(OUT/f'inline-reference-{engine.name}-{w}x{h}.png'))
  await nav('course');await expect(page.locator('.course-card small')).to_have_count(0)
  await expect(page.locator('.card-arrow,#focus')).to_have_count(0)
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  assert await page.locator('.primary-nav button:not([hidden])').evaluate_all('ns=>ns.every(n=>getComputedStyle(n).backgroundColor!=="rgba(0, 0, 0, 0)")')
  await expect(page.locator('#signout')).to_have_text('Выйти')
  assert (await page.locator('.sidebar-bottom').bounding_box())['height']<=50
  await page.screenshot(path=str(OUT/f'inline-menu-{engine.name}-{w}x{h}.png'))
  assert await page.evaluate('plays.every(p=>p.bpm===90&&!p.loop&&p.hand==="both")')
  assert not errors,errors
  print(f'PASS inline {engine.name} {w}x{h}: fixed tempo, exclusive card playback, stop/completion, arrow keys, default voicings, all references, sidebar, favorites',flush=True)
 finally:await ctx.close();await browser.close()
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,320,812),(p.chromium,1440,960),(p.webkit,375,812),(p.webkit,932,430)]:await scenario(engine,w,h,f'http://127.0.0.1:{server.server_port}/')
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
