"""Synthetic login only. Real browser redirect/PKCE behaviour; no Yandex account or email."""
import asyncio, functools, os, threading, time
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT/'site'
OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
# WebKit cannot synthesize 302 through Route.fulfill. Use an actual HTTP
# response on a second local origin so both engines test a real opaque redirect.
class RedirectHandler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if urlparse(self.path).path!='/auth/v1/authorize':self.send_error(404);return
  self.send_response(302)
  self.send_header('Location','https://oauth.yandex.ru/authorize?state=synthetic-only')
  self.send_header('Access-Control-Allow-Origin',BASE.rstrip('/'))
  self.send_header('Cache-Control','no-store')
  self.send_header('Content-Length','0');self.end_headers()
redirect_server=ThreadingHTTPServer(('127.0.0.1',0),RedirectHandler)
threading.Thread(target=redirect_server.serve_forever,daemon=True).start()
PROJECT=f'http://127.0.0.1:{redirect_server.server_port}'
USER='11111111-1111-4111-8111-111111111111'
async def scenario(engine,width,height):
 options={}
 if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE'):
  options={'executable_path':os.environ['CHROMIUM_EXECUTABLE'],'args':['--no-sandbox']}
 browser=await engine.launch(**options)
 context=await browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000)
 state={'enabled':False,'member':True,'probes':0,'navigations':0,'mail':0,'external':0,'authorize':None,'exchanges':0}
 cors={'Access-Control-Allow-Origin':BASE.rstrip('/'),'Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}
 async def respond(route):
  request=route.request;url=request.url;path=urlparse(url).path
  if url==BASE+'config.json':return await route.fulfill(json={'supabaseUrl':PROJECT,'publishableKey':'sb_publishable_fixture'})
  if url.startswith(BASE):
   if path=='/':
    # Allow just the local synthetic Auth origin in this fixture's CSP.
    html=(PUBLIC/'index.html').read_text().replace('https://*.supabase.co',PROJECT)
    return await route.fulfill(content_type='text/html',body=html)
   return await route.continue_()
  if not url.startswith(PROJECT+'/'):
   state['external']+=1
   return await route.abort()
  if request.method=='OPTIONS':return await route.fulfill(status=204,headers=cors)
  if path.endswith('/settings'):data={'external':{'google':True}}
  elif path.endswith('/authorize'):
   query=parse_qs(urlparse(url).query);state['authorize']=query
   if query.get('provider')==['custom:yandex'] and request.resource_type=='fetch':
    state['probes']+=1
    assert 'authorization' not in request.headers
    if not state['enabled']:return await route.fulfill(status=400,json={'error_code':'validation_failed','msg':'Provider disabled'},headers=cors)
    return await route.continue_()
   state['navigations']+=1
   return await route.fulfill(content_type='text/html',body='<p>Синтетическая страница авторизации. Нет запросов к реальному провайдеру.</p>')
  elif path.endswith('/token'):
   body=request.post_data_json;assert body.get('auth_code')=='synthetic-code' and len(body.get('code_verifier',''))==43
   state['exchanges']+=1
   data={'access_token':'synthetic-access','refresh_token':'synthetic-refresh','expires_at':int(time.time())+3600,'provider_token':'UPSTREAM-DO-NOT-STORE'}
  elif path.endswith('/user'):data={'id':USER,'email':'friend@yandex.ru','email_confirmed_at':'2026-01-01'}
  elif path.endswith('/members'):data=[{'user_id':USER,'active':True,'is_owner':False}] if state['member'] else []
  elif path.endswith('/lessons'):data=[{'id':1,'position':1,'chapter':1,'chapter_title':'Тестовый раздел','title':'Проверка входа','goal':'Синтетические данные','preparation':[],'topics':[]}]
  elif path.endswith('/exercises') or path.endswith('/progress') or path.endswith('/favorites'):data=[]
  elif path.endswith('/logout'):data={}
  elif path.endswith('/otp'):
   state['mail']+=1
   raise AssertionError('Email must not be sent')
  else:raise AssertionError('Unexpected endpoint: '+path)
  await route.fulfill(json=data,headers=cors)
 await context.route('**/*',respond)
 page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.goto(BASE,wait_until='networkidle')
 await expect(page.locator('#google-signin')).to_be_enabled();await expect(page.locator('#yandex-signin')).to_be_enabled()
 assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 await page.screenshot(path=str(OUT/f'yandex-login-{engine.name}-{width}x{height}.png'),full_page=True)
 await page.locator('#yandex-signin').click()
 await expect(page.locator('#google-status')).to_contain_text('ещё не настроен')
 await expect(page.locator('#google-signin')).to_be_enabled()
 assert page.url==BASE and state['navigations']==0 and state['probes']==1
 # A missing custom provider must not interfere with the existing Google path.
 await page.locator('#google-signin').click();await page.wait_for_url(PROJECT+'/auth/v1/authorize*')
 assert state['authorize']['provider']==['google'] and state['authorize']['scopes']==['openid email profile']
 await page.goto(BASE)
 state['enabled']=True
 await page.locator('#remember').check();await page.locator('#yandex-signin').click()
 await page.wait_for_url(PROJECT+'/auth/v1/authorize*')
 assert state['authorize']['provider']==['custom:yandex']
 assert state['authorize']['scopes']==['login:email']
 assert state['authorize']['code_challenge_method']==['s256']
 assert state['authorize']['redirect_to']==[BASE] and state['external']==0
 await page.goto(BASE+'?code=synthetic-code')
 await expect(page.locator('#shell')).to_be_visible();assert 'code=' not in page.url
 assert await page.locator('[data-view="access"]').is_hidden()
 stored=await page.evaluate('JSON.stringify(localStorage)')
 assert 'synthetic-refresh' in stored and 'UPSTREAM-DO-NOT-STORE' not in stored
 new_tab=await context.new_page();await new_tab.goto(BASE);await expect(new_tab.locator('#shell')).to_be_visible()
 if height<520 and width>height:await page.locator('#landscape-menu').click()
 elif width<900:await page.locator('#menu').click()
 await page.locator('#signout').click();await expect(page.locator('#gate')).to_be_visible();await expect(new_tab.locator('#gate')).to_be_visible();await new_tab.close()
 state['member']=False
 await page.locator('#yandex-signin').click();await page.wait_for_url(PROJECT+'/auth/v1/authorize*')
 await page.goto(BASE+'?code=synthetic-code')
 await expect(page.locator('#login-status')).to_contain_text('не имеет доступа')
 assert await page.locator('#shell').is_hidden()
 assert 'synthetic-refresh' not in await page.evaluate('JSON.stringify(localStorage)')
 assert state['mail']==0 and state['external']==0 and not errors,(state,errors)
 await context.close();await browser.close()
 print(f'PASS {engine.name} {width}x{height}: both providers; disabled Yandex; real opaque redirect; PKCE; persistence; non-owner; unauthorized denial; no email',flush=True)
async def main():
 try:
  async with async_playwright() as p:
   for engine in [p.chromium,p.webkit]:
    if engine.name=='webkit' and os.environ.get('YANDEX_CHROMIUM_ONLY'):continue
    for width,height in [(375,812),(932,430),(1440,960)]:await scenario(engine,width,height)
 finally:server.shutdown();redirect_server.shutdown()
if __name__=='__main__':asyncio.run(main())
