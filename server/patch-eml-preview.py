# patch-eml-preview.py — STEP 7: open a .eml (a mail sent as a file) inside
# Rugs Email (18 Nov 2026). Works on the decoded Email module (.tmp/email.html).
#
# A .eml is a raw MIME mail. Until now both previewers fell through to "this
# file type can't be shown here". Now the file is parsed in the browser and
# shown like a received mail:
#   - headers From / To / Cc / Date / Subject, with =?UTF-8?B?..?= names decoded
#   - quoted-printable and base64 bodies, any charset
#   - multipart/alternative (HTML preferred), related, mixed, nested mails
#   - cid: inline pictures turned into data: URLs
#   - the HTML body in the same sandboxed iframe as received mail, following
#     the same "Show pictures" rule, with scripts stripped
#   - the mail's own attachments as tiles that open in the same previewer
#   - Download and Close
# Outlook .msg files get a Download button only, as asked.
# How .eml files are CREATED and SENT is not touched.
# Nothing is deployed and no server file is touched.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "..", ".tmp", "email.html")
src = io.open(P, encoding="utf-8", newline="").read()
orig = src

if "function emlParse(" in src:
    print("Already patched — nothing to do.")
    sys.exit(0)

def one(anchor, new, what):
    global src
    assert src.count(anchor) == 1, "anchor not unique: " + what
    src = src.replace(anchor, new)

