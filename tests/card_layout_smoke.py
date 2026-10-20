from inline_helpers import choose_key, stop_card
"""Synthetic course only. Card anatomy, four-bar phone phrases, sidebar and preserved controls."""
import asyncio,functools,threading,json
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
USER='11111111-1111-4111-8111-111111111111'
EXAMPLES=[
 {'id':'card-major','title':'Тоника, субдоминанта и доминанта','mode':'major','progression':['I','IV','V7','I','vi','ii7','V7','I']},
 {'id':'card-minor','title':'Минорный оборот и разрешение доминанты','mode':'minor','progression':['i','iv','V7','i']},
 {'id':'card-modulation','title':'Отклонение в параллельную тональность','mode':'major','progression':['I','V7/vi',{'symbol':'i','mode':'minor','offset':9},{'symbol':'V7','mode':'minor','offset':9},{'symbol':'i','mode':'minor','offset':9}]},
 {'id':'card-pedal','title':'Созвучия над органным пунктом','mode':'major','progression':[{'symbol':s,'bass':'5'} for s in ['I','IV','V7','I']]},
 {'id':'card-jazz','title':'Нонаккорды в джазовом обороте','mode':'major','genre':'jazz','progression':['ii9','V9','Imaj9','Imaj9']}
]
for i,e in enumerate(EXAMPLES):e.update(position=i+1,lesson_id=None if e.get('genre') else 1,library_section='genres' if e.get('genre') else 'course',goal='Сравни движение голосов.',discuss='Послушай разрешение.',loop=False,theory={'sections':[{'title':'Гармонический оборот','paragraphs':['Сыграй в разных тональностях, сохраняя движение голосов.']}],'notation':{'show_bass':e['id']=='card-pedal'}})
FIXTURE={'lessons':[{'id':1,'position':1,'chapter':1,'chapter_title':'Функциональная гармония','title':'Связь главных трезвучий','goal':'Сравнить функции.','preparation':['Повторить главные трезвучия.'],'topics':['Сопоставить расположения правой руки.'],'theory':{'sections':[{'title':'Гармонические функции','paragraphs':['Послушай тяготение доминанты к тонике.']}]}}], 'exercises':EXAMPLES,'progress':[],'favorites':[]}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def scenario(engine,w,h,base):
 browser=await engine.launch();ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<1025)
 saved=[]
 async def mock(route):
  path=route.request.url.split('?')[0]
  if path.endswith('/auth/v1/user'):data={'id':USER,'email':'test@example.invalid','email_confirmed_at':'2026-01-01'}
  elif path.endswith('/auth/v1/settings'):data={'external':{'google':True}}
  elif path.endswith('/auth/v1/logout'):data={}
  elif path.endswith('/rest/v1/members'):data=[{'user_id':USER,'active':True,'is_owner':False}]
  else:
   name=path.rsplit('/',1)[-1];assert name in FIXTURE,path
   if route.request.method=='POST':assert name=='favorites';saved.append(route.request.post_data_json)
   if route.request.method=='DELETE':saved.clear()
   data=saved if name=='favorites' else FIXTURE[name]
  await route.fulfill(json=data)
 await ctx.route('https://*.supabase.co/**',mock)
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 async def nav(view):
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif page.viewport_size['width']<=900:await page.locator('#menu').click()
  await page.locator(f'.primary-nav [data-view={view}]').click()
 async def fits():
  await page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  bad=await page.evaluate('''()=>{
   const bad=[];if(document.documentElement.scrollWidth>innerWidth+1)bad.push({overflow:document.documentElement.scrollWidth,width:innerWidth});
   for(const card of document.querySelectorAll('.exercise')){
    const star=card.querySelector('.favorite-control'),a=star.getBoundingClientRect(),c=card.getBoundingClientRect();
    if(a.top<c.top||a.right>c.right||c.right-a.right>20||a.top-c.top>20||a.width!==44||a.height!==44)bad.push({star:a.toJSON(),card:c.toJSON()});
    if(card.querySelectorAll('[data-star]').length!==1||!star.closest('.exercise-heading'))bad.push('favorite placement');
    if(getComputedStyle(card.querySelector('.card-footer')).backgroundColor===getComputedStyle(card).backgroundColor)bad.push('footer tone');
    for(const m of card.querySelectorAll('.score-measure')){
     const frame=m.querySelector('.beat-highlight').getBoundingClientRect(),labels=[...m.querySelectorAll('.score-degree,.score-chord,.score-key-caption')];
     for(const a of labels){const b=a.getBoundingClientRect();if(b.left<frame.left-1||b.right>frame.right+1)bad.push({label:a.textContent,box:b.toJSON(),frame:frame.toJSON()});
      for(const o of [...labels,...m.querySelectorAll('[data-hand=right] [data-note],.vf-accidental,.vf-stem')]){if(o===a)continue;const x=o.getBoundingClientRect();if(b.left<x.right-.5&&b.right>x.left+.5&&b.top<x.bottom-.5&&b.bottom>x.top+.5)bad.push({overlap:[a.textContent,o.textContent||o.getAttribute('class')]});}
     }
    }
   }
   for(const control of document.querySelectorAll('.exercise-actions button,.exercise-actions select'))if(Math.abs(control.getBoundingClientRect().height-44)>.5)bad.push('control height');
   for(const s of document.querySelectorAll('#content details>summary'))if(getComputedStyle(s).fontSize!=='14px')bad.push('summary size');
   return bad;
  }''')
  if bad:
   (OUT/f'cards-error-{engine.name}-{w}.json').write_text(json.dumps(bad,ensure_ascii=False,indent=2))
   await page.screenshot(path=str(OUT/f'cards-error-{engine.name}-{w}.png'),full_page=True)
  assert not bad,bad[:4]
  await expect(page.locator('.score-error')).to_have_count(0)
 try:
  await page.goto(base+'#lesson-1',wait_until='networkidle')
  await expect(page.locator('.exercise')).to_have_count(4)
  await expect(page.locator('#focus')).to_have_count(0)
  first=page.locator('[data-eid=card-major]')
  await fits();await first.screenshot(path=str(OUT/f'cards-lesson-{engine.name}-{w}x{h}.png'))
  await page.screenshot(path=str(OUT/f'cards-page-{engine.name}-{w}x{h}.png'))
  portrait=w<=600 and h>w
  for tonic in ['C','Db','F#','Bb','B']:
   await choose_key(first.locator('[data-key]'),tonic);await fits()
   if portrait:assert await first.locator('[data-system]').evaluate_all('ns=>ns.map(n=>n.querySelectorAll(".score-measure").length)')==[4,4]
  await choose_key(first.locator('[data-key]'),'C')
  await first.locator('[data-bass]').click();await first.locator('[data-voicing]').click();await fits()
  if portrait:assert await first.locator('[data-system]').evaluate_all('ns=>ns.map(n=>n.querySelectorAll(".score-measure").length)')==[4,4]
  await first.screenshot(path=str(OUT/f'cards-bass-{engine.name}-{w}x{h}.png'))
  await first.locator('[data-play]').click();await expect(page.locator('[data-play][aria-pressed="true"]')).to_have_count(1);await stop_card(page)
  await page.select_option('#pattern','arpeggio');await fits();assert await first.locator('.score-measure').count()==8
  await page.select_option('#pattern','chords')
  await first.locator('[data-star]').click();await expect(first.locator('[data-star]')).to_have_attribute('aria-pressed','true')
  await nav('favorites');await expect(page.locator('.exercise')).to_have_count(1);await fits()
  await nav('library');await expect(page.locator('.exercise')).to_have_count(5);await fits()
  await nav('modes');await expect(page.locator('.mode-footer')).to_have_count(44)
  await page.select_option('[data-modes-category]','diatonic');await page.locator('.mode-card').first.screenshot(path=str(OUT/f'cards-mode-{engine.name}-{w}x{h}.png'))
  await nav('reference');await expect(page.locator('.guide-footer')).to_have_count(44)
  await page.locator('.guide-card').first.screenshot(path=str(OUT/f'cards-guide-{engine.name}-{w}x{h}.png'))
  await nav('course');await expect(page.locator('.card-arrow')).to_have_count(0)
  if await page.locator('#landscape-menu').is_visible():await page.locator('#landscape-menu').click()
  elif w<=900:await page.locator('#menu').click()
  assert await page.locator('.primary-nav button').evaluate_all('bs=>bs.every(b=>![...b.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))')
  assert await page.locator('.primary-nav button').first.evaluate('b=>parseFloat(getComputedStyle(b).fontSize)')==15
  await expect(page.locator('#signout')).to_have_text('Выйти')
  await page.screenshot(path=str(OUT/f'cards-menu-{engine.name}-{w}x{h}.png'))
  await page.locator('#signout').click();await expect(page.locator('#gate')).to_be_visible();await expect(page.locator('#shell')).to_be_hidden()
  assert not errors,errors
  print(f'PASS cards {engine.name} {w}x{h}: favorite header, tinted footers, four-bar phone phrases, preserved controls, text sidebar, logout',flush=True)
 finally:await ctx.close();await browser.close()
async def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,320,812),(p.chromium,1440,960),(p.webkit,375,812),(p.webkit,390,844),(p.webkit,932,430)]:await scenario(engine,w,h,f'http://127.0.0.1:{server.server_port}/')
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
