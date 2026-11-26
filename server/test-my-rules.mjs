/* test-my-rules.mjs - 27 Nov 2026  (bug 11 - rule R35: personal mail rules)
 *
 * Real headless Edge on the BUILT app (mail-app.html). Imran makes the rule the brief asks
 * for - "from @turner-bianca.com -> folder Turner" - through the screen itself, and then:
 * his own view files the mail, the folder count lights up, GULAB'S view does not move, the
 * mail is still in Needs owner and in My work, a manager's rule has no power over anybody
 * else, and Junk and Deleted are never touched.
 *
 * Run:  node server/test-my-rules.mjs
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
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof mrDlg !== "function") return "the __myrules block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { delete: 1 } },
    { id: "gulab", name: "Gulab Tyagi", login: "amr1@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: { delete: 1 } },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: { delete: 1, assign: 1 } });
  DEPTS.length = 0; DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  const T = h => Date.parse("2026-11-27T" + h + ":00:00+05:30");
  let k = 0;
  const mk = (o) => Object.assign({
    id: "t" + (++k), box: "teamalpha@rugscreation.com", dept: "ta", from: "A Buyer", email: "b" + k + "@x.com",
    sub: "Mail " + k, pre: "x", last: T("10"), owner: null, status: "open", folder: "inbox",
    unread: true, hist: [], cats: [], flag: 0, pinned: 0, full: true,
    msgs: [{ gid: "g" + k, from: "A Buyer", email: "b" + k + "@x.com", at: T("10"), body: "hello", subject: "Mail " + k, to: "teamalpha@rugscreation.com", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "" }]
  }, o);
  const turner = (sub, extra) => mk(Object.assign({
    from: "Bianca Turner", email: "bianca@turner-bianca.com", sub: sub,
    msgs: [{ gid: "gt" + k, from: "Bianca Turner", email: "bianca@turner-bianca.com", at: T("11"), body: "the Turner order", subject: sub, to: "merchandiser4@rugscreation.com", cc: "", by: "", ours: false, atts: [{ name: "po.pdf", mime: "application/pdf", size: 90000 }], files: [], sig: "", raw: "", html: "" }],
    last: T("11"), att: "1"
  }, extra || {}));
  S.threads = [
    turner("Turner PO 9001"),                                   /* the one the rule must file */
    turner("Turner PO 9002", { owner: "imran" }),               /* his own, so My work can be checked */
    turner("Turner in Junk", { folder: "junk" }),               /* 4 - never touched */
    turner("Turner in Deleted", { folder: "deleted" }),         /* 4 - never touched */
    mk({ sub: "Someone else", from: "Other Buyer", email: "other@elsewhere.com" }),
    mk({ sub: "Another one", from: "Third Buyer", email: "third@elsewhere.com", unread: false })
  ];
  S.prefs = S.prefs || {}; S.prefs.folders = []; S.prefs.mr35 = [];
  S.settings = {}; ME = "imran"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  S.trackFrom = { ta: Date.parse("2026-11-01T00:00:00+05:30") };   /* the team is activated, so Needs owner is real */
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }

  /* the server is stubbed: what matters is WHAT the app sends, and that it sends it at all */
  window.__sent = [];
  const realApi = api;
  api = (a, p) => {
    window.__sent.push({ a, p });
    if (a === "savePrefs") { S.prefs = Object.assign({}, S.prefs, (p && p.prefs) || {}); return Promise.resolve({ ok: true, prefs: S.prefs }); }
    return Promise.resolve({});
  };
  window.__realApi = realApi;

  /* each person has their own prefs on the server, so the harness keeps one copy per person
     and swaps it with ME - exactly what a real sign-in does */
  window.__prefs = { imran: { folders: [], mr35: [] }, gulab: { folders: [], mr35: [] }, jagjit: { folders: [], mr35: [] } };
  window.__as = (me, v) => {
    if (ME && window.__prefs[ME]) window.__prefs[ME] = S.prefs;
    ME = me;
    S.prefs = window.__prefs[me] || { folders: [], mr35: [] };
    if (typeof MRV !== "undefined") MRV = "";
    openId = null; view = v || { type: "box", dept: "ta", folder: "inbox" };
    if (typeof filt !== "undefined") filt = "all";
    render();
  };
  window.__subs = () => listRows().map(t => t.sub);
  window.__row = (f) => {
    const sel = f === "Turner" ? '#folders .fi[data-userf="Turner"]' : '#folders .fi[data-box="ta"][data-f="' + f + '"]';
    const el = document.querySelector(sel); if (!el) return null;
    const c = el.querySelector(".c");
    return { n: c ? c.textContent : null, bold: c ? c.classList.contains("fcb") : null, nameBold: el.classList.contains("fcnew") };
  };
  window.__menu = () => {
    document.getElementById("layer").innerHTML = "";
    meMenu();
    const b = document.querySelector('[data-myrules]');
    return b ? b.textContent.replace(/\s+/g, " ").trim() : "";
  };
  window.__open = () => { const b = document.querySelector('[data-myrules]'); if (!b) return "no entry"; b.click(); return document.querySelector(".dlg") ? "open" : "no dialog"; };
  /* make the rule through the screen, the way a person does */
  window.__make = (dom, folder, extra) => {
    mrDlg();
    document.querySelector("[data-mrnew]").click();
    const q = x => document.querySelector(x);
    q("#mrn").value = "Turner";
    q("#mrd").value = dom;
    if (folder) q("#mrnf").value = folder;
    if (extra && extra.topic) q("#mrtp").value = extra.topic;
    if (extra && extra.flag) q("#mrfl").checked = true;
    if (extra && extra.read) q("#mrrd").checked = true;
    if (extra && extra.stop) q("#mrst").checked = true;
    q("[data-s2]").click();
    const out = { rules: mrList().length, saved: JSON.stringify(mrList()) };
    document.getElementById("layer").innerHTML = "";
    render();
    return out;
  };
  window.__mine = () => { const v = { type: "fav", id: "mine" }; view = v; render(); return listRows().map(t => t.sub); };
  window.__needs = () => { view = { type: "fav", id: "needs" }; render(); return listRows().map(t => t.sub); };
  return "ok";
});
ck("the app and the test mail are set up", setup, "ok");

