"""Non-mutating diagnostics on synthetic data; the release smoke test remains authoritative."""
import asyncio,functools,json,threading
from http.server import ThreadingHTTPServer
from playwright.async_api import async_playwright
from modes_smoke import ROOT,OUT,USER,FIXTURE,Quiet
async def main(base):
 async with async_playwright() as p:
  b=await p.webkit.launch();c=await b.new_context(viewport={'width':375,'height':812},has_touch=True)
  async def mock(route):
   path=route.request.url.split('?')[0]
   if path.endswith('/auth/v1/user'):data={'id':USER,'email':'test@example.invalid','email_confirmed_at':'2026-01-01'}
   elif path.endswith('/auth/v1/settings'):data={'external':{'google':True}}
   elif path.endswith('/rest/v1/members'):data=[{'user_id':USER,'is_owner':False,'active':True}]
   else:data=FIXTURE[path.rsplit('/',1)[-1]]
   await route.fulfill(json=data)
  await c.route('https://*.supabase.co/**',mock);page=await c.new_page()
  await page.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
  await page.goto(base+'#modes',wait_until='networkidle')
  for root in ['C#','Db','F#','Gb','G#','Ab','B','Bb','C']:await page.select_option('[data-modes-root]',root)
  await page.select_option('[data-modes-category]','symmetric')
  data=await page.evaluate('''async()=>{
   const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const width=()=>document.documentElement.scrollWidth;
   await settle();const out={initial:width(),viewport:innerWidth,internal:[],text:[],isolation:[],patches:[]};
   out.internal=[...document.querySelectorAll('body *')].flatMap(e=>e.scrollWidth>e.clientWidth+1?[{tag:e.tagName,id:e.id,class:e.getAttribute('class'),client:e.clientWidth,scroll:e.scrollWidth,display:getComputedStyle(e).display,overflow:getComputedStyle(e).overflow,box:e.getBoundingClientRect().toJSON()}]:[]).slice(0,40);
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let t;
   while(t=walker.nextNode()){if(!t.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(t);for(const v of r.getClientRects())if(v.width&&v.right>innerWidth+1)out.text.push({text:t.textContent.slice(0,130),parent:t.parentElement.tagName,class:t.parentElement.getAttribute('class'),rect:v.toJSON()});}
   for(const selector of ['.mode-controls','.mode-controls select','.mode-intro','.mode-category-heading','.mode-grid','.mode-formula','.mode-score','.mode-actions','.mode-details','#sidebar','#player','#toast']){
    const els=[...document.querySelectorAll(selector)],old=els.map(e=>e.style.display);
    els.forEach(e=>e.style.display='none');await settle();out.isolation.push({selector,width:width()});els.forEach((e,i)=>e.style.display=old[i]);await settle();
   }
   for(const [selector,property,value] of [['.mode-controls select','appearance','none'],['.mode-category-heading','overflow','hidden'],['.mode-formula','overflow','hidden'],['.mode-card','overflow','hidden'],['.mode-score','contain','layout paint'],['.mode-document','overflow','hidden'],['.mode-controls','contain','layout paint'],['[data-mode-results]','contain','inline-size']]){
    const els=[...document.querySelectorAll(selector)],old=els.map(e=>e.style.getPropertyValue(property));els.forEach(e=>e.style.setProperty(property,value));await settle();out.patches.push({selector,property,value,width:width()});els.forEach((e,i)=>e.style.setProperty(property,old[i]));await settle();
   }
   out.final=width();return out;
  }''')
  print('MODE_OVERFLOW_PROBE',json.dumps(data,ensure_ascii=False),flush=True)
  (OUT/'modes-overflow-probe.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
  await page.screenshot(path=str(OUT/'modes-overflow-probe.png'),full_page=True)
  await c.close();await b.close()
if __name__=='__main__':
 s=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')));threading.Thread(target=s.serve_forever,daemon=True).start()
 try:asyncio.run(main(f'http://127.0.0.1:{s.server_port}/'))
 finally:s.shutdown()
