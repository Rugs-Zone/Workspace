/* crude sanity check on the patched design-desk source before it is deployed */
const fs = require('fs');
const s = fs.readFileSync('server/design-desk.index.ts', 'utf8');
let d = 0, p = 0;
for (const c of s) { if (c === '{') d++; if (c === '}') d--; if (c === '(') p++; if (c === ')') p--; }
console.log('brace delta ' + d + ', paren delta ' + p + '  (0 = balanced)');
const want = {
  'async function attBytes': 1,
  'await attBytes(res': 1,
  'const TICK_BYTES': 1,
  'const BACKUP_TRIES': 1,
  'backup_tries': 3,
  /* the old three-copy decode: 1 left in my own comment, 1 in the user-triggered forward path
     (capped at 20 MB, runs when a person clicks, not once a minute - left alone on purpose) */
  'Uint8Array.from(atob(pad64': 2,
  'limit(5)': 0,                     // the five-at-a-time loop must be gone
};
let bad = 0;
for (const k of Object.keys(want)) {
  const n = s.split(k).length - 1;
  const ok = n === want[k];
  if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'FAIL ') + k.padEnd(30) + ' found ' + n + ', expected ' + want[k]);
}
console.log(bad ? '\n' + bad + ' PROBLEM(S)' : '\nlooks right');
process.exit(bad || d || p ? 1 : 0);
