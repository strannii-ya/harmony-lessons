from inline_helpers import choose_key, stop_card
"""Only synthetic scores and identities: no live login, course reads or email delivery."""
import asyncio, functools, threading, os, json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
EXAMPLES=[
 {'id':'catalog-course','lesson_id':1,'title':'Учебный оборот','mode':'major','progression':['I','IV','V7','I']},
 {'id':'catalog-blues','genre':'blues','title':'Синтетический блюз','mode':'major','progression':['I7']*4+['IV7']*2+['I7']*2+['V7','IV7','I7','V7']},
 {'id':'catalog-waltz','genre':'waltz','title':'Синтетический вальс','mode':'minor','progression':['i','iv','V7','i'],'theory':{'meter':3,'notation':{'show_bass':True}}},
 {'id':'catalog-jazz','genre':'jazz','title':'Синтетические ноны','mode':'major','progression':['ii9','V9','Imaj9','Imaj9']},
 {'id':'catalog-power','genre':'rock','title':'Синтетические квинты','mode':'major','progression':['I5','♭VII5','IV5','I5']}
]
for i,e in enumerate(EXAMPLES):
 e.setdefault('lesson_id',None);e['library_section']='genres' if e.get('genre') else 'course';e['position']=i+1
 e.update(goal='Проверочный пример.',discuss='Тестовая практика.',loop=bool(e.get('genre')))
 e.setdefault('theory',{'meter':4,'notation':{'show_bass':True}})
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Проверка','title':'Тестовый урок','goal':'Практика.','preparation':[],'topics':[],'theory':{'sections':[]}}],'exercises':EXAMPLES,'progress':[],'favorites':[]}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 launch={'executable_path':os.environ['CHROMIUM_EXECUTABLE']} if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE') else {}
 browser=await engine.launch(**launch);ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<1025)
 saved=[]
 async def mock(route):
  path=route.request.url.split('?')[0]
  if path.endswith('/auth/v1/user'):data={'id':USER,'email':'synthetic@example.invalid','email_confirmed_at':'2026-01-01'}
  elif path.endswith('/auth/v1/settings'):data={'external':{'google':True}}
  elif path.endswith('/rest/v1/members'):data=[{'user_id':USER,'active':True,'is_owner':False}]
  elif '/rest/v1/' in path:
   name=path.rsplit('/',1)[-1];assert name in FIXTURE,path
   if route.request.method=='POST':assert name=='favorites';saved.append(route.request.post_data_json);data=saved[:]
   else:data=saved[:] if name=='favorites' else FIXTURE[name]
  else:raise AssertionError(path)
  await route.fulfill(json=data)
 await ctx.route('https://*.supabase.co/**',mock)
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view={view}]').click()
 async def fits():
  # Give the renderer's ResizeObserver one completed frame after replacing a category.
  await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
  geometry=await page.evaluate("""()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('#content *')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).slice(0,30).map(n=>({tag:n.tagName,cls:n.getAttribute('class'),text:n.textContent.slice(0,120),width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right,min:getComputedStyle(n).minWidth,grid:getComputedStyle(n).gridTemplateColumns}))})""")
  if geometry['scroll']>geometry['width']+1:
   print('Overflow diagnostics:',engine.name,w,h,json.dumps(geometry,ensure_ascii=False),flush=True)
   await page.screenshot(path=str(OUT/f'library-overflow-{engine.name}-{w}x{h}.png'),full_page=True)
  assert geometry['scroll']<=geometry['width']+1,geometry
  assert not await page.evaluate('''()=>[...document.querySelectorAll('.score-document')].some(svg=>{
   const v=svg.viewBox.baseVal,m=svg.getScreenCTM().inverse();
   return [...svg.querySelectorAll('[data-note],.vf-accidental,.vf-clef')].some(n=>{const b=n.getBoundingClientRect(),a=new DOMPoint(b.left,b.top).matrixTransform(m),z=new DOMPoint(b.right,b.bottom).matrixTransform(m);return a.x< -1||a.y< -1||z.x>v.width+1||z.y>v.height+1});})''')
 try:
  await page.goto(base,wait_until='networkidle');await expect(page.locator('.course-card')).to_have_count(1)
  await expect(page.locator('.page-count')).to_contain_text('1 упражнений')
  await page.locator('.course-card').click();await expect(page.locator('.exercise')).to_have_count(1)
  await nav('library');await expect(page.locator('.exercise')).to_have_count(5)
  await page.locator('[data-collection=genres]').click();await expect(page.locator('.exercise')).to_have_count(4)
  await expect(page.locator('#filter')).to_be_hidden();await expect(page.locator('#genre-filter')).to_be_visible()
  await page.select_option('#genre-filter','blues');await expect(page.locator('.exercise')).to_have_count(1)
  await expect(page.locator('.score-measure')).to_have_count(12);await expect(page.locator('.genre-badge')).to_contain_text('12 тактов')
  await page.select_option('#genre-filter','waltz');await expect(page.locator('.genre-badge')).to_contain_text('3/4')
  await expect(page.locator('[data-duration="3"]')).to_have_count(17)
  await page.locator('[data-voicing]').click();await fits()
  await page.locator('.exercise').screenshot(path=str(OUT/f'library-waltz-{engine.name}-{w}x{h}.png'))
  await page.select_option('#pattern','arpeggio');await expect(page.locator('[data-hand=right] [data-note]')).to_have_count(24)
  await page.locator('[data-play]').click();await expect(page.locator('[data-play][aria-pressed="true"]')).to_have_count(1);await stop_card(page);await fits()
  await page.select_option('#pattern','chords');await page.select_option('#genre-filter','jazz')
  await expect(page.locator('[data-hand=right] [data-note]')).to_have_count(20)
  await page.locator('[data-voicing]').click();await choose_key(page.locator('[data-key]'),'F#');await fits()
  await page.locator('[data-star]').click();await nav('favorites');await expect(page.locator('.exercise')).to_have_count(1)
  await expect(page.locator('.exercise')).to_have_attribute('data-eid','catalog-jazz')
  await nav('library');await page.locator('[data-collection=course]').click();await expect(page.locator('.exercise')).to_have_count(1)
  await page.locator('[data-collection=genres]').click();await page.locator('#search').fill('квинты');await expect(page.locator('.exercise')).to_have_count(1)
  await page.locator('[data-voicing]').click();await page.select_option('#pattern','arpeggio');await fits()
  await nav('reference');await expect(page.locator('.guide-card')).to_have_count(44);await expect(page.locator('.guide-category')).to_have_count(7);await fits()
  await page.select_option('[data-guide-category]','ninths');await expect(page.locator('.guide-card')).to_have_count(4)
  ninth=page.locator('[data-chord-type=ninth]');await ninth.locator('[data-inversion]').select_option('4')
  await expect(ninth.locator('[data-guide-bass]')).to_contain_text('ре — нона')
  await page.select_option('[data-guide-root]','F#');await expect(ninth.locator('[data-chord-name]')).to_have_text('F♯9/G♯');await fits()
  await page.locator('.guide-category').screenshot(path=str(OUT/f'library-ninths-{engine.name}-{w}x{h}.png'))
  await page.select_option('[data-guide-category]','extensions');await expect(page.locator('.guide-card')).to_have_count(5)
  await fits();await page.locator('.guide-category').screenshot(path=str(OUT/f'library-extensions-{engine.name}-{w}x{h}.png'));await page.select_option('[data-guide-category]','all');await page.locator('[data-guide-search]').fill('sus2')
  await expect(page.locator('[data-chord-type=sus2]')).to_be_visible();await page.locator('[data-guide-search]').fill('ZZnotfound');await expect(page.locator('.guide-card')).to_have_count(0)
  await page.locator('[data-guide-search]').fill('');await expect(page.locator('.guide-card')).to_have_count(44);await fits()
  assert not errors,errors
  assert await page.locator('[data-zoom],[data-download],#midi').count()==0
  print(f'PASS {engine.name} {w}x{h}: 44 reference chords; categories/search; five-tone voicings; genre filters and private favorites; 12-bar blues; 3/4 notation/audio; responsive geometry',flush=True)
 finally:await ctx.close();await browser.close()
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,320,812),(p.chromium,1440,960),(p.webkit,375,812),(p.webkit,932,430)]:
    if os.environ.get('CHROMIUM_ONLY') and engine.name!='chromium':continue
    await scenario(engine,w,h,f'http://127.0.0.1:{server.server_port}/')
 finally:server.shutdown()
asyncio.run(main())
