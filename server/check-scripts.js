/* Parse every inline <script> of index.html (and the mail app / courier module that live inside it
   as base64), so a bad edit is caught before it reaches the live site.
   Usage: node server/check-scripts.js                                                            */
const fs = require('fs'), vm = require('vm');

function scripts(html, label) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc=/i.test(m[1])) continue;                    // external file, nothing to parse
    if (/type=["']?(?!text\/javascript|module)/i.test(m[1]) && /type=/i.test(m[1])) continue;
    out.push({ label, code: m[2], at: m.index });
  }
  return out;
}

let bad = 0, n = 0;
function run(html, label) {
  for (const s of scripts(html, label)) {
    n++;
    try { new vm.Script(s.code, { filename: label + '@' + s.at }); }
    catch (e) { bad++; console.log('FAIL ' + label + ' at char ' + s.at + ': ' + e.message); }
  }
}

const idx = fs.readFileSync('index.html', 'utf8');
run(idx, 'index.html');
console.log(n + ' inline scripts in index.html, ' + bad + ' failed');

for (const [name, re] of [['mail app', /var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"/],
                          ['courier module', /var COURIER_HTML_B64 = "([A-Za-z0-9+/=]+)"/]]) {
  const m = re.exec(idx);
  if (!m) { console.log(name + ': NOT FOUND'); bad++; continue; }
  const before = n, bb = bad;
  run(Buffer.from(m[1], 'base64').toString('utf8'), name);
  console.log(name + ': ' + (n - before) + ' scripts, ' + (bad - bb) + ' failed');
}

for (const f of ['mail-app.html', 'courier_dashboard.html', 'mail.html']) {
  if (!fs.existsSync(f)) continue;
  const before = n, bb = bad;
  run(fs.readFileSync(f, 'utf8'), f);
  console.log(f + ': ' + (n - before) + ' scripts, ' + (bad - bb) + ' failed');
}

console.log(bad ? '\n' + bad + ' SCRIPT(S) FAILED TO PARSE' : '\nall ' + n + ' scripts parse');
process.exit(bad ? 1 : 0);
