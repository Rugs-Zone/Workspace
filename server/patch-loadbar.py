# 16 Nov 2026 - "only 324 showing" / "it is still taking time".
# When you open a mailbox the app fills in the rest of the 180 days in the background, but the
# line that says so sits at the BOTTOM of the list, so nobody sees it and the half-filled list
# looks broken. While it is loading the line now sits at the TOP of the list; the "all shown"
# message stays at the bottom where it belongs as an end marker.
import base64, re
P='index.html'
src=open(P,encoding='utf-8',newline='').read()
m=re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"',src)
b64=m.group(1); raw=base64.b64decode(b64)
assert base64.b64encode(raw).decode()==b64,'base64 round-trip differs - aborting'
h=raw.decode('utf-8')
a = """ const m=document.querySelector('.list .msgs');if(m)m.insertAdjacentHTML('beforeend',`<div class="inb60">${st&&st.done?'\u2713 All mail from the last '+HIST_DAYS+' days is shown \u2014 older mail: use Search':'\u23f3 Loading the rest of the last '+HIST_DAYS+' days in the background\u2026'}</div>`);"""
assert h.count(a)==1, h.count(a)
b = """ const m=document.querySelector('.list .msgs');const _lding=!(st&&st.done);
 if(m)m.insertAdjacentHTML(_lding?'afterbegin':'beforeend',`<div class="inb60${_lding?' lding':''}">${_lding?'\u23f3 Still loading the last '+HIST_DAYS+' days of this mailbox \u2014 older mail keeps arriving for about a minute\u2026':'\u2713 All mail from the last '+HIST_DAYS+' days is shown \u2014 older mail: use Search'}</div>`);"""
h=h.replace(a,b)
a2 = "'.listmore{padding:14px;text-align:center;color:var(--muted);font-size:12.5px;cursor:pointer}',"
assert h.count(a2)==1
h=h.replace(a2, a2 + "\n '.inb60.lding{background:#fff6ed;border-bottom:1px solid var(--line);color:#9a4a00;font-weight:600}',")
out=base64.b64encode(h.encode('utf-8')).decode()
open(P,'w',encoding='utf-8',newline='').write(src[:m.start(1)]+out+src[m.end(1):])
print('ok')
