# patch-trail-original.py — STEP 3: quote each earlier mail EXACTLY as it came
# (18 Nov 2026). Works on the decoded Email module (.tmp/email.html).
#
# Before: the trail was rebuilt as plain text (esc(q.body)) inside a grey
# bordered box, so fonts, colours, highlights, numbered lists, tables, pictures
# and the sender's own signature were all lost, and Gmail's plain-text *bold*
# markers showed as literal asterisks.
#
# After: each earlier mail is quoted from its ORIGINAL HTML (m.raw as Gmail
# sent it, or m.html for mail we wrote here), with nothing re-styled. Only the
# dangerous parts are removed: script, iframe, form, object, embed, noscript,
# base, meta, link, every on* handler and javascript: links, and @import.
# The mail's own <style> rules are kept but scoped to that quote so they cannot
# restyle the compose window. Plain text is used only when there is no HTML.
#
# Layout in the editor, Outlook style: your text, then your signature, then
# each earlier mail newest first as bold From / Sent / To / Cc / Subject labels
# in the normal body font (no box, no border, no grey), a blank line, then the
# original mail. All of it stays editable, and the sent mail carries the same.
# Nothing is deployed and no server file is touched.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "..", ".tmp", "email.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

if "function qBody(" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

def one(anchor, new, what):
    global src
    assert src.count(anchor) == 1, "anchor not unique: " + what
    src = src.replace(anchor, new)

