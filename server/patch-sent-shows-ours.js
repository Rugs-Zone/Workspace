/* 23 Nov 2026 — Rugs Email: Sent lists every conversation we wrote in, and the
 * row shows OUR OWN message, not the buyer's newest one.
 *
 * The user's own example:
 *   11:00  buyer sends mail 1          -> it is in the Inbox
 *   11:01  we reply with mail 2        -> OUR REPLY shows in Sent, and the
 *                                         buyer's conversation STAYS in the Inbox
 *   11:03  buyer answers with mail 3   -> the Inbox row moves to 11:03 and
 *                                         opening it shows the whole trail
 *                                         (11:03 theirs, 11:01 ours, 11:00 theirs)
 *
 * So a conversation can be in BOTH folders, exactly like Gmail and Outlook:
 * the Inbox because somebody wrote to us, and Sent because we wrote in it.
 * What went wrong on 20 Nov was never that it was in both — it was that the
 * SENT ROW showed the buyer's newest mail, so Sent looked like a second Inbox.
 * The row already shows "To: …" and the time of our own mail (lastOut); this
 * adds the missing piece, the preview text of our own mail.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-sent-shows-ours.js
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

/* 1. Sent = every conversation we wrote in ------------------------------- */
one(
  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours)&&!hasRecv(t);   /* 23 Nov 2026: Sent = we wrote and nobody has answered yet */",
  "if(view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||m.ours);   /* 23 Nov 2026: Sent = anything we wrote in, answered or not */",
  'plain sent rule'
);

one(
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)))&&!hasRecv(t);   /* 23 Nov 2026: Sent = waiting for an answer */",
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)));   /* 23 Nov 2026: Sent = anything we wrote in; the Inbox keeps its own copy of the conversation */",
  'wrapper sent rule'
);

/* 2. a Sent row shows our own message, not the buyer's newest ------------ */
one(
  "const lastOut=t=>Math.max(0,...t.msgs.filter(m=>m.by||m.ours).map(m=>m.at));",
  "const lastOut=t=>Math.max(0,...t.msgs.filter(m=>m.by||m.ours).map(m=>m.at));\n" +
  "/* 23 Nov 2026: in Sent, the row is about what WE wrote - the last mail that went out\n" +
  "   from this mailbox - so the preview is our words, matching the \"To: …\" and the time. */\n" +
  "const outMsg=t=>{const o=(t&&t.msgs||[]).filter(m=>m.by||m.ours);return o.length?o[o.length-1]:null};\n" +
  "function rowPre(t){if(!(view.type==='box'&&view.folder==='sent'))return t.pre;\n" +
  " const m=outMsg(t);if(!m)return t.pre;\n" +
  " return String(m.body||'').replace(/\\s+/g,' ').trim().slice(0,160)||t.pre}",
  'row preview helper'
);

one(
  "<div class=\"pre\">${priv?'Hidden from the team. Only the account owner can open it.':esc(t.pre)}</div>",
  "<div class=\"pre\">${priv?'Hidden from the team. Only the account owner can open it.':esc(rowPre(t))}</div>",
  'row preview'
);

fs.writeFileSync(F, s);
console.log('patched ' + F + ' — ' + n + ' edits');
