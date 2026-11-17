# -*- coding: utf-8 -*-
# STEP 4 (17 Nov 2026) - a Forward now carries the original mail's files.
#
# CHECKED FIRST: it did not. The app only ever sent the files the person attached themselves
# (`o.fileList` -> `_olk`), and on the server `p.forward` only changes the subject prefix and
# the threading/log line (rugs-mail.index.ts lines 358-384) - it never re-attaches anything.
# So every forward went out as quoted text with the attachments silently missing.
#
# Now Forward shows "Files on the original mail" with a tickbox on each. Ticked ones are
# fetched from Gmail through the existing `attachment` action and put into the normal
# attachment list, so they go out with the mail and obey the same 15 MB check.
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

assert 'function origAtts' not in h, 'already patched - aborting'

# ------------------------------------------------- 1. the list of files on the original mail
rep(
    """/* 17 Nov 2026: Forward as attachment (Outlook style).""",
    """/* 17 Nov 2026: a forward carries the original mail's files. They are not on the device -
   only their names, types and sizes are - so a ticked file is fetched from Gmail through the
   same `attachment` action the preview uses, and then becomes an ordinary attachment of the
   new mail (same cards, same 15 MB check). Tiny inline pictures (logos in a signature) are
   left out, as everywhere else in the app. */
function origAtts(t){const out=[];
 (t&&t.msgs||[]).forEach((m,mi)=>{if(!m||!m.gid)return;
  const seen=new Set();
  (m.atts||[]).forEach(a=>{if(!a||!a.name)return;
   if(/^image\\//i.test(a.mime||'')&&(a.size||0)<40000)return;
   seen.add(a.name);out.push({name:a.name,size:a.size||0,mime:a.mime||'',gid:m.gid,mi,who:m.from||m.email||'',at:m.at})});
  (m.files||[]).forEach(f=>{if(!f||!f.name||seen.has(f.name))return;
   out.push({name:f.name,size:f.size||0,mime:'',gid:m.gid,mi,who:m.from||m.email||'',at:m.at})})});
 return out}
/* 17 Nov 2026: Forward as attachment (Outlook style).""")

# ------------------------------------------------- 2. the tickbox box in compose (Forward only)
rep(
    """ ${t&&!o.asAtt?`<div class="ctrail"><label><input type="checkbox" id="ctr" checked>""",
    """ ${t&&o.fwd&&!o.asAtt&&origAtts(t).length?`<div class="ctrail oatt"><label>${ico('clip')} Files on the original mail</label>
  <div class="qsel">${(()=>{const OA=origAtts(t),newest=Math.max.apply(null,OA.map(a=>a.mi));let run=0;return OA.map((a,i)=>{const last=a.mi===newest,fit=run+(a.size||0)<=MAIL_MAX,on=last&&fit;if(on)run+=a.size||0;
   return `<label><input type="checkbox" data-oatt="${i}" ${on?'checked':''}> ${esc(a.name)} <small>${fsize(a.size||0)} · ${esc(String(a.who).split(' ')[0])}, ${esc(tShort(a.at))}${!fit?' · too big to add':''}</small> <i class="ost"></i></label>`}).join('')})()}</div>
  <small style="color:var(--muted);display:block;margin-top:4px">Ticked files are fetched and sent with your forward. The newest mail's files are ticked for you.</small></div>`:''}
 ${t&&!o.asAtt?`<div class="ctrail"><label><input type="checkbox" id="ctr" checked>""")

# ------------------------------------------------- 3. fetch on tick, drop on untick
rep(
    """ if(o.files&&o.files.length)try{addFiles(o.files)}catch(e){toast('The file could not be attached')}""",
    """ if(o.files&&o.files.length)try{addFiles(o.files)}catch(e){toast('The file could not be attached')}
 /* 17 Nov 2026: the original mail's files, fetched only when they are actually wanted */
 if(t&&o.fwd&&!o.asAtt){const OA=origAtts(t);
  const stat=(cb,s)=>{const el=cb.closest('label')&&cb.closest('label').querySelector('.ost');if(el)el.textContent=s||''};
  const pull=(i,cb,after)=>{const a=OA[i];if(!a){after&&after(false);return}
   stat(cb,'getting it…');
   api('attachment',{mailbox:t.box,gmailId:a.gid,name:a.name}).then(r=>{
    const bin=atob(r.b64||''),u8=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u8[k]=bin.charCodeAt(k);
    a.file=new File([u8],a.name,{type:r.mime||a.mime||'application/octet-stream'});
    stat(cb,'');addFiles([a.file]);after&&after(true)})
   .catch(e=>{stat(cb,'could not be fetched');cb.checked=false;toast(a.name+' could not be fetched from Gmail — '+((e&&e.message)||'try again'));after&&after(false)})};
  const drop=a=>{const inp=q('#cat');if(!inp||!inp._olk)return;
   const j=inp._olk.findIndex(x=>x.name===a.name&&(!a.file||x.size===a.file.size));
   if(j>=0){inp._olk.splice(j,1);cfSync(inp);cfRender(L);toast('Removed '+a.name)}};
  const boxes=[...L.querySelectorAll('[data-oatt]')];
  boxes.forEach(cb=>{cb.onchange=()=>{const a=OA[+cb.dataset.oatt];if(!a)return;
   if(cb.checked)pull(+cb.dataset.oatt,cb);else drop(a)}});
  /* the ones that start ticked are fetched one after another, not all at once */
  const q0=boxes.filter(cb=>cb.checked);(function nx(){const cb=q0.shift();if(!cb)return;pull(+cb.dataset.oatt,cb,()=>nx())})()}""")

# ------------------------------------------------- 4. a little style for the per-file status
rep(
    """.ctrail .qsel label{font-weight:500;color:var(--muted)}""",
    """.ctrail .qsel label{font-weight:500;color:var(--muted)}
.ctrail.oatt .qsel{max-height:120px}
.ctrail.oatt .qsel label{flex-wrap:wrap}
.ctrail .qsel small{color:var(--muted);font-weight:400}
.ctrail .ost{font-style:normal;font-size:11.5px;color:var(--blue,#0f6cbd)}""")

io.open(APP, 'w', encoding='utf-8', newline='').write(h)

src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched %d places in .tmp/email.html and re-encoded into index.html' % n)
