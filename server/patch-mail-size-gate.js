/* 21 Nov 2026 - "why is the mail server busy, no email is going".
   ---------------------------------------------------------------------------------------------
   WHAT THE LIVE LOGS SHOWED (Supabase, rugs-mail, 20-21 Nov)
     Three requests from the office this morning carried 36 MB, 80 MB and 117 MB of mail:
       04:19 IST  36,521,231 bytes -> 546
       04:25 IST  80,469,029 bytes -> 546
       04:27 IST 117,499,508 bytes -> 546
     Each one killed the edge worker ("Memory limit exceeded" in the function log - 14 times on
     rugs-mail, plus 71 "CPU Time exceeded"), so the mail never went out. Worse, the small
     requests being served by the SAME worker at that instant died with it: at 04:25:09 a 80 MB
     send and three 208-byte calls all failed in the same millisecond. That is why the whole
     office sees "The mail server was busy for a moment" - one oversized mail takes everybody
     else's requests down with it.

   WHY THE 15 MB CHECK DID NOT CATCH IT
     The 16 Nov check only ever counted ATTACHED files (`q('#cat')._olk`). It never looked at the
     message body - and the body is where the weight actually is:
       - a pasted picture is written into the body as a data: URL (up to 3 MB each, no limit on
         how many), and
       - since 18 Nov (STEP 3) a reply quotes each earlier mail as its ORIGINAL HTML, so every
         picture in a long trail is carried again as a data: URL. A claim trail that quotes the
         same photos fifteen times becomes tens of MB.
     So a reply with no attachment at all passed the check and then uploaded 117 MB.

   THE FIX (app side only - nothing can be done on the server, because the function is killed
   while it is still reading the request, before any code of ours runs)
     The size of the WHOLE mail is measured before the compose window closes: body + attachments
     as they will go on the wire. Over the limit, the mail is NOT sent and a red strip inside the
     compose window says how big it is and what is making it big. Nothing the person wrote is
     lost. When the weight is in the quoted mails, one button leaves them out - it just unticks
     the "Include trail" box that already exists, so the person can tick it straight back.
   ---------------------------------------------------------------------------------------------
   Run after `node server/mailapp-b64.js decode`, then `node server/mailapp-b64.js encode`.       */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const n0 = s.length;
let done = 0;

function one(find, repl, label) {
  const i = s.indexOf(find);
  if (i < 0) {
    if (s.indexOf(repl) >= 0) { console.log('--  ' + label + ' (already there)'); return; }
    throw new Error('NOT FOUND: ' + label);
  }
  if (s.indexOf(find, i + 1) >= 0) throw new Error('NOT UNIQUE: ' + label);
  s = s.slice(0, i) + repl + s.slice(i + find.length);
  done++; console.log('ok  ' + label);
}

/* ---------------------------------------------------------------- 1. the gate itself --------- */
const OLD = "send.onclick=()=>{const _fl=[...(q('#cat')&&q('#cat')._olk||[])],_tot=_fl.reduce((a,x)=>a+x.size,0);\n" +
  "  if(_tot>MAIL_MAX){toast('Not sent — '+fsize(_tot)+' of files is too much. A mail carries about '+fsize(MAIL_MAX)+'; remove one or send a Google Drive link.');return}\n" +
  "  opts({});origSend();if(L.innerHTML)NEXT_OPTS=null};";

