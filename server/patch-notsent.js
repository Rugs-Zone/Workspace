/* 19 Nov 2026 - two faults found from Jagjit's screen, both proved in the database.

   1. "Only the short preview is shown - Gmail did not send back every mail in this conversation"
      sat on a conversation that was perfectly fine. CAUSE: when you send a reply or a forward the app
      adds your mail to the conversation straight away, before Gmail has it. That mail has no Gmail id
      yet, so it can never be in Gmail's answer - and the check after loading (every mail must have
      come back) counted it as MISSING and showed the error. Now a mail with no Gmail id is not counted:
      Gmail cannot send back something it has not got yet.

   2. A SEND THAT FAILS LOOKED EXACTLY LIKE A SENT MAIL. `m.failed` was set but drawn nowhere - the only
      sign was a toast that disappears in 2.2 seconds. In the database his 15:13 forward has no `send`
      activity row and no message, while his 15:10 forward to dmm3@ has both: so that mail never left
      the building, and his screen showed it in the conversation as if it had. The server was answering
      546 for six heavy requests in that very window. Now a mail that did not go out carries a red
      "Not sent - this mail is still only on your screen" strip with "Try again" and "Remove", and a
      mail still on its way shows "Sending...". A mail that had attachments says to write it again,
      because the files are not kept and Try again would send it without them.

   Run:  node server/mailapp-b64.js decode  &&  node server/patch-notsent.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- 1. a mail we have just sent is not a missing mail ---------- */
edit('a mail with no Gmail id is not counted as missing',
  "    const all=t.msgs.every(x=>x.full||x.light);",
  "    /* 19 Nov 2026: a reply or forward you have just sent is in the conversation before Gmail has it.\n"
+ "       It has no Gmail id, so it can never come back in Gmail's answer - it is not a missing mail. */\n"
+ "    const all=t.msgs.every(x=>x.full||x.light||!x.gid);");

/* ---------- 2. a send that failed says so, on the mail itself ---------- */
edit('remember why a send failed (reply / forward)',
  " .catch(e=>{m.sending=false;m.failed=true;toast('Not sent: '+e.message);if(isNew){t.hist.push({t:'n',txt:'Not sent: '+e.message,at:Date.now()})}render()})}",
  " .catch(e=>{m.sending=false;m.failed=true;m.failErr=String(e.message||'');toast('Not sent: '+e.message);if(isNew){t.hist.push({t:'n',txt:'Not sent: '+e.message,at:Date.now()})}render()})}");

edit('remember why a send failed (compose window)',
  "  .catch(e=>{sbar.remove();m.sending=false;m.failed=true;\n"
+ "   const _big=(o.fileList||[]).length&&/546|resource|too large|payload|busy for a moment|Failed to fetch/i.test(String(e.message||''));",
  "  .catch(e=>{sbar.remove();m.sending=false;m.failed=true;m.failErr=String(e.message||'');m.hadFiles=(o.fileList||[]).length>0;\n"
+ "   const _big=(o.fileList||[]).length&&/546|resource|too large|payload|busy for a moment|Failed to fetch/i.test(String(e.message||''));");

edit('draw the strip on the mail itself',
  '<div class="mbody">${!os.has(mi)?\'\':m.light?',
  '${m.failed?`<div class="notsent"><b>\\u26a0 Not sent</b> \\u2014 this mail is still only on your screen.'
+ '${m.failErr?` <span class="sub">${esc(m.failErr)}</span>`:\'\'}${m.hadFiles?\' Write it again and attach the files, they are not kept here.\':\'\'}'
+ '<span class="sp"></span>${m.hadFiles?\'\':`<button class="btn" data-resend="${t.id}|${mi}">\\u21bb Try again</button>`}'
+ '<button class="btn" data-dropmsg="${t.id}|${mi}">Remove</button></div>`:m.sending?\'<div class="notsent snd">\\u23f3 Sending\\u2026</div>\':\'\'}'
+ '<div class="mbody">${!os.has(mi)?\'\':m.light?');

edit('Try again / Remove',
  "/* ================= 19 Nov 2026: Outlook-style status bar along the bottom =================",
  "/* 19 Nov 2026: the two buttons on a mail that did not go out. Try again sends the same mail again;\n"
+ "   Remove takes it off the conversation (it never reached anybody). */\n"
+ "document.addEventListener('click',e=>{const b=e.target.closest('[data-resend],[data-dropmsg]');if(!b)return;\n"
+ " e.preventDefault();e.stopPropagation();\n"
+ " const v=String(b.dataset.resend||b.dataset.dropmsg||'');const cut=v.lastIndexOf('|');\n"
+ " const t=T_(idv(v.slice(0,cut))),mi=+v.slice(cut+1);if(!t||!t.msgs[mi])return;\n"
+ " const m=t.msgs[mi];\n"
+ " if(b.dataset.resend){m.failed=false;m.failErr='';try{liveSend(t,m,m.fwd,false)}catch(x){m.failed=true}render();return}\n"
+ " t.msgs.splice(mi,1);if(!t.msgs.length){S.threads=S.threads.filter(x=>x!==t);openId=null}\n"
+ " try{save()}catch(x){}render();toast('Taken off this conversation');});\n"
+ "(function(){const st=document.createElement('style');st.textContent=[\n"
+ " '.notsent{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 2px;padding:8px 10px;border-radius:10px;'\n"
+ "  +'background:color-mix(in srgb,var(--red) 12%,transparent);color:var(--fg);font-size:13px;border:1px solid color-mix(in srgb,var(--red) 35%,transparent)}',\n"
+ " '.notsent.snd{background:var(--hover);border-color:var(--line);color:var(--muted)}',\n"
+ " '.notsent .sub{color:var(--muted);font-size:12px}',\n"
+ " '.notsent .sp{flex:1}'\n"
+ "].join('\\n');document.head.appendChild(st)})();\n"
+ "/* ================= 19 Nov 2026: Outlook-style status bar along the bottom =================");

/* ---------- new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-5';", "const APP_BUILD='2026-11-19-6';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
