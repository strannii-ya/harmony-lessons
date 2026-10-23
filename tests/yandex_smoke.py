"""Synthetic identities over actual local HTTP. No real provider, account or email."""
import asyncio, functools, json, os, threading, time
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT/'site'
OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
class Site(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/config.json':
   body=json.dumps({'supabaseUrl':PROJECT,'publishableKey':'sb_publishable_fixture'}).encode();kind='application/json'
  elif path=='/':
   body=(PUBLIC/'index.html').read_text().replace('https://*.supabase.co',PROJECT).encode();kind='text/html; charset=utf-8'
  else:return super().do_GET()
  self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Site,directory=str(PUBLIC)))
BASE=f'http://127.0.0.1:{server.server_port}/'
class Provider(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def headers_for(self,code,kind='application/json'):
  self.send_response(code)
  self.send_header('Access-Control-Allow-Origin',BASE.rstrip('/'))
  self.send_header('Access-Control-Allow-Headers','apikey,content-type,authorization,prefer')
  self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  self.send_header('Content-Type',kind);self.send_header('Cache-Control','no-store')
 def reply(self,data,code=200):
  body=json.dumps(data).encode();self.headers_for(code);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_OPTIONS(self):
  self.headers_for(204);self.send_header('Content-Length','0');self.end_headers()
 def do_GET(self):
  state=self.server.state;path=urlparse(self.path).path
  if path.endswith('/settings'):return self.reply({'external':{'google':True}})
  if path.endswith('/authorize'):
   query=parse_qs(urlparse(self.path).query);state['authorize']=query
   if 'text/html' not in self.headers.get('Accept',''):
    state['probes']+=1
    state['failures'].append('Unexpected preflight OAuth request')
    return self.reply({'error':'OAuth must start with one navigation'},500)
   state['navigations']+=1
   body=b'<p>Synthetic provider page. No real OAuth request.</p>';self.headers_for(200,'text/html');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
  if path.endswith('/user'):return self.reply({'id':USER,'email':'friend@yandex.ru','email_confirmed_at':'2026-01-01'})
  if path.endswith('/members'):return self.reply([{'user_id':USER,'active':True,'is_owner':state['admin']}] if state['member'] else [])
  if path.endswith('/lessons'):return self.reply([{'id':1,'position':1,'chapter':1,'chapter_title':'Тестовый раздел','title':'Проверка входа','goal':'Синтетические данные','preparation':[],'topics':[]}])
  if any(path.endswith('/'+table) for table in ['exercises','progress','favorites','library_access']):return self.reply([])
  state['failures'].append('Unexpected GET '+path);self.reply({'error':'unexpected'},500)
 def do_POST(self):
  state=self.server.state;path=urlparse(self.path).path
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
  if path.endswith('/token'):
   if body.get('auth_code')!='synthetic-code' or len(body.get('code_verifier',''))!=43:state['failures'].append('Incorrect code exchange');return self.reply({'error':'bad code'},400)
   state['exchanges']+=1
   return self.reply({'access_token':'synthetic-access','refresh_token':'synthetic-refresh','expires_at':int(time.time())+3600,'provider_token':'UPSTREAM-DO-NOT-STORE'})
  if path.endswith('/logout'):return self.reply({})
  if path.endswith('/otp'):state['mail']+=1
  state['failures'].append('Unexpected POST '+path);self.reply({'error':'unexpected'},500)
provider=ThreadingHTTPServer(('127.0.0.1',0),Provider)
PROJECT=f'http://127.0.0.1:{provider.server_port}'
for s in [server,provider]:threading.Thread(target=s.serve_forever,daemon=True).start()
async def scenario(engine,width,height):
 options={'executable_path':os.environ['CHROMIUM_EXECUTABLE'],'args':['--no-sandbox']} if engine.name=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE') else {}
 browser=await engine.launch(**options)
 context=await browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000)
 state={'member':True,'admin':False,'probes':0,'navigations':0,'mail':0,'external':0,'authorize':None,'exchanges':0,'failures':[]};provider.state=state
 # Local app and Auth traffic are NOT intercepted. This avoids synthetic
 # address-space classifications and tests real cross-origin CORS/302 behaviour.
 async def forbidden(route):state['external']+=1;await route.abort()
 await context.route('https://**/*',forbidden)
 page=await context.new_page();errors=[];console=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda msg:console.append(msg.text) if msg.type=='error' else None)
 async def wait_authorize():
  try:await page.wait_for_url(PROJECT+'/auth/v1/authorize*',timeout=12000)
  except Exception:
   print('Synthetic OAuth diagnostics:',engine.name,state,'status:',await page.locator('#google-status').text_content(),'console:',console,flush=True)
   await page.screenshot(path=str(OUT/f'yandex-failure-{engine.name}-{width}x{height}.png'),full_page=True);raise
 await page.goto(BASE,wait_until='networkidle')
 await expect(page.locator('#google-signin')).to_be_enabled();await expect(page.locator('#yandex-signin')).to_be_enabled()
 assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 await page.screenshot(path=str(OUT/f'yandex-login-{engine.name}-{width}x{height}.png'),full_page=True)
 await page.locator('#google-signin').click();await wait_authorize()
 assert state['authorize']['provider']==['google'] and state['authorize']['scopes']==['openid email profile']
 await page.goto(BASE)
 await page.locator('#remember').check();await page.locator('#yandex-signin').click();await wait_authorize()
 assert state['authorize']['provider']==['custom:yandex'] and state['authorize']['scopes']==['login:email']
 assert state['authorize']['code_challenge_method']==['s256'] and state['authorize']['redirect_to']==[BASE] and state['external']==0
 assert state['navigations']==2 and state['probes']==0,'each provider launch must make exactly one navigation'
 await page.goto(BASE+'?code=synthetic-code');await expect(page.locator('#shell')).to_be_visible();assert 'code=' not in page.url
 assert await page.locator('[data-view="access"]').is_hidden()
 stored=await page.evaluate('JSON.stringify(localStorage)');assert 'synthetic-refresh' in stored and 'UPSTREAM-DO-NOT-STORE' not in stored
 state['admin']=True
 new_tab=await context.new_page();await new_tab.goto(BASE);await expect(new_tab.locator('#shell')).to_be_visible()
 assert not await new_tab.locator('[data-view="access"]').get_attribute('hidden')=='hidden'
 assert not await new_tab.locator('[data-view="access"]').evaluate('(e)=>e.hidden')
 if height<520 and width>height:await page.locator('#landscape-menu').click()
 elif width<900:await page.locator('#menu').click()
 await page.locator('#signout').click();await expect(page.locator('#gate')).to_be_visible();await expect(new_tab.locator('#gate')).to_be_visible();await new_tab.close()
 state['member']=False;state['admin']=False
 await page.locator('#yandex-signin').click();await wait_authorize();await page.goto(BASE+'?code=synthetic-code')
 await expect(page.locator('#login-status')).to_contain_text('не имеет доступа');assert await page.locator('#shell').is_hidden()
 assert 'synthetic-refresh' not in await page.evaluate('JSON.stringify(localStorage)')
 assert state['mail']==0 and state['external']==0 and not errors and not state['failures'],(state,errors)
 await context.close();await browser.close()
 print(f'PASS {engine.name} {width}x{height}: both providers, real CORS and opaque redirect, PKCE, persistence, admin visibility, unauthorized denial; no email',flush=True)
async def main():
 try:
  async with async_playwright() as p:
   for engine in [p.chromium,p.webkit]:
    if engine.name=='webkit' and os.environ.get('YANDEX_CHROMIUM_ONLY'):continue
    for width,height in [(375,812),(932,430),(1440,960)]:await scenario(engine,width,height)
 finally:server.shutdown();provider.shutdown()
if __name__=='__main__':asyncio.run(main())
