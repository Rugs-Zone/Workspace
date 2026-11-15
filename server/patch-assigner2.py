# follow-up: the "every Home number opens its mails" mapper should also know the new tile names
import base64, re

P = 'index.html'
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
b64 = m.group(1)
raw = base64.b64decode(b64)
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
html = raw.decode('utf-8')

a = """const pick=l=>/^Waiting for CRM|^To delegate|^Needs owner/.test(l)?'fav:needs'"""
b = """const pick=l=>/^Waiting for CRM|^Not assigned|^To assign|^To delegate|^Needs owner/.test(l)?'fav:needs'"""
assert html.count(a) == 1
html = html.replace(a, b)

out = base64.b64encode(html.encode('utf-8')).decode()
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('ok')
