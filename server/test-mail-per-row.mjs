/* 26 Nov 2026 - proves that Aman Singh Verma's 25 Nov 17:34 mail gets its OWN row in the
   Team Pulse Inbox. It runs the real explode(), rowName(), rowWho(), toThisBox(),
   colleagueIn(), recvMsg() and the real View-menu sort, all cut verbatim out of the shipped
   app (.tmp/email.html), against the teampulse@ conversation exactly as Gmail returned it.

   Run:  node server/test-mail-per-row.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
/* 26 Nov 2026: this file describes the ONE ROW PER MAIL model. It was reverted the same day
   (server/patch-back-to-yesterday.js) back to one row per conversation, so these checks do
   not apply while that is the case. Everything they test is still in the app and still
   works - turn conv:false back on in LV() and this suite becomes live again. */
if (/\{conv:true\}/.test(src)) {
  console.log("SKIPPED - one row per conversation is on, so the per-mail row rules do not apply.");
  console.log("          (turn conv:false back on in LV() to run these 22 checks)");
  process.exit(0);
}


/* ---- cut the real code out of the app ---- */
const cut = (startsWith, endsBefore) => {
  const i = src.indexOf(startsWith);
  if (i < 0) throw new Error("not found in the app: " + startsWith.slice(0, 50));
  const j = src.indexOf(endsBefore, i);
  if (j < 0) throw new Error("end not found for: " + startsWith.slice(0, 50));
  return src.slice(i, j);
};
const line = (needle) => {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error("not found in the app: " + needle.slice(0, 50));
  const a = src.lastIndexOf("\n", i) + 1;
  const b = src.indexOf("\n", i);
  return src.slice(a, b);
};

const srcRowName  = cut("function rowName(t){", "function rowHTML(t){");
const srcToThis   = line("const toThisBox=(m,t)=>");
const srcColl     = line("const colleagueIn=(m,t)=>");
const srcRecv     = line("const recvMsg=(m,t)=>");
const srcExplode  = cut("function explode(rows){", "const _lrV=listRows;");
const srcLVsort   = cut("const _lrV=listRows;listRows=function(){", "/* __oneRowConv");
const srcLVdef    = line("const LV=()=>Object.assign({},LV_DEF");

/* ---- the harness: only what those functions really touch ---- */
const harness = `
const LV_DEF={sort:'date',dir:'desc',vf:'all',pane:'right',conv:true,lines:1};
${srcLVdef}
const S={prefs:{}};
let view={type:'box',dept:'tp',folder:'inbox'};
let ME='ashok';
const USERS={ashok:{name:'Ashok'}};
const who=id=>USERS[id]||null;
const isOtp=()=>false;
const hasAtt=()=>false, sizeOf=()=>0, mentionsMe=()=>false, toMe=()=>false;
const cleanSub=x=>String(x||'');
const lastOut=t=>{const m=[...(t.msgs||[])].reverse().find(x=>x.by||x.ours);return m?m.at:t.last};
${srcToThis}
${srcColl}
${srcRecv}
${srcRowName}
${srcExplode}
let listRows=()=>ROWS;
${srcLVsort}
`;
const api = new Function(harness + "; return {explode,listRows,rowName,rowWho,LV,setView:v=>{view=v},setRows:r=>{ROWS=r},getView:()=>view}")
  .call({});
/* ROWS has to exist in that scope */
const mk = new Function("ROWS", harness + "; return {explode,listRows,rowName,rowWho,LV,setView:v=>{view=v}}");

let pass = 0, fail = 0;
const ck = (n, got, want) => {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(got) + ")"));
  ok ? pass++ : fail++;
};
const T = (iso) => Date.parse(iso);

/* ---- the REAL teampulse@ conversation 1a2092d6750c36d5, exactly as Gmail returned it ---- */
const thread = {
  id: "tp:1a2092d6750c36d5", box: "teampulse@rugscreation.com", dept: "tp",
  sub: "RE: R V1122 RUGS CREATION - PO 174871 AND 173728 PILLOWS + PO 175033",
  from: "Manfred Mui", email: "Manfred.Mui@nourison.com",
  unread: true, pinned: true, folder: "inbox", last: T("2026-11-25T14:51:35Z"),
  msgs: [
    { at: T("2026-11-23T16:11:33Z"), from: "Manfred Mui", email: "Manfred.Mui@nourison.com", to: "teampulse@rugscreation.com", body: "a" },
    { at: T("2026-11-24T09:09:34Z"), from: "Aman Singh Verma", email: "aman@induskrafts.com", to: "teampulse@rugscreation.com", body: "b" },
    { at: T("2026-11-24T15:19:34Z"), from: "Manfred Mui", email: "Manfred.Mui@nourison.com", to: "teampulse@rugscreation.com", body: "c" },
    { at: T("2026-11-25T12:04:08Z"), from: "Aman Singh Verma", email: "aman@induskrafts.com", to: "teampulse@rugscreation.com", cc: "shipping@rugscreation.com", body: "Dear Ashok, Please go through below mail & confirm your understanding on the same." },
    { at: T("2026-11-25T13:12:24Z"), from: "Ashok – Rugs Creation", email: "teampulse@rugscreation.com", by: "ashok", ours: true, body: "e" },
    { at: T("2026-11-25T14:51:35Z"), from: "Manfred Mui", email: "Manfred.Mui@nourison.com", to: "teampulse@rugscreation.com", body: "f" }
  ]
};
/* an ordinary newer conversation, to prove the pin really wins */
const other = {
  id: "tp:other", box: "teampulse@rugscreation.com", dept: "tp", sub: "Something from today",
  from: "Megan Walsh", email: "megan.walsh@nourison.com", unread: false, pinned: false,
  folder: "inbox", last: T("2026-11-26T09:00:00Z"),
  msgs: [{ at: T("2026-11-26T09:00:00Z"), from: "Megan Walsh", email: "megan.walsh@nourison.com", to: "teampulse@rugscreation.com", body: "z" }]
};