/* ------------------------------------------------- 1 · the screen -------- */
console.log("\n=== 1 · Settings \u2192 My rules ===");
ck("the entry is in the menu under your own name", await page.evaluate(() => window.__menu()), "\u{1F4CB} My rules");
ck("...and it opens the screen", await page.evaluate(() => window.__open()), "open");
ck("it says the rules are personal", await page.evaluate(() => /only your own view/i.test(document.querySelector(".dlg .body").textContent)), true);
ck("...and that Needs owner and My work are not touched", await page.evaluate(() => /Needs owner/.test(document.querySelector(".dlg .body").textContent)), true);

/* ------------------------------------------------- 2 · Imran's rule ----- */
console.log("\n=== 2 · Imran makes \"from @turner-bianca.com \u2192 folder Turner\" ===");
const made = await page.evaluate(() => window.__make("turner-bianca.com", "Turner"));
ck("the rule is saved", made.rules, 1);
ck("...with the condition and the action", /turner-bianca\.com/.test(made.saved) && /"move":"Turner"/.test(made.saved), true);
ck("...in his own prefs, through savePrefs", await page.evaluate(() => window.__sent.filter(x => x.a === "savePrefs" && x.p.prefs && x.p.prefs.mr35).length > 0), true);
ck("...and the folder was created for him", await page.evaluate(() => myFolders()), ["Turner"]);

const imran = await page.evaluate(() => {
  window.__as("imran", { type: "box", dept: "ta", folder: "inbox" });
  const inbox = window.__subs();
  window.__as("imran", { type: "folder", folder: "Turner" });
  const turner = window.__subs();
  window.__as("imran", { type: "box", dept: "ta", folder: "inbox" });
  return { inbox, turner, row: window.__row("Turner"), inboxRow: window.__row("inbox") };
});
console.log("     " + JSON.stringify(imran));
ck("3 · the Turner mail is in HIS Turner folder", imran.turner.indexOf("Turner PO 9001") >= 0, true);
ck("...and out of his Inbox", imran.inbox.indexOf("Turner PO 9001"), -1);
ck("...other mail is still in his Inbox", imran.inbox.indexOf("Someone else") >= 0, true);
ck("6 · the folder count lights up", imran.row.n, "2");
ck("...in bold, with the folder name bold too", [imran.row.bold, imran.row.nameBold], [true, true]);
ck("...and his Inbox count drops by the ones that moved", imran.inboxRow.n, "1");

