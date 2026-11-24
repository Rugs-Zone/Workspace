/* 24 Nov 2026 - Rugs Email: marking ONE conversation done, when the other side wrote last and
 * nobody has answered, now says so and offers 10 seconds of Undo.
 *
 * Bulk "Done" asks a real question first (server/patch-bulk-done-confirm.js). A single Done is
 * a normal, constant action, so it is deliberately NOT turned into a dialog - it stays one
 * click. But closing a mail somebody is still waiting for should never pass silently, so the
 * plain "Done" toast is replaced by the app's own Undo bar with the reason written out.
 * A conversation we have already answered is unchanged ("Done ✓").
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-done-one-warning.js
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

/* 1. one place that marks a single conversation done ------------------------- */
one(
  "function done(t){t.status='done';t.unread=false;hist(t,'d',`Marked done by ${who(ME).name}`);save()}",
  "function done(t){t.status='done';t.unread=false;hist(t,'d',`Marked done by ${who(ME).name}`);save()}\n" +
  "/* 24 Nov 2026: closing a mail the other side is still waiting for says so, with Undo. */\n" +
  "function done1(t){if(!t)return;const waiting=t.status!=='done'&&typeof lastInMsg==='function'&&lastInMsg(t);done(t);render();\n" +
  " if(waiting)undoToast('Marked done \u2014 but '+(rowName(t)||'the other side')+' wrote last and nobody has answered',()=>{reopenMail(t);save();render()});\n" +
  " else toast('Done \u2713')}",
  'done1 helper'
);

/* 2. the reading pane's Done button ------------------------------------------ */
one(
  " if(d.done){const t=T_(d.done);done(t);toast('Done ✓');render();return}",
  " if(d.done){done1(T_(d.done));return}   /* 24 Nov 2026: warns + Undo when nobody answered */",
  'reading pane Done'
);

/* 3. the Done button on a mail row ------------------------------------------- */
one(
  " if(k==='d'){done(t);toast('Done ✓');render();return}",
  " if(k==='d'){done1(t);return}   /* 24 Nov 2026: warns + Undo when nobody answered */",
  'row Done'
);

fs.writeFileSync(F, s);
console.log('patch-done-one-warning: ' + n + ' edits applied');