const IST = (ms) => new Date(ms + 5.5 * 3600000).toISOString().slice(0, 16).replace("T", " ");

console.log("=== the Team Pulse Inbox ===");
let A = mk([thread, other]);
let rows = A.listRows();
console.log("  rows drawn: " + rows.length);
rows.forEach(r => console.log("     " + IST(r.last) + " IST   " + A.rowWho(r) + "   | " + String(r.pre || "").slice(0, 46)));

ck("one row per mail is ON", A.LV().conv, false);
const aman = rows.filter(r => A.rowWho(r) === "Aman Singh Verma");
ck("Aman Singh Verma has rows of his own", aman.length, 2);
const target = rows.find(r => r.last === T("2026-11-25T12:04:08Z"));
ck("THE 5:34 PM MAIL HAS ITS OWN ROW", !!target, true);
ck("   ...and it is named Aman Singh Verma", target && A.rowWho(target), "Aman Singh Verma");
ck("   ...and the avatar name matches too", target && A.rowName(target), "Aman Singh Verma");
ck("   ...and it is timed 25 Nov 17:34 IST (5:34 pm)", target && IST(target.last), "2026-11-25 17:34");
ck("   ...and it previews HIS words, not Manfred's", target && /confirm your understanding/.test(String(target.pre)), true);
ck("   ...and it carries its place in the trail (data-mi)", target && target._mi, 3);
ck("   ...and clicking it still opens the same conversation", target && target.id, "tp:1a2092d6750c36d5");
ck("the conversation's own fields still show through", target && target.sub, thread.sub);

console.log("\n=== it must not invent or lose rows ===");
ck("our own sent reply gets no Inbox row", rows.some(r => /Ashok/.test(A.rowWho(r))), false);
ck("all 5 incoming mails are there, plus the other conversation", rows.length, 6);
ck("every row of this conversation has a different trail position",
  new Set(rows.filter(r => r.id === thread.id).map(r => r._mi)).size, 5);
ck("the row HTML cache key differs per mail (t.id + t._mi)",
  new Set(rows.filter(r => r.id === thread.id).map(r => r.id + "|" + r._mi)).size, 5);

console.log("\n=== a pin does NOT reorder the list (locked 26 Nov) ===");
/* This block used to assert the opposite. On 26 Nov the pinned sort was reverted on the
   user's instruction ("why is the Tuesday mail coming on top in Sent") - a pinned Tuesday
   conversation was jumping above today's mail in both folders. Pins are still kept and
   still show their tag; they simply do not move a row. server/test-no-pin-sort.mjs owns
   that rule; these two checks guard it from the per-mail side. */
ck("today's newest mail is first even though an older conversation is pinned", A.rowWho(rows[0]), "Megan Walsh");
ck("the pinned older conversation stays below it", A.rowWho(rows[rows.length - 1]), (g) => g !== "Megan Walsh");
const B = mk([{ ...thread, pinned: false }, other]);
ck("without the pin, today's mail is first too - the pin changed nothing", B.rowWho(B.listRows()[0]), "Megan Walsh");

console.log("\n=== the Sent folder is the mirror image ===");
/* inView decides which conversations reach the list BEFORE explode runs, and for Sent it
   keeps only ones we actually wrote in (app line ~4205:
   t.msgs.some(m=>m.by||(m.ours&&!colleagueIn(m,t)))). The first run of this test skipped
   that gate and then complained that a conversation with nothing sent produced a row -
   the test was wrong, not the app, so the gate is applied here the way the app applies it. */
const sentGate = (t) => t.msgs.some((m) => m.by || (m.ours && String(m.email || "").toLowerCase() !== String(t.box || "").toLowerCase()));
ck("the app's Sent gate drops a conversation we never wrote in", [thread, other].filter(sentGate).length, 1);
const C = mk([thread, other].filter(sentGate));
C.setView({ type: "box", dept: "tp", folder: "sent" });
const sent = C.listRows();
ck("only what we sent gets a Sent row", sent.length, 1);
ck("   ...and it is Ashok's reply", /Ashok/.test(C.rowWho(sent[0])), true);
ck("   ...and Aman gets no Sent row", sent.some((r) => /Aman/.test(C.rowWho(r))), false);

console.log("\n=== a conversation with nothing incoming still shows one row ===");
const D = mk([{ id: "x", box: "teampulse@rugscreation.com", dept: "tp", sub: "s", from: "Ashok", unread: false, pinned: false, folder: "inbox", last: 5, msgs: [{ at: 5, from: "Ashok", email: "teampulse@rugscreation.com", by: "ashok", ours: true, body: "q" }] }]);
ck("it is not dropped from the list", D.listRows().length, 1);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
