/* 26 Nov 2026 - "in sent you have made erro in yesterday, today" and
   "My work will show only when it is not done but in Inbox all mail will show".
   Both checked against the app's own code, cut verbatim out of .tmp/email.html.

   Run:  node server/test-sent-time-mywork.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");
const cut = (a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error("not found: " + a.slice(0, 50)); const j = src.indexOf(b, i); if (j < 0) throw new Error("end not found: " + b.slice(0, 40)); return src.slice(i, j); };

let pass = 0, fail = 0;
const ck = (n, got, want) => {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(got) + ")"));
  ok ? pass++ : fail++;
};
const T = (iso) => Date.parse(iso);
const IST = (ms) => new Date(ms + 5.5 * 3600000).toISOString().slice(0, 16).replace("T", " ");

/* ---------------- 1. the time a Sent row stands for ---------------- */
console.log("=== Sent: each row must carry ITS OWN mail's date ===");
const srcRowWhen = cut("function rowWhen(t){", "function rowName(t){");
const api = new Function(`
let view={type:'box',dept:'tp',folder:'sent'};
const lastOut=t=>{const m=[...(t.msgs||[])].reverse().find(x=>x.by||x.ours);return m?m.at:t.last};
${srcRowWhen}
return {rowWhen,setView:v=>{view=v}}`)();

/* one conversation we wrote in three times, on three different days */
const conv = {
  id: "tp:x", box: "teampulse@rugscreation.com", dept: "tp",
  last: T("2026-11-26T05:00:00Z"),
  msgs: [
    { at: T("2026-11-24T06:00:00Z"), from: "Ashok", email: "teampulse@rugscreation.com", by: "ashok", ours: true },
    { at: T("2026-11-25T07:00:00Z"), from: "Ashok", email: "teampulse@rugscreation.com", by: "ashok", ours: true },
    { at: T("2026-11-26T05:00:00Z"), from: "Ashok", email: "teampulse@rugscreation.com", by: "ashok", ours: true }
  ]
};
const rowFor = (i) => { const p = Object.create(conv); p._one = true; p._mi = i; p.last = conv.msgs[i].at; return p; };
const r0 = rowFor(0), r1 = rowFor(1), r2 = rowFor(2);

console.log("     Tuesday row  -> " + IST(api.rowWhen(r0)));
console.log("     Wednesday    -> " + IST(api.rowWhen(r1)));
console.log("     Today        -> " + IST(api.rowWhen(r2)));
ck("the Tuesday mail is dated Tuesday, not today", IST(api.rowWhen(r0)), "2026-11-24 11:30");
ck("the Wednesday mail is dated Wednesday", IST(api.rowWhen(r1)), "2026-11-25 12:30");
ck("the newest is dated today", IST(api.rowWhen(r2)), "2026-11-26 10:30");
ck("THE THREE ROWS NO LONGER SHARE ONE DATE", new Set([api.rowWhen(r0), api.rowWhen(r1), api.rowWhen(r2)]).size, 3);
ck("they fall on three different days, so three day headings",
  new Set([r0, r1, r2].map((r) => IST(api.rowWhen(r)).slice(0, 10))).size, 3);
ck("the sort key and the printed time are now the same thing",
  [r0, r1, r2].every((r) => api.rowWhen(r) === r.last), true);

/* a conversation row (per-mail rows off) must behave exactly as before */
ck("a conversation row in Sent still uses the newest mail we sent", api.rowWhen(conv), T("2026-11-26T05:00:00Z"));
api.setView({ type: "box", dept: "tp", folder: "inbox" });
ck("in the Inbox a conversation row still uses the newest mail of all", api.rowWhen(conv), conv.last);
ck("in the Inbox a per-mail row is still its own mail", api.rowWhen(r0), conv.msgs[0].at);

/* ---------------- 2. My work: not-done only; Inbox: everything ---------------- */
console.log("\n=== My work shows only what is NOT done; the Inbox shows everything ===");
const srcParts = cut("function partsOf(t) {", "/* the My work view, its count and the Mine filter all follow the same rule */");
const srcSentWho = cut("function sentWho(m,t){", "\nfunction ");
const srcNmKey = cut("function nmKey(s){", "function sentWho(m,t){");
const w = new Function(`
let ME='ashok';
const PEOPLE=[{id:'ashok',name:'Ashok',login:'merchandiser5@rugscreation.com',dept:'tp',active:true,perm:{}}];
${srcNmKey}
${srcSentWho}
${srcParts}
/* the My work scope, exactly as the view and the folder count use it */
const st=t=>t.status==='done'?'done':'open';
const hasRecv=t=>(t.msgs||[]).some(m=>!m.ours&&!m.by);
const myWorkScope=t=>isMyWork(t)&&st(t)!=='done'&&hasRecv(t);
return {myWorkScope,isMyWork}`)();

const base = { id: "tp:y", owner: "ashok", parts: [], msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }, { at: 2, from: "Ashok", by: "ashok", ours: true }] };
ck("an open conversation of mine IS in My work", w.myWorkScope({ ...base, status: "open" }), true);
ck("the SAME conversation marked done is NOT in My work", w.myWorkScope({ ...base, status: "done" }), false);
ck("a done conversation is still mine (the Inbox will still show it)", w.isMyWork({ ...base, status: "done" }), true);
ck("a conversation we only sent is not work", w.myWorkScope({ ...base, status: "open", msgs: [{ at: 1, from: "Ashok", by: "ashok", ours: true }] }), false);
ck("somebody else's open conversation is not in my My work", w.myWorkScope({ ...base, status: "open", owner: "arun", msgs: [{ at: 1, from: "Buyer", email: "b@x.com" }] }), false);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
