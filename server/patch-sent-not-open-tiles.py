# -*- coding: utf-8 -*-
# 17 Nov 2026 (follow-up to Vinay's report) - "Still open with me" also counted mail you only
# sent. The earlier fix covered My work, the dashboard numbers, the People page and the Done
# button; these three were missed:
#   * the daily report's own count          (tile "Still open with me" + the report text)
#   * the clickable version of those tiles  (the one that opens the mails behind the number)
#   * the "Open in team" mapper             (what opens when a Home number is clicked - it has
#                                            to match the dashboard list, which is already fixed)
#
# Swept every owner-based "not done" count in the module; everything else either already tests
# hasRecv / isWork, or is not a work count (the "Mine" chip in a folder list, reminders you set
# yourself, promises kept, the hand-over notice).
#
# Edits .tmp/email.html, then re-encodes it into index.html's EMAIL_HTML_B64.
import base64, io, re

APP = '.tmp/email.html'
P = 'index.html'
h = io.open(APP, encoding='utf-8', newline='').read()
n = 0

def rep(a, b, count=1):
    global h, n
    assert h.count(a) == count, ('expected %d copies, found %d' % (count, h.count(a)), a[:90])
    h = h.replace(a, b)
    n += h.count(b) and count

# the daily report (count only) and the clickable tiles (the list) - same expression, 2 copies
rep("""const open=S.threads.filter(t=>t.owner===uid&&st(t)!=='done'&&t.folder==='inbox')""",
    """const open=S.threads.filter(t=>t.owner===uid&&st(t)!=='done'&&t.folder==='inbox'&&hasRecv(t))""",
    count=2)

# clicking a Home number must open exactly what the dashboard counted
rep("""'Open in team':()=>S.threads.filter(t=>inS(t)&&st(t)!=='done'&&t.folder==='inbox'&&(!!t.owner||isWork(t))),""",
    """'Open in team':()=>S.threads.filter(t=>inS(t)&&st(t)!=='done'&&t.folder==='inbox'&&hasRecv(t)&&(!!t.owner||isWork(t))),""")

io.open(APP, 'w', encoding='utf-8', newline='').write(h)

src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched the 2 "Still open with me" counts and the "Open in team" mapper')
