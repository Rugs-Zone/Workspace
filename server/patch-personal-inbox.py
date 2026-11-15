# 16 Nov 2026 — Rugs Email: a mail with an owner becomes that person's mail.
# Unowned team mail stays visible to the whole team (anyone can take it); once it has an owner the
# other team members stop seeing it, while the team's manager, the CRM and the admin still see everything.
# Added as the LAST layer, because inView() is wrapped several times (All inboxes, critical, drill, Go live)
# and an earlier gate would be bypassed by those wrappers.
import base64, re

P = 'index.html'
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
b64 = m.group(1)
raw = base64.b64decode(b64)
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
html = raw.decode('utf-8')

anchor = """const _imO=isInboxMail;isInboxMail=function(t){return !beforeLive(t)&&_imO(t)};"""
assert html.count(anchor) == 1, html.count(anchor)

block = anchor + """

/* ================= 16 Nov 2026: a mail with an owner is that person's mail =================
   Mail nobody has taken is shown to the WHOLE team, so anyone can pick it up ("Needs owner").
   The moment it has an owner — someone replied, took it, or a rule gave it to them — it becomes
   their mail: the other members of the team stop seeing it in their lists and counts, while the
   team's manager, the CRM and the admin keep seeing everything in the team.
   A conversation you replied in stays visible to you even after it is handed to someone else, so
   work you have already done never disappears from your side.
   Handing over (Assign to…) needs no copying: it is the same conversation, so the new owner opens
   it with every earlier mail and the whole trail, and it lands in their "My work".
   NOTE this hides mail from a colleague's screen; it is not a lock. The server still sends the
   team's mail to the team's own people, and Search follows the same rule. */
function seeMine(t){const p=who(ME);
 if(!p||!t)return true;
 if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;   /* manager / CRM / admin: the whole team */
 if(!t.owner)return true;                                                      /* nobody has taken it yet */
 if(t.owner===ME)return true;                                                  /* mine */
 return (t.msgs||[]).some(m=>m.by===ME)}                                        /* I replied in it — keep it */
const _ivMine=inView;inView=function(t){return seeMine(t)&&_ivMine(t)};
const _imMine=isInboxMail;isInboxMail=function(t){return seeMine(t)&&_imMine(t)};
const _lrMine=listRows;listRows=function(){return _lrMine().filter(seeMine)};   /* also covers Search */"""

html = html.replace(anchor, block)
out = base64.b64encode(html.encode('utf-8')).decode()
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched; app chars', len(raw.decode('utf-8')), '->', len(html))
