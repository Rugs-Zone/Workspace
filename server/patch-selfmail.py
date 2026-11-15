# 16 Nov 2026 - a mail addressed to this mailbox is received mail, even when one of us sent it.
# Mail you send to your own address (marketing@ -> marketing@) used to appear only in Sent, because
# "received" meant "from somebody else". Gmail shows such a mail in both Inbox and Sent; now so does
# Rugs Email. Mail you send to a buyer is unaffected (the mailbox is not in To/Cc), so Sent stays clean.
import base64, re
P='index.html'
src=open(P,encoding='utf-8',newline='').read()
m=re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"',src)
b64=m.group(1); raw=base64.b64decode(b64)
assert base64.b64encode(raw).decode()==b64,'base64 round-trip differs - aborting'
h=raw.decode('utf-8'); n=0
def rep(a,b):
    global h,n
    assert h.count(a)==1,(h.count(a),a[:70])
    h=h.replace(a,b); n+=1

# 1) the helper + extend the "is this a received mail" rule
rep("""const recvMsg=(m,t)=>!(m.by||m.ours)||colleagueIn(m,t);""",
    """/* 16 Nov 2026: a mail ADDRESSED to this mailbox is received mail, even when one of us sent it -
   mail you send to your own address, or any mail with this mailbox in To/Cc. Gmail shows such a mail
   in both Inbox and Sent, and now Rugs Email does too. Mail sent to a buyer is untouched. */
const toThisBox=(m,t)=>{const b=String((t&&t.box)||'').toLowerCase();return !!b&&!!m&&((String(m.to||'')+' '+String(m.cc||'')).toLowerCase().includes(b))};
const recvMsg=(m,t)=>!(m.by||m.ours)||colleagueIn(m,t)||toThisBox(m,t);""")

# 2) the Inbox list itself
rep("""if(view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>!(m.by||m.ours));""",
    """if(view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t));""")

# 3) every mail count (badge, Home, folder counts, Inbox header)
rep("""function hasRecv(t){return t.msgs.some(m=>!(m.by||m.ours)||(m.ours&&!m.by&&m.email&&String(m.email).toLowerCase()!==String(t.box||'').toLowerCase()))}""",
    """function hasRecv(t){return t.msgs.some(m=>!(m.by||m.ours)||(m.ours&&!m.by&&m.email&&String(m.email).toLowerCase()!==String(t.box||'').toLowerCase())||toThisBox(m,t))}""")

out=base64.b64encode(h.encode('utf-8')).decode()
open(P,'w',encoding='utf-8',newline='').write(src[:m.start(1)]+out+src[m.end(1):])
print('patched',n,'places')