/* ------------------------------------------------- 4 · the safety net --- */
console.log("\n=== 4 · nothing else moves ===");
const safety = await page.evaluate(() => {
  const t = T_("t1");
  const withRule = window.__needs();
  const keep = S.prefs.mr35; S.prefs = Object.assign({}, S.prefs, { mr35: [] }); MRV = "";
  const without = window.__needs();
  S.prefs = Object.assign({}, S.prefs, { mr35: keep }); MRV = ""; render();
  return {
    realFolder: t.folder, needs: withRule, needsWithout: without, mine: (ME = "imran", window.__mine()),
    junk: (window.__as("imran", { type: "box", dept: "ta", folder: "junk" }), window.__subs()),
    del: (window.__as("imran", { type: "box", dept: "ta", folder: "deleted" }), window.__subs())
  };
});
console.log("     " + JSON.stringify(safety));
ck("4 · the conversation's real folder is untouched", safety.realFolder, "inbox");
ck("4 · it is still in Needs owner", safety.needs.indexOf("Turner PO 9001") >= 0, true);
ck("4 · ...and Needs owner is exactly what it was without the rule", safety.needs, safety.needsWithout);
ck("4 · the one he owns is still in My work", safety.mine.indexOf("Turner PO 9002") >= 0, true);
ck("4 · a Turner mail in Junk stays in Junk", safety.junk, ["Turner in Junk"]);
ck("4 · ...and one in Deleted stays in Deleted", safety.del, ["Turner in Deleted"]);

/* ------------------------------------------------- R35 · only his view -- */
console.log("\n=== R35 \u00b7 nobody else's view changes ===");
const others = await page.evaluate(() => {
  window.__as("gulab", { type: "box", dept: "ta", folder: "inbox" });
  const gulabPrefs = JSON.stringify((S.prefs && S.prefs.mr35) || []);
  const gulabInbox = window.__subs();
  const gulabFolders = myFolders();
  window.__as("jagjit", { type: "box", dept: "ta", folder: "inbox" });
  const mgrInbox = window.__subs();
  return { gulabInbox, gulabFolders, mgrInbox, gulabPrefs };
});
console.log("     " + JSON.stringify(others));
ck("R35 · Gulab's Inbox still has the Turner mail", others.gulabInbox.indexOf("Turner PO 9001") >= 0, true);
ck("R35 · the manager's Inbox too", others.mgrInbox.indexOf("Turner PO 9001") >= 0, true);
/* a rule belongs to the person: in this one browser S.prefs is whoever is signed in, so the
   real check is that the rule is stored in prefs (per user on the server) and not on the mail */
ck("R35 · nothing about the rule is written onto the conversation", await page.evaluate(() => {
  const t = T_("t1"); return JSON.stringify({ folder: t.folder, label: t.label || "", flag: t.flag || 0, unread: !!t.unread, cats: t.cats });
}), JSON.stringify({ folder: "inbox", label: "", flag: 0, unread: true, cats: [] }));
ck("R35 · Gulab has no rules of his own", others.gulabPrefs, "[]");
const mgrRule = await page.evaluate(() => {
  /* the manager makes the same rule: it must change HIS view and nothing else */
  window.__as("jagjit", { type: "box", dept: "ta", folder: "inbox" });
  S.prefs = Object.assign({}, S.prefs, { folders: ["Mgr"], mr35: [{ id: "m1", by: "jagjit", name: "mgr", on: true, c: { dom: "turner-bianca.com" }, a: { move: "Mgr" } }] });
  MRV = ""; render();
  const mgr = window.__subs();
  window.__as("imran", { type: "box", dept: "ta", folder: "inbox" });
  const imranStill = window.__subs();
  window.__as("gulab", { type: "box", dept: "ta", folder: "inbox" });
  const gulabStill = window.__subs();
  const t = T_("t1");
  return { mgrInbox: mgr, realFolder: t.folder, imranStill, gulabStill };
});
ck("a manager's rule files his own view", mgrRule.mgrInbox.indexOf("Turner PO 9001"), -1);
ck("...and still writes nothing to the mail, so it has no team-wide power", mgrRule.realFolder, "inbox");
ck("...Gulab's Inbox is untouched by the manager's rule", mgrRule.gulabStill.indexOf("Turner PO 9001") >= 0, true);
ck("...and Imran still has his own rule, not the manager's", mgrRule.imranStill.indexOf("Turner PO 9001"), -1);

