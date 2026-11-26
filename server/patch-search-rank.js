/* patch-search-rank.js - 27 Nov 2026  (night plan, bug 1: "search hides mail")
 *
 *   1. embeds server/mail-search.view.js between __srch:start / __srch:end (re-runnable);
 *   2. makes qMatch judge a NUMBER as a whole number (4815 must not match 24815 or 148150)
 *      and lets it look at the To / Cc line, so "then sender/To" can actually rank;
 *   3. makes the search box ask the server again when a filter chip changes the text.
 *
 * It changes NOTHING about who may see a mail: every wrapper runs on rows the ownership
 * chain has already filtered.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-search-rank.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
const V = path.join(__dirname, "mail-search.view.js");
let s = fs.readFileSync(F, "utf8");
const view = fs.readFileSync(V, "utf8");
if (view.indexOf("</scr" + "ipt>") >= 0) throw new Error("the view file must not contain a closing script tag");

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

/* ---- 1. qMatch: whole numbers, and the To/Cc line is searchable ---- */
one(
  "__srchword",
  " const hay=[t.from,t.email,t.sub,t.pre,t.promise,who(t.owner)?.name,...t.msgs.map(m=>m.body),...t.msgs.flatMap(m=>(m.atts||[]).map(a=>a.name))].join(' ').toLowerCase();\n" +
  " return o.words.every(w=>hay.includes(w))};",
  " /* __srchword 27 Nov 2026: the To/Cc line is part of the haystack (so \"then sender/To\"\n" +
  "    can rank), and a word that is all digits must match as a WHOLE number - searching\n" +
  "    4815 used to drag in 24815 and 148150. qWord() is in the __srch block. */\n" +
  " const hay=[t.from,t.email,t.sub,t.pre,t.promise,who(t.owner)?.name,...t.msgs.map(m=>m.body),...t.msgs.map(m=>String(m.to||'')+' '+String(m.cc||'')),...t.msgs.flatMap(m=>(m.atts||[]).map(a=>a.name))].join(' ').toLowerCase();\n" +
  " return o.words.every(w=>(typeof qWord==='function')?qWord(hay,w):hay.includes(w))};",
  "qMatch matches a number as a whole number and sees the To/Cc line"
);

/* ---- 2. the block itself ---- */
const BLOCK = "<script>" + view.replace(/\s*$/, "") + "\n</scr" + "ipt>\n";
const a = s.indexOf("<script>/* mail-search.view.js");
if (a >= 0) {
  const b = s.indexOf("/* __srch:end */", a);
  if (b < 0) throw new Error("the old __srch block has no end marker");
  const e = s.indexOf("</scr" + "ipt>", b);
  s = s.slice(0, a) + BLOCK.trim() + s.slice(e + ("</scr" + "ipt>").length);
  console.log("  replaced the existing search block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  search block appended");
}

fs.writeFileSync(F, s);
console.log(n + " edit(s) + the block. written to " + F);
