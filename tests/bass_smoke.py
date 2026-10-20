from inline_helpers import choose_key, stop_card
"""Synthetic responses only. Per-card bass visibility, pitch sync, playback and phone layouts."""
import asyncio, functools, json, os, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT/'site'
OUT=ROOT/'ui-results'; OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
if os.environ.get('BASS_ROUTED'): BASE='https://strannii-ya.github.io/harmony-lessons/'
USER='11111111-1111-4111-8111-111111111111'
def exercise(id,p,notation):
 return {'id':id,'lesson_id':1,'position':int(id[-1]),'title':id,'goal':'Проверка нот.','discuss':'Сравнить голоса.','mode':'major','loop':False,'progression':p,'theory':{'sections':[],'notation':notation}}
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Проверка','title':'Бас и верхние голоса','goal':'Проверка.','preparation':[],'topics':[]}],
 'exercises':[exercise('fixture-1',['I','IV','V','I'],{'show_bass':False}),
 exercise('fixture-2',[{'symbol':s,'bass':'5'} for s in ['I','IV','V7','I']],{'show_bass':True}),
 exercise('fixture-3',['I','V6','vi','iii6','IV','I6','ii7','V7','I'],{'show_bass':True,'bass_offsets':[12,11,9,7,5,4,2,7,12]})], 'progress':[], 'favorites':[]}
async def main():
 async with async_playwright() as p:
  scenarios=[(p.chromium,320,812),(p.chromium,1440,960),(p.chromium,844,390),(p.webkit,375,812),(p.webkit,932,430)]
  for engine,width,height in scenarios:
   if os.environ.get('BASS_CHROMIUM_ONLY') and engine.name!='chromium':continue
   launch={}
   if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE'):launch['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
   browser=await engine.launch(**launch)
   context=await browser.new_context(viewport={'width':width,'height':height},has_touch=width<1025)
   async def mock(route):
    url=route.request.url
    if url.startswith(BASE):
     if os.environ.get('BASS_ROUTED'):
      path=unquote(urlparse(url).path[len(urlparse(BASE).path):]) or 'index.html'
      file=(PUBLIC/path).resolve()
      assert file.is_relative_to(PUBLIC.resolve())
      if not file.is_file():return await route.fulfill(status=404,body='not found')
      mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}.get(file.suffix,'application/octet-stream')
      return await route.fulfill(body=file.read_bytes(),content_type=mime)
     return await route.continue_()
    if '.supabase.co/' not in url:return await route.abort()
    if '/auth/v1/user' in url:data={'id':USER,'email':'fixture@example.invalid','email_confirmed_at':'2026-01-01'}
    elif '/auth/v1/settings' in url:data={'external':{'google':True}}
    elif '/rest/v1/members' in url:data=[{'user_id':USER,'is_owner':False,'active':True}]
    else:
     name=urlparse(url).path.split('/')[-1];assert name in FIXTURE,url;data=FIXTURE[name]
    return await route.fulfill(json=data)
   await context.route('**/*',mock)
   page=await context.new_page();errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
   await page.goto(BASE+'#lesson-1',wait_until='networkidle')
   await expect(page.locator('.exercise')).to_have_count(3)
   basic=page.locator('[data-eid="fixture-1"]');pedal=page.locator('[data-eid="fixture-2"]');descent=page.locator('[data-eid="fixture-3"]')
   await expect(basic.locator('[data-clef="bass"]')).to_have_count(0)
   assert await pedal.locator('[data-clef="bass"]').count()>0
   assert await descent.locator('[data-clef="bass"]').count()>0
   notes=lambda card:card.locator('[data-hand="left"] [data-midi]')
   assert len(set(await notes(pedal).evaluate_all('(ns)=>ns.map(n=>+n.dataset.midi)')))==1
   initial=await notes(descent).evaluate_all('(ns)=>ns.map(n=>+n.dataset.midi)')
   assert initial[:7]==[48,47,45,43,41,40,38]
   await choose_key(descent.locator('[data-key]'),'Db')
   shifted=await notes(descent).evaluate_all('(ns)=>ns.map(n=>+n.dataset.midi)')
   assert shifted==[x+1 for x in initial]
   async def fits():
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    for svg in await page.locator('.exercise .score-document').all():
     assert not await svg.evaluate('s=>{const v=s.viewBox.baseVal;return [...s.querySelectorAll("ellipse")].some(n=>{const b=n.getBBox();return b.x<0||b.y<0||b.x+b.width>v.width||b.y+b.height>v.height;});}')
   await fits()
   await descent.screenshot(path=str(OUT/f'bass-{engine.name}-{width}x{height}.png'))
   await basic.locator('[data-bass]').click()
   assert await basic.locator('[data-clef="bass"]').count()>0
   await pedal.locator('[data-bass]').click()
   await expect(pedal.locator('[data-clef="bass"]')).to_have_count(0)
   await page.select_option('#pattern','arpeggio');await fits()
   await expect(pedal.locator('[data-bass]')).to_have_attribute('aria-pressed','false')
   assert await notes(descent).evaluate_all('(ns)=>ns.map(n=>+n.dataset.midi)')==shifted
   # Instrument the exact, versioned player module; no real credentials or services.
   await page.evaluate('''async()=>{const u=new URL(document.querySelector('script[src*="app.js"]').src);u.pathname=u.pathname.replace('app.js','audio.js');const {Player}=await import(u.href);const original=Player.prototype.play;window.testPlayCalls=0;Player.prototype.play=function(...args){window.testPlayCalls++;return original.apply(this,args);};}''')
   await descent.locator('[data-play]').click()
   await expect(descent.locator('.playing')).to_have_count(1)
   await descent.locator('[data-bass]').click()
   await expect(descent.locator('[data-clef="bass"]')).to_have_count(0)
   assert await page.evaluate('window.testPlayCalls')==1
   await expect(descent.locator('[data-play]')).to_have_attribute('aria-pressed','true')
   await descent.locator('[data-bass]').click()
   assert await page.evaluate('window.testPlayCalls')==1
   assert await descent.locator('[data-clef="bass"]').count()>0
   await stop_card(page);await fits()
   await descent.screenshot(path=str(OUT/f'bass-arpeggio-{engine.name}-{width}x{height}.png'))
   if height<520 and width>height:
    await expect(page.locator('.topbar')).to_be_hidden()
    await page.locator('#landscape-menu').click()
   elif width<=900:await page.locator('#menu').click()
   await page.locator('[data-view="library"]').click()
   await expect(page.locator('.exercise')).to_have_count(3)
   await expect(pedal.locator('[data-bass]')).to_have_attribute('aria-pressed','false')
   await expect(basic.locator('[data-bass]')).to_have_attribute('aria-pressed','true')
   assert await descent.locator('[data-clef="bass"]').count()>0
   await page.set_viewport_size({'width':375,'height':812});await page.wait_for_timeout(150);await fits()
   await expect(pedal.locator('[data-clef="bass"]')).to_have_count(0)
   assert await descent.locator('[data-clef="bass"]').count()>0
   assert await page.locator('[data-zoom],[data-download],#midi').count()==0
   assert not errors,errors
   print(f'PASS bass {engine.name} {width}x{height}: defaults, independent toggle, transpose, bass contour, both textures, uninterrupted playback, library, orientation',flush=True)
   await context.close();await browser.close()
try:asyncio.run(main())
finally:server.shutdown()
