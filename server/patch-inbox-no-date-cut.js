/* 26 Nov 2026 - "a mail from a buyer must always show in the Inbox."

   THE CAUSE, in one line: a reply moves nothing (it only sets the owner), but the Inbox
   rule carried a rolling DATE WINDOW - `in60(t)` = the conversation's newest mail must be
   inside the last HIST_DAYS days - and it was applied in five places (the plain Inbox rule,
   All inboxes, the later wrapper for both, and the unread counts), so anything that fell
   out of that window silently left the Inbox whatever its folder said.

   (The other two hiding rules were found and reported on 25 Nov and are not date-related:
   replying sets the OWNER and the 16 Nov rule hides an owned conversation from the rest of
   the team, and designer@ is manager-first so its unassigned mail is only for the manager.
   Those are decisions the user still has open; this patch is about the date.)

   WHAT THIS CHANGES

   1  The date cut is gone. A conversation with a mail somebody sent us stays in the Inbox
      whatever its age, whoever replied, and whether or not it is marked Done. The only
      things that take it out are the ones a PERSON chooses: Archive, Deleted, Junk, or one
      of their own folders. Sent-only conversations still never appear in the Inbox.
      `in60` is kept as a named function that now always answers yes, so the five call
      sites are untouched and this is one line to put back.

   2  Older mail now arrives a page at a time as you scroll, instead of the whole year
      loading itself in the background the moment you open an Inbox. The newest 30 days
      still load at sign-in (that is what makes the Inbox usable immediately); after that,
      reaching the end of the list fetches ONE more page of 500 from the server.

   Run:  node server/patch-inbox-no-date-cut.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__nodatecut:start")) { console.log("already there - nothing changed"); process.exit(0); }
const done = [];

/* ---- 1. the date cut ---- */
const old60 = "const in60=t=>(t.last||0)>=Date.now()-HIST_DAYS*D;   // (12) Inbox always shows the last 60 days — search still finds older mail";
if (!s.includes(old60)) throw new Error("the in60 line was not found");
s = s.replace(old60,
  "/* __nodatecut:start 26 Nov 2026: the Inbox has NO date cut any more. A conversation that\n" +
  "   holds a mail somebody sent us stays in the Inbox whatever its age, whoever replied and\n" +
  "   whether it is Done; only Archive, Deleted, Junk and a person's own folders take it out\n" +
  "   (that is the t.folder test at each of the five call sites). Kept as a function so those\n" +
  "   five places did not have to change and this is one line to put back. __nodatecut:end */\n" +
  "const in60=t=>true;");
done.push("the Inbox date cut is gone (5 call sites, one line)");

/* ---- 2. one page at a time, on scroll ---- */
const loopOld = "   if(got.length<500){st.done=true;st.recent=true;break}   /* a short page is the real end of the mailbox */";
if (!s.includes(loopOld)) throw new Error("the history loop was not found");
s = s.replace(loopOld,
  loopOld + "\n" +
  "   if(onePage)break;   /* 26 Nov 2026: scrolling asks for ONE page, not the whole year */");
const headOld = " const all=phase==='all',lim=Date.now()-(all?HIST_DAYS:Math.min(RECENT_DAYS,HIST_DAYS))*D;st.busy=true;";
if (!s.includes(headOld)) throw new Error("the loadMoreBox header was not found");
s = s.replace(headOld,
  " const onePage=phase==='page';   /* 26 Nov 2026: one page of older mail, asked for by scrolling */\n" +
  " const all=phase==='all'||onePage,lim=Date.now()-(all?HIST_DAYS:Math.min(RECENT_DAYS,HIST_DAYS))*D;st.busy=true;");
done.push("loadMoreBox can fetch a single page");

/* ---- 3. stop the whole year loading by itself ---- */
const autoOld = " if(!S.loadingMail&&!(st&&st.busy)){if(!(st&&st.recent))setTimeout(()=>loadMoreBox(view.dept,'recent'),50);else if(!st.done)setTimeout(()=>loadMoreBox(view.dept,'all'),50)}};";
if (!s.includes(autoOld)) throw new Error("the automatic history start was not found");
s = s.replace(autoOld,
  " /* 26 Nov 2026: the newest 30 days still load by themselves; the REST now waits to be\n" +
  "    scrolled to, so opening an Inbox no longer pulls a year of mail in the background. */\n" +
  " if(!S.loadingMail&&!(st&&st.busy)&&!(st&&st.recent))setTimeout(()=>loadMoreBox(view.dept,'recent'),50)};");
done.push("the year no longer loads itself in the background");

/* ---- 4. scrolling to the end asks the server for the next page ---- */
const block = String.raw`
<script>/* __scrollpage:start  26 Nov 2026: reaching the end of the list fetches one more page */
document.addEventListener('scroll', function (e) {
 try {
  const m = e.target;
  if (!m || !m.classList || !m.classList.contains('msgs')) return;
  if (m.scrollTop + m.clientHeight < m.scrollHeight - 600) return;
  if (document.querySelector('.list [data-listmore]')) return;      /* rows still undrawn: the app's own pager handles it */
  if (!(view.type === 'box' && view.folder === 'inbox')) return;
  const d = dept(view.dept); if (!d) return;
  const st = MORE[mailOf(d).toLowerCase()];
  if (!st || st.busy || st.done) return;
  loadMoreBox(view.dept, 'page');                                    /* one page of 500, from the server */
 } catch (x) {}
}, true);
/* __scrollpage:end */</script>`;
s = s.replace(/\s*$/, "") + "\n" + block + "\n";
done.push("scrolling to the end asks for the next page");

fs.writeFileSync(file, s);
console.log("patched .tmp/email.html");
done.forEach((d) => console.log("  - " + d));
