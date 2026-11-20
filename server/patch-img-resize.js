/* 20 Nov 2026 - "image resize in copy-paste with the mouse, so they can control the size."
   Clicking a picture in the mail you are writing already showed the ✂ Crop / ⤢ Smaller / ✕ Remove bar.
   Now it also puts eight handles round the picture - four corners and four sides - and you drag any of
   them to make the picture the size you want, with the shape kept (a corner or a side both scale the
   whole picture). While you drag, the bar shows the size in pixels. Let go and the mail keeps it.
   The handles follow the picture when the window is scrolled or resized, and go away when you click
   somewhere else. Touch screens work the same way (pointer events).
   Nothing is uploaded and the picture itself is not re-saved - only how wide it is shown - so Crop
   still cuts from the original quality.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-img-resize.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- the handles ---------- */
edit('drag handles round a picture',
  "function cropOpen(img){",

  "/* 20 Nov 2026: eight handles round the picture you clicked - drag any of them to set its size.\n"
+ "   The shape is kept; only the width shown in the mail changes, so Crop still has the full quality. */\n"
+ "let SZBOX=null;\n"
+ "function szHide(){if(SZBOX){SZBOX.remove();SZBOX=null}}\n"
+ "function szPlace(){if(!SZBOX||!CROPFOR)return;const r=CROPFOR.getBoundingClientRect();\n"
+ " SZBOX.style.left=r.left+'px';SZBOX.style.top=r.top+'px';SZBOX.style.width=r.width+'px';SZBOX.style.height=r.height+'px'}\n"
+ "function szFor(img){\n"
+ " szHide();if(!img)return;\n"
+ " const b=document.createElement('div');b.className='imgsz';\n"
+ " b.innerHTML=['nw','n','ne','e','se','s','sw','w'].map(c=>'<i data-sz=\"'+c+'\" class=\"'+c+'\"></i>').join('')\n"
+ "  +'<span class=\"szlbl\"></span>';\n"
+ " document.body.appendChild(b);SZBOX=b;szPlace();\n"
+ " const lbl=b.querySelector('.szlbl');\n"
+ " const show=()=>{const r=img.getBoundingClientRect();lbl.textContent=Math.round(r.width)+' \\u00d7 '+Math.round(r.height)};\n"
+ " show();\n"
+ " b.addEventListener('pointerdown',e=>{const h=e.target.closest('[data-sz]');if(!h)return;\n"
+ "  e.preventDefault();e.stopPropagation();\n"
+ "  const c=h.getAttribute('data-sz'),r0=img.getBoundingClientRect(),x0=e.clientX,y0=e.clientY;\n"
+ "  const w0=r0.width,ratio=r0.height/(r0.width||1);\n"
+ "  const grow=(dx,dy)=>{\n"
+ "   let d=0;\n"
+ "   if(c==='e'||c==='ne'||c==='se')d=dx; else if(c==='w'||c==='nw'||c==='sw')d=-dx;\n"
+ "   else if(c==='s')d=dy/(ratio||1); else d=-dy/(ratio||1);\n"
+ "   return Math.max(40,Math.min(2000,Math.round(w0+d)))};\n"
+ "  const move=ev=>{const w=grow(ev.clientX-x0,ev.clientY-y0);\n"
+ "   img.style.width=w+'px';img.style.height='auto';img.setAttribute('width',w);img.removeAttribute('height');\n"
+ "   szPlace();if(CROPBAR&&CROPBAR._place)CROPBAR._place();show()};\n"
+ "  const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);\n"
+ "   try{if(typeof cfDirty==='function')cfDirty()}catch(x){}};\n"
+ "  document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)});\n"
+ "}\n"
+ "function cropOpen(img){");

/* ---------- show them with the bar, hide them with it ---------- */
edit('the handles come up with the bar',
  " b.querySelector('[data-crop]').onclick=()=>{const i=CROPFOR;cropBarHide();if(i)cropOpen(i)};\n}",
  " b.querySelector('[data-crop]').onclick=()=>{const i=CROPFOR;cropBarHide();if(i)cropOpen(i)};\n"
+ " szFor(img);                                   // 20 Nov 2026: and the drag handles round it\n}");

edit('they go away with it',
  "function cropBarHide(){if(CROPBAR){CROPBAR.remove();CROPBAR=null}CROPFOR=null}",
  "function cropBarHide(){if(CROPBAR){CROPBAR.remove();CROPBAR=null}try{szHide()}catch(e){}CROPFOR=null}");

edit('they follow the picture',
  "addEventListener('scroll',()=>{if(CROPBAR&&CROPBAR._place)CROPBAR._place()},true);\n"
+ "addEventListener('resize',()=>{if(CROPBAR&&CROPBAR._place)CROPBAR._place()});",
  "addEventListener('scroll',()=>{if(CROPBAR&&CROPBAR._place)CROPBAR._place();try{szPlace()}catch(e){}},true);\n"
+ "addEventListener('resize',()=>{if(CROPBAR&&CROPBAR._place)CROPBAR._place();try{szPlace()}catch(e){}});");

/* ---------- and after a crop, the handles fit the new picture ---------- */
edit('after cropping, the handles fit the new size',
  "   L.innerHTML='';toast('Picture cropped');",
  "   L.innerHTML='';toast('Picture cropped');setTimeout(()=>{try{cropBarFor(img)}catch(e){}},50);");

/* ---------- how they look ---------- */
edit('the look of the handles',
  " '.cropbar{position:fixed;z-index:10080;",
  " '.imgsz{position:fixed;z-index:10075;pointer-events:none;outline:1px dashed color-mix(in srgb,var(--brand) 70%,transparent)}',\n"
+ " '.imgsz i{position:absolute;width:12px;height:12px;background:#fff;border:1.5px solid var(--brand);border-radius:3px;pointer-events:auto;touch-action:none}',\n"
+ " '.imgsz .nw{left:-7px;top:-7px;cursor:nwse-resize}.imgsz .ne{right:-7px;top:-7px;cursor:nesw-resize}',\n"
+ " '.imgsz .sw{left:-7px;bottom:-7px;cursor:nesw-resize}.imgsz .se{right:-7px;bottom:-7px;cursor:nwse-resize}',\n"
+ " '.imgsz .n{left:50%;top:-7px;margin-left:-6px;cursor:ns-resize}.imgsz .s{left:50%;bottom:-7px;margin-left:-6px;cursor:ns-resize}',\n"
+ " '.imgsz .w{left:-7px;top:50%;margin-top:-6px;cursor:ew-resize}.imgsz .e{right:-7px;top:50%;margin-top:-6px;cursor:ew-resize}',\n"
+ " '.imgsz .szlbl{position:absolute;right:0;bottom:-22px;background:var(--ink);color:#fff;font-size:11px;padding:1px 6px;border-radius:6px;white-space:nowrap}',\n"
+ " '.cropbar{position:fixed;z-index:10080;");

edit('APP_BUILD', "const APP_BUILD='2026-11-20-4';", "const APP_BUILD='2026-11-20-5';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
