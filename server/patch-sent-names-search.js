/* patch-sent-names-search.js - 28 Nov 2026
 *
 * "Robin's mail is in Sent in Gmail but I cannot find it in Ashish's Sent."
 *
 * MEASURED on the live site as him (1,070 conversations, Sent 685 rows): the mail IS there -
 * searching 26314003986 brings up his 25 Sept, 28 Sept, 29 Sept, 1 Oct, 9/12/21/29/30 Oct and
 * 13 Nov mails, the very rows of the Gmail screenshot. But the rows read
 *
 *     To: Kind reg          instead of          To: Robin Vos | Loods 5
 *
 * so nobody can find Robin by eye, and typing "robin" in the search box does not find them
 * either. Two faults, both here:
 *
 * 1 · goodName() threw away every name containing "|" - and Loods 5 write their names
 *     "Robin Vos | Loods 5", which is exactly what the To: header carries. With the header name
 *     refused, the row fell back to the CONTACT name for r.vos@loods5.nl, which had been
 *     harvested from a signature's first line - the sign-off "Kind regards" -> "Kind reg".
 *     Now: a bar (or a middle dot) is allowed in a name, and a SIGN-OFF IS NEVER A NAME
 *     (Kind regards, Best regards, Thanks, Rgds, BR, Cheers, Met vriendelijke groet,
 *     Mit freundlichen Grüßen, Cordialement, Saludos, Yours sincerely …) - in the To: column,
 *     in Contacts and in the signature reader, because all three ask the same goodName().
 *
 * 2 · the search box never looked at who a mail went TO. It matched the sender, the subject,
 *     the preview, the promise and the owner - so "robin" could not find a mail addressed to
 *     Robin. Now the recipients (To and Cc) of the mails WE sent are searched too, memoised
 *     per conversation so a keystroke stays cheap.
 *
 * No rule changes: nothing about who may see what, no folder, owner, status or server change.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-sent-names-search.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__signoff")) { console.log("already applied - nothing to do"); process.exit(0); }

let done = 0;
function edit(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(name + ": found " + n + " times, expected 1");
  s = s.replace(from, to);
  console.log("  edit " + (++done) + " ok  " + name);
}

const BUILD_OLD = "APP_BUILD='2026-11-28-7'";
if (s.split(BUILD_OLD).length - 1 !== 1) throw new Error("APP_BUILD 2026-11-28-7 not found exactly once");
s = s.replace(BUILD_OLD, "APP_BUILD='2026-11-28-8'");
console.log("  APP_BUILD -> 2026-11-28-8");

/* 1 - the search box also looks at who we wrote to */
edit("search matches the recipients",
  "if(q)r=S.threads.filter(t=>[t.from,t.email,t.sub,t.pre,t.promise,who(t.owner)?.name].join(' ').toLowerCase().includes(q));",
  "if(q)r=S.threads.filter(t=>[t.from,t.email,t.sub,t.pre,t.promise,who(t.owner)?.name,toCcOf(t)].join(' ').toLowerCase().includes(q));   /* __findto */"
);

const BLOCK = [
'<script>/* __signoff:start  28 Nov 2026 - a name with a bar in it is a name, a sign-off never is,',
'   and the search box looks at who we wrote to. server/patch-sent-names-search.js */',
'const SIGNOFF=/^(?:(?:kind(?:est)?|best|warm(?:est)?|many|with|all|much)\\s+)?(?:regards?|reg|wishes|thanks(?:\\s+and\\s+regards?)?|thank\\s*you|rgds|brgds|b\\.?r\\.?|cheers|sincerely|respectfully|yours(?:\\s+(?:sincerely|faithfully|truly))?|met\\s+vriendelijke\\s+groet(?:en)?|mit\\s+freundlichen\\s+gr(?:\\u00fc|u)(?:\\u00df|ss)en|freundliche\\s+gr(?:\\u00fc|u)(?:\\u00df|ss)e|cordialement|bien\\s+(?:\\u00e0|a)\\s+vous|salutations|saludos|atentamente|obrigad[oa]|grazie|merci|danke|gracias|looking\\s+forward)$/i;',
'/* "Robin Vos | Loods 5" is how Loods 5 write their names: the bar is a separator, not markup. */',
'const _gnOld=goodName;',
'goodName=function(x){',
' const v=String(x==null?\'\':x).trim();',
' if(!v)return false;',
' if(SIGNOFF.test(v.replace(/[,.!;:\\u2013\\u2014-]+$/,\'\').trim()))return false;   /* a sign-off is never a name */',
' if(/[|\\u00b7\\u2022]/.test(v)&&!/[<>\\[\\]{}@]|https?:|cid:|www\\./i.test(v))return _gnOld(v.replace(/\\s*[|\\u00b7\\u2022]\\s*/g,\' \'));',
' return _gnOld(v)};',
'try{window.goodName=goodName}catch(e){}',
'/* who our own mails went to - memoised per conversation, so typing in the search box stays',
'   cheap on a mailbox holding thousands of conversations. */',
'function toCcOf(t){',
' try{',
'  if(!t||!t.msgs)return \'\';',
'  const n=t.msgs.length;',
'  if(t._tcN===n&&typeof t._tc===\'string\')return t._tc;',
'  let s=\'\',k=0;',
'  for(let i=n-1;i>=0&&k<6;i--){const m=t.msgs[i];if(!m||!(m.ours||m.by))continue;',
'   s+=\' \'+String(m.to||\'\').slice(0,300)+\' \'+String(m.cc||\'\').slice(0,300);k++}',
'  try{Object.defineProperty(t,\'_tc\',{value:s,writable:true,enumerable:false,configurable:true});',
'      Object.defineProperty(t,\'_tcN\',{value:n,writable:true,enumerable:false,configurable:true})}catch(e){t._tc=s;t._tcN=n}',
'  return s;',
' }catch(e){return \'\'}}',
'try{window.toCcOf=toCcOf}catch(e){}',
'/* __signoff:end */<' + '/script>',
''
].join('\n');

s = s.replace(/\s*$/, '\n') + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  " + done + " edit(s) + the sign-off / bar-name / search-recipients block");
