/* 26 Nov 2026 - RESTORE YESTERDAY'S RULE (the last one changed).

   Undoes today's member-Inbox change. Back to the 25 Nov behaviour:

     * mail nobody has taken        -> the WHOLE team sees it in the Inbox and can pick it up
     * mail somebody has taken      -> the owner, anyone who worked in it, and the
                                       manager / lead / CRM / admin
     * manager / lead / CRM / admin -> everything, unchanged
     * Team Designing               -> unchanged, as it has been all along

   ONE LINE is changed: the `&&!hideUnowned(t)` is taken off the "nobody has taken it" return.

   LEFT IN PLACE on purpose, because none of it changes behaviour now:
     * the `_worked` early return added by patch-reply-keeps-it.js. With hideUnowned gone it
       is exactly equivalent to the 25 Nov code (an unassigned conversation returns true
       either way, and a taken one still ends at the same isMyWork test) - it just answers
       sooner. Removing it would be a bigger edit for no behaviour change.
     * the helpers UNASSIGNED_TEAM_INBOX / needsOwnerView / hideUnowned, now unused, so
       switching the rule back on later is one line: put `&&!hideUnowned(t)` back.

   Run:  node server/patch-restore-team-inbox.js   (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__teaminboxback")) { console.log("already there - nothing changed"); process.exit(0); }

const from = " if(!t.owner)return !mgrFirst(t.dept)&&!hideUnowned(t);";
const to = " /* __teaminboxback 26 Nov 2026: back to the 25 Nov rule - the whole team sees mail\n" +
           "    nobody has taken, so anyone can pick it up. To hide it from members again and put\n" +
           "    it under \"Needs owner\" instead, add `&&!hideUnowned(t)` back here. */\n" +
           " if(!t.owner)return !mgrFirst(t.dept);        /* nobody has taken it: the whole team can pick it up */";

if (s.split(from).length !== 2) { console.error("STOP - the member-Inbox line was not found exactly once"); process.exit(1); }
s = s.replace(from, to);
fs.writeFileSync(f, s);
console.log("patch-restore-team-inbox: yesterday's rule is back - the whole team sees unassigned mail again");
