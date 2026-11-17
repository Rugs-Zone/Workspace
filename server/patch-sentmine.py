# -*- coding: utf-8 -*-
# 17 Nov 2026 - the Sent folder becomes personal, like the Inbox already is.
# A shared team mailbox has ONE Sent folder on Google's side, so every member saw every
# colleague's sent mail there. Now a member sees only the mail he sent himself; the team's
# manager, the CRM and the admin still see everything the mailbox sent.
import base64, re
P = 'index.html'
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
b64 = m.group(1); raw = base64.b64decode(b64)
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
h = raw.decode('utf-8'); n = 0
assert 'the Sent folder is personal too' not in h, 'already patched - aborting'

def rep(a, b):
    global h, n
    assert h.count(a) == 1, (h.count(a), a[:70])
    h = h.replace(a, b); n += 1

# 1) keep the real sender name on every message. A mail sent from Outlook AS the mailbox was
#    shown as "Team mailbox", so the person's own name was thrown away and could not be matched.
rep("by,ours:out,to:m.to_text,cc:m.cc_text",
    "by,ours:out,fname:m.from_name,to:m.to_text,cc:m.cc_text")

# 2) keep it in the on-device copy too
rep("by:m.by,ours:m.ours,body:",
    "by:m.by,ours:m.ours,fname:m.fname,body:")

# 3) "a conversation I worked in stays mine" now also covers mail I sent from Outlook
rep("return (t.msgs||[]).some(m=>m.by===ME)}",
    "return (t.msgs||[]).some(m=>msgMine(m,t))}")

# 4) a search for in:sent follows the same rule
rep("(o.in==='sent'&&t.msgs.some(m=>m.by||m.ours))",
    "(o.in==='sent'&&t.msgs.some(m=>m.by||m.ours)&&(typeof sentSeen!=='function'||sentSeen(t)))")

BLOCK = r"""
<script>
/* ===================== 17 Nov 2026: the Sent folder is personal too =====================
   A shared team mailbox (teamalpha@, teampulse@ ...) has ONE Sent folder on Google's side,
   so everybody used to see everybody's sent mail in it. Now a team member sees in Sent only
   the mail HE sent, the same way the Inbox already works (seeMine). The team's manager, the
   CRM and the admin still see everything the mailbox sent.
   "Mine" means: sent from Rugs Email by me, or sent from Outlook / Gmail under my own name,
   or sent from one of my own addresses (my user id plus the aliases in Admin -> Users).
   A mail sent from the mailbox under a name that belongs to nobody (e.g. "team alpha") cannot
   be traced to a person, so it stays visible to the whole team - nothing goes missing.
   This is the LAST layer over inView on purpose; an earlier layer would be bypassed. */
function nmKey(s){return String(s||'').toLowerCase().replace(/[^a-z\s]+/g,' ').trim().split(/\s+/)
 .filter(Boolean).map(w=>{const y=w.replace(/(.)\1+/g,'$1');return y[0]+y.slice(1).replace(/[aeiou]/g,'')})
 .filter(Boolean)}                      /* Jagjeet = Jagjit, Gulaab = Gulab, GULAB TYAGI = Gulab Tyagi */
function sentWho(m,t){                   /* which person sent this message, or null if we cannot tell */
 if(!m)return null;
 if(m.by)return m.by;                    /* sent from Rugs Email */
 if(!m.ours)return null;                 /* came from outside */
 const e=String(m.email||'').toLowerCase();
 if(e){const byMail=PEOPLE.find(p=>p.active!==false&&(String(p.login||'').toLowerCase()===e||
   String((p.perm&&p.perm.aliases)||'').toLowerCase().split(/[\s,;]+/).includes(e)));
  if(byMail)return byMail.id}
 const k=nmKey(m.fname||m.from);if(!k.length)return null;
 const pool=PEOPLE.filter(p=>p.active!==false&&(!t||!t.dept||p.dept===t.dept));
 let hit=pool.filter(p=>nmKey(p.name).join(' ')===k.join(' '));
 if(hit.length===1)return hit[0].id;
 if(k.length===1){hit=pool.filter(p=>nmKey(p.name)[0]===k[0]);if(hit.length===1)return hit[0].id}
 if(k.length>1){hit=PEOPLE.filter(p=>p.active!==false&&nmKey(p.name).join(' ')===k.join(' '));
  if(hit.length===1)return hit[0].id}        /* a full name from another team (someone with access to this mailbox) */
 return null}
function msgMine(m,t){return !!m&&(m.by?m.by===ME:sentWho(m,t)===ME)}
function sentSeen(t){const p=who(ME);
 if(!p||!t)return true;
 if(p.role==='Admin'||['Manager','Lead','CRM'].includes(p.role))return true;
 const out=(t.msgs||[]).filter(m=>m.by||(m.ours&&!colleagueIn(m,t)));
 if(!out.length)return true;             /* nothing was sent from this mailbox */
 if(out.some(m=>msgMine(m,t)))return true;  /* I sent one of them */
 return !out.some(m=>sentWho(m,t))}      /* nobody can be named: leave it with the whole team */
const _ivSent=inView;inView=function(t){
 if(t&&view&&view.type==='box'&&view.folder==='sent'&&t.dept===view.dept&&!sentSeen(t))return false;
 return _ivSent.apply(this,arguments)};
</script>
"""
h = h.rstrip() + '\n' + BLOCK.lstrip('\n')
out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched', n, 'places + the Sent rule block')
