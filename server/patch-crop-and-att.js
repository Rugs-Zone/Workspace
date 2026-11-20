/* 20 Nov 2026 - three things asked for:
   (1) "in a team, an executive's Sent shows only his own sent mail, a manager's shows all" - this was
       already built on 17 Nov (sentSeen): Admin / Manager / Lead / CRM see everything the mailbox sent,
       everybody else only what they sent themselves. Nothing to change; it is covered by a test now.
   (2) "if I copy and paste an image into a new mail, give an option to crop it."
       Clicking a picture in the mail you are writing now shows a small bar over it: ✂ Crop, ⤢ Smaller,
       ✕ Remove. Crop opens the picture with a box you drag over the part you want (drag inside to move
       it, the four corners to resize, or drag on the picture to start again), then Crop cuts it. The
       picture in the mail is replaced by the cut-out - no upload, it is done in the browser.
   (3) "let me see the attached documents faster."
       - every attachment is remembered for the session the first time it is fetched (ATTB), so opening
         it again - or opening it in the other viewer - is instant instead of another trip to Gmail;
       - when a mail is opened, its small attachments (up to 2 MB, at most 3) are fetched quietly in the
         background through the same gentle queue the pictures use, so the FIRST click is instant too;
       - the 2.0 viewer (mail-v2.js) uses the same memory, so the two share one copy.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-crop-and-att.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ================= (3) attachments: fetch once, keep for the session ================= */
edit('remember an attachment once it has been fetched',
  'function previewAtt(box,gid,name){',

  "/* 20 Nov 2026: one copy of each attachment per session. previewAtt, the 2.0 viewer and the quiet\n"
+ "   prefetch below all come through here, so a file is fetched from Gmail once and then opens at once. */\n"
+ "const ATTB={};\n"
+ "function attBytes(box,gid,name){const k=box+'|'+gid+'|'+name;\n"
+ " if(ATTB[k])return ATTB[k];\n"
+ " return ATTB[k]=api('attachment',{mailbox:box,gmailId:gid,name})\n"
+ "  .then(r=>({u8:b64Bytes(r.b64),mime:fileMime(name,r.mime)}))\n"
+ "  .catch(e=>{delete ATTB[k];throw e})}\n"
+ "window.rzAttBytes=attBytes;                       // mail-v2.js shares the same memory\n"
+ "/* when a mail is opened, bring its small files in quietly so the first click is instant too */\n"
+ "function attPrefetch(t){\n"
+ " try{\n"
+ "  if(!t||!t.msgs)return;\n"
+ "  const open=openMsgs[t.id],last=t.msgs.length-1;let n=0;\n"
+ "  t.msgs.forEach((m,i)=>{\n"
+ "   if(!(open?open.has(i):i===last)||!m.gid)return;\n"
+ "   (m.atts||[]).forEach(a=>{\n"
+ "    if(n>=3||!a.name||(a.size||0)>2*1024*1024)return;\n"
+ "    const k=t.box+'|'+m.gid+'|'+a.name;if(ATTB[k])return;\n"
+ "    n++;CID_Q.push(()=>attBytes(t.box,m.gid,a.name).catch(()=>{}));\n"
+ "   })});\n"
+ "  if(n)cidPump();\n"
+ " }catch(e){}}\n"
+ "function previewAtt(box,gid,name){");

edit('the preview uses that memory',
  " api('attachment',{mailbox:box,gmailId:gid,name}).then(r=>{const u8=b64Bytes(r.b64);const mime=fileMime(name,r.mime),url=URL.createObjectURL(new Blob([u8],{type:mime}));",
  " attBytes(box,gid,name).then(r=>{const u8=r.u8;const mime=r.mime,url=URL.createObjectURL(new Blob([u8],{type:mime}));");

edit('opening a mail starts bringing its files in',
  "  .then(()=>{clearTimeout(tm);draw()})}",
  "   .then(()=>{clearTimeout(tm);draw()})}\n"
+ "const _lcpAtt=loadCidPics;loadCidPics=function(t,o){try{attPrefetch(t)}catch(e){}return _lcpAtt.apply(this,arguments)};");