/* ------------------------------------------------- 2b · the other actions */
console.log("\n=== 2b \u00b7 topic, flag and mark-as-read ===");
const acts = await page.evaluate(() => {
  window.__as("imran", { type: "box", dept: "ta", folder: "inbox" });
  S.prefs = Object.assign({}, S.prefs, { folders: ["Turner"], mr35: [] }); MRV = ""; render();
  const before = window.__row("inbox").n;
  S.prefs = Object.assign({}, S.prefs, { folders: ["Turner"], mr35: [{ id: "a1", by: "imran", name: "Turner", on: true, c: { dom: "turner-bianca.com" }, a: { topic: "order", flag: true, read: true } }] });
  MRV = "";
  window.__as("imran", { type: "box", dept: "ta", folder: "inbox" });
  const t = T_("t1");
  const row = rowHTML(t);
  const inbox = window.__row("inbox");
  view = { type: "fav", id: "flag" }; render();
  const flagged = window.__subs();
  window.__as("imran", { type: "box", dept: "ta", folder: "inbox" });
  if (typeof filt !== "undefined") filt = "unread";
  const unreadList = window.__subs();
  if (typeof filt !== "undefined") filt = "all";
  render();
  return {
    topic: mrLab(t), chip: /Order/i.test(lbHTML(t)), flagged, inboxN: inbox.n, before,
    rowUnread: /class="m unread/.test(row), unreadList, realLabel: t.label || "", realFlag: t.flag || 0, realUnread: !!t.unread
  };
});
console.log("     " + JSON.stringify(acts));
ck("the topic a rule set is the one shown", acts.topic, "order");
ck("...as a chip on the row", acts.chip, true);
ck("the flag a rule set puts it in Flagged", acts.flagged.indexOf("Turner PO 9001") >= 0, true);
ck('"mark as read" takes the two Turner mails out of his unread count', [acts.before, acts.inboxN], ["3", "1"]);
ck("...and the row stops looking unread", acts.rowUnread, false);
ck("...and the Unread chip does not list it", acts.unreadList.indexOf("Turner PO 9001"), -1);
ck("R35 · but the mail itself is untouched (topic, flag, unread)", [acts.realLabel, acts.realFlag, acts.realUnread], ["", 0, true]);

/* ------------------------------------------------- 1b · order and switches */
console.log("\n=== 1b \u00b7 on/off, order, stop, delete ===");
const order = await page.evaluate(() => {
  ME = "imran";
  S.prefs = Object.assign({}, S.prefs, {
    folders: ["Turner", "Second"],
    mr35: [
      { id: "o1", by: "imran", name: "first", on: true, stop: false, c: { dom: "turner-bianca.com" }, a: { move: "Turner" } },
      { id: "o2", by: "imran", name: "second", on: true, stop: false, c: { dom: "turner-bianca.com" }, a: { move: "Second", flag: true } }
    ]
  });
  MRV = ""; render();
  const t = T_("t1");
  const first = mrMove(t), bothFlag = mrFlagOf(t);
  /* a "stop here" on the first rule means the second one never runs */
  S.prefs.mr35[0].stop = true; MRV = ""; render();
  const stopped = { fold: mrMove(t), flag: mrFlagOf(t) };
  /* switch the first one off: the second one takes over */
  S.prefs.mr35[0].stop = false; S.prefs.mr35[0].on = false; MRV = ""; render();
  const off = mrMove(t);
  /* order: move the second one up */
  S.prefs.mr35[0].on = true; const l = mrList().slice(); const x = l[0]; l[0] = l[1]; l[1] = x; S.prefs.mr35 = l; MRV = ""; render();
  const swapped = mrMove(t);
  return { first, bothFlag, stopped, off, swapped };
});
console.log("     " + JSON.stringify(order));
ck("first match wins for the folder", order.first, "Turner");
ck("...while a later rule can still add its own action", order.bothFlag, true);
ck('"stop here" ends the list', order.stopped, { fold: "Turner", flag: false });
ck("a rule switched off does nothing", order.off, "Second");
ck("moving a rule up changes which one wins", order.swapped, "Second");
const del = await page.evaluate(() => {
  mrDlg();
  const before = mrList().length;
  document.querySelector("[data-mrdel]").click();
  const after = mrList().length;
  const undo = document.querySelector(".undobar button");
  if (undo) undo.click();
  const back = mrList().length;
  document.getElementById("layer").innerHTML = "";
  return { before, after, back };
});
ck("delete takes a rule away", [del.before, del.after], [2, 1]);
ck("...and Undo brings it back", del.back, 2);

