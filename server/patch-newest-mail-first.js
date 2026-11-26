/* 26 Nov 2026 - THE CAUSE behind "a mail is in Gmail's inbox but never shows in Rugs Email",
   fixed so it cannot happen again.

   HOW THE SYNC WALKS. `syncBox` reads Gmail forwards from `rm_mailboxes.cursor_s`, one day
   at a time (WINDOW = 1 day), at most `budget` = 25 messages per mailbox per run:

       from = cursor - 3600 ; to = min(now + 60, cursor + WINDOW)
       ...
       if (!r.complete) { live = false; break; }     <-- the window filled the budget
       cursor = to > nowS ? nowS - 600 : to;         <-- only then does the cursor move

   So the walk is STRICTLY SEQUENTIAL, and a window that fills the budget does not advance
   the cursor at all. While the cursor is behind "now", NOTHING NEWER IS EVER FETCHED:

     * a mailbox that was offline, or that Gmail kept failing to list, stays blind to today;
     * worse, ANY deliberate rewind does it. The reconcile job shipped on 25 Nov
       (`reconcile-gmail-21nov-2026-11-25`) wound teampulse@ and shipping@ back to 21 Nov to
       re-read 433 and 831 missing messages. Until that catch-up finishes, mail newer than
       the cursor cannot arrive - which is exactly the state in which Aman Singh Verma's
       25 Nov mail sat in Gmail's inbox and was nowhere in the app, while Ashok could still
       reply in the same conversation (its earlier mails were already stored).

   THE FIX: the newest mail is never starved. Whenever the cursor is more than two hours
   behind, the last two hours are read FIRST, with its own slice of the budget, before the
   catch-up walk continues. The cursor is NOT moved by this, so the catch-up still fills the
   gap behind it - mail simply stops having to queue behind days of history.

   It is cheap: `syncWindow` lists the ids for the window and drops every one already in
   rm_messages (`have`), so a window with nothing new costs one Gmail list and one database
   check, and fetches nothing.

   Run:  node server/patch-newest-mail-first.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/rugs-mail.bundle.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__newestfirst")) { console.log("already there - nothing changed"); process.exit(0); }

const old = "  let saved = 0, scanned = 0, live = true, skipped = 0, stalled = false;\n" +
            "  while (Date.now() - t0 < DEADLINE_MS) {";
if (!s.includes(old)) throw new Error("the start of syncBox's forward walk was not found");

const add = "  let saved = 0, scanned = 0, live = true, skipped = 0, stalled = false;\n" +
  "  /* __newestfirst 26 Nov 2026: THE NEWEST MAIL IS NEVER STARVED. The walk below is\n" +
  "     sequential from cursor_s and a window that fills the budget does not advance it, so\n" +
  "     while the cursor is behind (an outage, Gmail list errors, or a job that wound it back\n" +
  "     to re-read a window) no newer mail was fetched at all and a mail sitting in Gmail's\n" +
  "     inbox today never reached the app. Read the last two hours FIRST with its own slice of\n" +
  "     the budget; the cursor is not moved, so the catch-up still fills the gap behind it. */\n" +
  "  if (nowS - cursor > 2 * 3600) {\n" +
  "    try {\n" +
  "      const r0 = await syncWindow(box, tok, nowS - 2 * 3600, nowS + 60, Math.max(5, Math.floor(budget / 2)), t0);\n" +
  "      saved += r0.saved;\n" +
  "      scanned += r0.scanned;\n" +
  "      if (r0.saved) console.log(\"newest first\", box, \"saved\", r0.saved, \"mail from the last 2 hours while the cursor is\", Math.round((nowS - cursor) / 3600), \"hour(s) behind\");\n" +
  "    } catch (e) {\n" +
  "      console.log(\"newest-first window failed\", box, String(e.message).slice(0, 120));\n" +
  "    }\n" +
  "  }\n" +
  "  while (Date.now() - t0 < DEADLINE_MS) {";

s = s.replace(old, add);
fs.writeFileSync(file, s);
console.log("patched rugs-mail.bundle.mjs - the newest mail is read first whenever the sync cursor is behind");
