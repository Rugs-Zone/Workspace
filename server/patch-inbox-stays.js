/* 23 Nov 2026 — Rugs Email: a conversation STAYS IN THE INBOX after we reply.
 *
 * Reported, plainly: "if someone replied on that email so it hidden from inbox
 * and come in sent — it should not be like that."
 *
 * This undoes the 20 Nov "a conversation sits where its newest mail points"
 * rule (server/patch-folder-by-last.js), which moved a conversation out of the
 * Inbox the moment we answered it, and brings back the rule from earlier that
 * same day (server/patch-sent-no-reply.js):
 *
 *     Inbox = anything that has mail FROM somebody, whoever wrote last.
 *     Sent  = only what we sent that nobody has answered yet.
 *
 * So a buyer writes -> Inbox; we reply -> it is STILL in the Inbox (with our
 * reply inside the same conversation); the buyer answers -> it moves up the
 * Inbox. Nothing is ever in both places, and a mail we sent that gets an
 * answer leaves Sent, because the conversation now belongs to the Inbox.
 *
 * `recvLast()` itself is left in the file — nothing else uses it, and keeping
 * it means the old behaviour can be put back by hand if it is ever wanted.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-inbox-stays.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('expected 1 match for ' + what + ', found ' + c);
  s = s.replace(find, repl);
  n++;
}

/* 1. the plain rule ------------------------------------------------------- */
one(
  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours)&&!recvLast(t);   /* 20 Nov 2026: ours is the last word */" +
  "if(view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t))&&recvLast(t);",
  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours)&&!hasRecv(t);   /* 23 Nov 2026: Sent = we wrote and nobody has answered yet */" +
  "if(view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t));   /* 23 Nov 2026: it stays in the Inbox after we reply */",
  'plain inbox/sent rule'
);

/* 2. the later wrapper, which is the one that actually wins --------------- */
one(
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t))&&recvLast(t);   /* 20 Nov 2026: only while the last word is theirs */",
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='inbox')return t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t));   /* 23 Nov 2026: anything somebody sent us stays in the Inbox, answered or not */",
  'wrapper inbox rule'
);

one(
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)))&&!recvLast(t);   /* 20 Nov 2026: ours is the last word */",
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)))&&!hasRecv(t);   /* 23 Nov 2026: Sent = waiting for an answer */",
  'wrapper sent rule'
);

one(
  "if(view.type==='all')return inScope(t)&&t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t))&&recvLast(t);",
  "if(view.type==='all')return inScope(t)&&t.folder==='inbox'&&in60(t)&&t.msgs.some(m=>recvMsg(m,t));   /* 23 Nov 2026: same rule for All inboxes */",
  'all inboxes rule'
);

/* 3. the counts have to agree with the lists ------------------------------ */
one(
  "function isInboxMail(t){return t.folder==='inbox'&&in60(t)&&hasRecv(t)&&recvLast(t)&&!isWsNotif(t)}",
  "function isInboxMail(t){return t.folder==='inbox'&&in60(t)&&hasRecv(t)&&!isWsNotif(t)}   /* 23 Nov 2026: counts follow the list - answered mail still counts as Inbox mail */",
  'inbox counts'
);

fs.writeFileSync(F, s);
console.log('patched ' + F + ' — ' + n + ' edits');
