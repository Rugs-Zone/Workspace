/* 23 Nov 2026 — Admin → Users & passwords keeps showing an old list.
 *
 * PROVED, twice, against the live server: `boot` returns 83 people including
 * Jatin Munjal, both to Priya and to Priyanshu's own login. The server is
 * right; the screen is not. Until now the list was re-fetched only (a) at
 * sign-in and (b) once when the Users tab was first opened, so a tab that had
 * been open all day through several versions could sit on a stale list, and
 * everything after that depended on somebody pressing ↻ Refresh.
 *
 * Now the Users tab re-fetches by itself: the first draw after it is opened,
 * and then whenever the list in front of you is more than 10 seconds old. The
 * app already redraws every 15 seconds, so the list corrects itself without
 * anybody pressing anything. It still stands aside while a field in the table
 * has the cursor in it, so nothing half-typed is wiped, and ↻ Refresh still
 * forces it immediately.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-users-autorefresh.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;

function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) { console.error('STOP: "' + what + '" matched ' + c + ' times, expected 1'); process.exit(1); }
  s = s.replace(find, repl);
  n++;
  console.log('  ok  ' + what);
}

/* remember when the list was last taken from the server */
one(
  "let USRTAB=false;",
  "let USRTAB=false,USRGOT=0;/* USRGOT: when the people list last came from the server */",
  'remember when the list was last fetched'
);

/* stamp it on every successful fetch */
one(
  "  api('boot').then(function(b){applyBoot(b);render()})",
  "  USRGOT=Date.now();\n  api('boot').then(function(b){applyBoot(b);USRGOT=Date.now();render()})",
  'stamp the time of each fetch'
);

/* and re-fetch whenever what is on screen is more than 10 seconds old */
one(
  "  if(!USRTAB){USRTAB=true;admUsrReload(false)}/* opened the tab: get the newest list once */",
  "  if(!USRTAB){USRTAB=true;USRGOT=0}/* opened the tab */\n" +
  "  if(Date.now()-USRGOT>10000)admUsrReload(false);/* keep it fresh while the tab is open */",
  'keep the list fresh while the tab is open'
);

fs.writeFileSync(F, s);
console.log(n + ' edit(s) applied to ' + F);
