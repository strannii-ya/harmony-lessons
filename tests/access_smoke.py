"""Owner invitation UI with synthetic responses only. No real users, emails or sessions."""
import asyncio, functools, threading, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
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
USER='11111111-1111-4111-8111-111111111111'
INVITE='22222222-2222-4222-8222-222222222222'
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Проверка','title':'Тестовый урок','goal':'Проверка доступа','preparation':[],'topics':[]}], 'exercises':[{'id':'fixture','lesson_id':1,'position':1,'title':'Тестовая последовательность','goal':'Проверка','discuss':'Проверка','mode':'major','progression':['I','IV','V','I']}], 'progress':[], 'favorites':[]}
async def scenario(engine,width,height,owner=True):
 browser=await engine.launch()
 context=await browser.new_context(viewport={'width':width,'height':height},has_touch=width<1100)
 invitations=[];writes=[];reads=[]
 async def mock(route):
  path=urlparse(route.request.url).path;method=route.request.method
  if path=='/auth/v1/user':data={'id':USER,'email':'fixture@example.invalid','email_confirmed_at':'2026-01-01','user_metadata':{'is_owner':True}}
  elif path=='/auth/v1/settings':data={'external':{'google':True}}
  elif path=='/rest/v1/members':data=[{'user_id':USER,'active':True,'is_owner':owner}]
  elif path=='/auth/v1/logout':data={}
  elif path=='/rest/v1/library_access':
   reads.append(method)
   if not owner:
    await route.fulfill(status=403,json={'message':'Forbidden'});return
   if method=='POST':
    body=route.request.post_data_json;assert set(body)=={'email'};writes.append(body)
    invitations.append({'id':INVITE,'email':body['email'],'active':True,'joined_at':None,'created_at':'2026-10-18T12:00:00Z'})
   elif method=='PATCH':
    body=route.request.post_data_json;assert set(body)=={'active'};assert parse_qs(urlparse(route.request.url).query)['id']==['eq.'+INVITE];writes.append(body)
    invitations[0]['active']=body['active']
   data=invitations.copy()
  elif path.split('/')[-1] in FIXTURE:data=FIXTURE[path.split('/')[-1]]
  else:raise AssertionError(f'Unexpected API: {path}')
  await route.fulfill(json=data)
 await context.route('https://*.supabase.co/**',mock)
 page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 await page.goto(BASE+'#access',wait_until='networkidle')
 if not owner:
  await expect(page.locator('[data-view=access]')).to_be_hidden()
  await expect(page.locator('#invite-form')).to_have_count(0)
  assert not reads and not writes
  await expect(page.locator('#content')).to_contain_text('только владельцу')
 else:
  await expect(page.locator('#invite-email')).to_be_visible()
  await expect(page.locator('#access-list')).to_contain_text('Пока никого нет')
  await page.locator('#invite-email').fill('Friend@Example.COM')
  await page.locator('#invite-form button').click()
  await expect(page.locator('.access-person')).to_have_count(1)
  await expect(page.locator('.access-person strong')).to_have_text('friend@example.com')
  await expect(page.locator('.access-badge')).to_have_text('Ожидает первого входа')
  await page.locator('#invite-email').fill('friend@example.com');await page.locator('#invite-form button').click()
  await expect(page.locator('#access-status')).to_have_text('Этот аккаунт уже имеет доступ.')
  assert len(writes)==1
  page.once('dialog',lambda dialog:dialog.accept())
  await page.locator('[data-access-toggle]').click()
  await expect(page.locator('.access-badge')).to_have_text('Доступ отключён')
  await expect(page.locator('[data-access-toggle]')).to_have_text('Вернуть доступ')
  await page.locator('[data-access-toggle]').click()
  await expect(page.locator('.access-badge')).to_have_text('Ожидает первого входа')
  assert writes==[{'email':'friend@example.com'},{'active':False},{'active':True}]
  assert await page.locator('#share-url').input_value()==BASE
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  if width>height and height<=520:await expect(page.locator('.topbar')).to_be_hidden()
  await page.screenshot(path=str(OUT/f'access-{engine.name}-{width}x{height}.png'),full_page=True)
  await page.reload(wait_until='networkidle');await expect(page.locator('#invite-form')).to_be_visible()
  if width<=900 or (height<=520 and width<=1024):
   await page.locator('#landscape-menu' if width>height and height<=520 else '#menu').click()
  await page.locator('[data-lesson]').first.click();await expect(page.locator('.score-document')).to_have_count(1)
  if width<=900 or (height<=520 and width<=1024):
   await page.locator('#landscape-menu' if width>height and height<=520 else '#menu').click()
  await page.locator('[data-view=access]').click();await expect(page.locator('#invite-form')).to_be_visible()
  if width<=900 or (height<=520 and width<=1024):
   await page.locator('#landscape-menu' if width>height and height<=520 else '#menu').click()
  await page.locator('#signout').click();await expect(page.locator('#shell')).to_be_hidden()
  assert await page.locator('#invite-form').count()==0
 assert not errors,errors
 await context.close();await browser.close()
 print(f'PASS access {engine.name} {width}x{height} owner={owner}',flush=True)
async def main():
 try:
  async with async_playwright() as p:
   for w,h in [(320,812),(390,844),(932,430),(1440,960)]:await scenario(p.chromium,w,h)
   for w,h in [(375,812),(932,430)]:await scenario(p.webkit,w,h)
   await scenario(p.chromium,390,844,False);await scenario(p.webkit,375,812,False)
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
