/* 26 Nov 2026 — proves the page's memory stays bounded. Runs the real sweeper cut
   verbatim out of the shipped app (.tmp/email.html, the __mem block).

   Budgets were tightened the same evening by patch-page-memory-2.js (15 / 10 / 4 MB and 600
   rows), because the real store turned out to be the mail held ON the conversations -
   that half is tested in server/test-page-memory-2.mjs.

   The three stores it guards were all unbounded before today:
     RAWC   every mail opened this session, its pasted screenshots inlined as data: URLs
     ATTB   every attachment fetched this session (up to 25 MB each)
     ATHUMB every attachment thumbnail

   Run:  node server/test-page-memory.mjs
*/
import fs from "node:fs";
const src = fs.readFileSync(".tmp/email.html", "utf8");

const i = src.indexOf("/* Budgets, in bytes.");
const j = src.indexOf("/* __mem:end */");
if (i < 0 || j < 0) throw new Error("the __mem block is not in the app");
const srcMem = src.slice(i, j);

const harness = `
/* the stores, as the app declares them */
const RAWC={}, ATTB={}, ATHUMB={};
const RHC=new Map();
const S={threads:[]};
let openId=null;
let THREADS={};
const T_=id=>THREADS[id]||null;
function render(){return 'drawn'}
const window={};
let TICKS=0;
const setInterval=()=>{TICKS++;return 0};
${srcMem}
export {RAWC,ATTB,ATHUMB,ATT_SZ,memSweep,memTrim,memPinned,window,render,MEM_RAWC,MEM_ATTB,MEM_THUMB};
export function openConv(id,gids){THREADS[id]={id,msgs:gids.map(g=>({gid:g}))};openId=id}
export function noConv(){openId=null}
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
const rawcBytes = () => Object.keys(A.RAWC).reduce((n, k) => n + (A.RAWC[k].raw || "").length + (A.RAWC[k].body || "").length, 0);
const attBytes = () => Object.keys(A.ATTB).reduce((n, k) => n + (A.ATT_SZ[k] || 0), 0);
const thumbBytes = () => Object.keys(A.ATHUMB).reduce((n, k) => n + String(A.ATHUMB[k]).length, 0);
const clear = (o) => Object.keys(o).forEach((k) => delete o[k]);

console.log("\n=== the budgets the app ships with ===");
ck("opened mail", A.MEM_RAWC, 15 * MB);
ck("attachments", A.MEM_ATTB, 10 * MB);
ck("thumbnails", A.MEM_THUMB, 4 * MB);
/* 27 Nov 2026: the row cache is no longer a flat 600. One row per mail (R17) draws about
   700 rows for a full Inbox window, so a flat 600 cleared the cache on almost every redraw
   and did nothing at all. The ceiling now follows the rows really drawn, and is bounded. */
ck("the row-HTML cache ceiling follows the rows drawn", /RHC\.size>\(window\.__rhcMax\|\|600\)/.test(src), true);
ck("...starting at the old 600", /window\.__rhcMax\|\|600/.test(src), true);
ck("...and it is bounded, so it cannot grow for ever", /Math\.min\(2000,\s*Math\.max\(600/.test(src), true);

console.log("\n=== RAWC · opened mail with pasted screenshots ===");
clear(A.RAWC); A.noConv();
for (let k = 0; k < 60; k++) A.RAWC["m" + k] = { raw: big(1), body: "" };   /* 60 MB */
ck("60 opened mails of 1 MB = 60 MB before the sweep", Math.round(rawcBytes() / MB), 60);
A.memSweep(true);
ck("...swept down inside the 15 MB budget", rawcBytes() <= A.MEM_RAWC, true);
ck("...and it kept as much as it could (over 12 MB)", rawcBytes() > 12 * MB, true);
ck("...the OLDEST went first (m0 gone)", A.RAWC.m0 === undefined, true);
ck("...the newest is still there (m59)", !!A.RAWC.m59, true);

console.log("\n=== nothing on screen is ever thrown away ===");
clear(A.RAWC);
A.RAWC.pinned1 = { raw: big(1), body: "" };          /* oldest, so first to be evicted */
A.RAWC.pinned2 = { raw: big(1), body: "" };
for (let k = 0; k < 60; k++) A.RAWC["m" + k] = { raw: big(1), body: "" };
A.openConv("t1", ["pinned1", "pinned2"]);
A.memSweep(true);
ck("the open conversation's mails survive, though they are the oldest",
  [!!A.RAWC.pinned1, !!A.RAWC.pinned2], [true, true]);
ck("...and the store is still inside its budget", rawcBytes() <= A.MEM_RAWC, true);
ck("...while ordinary old entries were evicted", A.RAWC.m0 === undefined, true);
A.noConv();

console.log("\n=== ATTB · attachment bytes ===");
clear(A.ATTB); clear(A.ATT_SZ);
for (let k = 0; k < 8; k++) { A.ATTB["f" + k] = Promise.resolve(1); A.ATT_SZ["f" + k] = 5 * MB; }
ck("8 files of 5 MB = 40 MB before the sweep", Math.round(attBytes() / MB), 40);
A.memSweep(true);
ck("...swept down inside the 10 MB budget", attBytes() <= A.MEM_ATTB, true);
ck("...the oldest file went first", A.ATTB.f0 === undefined, true);
ck("...the newest file is still there", !!A.ATTB.f7, true);
ck("...and its remembered size went with it", A.ATT_SZ.f0 === undefined, true);

console.log("\n=== ATHUMB · thumbnails ===");
clear(A.ATHUMB);
for (let k = 0; k < 20; k++) A.ATHUMB["t" + k] = big(0.6);                 /* 12 MB */
A.memSweep(true);
ck("swept down inside the 4 MB budget", thumbBytes() <= A.MEM_THUMB, true);
ck("...and some are kept", Object.keys(A.ATHUMB).length > 0, true);

console.log("\n=== a page that is not over the budget is left alone ===");
clear(A.RAWC); clear(A.ATTB); clear(A.ATT_SZ); clear(A.ATHUMB);
A.RAWC.small = { raw: big(2), body: "" };
A.ATHUMB.small = big(1);
A.memSweep(true);
ck("the small mail is kept", !!A.RAWC.small, true);
ck("the small thumbnail is kept", !!A.ATHUMB.small, true);

console.log("\n=== it does not sweep on every single draw ===");
clear(A.RAWC);
for (let k = 0; k < 60; k++) A.RAWC["m" + k] = { raw: big(1), body: "" };
A.memSweep(true);                       /* this one runs and sets the clock */
for (let k = 0; k < 60; k++) A.RAWC["n" + k] = { raw: big(1), body: "" };
const beforeThrottled = rawcBytes();
A.memSweep();                           /* within 5 seconds: must do nothing */
ck("a second sweep inside 5 seconds does nothing", rawcBytes(), beforeThrottled);
A.memSweep(true);                       /* forced: must act */
ck("...and a forced sweep acts", rawcBytes() <= A.MEM_RAWC, true);

console.log("\n=== rzMem() · what the page is holding, for checking on a real screen ===");
const r = A.window.rzMem();
ck("it reports the four stores and a total",
  Object.keys(r).sort().join(","), "attachments,conversations,lastSweep,openedMail,rowHtml,thumbnails,total");
ck("...in MB", /MB$/.test(r.total), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
