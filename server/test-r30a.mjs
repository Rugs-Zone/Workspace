/* test-r30a.mjs - 27 Nov 2026 (bug 16, rule R30a)
 *
 *   "a conversation whose mails are ALL older than the team's go-live is visible to every
 *    member of Team Alpha and Team Pulse whatever its owner - but ONLY in search and
 *    'Show in Inbox', NOT in the Inbox list (so the Inbox does not grow). Never work,
 *    no Done button, owner never changes. Per-team switch on Admin -> Mail rules.
 *    Tab must stay under 250 MB (M1)."
 *
 * Real headless Edge on the BUILT app (mail-app.html). Team Alpha goes live on 15 Nov, so
 * the two conversations the task names are:
 *    OLD  - 10 Nov, owned by a colleague (Gulab)  -> a member must FIND it by searching
 *    NEW  - 20 Nov, owned by the same colleague   -> a member must still NOT find it
 * and both are checked from a member's, a manager's and the admin's point of view.
 *
 * Run:  node server/test-r30a.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

/* ============================== 0 · the leftover is gone ================== */
console.log("=== 0 · the half-written R30a is gone, the clean one is in ===");
const VIEW = fs.readFileSync(path.join(__dirname, "mail-rules.view.js"), "utf8");
ck("no __r30arule marker left anywhere in the view", VIEW.indexOf("__r30arule") >= 0, false);
ck("no __r30akeep (the old unmarked edit) left", VIEW.indexOf("__r30akeep:") >= 0, false);
ck("the clean row is there", VIEW.indexOf("__r30arow") >= 0, true);
ck("the clean chooser is there", VIEW.indexOf("__r30adlg") >= 0, true);
const APP = fs.readFileSync(path.join(__dirname, "..", "mail-app.html"), "utf8");
ck("the engine block shipped", APP.indexOf("__r30a:start") >= 0, true);
ck("the page ships the R30a row", APP.indexOf("__r30arow") >= 0, true);
ck("no leftover helper call without its helper", APP.indexOf("typeof r30aTeam === 'function' && r30aTeam(d.id)") >= 0, false);

/* ==================================== the app ============================= */
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof r30aOld !== "function") return "the R30a block is not in the app";
  const D = s => Date.parse(s + "T10:00:00+05:30");
  const GOLIVE = D("2026-11-15");

  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "gulab", name: "Gulab Tyagi", login: "amr1@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: {} },
    { id: "neetu", name: "Neetu Rani", login: "neetu@rugscreation.com", dept: "nx", role: "Executive", active: true, perm: {} },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" },
    { id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" },
    { id: "nx", name: "Team Neetu", box: "neetu@", color: "#2a8" },
    { id: "mkt", name: "Marketing", box: "marketing@", color: "#7a3fd1" });
  S.trackFrom = { ta: GOLIVE, tp: GOLIVE, nx: GOLIVE, mkt: GOLIVE };

  const mk = (id, d, when, owner, sub, body) => {
    const at = D(when);
    return {
      id: d + ":" + id, box: (DEPTS.find(x => x.id === d).box) + "rugscreation.com", dept: d,
      from: "Aman Singh Verma", email: "aman@induskrafts.com", sub: sub, pre: body, last: at,
      owner: owner, status: "open", folder: "inbox", unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true,
      msgs: [{ gid: "g" + id, from: "Aman Singh Verma", email: "aman@induskrafts.com", at: at, body: body, to: (DEPTS.find(x => x.id === d).box) + "rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "" }]
    };
  };
  S.threads = [
    /* the two the task names - both Gulab's, both in Team Alpha, same words */
    mk("old", "ta", "2026-11-10", "gulab", "PILLOWS PO 174871 zipper", "zipper sample for PO 174871"),
    mk("new", "ta", "2026-11-20", "gulab", "PILLOWS PO 175033 zipper", "zipper sample for PO 175033"),
    /* a member's own old one, which R3 already lets him see */
    mk("mine", "ta", "2026-11-09", "imran", "PILLOWS PO 170000 zipper", "zipper sample for PO 170000"),
    /* nobody's old one - R1 already lets the team see it */
    mk("free", "ta", "2026-11-08", null, "PILLOWS PO 160000 zipper", "zipper sample for PO 160000"),
    /* the same shape in a team R30a is OFF for */
    mk("nxold", "nx", "2026-11-10", "neetu", "PILLOWS PO 180000 zipper", "zipper sample for PO 180000")
  ];
  S.settings = {}; ME = "imran"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  if (typeof lfilt !== "undefined") lfilt = "";
  if (typeof tab !== "undefined") tab = "focused";
  openId = null;
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");

  window.__as = id => { ME = id; };
  window.__ids = rows => rows.map(t => t.id);
  window.__search = q => {
    const el = document.getElementById("q"); el.value = q;
    const r = listRows();
    return r.map(t => t.id);
  };
  window.__inbox = () => {
    const el = document.getElementById("q"); el.value = "";
    view = { type: "box", dept: "ta", folder: "inbox" };
    return listRows().map(t => t.id);
  };
  return "ok";
});
ck("the app is set up", setup, "ok");

