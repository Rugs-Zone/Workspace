/* 26 Nov 2026 - a team member's Inbox is THEIR OWN mail.

   Asked for, and confirmed with the user before changing anything:

     "Team owner will see email in inbox which all are coming and what their team members are
      sending, or in sent all sent will come. But in team member in inbox that email will show
      in which they are auto assigned and in which they are doing the conversation with that
      buyer. As of now in team members everyone email is coming."

   WHAT WAS ALREADY RIGHT (checked before touching it): the manager / lead / CRM / admin
   already see everything in the team, in the Inbox and in Sent; a member already does NOT
   see a colleague's assigned mail; a member already sees mail assigned to them and any
   conversation they have replied in; and Sent already shows a member only what they sent.

   THE ONE THING THAT DIFFERED: mail nobody has been given yet was shown to the WHOLE team,
   which is what "everyone's email is coming" meant.

   WHAT THIS DOES, exactly as the user chose: unassigned mail is **out of a member's Inbox**
   and shows **under "Needs owner"** (and behind the "Unassigned" chip), so it is still there
   to be picked up and nothing is stranded. Managers, leads, CRM and admins are untouched.
   **Team Designing is left exactly as it is**, as asked.

   DELIBERATELY NOT USED: the existing "manager hands it out" switch (mgr_first_boxes, used
   for Team Designing). It would have done the hiding, but on the server `rm_auto_give`
   returns early for a mailbox in that list, so it also TURNS OFF auto-assign - which would
   have broken the "they see what is auto-assigned to them" half of the rule. This is
   app-side only; no server rule changes, so auto-assign keeps running exactly as now.

   The "Needs owner" count is unaffected: it is built with cnt(), which filters S.threads
   directly and never goes through seeMine.

   Run:  node server/patch-member-inbox-own.js   (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__memberinbox")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;
const sub = (what, from, to) => {
  if (s.split(from).length !== 2) { console.error("STOP - " + what + ": not found exactly once"); process.exit(1); }
  s = s.replace(from, to); n++;
};

/* the helpers, next to mgrFirst */
sub("helpers",
  "function seeMine(t){const p=who(ME);",
  "/* __memberinbox 26 Nov 2026: mail nobody has been given yet is not in a member's Inbox -\n" +
  "   it lives under \"Needs owner\" and behind the \"Unassigned\" chip, so it can still be\n" +
  "   picked up. Every team except Designing, which is left as it is. */\n" +
  "const UNASSIGNED_TEAM_INBOX=['designer@rugscreation.com'];   /* teams where it still shows to everyone */\n" +
  "function needsOwnerView(){try{\n" +
  " if(typeof filt!=='undefined'&&filt==='needs')return true;      /* the Unassigned chip */\n" +
  " return !!(view&&view.type==='fav'&&(view.id==='needs'||view.id==='assign'));\n" +
  "}catch(e){return false}}\n" +
  "function hideUnowned(t){try{\n" +
  " /* mailOf() is d.box+DOMAIN, so `box` holds only the local part - match on that, which is\n" +
  "    right whichever form the department carries. */\n" +
  " const d=dept(t&&t.dept),loc=x=>String(x||'').toLowerCase().split('@')[0];\n" +
  " const a=loc(d&&mailOf(d)),b=loc(d&&d.box);\n" +
  " if(UNASSIGNED_TEAM_INBOX.some(x=>{const k=loc(x);return !!k&&(k===a||k===b)}))return false;   /* Designing: unchanged */\n" +
  " return !needsOwnerView();\n" +
  "}catch(e){return false}}\n" +
  "function seeMine(t){const p=who(ME);");

/* the rule itself */
sub("the unassigned branch of seeMine",
  " if(!t.owner)return !mgrFirst(t.dept);        /* nobody has taken it: the whole team can pick it up */",
  " /* __memberinbox: nobody has taken it. It is NOT in a member's Inbox any more - it shows\n" +
  "    under \"Needs owner\" and behind the \"Unassigned\" chip, so it can still be picked up.\n" +
  "    The manager / lead / CRM / admin returned true above, so they are unaffected. */\n" +
  " if(!t.owner)return !mgrFirst(t.dept)&&!hideUnowned(t);");

fs.writeFileSync(f, s);
console.log("patch-member-inbox-own: " + n + " edit(s) applied");
