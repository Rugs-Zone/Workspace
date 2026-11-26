/* patch-lock-row-per-mail.js — 26 Nov 2026
 *
 * R17 LOCKED by the user: "One row per mail, each with its own time."
 *
 * Everything that makes per-mail rows work is already in the app and tested
 * (explode() sets _one/_mi, rowName() names that mail's own sender, capRows()
 * counts conversations so the list reaches as far as it ever did, convCount()
 * says "N conversations", __rowmail opens the clicked mail and __openOneMail
 * stops the newest-three rule putting other mails on top of it).
 *
 * 25 Nov's patch-one-row-per-conv.js and 26 Nov's patch-back-to-yesterday.js
 * only forced LV().conv to true. This flips that one decision, nothing else.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-lock-row-per-mail.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
const before = s;
let n = 0;

function one(old, neu, what) {
  const hits = s.split(old).length - 1;
  if (hits === 0) {
    if (s.indexOf(neu) >= 0) { console.log("already done: " + what); return; }
    throw new Error("NOT FOUND: " + what);
  }
  if (hits > 1) throw new Error("found " + hits + " times, expected 1: " + what);
  s = s.replace(old, neu);
  n++;
  console.log("patched: " + what);
}

/* 1. the default */
one(
  "const LV_DEF={sort:'date',dir:'desc',vf:'all',pane:'right',conv:true,lines:1};",
  "const LV_DEF={sort:'date',dir:'desc',vf:'all',pane:'right',conv:false,lines:1};",
  "LV_DEF - default is one row per mail"
);

/* 2. the forced value every caller gets */
one(
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:true});",
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:false});"
  + "   /* __rowpermail 26 Nov 2026: R17 locked - one row per mail for everyone."
  + " Forced, not a preference, because the Conversations choice was taken out of the View menu on 24 Nov."
  + " One word (true) puts conversation rows back. */",
  "LV() - force one row per mail"
);

if (s === before) { console.log("\nnothing to do."); process.exit(0); }
fs.writeFileSync(F, s);
console.log("\n" + n + " edit(s) written to " + F);