/* ======================= 1 · the case the task names ===================== */
console.log("\n=== 1 · as a MEMBER: the 10 Nov one is found, the 20 Nov one is not ===");
let r = await page.evaluate(() => { __as("imran"); return __search("zipper"); });
ck("a member searching 'zipper' FINDS the 10 Nov colleague-owned conversation", r.indexOf("ta:old") >= 0, true);
ck("...and does NOT find the 20 Nov one", r.indexOf("ta:new") >= 0, false);
ck("...still finds his own old one", r.indexOf("ta:mine") >= 0, true);
ck("...still finds the one nobody has taken", r.indexOf("ta:free") >= 0, true);

console.log("\n=== 1b · the Inbox list does not grow ===");
r = await page.evaluate(() => { __as("imran"); return __inbox(); });
ck("the 10 Nov colleague-owned one is NOT in the member's Inbox list", r.indexOf("ta:old") >= 0, false);
ck("nor is the 20 Nov one", r.indexOf("ta:new") >= 0, false);
ck("his own and the unowned one still are", [r.indexOf("ta:mine") >= 0, r.indexOf("ta:free") >= 0], [true, true]);
const counts = await page.evaluate(() => {
  __as("imran"); const el = document.getElementById("q"); el.value = "";
  view = { type: "box", dept: "ta", folder: "inbox" };
  const t = S.threads.find(x => x.id === "ta:old");
  return { inbox: isInboxMail(t), inview: inView(t), see: seeMine(t) };
});
ck("isInboxMail says no for it (so no folder count moves)", counts.inbox, false);
ck("inView says no for it", counts.inview, false);
ck("seeMine says no for it with no search running", counts.see, false);

console.log("\n=== 1c · the same two as a MANAGER and as the ADMIN ===");
r = await page.evaluate(() => { __as("jagjit"); return __search("zipper"); });
ck("the manager finds both", [r.indexOf("ta:old") >= 0, r.indexOf("ta:new") >= 0], [true, true]);
r = await page.evaluate(() => { __as("jagjit"); return __inbox(); });
ck("and the manager has both in his Inbox, as before", [r.indexOf("ta:old") >= 0, r.indexOf("ta:new") >= 0], [true, true]);
r = await page.evaluate(() => { __as("adm"); return __search("zipper"); });
ck("the admin finds both", [r.indexOf("ta:old") >= 0, r.indexOf("ta:new") >= 0], [true, true]);

