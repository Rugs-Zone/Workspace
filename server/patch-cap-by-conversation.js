/* 26 Nov 2026 - "Aman's mail came but other mail is not there now", and "it shows in My work,
   why not in the Inbox".

   THE CAUSE, and it is mechanical. The list draws only the first `LIST_PAGE` rows (150, or 60
   on a slow PC) and adds 300 more when you scroll near the end - `listCap()` counts ROWS. That
   was written when a row WAS a conversation. Now that every mail is its own row, a Team Pulse
   conversation is about 4.6 rows (measured 25 Nov: 3,041 rows for 660 conversations), so the
   same 150-row window reaches roughly FOUR TIMES LESS FAR down the Inbox - about 33
   conversations instead of 150. Everything below that is simply undrawn until you scroll, which
   is exactly "other mail is not there now", and it is why Aman Singh Verma's 25 Nov mail still
   showed in My work: that list is short, so its window covers all of it, while the Inbox's does
   not.

   THE FIX: the window counts CONVERSATIONS again, the way it always meant to. Rows are drawn
   until the same number of conversations is covered as before, so the Inbox reaches exactly as
   far down as it did yesterday and every mail of those conversations is on screen. A hard
   ceiling on rows keeps a huge mailbox from stalling a slow PC, and "scroll for more" works as
   it did.

   Nothing else changes: with one row per conversation capRows() returns listCap() untouched,
   so this is a no-op if the per-mail row model is ever turned off again.

   Run:  node server/patch-cap-by-conversation.js   (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__caprows")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;

/* 1. every place that decided how many rows to draw. Done FIRST, because capRows() itself
      calls listCap(rows.length) and must not be rewritten by its own edit. */
const before = s.split("listCap(rows.length)").length - 1;
if (before !== 3) { console.error("STOP - expected 3 listCap(rows.length) call sites, found " + before); process.exit(1); }
s = s.split("listCap(rows.length)").join("capRows(rows)"); n += before;

/* 2. capRows(), right after listCap() */
const anchor = "function listCap(n){";
if (s.split(anchor).length !== 2) { console.error("STOP - listCap not found exactly once"); process.exit(1); }
const add =
"/* __caprows 26 Nov 2026: the drawing window counts CONVERSATIONS, not rows. It always meant\n" +
"   to - a row used to BE a conversation - but with one row per mail the same 150-row window\n" +
"   reached about four times less far down the Inbox, so mail people expected to see fell\n" +
"   outside it and looked missing (while still showing in the much shorter My work list).\n" +
"   The ceiling GROWS with the window (cap x CAP_ROW_PER), so one enormous mailbox cannot\n" +
"   stall a slow PC while 'scroll for more' always keeps making progress - a fixed ceiling\n" +
"   stopped the pager dead as soon as it was reached. */\n" +
"const CAP_ROW_PER=window.SLOW_PC?6:12;\n" +
"function capRows(rows){\n" +
" if(!rows||!rows.length)return 0;\n" +
" const cap=listCap(rows.length);\n" +
" let perMail=false;for(let i=0;i<rows.length&&i<40;i++){if(rows[i]&&rows[i]._one){perMail=true;break}}\n" +
" if(!perMail)return cap;                      /* one row per conversation: exactly as before */\n" +
" const seen=new Set();let i=0;\n" +
" const max=cap*CAP_ROW_PER;\n" +
" for(;i<rows.length&&i<max;i++){const id=rows[i]&&rows[i].id;\n" +
"  if(id==null)continue;\n" +
"  if(!seen.has(id)){if(seen.size>=cap)break;seen.add(id)}}\n" +
" return i}\n";
s = s.replace(anchor, add + anchor); n++;

fs.writeFileSync(f, s);
console.log("patch-cap-by-conversation: " + n + " edit(s) applied");