# ------------------------------------------------------------ 1. trailOf
old_trailof = "function trailOf(t,upto){const ms=t.msgs.slice(0,upto==null?t.msgs.length:upto);return ms.map(m=>({from:m.from,email:m.email,at:m.at,to:m.by?t.email:dept(t.dept).box+'rugscreation.com',sub:cleanSub(t.sub),body:m.body,sig:m.sig}))}"
new_trailof = """function trailOf(t,upto){const ms=t.msgs.slice(0,upto==null?t.msgs.length:upto);
 return ms.map(m=>({from:m.from,email:m.email,at:m.at,
  to:m.to||(m.by?t.email:dept(t.dept).box+'rugscreation.com'),cc:m.cc||'',
  sub:cleanSub(t.sub),body:m.body,sig:m.sig,html:qBody(m)}))}
/* ---------- quoting an earlier mail exactly as it came ----------
   The quote is that mail's OWN HTML: m.raw (what Gmail actually sent) or
   m.html (a mail we wrote here). Nothing is re-styled, so its fonts, colours,
   highlights, numbered lists, tables, pictures and signature stay as they
   were. Only what can run or fetch something is removed. */
const QC=new WeakMap();                       // one parse per message, not per redraw
function scopeCSS(css,sel){
 /* the mail's own <style> rules are kept, but every selector is prefixed with
    this quote's class so they cannot restyle the compose window or the app.
    The browser's own CSS parser does the work; @import (rule type 3) is simply
    never copied across. media="not all" means nothing is applied while we read it. */
 if(!css)return'';
 const st=document.createElement('style');st.media='not all';st.textContent=css;document.head.appendChild(st);
 const walk=rules=>{let s='';for(const r of rules){
   if(r.type===1)s+=String(r.selectorText||'').split(',').map(x=>sel+' '+x.trim()).join(',')+'{'+r.style.cssText+'}';
   else if(r.type===4)s+='@media '+r.conditionText+'{'+walk(r.cssRules)+'}';
   else if(r.type===12)s+='@supports '+r.conditionText+'{'+walk(r.cssRules)+'}';
   else if(r.type===5)s+=r.cssText}
  return s};
 let out='';try{out=walk(st.sheet.cssRules)}catch(e){out=''}
 st.remove();return out}
function qBuild(m){
 const h=m&&(m.raw||m.html)||'';
 if(!h)return '';
 let doc;try{doc=new DOMParser().parseFromString(h,'text/html')}catch(e){return ''}
 if(!doc||!doc.body)return '';
 doc.querySelectorAll('script,iframe,form,object,embed,noscript,base,meta,link').forEach(n=>n.remove());
 doc.querySelectorAll('[data-trail]').forEach(n=>n.remove());   // our own earlier quote: each old mail is added on its own below
 doc.querySelectorAll('*').forEach(n=>{
  Array.prototype.slice.call(n.attributes).forEach(a=>{
   const k=a.name.toLowerCase();
   if(k.indexOf('on')===0)n.removeAttribute(a.name);
   else if((k==='href'||k==='src'||k==='action')&&/^\\s*javascript:/i.test(a.value||''))n.removeAttribute(a.name)})});
 doc.querySelectorAll('img[src^="cid:"]').forEach(n=>n.remove());   // pasted picture whose bytes never came: would only be a broken icon
 const cls='q'+String(m.gid||Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9]/g,'').slice(0,18);
 let css='';
 doc.querySelectorAll('style').forEach(s=>{css+=scopeCSS(s.textContent||'','.'+cls);s.remove()});
 /* plenty of mails set their base font or colour on <body> itself, so that is
    carried onto this quote's wrapper - otherwise the quote would silently fall
    back to the compose window's own font, which is re-styling by omission */
 let w=doc.body.getAttribute('style')||'';
 const bg=doc.body.getAttribute('bgcolor'),fg=doc.body.getAttribute('text');
 if(bg)w+=(w?';':'')+'background-color:'+bg;
 if(fg)w+=(w?';':'')+'color:'+fg;
 return '<div class="'+cls+'"'+(w?' style="'+esc(w)+'"':'')+'>'+(css?'<style>'+css+'</style>':'')+doc.body.innerHTML+'</div>'}
function qBody(m){
 if(!m||typeof m!=='object')return '';
 if(QC.has(m))return QC.get(m);
 let h='';try{h=qBuild(m)}catch(e){h=''}
 QC.set(m,h);return h}
/* plain-text fallback, used only when that mail has no HTML at all. Gmail's
   text copy writes bold as *stars*, so those become real bold instead of
   showing as asterisks. */
const qPlain=s=>esc(String(s||'')).replace(/\\*([^*\\n]{1,80})\\*/g,'<b>$1</b>').replace(/\\n/g,'<br>');
const qFallback=q=>'<div>'+qPlain(q.body)+(q.sig?'<br><br>'+qPlain(sigPlain(q.sig)):'')+'</div>';
/* the From / Sent / To / Cc / Subject lines: bold labels in the normal body
   font - no box, no border, no grey - then one blank line, like Outlook. */
function qHead(q){
 const L=(k,v)=>v?'<div><b>'+k+':</b> '+esc(v)+'</div>':'';
 return L('From',q.from+(q.email?' <'+q.email+'>':''))+L('Sent',tLong(q.at))
  +L('To',q.to)+L('Cc',q.cc)+L('Subject',q.sub)+'<div><br></div>'}
/* your own signature, written exactly as it will be sent */
const sigHTML=s=>s?(isHtmlSig(s)
 ?'<div data-sig="1" style="margin-top:16px">'+s+'</div>'
 :'<div data-sig="1" style="margin-top:14px;color:#444;white-space:pre-wrap;font-size:13px">'+esc(s)+'</div>'):''"""
one(old_trailof, new_trailof, "trailOf")

# ------------------------- 2. trailHTML (reading pane, mail already sent)
one("<div class=\"qb\">${esc(q.body)}${q.sig?'\\n\\n'+esc(sigPlain(q.sig)):''}</div>",
    "<div class=\"qb\">${q.html||qFallback(q)}</div>",
    "trailHTML body")

