/* 26 Nov 2026 — the loaded mail held ON the conversations (S.threads), which is where the
   memory really was. Runs both real sweeper blocks cut verbatim out of the shipped app.

   Run:  node server/test-page-memory-2.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");

const slice = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < 0) throw new Error("not in the app: " + a.slice(0, 40));
  return src.slice(i, j);
};
const srcMem1 = slice("/* Budgets, in bytes.", "/* __mem:end */");
const srcMem2 = slice("const MEM_LOADED =", "/* __mem2:end */");

const harness = `
const RAWC={}, ATTB={}, ATHUMB={}, LD={};
const RHC=new Map();
const PRE_B64=new Map();
const S={threads:[]};
let openId=null;
const T_=id=>S.threads.find(t=>t.id===id)||null;
function render(){return 'drawn'}
function open(id){openId=id;return id}
const window={};
const setInterval=()=>0;
${srcMem1}
${srcMem2}
export {RAWC,ATTB,ATHUMB,ATT_SZ,RHC,PRE_B64,S,memSweep,loadedBytes,stripLoaded,memTrimLoaded,
        MEM_LOADED,MEM_PREB64,MEM_RAWC,window,open};
export function setOpen(id){openId=id}
`;

const A = await import("data:text/javascript," + encodeURIComponent(harness));

let pass = 0, fail = 0;
function ck(what, got, want) {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}` + (ok ? "" : `   (got ${JSON.stringify(got)})`));
  ok ? pass++ : fail++;
}
const MB = 1024 * 1024;
const big = (mb) => "x".repeat(Math.round(mb * MB));

/* a conversation holding one loaded mail of ~1 MB, like a trail with a pasted screenshot */
let seq = 0;
function conv(seenAt, mb) {
  const id = "c" + (++seq);
  const t = {
    id, dept: "tp", pre: "please confirm the shipment", sub: "PO 174871",
    full: true, _seenAt: seenAt,
    msgs: [{ gid: "g" + seq, from: "Aman", body: big(0.02), raw: big(mb || 1), full: true }]
  };
  A.RAWC["g" + seq] = { raw: t.msgs[0].raw, body: t.msgs[0].body };
  return t;
}
const onList = () => A.S.threads.reduce((n, t) => n + A.loadedBytes(t), 0);

console.log("\n=== the budget the app ships with ===");
ck("loaded mail on the conversations", A.MEM_LOADED, 35 * MB);
ck("the cache of opened mail came down to 15 MB", A.MEM_RAWC, 15 * MB);
ck("compose attachments", A.MEM_PREB64, 15 * MB);

console.log("\n=== 50 opened conversations · 50 MB of mail on the list ===");
A.S.threads = [];
for (let k = 0; k < 50; k++) A.S.threads.push(conv(1000 + k));
/* 1 MB of HTML plus its own text, 50 times */
ck("about 51 MB before the sweep", Math.round(onList() / MB), 51);
A.memSweep(true);
ck("...swept inside the 35 MB budget", onList() <= A.MEM_LOADED, true);
ck("...and it did not throw away more than it had to", onList() > 30 * MB, true);
ck("...the one looked at longest ago went first", A.S.threads[0].full, false);
ck("...and the most recent is untouched", A.S.threads[49].full, true);

console.log("\n=== what a stripped conversation looks like ===");
const stripped = A.S.threads[0], m0 = stripped.msgs[0];
ck("the heavy mail text is gone", m0.raw === undefined, true);
ck("it is marked not-loaded, so opening it fetches it again", [stripped.full, m0.full], [false, false]);
ck("the row still has its preview, so the list is unchanged", stripped.pre, "please confirm the shipment");
ck("the short text is kept, trimmed to the preview length", m0.body.length <= 1500, true);
ck("its entry in the cache went too", A.RAWC[m0.gid] === undefined, true);

console.log("\n=== nothing on screen, or just looked at, is stripped ===");
A.S.threads = [];
const oldest = conv(1);                       /* looked at first, so first to go */
const watched = conv(2);
for (let k = 0; k < 50; k++) A.S.threads.push(conv(1000 + k));
A.S.threads.unshift(oldest, watched);
A.setOpen(watched.id);
A.memSweep(true);
ck("the conversation on screen keeps its mail", watched.full, true);
ck("...even though it was looked at long before the others", watched._seenAt, 2);
ck("the last three looked at keep theirs",
  [A.S.threads[A.S.threads.length - 1].full, A.S.threads[A.S.threads.length - 2].full], [true, true]);
ck("the oldest one was stripped", oldest.full, false);
ck("and the list is inside its budget", onList() <= A.MEM_LOADED, true);
A.setOpen(null);

console.log("\n=== a page under the budget is left alone ===");
A.S.threads = [conv(5000, 2), conv(5001, 2)];
A.memSweep(true);
ck("both conversations keep their mail", A.S.threads.map((t) => t.full), [true, true]);

console.log("\n=== compose attachments (encoded, so a third bigger than the files) ===");
for (let k = 0; k < 8; k++) { const p = Promise.resolve(1); p.__len = 3 * MB; A.PRE_B64.set("f" + k, p); }
let preTotal = () => { let n = 0; A.PRE_B64.forEach((v) => { n += (v && v.__len) || 0; }); return n; };
ck("24 MB held after writing a few mails", Math.round(preTotal() / MB), 24);
A.memSweep(true);
ck("...swept inside the 15 MB budget", preTotal() <= A.MEM_PREB64, true);

console.log("\n=== rzMem() · what to type in the browser to check a real screen ===");
A.S.threads = [conv(9000), conv(9001)];
const r = A.window.rzMem();
ck("it names the loaded mail and how many conversations hold it", /MB in 2 conversations/.test(r.mailLoaded), true);
ck("it gives one total for what Rugs Email holds", /MB$/.test(r.heldByRugsEmail), true);
ck("it says the browser's own use is on top", /browser/.test(r.note), true);
ck("rzMemTrim() forces a sweep and reports back", /MB$/.test(A.window.rzMemTrim().heldByRugsEmail), true);

console.log("\n=== worst case: everything full at once ===");
A.S.threads = [];
for (let k = 0; k < 80; k++) A.S.threads.push(conv(1000 + k));
for (let k = 0; k < 20; k++) { A.ATTB["a" + k] = Promise.resolve(1); A.ATT_SZ["a" + k] = 5 * MB; }
for (let k = 0; k < 40; k++) A.ATHUMB["t" + k] = big(0.5);
for (let k = 0; k < 20; k++) { const p = Promise.resolve(1); p.__len = 3 * MB; A.PRE_B64.set("g" + k, p); }
A.memSweep(true);
let attT = 0; Object.keys(A.ATT_SZ).forEach((k) => { attT += A.ATT_SZ[k]; });
let thT = 0; Object.keys(A.ATHUMB).forEach((k) => { thT += String(A.ATHUMB[k]).length; });
const held = onList() + attT + thT + preTotal();
console.log(`     held by Rugs Email after the sweep: ${Math.round(held / MB)} MB`);
ck("everything Rugs Email holds adds up to well under 250 MB", held < 80 * MB, true);
ck("...loaded mail inside budget", onList() <= A.MEM_LOADED, true);
ck("...attachments inside budget", attT <= 10 * MB, true);
ck("...thumbnails inside budget", thT <= 4 * MB, true);
ck("...compose files inside budget", preTotal() <= A.MEM_PREB64, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
