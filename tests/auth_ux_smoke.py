"""Synthetic auth only: no real users, emails, tokens or membership writes."""
import asyncio,functools,json,os,threading
from pathlib import Path
from urllib.parse import urlparse,unquote
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
KEY='harmony.synthetic.supabase.co.session'
USER='11111111-1111-4111-8111-111111111111'
THEORY={'sections':[{'title':'Главные функции','paragraphs':['Сыграй оборот и сравни движение голосов.']} ]}
DATA={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Практика','title':'Движение голосов','goal':'Сравнить созвучия.','preparation':['Повтори основные функции.'],'topics':['Общие звуки.'],'theory':THEORY}],
 'exercises':[{'id':'auth-example','lesson_id':1,'position':1,'title':'Плавные переходы','mode':'major','progression':['I','IV','V7','I'],'goal':'Сохраняй общие звуки.','discuss':'Сравнить положения.','loop':False,'theory':THEORY}],'progress':[],'favorites':[]}
PAIR={'access_token':'synthetic-old','refresh_token':'synthetic-refresh','expires_at':4102444800}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 launch={'executable_path':os.environ['CHROMIUM_EXECUTABLE']} if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE') else {}
 browser=await engine.launch(**launch)
 ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<=1024)
 state={'config':0,'exchange':0,'refresh':0,'logout':[], 'error':None, 'deny':False,'delay':False,'module_delay':False}
 async def route(r):
  url=r.request.url;path=url.split('?')[0]
  if url.startswith(base):
   if path.endswith('/config.json'):
    state['config']+=1
    return await r.fulfill(json={'supabaseUrl':'https://synthetic.supabase.co','publishableKey':'sb_publishable_fixture'})
   if path.endswith('/app.js') and state['module_delay']:await asyncio.sleep(.6)
   if os.environ.get('AUTH_ROUTED'):
    rel=unquote(urlparse(url).path[len(urlparse(base).path):]) or 'index.html'
    file=(ROOT/'dist'/rel).resolve();assert file.is_relative_to((ROOT/'dist').resolve())
    if not file.is_file():return await r.fulfill(status=404,body='not found')
    mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}.get(file.suffix,'application/octet-stream')
    return await r.fulfill(body=file.read_bytes(),content_type=mime)
   return await r.continue_()
  if not url.startswith('https://synthetic.supabase.co/'):return await r.abort()
  if '/token?grant_type=pkce' in url:
   state['exchange']+=1
   assert r.request.post_data_json['code_verifier']=='a'*43
   if state['delay']:await asyncio.sleep(.7)
   if state['error']:return await r.fulfill(status=state['error'],json={'message':'Временно недоступно'})
   return await r.fulfill(json={**PAIR,'provider_token':'DO-NOT-STORE'})
  if '/token?grant_type=refresh_token' in url:
   state['refresh']+=1
   return await r.fulfill(json={**PAIR,'access_token':'synthetic-new','refresh_token':'synthetic-rotated'})
  if path.endswith('/settings'):return await r.fulfill(json={'external':{'google':True}})
  if path.endswith('/user'):
   if state['error']:return await r.fulfill(status=state['error'],json={'message':'Временно недоступно'})
   return await r.fulfill(json={'id':USER,'email':'ui@example.invalid','email_confirmed_at':'2026-01-01'})
  if '/rest/v1/members' in path:return await r.fulfill(json=[] if state['deny'] else [{'user_id':USER,'is_owner':True,'active':True}])
  if path.endswith('/logout'):
   state['logout'].append(url);return await r.fulfill(status=204,body='')
  name=path.rsplit('/',1)[-1];assert name in DATA,url
  if state['delay'] and name=='lessons':await asyncio.sleep(.6)
  assert r.request.method=='GET','unexpected write'
  return await r.fulfill(json=DATA[name])
 await ctx.route('**/*',route)
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  await page.locator(f'[data-view={view}]').click()
 async def heading_sizes():
  values=await page.locator('#content details > summary').evaluate_all('ns=>ns.map(n=>[n.textContent,getComputedStyle(n).fontSize])')
  assert values and all(size=='14px' for _,size in values),values
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 try:
  await page.goto(base,wait_until='networkidle')
  await expect(page.locator('#gate')).to_be_visible();await expect(page.locator('#auth-loading')).to_be_hidden()
  await expect(page.locator('#remember')).to_be_checked();assert state['config']==1
  await expect(page.locator('#yandex-signin svg.yandex-logo path')).to_have_count(1)
  assert await page.locator('#yandex-signin svg').evaluate('s=>s.viewBox.baseVal.width')==44
  await page.screenshot(path=str(OUT/f'auth-login-{engine.name}-{w}x{h}.png'),full_page=True)
  # Delayed scripts, code exchange, membership and course loading must never flash the login form.
  await page.add_init_script("""window.loginFlashes=[];new MutationObserver(()=>{const g=document.getElementById('gate');if(location.search.includes('code=')||window.trackCallback){window.trackCallback=true;if(g&&!g.hidden)window.loginFlashes.push(performance.now());}}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});""")
  for provider in ['google','yandex']:
   await page.evaluate('([key,provider,base])=>{sessionStorage.clear();localStorage.removeItem(key);localStorage.setItem(key+".remember","true");sessionStorage.setItem(key+".pkce",JSON.stringify({verifier:"a".repeat(43),redirectTo:base,startedAt:Date.now(),provider}));}',[KEY,provider,base])
   state['delay']=True;state['module_delay']=True
   await page.goto(base+'?code=synthetic-'+provider,wait_until='commit')
   await expect(page.locator('#auth-loading')).to_be_visible();await expect(page.locator('#gate')).to_be_hidden()
   await page.screenshot(path=str(OUT/f'auth-loading-{provider}-{engine.name}-{w}x{h}.png'))
   await expect(page.locator('#shell')).to_be_visible();await expect(page.locator('#auth-loading')).to_be_hidden()
   assert await page.evaluate('window.loginFlashes')==[]
   assert 'code=' not in page.url
   assert 'DO-NOT-STORE' not in await page.evaluate('(k)=>localStorage.getItem(k)',KEY)
   state['delay']=False;state['module_delay']=False
  assert state['exchange']==2
  # Visible-tab resume silently refreshes an expired token and preserves the open lesson.
  await page.locator('.course-card').first.click();await heading_sizes()
  await page.screenshot(path=str(OUT/f'auth-headings-{engine.name}-{w}x{h}.png'),full_page=True)
  await page.evaluate('''async()=>{const v=(await(await fetch('./version.json')).json()).version;const {getLibraryAPI}=await import('./auth-client.js?v='+v);const a=await getLibraryAPI();a.store({...a.session,expires_at:1});window.dispatchEvent(new Event('focus'));}''')
  await page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).access_token==="synthetic-new"',arg=KEY)
  assert state['refresh']==1;await expect(page.locator('#shell')).to_be_visible()
  for view in ['modes','reference','library']:
   await nav(view);await heading_sizes()
  # A transient restore error offers retry, not another provider login, and keeps the pair intact.
  state['error']=429;await page.reload(wait_until='networkidle')
  await expect(page.locator('#auth-loading-actions')).to_be_visible();await expect(page.locator('#gate')).to_be_hidden()
  assert await page.evaluate('(k)=>!!localStorage.getItem(k)',KEY)
  state['error']=None;await page.locator('#retry-auth').click();await expect(page.locator('#shell')).to_be_visible()
  assert state['exchange']==2
  # A new tab can reuse the remembered session. Normal sign-out is explicitly local.
  newtab=await ctx.new_page();await newtab.goto(base,wait_until='networkidle');await expect(newtab.locator('#shell')).to_be_visible()
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  await page.locator('#signout').click();await expect(page.locator('#gate')).to_be_visible()
  await expect(newtab.locator('#shell')).to_be_hidden();await expect(newtab.locator('#gate')).to_be_visible()
  assert state['logout']==['https://synthetic.supabase.co/auth/v1/logout?scope=local']
  await newtab.close()
  # Invitations remain mandatory even for a structurally valid stored session.
  state['deny']=True
  await page.evaluate('([k,s])=>localStorage.setItem(k,JSON.stringify(s))',[KEY,PAIR]);await page.reload(wait_until='networkidle')
  await expect(page.locator('#gate')).to_be_visible();await expect(page.locator('#login-status')).to_contain_text('не имеет доступа')
  assert await page.evaluate('(k)=>localStorage.getItem(k)',KEY) is None
  assert not errors,errors
  print(f'PASS {engine.name} {w}x{h}: no OAuth login flash, persistent session, resume refresh, local logout, retry, protected content and 14px disclosure headings',flush=True)
 finally:await ctx.close();await browser.close()
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,320,812),(p.chromium,1440,960),(p.webkit,375,812),(p.webkit,932,430)]:
    if os.environ.get('CHROMIUM_ONLY') and engine.name!='chromium':continue
    await scenario(engine,w,h,'https://strannii-ya.github.io/harmony-lessons/' if os.environ.get('AUTH_ROUTED') else f'http://127.0.0.1:{server.server_port}/')
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
