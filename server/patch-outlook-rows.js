/* patch-outlook-rows.js - 27 Nov 2026  (night plan, bug 2:
 *   "mails that come minute by minute are not each shown, like Outlook does")
 *
 * R17 (one row per mail) went live last night, so every mail already has its own row. What
 * was still wrong is what happens when mails arrive a minute - or a second - apart:
 *
 *  2  TWO MAILS AT THE SAME SECOND COULD SWAP PLACES. Every sort ended on the mail's time
 *     in milliseconds, and Gmail's sent_at has only second precision, so two mails sent in
 *     the same second compared EQUAL and their order was whatever the sort happened to do -
 *     different on each redraw. Both comparators now fall through to the Gmail message id,
 *     which rises with time, so the order is fixed and never changes under the reader.
 *  3  "Show all N mails" at the top of the reading pane. Every mail was already listed with
 *     its sender and its time - only the BODIES are folded to the newest three - but the
 *     way to open the rest was a button called "Expand all", which does not read as "the
 *     other mails are here". It now says what it does, and names the number.
 *  4  When the 15-second poll brings TWO OR MORE new mails into a conversation that is
 *     open, all of them are opened, not only the newest.
 *  1  The row-HTML cache was capped at 600 entries, written when a row meant a conversation.
 *     With one row per mail a full Inbox window draws ~700 rows, so the cache was cleared on
 *     almost every redraw and did nothing. The cap now follows what is really drawn.
 *
 * Nothing here touches who may see a mail.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-outlook-rows.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

let n = 0;
function one(mark, find, rep, why) {
  if (mark && s.indexOf(mark) >= 0) { console.log("already done: " + why); return; }
  const i = s.indexOf(find);
  if (i < 0) throw new Error("could not find the place for: " + why);
  if (s.indexOf(find, i + find.length) >= 0) throw new Error("found more than once: " + why);
  s = s.slice(0, i) + rep + s.slice(i + find.length);
  n++;
  console.log("  " + why);
}

/* ---- 2. the list sort never leaves two same-second mails to chance ---- */
one(
  "__rowtie:",
  "(c||dk(a)-dk(b))*sg",
  "(c||dk(a)-dk(b)||rowTie(a,b))*sg   /* __rowtie: two mails sent in the same second are ordered by their Gmail id, so they never swap */",
  "the mail list breaks a same-second tie on the message id"
);

/* ---- 3. the reading pane says how many mails are in the conversation ---- */
one(
  "__showall:",
  "<button class=\"btn\" data-mall=\"open\">Expand all</button>",
  "<button class=\"btn pri\" data-mall=\"open\" title=\"__showall: open every mail in this conversation\">Show all ${t.msgs.length} mails</button>",
  "the reading pane offers \"Show all N mails\" at the top"
);

/* ---- 4. a poll that brings several new mails opens all of them ---- */
one(
  "__newmsgs:",
  "if(old){S.threads[ex]=t;if(openMsgs[id]&&t.msgs.length>old.msgs.length)openMsgs[id].add(t.msgs.length-1)}else S.threads.push(t);",
  "if(old){S.threads[ex]=t;\n" +
  "  /* __newmsgs: the 15-second poll can bring several mails at once - open EVERY one of\n" +
  "     them, not only the newest, or the ones in between stay folded with no sign of it. */\n" +
  "  if(openMsgs[id]&&t.msgs.length>old.msgs.length)for(let _i=old.msgs.length;_i<t.msgs.length;_i++)openMsgs[id].add(_i);\n" +
  " }else S.threads.push(t);",
  "a poll with several new mails opens all of them in the reading pane"
);

/* ---- 4b. the same, for the search / "load more" merge ---- */
one(
  "__newmsgs2:",
  "if(t0.msgs.length>=o.msgs.length){S.threads[have.get(id)]=t0;metaSaved[id]=JSON.stringify(metaOf(t0));n++}",
  "if(t0.msgs.length>=o.msgs.length){S.threads[have.get(id)]=t0;metaSaved[id]=JSON.stringify(metaOf(t0));n++;\n" +
  "   /* __newmsgs2: same as the poll - if this conversation is open, open the new mails too */\n" +
  "   if(openMsgs[id]&&t0.msgs.length>o.msgs.length)for(let _j=o.msgs.length;_j<t0.msgs.length;_j++)openMsgs[id].add(_j)}",
  "a search or \"load more\" merge opens the new mails too"
);

/* ---- 1. the row-HTML cache follows the number of rows really drawn ---- */
one(
  "__rhcmax:",
  "if(key){if(RHC.size>600)RHC.clear();RHC.set(key,h)}",
  "if(key){if(RHC.size>(window.__rhcMax||600))RHC.clear();RHC.set(key,h)}   /* __rhcmax: 600 was written when a row meant a conversation; one row per mail draws ~700 */",
  "the row-HTML cache is big enough for per-mail rows"
);

/* ---- the block ---- */
const BLOCK = `
<script>/* __outlookrows:start 27 Nov 2026 - server/patch-outlook-rows.js */
/* Two mails sent in the SAME SECOND compared equal on time alone, so their order was
   whatever the sort happened to do and could change on the next redraw. A Gmail message id
   rises with time, so it is the natural second key. Ascending here; the list comparator
   multiplies by its own direction, and the search comparator calls it the other way round. */
function rowGid(t){try{return (t&&t._one&&t.msgs&&t.msgs[t._mi]&&t.msgs[t._mi].gid)||(t&&t.msgs&&t.msgs.length?t.msgs[t.msgs.length-1].gid:'')||''}catch(e){return ''}}
function rowTie(a,b){const x=String(rowGid(a)||''),y=String(rowGid(b)||'');
 if(!x||!y||x===y)return 0;
 if(x.length!==y.length)return x.length<y.length?-1:1;   /* a Gmail id is hex and grows in length */
 return x<y?-1:1}

/* the row-HTML cache has to hold what is on the screen, or it is cleared on every draw and
   every row is built again. ~700 rows for a full Inbox window with one row per mail, so the
   ceiling follows the real count (about 2 KB a row, so the top of this is ~4 MB). */
function rhcTune(nRows){try{
 const want=Math.min(2000,Math.max(600,(Number(nRows)||0)+300));
 if(want>(window.__rhcMax||0))window.__rhcMax=want;
}catch(e){}}
if(typeof capRows==='function'){const _crTune=capRows;capRows=function(rows){const r=_crTune.apply(this,arguments);try{rhcTune(r&&r.length)}catch(e){}return r}}

/* what rzMem() reports, so the caps can be read off a real screen */
if(typeof window.rzMem==='function'){const _mem=window.rzMem;window.rzMem=function(){const r=_mem.apply(this,arguments);try{console.log('row HTML cache: '+(typeof RHC!=='undefined'?RHC.size:'?')+' of '+(window.__rhcMax||600))}catch(e){}return r}}
/* __outlookrows:end */</script>
`;
const a = s.indexOf("<script>/* __outlookrows:start");
if (a >= 0) {
  const b = s.indexOf("/* __outlookrows:end */</scr" + "ipt>", a);
  if (b < 0) throw new Error("the old __outlookrows block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + ("/* __outlookrows:end */</scr" + "ipt>").length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

fs.writeFileSync(F, s);
console.log(n + " edit(s) + the block. written to " + F);