/* ------------------------------------------------- 3 · run now ---------- */
console.log("\n=== 3 \u00b7 Run now on existing mail ===");
const run = await page.evaluate(() => {
  ME = "imran";
  S.prefs = Object.assign({}, S.prefs, { folders: ["Turner"], mr35: [{ id: "r1", by: "imran", name: "Turner", on: true, c: { dom: "turner-bianca.com" }, a: { move: "Turner" } }] });
  MRV = ""; render();
  mrDlg();
  document.querySelector("[data-mrrun]").click();
  const txt = document.querySelector(".dlg .body").textContent.replace(/\s+/g, " ");
  const has = !!document.querySelector("[data-a3]");
  document.querySelector("[data-a3]").click();
  return { txt, has, open: !!document.querySelector(".dlg") };
});
console.log("     " + run.txt.slice(0, 160));
ck("3 · the preview counts the mail it matches", /matches 2 conversations/.test(run.txt), true);
ck("3 · ...and says nothing is written to the mail", /nobody else's lists change/.test(run.txt), true);
ck("3 · Apply closes it and redraws", [run.has, run.open], [true, false]);
const fresh = await page.evaluate(() => {
  /* the drawn list must follow a rule the moment it is saved - the caches all hang off
     mailFp(), which the rules are part of */
  window.__as("imran", { type: "box", dept: "ta", folder: "inbox" });
  S.prefs = Object.assign({}, S.prefs, { folders: ["Turner"], mr35: [] }); MRV = ""; render();
  const before = window.__subs();
  mrSave([{ id: "f1", name: "Turner", on: true, c: { dom: "turner-bianca.com" }, a: { move: "Turner" } }]);
  const after = window.__subs();
  return { before, after };
});
ck("saving a rule files the mail at once, with no reload", [fresh.before.indexOf("Turner PO 9001") >= 0, fresh.after.indexOf("Turner PO 9001")], [true, -1]);
const all = await page.evaluate(() => { mrDlg(); document.querySelector("[data-mrall]").click(); const t = document.querySelector(".dlg .body").textContent.replace(/\s+/g, " "); document.getElementById("layer").innerHTML = ""; return t; });
ck('3 · "Run now on existing mail" counts them all', /2 conversations of the mail loaded here match/.test(all), true);

/* ------------------------------------------------- 5 · phone + errors --- */
console.log("\n=== 5 \u00b7 phone width, and the console ===");
await page.setViewportSize({ width: 390, height: 780 });
const phone = await page.evaluate(() => {
  ME = "imran"; render();
  mrDlg();
  const d = document.querySelector(".dlg");
  const r = d.getBoundingClientRect();
  const fits = r.left >= -1 && r.right <= window.innerWidth + 1;
  const btns = document.querySelectorAll(".mrrow .mrb .btn").length;
  document.getElementById("layer").innerHTML = "";
  return { fits, btns, sideways: document.scrollingElement.scrollWidth <= window.innerWidth + 1 };
});
ck("the screen fits a phone", phone.fits, true);
ck("...with its buttons", phone.btns > 0, true);
await page.setViewportSize({ width: 1280, height: 900 });
ck("no page errors", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
