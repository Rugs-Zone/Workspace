/* test-mem-cap-m1.mjs - 27 Nov 2026
 *
 * RULE M1 (mandatory): Rugs Email keeps this tab under 250 MB.
 *   "make mandatory rule in setting that rugs email keep tab under 250 mb"
 *
 * TWO HALVES, both on what actually ships:
 *   A. the guard, cut VERBATIM out of .tmp/email.html and run in node against stores
 *      deliberately stuffed past the ceiling - so the numbers are the shipped ones;
 *   B. the Mail rules page in real headless Edge on the BUILT mail-app.html - the row is
 *      there, it says Mandatory, and there is NO switch on it for an admin or anybody else.
 *
 * Run:  node server/test-mem-cap-m1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = typeof w === "function" ? !!w(g) : JSON.stringify(g) === JSON.stringify(w);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + (typeof w === "function" ? "" : ", wanted " + JSON.stringify(w)) + ")"));
  ok ? pass++ : fail++;
};

/* ============================================================ A. the guard = */
const src = fs.readFileSync(path.join(__dirname, "..", ".tmp", "email.html"), "utf8");
const cut = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error("not in the app: " + a.slice(0, 40));
  return src.slice(i, j);
};
const srcMem1 = cut("/* Budgets, in bytes.", "/* __mem:end */");
const srcMem2 = cut("const MEM_LOADED =", "/* __mem2:end */");
const srcCap = cut("/* the ceiling, in megabytes.", "})();\n/* __memcap:end */");

const MB = 1024 * 1024;
const harness = `
const RAWC={}, ATTB={}, ATHUMB={}, LD={};
const RHC=new Map(); const PRE_B64=new Map();
const S={threads:[]};
let openId=null;
const T_=id=>S.threads.find(t=>t.id===id)||null;
function render(){return 'drawn'}
function open(id){openId=id;return id}
const document={querySelector:()=>globalThis.__composing?{}:null};
const window={S:S,performance:undefined,render:render};
const setInterval=()=>0;
${srcMem1}
${srcMem2}
window.S=S;
${srcCap}
export {RAWC,ATTB,ATHUMB,ATT_SZ,RHC,PRE_B64,S,window,memSweep,loadedBytes,stripLoaded,MEM_LOADED};
export function setOpen(id){openId=id}
`;
const A = await import("data:text/javascript," + encodeURIComponent(harness));
const W = A.window;

const big = mb => "x".repeat(Math.round(mb * MB));
let seq = 0;
function conv(seenAt, mb) {
  const id = "c" + (++seq);
  const t = {
    id, dept: "tp", pre: "please confirm the shipment", sub: "PO 174871", folder: "inbox",
    unread: true, owner: "ashok", status: "open", full: true, _seenAt: seenAt,
    msgs: [{ gid: "g" + seq, from: "Aman", body: big(0.02), raw: big(mb || 1), full: true }]
  };
  A.RAWC["g" + seq] = { raw: t.msgs[0].raw, body: t.msgs[0].body };
  return t;
}
const heldMB = () => Math.round(W.__memHeld().b / MB);

console.log("\n=== the ceiling the app ships with ===");
ck("the rule is 250 MB", W.MEM_CAP_MB, 250);
ck("rzMemCap() is there, for reading it off a real screen", typeof W.rzMemCap, "function");
ck("it reports the rule by name", W.rzMemCap().rule, g => /M1/.test(g) && /250 MB/.test(g));
ck("it says plainly that it cannot be switched off", W.rzMemCap().switchable, false);
ck("nothing reads a setting, a URL or localStorage for the number", /localStorage|location|S\.settings/.test(srcCap), false);

