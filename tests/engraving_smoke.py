"""Only synthetic course data. No credentials, private lessons or live Auth requests."""
import asyncio, functools, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
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
THEORY={'sections':[{'title':'Строение и функция','paragraphs':['В малом минорном септаккорде минорное трезвучие сочетается с малой септимой.','Основной тон аккорда и бас различаются в обращениях.']},{'title':'Голосоведение','paragraphs':['Септимовый тон разрешается поступенно вниз. Это синтетический пример проверки вёрстки.']}], 'sources':[{'url':'https://old.bigenc.ru/music/text/2674683','label':'Обращение аккорда — БРЭ'},{'url':'javascript:alert(1)','label':'must-not-render'}]}
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Тестовый раздел','title':'Септаккорды и обращения','goal':'Тестовая подготовка.','preparation':['Построить аккорды.'],'topics':['Основной тон, бас, обращения.'],'theory':THEORY}], 'exercises':[{'id':'test-1','lesson_id':1,'position':1,'title':'Полный оборот','goal':'Проверить отображение.','discuss':'Сравнить разные положения.','mode':'major','loop':False,'progression':['I','IV','ii7','V7','I'],'theory':THEORY},{'id':'test-2','lesson_id':1,'position':2,'title':'Половинные ноты','goal':'Проверить головки нот.','discuss':'Линия видна сквозь головку.','mode':'major','loop':False,'progression':[{'symbol':'I','beats':2},{'symbol':'V7','beats':2}],'theory':THEORY}], 'progress':[], 'favorites':[]}
async def main():
 async with async_playwright() as p:
  for engine,widths in [(p.chromium,[320,375,768,1440]),(p.webkit,[375,1440])]:
   browser=await engine.launch()
   for width in widths:
    context=await browser.new_context(viewport={'width':width,'height':960},has_touch=width<900)
    async def mock(route):
     path=route.request.url
     if '/auth/v1/user' in path:data={'id':USER,'email':'ui@example.invalid','email_confirmed_at':'2026-01-01'}
     elif '/rest/v1/members' in path:data=[{'user_id':USER}]
     elif '/auth/v1/settings' in path:data={'external':{'google':True}}
     else:
      name=path.split('/rest/v1/')[-1].split('?')[0]
      assert name in FIXTURE, path
      data=FIXTURE[name]
     await route.fulfill(json=data)
    await context.route('https://*.supabase.co/**',mock)
    page=await context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
    await page.goto(BASE,wait_until='networkidle')
    await page.locator('.course-card').first.click()
    await page.locator('.score-document').first.wait_for()
    assert await page.locator('.score-document').count()==2
    assert await page.locator('.score-measure').count()==7
    assert await page.locator('[data-clef=treble]').count()>=2
    assert await page.locator('[data-clef=bass]').count()>=2
    assert await page.locator('.score-document [data-duration="4"][fill="none"]').count()>0
    assert await page.locator('.score-document [data-duration="2"][fill="none"]').count()>0
    assert await page.locator('.score-document [fill="#f2ecdf"]').count()==0
    assert not await page.locator('.lesson-theory').evaluate('(e)=>e.open')
    assert not await page.locator('.exercise-notes').first.evaluate('(e)=>e.open')
    await page.locator('.lesson-theory > summary').click()
    await expect(page.locator('.lesson-theory .theory-body')).to_be_visible()
    await page.locator('.exercise-notes > summary').first.click()
    await expect(page.locator('.exercise-notes .theory-body').first).to_be_visible()
    assert await page.locator('a[href^="javascript:"]').count()==0
    assert not await page.get_by_text('must-not-render').count()
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    await page.screenshot(path=str(OUT/f'theory-{engine.name}-{width}.png'),full_page=True)
    await page.locator('.lesson-theory > summary').click()
    await page.locator('.exercise-notes > summary').first.click()
    await page.locator('.exercise').first.screenshot(path=str(OUT/f'engraving-{engine.name}-{width}.png'))
    await page.locator('[data-shift="1"]').first.click()
    assert await page.locator('[data-key]').first.input_value()=='Db'
    await page.select_option('#pattern','arpeggio')
    await page.locator('[data-play]').first.click()
    await page.locator('#player:not([hidden])').wait_for()
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    await page.locator('#close-player').click()
    assert not errors,(engine.name,width,errors)
    await context.close()
    print(f'PASS {engine.name} {width}: clefs, transparent heads, collapsed theory, source safety, transpose, arpeggio, playback',flush=True)
   await browser.close()
try:asyncio.run(main())
finally:server.shutdown()
