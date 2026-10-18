"""Real SVG engraving, synthetic music only. No private lesson content or live Auth calls."""
import asyncio,functools,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'dist';OUT=ROOT/'ui-results';OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}/'
async def scenario(engine,w,h):
 browser=await engine.launch();page=await browser.new_page(viewport={'width':w,'height':h});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 await page.route(BASE+'__engraving__',lambda r:r.fulfill(content_type='text/html',body='<html><head><link rel="stylesheet" href="./score.css"><link rel="stylesheet" href="./light.css"></head><body><div id="score" class="score"></div></body></html>'))
 await page.route('https://*.supabase.co/**',lambda r:r.abort())
 await page.goto(BASE+'__engraving__')
 await page.evaluate('''async()=>{const v=(await (await fetch('./version.json')).json()).version;window.mods={};for(const n of ['music','bass','notation','chord-model'])mods[n]=await import('./'+n+'.js?v='+v);}''')
 result=await page.evaluate('''()=>{
 const root=document.querySelector('#score');let checked=0;
 function check(score,opts){
  const before=JSON.stringify(score);mods.notation.renderScore(root,score,opts);
  const svg=root.querySelector('svg'),v=svg.viewBox.baseVal,inv=svg.getScreenCTM().inverse();
  if(svg.dataset.renderer!=='vexflow-bravura')throw Error('Wrong renderer');
  if(svg.querySelectorAll('ellipse').length)throw Error('Geometric noteheads returned');
  if(svg.querySelectorAll('[data-score-bar]').length!==score.bars.length)throw Error('Lost measure');
  for(const hand of ['right',...(opts.showBass?['left']:[])]){
   const expected=score.bars.flatMap(b=>hand==='right'?b.rh.flatMap(e=>e.notes.map(n=>n.midi)):b.left.notes.map(n=>n.midi));
   const actual=[...svg.querySelectorAll('[data-hand='+hand+'] [data-note]')].map(n=>+n.dataset.midi);
   if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Changed '+hand+' pitches');
  }
  for(const n of svg.querySelectorAll('[data-note],.vf-accidental,.vf-clef')){
   const b=n.getBoundingClientRect(),a=new DOMPoint(b.left,b.top).matrixTransform(inv),z=new DOMPoint(b.right,b.bottom).matrixTransform(inv);
   if(a.x < -1 || a.y < -1 || z.x>v.width+1 || z.y>v.height+1)throw Error('Clipped notation');
  }
  for(const n of svg.querySelectorAll('[data-hollow=true]')){
   if(n.tagName!=='path'||(n.getAttribute('d').match(/M/g)||[]).length<2)throw Error('Hollow note is not an engraved compound path');
  }
  if(opts.showBass)for(const bar of svg.querySelectorAll('[data-score-bar]')){
   const r=+bar.querySelector('[data-hand=right] [data-note]').dataset.onsetX;
   const l=+bar.querySelector('[data-hand=left] [data-note]').dataset.onsetX;
   if(Math.abs(l-r)>.01)throw Error('Musical onsets not aligned');
  }
  if(before!==JSON.stringify(score))throw Error('Rendering changed audio data');checked++;
 }
 for(const mode of ['major','minor'])for(const tonic of mods.music.KEYS[mode])for(const pattern of ['chords','arpeggio'])for(const showBass of [false,true]){
  check(mods.music.compile(mode==='major'?['I','IVmaj7','iiø7','V7','I']:['i','iiø7','vii°7','V7','i'],{tonic,mode,pattern}),{showBass});
 }
 for(const tonic of mods['chord-model'].ROOTS)for(const t of mods['chord-model'].TYPES)for(let i=0;i<t.semi.length;i++){
  check(mods['chord-model'].example(t.id,tonic,i).score,{showLabels:false,showMeter:false,scale:1});
 }
 for(const offset of [9,3])check(mods.music.compile(['I','vii°7',{symbol:offset===9?'vii°65':'vii°42',offset,mode:'minor'},{symbol:'i',offset,mode:'minor'}],{tonic:'C'}),{showBass:true});
 check(mods.music.compile([{symbol:'I',beats:2},{symbol:'V7',beats:2}],{tonic:'Eb'}),{showBass:true});
 return checked;}''')
 for name,pattern in [('chords','chords'),('arpeggio','arpeggio')]:
  await page.evaluate('''pattern=>{const score=mods.music.compile(['I','IVmaj7','iiø7','V7','I'],{tonic:'Db',pattern});mods.notation.renderScore(document.querySelector('#score'),score,{showBass:true});}''',pattern)
  await page.locator('#score').screenshot(path=str(OUT/f'bravura-{name}-{engine.name}-{w}x{h}.png'))
 await page.evaluate("mods.notation.renderScore(document.querySelector('#score'),mods['chord-model'].example('diminished7','C',3).score,{showLabels:false,showMeter:false,scale:1})")
 await page.locator('#score').screenshot(path=str(OUT/f'bravura-inversion-{engine.name}-{w}x{h}.png'))
 assert not errors,errors
 print(f'PASS engraved SVG {engine.name} {w}x{h}: {result} cases; glyph outlines, pitches, double accidentals, hollow heads, bass alignment, reflow',flush=True)
 await browser.close()
async def main():
 try:
  async with async_playwright() as p:
   for engine,w,h in [(p.chromium,1440,960),(p.chromium,320,812),(p.webkit,375,812),(p.webkit,932,430)]:await scenario(engine,w,h)
 finally:server.shutdown()
asyncio.run(main())
