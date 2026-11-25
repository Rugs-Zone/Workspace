/* 25 Nov 2026 - STEP 1c: a heavy conversation sends the newest THREE mails in full, not five.

   MEASURED: opening the ten heaviest conversations sends back 0.9-4.2 MB (median 2.3 MB)
   and takes 0.8-2.2 s. Nearly all of those bytes are the FULL HTML of the newest five
   mails - and in a 95-deep thread each mail quotes everything before it, so one full mail
   is hundreds of kilobytes on its own. The older mails already come as short summaries.

   Five was more than anything needs:
     * the reading pane expands only the NEWEST mail; the rest are one-line until clicked,
       and clicking one fetches it on its own (openLight, in place since 19 Nov)
     * a reply quotes the newest THREE mails (patch-heavy-trail.js)

   So three is the number that keeps every quote exact and stops fetching two whole mails
   from Gmail on every single open. Nothing else changes: ask for any mail by id and it
   still comes back in full.

   Run:  node server/patch-thread-full3.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/rugs-mail.bundle.mjs";
let s = fs.readFileSync(file, "utf8");
const old = "  const FULL_N = 5;";
const neu = "  const FULL_N = 3;   /* 25 Nov 2026: the pane opens the newest, a reply quotes the newest 3 - see server/patch-thread-full3.js */";
if (s.includes(neu)) { console.log("already done - nothing changed"); process.exit(0); }
if (!s.includes(old)) throw new Error("FULL_N was not found in rugs-mail.bundle.mjs");
if (s.indexOf(old) !== s.lastIndexOf(old)) throw new Error("FULL_N appears more than once");
s = s.replace(old, neu);
fs.writeFileSync(file, s);
console.log("patched rugs-mail.bundle.mjs - the newest 3 mails come in full, the rest as summaries");