const NEW = "/* 21 Nov 2026: measure the WHOLE mail, not only the attachments.\n" +
  "    A pasted picture and every picture in a quoted mail live inside the body as data: URLs, so a\n" +
  "    reply with no attachment at all was uploading 36, 80, even 117 MB this morning. Nothing that\n" +
  "    big can be sent: the server is killed while it is still reading the request, the mail never\n" +
  "    goes out, and the other requests being served at that moment die with it - which is what\n" +
  "    everybody sees as \"the mail server was busy for a moment\". Checked here, before the window\n" +
  "    closes, so the written mail is never lost. */\n" +
  " const WIRE_MAX=20*1024*1024;   /* one request; 15 MB of files is about 20 MB on the wire */\n" +
  " const _bytes=x=>{try{return new Blob([String(x||'')]).size}catch(e){return String(x||'').length}};\n" +
  " const _weigh=()=>{const fl=[...(q('#cat')&&q('#cat')._olk||[])];\n" +
  "  const body=_bytes(ed&&ed.innerHTML),files=Math.ceil(fl.reduce((a,x)=>a+x.size,0)*4/3);\n" +
  "  const box=ed&&ed.querySelector('[data-trail]'),quote=box?_bytes(box.outerHTML):0;\n" +
  "  return {body:body,files:files,quote:quote,total:body+files}};\n" +
  " const _tooBig=w=>{const old=L.querySelector('.olwarn.bigmail');if(old)old.remove();\n" +
  "  const left=w.total-w.quote,canDrop=w.quote>0&&left<=WIRE_MAX;\n" +
  "  const d=document.createElement('div');d.className='olwarn bigmail';\n" +
  "  d.innerHTML='<b>Not sent — this mail is too big</b><ul>'\n" +
  "   +'<li>The whole mail is '+fsize(w.total)+'. One mail can carry about '+fsize(WIRE_MAX)+'.</li>'\n" +
  "   +(w.quote?'<li>'+fsize(w.quote)+' of it is the quoted mails under your reply — mostly their pictures, which the other side already has.</li>':'')\n" +
  "   +(w.files?'<li>'+fsize(w.files)+' of it is the files you attached.</li>':'')\n" +
  "   +(!w.quote&&!w.files?'<li>It is the pictures pasted into your text. Put a big picture in Google Drive and send the link instead.</li>':'')\n" +
  "   +'</ul><div class=\"act\">'\n" +
  "   +(canDrop?'<button type=\"button\" class=\"btn pri\" data-bigq>Leave the quoted mails out ('+fsize(left)+')</button>':'')\n" +
  "   +'<button type=\"button\" class=\"btn\" data-bigfix>Let me fix it</button></div>'\n" +
  "   +'<span class=\"olnote\">Nothing was sent and nothing you wrote is lost. Sending it as it is would fail and would slow Rugs Email down for everybody.</span>';\n" +
  "  foot.parentNode.insertBefore(d,foot);\n" +
  "  d.querySelector('[data-bigfix]').onclick=()=>d.remove();\n" +
  "  const qb=d.querySelector('[data-bigq]');\n" +
  "  if(qb)qb.onclick=()=>{const c=q('#ctr');\n" +
  "   if(c&&c.checked){c.checked=false;if(c.onchange)c.onchange()}\n" +
  "   else{const b=ed&&ed.querySelector('[data-trail]');if(b)b.remove()}\n" +
  "   d.remove();toast('The quoted mails were left out — press Send again (tick \"Include trail\" to put them back)')}};\n" +
  " send.onclick=()=>{const _fl=[...(q('#cat')&&q('#cat')._olk||[])],_tot=_fl.reduce((a,x)=>a+x.size,0);\n" +
  "  if(_tot>MAIL_MAX){toast('Not sent — '+fsize(_tot)+' of files is too much. A mail carries about '+fsize(MAIL_MAX)+'; remove one or send a Google Drive link.');return}\n" +
  "  const _w=_weigh();if(_w.total>WIRE_MAX){_tooBig(_w);return}\n" +
  "  opts({});origSend();if(L.innerHTML)NEXT_OPTS=null};";

one(OLD, NEW, 'send.onclick weighs the whole mail, not only the files');

/* ---------------------------------------------- 2. "Send later" goes through the same gate ---- */
/* Send later does not use the Send button - it calls origSend() itself with a time - and a
   scheduled mail is uploaded in exactly the same one request, so it has to be weighed too. */
one("const done=at=>{host.remove();if(!at||at<Date.now()+60000){toast('Pick a time at least one minute from now');return}opts({sendAt:at});origSend();if(L.innerHTML)NEXT_OPTS=null};",
  "const done=at=>{host.remove();if(!at||at<Date.now()+60000){toast('Pick a time at least one minute from now');return}\n" +
  "   const _w=_weigh();if(_w.total>WIRE_MAX){_tooBig(_w);return}\n" +
  "   opts({sendAt:at});origSend();if(L.innerHTML)NEXT_OPTS=null};",
  'Send later weighs the mail too');

/* ------------------------------------------- 3. a note on the strip, reusing the pack's style - */
if (s.indexOf('.olwarn.bigmail{border-width:2px}') >= 0) console.log('--  strip style (already there)');
else one(".olwarn .act{display:flex;gap:8px;flex-wrap:wrap}'",
  ".olwarn .act{display:flex;gap:8px;flex-wrap:wrap}',\n" +
  "    '.olwarn.bigmail{border-width:2px}',\n" +
  "    '.olwarn .olnote{display:block;margin-top:6px;opacity:.75}'",
  'strip style');

fs.writeFileSync(F, s);
console.log(done + ' edits, ' + n0 + ' -> ' + s.length + ' chars');
