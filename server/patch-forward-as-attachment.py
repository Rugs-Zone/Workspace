# -*- coding: utf-8 -*-
# STEP 3 (17 Nov 2026) - "Forward as attachment".
#
# Puts the original mail into the new mail as a real .eml file (message/rfc822) instead of
# quoting it in the body, the way Outlook's "Forward as attachment" does. Reachable from the
# open mail's button bar (so Rugs Email 2.0 shows it under "More"), from the right-click menu,
# and from the reading pane's "More actions".
#
# No server change is needed - rugs-mail's send already takes files as {name,type,b64} and
# writes the type into the MIME part as it is given.
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

assert 'function fwdAsAtt' not in h, 'already patched - aborting'

# ------------------------------------------------- 1. build the .eml and open compose with it
rep(
    """function compose(o){const t=o.t;""",
    """/* 17 Nov 2026: Forward as attachment (Outlook style). The mail is written out as a real
   .eml file (message/rfc822) and attached, so the person receiving it gets the original mail
   as an item they can open, with its own From / To / Date / Subject, instead of quoted text.
   Note: the original's own attachments are NOT inside this .eml - Rugs Email keeps only their
   names on the device, not the bytes - so they are named in a warning instead. */
const eml2047=s=>/[^\\x20-\\x7e]/.test(String(s||''))?'=?UTF-8?B?'+btoa(unescape(encodeURIComponent(String(s))))+'?=':String(s||'');
const emlDate=at=>new Date(at||Date.now()).toUTCString().replace(/GMT$/,'+0000');
function emlText(t,m){
 const sub=cleanSub(t.sub)||'(no subject)';
 const from=(m.from?eml2047(m.from)+' ':'')+'<'+String(m.email||'').replace(/[<>\\r\\n]/g,'')+'>';
 const to=String(m.to||(m.by?t.email:mailOf(dept(t.dept)))||'').replace(/[\\r\\n]/g,' ');
 const body=m.html||('<div style="font-family:Calibri,Arial,sans-serif;font-size:15px">'+esc(String(m.body||'')).replace(/\\n/g,'<br>')+'</div>');
 const atts=(m.atts||[]).map(a=>a&&a.name).filter(Boolean);
 let s='From: '+from+'\\r\\nTo: '+to+'\\r\\n';
 if(m.cc)s+='Cc: '+String(m.cc).replace(/[\\r\\n]/g,' ')+'\\r\\n';
 s+='Date: '+emlDate(m.at)+'\\r\\nSubject: '+eml2047(sub)+'\\r\\n';
 if(atts.length)s+='X-Original-Attachments: '+eml2047(atts.join(', ')).replace(/[\\r\\n]/g,' ')+'\\r\\n';
 s+='X-Forwarded-By: Rugs Email\\r\\nMIME-Version: 1.0\\r\\nContent-Type: text/html; charset="UTF-8"\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n';
 s+=btoa(unescape(encodeURIComponent(body))).replace(/(.{76})/g,'$1\\r\\n');
 return s}
function fwdAsAtt(t){
 if(!t||!(t.msgs||[]).length){toast('Nothing to forward yet');return}
 const m=t.msgs[t.msgs.length-1];
 let f;
 try{const name=((cleanSub(t.sub)||'mail').replace(/[\\\\/:*?"<>|]+/g,' ').trim().slice(0,60)||'mail')+'.eml';
  f=new File([emlText(t,m)],name,{type:'message/rfc822'})}
 catch(e){toast('This browser cannot build the .eml file');return}
 compose({t,fwd:true,asAtt:true,to:'',sub:'Fwd: '+(cleanSub(t.sub)||'(no subject)'),files:[f]});
 const miss=(m.atts||[]).map(a=>a&&a.name).filter(Boolean);
 if(miss.length)setTimeout(()=>toast('The mail itself is attached. Its own '+miss.length+' file'+(miss.length>1?'s':'')+' ('+miss.slice(0,2).join(', ')+(miss.length>2?'…':'')+') are not inside it - attach them separately if they are needed.'),900)}
function compose(o){const t=o.t;""")

# ------------------------------------------------- 2. no quoted trail when the mail is attached
rep(
    """${t&&!/data-trail=/.test(start)?`<div data-trail="1">${trailEditHTML(t)}</div>`:''}""",
    """${t&&!o.asAtt&&!/data-trail=/.test(start)?`<div data-trail="1">${trailEditHTML(t)}</div>`:''}""")
rep(
    """ ${t?`<div class="ctrail"><label><input type="checkbox" id="ctr" checked>""",
    """ ${t&&!o.asAtt?`<div class="ctrail"><label><input type="checkbox" id="ctr" checked>""")

# ------------------------------------------------- 3. files handed to compose are attached
rep(
    """ setTimeout(()=>{ed.focus();const r=document.createRange();""",
    """ if(o.files&&o.files.length)try{addFiles(o.files)}catch(e){toast('The file could not be attached')}
 setTimeout(()=>{ed.focus();const r=document.createRange();""")

# ------------------------------------------------- 4. button next to Forward in the open mail
rep(
    """<button class="btn" data-fwd="${t.id}">Forward</button>""",
    """<button class="btn" data-fwd="${t.id}">Forward</button><button class="btn" data-fwdatt="${t.id}" title="Send the original mail as a file (.eml) the other side can open">Forward as attachment</button>""")

# ------------------------------------------------- 5. the click handler knows the new button
rep("""[data-fwd],""", """[data-fwd],[data-fwdatt],""")
rep(
    """ if(d.fwd){compose({t:T_(d.fwd),fwd:true});return}""",
    """ if(d.fwd){compose({t:T_(d.fwd),fwd:true});return}
 if(d.fwdatt){fwdAsAtt(T_(d.fwdatt));return}""")

# ------------------------------------------------- 6. right-click menu
rep("""+it('fwd','↪ Forward')+'<hr>'""", """+it('fwd','↪ Forward')+it('fwdatt','📎 Forward as attachment')+'<hr>'""")
rep(
    """else if(a==='fwd')compose({t,fwd:true});""",
    """else if(a==='fwd')compose({t,fwd:true});else if(a==='fwdatt')fwdAsAtt(t);""")

io.open(APP, 'w', encoding='utf-8', newline='').write(h)

src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched %d places in .tmp/email.html and re-encoded into index.html' % n)
