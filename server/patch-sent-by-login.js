/* patch-sent-by-login.js - 28 Nov 2026
 *
 * "Ashish Deshwal's Sent folder is empty of the mail he really sent."
 *
 * MEASURED FIRST, against the live office server (admin token, then a real Switch ID session as
 * him, read only): the database holds 262 messages whose from_email is his own login
 * merchandiser9@rugscreation.com, 261 of them already direction='out', in teampulse@ and in
 * seven other shared mailboxes. In HIS OWN list: 179 such mails, 178 marked out, every one of
 * their conversations has_out = true - and sent_by is NULL on all of them, because he writes
 * them in Gmail, not through Rugs Email. So the mail is all there. What was wrong was the RULE:
 *
 *   const colleagueIn = (m,t) => m.ours && !m.by && m.email && m.email !== t.box;
 *   Sent shows a conversation when  t.msgs.some(m => m.by || (m.ours && !colleagueIn(m,t)))
 *
 * His mail is "ours" (out), has no sent_by, and its From (his own login) is not the shared
 * mailbox address - so colleagueIn says TRUE, "a colleague wrote in", and his own mail counted
 * as mail RECEIVED. His Sent could never show it. Anybody who writes from their own login into
 * a shared mailbox had the same hole; only mail sent through Rugs Email itself (which sets
 * sent_by) landed in Sent.
 *
 * THE RULE NOW (and this is the permanent part): a mail whose From is a person's own login or
 * alias was SENT BY THAT PERSON, in whatever mailbox it lands. One helper, sentByUs(m,t), is
 * used by the three places that decide what Sent is - the folder, the per-mail rows (R17) and
 * R15's "whose sent mail is it" - so they can never drift apart again.
 *
 * WHAT IS DELIBERATELY NOT CHANGED:
 *  - recvMsg / colleagueIn themselves, so the mail is STILL received mail for the mailbox: the
 *    conversation stays in the team Inbox, in Needs owner and in the work lists exactly as
 *    today. That is what Gmail does too - the sender's Sent and the recipient's Inbox.
 *  - R15: the person who sent it sees it in Sent; a colleague does not; a manager, lead, CRM
 *    and the admin see it as they always have. This is asked through the app's own sentWho(),
 *    which already matches a login or an alias from perm.aliases.
 *  - no ownership, folder, read/unread or server change, and nothing is written anywhere.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-sent-by-login.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__sentmine")) { console.log("already applied - nothing to do"); process.exit(0); }

let done = 0;
function edit(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(name + ": found " + n + " times, expected 1");
  s = s.replace(from, to);
  console.log("  edit " + (++done) + " ok  " + name);
}

/* 1 - the Sent folder itself */
edit("Sent folder",
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)));",
  "if(view.type==='box'&&t.dept===view.dept&&view.folder==='sent')return t.folder!=='deleted'&&t.msgs.some(m=>sentByUs(m,t));   /* __sentmine */"
);
/* 2 - one row per mail in the Sent view (R17) */
edit("per-mail rows",
  "rows.forEach(t=>{const mine=m=>!!(m.by||(m.ours&&!colleagueIn(m,t)));",
  "rows.forEach(t=>{const mine=m=>sentByUs(m,t);   /* __sentmine */"
);
/* 3 - R15: which of us sent it, so only the sender (and a manager) sees it */
edit("R15 sentSeen",
  "const out=(t.msgs||[]).filter(m=>m.by||(m.ours&&!colleagueIn(m,t)));",
  "const out=(t.msgs||[]).filter(m=>sentByUs(m,t));   /* __sentmine */"
);

/* 4 - the helper. Declared with "function" so the three uses above, which run later, see it
       wherever in the file they are. */
const BLOCK = [
'<script>/* __sentmine:start  28 Nov 2026 - mail you send from your own login shows in YOUR Sent,',
'   in whatever mailbox it lands. server/patch-sent-by-login.js',
'   Measured on the live server before writing a line: 262 mails from merchandiser9@ in the',
'   database, 261 already direction=out, sent_by NULL on all of them (he writes them in Gmail),',
'   and colleagueIn() was therefore calling his own mail "a colleague wrote in". */',
'function sentByUs(m,t){',
' if(!m)return false;',
' if(m.by)return true;                 /* sent through Rugs Email - it already names the person */',
' if(!m.ours)return false;             /* it came from outside: never Sent */',
' try{',
'  if(typeof colleagueIn!=="function"||!colleagueIn(m,t))return true;   /* sent from the mailbox itself */',
' }catch(e){return true}',
' /* It came from one of OUR OWN addresses. If that address is a person\'s login or alias, that',
'    person sent it - so it is sent mail, and R15 (sentSeen) decides who may see it. */',
' try{return !!(typeof sentWho==="function"&&sentWho(m,t))}catch(e){return false}',
'}',
'try{window.sentByUs=sentByUs}catch(e){}',
'/* paste  rzSentCheck()  into the console: what YOUR Sent counts in the mailbox on screen */',
'window.rzSentCheck=function(){',
' try{',
'  var n=0,mine=0,hid=0;',
'  (S.threads||[]).forEach(function(t){',
'   if(!t||t.dept!==view.dept)return;',
'   var o=(t.msgs||[]).filter(function(m){return sentByUs(m,t)});',
'   if(!o.length)return;',
'   n++;',
'   if(o.some(function(m){return typeof msgMine==="function"&&msgMine(m,t)}))mine++;',
'   if(typeof sentSeen==="function"&&!sentSeen(t))hid++;',
'  });',
'  return {mailbox:view.dept,conversationsWithSentMail:n,onesISent:mine,hiddenFromMeByR15:hid};',
' }catch(e){return String(e.message||e)}',
'};',
'/* __sentmine:end */<' + '/script>',
''
].join('\n');

s = s.replace(/\s*$/, '\n') + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  " + done + " edits + the helper");
