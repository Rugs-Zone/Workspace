// Decode / re-encode the Rugs Email app that lives in index.html as EMAIL_HTML_B64.
//   node server/mailapp-b64.js decode   -> writes .tmp/email.html
//   node server/mailapp-b64.js encode   -> puts .tmp/email.html back into index.html (only that string)
// (Python is not installed on every laptop, so this is the Node version of the patch scripts' round-trip.)
const fs = require('fs');
const P = 'index.html', APP = '.tmp/email.html';
const src = fs.readFileSync(P, 'utf8');
const re = /var EMAIL_HTML_B64 = "([A-Za-z0-9+/=]+)"/;
const m = re.exec(src);
if (!m) { console.error('EMAIL_HTML_B64 not found'); process.exit(1); }
const start = m.index + m[0].indexOf('"') + 1, end = start + m[1].length;
if (process.argv[2] === 'decode') {
  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync(APP, Buffer.from(m[1], 'base64').toString('utf8'));
  console.log('decoded', m[1].length, 'base64 chars ->', APP);
} else if (process.argv[2] === 'encode') {
  const h = fs.readFileSync(APP, 'utf8');
  const out = Buffer.from(h, 'utf8').toString('base64');
  if (Buffer.from(out, 'base64').toString('utf8') !== h) { console.error('round-trip differs - aborting'); process.exit(1); }
  fs.writeFileSync(P, src.slice(0, start) + out + src.slice(end));
  console.log('re-encoded', APP, '->', P, '(only EMAIL_HTML_B64 changed)');
} else console.log('usage: node server/mailapp-b64.js decode|encode');
