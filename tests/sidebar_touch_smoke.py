"""Synthetic data only: light touch targets, persistent selection and a darker sidebar."""
import asyncio, functools, json, re, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright, expect
from controls_smoke import FIXTURE, USER
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'ui-results'
OUT.mkdir(exist_ok=True)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

def luminance(rgb):
    values = [float(x) / 255 for x in re.findall(r'[\d.]+', rgb)[:3]]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values]
    return sum(v * weight for v, weight in zip(linear, [.2126, .7152, .0722]))

def contrast(a, b):
    x, y = sorted([luminance(a), luminance(b)])
    return (y + .05) / (x + .05)

async def scenario(engine, width, height, touch, base):
    browser = await engine.launch()
    context = await browser.new_context(viewport={'width': width, 'height': height}, has_touch=touch)
    async def mock(route):
        assert route.request.method == 'GET', 'Sidebar navigation must not write data'
        path = route.request.url.split('?')[0]
        if path.endswith('/auth/v1/user'):
            data = {'id': USER, 'email': 'sidebar@example.invalid', 'email_confirmed_at': '2026-01-01'}
        elif path.endswith('/rest/v1/members'):
            data = [{'user_id': USER, 'is_owner': True, 'active': True}]
        elif path.endswith('/auth/v1/settings'):
            data = {'external': {'google': True}}
        else:
            name = path.rsplit('/', 1)[-1]
            assert name in FIXTURE, path
            data = FIXTURE[name]
        await route.fulfill(json=data)
    await context.route('https://*.supabase.co/**', mock)
    await context.add_init_script("sessionStorage.setItem('harmony.session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:4102444800}));")
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    async def press(locator):
        if touch: await locator.tap()
        else: await locator.click()
    async def open_menu():
        if await page.locator('#landscape-menu').is_visible():
            await press(page.locator('#landscape-menu'))
        elif await page.locator('#menu').is_visible():
            await press(page.locator('#menu'))
        await expect(page.locator('#sidebar')).to_have_attribute('aria-hidden', 'false')
    async def inspect():
        return await page.locator('#sidebar').evaluate('''s => {
          const css=n=>getComputedStyle(n), b=css(s);
          return {background:b.backgroundColor, footer:css(s.querySelector('.sidebar-bottom')).backgroundColor,
            muted:css(s.querySelector('.sidebar-label')).color,
            targets:[...s.querySelectorAll('.primary-nav button:not([hidden]),.lesson-link')].map(n=>{
              const c=css(n),m=getComputedStyle(n,'::before'),r=n.getBoundingClientRect();
              return {text:n.textContent,bg:c.backgroundColor,color:c.color,active:n.classList.contains('active'),
                weight:c.fontWeight,marker:m.opacity,markerWidth:m.width,markerColor:m.backgroundColor,
                width:r.width,height:r.height};
            })};
        }''')
    try:
        await page.goto(base + '#lesson-1', wait_until='networkidle')
        await expect(page.locator('.exercise')).to_have_count(4)
        if touch: assert await page.evaluate('matchMedia("(hover: none)").matches')
        await open_menu()
        result = await inspect()
        assert result['footer'] == result['background']
        assert contrast(result['muted'], result['background']) >= 4.5, result
        for target in result['targets']:
            assert target['width'] >= 44 and target['height'] >= 44, target
            assert luminance(target['bg']) > luminance(result['background']) + .12, target
            assert contrast(target['color'], target['bg']) >= 4.5, target
            assert target['marker'] == ('1' if target['active'] else '0'), target
            if target['active']:
                assert target['weight'] == '600' and target['markerWidth'] == '3px', target
                assert contrast(target['markerColor'], target['bg']) >= 3, target
        assert sum(t['active'] for t in result['targets']) == 2
        await page.screenshot(path=str(OUT / f'sidebar-touch-{engine.name}-{width}x{height}.png'))
        await press(page.locator('.primary-nav [data-view=modes]'))
        await expect(page.locator('.mode-card')).to_have_count(44)
        await open_menu()
        selected = page.locator('.primary-nav [data-view=modes]')
        await expect(selected).to_have_class(re.compile(r'active'))
        assert await page.locator('.lesson-link.active').count() == 0
        # Wait for the existing button transition, not an intermediate animation frame.
        await expect(selected).to_have_css('background-color', 'rgb(255, 253, 248)')
        await selected.hover()
        await expect(selected).to_have_css('background-color', 'rgb(255, 253, 248)')
        # A touch browser must not apply desktop hover styling to unselected buttons either.
        if touch:
            other = page.locator('.primary-nav [data-view=library]')
            await expect(other).to_have_css('background-color', 'rgb(250, 247, 241)')
            await other.hover()
            await expect(other).to_have_css('background-color', 'rgb(250, 247, 241)')
        await page.keyboard.press('Tab')
        await selected.focus()
        assert await selected.evaluate('n=>getComputedStyle(n).outlineStyle') == 'solid'
        assert await page.locator('.sidebar-bottom').evaluate('n=>n.getBoundingClientRect().height') <= 50
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        if await page.locator('.nav-close').is_visible():
            await press(page.locator('.nav-close'))
            await expect(page.locator('#sidebar')).to_have_attribute('aria-hidden', 'true')
            await open_menu()
            await expect(selected).to_have_class(re.compile(r'active'))
            await page.keyboard.press('Escape')
            await expect(page.locator('#sidebar')).to_have_attribute('aria-hidden', 'true')
        assert not errors, errors
        (OUT / f'sidebar-touch-{engine.name}-{width}x{height}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(f'PASS sidebar {engine.name} {width}x{height}: dark warm panel, light targets, contrast, persistent selection, touch and keyboard, compact footer', flush=True)
    finally:
        await context.close()
        await browser.close()

async def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as p:
            for engine,w,h,touch in [(p.chromium,1440,960,False),(p.chromium,320,812,True),(p.webkit,375,812,True),(p.webkit,768,1024,True),(p.webkit,1024,768,True),(p.webkit,932,430,True)]:
                await scenario(engine,w,h,touch,f'http://127.0.0.1:{server.server_port}/')
    finally: server.shutdown()

if __name__ == '__main__': asyncio.run(main())
