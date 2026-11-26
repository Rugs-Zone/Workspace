/* 26 Nov 2026 - PUT THE LIST BACK THE WAY IT WAS YESTERDAY.

   The job today was to recover one mail (Aman Singh Verma, 25 Nov 17:34, teampulse@). That
   part is data and it is done on the server: the conversation is in the Inbox and unread.
   To make the mail VISIBLE I also changed how the list itself works, and that was not asked
   for - it caused four rounds of breakage in one afternoon (mail apparently missing from the
   Inbox and from Sent, clicking a mail opening the ones above it, the Inbox opening on
   yesterday, the counts tripling).

   So the two things that changed what everybody sees are reverted:

     1. ONE ROW PER CONVERSATION again (LV() conv:true) - the 25 Nov behaviour.
     2. The row is named after the newest message again (rowWho -> rowName).

   WHAT IS KEPT, because all of it is either a real bug fix or completely inert while rows
   are conversations - none of it changes what the list looks like:

     * rowWhen()  - a row's time. With conversation rows it returns exactly the old
                    expression (newest sent in Sent, newest of all elsewhere).
     * capRows()  - the drawing window. Returns listCap() unchanged when rows are
                    conversations.
     * convCount()- the Items / "Showing N of M" counters. Returns the row count unchanged
                    when rows are conversations.
     * the pinned sort fix - pinned mail reaches the top, which it never did before today
                    (the View-menu sort re-sorted after the pinned sort and ignored it). The
                    pin on Aman's conversation has been taken off by the server, so nothing
                    is pinned and this is invisible - but it is a genuine fix and it stays.
     * open-one-mail - only acts when a row names a mail (data-mi), which conversation rows
                    do not, so it never fires.

   CONSEQUENCE, stated plainly: with conversation rows Aman's 17:34 mail does NOT have a row
   of its own. Its conversation is in the Inbox, unread, and the mail is inside it - which is
   how every other mail in a conversation has always behaved here.

   Run:  node server/patch-back-to-yesterday.js   (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__backtoyesterday")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;
const sub = (what, from, to) => {
  if (s.split(from).length !== 2) { console.error("STOP - " + what + ": not found exactly once"); process.exit(1); }
  s = s.replace(from, to); n++;
};

/* 1. one row per conversation again */
sub("LV conv",
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:false});",
  "/* __backtoyesterday 26 Nov 2026: one row per conversation, as it was on 25 Nov. Turning\n" +
  "   this to false gives every mail its own row again (explode()); everything that supports\n" +
  "   that is still in place and tested, so it is a one-word change either way. */\n" +
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:true});");

/* 2. the row is named after the newest message again */
sub("rowWho",
  "function rowWho(t){if(t&&t._one)return rowName(t);   /* __mailperrow: a per-mail row names that mail's sender, not the conversation's people */\n" +
  " const ms=(t&&t.msgs)||[];if(ms.length<2)return rowName(t);",
  "function rowWho(t){return rowName(t);   /* __backtoyesterday: the newest sender, as on 25 Nov */\n" +
  " /* eslint-disable no-unreachable */\n" +
  " const ms=(t&&t.msgs)||[];if(ms.length<2)return rowName(t);");

fs.writeFileSync(f, s);
console.log("patch-back-to-yesterday: " + n + " edit(s) applied");
