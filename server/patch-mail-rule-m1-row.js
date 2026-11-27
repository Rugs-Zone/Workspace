/* patch-mail-rule-m1-row.js - 27 Nov 2026
 *
 * USER'S WORDS: "make mandatory rule in setting that rugs email keep tab under 250 mb".
 *
 * This puts rule M1 on the Mail rules page (Admin -> 📜 Mail rules, and the read-only copy
 * in the menu under your own name) as a MANDATORY rule: a new kind, k:'req', which gets the
 * badge "Mandatory", the words "cannot be switched off" where the On/Off button would be,
 * and the live megabyte figure read from the guard that enforces it
 * (server/patch-mem-cap-m1.js). It is also added to the page's "Checks right now" panel, so
 * a tab creeping towards the ceiling is visible without opening the console.
 *
 * WHY THIS IS A SEPARATE PATCH AND NOT A RE-RUN OF patch-mail-rules.js:
 *   server/mail-rules.view.js has drifted AHEAD of the shipped app - it carries an
 *   unshipped rule R30a (marked __r30arule, "bug 16") from another terminal, whose helper
 *   r30aTeam() and whose chooser button data-r30a do not exist in this app, and whose
 *   strings had three unescaped apostrophes that stopped the whole file parsing. Re-running
 *   the view patch would have shipped that broken, half-wired rule along with M1. The
 *   apostrophes are fixed in the view file so the next person's run is not broken, M1 is in
 *   there too, and this patch adds ONLY M1 to the app.
 *
 * Safe to run twice: every edit is guarded by the marker __m1row.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-mem-cap-m1.js
 *       node server/patch-mail-rule-m1-row.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
const n0 = s.length;
const Q = String.fromCharCode(39);
const B = String.fromCharCode(92);   /* an apostrophe, so this file's own strings stay plain */

if (s.includes("__m1row")) { console.log("already applied - nothing to do"); process.exit(0); }
if (!s.includes("__rules:start")) throw new Error("the Mail rules block is missing - run patch-mail-rules.js first");

let n = 0;
function one(find, rep, why) {
  const i = s.indexOf(find);
  if (i < 0) throw new Error("could not find the place for: " + why);
  if (s.indexOf(find, i + find.length) >= 0) throw new Error("found more than once: " + why);
  s = s.slice(0, i) + rep + s.slice(i + find.length);
  n++;
  console.log("  " + why);
}

/* ---- 1. the rule itself, the new group, and the live-number helper ---- */
const M1 = [
  "  },",
  "  /* ------------------------------------------------- speed and memory ---- */",
  "  /* __m1row 27 Nov 2026, asked for in these words: \"make mandatory rule in setting that",
  "     rugs email keep tab under 250 mb\". k:'req' = MANDATORY - no switch, here or anywhere. */",
  "  {",
  "    id: 'M1', g: 'Speed and memory', k: 'req', n: 'Rugs Email keeps this tab under 250 MB',",
  "    now: () => {",
  "      const m = rMemNow();",
  "      return 'The ceiling is 250 MB and it cannot be switched off. This tab is holding '",
  "        + (m.mb === null ? 'an amount this browser does not report' : m.mb + ' MB (' + m.pc + '% of 250 MB)')",
  "        + '. Over 200 MB the page clears its copies early; over 250 MB it drops every stored mail, '",
  "        + 'attachment, thumbnail and drawn row except the conversation on screen and the last one you '",
  "        + 'looked at, and fetches them again when you next need them.'",
  "        + (m.hits ? ' It has had to do that ' + rPlural(m.hits, 'time') + ' since this page was opened.' : '');",
  "    },",
  "    who: 'Everybody, on every PC and phone. Nothing on the server and no mail is touched - only the copies this browser is holding.',",
  "    brk: [",
  "      'There is deliberately no switch. A tab that grows all day is what stopped mail on 26 November (\"mail has been stopped on all places, pages are under waiting\"), so the ceiling is not something an admin can raise by mistake.',",
  "      'What it drops are copies, never mail: a stripped conversation keeps its row and preview and is fetched again when it is opened. Nothing is deleted on the server, no folder, owner or read/unread state is changed, and files on a mail being written are never thrown away.',",
  "      'It is the ceiling over the five budgets underneath it - loaded mail 35 MB, opened mail 15 MB, attachments 10 MB, thumbnails 4 MB, files being attached 15 MB, drawn rows up to 2,000. Raising one of those in a later build cannot take the tab past 250 MB, because this rule is measured on the whole tab.',",
  "      'Check it on any screen: paste rzMemCap() into the browser console, or read the number in this row.'",
  "    ]",
  "  }",
  "];",
  "/* M1: the live number, read from the guard that enforces it. If that block is not in the",
  "   build, say so plainly rather than print a reassuring zero. */",
  "function rMemNow() {",
  "  try {",
  "    const f = window.rzMemCap;",
  "    if (typeof f !== 'function') return { mb: null, pc: null, hits: 0, live: false };",
  "    const r = f() || {};",
  "    const mb = (typeof r.nowMB === 'number') ? r.nowMB : null;",
  "    return { mb: mb, pc: mb === null ? null : Math.round(mb / 250 * 100), hits: r.timesItHadToAct || 0, live: true };",
  "  } catch (e) { return { mb: null, pc: null, hits: 0, live: false }; }",
  "}"
].join("\n");

