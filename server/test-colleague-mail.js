/* Tests the rules this patch adds, taken OUT OF THE SHIPPED FILE (not retyped), against the
 * real message shapes of the reported conversation and against synthetic ones.
 *   node server/test-colleague-mail.js
 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'local-server', 'rugs-mail.bundle.mjs'), 'utf8');
const grab = re => { const m = src.match(re); if (!m) throw new Error('not found in the bundle: ' + re); return m[0]; };
const DOMAIN = 'rugscreation.com';
const isOwn = e => (e.split('@')[1] || '') === DOMAIN;
const body = [
  grab(/const ext = \(x\) => x\.direction === "in".*/),
  grab(/const colleague = \(x\) => x\.direction === "out".*/),
  grab(/const inb = \(x\) => ext\(x\) \|\| colleague\(x\);/)
].join('\n');
const make = box => new Function('box', 'isOwn', body + '\nreturn { ext, colleague, inb };')(box, isOwn);

const BOX = 'teampulse@rugscreation.com';
const R = make(BOX);
const checks = [];
const ok = (name, pass, extra) => checks.push({ name, pass, extra });

/* the real rows of thread 1a1e843cbe21b380 (teampulse@), read from the database */
const colleagueMail = { direction: 'out', from_email: 'packaging@rugscreation.com', sent_by: null, labels: ['UNREAD', 'INBOX'] };
const ourAppReply   = { direction: 'out', from_email: BOX, sent_by: 'umvkv0zd038', labels: ['SENT'] };
const buyerMail     = { direction: 'in',  from_email: 'cs2@maxzippers.com', sent_by: null, labels: ['UNREAD', 'INBOX'] };
const ourOutlook    = { direction: 'out', from_email: BOX, sent_by: null, labels: ['SENT'] };
const autoFromUs    = { direction: 'out', from_email: 'marketing@rugscreation.com', sent_by: 'adm', labels: ['SENT'] };

ok('a colleague\'s mail counts as incoming', R.inb(colleagueMail) === true);
ok('it is not treated as external (counterpart / has_in unchanged)', R.ext(colleagueMail) === false);
ok('our own reply sent from Rugs Email does not', R.inb(ourAppReply) === false);
ok('our own reply sent as the mailbox from Outlook does not', R.inb(ourOutlook) === false);
ok('a buyer\'s mail still counts as incoming', R.inb(buyerMail) === true);
ok('a mail a colleague sent FROM the app is ours, not incoming', R.inb(autoFromUs) === false);

/* the two decisions that were wrong */
const unread = ms => ms.some(x => R.inb(x) && (x.labels || []).includes('UNREAD'));
const reopens = (ms, status, newIn) => !!(status === 'done' && newIn && R.inb(ms[ms.length - 1]));
const thread = [colleagueMail, ourAppReply, { ...colleagueMail, labels: ['UNREAD', 'INBOX'] }, { ...ourAppReply }];

ok('a colleague-only conversation becomes unread', unread([colleagueMail]) === true);
ok('a conversation we have answered is not unread once Gmail drops UNREAD',
   unread([{ ...colleagueMail, labels: ['INBOX'] }, ourAppReply]) === false);
ok('the reported conversation: a colleague writing back reopens it',
   reopens([colleagueMail, ourAppReply, { ...colleagueMail, labels: ['UNREAD'] }], 'done', true) === true);
ok('our own reply never reopens a conversation', reopens(thread, 'done', true) === false);
ok('an open conversation is left alone', reopens([colleagueMail], 'open', true) === false);
ok('nothing happens when the mail is not new', reopens([colleagueMail], 'done', false) === false);

/* the sync must call rebuildThread with newIn = true for a colleague's mail */
const newInExpr = grab(/touched\.set\(m\.threadId,.*/);
const newIn = row => new Function('r', 'box', 'isOwn', 'const touched=new Map();const m={threadId:"t"};' + newInExpr + '\nreturn touched.get("t");')(row, BOX, isOwn);
ok('the sync reports a colleague\'s mail as new incoming mail', newIn(colleagueMail) === true);
ok('the sync does not report our own sent mail as incoming', newIn(ourAppReply) === false);

let bad = 0;
checks.forEach(c => { if (!c.pass) bad++; console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name + (c.extra ? '  ' + c.extra : '')); });
console.log('\n' + (checks.length - bad) + '/' + checks.length + ' checks passed');
process.exit(bad ? 1 : 0);
