/* 26 Nov 2026 - "Gulab owned it, Jagjit replied, the owner became Jagjit."

   THE CAUSE, established from the code and the activity log rather than guessed:

     * No server rule can have done it. Every auto rule (alias, domain, name, trail, buddy)
       goes through `rm_auto_give`, whose UPDATE ends `... and owner_id is null`, and each
       rule's own query also tests `owner_id is null`. An owned conversation is untouchable
       by a rule. The activity log confirms the vocabulary: a rule writes "Auto-assigned to
       X - ... (alias rule)" with no user, a person writes "Assigned to X by Y".
     * It was the app's AUTO-TAKE ON REPLY (16 Nov). `sendReply` ran
         if(!t.owner && t.dept===who(ME).dept){ t.owner=ME; ... }
       and it judged "unassigned" from the copy of the conversation in THAT browser. A
       browser whose copy was loaded before Gulab took it still showed no owner, so replying
       set the replier as owner locally and the next save wrote that over Gulab on the
       server - and because the auto-take wrote NO history line, nothing in rm_activity
       records it. That is exactly why it looked like it happened by itself.

   THE FIX, as instructed: **a reply never changes the owner.** The owner changes only when
   a person assigns it, transfers it, or presses Take on an unassigned conversation. Someone
   who replies becomes a PARTICIPANT - they keep the conversation in My work and still see it
   - which is already how My work works since this morning.

   A reply still moves a conversation from "new" to "open" (it has been answered), because
   that is a status, not an owner.

   Run:  node server/patch-reply-never-takes.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__noautotake:start")) { console.log("already there - nothing changed"); process.exit(0); }

const old = " if(!t.owner&&t.dept===who(ME).dept){t.owner=ME;if(t.status==='new')t.status='open'}";
if (!s.includes(old)) throw new Error("the auto-take line in sendReply was not found");
s = s.replace(old,
  " /* __noautotake:start 26 Nov 2026: REPLYING NEVER CHANGES THE OWNER. This line used to take an\n" +
  "    unassigned conversation - but it judged \"unassigned\" from the copy in THIS browser, so a\n" +
  "    stale copy (loaded before a colleague took it) silently wrote the replier's name over the\n" +
  "    real owner on the server, with no history line to show for it. That is how Gulab's\n" +
  "    conversation became Jagjit's. The owner now changes only when a person assigns, transfers\n" +
  "    or presses Take; replying makes you a participant, which already keeps it in My work. */\n" +
  " if(t.status==='new'&&!t.owner)t.status='open';   /* answered - a status, not an owner */\n" +
  " try{t.parts=Array.isArray(t.parts)?t.parts:[];if(t.parts.indexOf(ME)<0)t.parts.push(ME)}catch(e){}\n" +
  " /* __noautotake:end */");

fs.writeFileSync(file, s);
console.log("patched .tmp/email.html - replying no longer takes a conversation; the replier becomes a participant");
