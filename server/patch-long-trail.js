/* 19 Nov 2026 - "a 72-mail trail takes far longer than expected". It was not slow, it was BROKEN:
   measured on the live server, a 49-mail conversation answered HTTP 546 after 7.2 s and a 46-mail one
   after 7.7 s ("CPU Time exceeded" in the function log), so the mail never opened at all - the app kept
   the 1500-character preview. Two reasons, one on each side:

   SERVER (server/rugs-mail.index.ts, deployed separately): withCidLinks walked EVERY picture of the
   WHOLE conversation and ran two regular expressions over the WHOLE mail for each one, for every mail
   - 49 mails x ~300 pictures x 2 passes over 100 KB+ of HTML. It now builds one index for the
   conversation and reads each mail ONCE. It also sends the HTML of only the newest 15 mails; the older
   ones come as a one-line summary (light:true) and are fetched by id when someone opens them.

   APP (this patch):
     - a "light" mail is not treated as missing (no "Gmail did not send back every mail" error);
     - opening one fetches just that mail (five at a time when Expand all is pressed), and it is
       painted as soon as it arrives;
     - a FOLDED mail no longer builds its body at all. The reading pane used to create one sandboxed
       iframe per mail even though only the newest is open, so a 72-mail trail made the browser parse
       72 documents of quoted HTML before anything appeared. Now the body is built when it is opened.

   Run:  node server/mailapp-b64.js decode  &&  node server/patch-long-trail.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- 1. a one-line ("light") mail is not a missing mail ---------- */
edit('keep the older mails of a long trail as summaries',
  "    (r.messages||[]).forEach(m=>{const x=t.msgs.find(y=>y.gid===m.gmail_id);if(!x)return;\n"
+ "     x.raw=fixMailImgs(m.body_html||'');x.body=(m.body_text||x.body||'').trim();x.full=true;\n"
+ "     if(!x.ours)x.sig=sigFromText(m.body_text);\n"
+ "     RAWC[m.gmail_id]={raw:x.raw,body:x.body,full:true}});\n"
+ "    const all=t.msgs.every(x=>x.full);",

  "    (r.messages||[]).forEach(m=>{const x=t.msgs.find(y=>y.gid===m.gmail_id);if(!x)return;\n"
+ "     /* 19 Nov 2026: in a long trail the server sends the newest 15 mails in full and the older ones\n"
+ "        as a one-line summary - opening one fetches it (openLight). It is NOT a missing mail. */\n"
+ "     if(m.light){x.light=true;const b=String(m.body_text||'').trim();if(b.length>String(x.body||'').length)x.body=b;return}\n"
+ "     x.light=false;x.raw=fixMailImgs(m.body_html||'');x.body=(m.body_text||x.body||'').trim();x.full=true;\n"
+ "     if(!x.ours)x.sig=sigFromText(m.body_text);\n"
+ "     RAWC[m.gmail_id]={raw:x.raw,body:x.body,full:true}});\n"
+ "    const all=t.msgs.every(x=>x.full||x.light);");

/* ---------- 2. opening one of those older mails ---------- */
edit('fetch an older mail when it is opened',
  "/* Reply, Reply all, Forward and Forward-as-attachment quote the mail itself, so",

  "/* 19 Nov 2026: the older mails of a long trail arrive as one-line summaries. Opening one (or pressing\n"
+ "   Expand all) fetches them by id, five in a request and two requests at a time, and each one is drawn\n"
+ "   as soon as it arrives. A mail that fails can simply be opened again. */\n"
+ "const LD1={};\n"
+ "function openLight(t,list){\n"
+ " if(!t||!t.msgs)return Promise.resolve();\n"
+ " const ids=[...new Set((list||[]).filter(m=>m&&m.light&&m.gid).map(m=>m.gid))].filter(g=>!LD1[t.id+'|'+g]);\n"
+ " if(!ids.length)return Promise.resolve();\n"
+ " ids.forEach(g=>{LD1[t.id+'|'+g]=1});\n"
+ " t.msgs.forEach(m=>{if(ids.indexOf(m.gid)>=0)m.loading=true});redrawRead(t);\n"
+ " const batch=[];for(let i=0;i<ids.length;i+=5)batch.push(ids.slice(i,i+5));\n"
+ " let bi=0;\n"
+ " const one=async()=>{while(bi<batch.length){const b=batch[bi++];\n"
+ "  try{const r=await _tmo(api('thread',{mailbox:t.box,threadId:gidOf(t),ids:b}),45000,'Gmail took too long to send the mail');\n"
+ "   (r.messages||[]).forEach(q=>{if(q.light)return;const x=t.msgs.find(y=>y.gid===q.gmail_id);if(!x)return;\n"
+ "    x.raw=fixMailImgs(q.body_html||'');x.body=(q.body_text||x.body||'').trim();x.full=true;x.light=false;\n"
+ "    if(!x.ours)x.sig=sigFromText(q.body_text);RAWC[q.gmail_id]={raw:x.raw,body:x.body,full:true}})}catch(e){}\n"
+ "  b.forEach(g=>{const x=t.msgs.find(y=>y.gid===g);if(x){x.loading=false;if(x.light)delete LD1[t.id+'|'+g]}});\n"
+ "  redrawRead(t)}};\n"
+ " return Promise.all([one(),one()]).then(()=>{try{loadCidPics(t)}catch(e){}})}\n"
+ "/* Reply, Reply all, Forward and Forward-as-attachment quote the mail itself, so");

/* ---------- 3. a folded mail does not build its body ---------- */
edit('folded mails build nothing until they are opened',
  '<div class="mbody">${(!m.by&&!isInternal(m.email))||m.raw?`',
  '<div class="mbody">${!os.has(mi)?\'\':m.light?`<p style="color:var(--muted)">\\u23f3 Opening this mail\\u2026</p>`:(!m.by&&!isInternal(m.email))||m.raw?`');

/* ---------- 4. the two places a mail is opened ---------- */
edit('Expand all fetches the summaries',
  "if(d.mall){const t=T_(openId);if(t){openMsgs[t.id]=new Set(d.mall==='open'?t.msgs.map((_,i)=>i):[t.msgs.length-1]);renderRead();try{loadCidPics(t)}catch(e){}}return}",
  "if(d.mall){const t=T_(openId);if(t){openMsgs[t.id]=new Set(d.mall==='open'?t.msgs.map((_,i)=>i):[t.msgs.length-1]);renderRead();try{loadCidPics(t)}catch(e){}try{if(d.mall==='open')openLight(t,t.msgs)}catch(e){}}return}");

edit('opening one mail fetches it',
  "const set=openMsgs[t.id]||(openMsgs[t.id]=new Set());const i=+d.mtog;set.has(i)?set.delete(i):set.add(i);renderRead();try{loadCidPics(t)}catch(e){}return}",
  "const set=openMsgs[t.id]||(openMsgs[t.id]=new Set());const i=+d.mtog;set.has(i)?set.delete(i):set.add(i);renderRead();try{loadCidPics(t)}catch(e){}try{if(set.has(i))openLight(t,[t.msgs[i]])}catch(e){}return}");

/* ---------- new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-4';", "const APP_BUILD='2026-11-19-5';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