one(
  "  }\n];\nfunction rById(id)",
  M1 + "\nfunction rById(id)",
  "rule M1 added to the registry, with rMemNow() for its live number"
);

one(
  "const RGROUPS = ['Inbox', 'Sent', 'Needs owner', 'My work', 'Ownership', 'Roles', 'Things that hide mail', 'Built but not switched on'];",
  "const RGROUPS = ['Inbox', 'Sent', 'Needs owner', 'My work', 'Ownership', 'Roles', 'Things that hide mail', 'Speed and memory', 'Built but not switched on'];",
  "the new 'Speed and memory' section on the page"
);

/* ---- 2. the Mandatory badge ---- */
one(
  "  if (r.k === 'off') return '<span class=\"rlbadge rlb-nl\">Not live</span>';",
  "  if (r.k === 'off') return '<span class=\"rlbadge rlb-nl\">Not live</span>';\n" +
  "  if (r.k === 'req') return '<span class=\"rlbadge rlb-req\">Mandatory</span>';",
  "the \"Mandatory\" badge"
);

one(
  "'.rlb-nl{background:rgba(255,160,0,.16);color:#8a5a00}',",
  "'.rlb-nl{background:rgba(255,160,0,.16);color:#8a5a00}',\n" +
  "    '.rlb-req{background:rgba(200,40,40,.13);color:#9b2226}',",
  "the badge's colour (red, so it reads as a rule and not an option)"
);

/* ---- 3. where the On/Off button would be: no switch, ever ---- */
one(
  "  else if (r.k === 'off') { act = '<em style=\"font-size:11.5px;opacity:.6\">not in this build</em>'; }",
  "  else if (r.k === 'off') { act = '<em style=\"font-size:11.5px;opacity:.6\">not in this build</em>'; }\n" +
  "  else if (r.k === 'req') { act = '<em style=\"font-size:11.5px;opacity:.6\">cannot be switched off</em>'; }",
  "no switch on a mandatory rule, for an admin or anybody else"
);

/* ---- 4. the "Checks right now" panel reads the real figure ---- */
const CHK = [
  "  /* __m1row M1 (mandatory): this tab stays under 250 MB */",
  "  try {",
  "    const m = rMemNow();",
  "    if (!m.live) out.push({ bad: true, t: 'Rule M1 cannot be checked on this page', d: 'The memory guard is not in this build, so nothing is holding the tab under 250 MB. Tell the terminal: \"M1 is not running\".' });",
  "    else if (m.mb === null) out.push({ bad: false, t: 'Rule M1 is running, but this browser does not report the tab" + B + Q + "s memory', d: 'The ceiling is still enforced from what Rugs Email is holding. Chrome and Edge report the real figure.' });",
  "    else if (m.mb > 250) out.push({ bad: true, t: 'This tab is over the 250 MB ceiling (' + m.mb + ' MB)', d: 'The guard is clearing copies now. If it stays over, reload the page and tell the terminal: \"M1 is being breached\".' });",
  "    else if (m.pc >= 80) out.push({ bad: true, t: 'This tab is at ' + m.pc + '% of the 250 MB ceiling (' + m.mb + ' MB)', d: 'The page is clearing its copies early. Nothing is lost - a conversation it drops is fetched again when you open it.' });",
  "    else out.push({ bad: false, t: 'Rule M1 is holding: ' + m.mb + ' MB of 250 MB (' + m.pc + '%)', d: 'Mandatory, with no switch. ' + (m.hits ? 'It has had to clear copies ' + rPlural(m.hits, 'time') + ' since this page was opened.' : 'It has not had to clear anything since this page was opened.') });",
  "  } catch (e) { }",
  "  if (!rulesSaveable()) out.push"
].join("\n");
one("  if (!rulesSaveable()) out.push", CHK, "M1 added to the \"Checks right now\" panel");

fs.writeFileSync(F, s);
console.log("ok  " + n + " edits (" + n0 + " -> " + s.length + " chars)");
