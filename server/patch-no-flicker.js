/* 19 Nov 2026 - "I clicked Reply and the mail started closing and opening, closing and opening,
   for about 20 seconds". My own regression from this morning's picture change (build 2026-11-19-4).

   WHY IT HAPPENED. Pictures now arrive one by one and I wrote each one into the mail and then called
   redrawRead() - which rebuilds the whole reading pane, every mail in it and every sandboxed frame.
   With a picture landing every few hundred milliseconds that is a full rebuild up to four times a
   second: the mail visibly blanks and comes back, over and over. Reply makes it worst of all, because
   Reply quotes the whole conversation and therefore asks for the pictures of EVERY mail in it (a real
   21-mail trail has 64 of them, several seconds each) - about twenty seconds of flicker before the
   compose window opens, which is exactly what was reported.

   WHAT IT DOES NOW.
     - A picture that arrives is put into the picture that is already on the screen - the <img> tag is
       given its real src where it stands, inside the frame, without rebuilding anything. No flicker,
       and the mail does not jump back to the top. The frame is re-measured afterwards so the mail
       still grows to fit (fitFrames).
     - To make that possible the mail keeps the picture's name on the tag (data-rmcid) while it waits,
       instead of only a blank placeholder, and a picture written in the text keeps its own marker.
     - Reply / Forward wait at most 8 seconds for the pictures of the trail and then open the compose
       window; the rest keep arriving in the background. They used to wait for all of them, which on a
       long trail is a minute or more.

   Run:  node server/mailapp-b64.js decode  &&  node server/patch-no-flicker.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- 1. put an arriving picture straight into what is on screen ---------- */
edit('no more rebuilding the pane for every picture',
  " const todo=keys.filter(k=>!CIDD[k]);\n"
+ " if(!todo.length){if(cidPaint(t))redrawRead(t);return Promise.resolve()}\n"
+ " let tm=0;const soon=()=>{if(tm)return;tm=setTimeout(()=>{tm=0;if(cidPaint(t))redrawRead(t)},250)};\n"
+ " return Promise.all(todo.map(k=>cidGet(t.box,k).then(d=>{if(d)soon()})))\n"
+ "  .then(()=>{clearTimeout(tm);if(cidPaint(t))redrawRead(t)})}",

  " const todo=keys.filter(k=>!CIDD[k]);\n"
+ " /* 19 Nov 2026: cidPaint writes the picture into the mail, cidLive puts it into the copy already on\n"
+ "    the screen. Rebuilding the reading pane for every picture made the mail flicker open and shut. */\n"
+ " const draw=()=>{cidPaint(t);cidLive()};\n"
+ " if(!todo.length){draw();return Promise.resolve()}\n"
+ " let tm=0;const soon=()=>{if(tm)return;tm=setTimeout(()=>{tm=0;draw()},250)};\n"
+ " return Promise.all(todo.map(k=>cidGet(t.box,k).then(d=>{if(d)soon()})))\n"
+ "  .then(()=>{clearTimeout(tm);draw()})}");

/* ---------- 2. the picture keeps its name while it waits, so it can be filled in ---------- */
edit('keep the picture name on the tag while it loads',
  ' if(h.indexOf("rmcid:")>=0){h=h.replace(CID_SRC,(m0,a,k,b)=>a+PIXEL+b)\n'
+ '  .replace(CID_TXT,(m0,pre)=>pre+\'<span style="color:#9c948e;font-size:12px">\⏳ picture loading\…</span>\')}',

  ' if(h.indexOf("rmcid:")>=0){h=h.replace(CID_SRC,(m0,a,k,b)=>a+PIXEL+b+\' data-rmcid="\'+k+\'"\')\n'
+ '  .replace(CID_TXT,(m0,pre,k)=>pre+\'<span data-rmcid="\'+k+\'" style="color:#9c948e;font-size:12px">\⏳ picture loading\…</span>\')}');

edit('fill the picture in where it stands',
  'const PIXEL="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";',

  'const PIXEL="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";\n'
+ '/* 19 Nov 2026: a picture that has arrived is put into the mail ALREADY ON THE SCREEN - the tag that\n'
+ '   was waiting for it is given its real src where it stands (inside the sandboxed frame too), and a\n'
+ '   picture that was written in the text becomes a real <img>. Nothing is rebuilt, so the mail does not\n'
+ '   flicker and does not jump back to the top; the frame is re-measured so the mail still grows to fit. */\n'
+ 'function cidLive(){\n'
+ ' let any=false;\n'
+ ' const fill=(doc)=>{let hit=false;\n'
+ '  doc.querySelectorAll(\'img[data-rmcid],span[data-rmcid]\').forEach(el=>{\n'
+ '   const k=el.getAttribute(\'data-rmcid\'),d=k&&CIDD[k];if(!d)return;\n'
+ '   if(el.tagName===\'IMG\'){el.setAttribute(\'src\',d);el.removeAttribute(\'data-rmcid\');el.style.display=\'\';hit=true}\n'
+ '   else{const im=doc.createElement(\'img\');im.setAttribute(\'src\',d);im.alt=\'\';im.style.maxWidth=\'100%\';im.style.height=\'auto\';\n'
+ '    if(el.parentNode)el.parentNode.replaceChild(im,el);hit=true}});\n'
+ '  return hit};\n'
+ ' try{if(fill(document))any=true}catch(e){}\n'
+ ' document.querySelectorAll(\'.raw iframe\').forEach(f=>{try{const d=f.contentDocument;if(d&&fill(d))any=true}catch(e){}});\n'
+ ' if(any)try{setTimeout(fitFrames,60)}catch(e){}\n'
+ ' return any}');

/* ---------- 3. Reply / Forward do not wait for a whole trail of pictures ---------- */
edit('Reply and Forward wait at most 8 seconds for pictures',
  " if(t.full){if(!t.msgs.some(x=>/rmcid:/.test(x.raw||'')))return fn();loadCidPics(t,{all:true}).then(()=>fn());return}",
  " if(t.full){if(!t.msgs.some(x=>/rmcid:/.test(x.raw||'')))return fn();\n"
+ "  /* 19 Nov 2026: wait for the pictures of the trail, but at most 8 seconds - a long trail has dozens\n"
+ "     of them and the compose window used to sit closed for a minute. The rest keep arriving. */\n"
+ "  let went=false;const go=()=>{if(went)return;went=true;fn()};\n"
+ "  loadCidPics(t,{all:true}).then(go);setTimeout(go,8000);return}");

/* ---------- new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-6';", "const APP_BUILD='2026-11-19-7';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
