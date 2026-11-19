/* 18 Nov 2026 — mail SENT from a team mailbox must show only in Sent, not in the Inbox.
   Reported: Jagjit sends from teamalpha@ to Mala with team alpha in Cc, and his own mail turns up in
   the Inbox. Cause: toThisBox() said "this mailbox is in To/Cc, so it is received mail" without
   looking at WHO sent it.
   Fix: toThisBox() is false when the mail was sent from Rugs Email (m.by) or when the sender address
   is the mailbox's own address (m.email === t.box). A colleague writing from another
   @rugscreation.com address, and anything from a buyer, still reach the Inbox as before.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-tothisbox.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');

const old = `const toThisBox=(m,t)=>{const b=String((t&&t.box)||'').toLowerCase();return !!b&&!!m&&((String(m.to||'')+' '+String(m.cc||'')).toLowerCase().includes(b))};`;
const nw = `const toThisBox=(m,t)=>{const b=String((t&&t.box)||'').toLowerCase();if(!b||!m)return false;
 /* 18 Nov 2026: what THIS mailbox sent belongs in Sent only, even with its own address in To/Cc
    (Jagjit writing from teamalpha@ with team alpha in Cc was landing in the Inbox). */
 if(m.by)return false;                                            // sent from Rugs Email by one of us
 if(String(m.email||'').toLowerCase()===b)return false;            // sent from this mailbox itself (Outlook/Gmail)
 return (String(m.to||'')+' '+String(m.cc||'')).toLowerCase().includes(b)};`;

const n = s.split(old).length - 1;
if (n !== 1) { console.error('FAILED: toThisBox found ' + n + ' times'); process.exit(1); }
fs.writeFileSync(F, s.replace(old, nw));
console.log('ok  toThisBox: mail sent from this mailbox stays in Sent');
