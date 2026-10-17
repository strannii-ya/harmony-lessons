"""Continuous scores: synthetic API only; no user session, no emails, no private data."""
import asyncio, functools, json, os, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT/'site'
USER='11111111-1111-4111-8111-111111111111'
PROJECT='https://synthetic.supabase.co'
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
FIXTURE={
 'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Проверка','title':'Доминантсептаккорд','goal':'Подготовить и разрешить доминанту.','preparation':['Сыграть основной оборот.'],'topics':['Разрешение и продолжение.']}],
 'exercises':[
 {'id':'fixture-a','lesson_id':1,'position':1,'title':'Разрешение и продолжение','goal':'Отложить тонику.','discuss':'Сравнить два окончания.','mode':'major','loop':False,'progression':['I','vi7','ii7','V7','I','IV','iv','I']},
 {'id':'fixture-b','lesson_id':1,'position':2,'title':'Минорная каденция','goal':'Вернуться к тонике.','discuss':'Проследить вводный тон.','mode':'minor','loop':False,'progression':['i','iiø7','V7','i']},
 {'id':'fixture-c','lesson_id':1,'position':3,'title':'Другая тональность','goal':'Проверить смену ключевых знаков.','discuss':'Сыграть целиком.','mode':'major','loop':False,'progression':['I','V7/V',{'symbol':'I','offset':7},{'symbol':'V7','offset':7},{'symbol':'I','offset':7}]}
 ],'progress':[],'favorites':[]}
async def scenario(engine,width):
    executable=os.environ.get('CHROMIUM_PATH') if engine.name=='chromium' else None
    browser=await engine.launch(**({'executable_path':executable} if executable else {}))
    context=await browser.new_context(viewport={'width':width,'height':950},has_touch=width<900)
    async def mock(route):
        url=route.request.url;path=urlparse(url).path
        if url==BASE+'config.json':data={'supabaseUrl':PROJECT,'publishableKey':'sb_publishable_fixture'}
        elif url.startswith(BASE):return await route.continue_()
        elif url.startswith(PROJECT):
            if path.endswith('/user'):data={'id':USER,'email':'test@example.invalid','email_confirmed_at':'2026-01-01'}
            elif path.endswith('/members'):data=[{'user_id':USER}]
            elif path.split('/')[-1] in FIXTURE:data=FIXTURE[path.split('/')[-1]]
            else:raise AssertionError('Unexpected API request')
        else:return await route.abort()
        await route.fulfill(json=data)
    await context.route('**/*',mock)
    page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:4102444800}));")
    try:
        await page.goto(BASE,wait_until='networkidle')
        await page.locator('.course-card').first.click()
        await expect(page.locator('.score-document')).to_have_count(3)
        assert await page.locator('details.exercise').count()==0
        for i,e in enumerate(FIXTURE['exercises']):
            score=page.locator('.score').nth(i)
            await expect(score.locator('svg')).to_have_count(1)
            await expect(score.locator('[data-score-bar]')).to_have_count(len(e['progression']))
        assert await page.locator('.hero-stamp,.page-footer').count()==0
        assert 'Гармония становится' not in await page.locator('body').inner_text()
        async def fits(stage):
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,stage)
            for n in await page.locator('.score-document').all():
                bad=await n.evaluate('(svg)=>{const v=svg.viewBox.baseVal;return Array.from(svg.querySelectorAll("ellipse")).some(n=>{const b=n.getBBox();return b.x<0||b.y<0||b.x+b.width>v.width||b.y+b.height>v.height;});}')
                assert not bad,(width,stage,'clipped notes')
        await fits('chords')
        sheet=page.locator('.score').first
        initial=await sheet.locator('[data-midi]').evaluate_all('(ns)=>ns.map(n=>+n.dataset.midi)')
        await page.locator('[data-shift="1"]').first.click()
        await expect(page.locator('[data-key]').first).to_have_value('Db')
        shifted=await sheet.locator('[data-midi]').evaluate_all('(ns)=>ns.map(n=>+n.dataset.midi)')
        assert [(b-a)%12 for a,b in zip(initial,shifted)]==[1]*len(initial)
        await expect(sheet.locator('svg')).to_have_count(1)
        await page.select_option('#pattern','arpeggio')
        await expect(sheet.locator('svg')).to_have_count(1)
        await expect(sheet.locator('[data-score-bar]')).to_have_count(8)
        await fits('arpeggio')
        await page.locator('[data-zoom]').first.click();await fits('zoom')
        await page.locator('[data-zoom]').first.click()
        # Playback must not replace the score or hide the other measures.
        await page.locator('[data-play]').first.click()
        await expect(page.locator('#player')).to_be_visible()
        await expect(sheet.locator('.playing')).to_have_count(1)
        await sheet.locator('svg').evaluate('(n)=>n.dataset.sentinel="same-node"')
        await page.wait_for_timeout(3800)
        assert await sheet.locator('svg').get_attribute('data-sentinel')=='same-node'
        await expect(sheet.locator('[data-score-bar]')).to_have_count(8)
        await expect(sheet.locator('.playing')).to_have_count(1)
        await page.locator('#hand').select_option('left')
        await page.locator('#close-player').click()
        await page.select_option('#pattern','chords')
        await page.locator('[data-key]').first.select_option('C')
        if width<900:
            await page.locator('#menu').click();await page.locator('.nav-close').click()
        await page.locator('#focus').click();await page.wait_for_timeout(100);await fits('focus')
        await page.locator('#focus').click()
        out=ROOT/'ui-results';out.mkdir(exist_ok=True)
        await page.screenshot(path=str(out/f'continuous-{engine.name}-{width}.png'),full_page=True)
        # Resize reflows a complete score, including after changing orientation.
        await page.set_viewport_size({'width':768 if width<600 else 375,'height':950})
        await page.wait_for_timeout(100)
        await expect(sheet.locator('[data-score-bar]')).to_have_count(8)
        await fits('orientation')
        assert not errors,errors
        print(f'PASS {engine.name} {width}: complete scores, reflow, transpose, arpeggios, zoom, playback, no page switching')
    finally:
        await context.close();await browser.close()
async def main():
    try:
        async with async_playwright() as p:
            for width in [320,375,768,1440]:await scenario(p.chromium,width)
            if not os.environ.get('CHROMIUM_ONLY'):await scenario(p.webkit,375)
    finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
