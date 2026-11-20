/* 20 Nov 2026 - "a mail somebody sends to Ashok must not show in Sent; once a mail comes in, that
   conversation belongs in the Inbox as the updated conversation."

   HOW IT WAS: folders were decided for the whole CONVERSATION, and the Sent folder asked only one
   question - "did anybody on our side write in here?". So a conversation where the buyer wrote and we
   replied was in BOTH places, and because the row shows the newest mail, the Sent row showed the
   BUYER'S mail. That is what looked like "their mail is sitting in my Sent".

   HOW IT IS NOW - one conversation, one place:
     - anything that has mail coming IN  -> the Inbox only (as the updated conversation), never Sent;
     - Sent holds what we sent and nobody has answered yet - a new mail, a forward, a reminder.
       The moment a reply arrives, that conversation moves out of Sent and up the Inbox.
   Nothing is lost: the mail we sent is inside the conversation (open it in the Inbox and it is there,
   in the trail), and Search still finds it - in:sent included.

   Both places that decide the Sent folder are changed, the plain one and the later one that wins.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-sent-no-reply.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- the rule that actually decides it ---------- */
edit('Sent drops a conversation as soon as mail comes in',
  " if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)));",
  " /* 20 Nov 2026: Sent = what we sent and nobody has answered yet. The moment a mail comes in, the\n"
+ "    conversation belongs to the Inbox (it is the same conversation, with our mail inside it). */\n"
+ " if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)))&&!hasRecv(t);");

/* ---------- and the plain rule underneath it, so both agree ---------- */
edit('the same underneath',
  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours);",
  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours)&&!hasRecv(t);   /* 20 Nov 2026: not once a reply has come in */");

/* ---------- new build ---------- */
edit('APP_BUILD', "const APP_BUILD='2026-11-19-8';", "const APP_BUILD='2026-11-20-1';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
