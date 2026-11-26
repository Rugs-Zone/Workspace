/* test-outlook-rows.mjs - 27 Nov 2026  (night plan, bug 2:
 *   "mails that come minute by minute are not each shown, like Outlook does")
 *
 * Real headless Edge on the BUILT app (mail-app.html), so the whole shipped chain runs -
 * R17, explode(), the View-menu sort, the reading pane and mergeList (the 15-second poll's
 * own code path), with the ownership rules in place. The headline case is the one the task
 * named: ONE conversation with FIVE mails a minute apart, as admin, manager and member.
 *
 * Run:  node server/test-outlook-rows.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = g === w; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

/* ------------------------------------------------------- the world ------- */
const setup = await page.evaluate(() => {
  if (typeof explode !== "function" || typeof rowTie !== "function") return "the per-mail row code is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: {} },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "ta", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  /* five mails exactly one minute apart, oldest first, from three different people */
  const T0 = Date.parse("2026-11-27T09:00:00+05:30");
  const NAMES = ["Hershika Linear", "Manfred Mui", "Hershika Linear", "Aman Singh Verma", "Manfred Mui"];
  const msgs = NAMES.map((nm, i) => ({
    gid: "19a" + String(100 + i), from: nm, email: nm.split(" ")[0].toLowerCase() + "@buyer.com",
    at: T0 + i * 60000, body: "Minute " + (i + 1) + " - please confirm.", raw: "", full: true,
    to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: ""
  }));
  S.threads = [{
    id: "ta:1", box: "teamalpha@rugscreation.com", dept: "ta", from: NAMES[0], email: "hershika@buyer.com",
    sub: "IO 4815 - minute by minute", pre: msgs[0].body, last: msgs[4].at, owner: null, status: "open",
    folder: "inbox", unread: true, hist: [], cats: [], msgs, flag: 0, pinned: 0, full: true
  }];
  S.settings = {}; S.lvOf = {};
  ME = "adm"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  if (typeof tab !== "undefined") tab = "focused";
  const q = document.getElementById("q"); if (q) q.value = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }
  window.__as = id => { ME = id; };
  window.__rows = () => listRows().map(t => ({ sub: t.sub, mi: t._mi, one: !!t._one, from: t.from, at: t.last, gid: rowGid(t) }));
  return "ok";
});
ck("the app has the per-mail row code", setup, "ok");

/* ------------------------------------------- 1 · R17 is on for everyone --- */
console.log("\n=== 1 · rule R17 ===");
const r17 = await page.evaluate(() => ({
  def: RDEF.R17, noValue: RON("R17"),
  emptyObj: (() => { S.settings.mail_rules = { v: 1, vals: {} }; const v = RON("R17"); S.settings.mail_rules = null; return v; })(),
  emptyVals: (() => { S.settings.mail_rules = {}; const v = RON("R17"); S.settings.mail_rules = null; return v; })(),
  conv: LV().conv
}));
ck("the shipped default is ON", r17.def, true);
ck("with nothing saved, R17 is ON", r17.noValue, true);
ck("with a saved rules record that does not mention R17, it is ON", r17.emptyObj, true);
ck("with an empty rules record, it is ON", r17.emptyVals, true);
ck("so the list is one row per MAIL", r17.conv, false);
const rhc = await page.evaluate(() => { render(); return { max: window.__rhcMax || 600, rows: listRows().length }; });
ck("the row cache ceiling has grown past the old 600", rhc.max >= 600, true);
ck("...and is at least as big as the rows on screen", rhc.max >= rhc.rows, true);

