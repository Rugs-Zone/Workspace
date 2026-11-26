/* patch-my-rules.js - 27 Nov 2026  (bug 11 - rule R35: personal mail rules)
 *
 * Embeds server/my-rules.view.js into the app and wires the few places that have to ask a
 * personal rule instead of reading the conversation. Everything it changes is a READ: no
 * rule is ever written to the mail, so nobody else's view can move (R35).
 *
 *   the engine + the screen        -> the block (server/my-rules.view.js)
 *   mrUnread(t)   the Unread chip, the View menu's Unread filter, the row's unread look
 *   mrFlagOf(t)   the Flagged list, its count, the row's flag tag
 *   mrLab(t)      the topic chip, the topic filter, the Topics side count
 *   mrMove(t)     the folder overlay - wired in the block (inView) and in bug 10's counts
 *
 * Ownership, Needs owner and My work are deliberately NOT in that list: they read the real
 * folder and the real owner, which a rule never touches.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-my-rules.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
const V = path.join(__dirname, "my-rules.view.js");
let s = fs.readFileSync(F, "utf8");
const view = fs.readFileSync(V, "utf8");

let n = 0;
function edit(mark, find, rep, why, times) {
  if (s.indexOf(mark) >= 0) { console.log("  already done: " + why); return; }
  const hits = s.split(find).length - 1;
  if (hits !== times) throw new Error("expected " + times + " place(s) for " + why + ", found " + hits);
  s = s.split(find).join(rep);
  n += hits;
  console.log("  " + why + " (" + hits + " place" + (hits === 1 ? "" : "s") + ")");
}

/* 1 · the Unread chip and the View menu's "Unread" filter */
edit("__mr35u1", "filt==='unread'?t.unread:", "filt==='unread'?mrUnread(t):/*__mr35u1*/", "the Unread chip asks the personal rule", 2);
edit("__mr35u2", "v.vf==='unread'?t.unread", "v.vf==='unread'?mrUnread(t)/*__mr35u2*/", "the View menu's Unread filter too", 1);

/* 2 · the row: the unread look, and the flag tag */
edit("__mr35row", 'class="m ${t.unread?\'unread\':\'\'}', 'class="m ${/*__mr35row*/mrUnread(t)?\'unread\':\'\'}',
  "a row marked read by a rule stops looking unread", 1);
edit("__mr35flag", "${t.flag?'<span class=\"tag t-flag\"", "${/*__mr35flag*/mrFlagOf(t)?'<span class=\"tag t-flag\"",
  "a row flagged by a rule shows the flag", 1);

/* 3 · the Flagged list and its count */
edit("__mr35fav", "if(view.id==='flag')return t.flag", "if(view.id==='flag')return mrFlagOf(t)/*__mr35fav*/",
  "the Flagged list includes what a rule flagged", 1);
edit("__mr35favn", "cnt(t=>inScope(t)&&t.flag)", "cnt(t=>inScope(t)&&mrFlagOf(t))/*__mr35favn*/",
  "...and so does its count", 1);

/* 4 · the topic: the chip, the filter and the Topics side count */
edit("__mr35lb", "lbHTML=t=>t.label?`<span class=\"lb\" style=\"--lc:${LB(t.label).c}\">${t.ai?'<span class=\"ai\">✦</span>':''}${esc(LB(t.label).name)}</span>`:''",
  "lbHTML=t=>mrLab(t)?`<span class=\"lb\" style=\"--lc:${LB(mrLab(t)).c}\">${t.ai&&!mrEval(t).label?'<span class=\"ai\">✦</span>':''}${esc(LB(mrLab(t)).name)}</span>`:''/*__mr35lb*/",
  "the topic chip shows the topic a rule gave it", 1);
edit("__mr35lf", "t.label===lfilt", "mrLab(t)===lfilt/*__mr35lf*/", "the topic filter follows it", 2);
edit("__mr35lc", "t.label===l.id&&t.dept===my.id", "mrLab(t)===l.id&&t.dept===my.id/*__mr35lc*/", "and so does the Topics side count", 1);

/* 5 · bug 10's folder counts: count a mail where the PERSON sees it, so the folder lights up */
edit("__mr35fc", "function fcUnread(t,f){\n try{\n  if(!t||!t.unread)return false;\n  if(String(t.folder||'inbox')!==f)return false;",
  "function fcUnread(t,f){\n try{\n  /*__mr35fc: a rule of this person's own can file it somewhere else, and can mark it read for them */\n  if(!t||!(typeof mrUnread==='function'?mrUnread(t):t.unread))return false;\n  if(fcFolderOf(t)!==f)return false;",
  "the folder counts ask the personal rule", 1);
edit("__mr35fcf", "  const f=String(t.folder||'inbox');\n  /* the folders of a mailbox, and the person's own folders */",
  "  const f=fcFolderOf(t);/*__mr35fcf*/\n  /* the folders of a mailbox, and the person's own folders */",
  "...and count it in the folder the person sees it in", 1);
edit("__mr35fcd", "const FC_GREY={junk:1,deleted:1,purged:1};",
  "const FC_GREY={junk:1,deleted:1,purged:1};\n/*__mr35fcd*/ /* where this person sees the mail: their own rule (R35) can file it in one of\n   their folders, and that is where it must be counted and light up */\nfunction fcFolderOf(t){try{if(typeof mrMove==='function'){const f=mrMove(t);if(f)return f}}catch(e){}return String((t&&t.folder)||'inbox')}",
  "the counts learn where this person sees a mail", 1);

/* 6 · every cache in the app hangs off mailFp() - the drawn list, each row's HTML, the
   folder pane, the unread counts. A personal rule changes what those show without changing
   the mail at all, so the rules (and who is signed in) belong in that fingerprint. Without
   this the list keeps the rows it drew before the rule was saved: the test caught exactly
   that - inView() said no and the list still had the mail in it. */
edit("__mr35fp", "  return h;\n }catch(e){return Math.random()}\n}\nfunction listKey(){",
  "  /*__mr35fp*/ try{h=(h*31+(typeof mrFp==='function'?mrFp():0))|0}catch(e){}\n  return h;\n }catch(e){return Math.random()}\n}\nfunction listKey(){",
  "the caches notice when a personal rule changes", 1);

/* ---- the block ---- */
const START = "<script>/* __myrules:start 27 Nov 2026 - server/my-rules.view.js (rule R35) */";
const END = "/* __myrules:end */</scr" + "ipt>";
const BLOCK = START + "\n" + view.trim() + "\n" + END + "\n";

const a = s.indexOf(START);
if (a >= 0) {
  const b = s.indexOf(END, a);
  if (b < 0) throw new Error("the old __myrules block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + END.length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

fs.writeFileSync(F, s);
console.log(n + " edit(s) + the block. written to " + F);
