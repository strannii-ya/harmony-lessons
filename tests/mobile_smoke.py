"""Browser UI tests use only synthetic fixtures. No owner credentials or private lesson content."""
import asyncio,json,os,subprocess,time
from pathlib import Path
from playwright.async_api import async_playwright
USER='11111111-1111-4111-8111-111111111111'
FIXTURE={
 'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Тестовый раздел','title':'Проверка длинного заголовка на мобильном телефоне','goal':'Учебный пример для проверки интерфейса.','preparation':['Тестовая подготовка.'],'topics':['Проверка меню, нот и кнопок.']}],
 'exercises':[{'id':'test-e01','lesson_id':1,'position':1,'title':'Проверка нот и транспонирования','goal':'Проверка отображения интерфейса.','discuss':'Только синтетические данные теста.','mode':'major','loop':False,'progression':['I','ii7','V7','I']}],
 'progress':[], 'favorites':[]}
async def main():
 Path('ui-results').mkdir(exist_ok=True)
 server=subprocess.Popen(['python','-m','http.server','8765','--directory','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  async with async_playwright() as p:
   for engine,widths in [('chromium',[320,375,390,768,1440]),('webkit',[390])]:
    browser=await getattr(p,engine).launch()
    for width in widths:
     context=await browser.new_context(viewport={'width':width,'height':844},device_scale_factor=1,has_touch=width<900)
     async def mock(route):
      url=route.request.url
      if '/auth/v1/user' in url:data={'id':USER,'email':'ui-test@example.invalid','email_confirmed_at':'2026-01-01T00:00:00Z'}
      elif '/rest/v1/members' in url:data=[{'user_id':USER}]
      else:
       name=url.split('/rest/v1/')[-1].split('?')[0]
       if name not in FIXTURE:raise AssertionError('Unexpected request: '+url)
       data=FIXTURE[name]
      await route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
     await context.route('https://*.supabase.co/**',mock)
     page=await context.new_page();errors=[]
     page.on('pageerror',lambda e:errors.append(str(e)))
     await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'test-only',refresh_token:'test-only',expires_at:4102444800}));")
     await page.goto('http://127.0.0.1:8765/',wait_until='networkidle')
     await page.locator('.course-card').first.click()
     await page.locator('.score-measure').first.wait_for()
     async def no_overflow(stage):
      dimensions=await page.evaluate('({w:innerWidth,s:document.documentElement.scrollWidth})')
      assert dimensions['s']<=dimensions['w']+1,(engine,width,stage,dimensions)
      for selector in ['.exercise-actions','.score','#player:not([hidden])']:
       for element in await page.locator(selector).all():
        box=await element.bounding_box()
        if box:assert box['x']>=-1 and box['x']+box['width']<=width+1,(width,stage,selector,box)
     await no_overflow('lesson')
     await page.select_option('#pattern','arpeggio')
     await page.locator('[data-shift="1"]').first.click()
     assert await page.locator('[data-key]').first.input_value()=='Db'
     await no_overflow('arpeggio')
     await page.get_by_role('button',name='Крупные ноты',exact=True).first.click()
     await no_overflow('zoomed')
     await page.get_by_role('button',name='Ноты по ширине',exact=True).first.click()
     await page.locator('[data-play]').first.click()
     await page.locator('#player').wait_for(state='visible')
     await no_overflow('player')
     await page.locator('#hand').select_option('left')
     await page.screenshot(path=f'ui-results/{engine}-{width}-lesson.png',full_page=True)
     if width<=900:
      await page.locator('#menu').click()
      assert await page.locator('#menu').get_attribute('aria-expanded')=='true'
      assert await page.locator('#sidebar').get_attribute('aria-modal')=='true'
      await page.locator('.nav-close').click()
      assert await page.locator('#menu').get_attribute('aria-expanded')=='false'
     await page.locator('#close-player').click()
     await page.locator('#focus').click()
     await no_overflow('focus')
     await page.locator('#focus').click()
     assert not errors,(engine,width,errors)
     print(f'PASS {engine} {width}px: notation, arpeggio, transpose, zoom, player, navigation, focus',flush=True)
     await context.close()
    await browser.close()
 finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
