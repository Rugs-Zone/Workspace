# 16 Nov 2026 — Rugs Email: tell a person when a mail is handed to them.
# Until now every team member could see all the team's mail, so a hand-over needed no notice.
# With the new rule (a mail with an owner is that person's mail) being given a mail is the only way
# the new owner learns about it — and the mail may already be marked read, so nothing would stand out.
import base64, re

P = 'index.html'
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
b64 = m.group(1)
raw = base64.b64decode(b64)
assert base64.b64encode(raw).decode() == b64, 'base64 round-trip differs - aborting'
html = raw.decode('utf-8')

anchor = """const _lrMine=listRows;listRows=function(){return _lrMine().filter(seeMine)};   /* also covers Search */"""
assert html.count(anchor) == 1

block = anchor + """
/* "a mail was given to you": the thread was owned by somebody else (or nobody) last time we looked and
   is mine now. Notification text is escaped where it is drawn, so it is stored as plain text. */
const _pollMine=poll;poll=async function(){
 const was=new Map(S.threads.map(t=>[t.id,t.owner||'']));
 const r=await _pollMine.apply(this,arguments);
 try{
  const given=S.threads.filter(t=>t.owner===ME&&was.has(t.id)&&was.get(t.id)!==ME&&t.folder!=='deleted'&&st(t)!=='done');
  if(given.length){
   given.forEach(t=>{const h=(t.hist||[]).filter(x=>x.t==='a').slice(-1)[0],by=h&&/ by (.+)$/.exec(h.txt||'');
    S.notifs.unshift({t:`\\u{1F449} ${by?by[1]+' gave you':'You were given'} \\u201C${cleanSub(t.sub)}\\u201D \\u2014 ${t.from}`,at:Date.now(),read:false})});
   save();playDing();
   toast(given.length===1?`\\u{1F449} Given to you: ${cleanSub(given[0].sub)}`:`\\u{1F449} ${given.length} mails were given to you`);
   renderTop();renderFolders()}
 }catch(e){console.log('handover notice',e)}
 return r};"""

html = html.replace(anchor, block)
out = base64.b64encode(html.encode('utf-8')).decode()
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('ok')