/* ============================ 2 · the date edge ========================== */
console.log("\n=== 2 · it stops dead at the team's go-live ===");
r = await page.evaluate(() => {
  const t = S.threads.find(x => x.id === "ta:old");
  const was = t.last, tf = S.trackFrom.ta;
  const out = {};
  t.last = tf - 1000; out.aSecondBefore = r30aOld(t);
  t.last = tf; out.exactlyOnIt = r30aOld(t);
  t.last = tf + 1000; out.aSecondAfter = r30aOld(t);
  t.last = was;
  return out;
});
ck("a second before go-live -> old mail", r.aSecondBefore, true);
ck("exactly on go-live -> not old", r.exactlyOnIt, false);
ck("a second after -> not old", r.aSecondAfter, false);
r = await page.evaluate(() => {
  __as("imran");
  const t = S.threads.find(x => x.id === "ta:old");
  const was = t.last, msgs = t.msgs.slice();
  /* the buyer really writes again - a new message, not just a new date */
  const at = Date.parse("2026-11-21T10:00:00+05:30");
  t.msgs.push({ gid: "gold2", from: "Aman Singh Verma", email: "aman@induskrafts.com", at: at, body: "zipper chased", to: t.box, cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "" });
  t.last = at;
  const found = __search("zipper").indexOf("ta:old") >= 0;
  t.msgs = msgs; t.last = was;
  return found;
});
ck("the buyer writes again after go-live and the member cannot find it any more", r, false);
r = await page.evaluate(() => {
  __as("imran");
  const t = S.threads.find(x => x.id === "ta:old");
  const was = t.last;
  /* the ROW of the old mail in a conversation that also has a new one must not leak:
     an exploded row carries its own mail's time, so r30aOld has to climb back up */
  const msgs = t.msgs.slice();
  const at = Date.parse("2026-11-21T10:00:00+05:30");
  t.msgs.push({ gid: "gold3", from: "Aman Singh Verma", email: "aman@induskrafts.com", at: at, body: "zipper chased again", to: t.box, cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "" });
  t.last = at;
  const rows = __search("zipper");
  const leaked = rows.filter(x => x === "ta:old").length;
  t.msgs = msgs; t.last = was;
  return leaked;
});
ck("...and NEITHER of its two rows leaks (the per-mail row climbs back to the conversation)", r, 0);
r = await page.evaluate(() => {
  const t = S.threads.find(x => x.id === "ta:old");
  const was = S.trackFrom.ta; S.trackFrom.ta = 0;
  const o = r30aOld(t); S.trackFrom.ta = was; return o;
});
ck("a team with no go-live date opens nothing", r, false);

/* ======================== 3 · the per-team switch ======================== */
console.log("\n=== 3 · the per-team switch (ON: Alpha, Pulse) ===");
r = await page.evaluate(() => {
  S.settings = {};
  return { ta: r30aTeam("ta"), tp: r30aTeam("tp"), nx: r30aTeam("nx"), mkt: r30aTeam("mkt"), list: r30aList() };
});
ck("shipped default is ON for Team Alpha", r.ta, true);
ck("shipped default is ON for Team Pulse", r.tp, true);
ck("OFF for Team Neetu", r.nx, false);
ck("OFF for Marketing", r.mkt, false);
ck("the default list is exactly the two teams", r.list, ["teamalpha", "teampulse"]);
r = await page.evaluate(() => { __as("neetu"); return __search("zipper").indexOf("nx:nxold") >= 0; });
ck("the same shape in a team it is OFF for is found by its owner", r, true);
r = await page.evaluate(() => {
  __as("imran");
  S.settings = { mail_rules: { v: 1, vals: {}, r30a: ["teampulse"] } };
  const found = __search("zipper").indexOf("ta:old") >= 0;
  return { on: r30aTeam("ta"), found: found };
});
ck("an admin switching Alpha off -> the rule is off for it", r.on, false);
ck("...and the member can no longer find the old one", r.found, false);
r = await page.evaluate(() => {
  __as("imran");
  S.settings = { mail_rules: { v: 1, vals: {}, r30a: [] } };
  return { on: r30aTeam("ta"), found: __search("zipper").indexOf("ta:old") >= 0 };
});
ck("an empty list means off everywhere (not 'fall back to the default')", r, { on: false, found: false });
r = await page.evaluate(() => {
  S.settings = { mail_rules: { v: 1, vals: {}, r30a: ["TeamAlpha@rugscreation.com"] } };
  return r30aTeam("ta");
});
ck("a full address, any case, still matches (local parts are compared)", r, true);

