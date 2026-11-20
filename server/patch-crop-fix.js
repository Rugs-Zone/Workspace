/* 20 Nov 2026 - FIX "after cropping, the picture goes off the screen, the mail closes and the screen
   starts glitching".
   MY BUG, from this morning. The crop window was built with the app's shared dialog helper, dlg(),
   and the first thing dlg() does is  $('#layer').innerHTML = ...  - it EMPTIES the dialog layer. The
   mail you are writing lives in that same layer, so opening Crop destroyed the compose window, and
   closing the crop window (L.innerHTML='') left nothing behind: the mail, and the picture in it, were
   simply gone. The ✂ bar and the resize handles stayed on screen pointing at a picture that no longer
   existed, which is the "glitching".
   NOW:
     - the crop window is its own window (its own element on top of everything), so it never touches
       the dialog layer and the mail you are writing stays exactly as it was - behind it, untouched;
     - Esc or a click on the dark background closes it, like any other window here;
     - the ✂ bar and the handles check that the picture is still on the page before they draw, and
       take themselves off the moment it is not;
     - after a crop they only come back if the picture is really still there.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-crop-fix.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- 1. the crop window stands on its own ---------- */
edit('the crop window no longer uses the shared dialog layer',
  "function cropOpen(img){\n"
+ " const L=dlg('\\u2702 Crop the picture',\n"
+ "  '<p class=\"lead\" style=\"margin:0 0 8px\">Drag the box over the part you want to keep. Drag inside it to move it, or a corner to resize.</p>'\n"
+ "  +'<div class=\"cropwrap\" id=\"cropWrap\"><img id=\"cropImg\" alt=\"\"><div class=\"cropsel\" id=\"cropSel\">'\n"
+ "  +['nw','ne','sw','se'].map(c=>'<i data-h=\"'+c+'\" class=\"h '+c+'\"></i>').join('')+'</div></div>',\n"
+ "  '<button class=\"btn\" data-c>Cancel</button><button class=\"btn pri\" data-ok>\\u2702 Crop</button>',true);",

  "function cropOpen(img){\n"
+ " if(!img||!document.body.contains(img)){cropBarHide();return}\n"
+ " /* 20 Nov 2026: its OWN window. It used to be built with dlg(), which empties #layer - and the mail\n"
+ "    being written lives in #layer, so cropping threw the whole compose window away. */\n"
+ " const L=document.createElement('div');L.className='cropover';\n"
+ " L.innerHTML='<div class=\"cropcard\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Crop the picture\">'\n"
+ "  +'<h3>\\u2702 Crop the picture</h3>'\n"
+ "  +'<p class=\"lead\" style=\"margin:0 0 8px\">Drag the box over the part you want to keep. Drag inside it to move it, or a corner to resize.</p>'\n"
+ "  +'<div class=\"cropwrap\" id=\"cropWrap\"><img id=\"cropImg\" alt=\"\"><div class=\"cropsel\" id=\"cropSel\">'\n"
+ "  +['nw','ne','sw','se'].map(c=>'<i data-h=\"'+c+'\" class=\"h '+c+'\"></i>').join('')+'</div></div>'\n"
+ "  +'<div class=\"cropfoot\"><button type=\"button\" class=\"btn\" data-c>Cancel</button>'\n"
+ "  +'<button type=\"button\" class=\"btn pri\" data-ok>\\u2702 Crop</button></div></div>';\n"
+ " document.body.appendChild(L);\n"
+ " const close=()=>{L.remove();document.removeEventListener('keydown',esc,true)};\n"
+ " const esc=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};\n"
+ " document.addEventListener('keydown',esc,true);\n"
+ " L.addEventListener('mousedown',e=>{if(e.target===L)close()});");

/* ---------- 2. closing it puts the window away, not the mail ---------- */
edit('Cancel closes the crop window',
  " wrap.addEventListener('pointerup',stop);wrap.addEventListener('pointercancel',stop);\n"
+ " L.querySelector('[data-c]').onclick=()=>{L.innerHTML=''};",
  " wrap.addEventListener('pointerup',stop);wrap.addEventListener('pointercancel',stop);\n"
+ " L.querySelector('[data-c]').onclick=close;");

edit('and so does finishing the crop',
  "   L.innerHTML='';toast('Picture cropped');setTimeout(()=>{try{cropBarFor(img)}catch(e){}},50);",
  "   close();toast('Picture cropped');\n"
+ "   setTimeout(()=>{try{if(document.body.contains(img))cropBarFor(img)}catch(e){}},50);");

/* ---------- 3. the bar and the handles never outlive the picture ---------- */
edit('the bar lets go when the picture is gone',
  " const place=()=>{if(!CROPFOR||!CROPBAR)return;const r=CROPFOR.getBoundingClientRect();\n"
+ "  CROPBAR.style.top=Math.max(6,r.top-40)+'px';CROPBAR.style.left=Math.max(6,r.left)+'px'};",
  " const place=()=>{if(!CROPFOR||!CROPBAR)return;\n"
+ "  if(!document.body.contains(CROPFOR)){cropBarHide();return}   /* 20 Nov 2026: never hang about over nothing */\n"
+ "  const r=CROPFOR.getBoundingClientRect();\n"
+ "  CROPBAR.style.top=Math.max(6,r.top-40)+'px';CROPBAR.style.left=Math.max(6,r.left)+'px'};");

edit('the handles let go too',
  "function szPlace(){if(!SZBOX||!CROPFOR)return;const r=CROPFOR.getBoundingClientRect();",
  "function szPlace(){if(!SZBOX||!CROPFOR)return;\n"
+ " if(!document.body.contains(CROPFOR)){szHide();return}   /* 20 Nov 2026 */\n"
+ " const r=CROPFOR.getBoundingClientRect();");

edit('and the bar only opens on a picture that is really there',
  "function cropBarFor(img){\n cropBarHide();CROPFOR=img;",
  "function cropBarFor(img){\n cropBarHide();if(!img||!document.body.contains(img))return;CROPFOR=img;");

/* ---------- 4. how the new window looks ---------- */
edit('the look of the crop window',
  " '.cropwrap{position:relative;display:inline-block;max-width:100%;touch-action:none;user-select:none;line-height:0}',",
  " '.cropover{position:fixed;inset:0;z-index:10090;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}',\n"
+ " '.cropcard{background:var(--pane);color:var(--fg);border-radius:14px;box-shadow:var(--shadow);padding:16px;max-width:min(900px,96vw);max-height:92vh;overflow:auto}',\n"
+ " '.cropcard h3{margin:0 0 6px;font-size:16px}',\n"
+ " '.cropfoot{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}',\n"
+ " '.cropwrap{position:relative;display:inline-block;max-width:100%;touch-action:none;user-select:none;line-height:0}',");

edit('APP_BUILD', "const APP_BUILD='2026-11-20-6';", "const APP_BUILD='2026-11-20-7';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
