/* 24 Nov 2026 - the attachment bar shows real files only, and attachments open faster.
 *
 * (A) SIGNATURE JUNK. Outlook signatures travel as attachments (image001.png, Outlook-xxxx.png,
 *     logos, social icons), and once the Drive copy was done they were listed in full, counted in
 *     "Download all (N)" and given a Preview button. One rule now decides, in one place
 *     (attSplit): a PICTURE is hidden when the mail's own body already uses it (its cid or its
 *     file name appears in the mail), or it is marked inline and under 20 KB, or it is under 20 KB
 *     and named like signature junk. Everything else - every PDF, every real photo, anything that
 *     is not a picture - always stays. Nothing is lost: "Show hidden inline images (N)" puts them
 *     back on screen. Used by the attachment bar, the 👁 preview row, the count, Download all and
 *     the file list inside a previewed .eml.
 *
 * (B) SPEED. The reading pane used to fetch the BYTES of every picture attachment the moment a
 *     mail was drawn, only to put a thumbnail on the tile - five attachments meant five fetches
 *     from Gmail before you touched anything. Now a tile shows its file icon at once and the
 *     thumbnail is fetched only when that tile is actually scrolled into view; only the FIRST
 *     attachment of the open mail is brought in quietly, and every fetched file is kept in the
 *     browser's own cache store (keyed by mailbox + message id + file name) as well as in memory,
 *     so it survives a reload and opens with no trip to Gmail at all.
 *
 *   node server/patch-att-clean-fast.js   (then: node server/mailapp-b64.js encode)
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 60));
  s = s.replace(a, b); n++;
};

/* ---------- (A) one rule, and the attachment bar built from it ---------- */
sub(
`const _attX=attHTML;
attHTML=function(m,t){const h=_attX(m,t);if(!t||t._local||!m.gid)return h;const names=[...new Set([...(m.atts||[]).filter(x=>!(/^image\\//i.test(x.mime||'')&&(x.size||0)<40000)).map(x=>x.name),...(m.files||[]).map(x=>x.name)])].filter(Boolean);
 if(!names.length)return h;return h+\`<div class="prevrow">\${names.map(n=>\`<button class="btn" data-xprev="\${esc(n)}" data-gid="\${esc(m.gid)}" data-pbox="\${esc(t.box)}" title="Open \${esc(n)} here">👁 \${esc(n.length>34?n.slice(0,31)+'…':n)}</button>\`).join('')}</div>\`};`,

`/* ================= 24 Nov 2026: real files, not signature pictures =================
   One rule for the attachment bar, the count, Download all and a previewed .eml. */
const SIG_NAME=/^(image\\d|img\\d|outlook-|ole|oledata|logo|icon|sig|signature|banner|footer|spacer|social|facebook|twitter|linkedin|insta|whats|youtube|pixel|tracker)/i;
const isImgAtt=a=>/^image\\//i.test((a&&a.mime)||'')||/\\.(png|jpe?g|gif|webp|bmp|svg|ico|tiff?)$/i.test((a&&a.name)||'');
const INL_SMALL=20*1024;
function bodyUsesAtt(m,a){
 try{const h=String((m&&(m.raw||m.html))||'');if(!h)return false;
  if(a.cid&&h.toLowerCase().indexOf(String(a.cid).toLowerCase())>=0)return true;
  const nm=String(a.name||'');if(!nm)return false;
  return h.indexOf(nm)>=0||h.indexOf(encodeURIComponent(nm))>=0}catch(e){return false}}
/* { show: the files a person means by "attachments", hide: the pictures the mail itself draws } */
function attSplit(m){
 const show=[],hide=[];
 if(!m)return{show,hide};
 const dr=(m.files||[]).filter(x=>x&&x.name);
 const list=dr.length?dr:(m.atts||[]).filter(x=>x&&x.name);
 const meta=nm=>((m.atts||[]).find(x=>x&&x.name===nm)||{});
 list.forEach(x=>{
  const a=Object.assign({},meta(x.name),x);
  const img=isImgAtt(a),small=(a.size||0)<INL_SMALL,inline=a.inline===true||!!a.cid;
  const junk=img&&(bodyUsesAtt(m,a)||(inline&&small)||(small&&SIG_NAME.test(String(a.name||''))));
  (junk?hide:show).push(x)});
 return{show,hide}}
const SHOWINL={};                                  /* gid -> the person asked to see them */
function attShown(m){const sp=attSplit(m);return SHOWINL[(m&&m.gid)||'']?sp.show.concat(sp.hide):sp.show}
const _attX=attHTML;
attHTML=function(m,t){
 const sp=attSplit(m),open=!!SHOWINL[(m&&m.gid)||''],shown=open?sp.show.concat(sp.hide):sp.show;
 if(!shown.length&&!sp.hide.length)return '';
 const chip=x=>x.link
  ?\`<a class="att" href="\${esc(x.link)}" target="_blank" rel="noopener" title="Open in Google Drive">\${ico('clip')} \${esc(x.name)} <small style="color:var(--muted)">\${fsize(x.size)} · Drive ↗</small></a>\`
  :\`<span class="att" title="\${x.big?'Too big for automatic copy — open it in Gmail':'Opens here'}">\${ico('clip')} \${esc(x.name)} <small style="color:var(--muted)">\${fsize(x.size)}\${x.big?' · in Gmail':(m.gid?'':' · saving to Drive…')}</small></span>\`;
 let h=shown.length?\`<div style="display:flex;gap:6px;flex-wrap:wrap">\${shown.map(chip).join('')}</div>\`:'';
 if(sp.hide.length)h+=\`<div class="attinl"><button type="button" class="lnk" data-\${open?'atthide':'attshow'}="\${esc((m&&m.gid)||'')}">\${open?'Hide the '+sp.hide.length+' inline picture'+(sp.hide.length>1?'s':''):'🖼 Show hidden inline images ('+sp.hide.length+')'}</button><small>pictures the mail already shows in its text (signature logos and icons)</small></div>\`;
 if(!t||t._local||!m.gid)return h;
 const names=[...new Set(shown.map(x=>x.name))].filter(Boolean);
 if(!names.length)return h;
 return h+\`<div class="prevrow">\${names.map(nm=>\`<button class="btn" data-xprev="\${esc(nm)}" data-gid="\${esc(m.gid)}" data-pbox="\${esc(t.box)}" title="Open \${esc(nm)} here without downloading it">👁 Open preview · \${esc(nm.length>34?nm.slice(0,31)+'…':nm)}</button>\`).join('')}</div>\`};
window.rzAttSplit=attSplit;window.rzAttShown=attShown;window.rzShowInl=SHOWINL;
document.addEventListener('click',e=>{
 const sh=e.target.closest&&e.target.closest('[data-attshow]'),hd=e.target.closest&&e.target.closest('[data-atthide]');
 if(!sh&&!hd)return;e.preventDefault();e.stopPropagation();
 const g=(sh||hd).getAttribute(sh?'data-attshow':'data-atthide');
 if(sh)SHOWINL[g]=true;else delete SHOWINL[g];
 if(typeof redrawRead==='function')redrawRead();else render()},true);
(function(){const st=document.createElement('style');st.textContent=
 '.attinl{margin:6px 0 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
 +'.attinl .lnk{background:none;border:0;padding:0;color:var(--blue,#0f6cbd);font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline}'
 +'.attinl small{color:var(--muted);font-size:11.5px}';
 document.head.appendChild(st)})();`
);

