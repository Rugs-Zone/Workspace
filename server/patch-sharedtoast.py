# 16 Nov 2026 - "Only the admin can change shared rules..." kept popping up for everyone.
# applyBoot() loads the shared lists (categories, folders, templates, circulars, rules, blocked)
# and records what the server has in metaSaved.__cats / __fold / ... . enterApp() then ran
# metaSaved={} and wiped those markers. On the next save pass every shared list looked "changed",
# so the app tried to save all six - and for anyone who is not an Admin it showed the toast AND
# reset their list to [] (categories, templates and folders disappeared from their screen).
# Fix 1: enterApp keeps the __ markers (only the per-conversation ones are cleared).
# Fix 2: a non-admin never tries to save a shared list again - silently, and without throwing their copy away.
import base64, re
P='index.html'
src=open(P,encoding='utf-8',newline='').read()
m=re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"',src)
b64=m.group(1); raw=base64.b64decode(b64)
assert base64.b64encode(raw).decode()==b64,'base64 round-trip differs - aborting'
h=raw.decode('utf-8'); n=0
def rep(a,b):
    global h,n
    assert h.count(a)==1,(h.count(a),a[:60])
    h=h.replace(a,b); n+=1

keep = "metaSaved=Object.fromEntries(Object.entries(metaSaved).filter(([x])=>x.slice(0,2)==='__'));"
rep("lastList=0;metaSaved={};const _had=await idbRead();if(!_had){S.threads=[];metaSaved={};lastList=0;readCache()}",
    "lastList=0;" + keep + "const _had=await idbRead();if(!_had){S.threads=[];" + keep + "lastList=0;readCache()}")

rep("""if(who(ME)?.role!=='Admin'){S[k]=base;toast('Only the admin can change shared rules, categories, templates and circulars');render();return}""",
    """if(who(ME)?.role!=='Admin'){metaSaved[mk]=cur;return}   /* 16 Nov 2026: only an Admin may save the shared lists. Keep what we have, stop trying, and never show a toast for it - the app used to pop one up on every refresh and blank the list. */""")

out=base64.b64encode(h.encode('utf-8')).decode()
open(P,'w',encoding='utf-8',newline='').write(src[:m.start(1)]+out+src[m.end(1):])
print('patched',n,'places')
