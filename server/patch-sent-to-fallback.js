/* patch-sent-to-fallback.js - 28 Nov 2026
 *
 * The last hole in the Sent list's "To:" column, measured ON THE LIVE SITE with build
 * 2026-11-28-4 as Ashish Deshwal: 75 of his 684 Sent rows still read like gibberish.
 *
 * sentTo() picks the recipients out of the To header, then the Cc header; when neither yields a
 * clean one it used to fall back to the RAW header text with the <...> parts stripped off:
 *
 *   if (!out.length) return String(m.to || t.email || '').replace(/<[^>]*>/g, '').trim() || ...
 *
 * For a header like  "[Loods 5 Home]<https://eu.content.exclaimer.net/?url=...>" <m.wedman@...>
 * that leaves "[Loods 5 Home]", and for a header carrying body text it leaves the sentence. Now
 * the fallback is an ADDRESS taken out of that same header, then the conversation's own
 * counterpart address, and otherwise nothing at all - never raw header text.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-sent-to-fallback.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__tofallback")) { console.log("already applied - nothing to do"); process.exit(0); }

let done = 0;
function edit(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(name + ": found " + n + " times, expected 1");
  s = s.replace(from, to);
  console.log("  edit " + (++done) + " ok  " + name);
}

/* the last hole: when no clean recipient can be picked at all, sentTo() used to fall back to
       the RAW To header with the <...> stripped off - which is how "[Loods 5 Home]" and whole
       sentences still reached the screen (measured on the live site: 75 of his 684 Sent rows).
       Now it falls back to an ADDRESS out of that header, then to the conversation's own
       counterpart, and otherwise says nothing. */
edit("sentTo: the fallback must be an address too",
  "if(!out.length)return String(m.to||t.email||'').replace(/<[^>]*>/g,'').trim()||t.email||'';",
  "if(!out.length){const a=String(m.to||'').match(/[^\\s<>\"',;:]+@[^\\s<>\"',;:]+\\.[A-Za-z]{2,}/);   /* __tofallback */\n" +
  "  return (a&&a[0])||t.email||'';}"
);

fs.writeFileSync(F, s);
console.log("ok  " + done + " edit");
