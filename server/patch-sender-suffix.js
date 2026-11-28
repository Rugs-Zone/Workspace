// 28 Nov 2026: "Arun – Rugs Creation <teampulse@>" was never matched to Arun (3 name words, no person
// has that name), so mail he wrote in Gmail did not count as his and was missing from his Sent.
// The company / team part of a display name is now dropped before the name is matched.
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
if (s.includes('function cleanSender(')) { console.log('already patched'); process.exit(0); }
const one = (a, b) => { const c = s.split(a).length - 1; if (c !== 1) throw new Error('expected 1 of: ' + a + ' found ' + c); s = s.replace(a, b); };
one('function nmKey(s){', `/* __sendersuffix 28 Nov 2026: "Arun – Rugs Creation", "Ashok | Team Pulse", "Arun (Rugs Creation)" -> "Arun" */
function cleanSender(x){const raw=String(x||'');
 let s=raw.split(/\\s+[\\u2013\\u2014\\-|]\\s*|\\s*\\|\\s*|\\s*\\(/)[0];
 s=s.replace(/\\brugs?\\s*creations?\\b/ig,' ').replace(/\\bteam\\s*(pulse|alpha)\\b/ig,' ').replace(/\\s+/g,' ').trim();
 return s}
function nmKey(s){`);
one('const k=nmKey(m.fname||m.from);', 'const k=nmKey(cleanSender(m.fname||m.from));');
const m = s.match(/APP_BUILD='(\d{4}-\d{2}-\d{2})-(\d+)'/);
const nb = m[1] === '2026-11-28' ? '2026-11-28-' + (+m[2] + 1) : '2026-11-28-1';
s = s.replace(m[0], "APP_BUILD='" + nb + "'");
fs.writeFileSync(f, s);
console.log('patched, build', nb);
