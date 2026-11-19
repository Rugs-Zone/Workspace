/* 18 Nov 2026 — "remove the 546 error and always show the full conversation" (app side).
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-546-fullmail.js  &&  node server/mailapp-b64.js encode
   Four edits in the mail app (.tmp/email.html):
     1. friendly()  — a 546 / out-of-resources answer from the server becomes
                      "The mail server was busy for a moment. Nothing was lost — try again."
                      (one place: every api() error in the whole app goes through friendly)
     2. send()      — its "attachments too big" test still recognises that new wording
     3. liveOpen()  — the server's partial:true answer (Gmail unreachable) fills the conversation from
                      the saved copy of EVERY mail instead of leaving the 1500-character preview, and
                      keeps the conversation "not full" so Retry still fetches the original
     4. reading pane — a third state for that bar: "Showing the saved copy of this conversation" + Retry
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const n0 = s.length;
let done = 0;
function sub(name, old, nw) {
  const n = s.split(old).length - 1;
  if (n !== 1) { console.error('FAILED (' + n + ' matches): ' + name); process.exit(1); }
  s = s.replace(old, nw); done++; console.log('ok  ' + name);
}

/* 1. friendly(): the server-busy answer */
sub('friendly(): 546 becomes plain words',
  ` if(/^Gemini/i.test(m))return "AI writing isn't available right now. Try again in a minute.";`,
  ` if(/\\b546\\b|out of resources|CPU time|Memory limit|resource limit/i.test(m))return 'The mail server was busy for a moment. Nothing was lost \\u2014 try again.';
 if(/^Gemini/i.test(m))return "AI writing isn't available right now. Try again in a minute.";`);

/* 2. send(): keep recognising a too-big upload now that 546 is reworded */
sub('send(): big-attachment test knows the new wording',
  `/546|resource|too large|payload|Failed to fetch/i`,
  `/546|resource|too large|payload|busy for a moment|Failed to fetch/i`);

/* 3. liveOpen(): reset the saved-copy flag on every attempt */
sub('liveOpen(): reset saved-copy flag',
  ` L.err='';L.busy=true;`,
  ` L.err='';L.saved=false;L.busy=true;`);

/* 3b. liveOpen(): use the saved copy when the server could not read Gmail */
sub('liveOpen(): saved copy instead of the short preview',
  `    const r=await _tmo(api('thread',{mailbox:t.box,threadId:gidOf(t)}),45000,'Gmail took too long to send the mail');
    (r.messages||[]).forEach(m=>{const x=t.msgs.find(y=>y.gid===m.gmail_id);if(!x)return;`,
  `    const r=await _tmo(api('thread',{mailbox:t.box,threadId:gidOf(t)}),45000,'Gmail took too long to send the mail');
    /* The server answers partial:true when it could not read Gmail. Instead of an error (and the
       1500-character preview of the list) it sends the saved copy of EVERY mail in the conversation,
       so the whole conversation can still be read. It stays "not full", so Retry fetches the original
       with its pictures and layout. */
    if(r.partial){
     (r.messages||[]).forEach(m=>{const x=t.msgs.find(y=>y.gid===m.gmail_id);if(!x)return;
      const b=String(m.body_text||'').trim();if(b.length>String(x.body||'').length)x.body=b});
     L.saved=true;L.err=friendly(String(r.why||''))||'Google Mail did not answer.';
     return false}
    (r.messages||[]).forEach(m=>{const x=t.msgs.find(y=>y.gid===m.gmail_id);if(!x)return;`);

/* 4. the reading-pane bar: saved copy / could not load / loading */
sub('reading pane: "Showing the saved copy" bar',
  ` \${(()=>{const L=LD[t.id]||{};if(t._local||t.full)return '';
  return L.err`,
  ` \${(()=>{const L=LD[t.id]||{};if(t._local||t.full)return '';
  if(L.saved)return \`<div class="promise"><span>\${ico('mail')}</span><b>Showing the saved copy of this conversation<br><span class="sub">\${esc(L.err)} Every mail and its text are here. Pictures and the exact layout come straight from Google Mail \\u2014 press Retry for those.</span></b><button class="btn" data-fullretry="\${t.id}">\\u21bb Retry</button></div>\`;
  return L.err`);

fs.writeFileSync(F, s);
console.log(done + ' edits, ' + n0 + ' -> ' + s.length + ' characters');
