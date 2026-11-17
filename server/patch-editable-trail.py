# -*- coding: utf-8 -*-
# STEP 2 (17 Nov 2026) - the reply / forward trail becomes REAL EDITABLE TEXT in the message
# body, Outlook style, instead of a read-only grey box under the editor.
#
#  * each earlier mail is one block in the body: a thin line, then From / Sent / To / Subject,
#    then that mail's text - so any mail, paragraph, line or word can be edited or deleted
#    before sending, like Outlook
#  * the "Include trail" tickbox stays as a quick on/off, and each earlier mail gets its own
#    tickbox so a single one can be dropped and put back
#  * what goes out is the body itself (outgoingHTML / sendReply no longer re-append a stored
#    trail), and the signature is placed under your own text, above the quoted trail
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

assert 'function trailEditHTML' not in h, 'already patched - aborting'

# ---------------------------------------------------------------- 1. the builders
rep(
    """function sendReply(t,txt,p,dv,fwd,noTrail,html,withSig=true){""",
    """/* 17 Nov 2026: the mail trail as real, editable text in the body (Outlook style).
   trailBlock() draws one earlier mail; trailEditHTML() draws them newest first, which is the
   order Outlook uses. These are plain <div>s inside the editor, so every line can be edited or
   deleted before sending, and what is left is exactly what goes out. */
function trailBlock(q,i){
 return '<div data-qm="'+i+'">'
  +'<div style="border-top:1px solid #ccc;margin:16px 0 10px"></div>'
  +'<div style="font-size:13px;color:#333"><b>From:</b> '+esc(q.from)+' &lt;'+esc(q.email)+'&gt;<br>'
  +'<b>Sent:</b> '+esc(tLong(q.at))+'<br><b>To:</b> '+esc(q.to)+'<br><b>Subject:</b> '+esc(q.sub)+'</div>'
  +'<div style="font-size:13px;color:#333"><br>'+esc(q.body).replace(/\\n/g,'<br>')
  +(q.sig?'<br><br>'+esc(sigPlain(q.sig)).replace(/\\n/g,'<br>'):'')+'</div></div>'}
function trailEditHTML(t){const tr=trailOf(t);return tr.map((q,i)=>trailBlock(q,i)).reverse().join('')}
function sendReply(t,txt,p,dv,fwd,noTrail,html,withSig=true){""")

# ---------------------------------------------------------------- 2. the editor starts with the trail in it
rep(
    """  <div class="editor" id="cb" contenteditable="true" spellcheck="true" aria-label="Message" style="font-family:Calibri,Arial,sans-serif;font-size:15px"><div>${start||'<br>'}</div></div>""",
    """  <div class="editor" id="cb" contenteditable="true" spellcheck="true" aria-label="Message" style="font-family:Calibri,Arial,sans-serif;font-size:15px"><div>${start||'<br>'}</div>${t&&!/data-trail=/.test(start)?`<div data-trail="1">${trailEditHTML(t)}</div>`:''}</div>""")

# ---------------------------------------------------------------- 3. the tickbox box under the editor
rep(
    """ ${t?`<div class="ctrail"><label><input type="checkbox" id="ctr" checked> Include the mail trail (${t.msgs.length} earlier mail${t.msgs.length>1?'s':''}) below my ${o.fwd?'forward':'reply'}</label>${trailHTML(trailOf(t),true)}</div>`:''}""",
    """ ${t?`<div class="ctrail"><label><input type="checkbox" id="ctr" checked> Include the mail trail (${t.msgs.length} earlier mail${t.msgs.length>1?'s':''}) below my ${o.fwd?'forward':'reply'}</label>
  <div class="qsel">${trailOf(t).map((qq,i)=>({qq,i})).reverse().map(({qq,i})=>`<label><input type="checkbox" data-qsel="${i}" checked> ${esc(qq.from)} · ${esc(tShort(qq.at))}</label>`).join('')}</div>
  <small style="color:var(--muted);display:block;margin-top:4px">The trail is written in the message above - edit or delete any line of it before you send. Untick one to drop that mail, tick it again to put it back.</small></div>`:''}""")

