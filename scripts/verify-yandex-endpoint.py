"""Check only unauthenticated rejection. No real provider token, user, or email request."""
import json
import urllib.error
import urllib.request
from pathlib import Path
config=json.loads(Path('site/config.json').read_text())
url=config['supabaseUrl'].rstrip('/')+'/functions/v1/yandex-userinfo'
for method,status,code in [('GET',401,'invalid_token'),('POST',405,'method_not_allowed')]:
    try:
        urllib.request.urlopen(urllib.request.Request(url,method=method),timeout=20)
        raise AssertionError('Unauthenticated identity endpoint must reject access')
    except urllib.error.HTTPError as error:
        assert error.code==status,(method,error.code)
        data=json.loads(error.read())
        assert data=={'error':code},(method,data)
        assert 'no-store' in error.headers.get('Cache-Control','')
print('PASS live Yandex adapter: unauthenticated GET rejected, unsupported method rejected, no cached identity response')