/* ---------- (A2) Download all counts and zips real files only ---------- */
sub(
`  function attsOf(t) {
    const out = [];
    ((t && t.msgs) || []).forEach(m => {
      ((m && m.atts) || []).forEach(a => { if (a && a.name && m.gid) out.push({ name: a.name, gid: m.gid }); });
    });
    return out;
  }`,
`  function attsOf(t) {
    /* 24 Nov 2026: real files only - the pictures the mail draws in its own text (signature
       logos, icons) are not attachments a person wants in the ZIP, and are not counted. */
    const out = [], seen = {};
    ((t && t.msgs) || []).forEach(m => {
      const list = typeof attSplit === 'function' ? attSplit(m).show : ((m && m.atts) || []);
      list.forEach(a => {
        if (!a || !a.name || !m.gid) return;
        const k = m.gid + '|' + a.name; if (seen[k]) return; seen[k] = 1;
        out.push({ name: a.name, gid: m.gid });
      });
    });
    return out;
  }`
);

/* ---------- (A3) the ⋯ / ⬇ buttons follow the same list ---------- */
sub(
`function attListOf(m){
 const f=(m.files||[]).filter(x=>x&&x.name);
 if(f.length)return f;
 return (m.atts||[]).filter(x=>x&&x.name&&!(/^image\\//i.test(x.mime||'')&&(x.size||0)<40000))}`,
`function attListOf(m){return attShown(m)}   /* 24 Nov 2026: the same real-files rule as the bar */`
);

