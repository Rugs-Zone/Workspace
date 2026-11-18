# -*- coding: utf-8 -*-
# 17 Nov 2026 - a mail you only SENT must never come back as work asking to be "marked done".
#
# Reported by Vinay: he forwarded a mail to merchandiser1@ from Rugs Email and it turned up
# again as a fresh item with a Done button.
#
# WHY IT HAPPENED: the server does not thread a forward (send() skips In-Reply-To / References
# when p.forward), so Gmail starts a NEW conversation. The sync saves that conversation with
# the default folder 'inbox', the trail rule gives it an owner (the person who sent it), and the
# app's own send sets status 'open'. The Inbox LIST already hides it (it needs a received
# message - hasRecv), but the work lists did not:
#   * pageDash's `open` used `(!!t.owner || isWork(t))`, so any owned thread skipped the
#     hasRecv test that isWork does - it counted on Home and in "My work"
#   * the My work view and its folder-pane count only looked at owner + not-done
#   * the per-person open count on the People page did the same
#   * the open mail offered a Done button
#
# FIX: hasRecv(t) now gates owner-based work everywhere, and a conversation with nothing
# received shows no Done / Reopen button - it is simply something you sent.
#
# Edits .tmp/email.html, then re-encodes it into index.html's EMAIL_HTML_B64.
import base64, io, re

APP = '.tmp/email.html'
P = 'index.html'
h = io.open(APP, encoding='utf-8', newline='').read()
n = 0

def rep(a, b):
    global h, n
    assert h.count(a) == 1, ('expected 1 copy, found %d' % h.count(a), a[:90])
    h = h.replace(a, b)
    n += 1

assert "hasRecv(t)&&(!!t.owner" not in h, 'already patched - aborting'

# 1) My work list
rep("""  if(view.id==='mine')return t.owner===ME&&st(t)!=='done';""",
    """  if(view.id==='mine')return t.owner===ME&&st(t)!=='done'&&hasRecv(t);   /* 17 Nov: what you only sent is not work */""")

# 2) My work count in the folder pane
rep("""['mine','My work',ico('user'),cnt(t=>t.owner===ME&&st(t)!=='done')]""",
    """['mine','My work',ico('user'),cnt(t=>t.owner===ME&&st(t)!=='done'&&hasRecv(t))]""")

# 3) Home / dashboard: an owner no longer excuses a conversation from the hasRecv test
rep("""const open=S.threads.filter(t=>inS(t)&&st(t)!=='done'&&t.folder==='inbox'&&(!!t.owner||isWork(t)))""",
    """const open=S.threads.filter(t=>inS(t)&&st(t)!=='done'&&t.folder==='inbox'&&hasRecv(t)&&(!!t.owner||isWork(t)))""")

# 4) the People page's open count per person
rep("""const open=cnt(t=>t.owner===p.id&&st(t)!=='done')""",
    """const open=cnt(t=>t.owner===p.id&&st(t)!=='done'&&hasRecv(t))""")

# 5) no Done / Reopen on a conversation that only holds mail we sent
rep("""${ro?'':s==='done'?`<button class="btn" data-reopen="${t.id}">Reopen</button>`:`<button class="btn ok" data-done="${t.id}">${ico('check')} Done</button>`}""",
    """${ro||!hasRecv(t)?'':s==='done'?`<button class="btn" data-reopen="${t.id}">Reopen</button>`:`<button class="btn ok" data-done="${t.id}">${ico('check')} Done</button>`}""")

io.open(APP, 'w', encoding='utf-8', newline='').write(h)

src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched %d places in .tmp/email.html and re-encoded into index.html' % n)