# ------------------------------------------------------------ 3. trailBlock
old_block = """function trailBlock(q,i){
 return '<div data-qm="'+i+'">'
  +'<div style="border-top:1px solid #ccc;margin:16px 0 10px"></div>'
  +'<div style="font-size:13px;color:#333"><b>From:</b> '+esc(q.from)+' &lt;'+esc(q.email)+'&gt;<br>'
  +'<b>Sent:</b> '+esc(tLong(q.at))+'<br><b>To:</b> '+esc(q.to)+'<br><b>Subject:</b> '+esc(q.sub)+'</div>'
  +'<div style="font-size:13px;color:#333"><br>'+esc(q.body).replace(/\\n/g,'<br>')
  +(q.sig?'<br><br>'+esc(sigPlain(q.sig)).replace(/\\n/g,'<br>'):'')+'</div></div>'}"""
new_block = """function trailBlock(q,i){
 return '<div data-qm="'+i+'">'+qHead(q)+(q.html||qFallback(q))+'<div><br></div></div>'}"""
one(old_block, new_block, "trailBlock")

# ----------------------------------------------------------- 4. outgoingHTML
one("function outgoingHTML(m){const sig=m.sig?(",
    "function outgoingHTML(m){const _inBody=/data-sig=/.test(m.html||'');const sig=m.sig&&!_inBody?(",
    "outgoingHTML signature guard")
old_tr = "const tr=(m.trail||[]).map(q=>`<div style=\"border-top:1px solid #ccc;margin-top:14px;padding-top:8px;font-size:13px;color:#333\"><b>From:</b> ${esc(q.from)} &lt;${esc(q.email)}&gt;<br><b>Sent:</b> ${esc(tLong(q.at))}<br><b>To:</b> ${esc(q.to)}<br><b>Subject:</b> ${esc(q.sub)}<br><br>${esc(q.body).replace(/\\n/g,'<br>')}${q.sig?'<br><br>'+esc(sigPlain(q.sig)).replace(/\\n/g,'<br>'):''}</div>`).join('');"
new_tr = "const tr=(m.trail||[]).map((q,i)=>trailBlock(q,i)).reverse().join('');   // same blocks as the editor, newest first"
one(old_tr, new_tr, "outgoingHTML trail")

# ------------------------------- 5. signature inside the editor (also New mail)
one("""<div>${start||'<br>'}</div>${t&&!o.asAtt&&!/data-trail=/.test(start)?`<div data-trail="1">${trailEditHTML(t)}</div>`:''}""",
    """<div>${start||'<br>'}</div>${/data-sig=/.test(start)?'':sigHTML(sigOf(ME))}${t&&!o.asAtt&&!/data-trail=/.test(start)?`<div data-trail="1">${trailEditHTML(t)}</div>`:''}""",
    "editor content")

# ------------------- 6. the Signature dropdown keeps that block in step
one(" q('#cSig').onchange=e=>{q('#sigPrev').hidden=!e.target.value};",
    """ q('#cSig').onchange=e=>{q('#sigPrev').hidden=!e.target.value};
 /* the signature now lives IN the message, above the quoted mails, so the
    dropdown has to add, swap or remove that block (addEventListener, because
    a later wrapper owns .onchange) */
 q('#cSig').addEventListener('change',e=>{const v=e.target.value;
  const s=v==='me'?sigOf(ME):(v&&v[0]==='x'?(extraSigs()[+v.slice(1)]?.text||''):'');
  const ed2=q('#cb');if(!ed2)return;const old=ed2.querySelector('[data-sig]');if(old)old.remove();
  if(!s)return;const tb=ed2.querySelector('[data-trail]');
  if(tb)tb.insertAdjacentHTML('beforebegin',sigHTML(s));else ed2.insertAdjacentHTML('beforeend',sigHTML(s))});""",
    "signature dropdown")

# ------------- 7. reading pane: do not show the signature twice for our mail
one("""${m.sig?`<div class="sig ${m.by?'ours':''}">""",
    """${m.sig&&!/data-sig=/.test(m.html||'')?`<div class="sig ${m.by?'ours':''}">""",
    "reading pane signature")

assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched .tmp/email.html: %+d characters" % (len(src) - len(orig)))