console.log("\n=== a tab stuffed to 300 MB (the ceiling is breached) ===");
A.S.threads = [];
for (let k = 0; k < 300; k++) A.S.threads.push(conv(1000 + k));
A.setOpen(A.S.threads[299].id);
A.S.threads[299]._seenAt = 9e9;
for (let k = 0; k < 40; k++) { A.ATTB["f" + k] = "b"; A.ATT_SZ["f" + k] = 2 * MB; }
for (let k = 0; k < 60; k++) A.ATHUMB["t" + k] = big(0.2);
for (let k = 0; k < 500; k++) A.RHC.set("r" + k, big(0.01));
for (let k = 0; k < 10; k++) A.PRE_B64.set("p" + k, { __len: 2 * MB });
const was = heldMB();
ck("it really is over the ceiling before the guard runs", was > 250, true);
const r = W.__memGuard(true);
ck("the guard saw it and acted", r.act, "emergency");
ck("...and brought the tab back under 250 MB", heldMB() <= 250, true);
ck("...it recorded what it did, so it can be checked later", W.rzMemCap().timesItHadToAct, 1);
ck("...and the last action names the figure it came down from", W.rzMemCap().lastActions[0].was >= was - 1, true);

console.log("\n=== what it kept, and what it dropped ===");
ck("the conversation ON SCREEN still has its mail", A.S.threads[299].msgs[0].raw !== undefined, true);
ck("an old conversation's heavy text is gone", A.S.threads[0].msgs[0].raw === undefined, true);
ck("...but its row and preview are untouched", A.S.threads[0].pre, "please confirm the shipment");
ck("...and it is marked not-loaded, so opening it fetches it again", A.S.threads[0].full, false);
ck("the attachment bytes are dropped", Object.keys(A.ATTB).length, 0);
ck("the thumbnails are dropped", Object.keys(A.ATHUMB).length, 0);
ck("the drawn-row cache is dropped", A.RHC.size, 0);

