/* 24 Nov 2026 - the second half of server/patch-gmail-history-first.js, written after
 * measuring a real tick against a full copy of the live database.
 *
 * Putting the Gmail-history pass first fixed the starvation, but the measurement showed the
 * opposite danger: with three days of label changes waiting, shipping@ alone used the whole
 * 25-second tick (303 messages, 3 conversations corrected) and NOT ONE mailbox got round to
 * fetching new mail. historySync was watching the big 25-second budget inside itself, and its
 * "write the labels down" loop watched nothing at all.
 *
 * So now:
 *   - historySync takes the budget it is given (8 s from cronRun) instead of the 25-second one
 *   - its label-writing loop stops at that budget too, and says "partial, will continue"
 *   - a tick does at most four mailboxes' history, so the rest of the work always gets a turn
 *
 * Stopping half way loses nothing: history_id is only moved forward when a mailbox finishes,
 * so the next tick picks the same window up again (writing the same labels twice is harmless).
 *
 * Re-runnable.
 */
const fs = require('fs');
const F = 'server/local-server/rugs-mail.bundle.mjs';
let s = fs.readFileSync(F, 'utf8');
const nl = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const R = (x) => x.replace(/\n/g, nl);
let n = 0;
function one(find, repl, what, skipIf) {
  if (skipIf && s.indexOf(R(skipIf)) >= 0) { console.log('- ' + what + ': already done'); return; }
  const f = R(find);
  const c = s.split(f).length - 1;
  if (c !== 1) throw new Error('expected 1 match for ' + what + ', found ' + c);
  s = s.replace(f, R(repl));
  n++;
}

/* 1. at most four mailboxes a tick, and tell historySync how long it may take */
one(
`  const HIST_MS = 8e3;
  for (const d of order) {
    if (Date.now() - t0 > HIST_MS) break;
    try {
      if (await gmailOn(d.mailbox)) out.push(await historySync(d.mailbox, t0));`,
`  const HIST_MS = 8e3;
  let histLeft = 4;                       // at most four mailboxes a tick, so fetching mail always gets its turn
  for (const d of order) {
    if (histLeft <= 0 || Date.now() - t0 > HIST_MS) break;
    try {
      if (await gmailOn(d.mailbox)) { histLeft--; out.push(await historySync(d.mailbox, t0, HIST_MS)); }`,
  'cron history loop', 'let histLeft = 4;'
);

/* 2. historySync works to the budget it is given */
one(
  'async function historySync(box, t0) {',
  'async function historySync(box, t0, budget = DEADLINE_MS) {',
  'historySync signature', 'async function historySync(box, t0, budget'
);
one(
`  let pt = "", latest = st.history_id, complete = true;
  do {
    if (Date.now() - t0 > DEADLINE_MS) {`,
`  let pt = "", latest = st.history_id, complete = true;
  do {
    if (Date.now() - t0 > budget) {`,
  'history paging budget', 'if (Date.now() - t0 > budget) {'
);

/* 3. ...and so does the loop that writes the labels down */
one(
`  const tids = /* @__PURE__ */ new Set();
  const all = [...msgs];
  for (let i = 0; i < all.length; i += 25) {`,
`  const tids = /* @__PURE__ */ new Set();
  const all = [...msgs];
  for (let i = 0; i < all.length; i += 25) {
    /* 24 Nov 2026: stop at the budget rather than eating the whole tick. history_id is not
       moved forward, so the next tick reads this same window again. */
    if (Date.now() - t0 > budget + 4e3) return { mailbox: box, history: "partial, will continue", wrote: i };`,
  'label writing budget', 'history: "partial, will continue", wrote: i'
);

fs.writeFileSync(F, s);
console.log('patch-gmail-history-budget: ' + n + ' edits applied');
