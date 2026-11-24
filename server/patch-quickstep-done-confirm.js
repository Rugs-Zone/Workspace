/* 24 Nov 2026 - Rugs Email: a Quick step that marks mail done asks the same question as the
 * select-many bar (server/patch-bulk-done-confirm.js). A quick step can be run on every ticked
 * conversation at once, so "Done & archive" was a second way to close a hundred unanswered
 * buyer mails in one click.
 *
 * The step itself is unchanged; it is only held back until the question is answered, and the
 * conversations the person chose to leave open are left out of the WHOLE step (so they are not
 * archived either). A step run on mail that is already done behaves exactly as before.
 *
 * It patches both copies, so they cannot drift apart:
 *   - the live one embedded in the mail app (.tmp/email.html, between __olpack:start/end)
 *   - the readable source, server/rugs-email-outlook-pack.js
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-quickstep-done-confirm.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');

const FIND = `  function qsRun(step, list) {
    let n = 0, skipped = 0;`;
const REPL = `  function qsRun(step, list) {
    /* 24 Nov 2026: a step that closes mail asks first, and warns about conversations whose
       newest mail came in (the 16 Nov bulk-done lesson). The ones left open are skipped
       by the whole step, not just by the "done" part of it. */
    const _acts = step.acts || [];
    if (_acts.indexOf('done') >= 0 && typeof window.rzAskBulkDone === 'function') {
      const _l = (list || []).filter(Boolean);
      if (_l.some(t => t.status !== 'done')) {
        window.rzAskBulkDone(_l, keep => qsGo(step, _l.filter(t => t.status === 'done' || keep.indexOf(t) >= 0)));
        return;
      }
    }
    qsGo(step, list);
  }
  function qsGo(step, list) {
    let n = 0, skipped = 0;`;

let done = 0;
for (const F of ['.tmp/email.html', 'server/rugs-email-outlook-pack.js']) {
  let s = fs.readFileSync(F, 'utf8');
  const crlf = s.indexOf('\r\n') >= 0;
  const find = crlf ? FIND.replace(/\n/g, '\r\n') : FIND;
  const repl = crlf ? REPL.replace(/\n/g, '\r\n') : REPL;
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error(F + ': expected 1 match for qsRun, found ' + c);
  fs.writeFileSync(F, s.replace(find, repl));
  console.log('patched ' + F);
  done++;
}
console.log('patch-quickstep-done-confirm: ' + done + ' files patched');
