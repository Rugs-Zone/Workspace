/* 26 Nov 2026 - EVERY MAIL IS ITS OWN ROW AGAIN, so a mail can never be invisible because
   somebody else wrote after it in the same conversation.

   Asked for in this terminal on 24 Nov ("every mail is its own row"), reversed on 25 Nov by
   the other session's patch-one-row-per-conv.js, and asked for again today after Aman Singh
   Verma's 25 Nov 17:34 mail could not be found: with one row per conversation the row is
   named and timed by the NEWEST mail, so that conversation showed as "Manfred Mui, 8:21 pm"
   and no row saying "Aman Singh Verma, 5:34 pm" existed anywhere.

   Three edits, and the second and third are what the 24 Nov version was missing:

   1. LV() no longer forces conv:true, so explode() runs and each mail gets its own row.

   2. rowName() and rowWho() now answer for THAT MAIL on an exploded row. Both read the
      conversation's newest message, and an exploded row inherits the whole conversation
      through Object.create(t) - so without this every one of the six rows would still have
      carried Manfred Mui's name. explode() already puts the right sender on each row as
      `from`, so the fix is simply to use it.

   3. The View-menu sort now keeps pinned mail on top. Pinned is sorted at the wrapper on
      line 2512 - `(b.pinned-a.pinned)||(k(b)-k(a))` - but the View wrapper re-sorts the
      whole list AFTER it and never looked at pinned, so a pinned conversation was dropped
      straight back into date order. That is why the one-time job's pin did not put Aman's
      conversation at the top, and it is a real bug for every pinned mail, not just this one.

   What is deliberately NOT changed: clicking a row still opens that exact mail (the 25 Nov
   data-mi handler), the row HTML cache already keys on t._mi so six rows of one conversation
   cannot share a cache entry, and the row-level redraw matches rows by position, not by id.

   Run:  node server/patch-mail-per-row.js     (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__mailperrow")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;
const sub = (what, from, to) => {
  if (s.split(from).length !== 2) { console.error("STOP - " + what + ": not found exactly once"); process.exit(1); }
  s = s.replace(from, to); n++;
};

/* 1. one row per MAIL */
sub("LV() conv override",
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:true});",
  "/* __mailperrow 26 Nov 2026: back to one row per MAIL (the 24 Nov request). A mail must\n" +
  "   never be invisible because somebody else wrote after it in the same conversation. */\n" +
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:false});");

/* 2a. the row's name, on a per-mail row, is THAT mail's sender */
sub("rowName body",
  "function rowName(t){const ms=(t&&t.msgs)||[],last=ms[ms.length-1];",
  "function rowName(t){if(t&&t._one)return String(t.from||t.email||'(unknown)');   /* __mailperrow: one mail, one sender */\n" +
  " const ms=(t&&t.msgs)||[],last=ms[ms.length-1];");

/* 2b. same for the people line */
sub("rowWho body",
  "function rowWho(t){const ms=(t&&t.msgs)||[];if(ms.length<2)return rowName(t);",
  "function rowWho(t){if(t&&t._one)return rowName(t);   /* __mailperrow: a per-mail row names that mail's sender, not the conversation's people */\n" +
  " const ms=(t&&t.msgs)||[];if(ms.length<2)return rowName(t);");

/* 3. pinned mail stays on top through the View-menu sort */
sub("View-menu sort",
  " return r.sort((a,b)=>{const x=key(a),y=key(b);const c=typeof x==='string'?x.localeCompare(y):x-y;return (c||dk(a)-dk(b))*sg})};",
  " return r.sort((a,b)=>{const pn=(b.pinned?1:0)-(a.pinned?1:0);if(pn)return pn;   /* __mailperrow: pinned first - this wrapper used to undo the pinned sort above */\n" +
  "  const x=key(a),y=key(b);const c=typeof x==='string'?x.localeCompare(y):x-y;return (c||dk(a)-dk(b))*sg})};");

fs.writeFileSync(f, s);
console.log("patch-mail-per-row: " + n + " edit(s) applied");
