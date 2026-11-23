/* 23 Nov 2026 — "older messages in a conversation are somewhere missing" and
 * "the trail shows plain grey, all things gone".
 *
 * MEASURED against the live server on a real 20-mail Team Alpha conversation
 * (throwaway admin session, deleted afterwards). The SERVER IS FINE:
 *   • the newest 5 mails come back with their full original HTML
 *     (114 KB, 131 KB, 123 KB, 141 KB, 146 KB);
 *   • the other 15 come back as `light:true` — a 4,000-character text summary
 *     and NO HTML — which is the 19 Nov change that stopped long trails killing
 *     the function with 546 (asking Gmail for a 49-mail thread sent 10 MB per
 *     click and ran out of CPU);
 *   • asking for those older ones by id returns every one of them in full
 *     (109 KB, 107 KB, 111 KB, 124 KB, 119 KB) — so nothing is lost, the app
 *     simply never asks.
 *
 * That one fact explains both complaints:
 *   • a folded older mail has no HTML, so it stays a flat one-line summary and
 *     reads as "missing" — it is only fetched if you happen to click it;
 *   • with no HTML, a mail falls back to the plain renderers — a received one
 *     is drawn from its text and OUR OWN sent one goes down the internal branch
 *     that ends in trailHTML(), the old quote block styled
 *     `white-space:pre-wrap; font-size:13px` inside a grey left border. That is
 *     the "plain grey, everything gone".
 *
 * FIX: when a conversation is opened, the older mails are now fetched QUIETLY
 * in the background instead of waiting for a click, using the existing
 * `openLight` (5 ids per request, two requests at a time, each mail drawn as it
 * arrives, already retried and already safe to call twice — LD1 stops a second
 * fetch of the same mail). So a few seconds after opening, every mail in the
 * conversation is the real thing with its own formatting, and nothing is folded
 * and empty.
 *
 * Capped at MORE_FILL = 25 older mails per conversation, newest first. A 20-mail
 * thread is 3 requests; the cap keeps a 77-mail monster from firing 15 rounds
 * and redrawing the pane 15 times, and anything past the cap still opens on a
 * click or with "Expand all", exactly as now. It starts 400 ms after the pane is
 * drawn, so opening the mail stays instant.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-trail-loads-itself.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;

function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) { console.error('STOP: "' + what + '" matched ' + c + ' times, expected 1'); process.exit(1); }
  s = s.replace(find, repl);
  n++;
  console.log('  ok  ' + what);
}

one(
  "    const all=t.msgs.every(x=>x.full||x.light||!x.gid);\n    t.full=all;",
  "    const all=t.msgs.every(x=>x.full||x.light||!x.gid);\n" +
  "    t.full=all;\n" +
  "    /* 23 Nov 2026: pull the older mails in quietly, so none of them is left folded and\n" +
  "       empty and every mail shows its own formatting instead of a flat text fallback */\n" +
  "    try{const MORE_FILL=25,rest=t.msgs.filter(x=>x.light&&x.gid).slice(-MORE_FILL);\n" +
  "     if(rest.length)setTimeout(function(){try{openLight(t,rest)}catch(e){}},400)}catch(e){}",
  'open a conversation = quietly fetch the older mails too'
);

fs.writeFileSync(F, s);
console.log(n + ' edit(s) applied to ' + F);
