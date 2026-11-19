/* 19 Nov 2026 - "the mail is still loading the full mail preview" + "email signature is not showing".
   Checked against the live server first (admin session, deleted afterwards) and the Supabase logs:

   A. THE SIGNATURE. Since 18 Nov a pasted picture arrives as a small link  rmcid:<gmail id>/<cid>
      and the app fetches it with the inlineImg action. A plain-text mail writes its pictures as
      [cid:image001.jpg@01DD75DD.F9469E80] - in square brackets - and the app's key regex
      ([^"'\s)>]+) happily swallowed the closing bracket, so it asked Gmail for
      "image001.jpg@01DD75DD.F9469E80]" and got 404 Picture not found. Proved on the live server:
      with the bracket -> 404 in 1.0 s, the same picture without it -> 200 with real JPEG data.
      In today's logs that is EVERY failure: 1,198 of 1,198 "inlineImg miss" lines contain a "]".
      Fixed by making the key regex stop at characters a cid cannot contain, and a picture that
      sits in the text as [cid:...] now becomes a real <img> instead of leaving that text on screen.

   B. THE WAIT. loadCidPics fetched the pictures of EVERY mail in the conversation (a 21-mail trail
      has 143 of them, about 1.7 s each) two at a time, and only wrote them into the mail after the
      LAST one - so on a long trail nothing appeared for about two minutes. Now:
        - only the mails you can actually see are fetched (the open ones; the rest when you expand
          them), newest first, so the signature in front of you comes first;
        - each picture is written into the mail as soon as it arrives (redraw at most every 250 ms);
        - three at a time (two on slow PCs) through one queue shared by the whole app;
        - a picture that fails is simply tried again the next time the mail is opened.
      Reply / Forward still wait for every picture of the mail they quote (loadCidPics(t,{all:true})).

   C. THE BAR. "Loading the full mail..." was drawn the moment a mail was opened, and opening a mail
      really does take 1.9 s (5 mails) to 4.1 s (21 mails) on the live server, so everyone saw that
      yellow box on every single mail. It now appears only if the mail is still coming after 1.2 s.

   D. SIGN-IN. The preload opened 25 conversations AND fetched all their pictures, which is hundreds
      of Gmail requests at the exact moment people start clicking. It now loads 10 (6 on a slow PC),
      two at a time, and no pictures - those are fetched when a mail is really opened.

   Run:  node server/mailapp-b64.js decode  &&  node server/patch-pictures-fast.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- A + B: the picture loader ---------- */