/* ---------- (B1) the thumbnail waits until the tile is on screen ---------- */
sub(
`   if(isImg&&gid&&!el.querySelector('.olkth')){
    const k=gid+'|'+name,im=document.createElement('img');im.className='olkth';im.alt='';
    el.insertAdjacentElement('afterbegin',im);
    if(ATHUMB[k])im.src=ATHUMB[k];
    else attFetch(t.box,gid,name).then(r=>{
      if(!r||!r.b64){im.remove();return}
      ATHUMB[k]='data:'+(r.mime||'image/png')+';base64,'+r.b64;im.src=ATHUMB[k]})
     .catch(()=>{im.remove()})}`,
`   if(isImg&&gid&&!el.querySelector('.olkth')){
    const k=gid+'|'+name,im=document.createElement('img');im.className='olkth';im.alt='';
    el.insertAdjacentElement('afterbegin',im);
    if(ATHUMB[k])im.src=ATHUMB[k];
    /* 24 Nov 2026: the picture is fetched only once this tile is really on screen - drawing a
       mail no longer costs one Gmail fetch per picture before anybody has clicked anything */
    else olkThumbLater(el,im,t.box,gid,name,k)}`
);

sub(
`function olkExtras(){`,
`/* fetch a tile's thumbnail when the tile comes into view (and never for a huge file) */
const _thObs=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{
  es.forEach(en=>{if(!en.isIntersecting)return;_thObs.unobserve(en.target);const f=en.target._olkth;if(f)f()})
 },{rootMargin:'200px'}):null;
function olkThumbLater(el,im,box,gid,name,k){
 const go=()=>{attFetch(box,gid,name).then(r=>{
   if(!r||!r.b64){im.remove();return}
   ATHUMB[k]='data:'+(r.mime||'image/png')+';base64,'+r.b64;im.src=ATHUMB[k]}).catch(()=>{im.remove()})};
 if(!_thObs){go();return}
 el._olkth=go;_thObs.observe(el)}
function olkExtras(){`
);

/* ---------- (B2) only the first file of the open mail is brought in quietly ---------- */
sub(
`    if(n>=3||!a.name||(a.size||0)>2*1024*1024)return;`,
`    if(n>=1||!a.name||(a.size||0)>2*1024*1024)return;   /* 24 Nov 2026: the first one only */`
);

/* ---------- (B3) a fetched file is kept in the browser's cache store as well as in memory ---------- */
sub(
`const ATTB={};
function attBytes(box,gid,name){const k=box+'|'+gid+'|'+name;
 if(ATTB[k])return ATTB[k];
 return ATTB[k]=api('attachment',{mailbox:box,gmailId:gid,name})
  .then(r=>({u8:b64Bytes(r.b64),mime:fileMime(name,r.mime)}))
  .catch(e=>{delete ATTB[k];throw e})}`,
`const ATTB={};
/* 24 Nov 2026: a second copy in the browser's own cache store, keyed by mailbox + message id +
   file name, so an attachment opened yesterday opens today without going to Gmail at all.
   It is only a cache: anything missing or broken simply means one normal fetch. */
const ATT_CACHE='rugs-att-v1';
const attKeyURL=(box,gid,name)=>'https://rugs-att.local/'+encodeURIComponent(box)+'/'+encodeURIComponent(gid)+'/'+encodeURIComponent(name);
function attCacheGet(box,gid,name){
 try{if(!window.caches)return Promise.resolve(null);
  return caches.open(ATT_CACHE).then(c=>c.match(attKeyURL(box,gid,name)))
   .then(r=>r?r.arrayBuffer().then(b=>({u8:new Uint8Array(b),mime:fileMime(name,r.headers.get('content-type')||'')})):null)
   .catch(()=>null)}catch(e){return Promise.resolve(null)}}
function attCachePut(box,gid,name,u8,mime){
 try{if(!window.caches||!u8||u8.length>25*1024*1024)return;
  caches.open(ATT_CACHE).then(c=>c.put(attKeyURL(box,gid,name),new Response(u8,{headers:{'Content-Type':mime||'application/octet-stream'}}))).catch(()=>null)}catch(e){}}
function attBytes(box,gid,name){const k=box+'|'+gid+'|'+name;
 if(ATTB[k])return ATTB[k];
 return ATTB[k]=attCacheGet(box,gid,name).then(hit=>hit||api('attachment',{mailbox:box,gmailId:gid,name})
   .then(r=>{const u8=b64Bytes(r.b64),mime=fileMime(name,r.mime);attCachePut(box,gid,name,u8,mime);return{u8,mime}}))
  .catch(e=>{delete ATTB[k];throw e})}`
);

fs.writeFileSync(F, s);
console.log('email.html patched, ' + n + ' edits');