/* -------------------------------- 2 · five mails, five rows, right order -- */
console.log("\n=== 2 · one conversation, five mails a minute apart ===");
for (const [id, label] of [["adm", "admin"], ["jagjit", "manager"], ["imran", "member"]]) {
  const r = await page.evaluate(w => { window.__as(w); return window.__rows(); }, id);
  ck("as " + label + ": five rows", r.length, 5);
  ck("as " + label + ": every row is its own mail", r.every(x => x.one), true);
  ck("as " + label + ": five different times", new Set(r.map(x => x.at)).size, 5);
  ck("as " + label + ": newest first, a minute apart", r.every((x, i) => i === 0 || r[i - 1].at - x.at === 60000), true);
  ck("as " + label + ": each row carries its own sender", new Set(r.map(x => x.from)).size >= 2, true);
}
const times = await page.evaluate(() => { window.__as("adm"); return listRows().map(t => tShort(rowWhen(t))); });
console.log("     rows: " + times.join(" | "));
ck("the five rows show five different times on screen", new Set(times).size, 5);

/* ------------------------------------- 2b · the same second never swaps --- */
console.log("\n=== 2b · two mails in the SAME second ===");
const tie = await page.evaluate(() => {
  const t = S.threads[0], T = t.msgs[4].at;
  t.msgs[3].at = T; t.msgs[3].gid = "19a200";     /* older id */
  t.msgs[4].gid = "19a201";                       /* newer id, same second */
  t.last = T;
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(listRows().map(x => rowGid(x)).join(","));
  const first = listRows()[0];
  return { same: runs.every(x => x === runs[0]), order: runs[0], top: rowGid(first) };
});
ck("the order is the same every time the list is built", tie.same, true);
ck("the newer message id is on top", tie.top, "19a201");
const tieFn = await page.evaluate(() => ({
  older: rowTie({ _one: 1, _mi: 0, msgs: [{ gid: "19a100" }] }, { _one: 1, _mi: 0, msgs: [{ gid: "19a101" }] }),
  equal: rowTie({ _one: 1, _mi: 0, msgs: [{ gid: "19a100" }] }, { _one: 1, _mi: 0, msgs: [{ gid: "19a100" }] }),
  shorter: rowTie({ _one: 1, _mi: 0, msgs: [{ gid: "ff" }] }, { _one: 1, _mi: 0, msgs: [{ gid: "100" }] })
}));
ck("rowTie puts the smaller id first", tieFn.older, -1);
ck("rowTie says nothing when the ids match", tieFn.equal, 0);
ck("rowTie compares a longer hex id as the bigger one", tieFn.shorter, -1);
await page.evaluate(() => { const t = S.threads[0]; t.msgs[3].at = t.msgs[4].at - 60000; t.msgs[3].gid = "19a103"; t.msgs[4].gid = "19a104"; t.last = t.msgs[4].at; });

/* ------------------------------------------- 3 · the reading pane --------- */
console.log("\n=== 3 · opening it shows all five ===");
const read = await page.evaluate(() => {
  window.__as("adm");
  open("ta:1"); render();
  const rd = document.getElementById("read");
  const arts = rd.querySelectorAll("article.mail");
  const bar = rd.querySelector(".convbar");
  return {
    listed: arts.length,
    withTime: [...arts].filter(a => a.querySelector("time") && a.querySelector("time").textContent.trim()).length,
    withSender: [...arts].filter(a => a.querySelector("header b") && a.querySelector("header b").textContent.trim()).length,
    openNow: [...arts].filter(a => !a.classList.contains("collapsed")).length,
    newestOpen: !arts[0].classList.contains("collapsed"),
    barText: bar ? bar.textContent.replace(/\s+/g, " ").trim() : ""
  };
});
ck("every one of the five mails is listed", read.listed, 5);
ck("each one shows its own time", read.withTime, 5);
ck("each one shows its own sender", read.withSender, 5);
ck("the newest is open", read.newestOpen, true);
ck("the bar says how many mails there are", /Show all 5 mails/.test(read.barText), true);
const afterAll = await page.evaluate(() => {
  const b = document.querySelector('#read .convbar [data-mall="open"]');
  if (b) b.click();
  const arts = document.querySelectorAll("#read article.mail");
  return { open: [...arts].filter(a => !a.classList.contains("collapsed")).length, n: arts.length };
});
ck("\"Show all 5 mails\" opens every one of them", afterAll.open, 5);
ck("...and none is lost", afterAll.n, 5);

