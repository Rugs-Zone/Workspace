/* 20 Nov 2026 - "OTP is not showing on email, please enable that".
   Login-code / OTP mails were kept off people's screens by three different rules:
     1. they come from "no-reply" senders, and the Focused / Other split sends those to Other;
     2. unassigned mail is the manager's to hand out in a manager-first team (Designing, 20 Nov),
        so a designer never saw a code sent to designer@;
     3. our own Wizone codes are sent FROM marketing@rugscreation.com, so in that mailbox they
        counted as mail we had sent and sat in Sent instead of the Inbox.
   This patch makes a mail that carries a code: received mail -> Inbox, kept in Focused, and shown
   to everybody in the team.
   Run after `node server/mailapp-b64.js decode`, then `node server/mailapp-b64.js encode`.
   NOTE the regular expressions below deliberately use no backslashes ([0-9] not \d, [- ] not \s),
   so they survive being pasted through shells and patch files.                                   */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const n0 = s.length;
let done = 0;

function one(find, repl, label) {
  const i = s.indexOf(find);
  if (i < 0) throw new Error('NOT FOUND: ' + label);
  if (s.indexOf(find, i + 1) >= 0) throw new Error('NOT UNIQUE: ' + label);
  s = s.slice(0, i) + repl + s.slice(i + find.length);
  done++; console.log('ok  ' + label);
}
function all(find, repl, want, label) {
  const k = s.split(find).length - 1;
  if (k !== want) throw new Error('expected ' + want + ' x ' + label + ', found ' + k);
  s = s.split(find).join(repl);
  done++; console.log('ok  ' + label + ' (' + k + ')');
}

/* 1. the Focused / Other split: a code is never "Other" */
all(
  "r=r.filter(t=>tab==='other'?t.other:!t.other)",
  "r=r.filter(t=>tab==='other'?othTab(t):!othTab(t))",
  2, 'Focused/Other split uses othTab'
);

/* 2. a code is received mail even when it came from one of our own addresses (RugsWiz sends the
      Wizone codes from marketing@), as long as nobody wrote it by hand in Rugs Email */
one(
  "const recvMsg=(m,t)=>!(m.by||m.ours)||colleagueIn(m,t)||toThisBox(m,t);",
  "const recvMsg=(m,t)=>!(m.by||m.ours)||colleagueIn(m,t)||toThisBox(m,t)||(!!m&&!m.by&&isOtp(t));   /* 20 Nov 2026: a login code is always received mail - our Wizone codes are sent from marketing@ */",
  'recvMsg counts a login code as received'
);

/* 3. the detector, the two rules it feeds, and a tag on the row */
const anchor = "const _lrMine=listRows;listRows=function(){return _lrMine().filter(_seeM)};";
const block = anchor + "\n" + `/* ================= 20 Nov 2026: LOGIN CODES / OTP MAILS ALWAYS SHOW =================
   A one-time code is only any use to the person signing in at that moment, so it can never wait
   for an owner, hide in a second tab, or sit in Sent. A mail carrying a code is therefore received
   mail (see recvMsg), is kept in the Focused tab, and is shown to EVERYBODY in the team - including
   a manager-first team like Designing, and including a conversation a colleague already owns.
   It is still not work: the server closes automatic mail as Auto, so a code adds nothing to
   anyone's open list, To assign, My work or the Home numbers.
   The patterns use no backslashes on purpose (see server/patch-otp-visible.js). */
const OTP_SUB=/((^|[^a-z])otps?([^a-z]|$)|one[- ]?time (password|pass word|passcode|pass code|code|pin)|(log|sign)[- ]?in code|login code|verification (code|pin)|security code|single[- ]?use code|passcode|access code|confirmation code|authentication code|2[- ]?step verification|two[- ]?factor|code *[:-] *[0-9]{3,8}|reset code|code is *[0-9]{3,8}|[0-9]{4,8} is your)/i;
const OTP_PRE=/((^|[^a-z])otps?([^a-z]|$)|one[- ]?time (password|passcode|code)|verification code|login code|security code|single[- ]?use code|reset code|code is *[0-9]{3,8}|[0-9]{4,8} is your)/i;
function isOtp(t){try{if(!t)return false;return OTP_SUB.test(String(t.sub||''))||OTP_PRE.test(String(t.pre||t.snippet||''))}catch(e){return false}}
function othTab(t){return !!(t&&t.other)&&!isOtp(t)}                               /* a code is never "Other" */
const _smOtp=seeMine;seeMine=function(t){return (t&&isOtp(t))?true:_smOtp(t)};     /* the whole team sees a code */
const _rowOtp=rowHTML;rowHTML=function(t){let h=_rowOtp(t);
 try{if(isOtp(t))h=h.replace('<div class="tags">','<div class="tags"><span class="tag" title="A login code - kept in Focused and shown to everyone in the team">\u{1F511} Login code</span>')}catch(e){}
 return h};`;
one(anchor, block, 'isOtp / othTab / seeMine / row tag');

/* 4. hasRecv() repeats the same three tests as recvMsg() by hand, and the five mail counts use it -
      so it must know about codes too, or the Inbox list and the Inbox count disagree. */
one(
  "function hasRecv(t){return t.msgs.some(m=>!(m.by||m.ours)||(m.ours&&!m.by&&m.email&&String(m.email).toLowerCase()!==String(t.box||'').toLowerCase())||toThisBox(m,t))}",
  "function hasRecv(t){return t.msgs.some(m=>recvMsg(m,t))}   /* 20 Nov 2026: one rule, so the Inbox list and every Inbox count agree (and a login code counts as received) */",
  'hasRecv uses recvMsg'
);

fs.writeFileSync(F, s);
console.log(done + ' edits, ' + n0 + ' -> ' + s.length + ' chars');