ENGINE = r"""/* ============ .eml opened inside Rugs Email (18 Nov 2026) ============
   A .eml file is a raw MIME mail. Everything below reads one in the browser:
   headers (including =?UTF-8?B?..?= encoded words), quoted-printable and
   base64 bodies in any charset, multipart/alternative + related + mixed,
   mails attached inside mails, and cid: pictures turned into data: URLs.
   Nothing here changes how we build or send .eml files. */
const emlIs=(n,m)=>/\.eml$/i.test(String(n||''))||/message\/rfc822/i.test(String(m||''));
const emlIsMsg=n=>/\.msg$/i.test(String(n||''));
const b2s=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return s};
const s2b=s=>{const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&255;return u};
const b64Dec=s=>{try{return atob(String(s||'').replace(/[^A-Za-z0-9+/=]/g,''))}catch(e){return ''}};
const qpDec=s=>String(s||'').replace(/=\r?\n/g,'').replace(/=([0-9A-Fa-f]{2})/g,(m,h)=>String.fromCharCode(parseInt(h,16)));
function mimeText(bin,charset){           // one part's bytes -> readable text
 try{return new TextDecoder(charset||'utf-8',{fatal:false}).decode(s2b(bin))}
 catch(e){try{return new TextDecoder('windows-1252').decode(s2b(bin))}catch(x){return String(bin||'')}}}
function hdrWord(s){                      // "=?UTF-8?B?...?=" in a header
 return String(s||'').replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,(m,cs,en,tx)=>
  mimeText(en.toLowerCase()==='b'?b64Dec(tx):qpDec(String(tx).replace(/_/g,' ')),cs)).trim()}
function hdrSplit(block){                 // header block -> {name:value}
 const h={};
 String(block||'').replace(/\r\n/g,'\n').replace(/\n[ \t]+/g,' ').split('\n').forEach(l=>{
  const i=l.indexOf(':');if(i<1)return;
  const k=l.slice(0,i).trim().toLowerCase(),v=l.slice(i+1).trim();
  h[k]=h[k]?h[k]+', '+v:v});
 return h}
const hdrPar=(v,k)=>{const m=new RegExp(k+'\\s*=\\s*"([^"]*)"|'+k+'\\s*=\\s*([^;\\s]+)','i').exec(String(v||''));return m?(m[1]||m[2]||''):''};
const reEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function mimePart(raw){                   // one MIME entity (binary string)
 const cut=String(raw).search(/\r?\n\r?\n/);
 const h=hdrSplit(cut<0?raw:raw.slice(0,cut));
 let body=cut<0?'':raw.slice(cut).replace(/^\r?\n\r?\n/,'');
 const ct=h['content-type']||'text/plain';
 const type=(ct.split(';')[0]||'').trim().toLowerCase();
 if(/^multipart\//.test(type)){
  const b=hdrPar(ct,'boundary'),kids=[];
  if(b)body.split(new RegExp('\\r?\\n?--'+reEsc(b)+'(?:--)?[ \\t]*\\r?\\n?')).slice(1)
   .forEach(p=>{if(p&&p.trim())kids.push(mimePart(p))});
  return {type,h,kids};
 }
 const enc=String(h['content-transfer-encoding']||'7bit').trim().toLowerCase();
 if(enc==='base64')body=b64Dec(body);
 else if(enc==='quoted-printable')body=qpDec(body);
 return {type,h,body,
  name:hdrWord(hdrPar(h['content-disposition'],'filename')||hdrPar(ct,'name')),
  cid:String(h['content-id']||'').replace(/[<>]/g,'').trim(),
  disp:String(h['content-disposition']||'').split(';')[0].trim().toLowerCase(),
  charset:hdrPar(ct,'charset')}}
function emlParse(u8){
 const root=mimePart(b2s(u8)),H=root.h||{};
 const out={from:hdrWord(H.from),to:hdrWord(H.to),cc:hdrWord(H.cc),date:H.date||'',
  subject:hdrWord(H.subject),html:'',text:'',atts:[]};
 const leaves=[],files=[];
 (function dig(p){if(!p)return;if(p.kids&&p.kids.length)p.kids.forEach(dig);else leaves.push(p)})(root);
 leaves.forEach(p=>{
  const isFile=p.disp==='attachment'||!!p.name||p.type==='message/rfc822';
  if(p.type==='text/html'&&!isFile&&!out.html)out.html=mimeText(p.body,p.charset);
  else if(p.type==='text/plain'&&!isFile&&!out.text)out.text=mimeText(p.body,p.charset);
  else if(p.body!=null)files.push(p)});
 const url=f=>{try{return 'data:'+(f.type||'application/octet-stream')+';base64,'+btoa(f.body)}catch(e){return ''}};
 const used={};
 out.html=String(out.html||'').replace(/(["'(])cid:([^"')\s>]+)/gi,(m,q,id)=>{
  const want=decodeURIComponent(id).toLowerCase();
  const f=files.find(x=>x.cid&&x.cid.toLowerCase()===want)||files.find(x=>x.name&&x.name.toLowerCase()===want);
  if(!f)return m;
  const u=url(f);if(!u)return m;
  used[f.cid||f.name]=1;return q+u});
 out.atts=files.filter(f=>!used[f.cid||f.name]).map(f=>({
  name:f.name||(f.type==='message/rfc822'?'Attached mail.eml':'part.'+(String(f.type).split('/')[1]||'bin')),
  mime:f.type||'application/octet-stream',bin:f.body||''}));
 out.atts.forEach(a=>{if(a.mime==='message/rfc822'&&!/\.eml$/i.test(a.name))a.name+='.eml'});
 return out}
const emlFile=a=>new File([s2b(a.bin)],a.name,{type:a.mime||'application/octet-stream'});
/* draw a parsed .eml into any container, like a received mail */
function emlMount(el,u8,name){
 let P=null;try{P=emlParse(u8)}catch(e){P=null}
 if(!P||(!P.html&&!P.text&&!P.atts.length&&!P.subject&&!P.from)){
  el.innerHTML='<div class="empty" style="padding:18px"><b>'+esc(name||'This mail file')+'</b><span>This mail file is empty or damaged, so it cannot be shown. Press Download to keep a copy.</span></div>';return}
 const addr=(String(P.from).match(/[\w.+-]+@[\w.-]+\.\w+/)||[''])[0];
 const pm={email:addr,from:P.from,showPics:false,raw:P.html};          // stands in for a message, so the Show pictures rule applies
 const row=(k,v)=>v?'<div class="emlh-r"><span>'+k+'</span><b>'+esc(v)+'</b></div>':'';
 const draw=()=>{
  const bodyHTML=P.html||'<pre style="white-space:pre-wrap;font:14px Segoe UI,Arial,sans-serif;margin:0">'+esc(P.text||'(this mail has no message)')+'</pre>';
  const blocked=!picsOk(pm)&&hasRemote(bodyHTML);
  el.innerHTML='<div class="emlh">'+row('From',P.from)+row('To',P.to)+row('Cc',P.cc)
   +row('Date',P.date)+row('Subject',P.subject||'(no subject)')+'</div>'
   +(blocked?'<div class="picbar" role="note"><span>\u{1f5bc} Pictures from the internet are hidden to protect your privacy.</span><button class="btn" type="button" data-emlpics>Show pictures</button></div>':'')
   +'<div class="raw"><iframe sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" title="'+esc(P.subject||name||'Attached mail')+'" data-pics="'+(blocked?0:1)+'" srcdoc="'+esc(picHTML(pm,emlSafe(bodyHTML)))+'"></iframe></div>'
   +(P.atts.length?'<div class="emlat"><label>'+P.atts.length+' file'+(P.atts.length>1?'s':'')+' on this mail</label><div class="cfl" role="list">'
     +P.atts.map((a,i)=>{const kc=cfKind(a.name,a.mime);
      return '<div class="cf" role="listitem"><span class="cfb" style="background:'+kc[1]+'" aria-hidden="true">'+kc[0]+'</span>'
       +'<span class="cfn">'+esc(a.name)+'</span><small>'+fsize((a.bin||'').length)+'</small>'
       +'<button class="btn" type="button" data-emlv="'+i+'">\u{1f441} Open</button>'
       +'<button class="btn" type="button" data-emld="'+i+'">⬇ Save</button></div>'}).join('')
     +'</div></div>':'');
  try{fitFrames()}catch(e){}
  const sp=el.querySelector('[data-emlpics]');
  if(sp)sp.onclick=()=>{pm.showPics=true;draw()};
  el.querySelectorAll('[data-emlv]').forEach(b=>b.onclick=()=>{const a=P.atts[+b.dataset.emlv];if(a)cfView(emlFile(a))});
  el.querySelectorAll('[data-emld]').forEach(b=>b.onclick=()=>{const a=P.atts[+b.dataset.emld];if(!a)return;
   const u=URL.createObjectURL(emlFile(a)),lk=document.createElement('a');lk.href=u;lk.download=a.name;lk.click();setTimeout(()=>URL.revokeObjectURL(u),4000)});
 };
 draw()}
/* the body of a .eml is shown in the same sandboxed iframe as received mail
   (so no script can run anyway), and these are removed as well */
function emlSafe(h){
 let doc;try{doc=new DOMParser().parseFromString(String(h||''),'text/html')}catch(e){return ''}
 if(!doc||!doc.documentElement)return '';
 doc.querySelectorAll('script,iframe,form,object,embed,noscript,base,link[rel~="import"]').forEach(n=>n.remove());
 doc.querySelectorAll('*').forEach(n=>{Array.prototype.slice.call(n.attributes).forEach(a=>{
  const k=a.name.toLowerCase();
  if(k.indexOf('on')===0)n.removeAttribute(a.name);
  else if((k==='href'||k==='src'||k==='action')&&/^\s*javascript:/i.test(a.value||''))n.removeAttribute(a.name)})});
 return doc.documentElement.outerHTML}
/* a .eml opened from the compose Attach-files list, or from a tile above */
function emlOverlay(file){
 const url=URL.createObjectURL(file),ov=document.createElement('div');
 ov.className='cfview';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
 ov.setAttribute('aria-label','Preview of '+file.name);
 ov.innerHTML='<div class="cfvbar"><b>'+esc(file.name)+'</b><small>'+fsize(file.size)+'</small><span style="flex:1"></span>'
  +'<a class="btn" href="'+url+'" download="'+esc(file.name)+'">⬇ Download</a>'
  +'<button type="button" class="btn" data-cfvx aria-label="Close preview (Esc)">✕ Close</button></div>'
  +'<div class="cfvbody"><div class="cfvoffice emlbox"><div class="cfvmsg dark">Opening '+esc(file.name)+'…</div></div></div>';
 const back=document.activeElement;document.body.appendChild(ov);
 const close=()=>{ov.remove();URL.revokeObjectURL(url);document.removeEventListener('keydown',key,true);if(back&&back.isConnected)back.focus()};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
 document.addEventListener('keydown',key,true);
 ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-cfvx]'))close()});
 const el=ov.querySelector('.emlbox');
 if(emlIsMsg(file.name)){el.innerHTML='<div class="cfvmsg dark"><b>'+esc(file.name)+'</b><span>This is an Outlook .msg file. It cannot be opened here yet — press ⬇ Download to open it in Outlook.</span></div>';}
 else file.arrayBuffer().then(b=>emlMount(el,new Uint8Array(b),file.name))
  .catch(e=>{el.innerHTML='<div class="cfvmsg dark"><b>Could not read '+esc(file.name)+'</b><span>'+esc((e&&e.message)||'The file may be damaged.')+'</span></div>'});
 ov.querySelector('[data-cfvx]').focus()}
(function(){const st=document.createElement('style');st.textContent=
 '.emlh{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:0 0 10px;background:var(--soft,#fafafa)}'
 +'.emlh-r{display:flex;gap:8px;font-size:13px;line-height:1.5}.emlh-r span{min-width:62px;color:var(--muted)}'
 +'.emlh-r b{font-weight:600;word-break:break-word}'
 +'.emlat{margin-top:10px}.emlat label{display:block;font-size:12px;color:var(--muted);margin-bottom:6px}'
 +'.cfvoffice.emlbox{padding:14px;background:#fff}';
 document.head.appendChild(st)})();
"""

# ------------------------------------------- 1. the engine, before previewAtt
one("function previewAtt(box,gid,name){", ENGINE + "function previewAtt(box,gid,name){", "previewAtt anchor")

# ----------------------------------- 2. previewAtt: .eml and .msg come first
one("  if(/^image\\//.test(mime))body.innerHTML=",
    """  if(emlIsMsg(name))body.innerHTML='<div class="empty"><b>'+esc(name)+'</b><span>This is an Outlook .msg file. It cannot be opened here yet — press ⬇ Download to open it in Outlook.</span></div>';
  else if(emlIs(name,mime))emlMount(body,u8,name);
  else if(/^image\\//.test(mime))body.innerHTML=""",
    "previewAtt branches")

# --------------------------- 3. cfView hands .eml / .msg to the mail viewer
one("function cfView(file){const url=URL.createObjectURL(file),ty=file.type||'';",
    "function cfView(file){if(emlIs(file.name,file.type)||emlIsMsg(file.name)){emlOverlay(file);return}\n const url=URL.createObjectURL(file),ty=file.type||'';",
    "cfView entry")

assert src != orig
io.open(P, "w", encoding="utf-8", newline="").write(src)
print("Patched .tmp/email.html: %+d characters" % (len(src) - len(orig)))
