# -*- coding: utf-8 -*-
# Embeds server/rugs-email-outlook-pack.js into index.html, at the very end of the
# mail app (EMAIL_HTML_B64), between the __olpack markers.
#
# Run it again after every change to the pack: the old block is replaced, never doubled.
# Nothing else in index.html is touched - only that one base64 line changes.
import base64, io, re, sys

P = 'index.html'
PACK = 'server/rugs-email-outlook-pack.js'
START = '<script>/* __olpack:start */'
END = '/* __olpack:end */</script>'

src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found in index.html'
b64 = m.group(1)
raw = base64.b64decode(b64)
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
h = raw.decode('utf-8')

pack = io.open(PACK, encoding='utf-8').read().rstrip()
assert '__olpack' in pack, 'the pack file has lost its marker'
assert '</script' not in pack.lower(), 'the pack must not contain a closing script tag'

block = START + '\n' + pack + '\n' + END

i, j = h.find(START), h.find(END)
if i >= 0 and j > i:
    old = h[i:j + len(END)]
    h = h.replace(old, block)
    what = 'replaced the existing pack'
else:
    assert '__olpack' not in h, 'index.html mentions __olpack but the markers are missing - check it by hand'
    h = h.rstrip() + '\n' + block + '\n'
    what = 'added the pack'

out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('%s (%d characters of JavaScript)' % (what, len(pack)))
