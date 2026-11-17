# -*- coding: utf-8 -*-
# STEP 1 (17 Nov 2026) - paste or drop a file that is not a picture and it goes into the
# Attach files list, exactly as if it had been picked with the Attach button.
# Pictures keep going inline, as before.
#
# Edits .tmp/email.html (the decoded Email module), then puts it back into index.html
# as the EMAIL_HTML_B64 string. Nothing else in index.html changes.
import base64, io, re

APP = '.tmp/email.html'
P = 'index.html'
h = io.open(APP, encoding='utf-8', newline='').read()
n = 0

def rep(a, b):
    global h, n
    assert h.count(a) == 1, ('expected 1 copy, found %d' % h.count(a), a[:80])
    h = h.replace(a, b)
    n += 1

assert 'const addFiles=' not in h, 'already patched - aborting'

# 1) the helper, right after addImg
rep(
    """ q('#fImg').onchange=e=>{addImg(e.target.files);e.target.value=''};""",
    """ /* 17 Nov 2026: a pasted or dropped file that is NOT a picture goes into the Attach files
    list (the same _olk list the Attach button fills), so a PDF / Excel / Word / zip no longer
    disappears. Pictures still go inline into the text. */
 const addFiles=files=>{const list=[...files];if(!list.length)return 0;
  const inp=q('#cat');if(!inp){toast('Attach is not ready yet - use the Attach button');return 0}
  if(!inp._olkOn&&typeof cfSetup==='function'){try{cfSetup()}catch(e){}}
  if(!inp._olk)inp._olk=[...(inp.files||[])];
  const have=new Set(inp._olk.map(x=>x.name+'|'+x.size)),added=[];
  list.forEach(f=>{const k=f.name+'|'+f.size;
   if(have.has(k)){toast(f.name+' is already attached');return}
   if(inp._olk.length>=20){toast('A mail can carry 20 files at most - '+f.name+' was left out');return}
   inp._olk.push(f);have.add(k);added.push(f);
   if(typeof preWatch==='function')preWatch(f,()=>cfRender(L))});
  if(!added.length)return 0;
  cfSync(inp);cfRender(L);
  const tot=inp._olk.reduce((a,x)=>a+x.size,0);
  toast('Attached '+added.map(f=>f.name).slice(0,3).join(', ')+(added.length>3?' and '+(added.length-3)+' more':'')+' \\u00b7 '+fsize(tot)+' in all');
  if(tot>MAIL_MAX)toast(fsize(tot)+' of files is too much for one mail (about '+fsize(MAIL_MAX)+' fits, because files grow by a third on the way). Remove one, or send a Google Drive link.');
  return added.length};
 q('#fImg').onchange=e=>{addImg(e.target.files);e.target.value=''};""")

# 2) paste: pictures inline, everything else attached
rep(
    """ ed.addEventListener('paste',e=>{const imgs=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));if(imgs.length){e.preventDefault();keep();addImg(imgs);return}""",
    """ ed.addEventListener('paste',e=>{const pf=[...(e.clipboardData?.files||[])];
  const imgs=pf.filter(f=>f.type.startsWith('image/')),docs=pf.filter(f=>!f.type.startsWith('image/'));
  if(imgs.length||docs.length){e.preventDefault();if(imgs.length){keep();addImg(imgs)}if(docs.length)addFiles(docs);return}""")

# 3) drop: same split (it used to hand everything to addImg, which threw away anything but pictures)
rep(
    """ ed.addEventListener('drop',e=>{ed.classList.remove('drop');const f=[...(e.dataTransfer?.files||[])];if(f.length){e.preventDefault();addImg(f)}});""",
    """ ed.addEventListener('drop',e=>{ed.classList.remove('drop');const df=[...(e.dataTransfer?.files||[])];if(!df.length)return;e.preventDefault();
  const imgs=df.filter(x=>x.type.startsWith('image/')),docs=df.filter(x=>!x.type.startsWith('image/'));
  if(imgs.length)addImg(imgs);if(docs.length)addFiles(docs)});""")

io.open(APP, 'w', encoding='utf-8', newline='').write(h)

# put it back into index.html
src = open(P, encoding='utf-8', newline='').read()
m = re.search(r'var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"', src)
assert m, 'EMAIL_HTML_B64 not found'
out = base64.b64encode(h.encode('utf-8')).decode()
assert base64.b64decode(out).decode('utf-8') == h, 're-encode round-trip differs - aborting'
open(P, 'w', encoding='utf-8', newline='').write(src[:m.start(1)] + out + src[m.end(1):])
print('patched %d places in .tmp/email.html and re-encoded into index.html' % n)
