/* 26 Nov 2026 - "in sent you have made erro in yesterday, today" - the dates on Sent rows.

   THE BUG. In the Sent folder a row's time, its day heading and its sort all came from
   `lastOut(t)` - the newest mail WE sent in that whole conversation. That was right when a
   row was a conversation. Now that every mail is its own row, all of a conversation's Sent
   rows were stamped with the SAME time (the newest one), so a mail sent on Tuesday appeared
   under "YESTERDAY" or "TODAY" next to the newest one.

   Worse, it disagreed with the sort: the View-menu sort already used each row's own time for
   per-mail rows (`dk = t._one ? t.last : ...`), so rows were ORDERED by their own date but
   LABELLED and GROUPED by the conversation's newest - which is how mail ended up under the
   wrong day heading and looked out of order.

   THE FIX: one helper, rowWhen(t) - a per-mail row is always timed by its own mail; a
   conversation row keeps the old behaviour exactly (newest sent in Sent, newest of all
   elsewhere) - used by the row's time, the day heading, and both sorts, so all four now
   agree.

   Run:  node server/patch-sent-row-time.js     (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__rowwhen")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;
const sub = (what, from, to) => {
  if (s.split(from).length !== 2) { console.error("STOP - " + what + ": not found exactly once"); process.exit(1); }
  s = s.replace(from, to); n++;
};

/* the helper, next to rowName */
sub("rowWhen helper",
  "function rowName(t){",
  "/* __rowwhen 26 Nov 2026: which moment a ROW stands for. A per-mail row is its own mail -\n" +
  "   in Sent too, where the time used to come from the conversation's newest sent mail, so\n" +
  "   every row of one conversation carried the same date and sat under the wrong day. A\n" +
  "   conversation row is unchanged. */\n" +
  "function rowWhen(t){\n" +
  " if(t&&t._one)return t.last;\n" +
  " return (view.type==='box'&&view.folder==='sent')?lastOut(t):t.last}\n" +
  "function rowName(t){");

/* 1. the day heading above the rows */
sub("the day heading",
  "const day=dayLabel(sentV?lastOut(t):t.last);",
  "const day=dayLabel(rowWhen(t));");

/* 2. the time printed on the row */
sub("the time on the row",
  "${tShort(view.type==='box'&&view.folder==='sent'?lastOut(t):t.last)}",
  "${tShort(rowWhen(t))}");

/* 3. the time the rowTime wrapper rewrites it to */
sub("the rowTime wrapper",
  "  const when=(view.type==='box'&&view.folder==='sent')?lastOut(t):t.last;",
  "  const when=rowWhen(t);");

/* 4. the pinned/date sort underneath the View-menu sort */
sub("the base sort key",
  "const isSent=view.type==='box'&&view.folder==='sent',k=t=>isSent?lastOut(t):t.last;",
  "const k=t=>rowWhen(t);");

fs.writeFileSync(f, s);
console.log("patch-sent-row-time: " + n + " edit(s) applied");
