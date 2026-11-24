/* 24 Nov 2026 - FIX, found while testing the bulk-done question: a Quick step never acted on
 * the mails you had ticked, only on the one that was open.
 *
 * The Outlook pack decides what a quick step (and "Not junk", "Download all" etc.) runs on:
 *
 *     if (typeof SEL !== 'undefined' && SEL.size) {
 *       const l = [].slice.call(SEL).map(T_).filter(Boolean);     // <- always []
 *
 * SEL is a Set, and Array.prototype.slice on a Set returns an empty array (a Set has no
 * length and no numbered keys), so `l.length` was 0 every time and it quietly fell back to
 * `[t]` - the open conversation. Ticking twenty mails and running "Done & archive" therefore
 * did one of them, with the toast saying "1 mail".
 *
 * One fix: [...SEL]. Both copies are patched, the live one inside the mail app and the
 * readable source, so they cannot drift apart.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-quickstep-selection.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const FIND = '        const l = [].slice.call(SEL).map(T_).filter(Boolean);';
const REPL = '        const l = [...SEL].map(T_).filter(Boolean);   /* 24 Nov 2026: SEL is a Set - slice on it gave [] */';
let done = 0;
for (const F of ['.tmp/email.html', 'server/rugs-email-outlook-pack.js']) {
  let s = fs.readFileSync(F, 'utf8');
  const c = s.split(FIND).length - 1;
  if (c !== 1) throw new Error(F + ': expected 1 match, found ' + c);
  fs.writeFileSync(F, s.replace(FIND, REPL));
  console.log('patched ' + F);
  done++;
}
console.log('patch-quickstep-selection: ' + done + ' files patched');