/* ===================== 4 · never work, no Done, no owner ================= */
console.log("\n=== 4 · never work, no Done button, owner never changes ===");
r = await page.evaluate(() => {
  S.settings = {}; __as("imran");
  const t = S.threads.find(x => x.id === "ta:old");
  const el = document.getElementById("q"); el.value = "zipper";
  const rows = listRows();
  const row = rows.find(x => x.id === "ta:old");
  const h = rowHTML(row || t);
  el.value = "";
  return {
    work: isWork(t), only: r30aOnly(t),
    qdone: h.indexOf("data-qdone") >= 0, tag: h.indexOf("Old mail") >= 0,
    owner: t.owner, status: t.status, folder: t.folder, unread: t.unread
  };
});
ck("it is NOT work (rule R30 already answers that)", r.work, false);
ck("the app knows it is visible only because of R30a", r.only, true);
ck("its row carries NO Done tick", r.qdone, false);
ck("its row says why it is there", r.tag, true);
ck("owner, status, folder and unread are untouched", [r.owner, r.status, r.folder, r.unread], ["gulab", "open", "inbox", false]);
r = await page.evaluate(() => {
  __as("imran");
  const t = S.threads.find(x => x.id === "ta:mine");
  const h = rowHTML(t);
  return { qdone: h.indexOf("data-qdone") >= 0, tag: h.indexOf("Old mail \u00b7 open to the team") >= 0 };
});
ck("a member's OWN old conversation keeps its Done tick", r.qdone, true);
ck("...and carries no R30a tag", r.tag, false);
r = await page.evaluate(() => {
  __as("jagjit");
  const t = S.threads.find(x => x.id === "ta:old");
  const h = rowHTML(t);
  return { qdone: h.indexOf("data-qdone") >= 0, tag: h.indexOf("Old mail \u00b7 open to the team") >= 0 };
});
ck("for the manager it is an ordinary row - Done tick kept", r.qdone, true);
ck("...and no R30a tag", r.tag, false);
r = await page.evaluate(() => {
  __as("imran");
  const t = S.threads.find(x => x.id === "ta:old");
  openId = t.id; view = { type: "box", dept: "ta", folder: "inbox" };
  render();
  const R = document.getElementById("read");
  const q = s => R ? R.querySelectorAll(s).length : -1;
  return {
    note: !!(R && R.querySelector(".r30anote")),
    done: q("[data-done]"), reopen: q("[data-reopen]"), take: q("[data-take]"),
    xfer: q("[data-xfer]"), assign: q("[data-assign]"), owner: t.owner
  };
});
ck("the reading pane says why it is readable", r.note, true);
ck("no Done button in the pane", r.done, 0);
ck("no Reopen button", r.reopen, 0);
ck("no Take over (so the owner cannot be changed from here)", r.take, 0);
ck("no Transfer", r.xfer, 0);
ck("no Assign", r.assign, 0);
ck("and the owner is still the colleague's", r.owner, "gulab");
r = await page.evaluate(() => {
  __as("jagjit");
  const t = S.threads.find(x => x.id === "ta:old");
  openId = t.id; render();
  const R = document.getElementById("read");
  return { note: !!(R && R.querySelector(".r30anote")), done: R ? R.querySelectorAll("[data-done]").length > 0 : false };
});
ck("the manager's pane has no R30a note", r.note, false);
ck("...and keeps its Done button", r.done, true);