# ---------------------------------------------------------------- 4. the tickbox handlers inside compose
rep(
    """ const html=()=>cleanHTML(ed.innerHTML),text=()=>ed.innerText.trim();""",
    """ const html=()=>cleanHTML(ed.innerHTML),text=()=>ed.innerText.trim();
 /* 17 Nov 2026: the trail lives in the body; these tickboxes only add or take away blocks. */
 if(t){const TR=trailOf(t);let trailKeep='';
  const trailBox=()=>ed.querySelector('[data-trail]');
  const ctr=q('#ctr');
  if(ctr)ctr.onchange=()=>{const box=trailBox();
   if(ctr.checked){if(!box){ed.insertAdjacentHTML('beforeend',trailKeep||('<div data-trail="1">'+trailEditHTML(t)+'</div>'));trailKeep=''}}
   else if(box){trailKeep=box.outerHTML;box.remove()}
   L.querySelectorAll('[data-qsel]').forEach(cb=>{cb.checked=ctr.checked});keep()};
  L.querySelectorAll('[data-qsel]').forEach(cb=>{cb.onchange=()=>{
   const i=+cb.dataset.qsel;let box=trailBox();
   if(!box){if(!cb.checked)return;ed.insertAdjacentHTML('beforeend','<div data-trail="1"></div>');box=trailBox();if(ctr)ctr.checked=true}
   const el=box.querySelector('[data-qm="'+i+'"]');
   if(cb.checked){if(!el&&TR[i]){const mk=trailBlock(TR[i],i),older=[...box.querySelectorAll('[data-qm]')].find(x=>+x.dataset.qm<i);
    if(older)older.insertAdjacentHTML('beforebegin',mk);else box.insertAdjacentHTML('beforeend',mk)}}
   else if(el)el.remove();
   if(ctr)ctr.checked=!!(trailBox()&&trailBox().querySelector('[data-qm]'));
   keep()}})}""")

# ---------------------------------------------------------------- 5. sending uses the edited body, nothing else
rep(
    """,inc=q('#ctr')?.checked!==false,""",
    """,""")
rep(
    """sendReply(t,bodyV||'(picture)',p,dv,o.fwd,!inc,htmlV,withSig)""",
    """sendReply(t,bodyV||'(picture)',p,dv,o.fwd,true,htmlV,withSig)""")   # trail is already inside the body

# ---------------------------------------------------------------- 6. signature above the quoted trail
rep(
    """ return `<div style="font-family:Calibri,Arial,sans-serif;font-size:15px">${m.html||esc(m.body).replace(/\\n/g,'<br>')}${sig}${tr}</div>`}""",
    """ const bodyHTML=m.html||esc(m.body).replace(/\\n/g,'<br>');
 /* the trail is written in the body now, so the signature goes under the person's own words,
    above the quoted mails - the way Outlook does it */
 let main=bodyHTML,quoted='';
 if(sig&&/data-trail=/.test(bodyHTML)){try{const d=new DOMParser().parseFromString('<div>'+bodyHTML+'</div>','text/html'),tb=d.querySelector('[data-trail]');
  if(tb){tb.remove();main=d.body.firstChild.innerHTML;quoted=tb.outerHTML}}catch(e){}}
 return `<div style="font-family:Calibri,Arial,sans-serif;font-size:15px">${main}${sig}${quoted}${tr}</div>`}""")

# ---------------------------------------------------------------- 7. a little style for the tickbox list
rep(
    """.ctrail label{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700}""",
    """.ctrail label{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700}
.ctrail .qsel{display:flex;flex-wrap:wrap;gap:4px 14px;margin:6px 0 0;max-height:96px;overflow:auto}
.ctrail .qsel label{font-weight:500;color:var(--muted)}""")

io.open(APP, 'w', encoding='utf-8', newline='').write(h)

src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched %d places in .tmp/email.html and re-encoded into index.html' % n)
