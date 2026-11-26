/* 26 Nov 2026 - what the screenshot actually showed, after per-mail rows went in.

   1. THE INBOX OPENS ON YESTERDAY. The one-time job pinned Aman's conversation so it could
      not be missed, and once the pinned sort was repaired (patch-mail-per-row.js) all FIVE
      of that conversation's rows float above everything - so the top of the Inbox is
      "YESTERDAY" and "TUESDAY", and today's mail, including the 11 unread, is pushed below
      them. That reads exactly like "all mail is not showing". The pin has done its job now
      that the mail has its own row at its own time, so it is taken off again (server job
      below, in patch-unpin-aman.js).

   2. THE COUNTS TRIPLED. The bottom status bar said "Items: 46,264" and the list footer says
      "Showing N of 46,264" - both were counting ROWS. A row used to be a conversation, so
      those numbers used to mean conversations, and tripling them makes a healthy Inbox look
      like it is hiding most of itself. Both now count conversations again, and the footer
      says so in words.

   Run:  node server/patch-counts-and-unpin.js    (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__convcount")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;
const sub = (what, from, to) => {
  if (s.split(from).length !== 2) { console.error("STOP - " + what + ": not found exactly once"); process.exit(1); }
  s = s.replace(from, to); n++;
};

/* 1. one helper: how many CONVERSATIONS are in a list of rows */
sub("capRows anchor for convCount",
  "function capRows(rows){",
  "/* __convcount 26 Nov 2026: with one row per mail, counting rows made the Inbox look as if\n" +
  "   it were hiding most of itself (\"Items: 46,264\"). These numbers always meant\n" +
  "   conversations - a row simply used to be one. */\n" +
  "function convCount(rows,upto){\n" +
  " if(!rows||!rows.length)return 0;\n" +
  " const end=upto==null?rows.length:Math.min(upto,rows.length);\n" +
  " let perMail=false;for(let i=0;i<rows.length&&i<40;i++){if(rows[i]&&rows[i]._one){perMail=true;break}}\n" +
  " if(!perMail)return end;\n" +
  " const seen=new Set();for(let i=0;i<end;i++){const id=rows[i]&&rows[i].id;if(id!=null)seen.add(id)}\n" +
  " return seen.size}\n" +
  "function capRows(rows){");

/* 2. the list footer speaks in conversations */
sub("the list footer",
  "if(rows.length>_cap)h+=`<div class=\"listmore\" data-listmore>Showing ${_cap} of ${rows.length} — scroll for more</div>`",
  "if(rows.length>_cap)h+=`<div class=\"listmore\" data-listmore>Showing ${convCount(rows,_cap).toLocaleString('en-IN')} of ${convCount(rows).toLocaleString('en-IN')} conversations — scroll for more</div>`");

/* 3. the bottom status bar counts conversations */
sub("status bar count (renderList)",
  "try{window.LCNT={n:special?S.drafts.length:rows.length,u:0}}catch(e){}",
  "try{window.LCNT={n:special?S.drafts.length:convCount(rows),u:0}}catch(e){}");
sub("status bar count (unread pass)",
  "try{(window.LCNT=window.LCNT||{}).u=u;window.LCNT.n=rows.length}catch(e){}",
  "try{(window.LCNT=window.LCNT||{}).u=u;window.LCNT.n=convCount(rows)}catch(e){}");

fs.writeFileSync(f, s);
console.log("patch-counts-and-unpin: " + n + " edit(s) applied");
