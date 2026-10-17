"""Synthetic OAuth only. Never contact Google, send email, or use production sessions."""
import asyncio, functools, json, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT/'site'
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
PROJECT='https://synthetic.supabase.co'
USER='11111111-1111-4111-8111-111111111111'
async def scenario(engine,width):
    browser=await engine.launch()
    context=await browser.new_context(viewport={'width':width,'height':850},has_touch=width<600)
    state={'enabled':False,'member':True,'mail':0,'authorize':None,'exchanges':0}
    async def respond(route):
        url=route.request.url; path=urlparse(url).path
        if url==BASE+'config.json':
            return await route.fulfill(json={'supabaseUrl':PROJECT,'publishableKey':'sb_publishable_fixture'})
        if url.startswith(BASE):return await route.continue_()
        if not url.startswith(PROJECT+'/'):return await route.abort()
        if path.endswith('/settings'):data={'external':{'google':state['enabled']}}
        elif path.endswith('/authorize'):
            state['authorize']=parse_qs(urlparse(url).query)
            return await route.fulfill(content_type='text/html',body='<p>Synthetic provider. No Google request was made.</p>')
        elif path.endswith('/token'):
            body=route.request.post_data_json
            assert body.get('auth_code')=='synthetic-code' and len(body.get('code_verifier',''))==43
            state['exchanges']+=1
            data={'access_token':'synthetic-access','refresh_token':'synthetic-refresh','expires_at':int(time.time())+3600,'provider_token':'DO-NOT-STORE'}
        elif path.endswith('/user'):data={'id':USER,'email':'owner@example.test','email_confirmed_at':'2026-01-01'}
        elif path.endswith('/members'):data=[{'user_id':USER}] if state['member'] else []
        elif path.endswith('/lessons'):data=[{'id':1,'position':1,'chapter':1,'chapter_title':'Тестовый раздел','title':'Тестовая тема','goal':'Синтетические данные проверки входа','preparation':[],'topics':[]}]
        elif path.endswith('/exercises') or path.endswith('/progress') or path.endswith('/favorites'):data=[]
        elif path.endswith('/logout'):data={}
        elif path.endswith('/otp'):
            state['mail']+=1
            return await route.fulfill(status=500,json={'message':'Email must not be requested'})
        else:raise AssertionError('Unexpected synthetic endpoint: '+path)
        await route.fulfill(json=data)
    await context.route('**/*',respond)
    page=await context.new_page()
    await page.goto(BASE)
    await page.locator('#google-signin:not([disabled])').wait_for()
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    await page.locator('#google-signin').click()
    await expect(page.locator('#google-status')).to_contain_text('ещё не включён')
    assert page.url==BASE and state['authorize'] is None
    out=ROOT/'ui-results';out.mkdir(exist_ok=True)
    await page.screenshot(path=str(out/f'google-login-{engine.name}-{width}.png'),full_page=True)
    state['enabled']=True
    await page.locator('#remember').check()
    await page.locator('#google-signin').click()
    await page.wait_for_url(PROJECT+'/auth/v1/authorize*')
    assert state['authorize']['code_challenge_method']==['s256']
    assert state['authorize']['redirect_to']==[BASE]
    assert state['authorize']['scopes']==['openid email profile']
    await page.goto(BASE+'?code=synthetic-code')
    await page.locator('#shell:not([hidden])').wait_for()
    assert 'code=' not in page.url and state['exchanges']==1
    saved=await page.evaluate('JSON.stringify(localStorage)')
    assert 'synthetic-refresh' in saved and 'DO-NOT-STORE' not in saved
    new_tab=await context.new_page()
    await new_tab.goto(BASE)
    await new_tab.locator('#shell:not([hidden])').wait_for()
    if width<900:await page.locator('#menu').click()
    await page.locator('#signout').click()
    await page.locator('#gate:not([hidden])').wait_for()
    await new_tab.locator('#gate:not([hidden])').wait_for()
    assert 'synthetic-refresh' not in await page.evaluate('JSON.stringify(localStorage)')
    await new_tab.close()
    state['member']=False
    await page.locator('#google-signin').click()
    await page.wait_for_url(PROJECT+'/auth/v1/authorize*')
    await page.goto(BASE+'?code=synthetic-code')
    await expect(page.locator('#login-status')).to_contain_text('не имеет доступа')
    assert await page.locator('#shell').is_hidden()
    assert 'synthetic-refresh' not in await page.evaluate('JSON.stringify(localStorage)')
    assert state['mail']==0
    await context.close();await browser.close()
    print(f'PASS {engine.name} {width}: Google state, PKCE callback, remembered session, logout, rejected non-member; no email')
async def main():
    try:
        async with async_playwright() as p:
            for engine in [p.chromium,p.webkit]:
                for width in [375,1440]:await scenario(engine,width)
    finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