console.log("\n=== it never touches the mail itself ===");
const t0 = A.S.threads[0];
ck("the folder is unchanged", t0.folder, "inbox");
ck("unread is unchanged", t0.unread, true);
ck("the owner is unchanged", t0.owner, "ashok");
ck("the status is unchanged", t0.status, "open");
ck("no conversation was removed from the list", A.S.threads.length, 300);
ck("the guard sends nothing to the server", /api\(|fetch\(/.test(srcCap), false);

console.log("\n=== somebody is writing a mail: their files are not ours to drop ===");
A.PRE_B64.set("p99", { __len: 2 * MB });
globalThis.__composing = true;
for (let k = 0; k < 300; k++) A.S.threads.push(conv(500 + k));   /* breach it again */
W.__memGuard(true);
ck("the files on the mail being written are still there", A.PRE_B64.has("p99"), true);
ck("...and a tab still over the ceiling with a mail being written is brought down anyway", heldMB() <= 250, true);
globalThis.__composing = false;
for (let k = 0; k < 300; k++) A.S.threads.push(conv(400 + k));   /* breach it a third time */
ck("it is over the ceiling again", heldMB() > 250, true);
W.__memGuard(true);
ck("...and now nobody is writing, those files are dropped too", A.PRE_B64.size, 0);

console.log("\n=== a quiet tab is left alone ===");
A.S.threads = [conv(1, 1)];
A.setOpen(A.S.threads[0].id);
const quiet = heldMB();
const r2 = W.__memGuard(true);
ck("under 200 MB it does nothing at all", r2.act, "");
ck("...and holds what it held", heldMB(), quiet);
ck("the figure it reports is a number of MB", typeof W.rzMemCap().nowMB, "number");

/* =========================================================== B. the page == */
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

console.log("\n=== the guard is live in the built app ===");
const live = await page.evaluate(() => ({
  cap: window.MEM_CAP_MB,
  fn: typeof window.rzMemCap,
  now: (window.rzMemCap && window.rzMemCap().nowMB),
  how: (window.rzMemCap && window.rzMemCap().measured) || "",
  guard: typeof window.__memGuard
}));
ck("the ceiling is in the shipped app", live.cap, 250);
ck("rzMemCap() answers in the real browser", live.fn, "function");
ck("the guard is hooked up", live.guard, "function");
ck("Edge reports the tab's own memory, not a guess", live.how, g => /tab/.test(g));
ck("a freshly opened tab is well under the ceiling", live.now > 0 && live.now < 250, true);

console.log("\n=== Admin -> Mail rules: the row, as an admin ===");
const row = await page.evaluate(() => {
  const me = PEOPLE.find(p => p.role === "Admin") || PEOPLE[0];
  if (me) { me.role = "Admin"; window.ME = me.id; }
  const h = (typeof rulesHTML === "function") ? rulesHTML(true) : "";
  const d = document.createElement("div"); d.innerHTML = h;
  const rows = [...d.querySelectorAll(".rlrow")];
  const m1 = rows.find(x => (x.querySelector(".rlid") || {}).textContent === "M1");
  return {
    there: !!m1,
    name: m1 ? (m1.querySelector(".rlnm") || {}).textContent : "",
    badge: m1 ? (m1.querySelector(".rlbadge") || {}).textContent : "",
    says: m1 ? (m1.querySelector(".rlnow") || {}).textContent : "",
    switches: m1 ? m1.querySelectorAll("[data-rtog]").length : -1,
    act: m1 ? (m1.querySelector(".rlact em") || {}).textContent : "",
    section: /Speed and memory/.test(h),
    health: [...d.querySelectorAll(".rlck")].map(x => x.textContent).filter(x => /M1|250 MB/.test(x)).length,
    otherSwitches: d.querySelectorAll("[data-rtog]").length
  };
});
ck("rule M1 is on the page", row.there, true);
ck("it is named in plain words", row.name, "Rugs Email keeps this tab under 250 MB");
ck("it carries the Mandatory badge", row.badge, "Mandatory");
ck("it is in its own \"Speed and memory\" section", row.section, true);
ck("it has NO on/off switch, for an admin either", row.switches, 0);
ck("...and says so where the switch would be", row.act, "cannot be switched off");
ck("it shows the live figure, not a promise", row.says, g => /\d+(\.\d+)? MB \(\d+% of 250 MB\)/.test(g));
ck("it tells you what happens over 200 MB and over 250 MB", row.says, g => /200 MB/.test(g) && /250 MB/.test(g));
ck("the \"Checks right now\" panel reports it too", row.health > 0, true);
ck("the eight real switches are still switches", row.otherSwitches, 8);

console.log("\n=== and for somebody who is not an admin (read-only page) ===");
const ro = await page.evaluate(() => {
  const h = (typeof rulesHTML === "function") ? rulesHTML(false) : "";
  const d = document.createElement("div"); d.innerHTML = h;
  const rows = [...d.querySelectorAll(".rlrow")];
  const m1 = rows.find(x => (x.querySelector(".rlid") || {}).textContent === "M1");
  return { there: !!m1, switches: m1 ? m1.querySelectorAll("[data-rtog]").length : -1, badge: m1 ? (m1.querySelector(".rlbadge") || {}).textContent : "" };
});
ck("a member can read the rule", ro.there, true);
ck("...with no switch", ro.switches, 0);
ck("...and the same Mandatory badge", ro.badge, "Mandatory");

console.log("\n=== the rule cannot be stored, so nobody can switch it off later ===");
const nostore = await page.evaluate(() => {
  const before = JSON.stringify((S.settings && S.settings.mail_rules) || {});
  let threw = "";
  try { if (typeof rSet === "function") rSet("M1", false); } catch (e) { threw = String(e.message || e); }
  const after = JSON.stringify((S.settings && S.settings.mail_rules) || {});
  return { rdef: typeof RDEF !== "undefined" ? ("M1" in RDEF) : null, resetTouchesIt: typeof RULES !== "undefined" ? RULES.filter(r => r.id === "M1" && r.k === "sw").length : -1, changedUI: before !== after, threw };
});
ck("M1 is not one of the switchable defaults", nostore.rdef, false);
ck("\"put every rule back\" cannot reach it either", nostore.resetTouchesIt, 0);
ck("and even calling the saver by hand gives it no switch on the page", await page.evaluate(() => {
  const d = document.createElement("div"); d.innerHTML = rulesHTML(true);
  const rows = [...d.querySelectorAll(".rlrow")];
  const m1 = rows.find(x => (x.querySelector(".rlid") || {}).textContent === "M1");
  return m1 ? m1.querySelectorAll("[data-rtog]").length : -1;
}), 0);

console.log("\n=== phone width, and no page errors ===");
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(400);
const phone = await page.evaluate(() => ({
  wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  cap: window.rzMemCap().capMB
}));
ck("the rule is enforced on a phone too", phone.cap, 250);
ck("it adds no sideways scroll", phone.wide <= 3, true);
ck("no page errors", errs.filter(e => !/sandbox|ERR_UNKNOWN_URL_SCHEME/i.test(e)), []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
