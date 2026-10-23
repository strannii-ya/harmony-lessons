"""Synthetic exercise data only: multievent bass on two staves across touch and desktop widths."""
import asyncio, functools, threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT/'site'
OUT=ROOT/'ui-results'; OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
USER='11111111-1111-4111-8111-111111111111'
def n(degree,duration=1,**kw):return {'degree':degree,'duration':duration,**kw}
def r(duration):return {'rest':True,'duration':duration}
def ex(id,progression,bass_line):
 return {'id':id,'lesson_id':24,'position':1051 if id.endswith('1') else 1052,
  'title':id,'goal':'Сравнить басовые линии','discuss':'Проверить звуки',
  'mode':'major','loop':False,'progression':progression,
  'theory':{'notation':{'show_bass':True,'bass_line':bass_line},'sections':[]}}
FIXTURE={'lessons':[
 {'id':10,'position':10,'chapter':3,'chapter_title':'Каденции','title':'Предыдущий урок','goal':'','preparation':[],'topics':[]},
 {'id':24,'position':11,'chapter':4,'chapter_title':'Басовые линии','title':'Басовая линия','goal':'','preparation':[],'topics':[]},
 {'id':11,'position':12,'chapter':4,'chapter_title':'Басовые линии','title':'Следующий урок','goal':'','preparation':[],'topics':[]}
 ], 'exercises':[
 ex('bassline1',['I','IV','V','I'],[[n('1',2),n('3'),n('5')],[n('4'),n('6'),n('1'),n('#4')],[n('5',1.5),r(.5),n('7'),n('2')],[n('1'),r(.5),n('5',.5),n('1',2)]]),
 ex('bassline2',['I','V6','vi','I64'],[[n('1',4,semitones=12)],[n('7',4,semitones=11)],[n('6',4,semitones=9)],[n('5',4,semitones=7)]])
 ], 'progress':[],'favorites':[]}
async def scenario(engine,w,h):
 browser=await engine.launch()
 ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<=1024)
 async def mock(route):
  u=route.request.url
  if '/auth/v1/user' in u: data={'id':USER,'email':'synthetic@example.invalid','email_confirmed_at':'2026-01-01'}
  elif '/auth/v1/settings' in u: data={'external':{'google':True}}
  elif '/rest/v1/members' in u: data=[{'user_id':USER,'is_owner':False,'active':True}]
  else:
   name=urlparse(u).path.split('/')[-1]
   assert name in FIXTURE,u
   data=FIXTURE[name]
  await route.fulfill(json=data)
 await ctx.route('https://*.supabase.co/**',mock)
 await ctx.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
 page=await ctx.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 await page.goto(BASE+'#lesson-24',wait_until='networkidle')
 await expect(page.locator('.exercise')).to_have_count(2)
 first=page.locator('[data-eid=bassline1]')
 second=page.locator('[data-eid=bassline2]')
 await expect(page.locator('.score-error')).to_have_count(0)
 assert await first.locator('[data-clef=bass]').count()>0
 assert await first.locator('[data-hand=left] [data-midi]').count()==13
 assert await first.locator('[data-hand=left] [data-duration="1.5"]').count()==1
 initial=await second.locator('[data-hand=left] [data-midi]').evaluate_all('(nodes)=>nodes.map(n=>+n.dataset.midi)')
 assert initial==[48,47,45,43],initial
 async def fits():
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert await page.locator('.score-error').count()==0,errors
 await fits()
 await first.screenshot(path=str(OUT/f'bass-line-{engine.name}-{w}x{h}.png'))
 await page.evaluate('''async()=>{const v=(await(await fetch('./version.json')).json()).version;
   const {Player}=await import('./audio.js?v='+v);
   const old=Player.prototype.play;window.calls=[];
   Player.prototype.play=function(s,o){window.calls.push({events:s.events.map(e=>({hand:e.hand,beat:e.beat,notes:e.notes.map(n=>n.midi)})),tempo:o.bpm});return old.call(this,s,o);}
 }''')
 await first.locator('[data-play]').click()
 await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','true')
 record=await page.evaluate('calls.at(-1)')
 assert record['tempo']==90
 left=[e for e in record['events'] if e['hand']=='left']
 assert len(left)==15
 assert [e['beat'] for e in left if not e['notes']]==[9.5,13]
 await second.locator('[data-play]').click()
 await expect(first.locator('[data-play]')).to_have_attribute('aria-pressed','false')
 await second.locator('[data-play]').click()
 await first.locator('[data-shift="1"]').click()
 await expect(first.locator('[data-key]')).to_have_attribute('data-tonic','Db')
 assert await first.locator('[data-hand=left] [data-midi]').count()==13
 await page.select_option('#pattern','arpeggio')
 await fits()
 await first.screenshot(path=str(OUT/f'bass-line-arpeggio-{engine.name}-{w}x{h}.png'))
 assert not errors,errors
 await ctx.close();await browser.close()
async def main():
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,320,812),(p.chromium,1440,960),(p.webkit,375,812)]:
    await scenario(engine,w,h)
  print('Verified independent bass notes, rests, engraving, playback and key shifts')
 finally:server.shutdown()
if __name__=='__main__':asyncio.run(main())