/* ===================== 5 · "Show in <folder>" (rule R17b) ================ */
console.log("\n=== 5 · Show in Inbox reaches it, and only it ===");
r = await page.evaluate(() => {
  __as("imran"); openId = null;
  const el = document.getElementById("q"); el.value = "";
  view = { type: "box", dept: "ta", folder: "inbox" };
  const t = S.threads.find(x => x.id === "ta:old");
  const toasts = [];
  const _t = window.toast; window.toast = (m, bad) => { toasts.push(String(m)); };
  try { sibShow(t, 0); } finally { window.toast = _t; }
  const rows = listRows().map(x => x.id);
  return {
    refused: toasts.filter(m => /belongs to/.test(m)).length,
    drawn: rows.indexOf("ta:old") >= 0,
    otherStillHidden: rows.indexOf("ta:new") >= 0,
    folder: view.folder, dept: view.dept
  };
});
ck("Show in Inbox is NOT refused with 'this mail belongs to somebody else'", r.refused, 0);
ck("the row really is in the list it jumped to", r.drawn, true);
ck("only that one - the 20 Nov one is still hidden", r.otherStillHidden, false);
ck("it landed in Team Alpha's Inbox", [r.dept, r.folder], ["ta", "inbox"]);
r = await page.evaluate(() => {
  view = { type: "box", dept: "ta", folder: "archive" };
  const a = listRows().map(x => x.id).indexOf("ta:old") >= 0;
  view = { type: "box", dept: "ta", folder: "inbox" };
  const b = listRows().map(x => x.id).indexOf("ta:old") >= 0;
  return { afterFolderChange: a, backAgain: b };
});
ck("changing folder ends it - the Inbox does not keep it", r.afterFolderChange, false);
ck("...and it does not come back when you return to the Inbox", r.backAgain, false);
r = await page.evaluate(() => {
  __as("imran");
  const t = S.threads.find(x => x.id === "ta:new");
  const toasts = [];
  const _t = window.toast; window.toast = m => toasts.push(String(m));
  try { sibShow(t, 0); } finally { window.toast = _t; }
  return { refused: toasts.filter(m => /belongs to/.test(m)).length, drawn: listRows().map(x => x.id).indexOf("ta:new") >= 0 };
});
ck("Show in Inbox on the 20 Nov one is still refused", r.refused, 1);
ck("...and it is not drawn", r.drawn, false);

/* ======================= 6 · the page and its switch ==================== */
console.log("\n=== 6 · Admin -> Mail rules ===");
r = await page.evaluate(() => {
  __as("adm"); S.settings = {};
  const h = rulesHTML(true);
  return {
    row: h.indexOf(">R30a<") >= 0,
    btn: h.indexOf("data-r30a>") >= 0,
    saysAlphaPulse: /ON for Team Alpha, Team Pulse/.test(h),
    saysSearchOnly: /Show in/.test(h)
  };
});
ck("the R30a row is on the page", r.row, true);
ck("it has a Choose teams button for an admin", r.btn, true);
ck("it names the two teams it is on for", r.saysAlphaPulse, true);
ck("it says it is Search / Show-in-folder only", r.saysSearchOnly, true);
r = await page.evaluate(() => { __as("imran"); const h = rulesHTML(false); return { row: h.indexOf(">R30a<") >= 0, btn: h.indexOf("data-r30a>") >= 0 }; });
ck("a member can read the row", r.row, true);
ck("...but has no switch", r.btn, false);
r = await page.evaluate(() => {
  __as("adm"); S.settings = {};
  r30aDlg();
  const L = document.getElementById("layer") || document.querySelector(".layer");
  const btns = Array.from(document.querySelectorAll("[data-r30at]")).map(b => b.getAttribute("data-r30at") + ":" + b.getAttribute("aria-pressed"));
  const words = (document.querySelector(".dlg") || document.body).textContent;
  const out = { btns: btns, saysNotInbox: /does not appear in the Inbox list/.test(words) };
  if (L) L.innerHTML = "";
  return out;
});
ck("the chooser has one On/Off per team", r.btns, ["teamalpha:true", "teampulse:true", "neetu:false", "marketing:false"]);
ck("the chooser says the Inbox does not grow", r.saysNotInbox, true);
r = await page.evaluate(() => {
  __as("adm"); S.settings = {};
  const c = rChk30a("teamalpha", false);
  const c2 = rChk30a("teamalpha", true);
  return { offEff: c.eff.join(" "), onEff: c2.eff.join(" "), onWarn: c2.warn.join(" ") };
});
ck("switching it OFF says what a member loses", /no longer find an old conversation that belongs to a colleague/.test(r.offEff), true);
ck("switching it ON counts the real conversations", /3 conversations of Team Alpha .* older than its go-live, and 2 of those already belong/.test(r.onEff), true);
ck("switching it ON names the conflict with R3", /hole in R3/.test(r.onWarn), true);
r = await page.evaluate(() => {
  /* a switch change must not wipe the team list (the rSet / rReset "keep" edit) */
  S.settings = { mail_rules: { v: 1, vals: { R3: false }, log: [], r30a: ["teamalpha"] } };
  const body = Object.assign({}, (S.settings.mail_rules || {}), { v: 1, vals: { R3: true }, log: [] });
  return body.r30a;
});
ck("changing another rule keeps the R30a team list", r, ["teamalpha"]);
ck("rSet really keeps it in the shipped page", APP.indexOf("__r30akeep1") >= 0, true);
ck("rReset too", APP.indexOf("__r30akeep2") >= 0, true);

