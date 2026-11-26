/* 26 Nov 2026 - "when someone is replying, all emails are not coming".

   MY BUG, introduced an hour earlier in patch-member-inbox-own.js. seeMine() decided the
   "nobody has taken it" case FIRST:

       if (!t.owner) return !mgrFirst(t.dept) && !hideUnowned(t);   <-- hides it
       if (t.owner === ME) return true;
       return isMyWork(t);                                          <-- never reached

   and since the 26 Nov rule "replying never changes the owner", a conversation a member
   answers STAYS unassigned. So the moment anyone replied to unassigned team mail, it
   vanished from their own Inbox - the exact opposite of the rule the user asked for
   ("in team member in inbox that email will show ... in which they are doing the
   conversation with that buyer").

   FIX: "am I working in this?" is decided FIRST - owner, replier, forwarder, or whoever it
   was assigned to - and only then does the unassigned rule apply. Nothing else changes:
   mail nobody has touched is still out of a member's Inbox and still under "Needs owner",
   and the manager / lead / CRM / admin still see everything.

   Run:  node server/patch-reply-keeps-it.js    (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__replykeeps")) { console.log("already there - nothing changed"); process.exit(0); }

const from =
" if(!t.owner)return !mgrFirst(t.dept)&&!hideUnowned(t);\n" +
" if(t.owner===ME)return true;                 /* mine */";
const to =
" /* __replykeeps 26 Nov 2026: decide \"am I working in this?\" FIRST. Replying does not set\n" +
"    an owner (26 Nov rule), so a conversation a member had answered was still 'unassigned'\n" +
"    and the line below hid it from their own Inbox the moment they replied. */\n" +
" const _worked=(typeof isMyWork==='function')?isMyWork(t):(t.msgs||[]).some(m=>msgMine(m,t));\n" +
" if(_worked)return true;                      /* mine, or I have written in it */\n" +
" if(!t.owner)return !mgrFirst(t.dept)&&!hideUnowned(t);\n" +
" if(t.owner===ME)return true;                 /* mine */";

if (s.split(from).length !== 2) { console.error("STOP - the seeMine branch was not found exactly once"); process.exit(1); }
s = s.replace(from, to);
fs.writeFileSync(f, s);
console.log("patch-reply-keeps-it: replying keeps the conversation in your own Inbox");
