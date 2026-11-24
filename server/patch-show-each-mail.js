/* 24 Nov 2026 - every mail is its own row, always.
 *
 * View ▾ had "Conversations: Group by conversation / Show each mail" and started grouped.
 * "Show each mail" is now the rule for everyone: LV() always answers conv:false whatever is
 * saved in a person's prefs, and the choice is taken out of the View menu so there is no
 * control that does nothing. A row still opens the whole conversation with its trail.
 *
 * Two things in explode() had to be put right at the same time, because it now runs always:
 *   - in the Inbox it kept only messages that were not ours, so a COLLEAGUE's mail (every
 *     @rugscreation.com sender counts as ours) had no row of its own; it now uses recvMsg,
 *     the same rule the Inbox folder itself uses.
 *   - in Sent it kept every mail that counts as ours, which would give a colleague's incoming
 *     mail a row in Sent; now it is only what we actually sent, like the Sent folder.
 *
 *   node server/patch-show-each-mail.js   (then: node server/mailapp-b64.js encode)
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 60));
  s = s.replace(a, b); n++;
};

/* 1. one row per mail, whatever is saved */
sub(
  `const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{});`,
  `/* 24 Nov 2026: conv is fixed at false - every mail is its own row for everybody */
const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:false});`
);

/* 2. the choice leaves the View menu */
sub(
  ` ['conv','Conversations',[[true,'Group by conversation'],[false,'Show each mail']]],\n`,
  ``
);

/* 3. ... and "Each mail" is no longer worth saying on the button, it is always on */
sub(
  `if(!v.conv)n.push('Each mail');`,
  ``
);

/* 4. the Inbox gives a colleague's mail its own row too */
sub(
  `const ms=t.msgs.filter(m=>sent?(m.ours||m.by):inb?!(m.ours||m.by):true);const lastIn=[...t.msgs].reverse().find(m=>!(m.ours||m.by));`,
  `const mine=m=>!!(m.by||(m.ours&&!colleagueIn(m,t)));   /* what WE sent, as the Sent folder counts it */
  const ms=t.msgs.filter(m=>sent?mine(m):inb?recvMsg(m,t):true);const lastIn=[...t.msgs].reverse().find(m=>recvMsg(m,t));`
);

fs.writeFileSync(F, s);
console.log('email.html patched, ' + n + ' edits');