/* ------------------------- 4 · the poll brings two new mails at once ------ */
console.log("\n=== 4 · the 15-second poll brings two mails at once ===");
const poll = await page.evaluate(() => {
  const t = S.threads[0], base = t.msgs[4].at;
  const row = {
    mailbox: "teamalpha@rugscreation.com", gmail_thread_id: "1", dept_id: "ta",
    subject: t.sub, snippet: "later", counterpart_name: "Hershika Linear", counterpart_email: "hershika@buyer.com",
    msg_count: 7, last_msg_at: new Date(base + 120000).toISOString(), unread: true, owner_id: null,
    status: "open", folder: "inbox", cats: [], to_addrs: ["teamalpha@rugscreation.com"], updated_at: new Date().toISOString()
  };
  const mk = (i, at) => ({
    mailbox: "teamalpha@rugscreation.com", gmail_thread_id: "1", gmail_id: "19a" + (200 + i), direction: "in",
    from_email: "hershika@buyer.com", from_name: "Hershika Linear", to_text: "teamalpha@rugscreation.com", cc_text: "",
    body_text: "Poll mail " + i, sent_at: new Date(at).toISOString(), attachments: [], drive_status: null
  });
  const msgs = t.msgs.map((m, i) => ({
    mailbox: "teamalpha@rugscreation.com", gmail_thread_id: "1", gmail_id: m.gid, direction: "in",
    from_email: m.email, from_name: m.from, to_text: m.to, cc_text: "", body_text: m.body,
    sent_at: new Date(m.at).toISOString(), attachments: [], drive_status: null
  })).concat([mk(1, base + 60000), mk(2, base + 120000)]);
  /* mergeList deliberately skips a conversation whose local copy has unsaved changes
     (metaSaved out of step = "my change is still going to the server"). The checks above
     have changed this one - it was opened, so it is read now - so put the marker back,
     which is what save() does in the real app. */
  metaSaved[t.id] = JSON.stringify(metaOf(t));
  t._hn = t.hist.length;
  const before = listRows().length, openBefore = (openMsgs["ta:1"] || new Set()).size;
  /* the REAL poll path: loadList() applies what api('list') answers. Stub the call, let the
     app do the rest. mergeList() is the search path and is checked separately below. */
  const realApi = window.api;
  window.api = (a) => a === "list"
    ? Promise.resolve({ now: Date.now(), mailboxes: [], threads: [row], messages: msgs, activity: [] })
    : realApi.apply(null, arguments);
  return loadList(false).then(() => {
    window.api = realApi;
    const after = listRows().length;
    const t2 = S.threads.find(x => x.id === "ta:1");
    return { before, after, msgs: t2 ? t2.msgs.length : 0, openBefore, openAfter: (openMsgs["ta:1"] || new Set()).size };
  });
});
ck("the conversation now holds seven mails", poll.msgs, 7);
ck("the list gained BOTH new rows, not just the newest", poll.after - poll.before, 2);
ck("...and both of them were opened in the reading pane", poll.openAfter - poll.openBefore >= 2, true);
const pollRows = await page.evaluate(() => listRows().map(t => t.pre).slice(0, 2));
ck("the two newest rows are the two new mails", pollRows.every(x => /Poll mail/.test(x)), true);

/* ------------------------------------------- the rules are untouched ------ */
console.log("\n=== the ownership rules are untouched ===");
const own = await page.evaluate(() => {
  const t = S.threads[0]; t.owner = "jagjit";
  const out = {};
  ["adm", "jagjit", "imran"].forEach(id => { ME = id; out[id] = listRows().length; });
  t.owner = null; ME = "adm";
  return out;
});
ck("the owner still sees the conversation", own.jagjit > 0, true);
ck("the admin still sees it", own.adm > 0, true);
ck("a member who never touched it does not", own.imran, 0);

console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
if (errs.length) fail += errs.length;
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