edit('rewrite loadCidPics',
  "const CIDP={},CID_RX=/rmcid:[A-Za-z0-9]+\\/[^\"'\\s)>]+/g;\n"
+ "function loadCidPics(t){\n"
+ " if(!t)return Promise.resolve();const L=ld(t);if(L.pics)return L.pics;\n"
+ " const ms=t.msgs.filter(x=>/rmcid:/.test(x.raw||''));if(!ms.length)return Promise.resolve();\n"
+ " const keys=[...new Set(ms.flatMap(x=>x.raw.match(CID_RX)||[]))];\n"
+ " const get=k=>CIDP[k]||(CIDP[k]=(()=>{const m=k.match(/^rmcid:([^/]+)\\/(.+)$/);let cid='';try{cid=decodeURIComponent(m[2])}catch(e){cid=m[2]}\n"
+ "  return _tmo(api('inlineImg',{mailbox:t.box,gmailId:m[1],cid}),30000,'timeout').then(r=>r&&r.data||'')})().catch(()=>{delete CIDP[k];return ''}));\n"
+ " let i=0;const work=async()=>{while(i<keys.length)await get(keys[i++])};\n"
+ " L.pics=Promise.all([work(),work()]).then(async()=>{\n"
+ "  const map={};let miss=0;for(const k of keys){map[k]=await get(k);if(!map[k])miss++}\n"
+ "  ms.forEach(x=>{x.raw=x.raw.replace(CID_RX,k=>map[k]||k);if(x.gid&&RAWC[x.gid])RAWC[x.gid].raw=x.raw;try{QC.delete(x)}catch(e){}});\n"
+ "  if(miss)setTimeout(()=>{L.pics=null},0);       // a picture that failed is tried again the next time the mail is opened\n"
+ "  redrawRead(t)});\n"
+ " return L.pics}",

  "/* 19 Nov 2026: the key must stop where a cid cannot go on. A plain-text mail writes its pictures\n"
+ "   as [cid:image001.jpg@01DD75DD.F9469E80] and the old pattern ([^\"'\\s)>]+) kept the closing\n"
+ "   bracket, so Gmail was asked for a picture called \"...F9469E80]\" and answered 404 - which is\n"
+ "   why logos and signatures stayed empty (1,198 of 1,198 misses in today's log had a \"]\"). */\n"
+ "const CIDK=\"rmcid:[A-Za-z0-9]+\\\\/[A-Za-z0-9._~%@+=:$&-]+\";\n"
+ "const CIDP={},CIDD={},CID_RX=new RegExp(CIDK,'g'),CID_Q=[];let CID_RUN=0;\n"
+ "const cidPump=()=>{const par=window.SLOW_PC?2:3;\n"
+ " while(CID_RUN<par&&CID_Q.length){const job=CID_Q.shift();CID_RUN++;job().then(()=>{CID_RUN--;cidPump()},()=>{CID_RUN--;cidPump()})}};\n"
+ "function cidGet(box,k){\n"
+ " if(CIDD[k])return Promise.resolve(CIDD[k]);\n"
+ " if(CIDP[k])return CIDP[k];\n"
+ " return CIDP[k]=new Promise(res=>{CID_Q.push(()=>{\n"
+ "  const m=k.match(/^rmcid:([^/]+)\\/(.+)$/);if(!m){res('');return Promise.resolve()}\n"
+ "  let cid='';try{cid=decodeURIComponent(m[2])}catch(e){cid=m[2]}\n"
+ "  return _tmo(api('inlineImg',{mailbox:box,gmailId:m[1],cid}),30000,'timeout')\n"
+ "   .then(r=>{const d=(r&&r.data)||'';if(d)CIDD[k]=d;res(d)})\n"
+ "   .catch(()=>{delete CIDP[k];res('')})});cidPump()})}\n"
+ "/* write the pictures that have arrived into the mail. A picture used as src=\"...\" simply becomes\n"
+ "   the picture; one sitting in the text as [cid:...] becomes a real <img> (that is the signature\n"
+ "   of a plain-text mail), instead of leaving \"[rmcid:...]\" on screen. */\n"
+ "const CID_SRC=new RegExp('(src\\\\s*=\\\\s*[\"\\'])('+CIDK+')([\"\\'])','g');\n"
+ "const CID_TXT=new RegExp('([^=\"\\'\\\\w]|^)\\\\[?('+CIDK+')\\\\]?','g');\n"
+ "function cidPaint(t){let any=false;\n"
+ " (t.msgs||[]).forEach(x=>{const h=x.raw||'';if(h.indexOf('rmcid:')<0)return;\n"
+ "  let nh=h.replace(CID_SRC,(m0,a,k,b)=>CIDD[k]?a+CIDD[k]+b:m0);\n"
+ "  nh=nh.replace(CID_TXT,(m0,pre,k)=>CIDD[k]?pre+'<img src=\"'+CIDD[k]+'\" alt=\"\" style=\"max-width:100%;height:auto\">':m0);\n"
+ "  if(nh!==h){x.raw=nh;any=true;if(x.gid&&RAWC[x.gid])RAWC[x.gid].raw=nh;try{QC.delete(x)}catch(e){}}});\n"
+ " return any}\n"
+ "/* By default only the mails you can SEE are fetched (the open ones - a long trail keeps the older\n"
+ "   mails folded, and their pictures are fetched when you expand them), newest first. Reply and\n"
+ "   Forward pass {all:true} because they quote the whole trail. */\n"
+ "function loadCidPics(t,o){\n"
+ " o=o||{};if(!t||!t.msgs)return Promise.resolve();\n"
+ " const open=openMsgs[t.id],last=t.msgs.length-1;\n"
+ " const pick=t.msgs.filter((x,i)=>String(x.raw||'').indexOf('rmcid:')>=0&&(o.all||!open||open.has(i)||i===last));\n"
+ " if(!pick.length)return Promise.resolve();\n"
+ " const keys=[...new Set([...pick].reverse().flatMap(x=>x.raw.match(CID_RX)||[]))];\n"
+ " const todo=keys.filter(k=>!CIDD[k]);\n"
+ " if(!todo.length){if(cidPaint(t))redrawRead(t);return Promise.resolve()}\n"
+ " let tm=0;const soon=()=>{if(tm)return;tm=setTimeout(()=>{tm=0;if(cidPaint(t))redrawRead(t)},250)};\n"
+ " return Promise.all(todo.map(k=>cidGet(t.box,k).then(d=>{if(d)soon()})))\n"
+ "  .then(()=>{clearTimeout(tm);if(cidPaint(t))redrawRead(t)})}");

/* ---------- B: expanding an older mail fetches its pictures ---------- */
edit('expand all also loads those pictures',
  "if(d.mall){const t=T_(openId);if(t){openMsgs[t.id]=new Set(d.mall==='open'?t.msgs.map((_,i)=>i):[t.msgs.length-1]);renderRead()}return}",
  "if(d.mall){const t=T_(openId);if(t){openMsgs[t.id]=new Set(d.mall==='open'?t.msgs.map((_,i)=>i):[t.msgs.length-1]);renderRead();try{loadCidPics(t)}catch(e){}}return}");

edit('opening one older mail loads its pictures',
  "const set=openMsgs[t.id]||(openMsgs[t.id]=new Set());const i=+d.mtog;set.has(i)?set.delete(i):set.add(i);renderRead();return}",
  "const set=openMsgs[t.id]||(openMsgs[t.id]=new Set());const i=+d.mtog;set.has(i)?set.delete(i):set.add(i);renderRead();try{loadCidPics(t)}catch(e){}return}");