/* ================= (2) crop a picture in the mail you are writing ================= */
edit('crop tool',
  "/* ================= 19 Nov 2026: Outlook-style status bar along the bottom =================",

  "/* ================= 20 Nov 2026: crop a picture you pasted into a mail =================\n"
+ "   Click a picture in the mail you are writing and a small bar appears over it: ✂ Crop, ⤢ Smaller,\n"
+ "   ✕ Remove. Crop shows the picture with a box over it - drag inside the box to move it, the corners\n"
+ "   to resize, or drag on the picture to draw a new one - and cuts the picture down to it. Everything\n"
+ "   happens in the browser; nothing is uploaded, and the mail keeps the cut-out in place of the old\n"
+ "   picture. A big cut-out is saved as a JPEG so the mail does not grow out of hand. */\n"
+ "let CROPBAR=null,CROPFOR=null;\n"
+ "function cropBarHide(){if(CROPBAR){CROPBAR.remove();CROPBAR=null}CROPFOR=null}\n"
+ "function cropBarFor(img){\n"
+ " cropBarHide();CROPFOR=img;\n"
+ " const b=document.createElement('div');b.className='cropbar';\n"
+ " b.innerHTML='<button type=\"button\" class=\"btn\" data-crop>\\u2702 Crop</button>'\n"
+ "  +'<button type=\"button\" class=\"btn\" data-smaller>\\u2922 Smaller</button>'\n"
+ "  +'<button type=\"button\" class=\"btn\" data-cropdel>\\u2715 Remove</button>';\n"
+ " document.body.appendChild(b);CROPBAR=b;\n"
+ " const place=()=>{if(!CROPFOR||!CROPBAR)return;const r=CROPFOR.getBoundingClientRect();\n"
+ "  CROPBAR.style.top=Math.max(6,r.top-40)+'px';CROPBAR.style.left=Math.max(6,r.left)+'px'};\n"
+ " place();b._place=place;\n"
+ " b.querySelector('[data-cropdel]').onclick=()=>{const i=CROPFOR;cropBarHide();if(i)i.remove()};\n"
+ " b.querySelector('[data-smaller]').onclick=()=>{const i=CROPFOR;if(!i)return;\n"
+ "  const w=Math.round((i.getBoundingClientRect().width||i.naturalWidth||400)*0.75);\n"
+ "  i.setAttribute('width',w);i.style.width=w+'px';i.style.height='auto';place()};\n"
+ " b.querySelector('[data-crop]').onclick=()=>{const i=CROPFOR;cropBarHide();if(i)cropOpen(i)};\n"
+ "}\n"
+ "function cropOpen(img){\n"
+ " const L=dlg('\\u2702 Crop the picture',\n"
+ "  '<p class=\"lead\" style=\"margin:0 0 8px\">Drag the box over the part you want to keep. Drag inside it to move it, or a corner to resize.</p>'\n"
+ "  +'<div class=\"cropwrap\" id=\"cropWrap\"><img id=\"cropImg\" alt=\"\"><div class=\"cropsel\" id=\"cropSel\">'\n"
+ "  +['nw','ne','sw','se'].map(c=>'<i data-h=\"'+c+'\" class=\"h '+c+'\"></i>').join('')+'</div></div>',\n"
+ "  '<button class=\"btn\" data-c>Cancel</button><button class=\"btn pri\" data-ok>\\u2702 Crop</button>',true);\n"
+ " const im=L.querySelector('#cropImg'),wrap=L.querySelector('#cropWrap'),sel=L.querySelector('#cropSel');\n"
+ " let box={x:0,y:0,w:0,h:0};\n"
+ " const draw=()=>{sel.style.left=box.x+'px';sel.style.top=box.y+'px';sel.style.width=box.w+'px';sel.style.height=box.h+'px'};\n"
+ " const clamp=()=>{const W=im.clientWidth,H=im.clientHeight;\n"
+ "  box.w=Math.max(16,Math.min(box.w,W));box.h=Math.max(16,Math.min(box.h,H));\n"
+ "  box.x=Math.max(0,Math.min(box.x,W-box.w));box.y=Math.max(0,Math.min(box.y,H-box.h))};\n"
+ " im.onload=()=>{box={x:im.clientWidth*0.1,y:im.clientHeight*0.1,w:im.clientWidth*0.8,h:im.clientHeight*0.8};clamp();draw()};\n"
+ " im.src=img.currentSrc||img.src;\n"
+ " let mode='',sx=0,sy=0,s0=null;\n"
+ " const at=e=>{const r=im.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};\n"
+ " wrap.addEventListener('pointerdown',e=>{const h=e.target.closest('[data-h]');const p=at(e);\n"
+ "  s0={...box};sx=p.x;sy=p.y;\n"
+ "  if(h){mode='h:'+h.getAttribute('data-h')}\n"
+ "  else if(e.target===sel){mode='move'}\n"
+ "  else{mode='new';box={x:p.x,y:p.y,w:0,h:0};draw()}\n"
+ "  wrap.setPointerCapture(e.pointerId);e.preventDefault()});\n"
+ " wrap.addEventListener('pointermove',e=>{if(!mode)return;const p=at(e),dx=p.x-sx,dy=p.y-sy;\n"
+ "  if(mode==='move'){box.x=s0.x+dx;box.y=s0.y+dy}\n"
+ "  else if(mode==='new'){box.x=Math.min(sx,p.x);box.y=Math.min(sy,p.y);box.w=Math.abs(dx);box.h=Math.abs(dy)}\n"
+ "  else{const c=mode.slice(2);\n"
+ "   if(c.indexOf('n')>=0){box.y=s0.y+dy;box.h=s0.h-dy}else{box.h=s0.h+dy}\n"
+ "   if(c.indexOf('w')>=0){box.x=s0.x+dx;box.w=s0.w-dx}else{box.w=s0.w+dx}}\n"
+ "  clamp();draw()});\n"
+ " const stop=()=>{mode=''};\n"
+ " wrap.addEventListener('pointerup',stop);wrap.addEventListener('pointercancel',stop);\n"
+ " L.querySelector('[data-c]').onclick=()=>{L.innerHTML=''};\n"
+ " L.querySelector('[data-ok]').onclick=()=>{\n"
+ "  try{\n"
+ "   const k=(im.naturalWidth||1)/(im.clientWidth||1);\n"
+ "   const cw=Math.max(1,Math.round(box.w*k)),ch=Math.max(1,Math.round(box.h*k));\n"
+ "   const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;\n"
+ "   cv.getContext('2d').drawImage(im,Math.round(box.x*k),Math.round(box.y*k),cw,ch,0,0,cw,ch);\n"
+ "   const src=String(img.getAttribute('src')||'');\n"
+ "   let out=/^data:image\\/png/i.test(src)?cv.toDataURL('image/png'):cv.toDataURL('image/jpeg',0.92);\n"
+ "   if(out.length>1500000)out=cv.toDataURL('image/jpeg',0.85);   // a big cut-out should not bloat the mail\n"
+ "   img.setAttribute('src',out);img.removeAttribute('height');\n"
+ "   const shown=Math.min(cw,640);img.setAttribute('width',shown);img.style.width=shown+'px';img.style.height='auto';\n"
+ "   L.innerHTML='';toast('Picture cropped');\n"
+ "  }catch(e){toast('Could not crop this picture: '+(e.message||e))}};\n"
+ "}\n"
+ "document.addEventListener('click',e=>{\n"
+ " const img=e.target.closest&&e.target.closest('#cb img, .dlg [contenteditable] img');\n"
+ " if(img&&img.closest('[contenteditable]')){cropBarFor(img);return}\n"
+ " if(!e.target.closest('.cropbar'))cropBarHide();\n"
+ "},true);\n"
+ "addEventListener('scroll',()=>{if(CROPBAR&&CROPBAR._place)CROPBAR._place()},true);\n"
+ "addEventListener('resize',()=>{if(CROPBAR&&CROPBAR._place)CROPBAR._place()});\n"
+ "(function(){const st=document.createElement('style');st.textContent=[\n"
+ " '.cropbar{position:fixed;z-index:10080;display:flex;gap:6px;background:var(--pane);border:1px solid var(--line);border-radius:10px;padding:5px 6px;box-shadow:var(--shadow)}',\n"
+ " '.cropbar .btn{padding:4px 9px;font-size:12.5px}',\n"
+ " '.cropwrap{position:relative;display:inline-block;max-width:100%;touch-action:none;user-select:none;line-height:0}',\n"
+ " '.cropwrap img{max-width:100%;max-height:60vh;display:block;-webkit-user-drag:none}',\n"
+ " '.cropsel{position:absolute;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.45);cursor:move;box-sizing:border-box}',\n"
+ " '.cropsel .h{position:absolute;width:14px;height:14px;background:#fff;border:1px solid #888;border-radius:3px}',\n"
+ " '.cropsel .nw{left:-8px;top:-8px;cursor:nwse-resize}.cropsel .ne{right:-8px;top:-8px;cursor:nesw-resize}',\n"
+ " '.cropsel .sw{left:-8px;bottom:-8px;cursor:nesw-resize}.cropsel .se{right:-8px;bottom:-8px;cursor:nwse-resize}'\n"
+ "].join('\\n');document.head.appendChild(st)})();\n"
+ "/* ================= 19 Nov 2026: Outlook-style status bar along the bottom =================");

/* ---------- new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-20-1';", "const APP_BUILD='2026-11-20-2';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
