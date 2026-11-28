// 28 Nov 2026: a long To/Cc/Bcc went out as ONE header line. Mail headers must stay under 998 characters a
// line, so a Reply all to a big conversation got Gmail 400 "Invalid Cc header". Fold the address lists.
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
if (s.includes('function foldAddr(')) { console.log('already patched'); process.exit(0); }
const rep = (a, b) => { const c = s.split(a).length - 1; if (c !== 1) throw new Error('expected 1 of ' + a + ' found ' + c); s = s.replace(a, b); };
rep('function mime(o) {', 'function foldAddr(v) {\n  return String(v || "").split(/\\s*,\\s*/).filter(Boolean).join(",\\r\\n ");\n}\nfunction mime(o) {');
rep('To: ${o.to}', 'To: ${foldAddr(o.to)}');
rep('Cc: ${o.cc}', 'Cc: ${foldAddr(o.cc)}');
rep('Bcc: ${o.bcc}', 'Bcc: ${foldAddr(o.bcc)}');
fs.writeFileSync(f, s);
console.log('server bundle patched');
