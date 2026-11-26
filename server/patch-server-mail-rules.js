/* patch-server-mail-rules.js - 26 Nov 2026
 *
 * The office server half of the Mail rules page.
 *
 *   1. `mail_rules` becomes a shared setting, so the switches on Admin -> Mail rules are
 *      stored once for the whole company instead of in one browser. Without this the app's
 *      saveSetting answers "Unknown setting" and the page says so rather than pretending.
 *   2. `mail_rules` is ADMIN-ONLY, like the other shared lists.
 *   3. FIXES A REAL HOLE found while doing it: `mgr_first_boxes` was in SHARED_KEYS but NOT
 *      in ADMIN_KEYS, so ANY signed-in person could call saveSetting and make a whole team
 *      manager-first - which hides every unassigned conversation from that team's members
 *      AND switches off every automatic assign rule for that mailbox on the server. It is
 *      admin-only from now on.
 *
 * Both copies are patched: server/local-server/rugs-mail.bundle.mjs (what the office
 * machine actually runs, shipped by the self-updater) and server/rugs-mail.index.ts (the
 * older Supabase edge-function source kept in the repo), so the two do not drift further.
 *
 * Safe to run again. Remember to put a new value in server/local-server/version.txt, or the
 * office machine will not pick it up.
 *
 * Run:  node server/patch-server-mail-rules.js
 */
const fs = require("fs");
const path = require("path");

const FILES = [
  path.join(__dirname, "local-server", "rugs-mail.bundle.mjs"),
  path.join(__dirname, "rugs-mail.index.ts")
];

let touched = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log("not here, skipped: " + path.basename(f)); continue; }
  let s = fs.readFileSync(f, "utf8"), before = s;

  /* SHARED_KEYS: add mail_rules, and mgr_first_boxes if this copy is missing it */
  s = s.replace(/((?:var|const) SHARED_KEYS = \[)([^\]]*)(\])/, (m, a, list, z) => {
    if (/"mail_rules"/.test(list)) return m;
    let out = list.replace(/\s*$/, "");
    if (!/"mgr_first_boxes"/.test(out)) out += ', "mgr_first_boxes"';
    return a + out + ', "mail_rules"' + z;
  });

  /* ADMIN_KEYS: only an Admin may change the rules or the manager-first list */
  s = s.replace(/((?:var|const) ADMIN_KEYS = \[)([^\]]*)(\])/, (m, a, list, z) => {
    let out = list.replace(/\s*$/, "");
    if (!/"mgr_first_boxes"/.test(out)) out += ', "mgr_first_boxes"';
    if (!/"mail_rules"/.test(out)) out += ', "mail_rules"';
    return a + out + z;
  });

  if (s === before) { console.log("already done: " + path.basename(f)); continue; }
  fs.writeFileSync(f, s);
  touched++;
  const sk = (s.match(/(?:var|const) SHARED_KEYS = \[[^\]]*\]/) || [""])[0];
  const ak = (s.match(/(?:var|const) ADMIN_KEYS = \[[^\]]*\]/) || [""])[0];
  console.log("patched " + path.basename(f));
  console.log("   " + sk);
  console.log("   " + ak);
}
console.log(touched + " file(s) changed. Put a new value in server/local-server/version.txt so the office server picks it up.");