/* ---------- B: Reply / Forward still need the whole trail ---------- */
edit('Reply and Forward wait for every picture they quote',
  " if(t.full){if(!t.msgs.some(x=>/rmcid:/.test(x.raw||'')))return fn();loadCidPics(t).then(()=>fn());return}",
  " if(t.full){if(!t.msgs.some(x=>/rmcid:/.test(x.raw||'')))return fn();loadCidPics(t,{all:true}).then(()=>fn());return}");

/* ---------- C: the "Loading the full mail..." bar only when it is really slow ---------- */
edit('loading bar waits 1.2 seconds',
  " L.err='';L.saved=false;L.busy=true;\n redrawRead(t);",
  " L.err='';L.saved=false;L.busy=true;L.slow=false;\n"
+ " /* 19 Nov 2026: opening a mail takes 2-4 seconds on the live server, so the bar used to flash up\n"
+ "    on every single mail. Show it only if the mail is still coming after 1.2 seconds. */\n"
+ " clearTimeout(L.slowT);L.slowT=setTimeout(()=>{if(L.busy){L.slow=true;redrawRead(t)}},1200);\n"
+ " redrawRead(t);");

edit('clear the slow timer when the mail arrives',
  " L.p=run().then(ok=>{L.busy=false;L.p=null;if(!ok)L.gave=true;redrawRead(t);loadCidPics(t);return ok})\n"
+ "  .catch(e=>{L.busy=false;L.p=null;L.gave=true;L.err=e.message||'Could not load the mail';redrawRead(t);return false});",
  " L.p=run().then(ok=>{L.busy=false;L.slow=false;clearTimeout(L.slowT);L.p=null;if(!ok)L.gave=true;redrawRead(t);if(!o.nopics)loadCidPics(t);return ok})\n"
+ "  .catch(e=>{L.busy=false;L.slow=false;clearTimeout(L.slowT);L.p=null;L.gave=true;L.err=e.message||'Could not load the mail';redrawRead(t);return false});");

edit('the bar itself',
  "  return L.err\n"
+ "   ?`<div class=\"promise late\"><span>${ico('clock')}</span><b>Only the short preview is shown<br><span class=\"sub\">${esc(L.err)}</span></b><button class=\"btn\" data-fullretry=\"${t.id}\">\\u21bb Retry</button></div>`\n"
+ "   :`<div class=\"promise\"><span>${ico('clock')}</span><b>Loading the full mail\\u2026<br><span class=\"sub\">The short preview is shown until the original arrives from Gmail.</span></b></div>`})()}",

  "  if(L.err)return `<div class=\"promise late\"><span>${ico('clock')}</span><b>Only the short preview is shown<br><span class=\"sub\">${esc(L.err)}</span></b><button class=\"btn\" data-fullretry=\"${t.id}\">\\u21bb Retry</button></div>`;\n"
+ "  /* 19 Nov 2026: only when it is really taking a while (see liveOpen) */\n"
+ "  return L.slow?`<div class=\"promise\"><span>${ico('clock')}</span><b>Loading the full mail\\u2026<br><span class=\"sub\">The short preview is shown until the original arrives from Gmail.</span></b></div>`:''})()}");

/* ---------- D: a lighter sign-in preload ---------- */
edit('smaller preload, and no pictures during sign-in',
  'const PRELOAD_MAX_MS=30000,PRELOAD_N=window.SLOW_PC?10:25,PRELOAD_PAR=window.SLOW_PC?2:3,PRELOAD_PICS=window.SLOW_PC?20:80;',
  'const PRELOAD_MAX_MS=30000,PRELOAD_N=window.SLOW_PC?6:10,PRELOAD_PAR=2,PRELOAD_PICS=window.SLOW_PC?20:60;');

edit('preload asks for the text only',
  '   const ok=await liveOpen(t).catch(()=>false);',
  '   const ok=await liveOpen(t,{nopics:true}).catch(()=>false);   // 19 Nov 2026: pasted pictures are fetched when the mail is really opened');

/* ---------- new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-3';", "const APP_BUILD='2026-11-19-4';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');

/* ---------- follow-up, same change (measured on the live server afterwards) ----------
   The "signature" pictures in real mail are big pasted screenshots: 269 KB, 1.6 MB and 1.2 MB in
   the conversation used for testing, taking 2.8 s, 7.4 s and 7.5 s through the function. So:
     - the per-picture limit went from 30 s to 60 s (a 1.6 MB picture was being dropped at 30 s);
     - while a picture is on its way the mail now shows a blank space instead of the browser's
       broken-image icon (which is what "the signature is not showing" looked like), and the text
       form [cid:...] shows "picture loading..." instead of raw [rmcid:...] text.
   Both were applied with these two edits:
     edit('picture timeout 60 s', "...,30000,'timeout')", "...,60000,'timeout')")
     edit('quiet placeholder while a picture is on its way', 'function picHTML...', '...wrapper...')
*/
