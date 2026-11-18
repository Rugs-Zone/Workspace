# patch-read-pane.py — STEP 4: reading pane like Outlook (18 Nov 2026).
# Works on the decoded Email module (.tmp/email.html).
#
# Grepped first. ALREADY THERE (olkHdr, added 14 Nov, wraps renderRead so it
# runs in both the classic and the 2.0 layout):
#   - sender name + <email>            (.olkfrom)
#   - a To / Cc line under the name    (.v2to)   <- but raw ADDRESSES
#   - the date on the right            (<time> + .mail header{display:flex}
#                                       with .w{flex:1}), full date on hover
#   - Reply / Reply all / Forward per mail (.v2ma)
#   - attachment tiles above the body: .att chips here, and 2.0 replaces
#     attHTML with its own .v2att tiles (badge + name + size), click = viewer
#
# MISSING, so only these are added:
#   1. the To / Cc line shows people's NAMES (raw addresses move to the tooltip)
#   2. a one-line "sent with High importance" banner
#   3. attachment tiles get an image THUMBNAIL and a small Open / Save /
#      Preview menu
# (3) is done as a wrapper that upgrades whatever drew the tiles, so it works
# for the .att chips here AND for 2.0's .v2att tiles, which is what the live
# Email Tracker shows (mail.html loads mail-v2.js, and that file replaces
# attHTML - editing attHTML alone would never show up live).
# Nothing is deployed and no server file is touched.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "..", ".tmp", "email.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

if "function olkExtras(" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

def one(anchor, new, what):
    global src
    assert src.count(anchor) == 1, "anchor not unique: " + what
    src = src.replace(anchor, new)

# ------------------------------------------- 1. To / Cc as names, not addresses
one("el.textContent=(to?'To: '+to:'')+(cc?(to?'   Cc: ':'Cc: ')+cc:'');",
    "el.textContent=(to?'To: '+nameList(to):'')+(cc?(to?'   Cc: ':'Cc: ')+nameList(cc):'');"
    "el.title=(to?'To: '+to:'')+(cc?(to?'\\n':'')+'Cc: '+cc:'');",
    "To/Cc line")

# --------------------- 2. remember the importance flag on a mail we send
one("liveSend=function(t,m,fwd,isNew){const box=isNew?mailOf(dept(t.dept)):t.box,localId=t.id,o=NEXT_OPTS||{};NEXT_OPTS=null;m.sending=true;",
    "liveSend=function(t,m,fwd,isNew){const box=isNew?mailOf(dept(t.dept)):t.box,localId=t.id,o=NEXT_OPTS||{};NEXT_OPTS=null;m.sending=true;m.imp=!!o.important;",
    "liveSend importance")

