/* index.html is mid-rebase and holds TWO copies of the mail app, with git's conflict markers around
   them: the upstream side (HEAD, from the other laptop) and the older local side. This keeps the
   upstream side and drops the older one, so index.html is a valid single page again; the local
   changes are re-applied on top afterwards by the patch scripts + mailapp-b64.js encode.
   A copy of the conflicted file is kept first, so nothing is lost. */
const fs = require('fs');
const P = 'index.html';
const s = fs.readFileSync(P, 'utf8');
const re = /<<<<<<< [^\r\n]*\r?\n([\s\S]*?)\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> [^\r\n]*(\r?\n)/g;
let hunks = 0;
const out = s.replace(re, (_m, head, nl) => { hunks++; return head + nl; });
if (hunks !== 1) { console.error('expected exactly 1 conflict hunk, found ' + hunks + ' — nothing written'); process.exit(1); }
const before = (s.match(/var EMAIL_HTML_B64/g) || []).length, after = (out.match(/var EMAIL_HTML_B64/g) || []).length;
if (after !== 1) { console.error('expected 1 EMAIL_HTML_B64 after resolving, found ' + after + ' — nothing written'); process.exit(1); }
fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/index.conflicted-' + Date.now() + '.html', s);
fs.writeFileSync(P, out);
console.log('resolved 1 conflict hunk; EMAIL_HTML_B64 ' + before + ' -> ' + after + ' (backup in .tmp)');
