/* 24 Nov 2026 - Rugs Email: FIX "read / delete / move it in Gmail and Rugs Email never hears
 * about it".
 *
 * The Gmail -> app half of the two-way sync IS written (historySync: read/unread, archive,
 * trash, back-to-inbox, with a "Changed in Gmail" history line), and the scope it needs
 * (gmail.readonly for the History API) is granted. The trouble is WHEN it runs. cronRun does:
 *
 *     for (const d of order) { if (Date.now() - t0 > DEADLINE_MS) break; await syncBox(...) }
 *     for (const d of order) { if (Date.now() - t0 > DEADLINE_MS) break; await historySync(...) }
 *
 * Both loops watch the SAME 25-second budget, and fetching new mail for nine mailboxes
 * (plus the year of history still loading backwards) uses all of it on a busy tick. The
 * history loop then runs for ZERO mailboxes - every time - so a change made in Gmail is
 * never copied over.
 *
 * Fix: the history pass goes FIRST and gets its own small budget (8 s). It is the cheap half
 * - one history.list call per mailbox, a handful of records - while fetching mail is the
 * expensive half, and the mail sync keeps the full 25 seconds afterwards exactly as before.
 * So Gmail changes always arrive, and new mail is no slower than it was.
 *
 * Re-runnable.
 */
const fs = require('fs');
const F = 'server/local-server/rugs-mail.bundle.mjs';
let s = fs.readFileSync(F, 'utf8');
const nl = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

const SYNC = [
'  for (const d of order) {',
'    if (Date.now() - t0 > DEADLINE_MS) break;',
'    try {',
'      out.push(await syncBox(d.mailbox, t0));'
].join('\n');

const HIST = [
'  for (const d of order) {',
'    if (Date.now() - t0 > DEADLINE_MS) break;',
'    try {',
'      if (await gmailOn(d.mailbox)) out.push(await historySync(d.mailbox, t0));',
'    } catch (e) {',
'      out.push({ mailbox: d.mailbox, history_error: String(e.message).slice(0, 200) });',
'    }',
'  }'
].join('\n');

const HIST_FIRST = [
'  /* 24 Nov 2026: what changed in GMAIL is copied over FIRST, with its own small budget.',
'     It used to run after every mailbox had fetched its new mail, against the same 25-second',
'     budget - so on a busy tick it never ran at all and a mail read, archived or deleted in',
'     Gmail never reached Rugs Email. See server/patch-gmail-history-first.js. */',
'  const HIST_MS = 8e3;',
'  for (const d of order) {',
'    if (Date.now() - t0 > HIST_MS) break;',
'    try {',
'      if (await gmailOn(d.mailbox)) out.push(await historySync(d.mailbox, t0));',
'    } catch (e) {',
'      out.push({ mailbox: d.mailbox, history_error: String(e.message).slice(0, 200) });',
'    }',
'  }'
].join('\n');

const sync = SYNC.replace(/\n/g, nl), hist = HIST.replace(/\n/g, nl), histFirst = HIST_FIRST.replace(/\n/g, nl);

if (s.indexOf('HIST_MS') >= 0) { console.log('already applied - nothing to do'); process.exit(0); }
if (s.split(hist).length - 1 !== 1) throw new Error('the history loop was not found exactly once');
if (s.split(sync).length - 1 !== 1) throw new Error('the mail sync loop was not found exactly once');
if (s.indexOf(sync) > s.indexOf(hist)) throw new Error('the loops are not in the order this patch expects');

s = s.replace(hist, '');                       // take the history pass out...
s = s.replace(sync, histFirst + nl + sync);    // ...and put it in front of the mail sync
fs.writeFileSync(F, s);
console.log('patch-gmail-history-first: the Gmail history pass now runs first, with its own 8-second budget');