# ------------------------------------- 3. the extras, after the olkHdr wrapper
anchor = "const _rrH=renderRead;renderRead=function(){const r=_rrH.apply(this,arguments);try{olkHdr()}catch(e){console.log('olkHdr',e)}return r};"
extras = r"""
/* ---------- STEP 4 (18 Nov 2026): Outlook touches on the open mail ----------
   olkHdr above already draws the sender, the To / Cc line, the date on the
   right and the per-mail Reply buttons. These three were missing. */

/* (1) To / Cc by name. An address that belongs to one of our people or to a
   department mailbox is shown as that name; anything else keeps the name the
   sender wrote, or the address. The raw addresses stay in the tooltip. */
const addrOf=s=>(String(s||'').match(/[\w.+-]+@[\w.-]+\.\w+/)||[''])[0].toLowerCase();
function nameOf(one){
 const em=addrOf(one);
 const disp=String(one||'').replace(/<[^>]*>/g,'').replace(/["']/g,'').trim();
 if(em){
  const p=(PEOPLE||[]).find(x=>String(x.login||'').toLowerCase()===em
   ||String((x.perm&&x.perm.aliases)||'').toLowerCase().split(/[\s,;]+/).filter(Boolean).indexOf(em)>=0);
  if(p)return p.name;
  const d=(DEPTS||[]).find(x=>String(mailOf(x)||'').toLowerCase()===em);
  if(d)return d.name;
 }
 return disp||em}
const nameList=s=>String(s||'').split(/,(?![^<]*>)/).map(x=>nameOf(x.trim()))
 .filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join('; ');

/* (2)+(3) the importance banner, and thumbnails + an Open / Save / Preview
   menu on every attachment tile. This runs AFTER whatever drew the tiles, so
   it upgrades the .att chips here and the .v2att tiles of Rugs Email 2.0 (the
   layout the live Email Tracker uses) with the same code. */
const ATHUMB={};                                  // gid|name -> data: URL, this session only
function attListOf(m){
 const f=(m.files||[]).filter(x=>x&&x.name);
 if(f.length)return f;
 return (m.atts||[]).filter(x=>x&&x.name&&!(/^image\//i.test(x.mime||'')&&(x.size||0)<40000))}
function attFetch(box,gid,name){
 return api('attachment',{mailbox:box,gmailId:gid,name})}
function attSave(box,gid,name){
 attFetch(box,gid,name).then(r=>{
  const bin=atob(r.b64||''),u8=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const u=URL.createObjectURL(new Blob([u8],{type:r.mime||'application/octet-stream'}));
  const lk=document.createElement('a');lk.href=u;lk.download=name;lk.click();
  setTimeout(()=>URL.revokeObjectURL(u),4000)})
 .catch(e=>toast(e.message||'Could not download that file',true))}
function attMenu(btn,a){
 document.querySelectorAll('.olkpop').forEach(x=>x.remove());
 const p=document.createElement('div');p.className='olkpop';p.setAttribute('role','menu');
 p.innerHTML='<button type="button" role="menuitem" data-k="open">↗ Open'+(a.link?' in Drive':'')+'</button>'
  +'<button type="button" role="menuitem" data-k="save">⬇ Save</button>'
  +'<button type="button" role="menuitem" data-k="prev">\u{1f441} Preview</button>';
 document.body.appendChild(p);
 const r=btn.getBoundingClientRect();
 p.style.left=Math.max(8,Math.min(r.left,window.innerWidth-200))+'px';
 p.style.top=Math.min(r.bottom+4,window.innerHeight-140)+'px';
 const close=()=>{p.remove();document.removeEventListener('mousedown',out,true);document.removeEventListener('keydown',key,true)};
 const out=e=>{if(!p.contains(e.target))close()};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();close();btn.focus()}};
 setTimeout(()=>{document.addEventListener('mousedown',out,true);document.addEventListener('keydown',key,true)},0);
 p.querySelectorAll('button').forEach(b=>b.onclick=()=>{const k=b.dataset.k;close();
  if(k==='open'&&a.link){window.open(a.link,'_blank','noopener');return}
  if(k==='save'){if(a.gid)attSave(a.box,a.gid,a.name);else if(a.link)window.open(a.link,'_blank','noopener');else toast('That file is still being copied — try again in a moment');return}
  if(a.gid)previewAtt(a.box,a.gid,a.name);
  else if(a.link)window.open(a.link,'_blank','noopener');
  else toast('That file is still being copied — try again in a moment')});
 p.querySelector('button').focus()}
function olkExtras(){
 const R=document.getElementById('read'),t=openId&&T_(openId);
 if(!R||!t)return;
 R.querySelectorAll('article.mail').forEach(art=>{
  const mi=+String(art.id).split('-').pop(),m=t.msgs[mi];
  if(!m)return;
  /* (2) one line, like Outlook, when the mail was sent as High importance */
  if(m.imp&&!art.querySelector('.olkimp')){
   const bd=art.querySelector('.mbody');
   if(bd)bd.insertAdjacentHTML('afterbegin','<div class="olkimp">❗ This message was sent with High importance.</div>')}
  /* (3) thumbnails + the small menu, matched to the tiles in the order they
     were drawn (the same list attHTML and 2.0's attCards both build) */
  const list=attListOf(m),tiles=art.querySelectorAll('.v2att,.att');
  tiles.forEach((el,i)=>{
   if(el.dataset.olkplus)return;el.dataset.olkplus='1';
   const x=list[i]||{};
   const name=el.dataset.name||x.name||'';
   const mime=el.dataset.mime||x.mime||'';
   const link=el.dataset.link||x.link||(el.tagName==='A'?el.getAttribute('href')||'':'');
   const gid=el.dataset.gid||m.gid||'';
   if(!name)return;
   const isImg=/^image\//i.test(mime)||/\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
   if(isImg&&gid&&!el.querySelector('.olkth')){
    const k=gid+'|'+name,im=document.createElement('img');im.className='olkth';im.alt='';
    el.insertAdjacentElement('afterbegin',im);
    if(ATHUMB[k])im.src=ATHUMB[k];
    else attFetch(t.box,gid,name).then(r=>{
      if(!r||!r.b64){im.remove();return}
      ATHUMB[k]='data:'+(r.mime||'image/png')+';base64,'+r.b64;im.src=ATHUMB[k]})
     .catch(()=>{im.remove()})}
   const mb=document.createElement('button');
   mb.type='button';mb.className='olkam';mb.textContent='⋯';
   mb.title='Open, Save or Preview '+name;mb.setAttribute('aria-label',mb.title);
   el.insertAdjacentElement('afterend',mb);
   mb.onclick=e=>{e.preventDefault();e.stopPropagation();attMenu(mb,{box:t.box,gid,name,mime,link})}})});
}
const _rrE=renderRead;renderRead=function(){const r=_rrE.apply(this,arguments);try{olkExtras()}catch(e){console.log('olkExtras',e)}return r};
(function(){const st=document.createElement('style');st.textContent=
 '.olkth{width:30px;height:30px;object-fit:cover;border-radius:4px;flex:none;background:var(--soft,#f1f1f1)}'
 +'.olkam{border:1px solid var(--line);background:var(--pane);border-radius:4px;min-height:30px;padding:0 7px;font-size:14px;line-height:1;color:var(--muted);cursor:pointer;align-self:center}'
 +'.olkam:hover{background:var(--hover);color:var(--fg)}'
 +'.olkpop{position:fixed;z-index:10060;background:var(--pane);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px;min-width:170px}'
 +'.olkpop button{display:block;width:100%;text-align:left;background:none;border:0;padding:7px 10px;border-radius:6px;font-size:13px;color:var(--fg);cursor:pointer}'
 +'.olkpop button:hover{background:var(--hover)}'
 +'.olkimp{display:flex;gap:6px;align-items:center;font-size:12.5px;font-weight:600;color:#b42318;margin:0 0 8px}';
 document.head.appendChild(st)})();"""
one(anchor, anchor + extras, "olkHdr wrapper")

assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched .tmp/email.html: %+d characters" % (len(src) - len(orig)))
