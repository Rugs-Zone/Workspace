/* 20 Nov 2026 - "a mail comes in to Beniwal; when he replies it must go to SENT, not stay in the
   Inbox; and when the buyer answers it comes back to the INBOX with the updated trail."
   (Reported three days running - yesterday's change was half of it: it kept a conversation with any
   incoming mail in the Inbox for ever, so a mail you had already answered never left your Inbox.)

   THE RULE NOW - a conversation sits where its NEWEST mail points:
     the newest mail came IN   -> the Inbox   (the ball is with us)
     the newest mail is OURS   -> Sent        (the ball is with them)
   So: buyer writes -> Inbox. Beniwal replies -> it leaves the Inbox and is in Sent. Buyer answers ->
   back in the Inbox, at the top, with the whole trail. Nothing is ever in both places, and nothing is
   lost - a conversation is one thing and it simply moves.
   Applied in every place that decides it, so the five counts stay equal to the lists: the plain rule,
   the later wrapper that wins, All inboxes, and isInboxMail (the badge, the folder counts and Home).
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-folder-by-last.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

/* ---------- the helper ---------- */
edit('which way the newest mail points',
  "function isInboxMail(t){return t.folder==='inbox'&&in60(t)&&hasRecv(t)&&!isWsNotif(t)}",

  "/* 20 Nov 2026: a conversation sits where its NEWEST mail points - in the Inbox while the last word\n"
+ "   is theirs, in Sent once we have answered. recvLast() is that question, asked in one place. */\n"
+ "function recvLast(t){const m=(t&&t.msgs||[])[(t&&t.msgs||[]).length-1];return !!m&&recvMsg(m,t)}\n"
+ "function isInboxMail(t){return t.folder==='inbox'&&in60(t)&&hasRecv(t)&&recvLast(t)&&!isWsNotif(t)}");

/* ---------- the plain rule ---------- */
edit('the plain rule',
  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours)&&!hasRecv(t);   /* 20 Nov 2026: not once a reply has come in */"
+ "if(view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t));",

  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours)&&!recvLast(t);   /* 20 Nov 2026: ours is the last word */"
+ "if(view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t))&&recvLast(t);");

/* ---------- the rule that wins ---------- */
edit('the Inbox rule that wins',
  " if(view.type==='box'&&t.dept===view.dept&&view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t));",
  " if(view.type==='box'&&t.dept===view.dept&&view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t))&&recvLast(t);   /* 20 Nov 2026: only while the last word is theirs */");

edit('the Sent rule that wins',
  " if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)))&&!hasRecv(t);",
  " if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)))&&!recvLast(t);   /* 20 Nov 2026: ours is the last word */");

edit('All inboxes follows the same rule',
  " if(view.type==='all')return inScope(t)&&t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t));",
  " if(view.type==='all')return inScope(t)&&t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t))&&recvLast(t);");

edit('APP_BUILD', "const APP_BUILD='2026-11-20-5';", "const APP_BUILD='2026-11-20-6';");

fs.writeFileSync(F, s);
console.log(n + ' edits done');
