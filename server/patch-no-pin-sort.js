/* 26 Nov 2026 - "why is the Tuesday mail coming on top in Sent".

   Because of me. This morning I "fixed" the pinned sort: the View-menu sort re-sorted the
   whole list after the pinned sort and ignored `pinned`, so pinned mail never reached the
   top. I made it honour the pin - and then told the user it was invisible "because nothing
   is pinned". That was wrong: the Roshni Dhingra conversation (OOB R091 17/11/2026) IS
   pinned, and it has been for a while, so the moment the sort honoured it, a Tuesday mail
   jumped above today's in BOTH the Inbox and Sent.

   Whether or not honouring a pin is "correct" (Outlook does), it is NOT what this app did
   yesterday, and the instruction was to put yesterday's rules back. So it goes back: the
   View-menu sort sorts by date (or whatever the View menu says) and nothing else.

   NOTHING IS UNPINNED BY THIS - the pin on that conversation is somebody's own and is left
   exactly as it is. Only the sort stops acting on it, as it did yesterday. The 📌 tag still
   shows on the row.

   Run:  node server/patch-no-pin-sort.js      (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__nopinsort")) { console.log("already there - nothing changed"); process.exit(0); }

const from =
" return r.sort((a,b)=>{const pn=(b.pinned?1:0)-(a.pinned?1:0);if(pn)return pn;   /* __mailperrow: pinned first - this wrapper used to undo the pinned sort above */\n" +
"  const x=key(a),y=key(b);const c=typeof x==='string'?x.localeCompare(y):x-y;return (c||dk(a)-dk(b))*sg})};";
const to =
" /* __nopinsort 26 Nov 2026: back to 25 Nov - this sort does NOT lift pinned mail to the\n" +
"    top. It did for a few hours this morning, which pushed a pinned Tuesday conversation\n" +
"    above today's mail in the Inbox and in Sent. The pin itself is untouched and the row\n" +
"    still shows its tag; only the ordering ignores it again. */\n" +
" return r.sort((a,b)=>{const x=key(a),y=key(b);const c=typeof x==='string'?x.localeCompare(y):x-y;return (c||dk(a)-dk(b))*sg})};";

if (s.split(from).length !== 2) { console.error("STOP - the pinned sort was not found exactly once"); process.exit(1); }
s = s.replace(from, to);
fs.writeFileSync(f, s);
console.log("patch-no-pin-sort: the list sorts by date again, as it did yesterday");
