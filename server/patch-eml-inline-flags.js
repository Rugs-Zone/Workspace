/* 24 Nov 2026 - the .eml reader keeps each file's cid and whether it was inline, so the
 * signature-picture rule (attSplit) is exact inside a previewed mail too, not a guess.
 *   node server/patch-eml-inline-flags.js   (then: node server/mailapp-b64.js encode)
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const a = "  mime:f.type||'application/octet-stream',bin:f.body||''}));";
if (s.split(a).length - 1 !== 1) throw new Error('anchor found ' + (s.split(a).length - 1) + ' times');
s = s.replace(a, "  mime:f.type||'application/octet-stream',bin:f.body||'',cid:f.cid||'',inline:f.disp==='inline'}));");
fs.writeFileSync(F, s);
console.log('email.html patched, 1 edit');