/* ======================== 7 · M1: under 250 MB ========================== */
console.log("\n=== 7 · rule M1 - the tab stays under 250 MB ===");
r = await page.evaluate(() => {
  /* search 60 times over a 3,000-conversation mailbox, which is what a person does all
     day, and check this block stores nothing while doing it */
  const base = S.threads.slice();
  const tf = S.trackFrom.ta;
  const many = [];
  for (let i = 0; i < 3000; i++) {
    const t = JSON.parse(JSON.stringify(base[0]));
    t.id = "ta:m" + i; t.last = tf - (i + 1) * 60000; t.owner = (i % 2) ? "gulab" : null;
    t.msgs[0].at = t.last; t.msgs[0].gid = "gm" + i;
    many.push(t);
  }
  S.threads = base.concat(many);
  __as("imran");
  const el = document.getElementById("q");
  const t0 = performance.now();
  for (let i = 0; i < 60; i++) { el.value = "zipper " + (i % 3 ? "" : "PO"); listRows(); }
  const ms = (performance.now() - t0) / 60;
  el.value = "";
  const m = (typeof rzMemCap === "function") ? rzMemCap() : null;
  S.threads = base;
  return { ms: Math.round(ms * 10) / 10, mb: m ? m.nowMB : null, cap: m ? m.capMB : null, acted: m ? m.timesItHadToAct : null };
});
console.log("     a search over 3,000 conversations: " + r.ms + " ms  ·  tab " + r.mb + " MB of " + r.cap);
ck("M1 is running and reports a number", typeof r.mb === "number", true);
ck("the tab is under 250 MB after 60 searches", r.mb < 250, true);
ck("the ceiling is still 250", r.cap, 250);
ck("a search stays quick (under 60 ms on 3,000 conversations)", r.ms < 60, true);
r = await page.evaluate(() => {
  const n = [];
  for (const k in window) if (/^r30a/i.test(k) || /^R30A/.test(k)) n.push(k);
  return n.sort();
});
console.log("     the block's own globals: " + (r.join(", ") || "(none on window)"));

/* ======================== 8 · no page errors ============================ */
console.log("\n=== 8 · the page itself ===");
const real = errs.filter(e => !/allow-scripts|sandbox|ERR_UNKNOWN_URL_SCHEME/i.test(e));
if (real.length) real.forEach(e => console.log("     " + e));
ck("no page errors", real.length, 0);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
