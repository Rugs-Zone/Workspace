/* 24 Nov 2026 - mail from a COLLEAGUE is new mail on the screen too.
 * The app decided "is this new mail?" with !m.ours, and every @rugscreation.com sender is
 * marked ours - so when packaging@ wrote to teampulse@ there was no ding, no "N new mail"
 * notification and no "new mail in this conversation" banner. recvMsg() is the rule the
 * Inbox itself already uses (a colleague's mail, a mail addressed to this mailbox, a login
 * code), so the two now agree.
 *   node server/patch-colleague-newmail.js   (then: node server/mailapp-b64.js encode)
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

/* how many mails in this conversation did somebody send US (recvMsg, the Inbox's own rule) */
sub(
  `  const ins=x=>x?x.msgs.filter(m=>!m.ours).length:0;`,
  `  const ins=x=>x?x.msgs.filter(m=>typeof recvMsg==='function'?recvMsg(m,x):!m.ours).length:0;   /* 24 Nov 2026: a colleague's mail is mail we received */`
);

/* the ding / notification list: the newest mail came in */
sub(
  `  if(newMail){const fresh=S.threads.filter(t=>(before.get(t.id)||0)<t.msgs.length&&!t.msgs[t.msgs.length-1].ours);`,
  `  if(newMail){const fresh=S.threads.filter(t=>{if((before.get(t.id)||0)>=t.msgs.length)return false;const lm=t.msgs[t.msgs.length-1];return typeof recvMsg==='function'?recvMsg(lm,t):!lm.ours});   /* 24 Nov 2026 */`
);

fs.writeFileSync(F, s);
console.log('email.html patched, ' + n + ' edits');
