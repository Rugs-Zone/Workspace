# 16 Nov 2026 — FIX: clicking Send did nothing at all (no mail, no error, no toast, the compose
# window just stayed open).
#
# compose() wires the Send button like this:
#     send.onclick=()=>{opts({});origSend();if(L.innerHTML)NEXT_OPTS=null};
# and opts() ended with:
#     if(slot!=null&&o.draft==null)o.draft=slot
# "slot" was a leftover from the old draft handling: the 14 Nov change gave drafts a fixed id
# (draftId / o.did / DRAFT_GONE) and deleted the variable, but not this line. Reading an
# undeclared variable throws ReferenceError, so opts({}) threw on EVERY click and origSend() —
# the code that actually sends — was never reached. Nothing was logged because the throw happened
# inside the click handler before any of the app's own error handling.
import base64, re

P = 'index.html'
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
b64 = m.group(1)
raw = base64.b64decode(b64)
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
html = raw.decode('utf-8')

a = """;clearInterval(iv);
  if(slot!=null&&o.draft==null)o.draft=slot};"""
b = """;clearInterval(iv)};
 /* 16 Nov 2026 FIX: this used to end with "if (slot != null && o.draft == null) o.draft = slot".
    "slot" stopped existing on 14 Nov (drafts moved to a fixed id: draftId / o.did / DRAFT_GONE),
    so reading it threw ReferenceError and killed every Send / Reply / Forward click before
    origSend() could run - the mail never left and nothing was shown on screen. */"""
assert html.count(a) == 1, html.count(a)
html = html.replace(a, b)
assert 'o.draft=slot};' not in html and 'if(slot!=null' not in html

out = base64.b64encode(html.encode('utf-8')).decode()
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched; dead "slot" reference removed')
