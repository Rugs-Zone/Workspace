/* test-sent-by-login.mjs - 28 Nov 2026
 *
 * Ashish Deshwal's Sent folder, in real headless Edge on the built mail-app.html, with the
 * exact shape the live database has: his mail carries direction='out' (ours) and NO sent_by,
 * and its From is his own login merchandiser9@rugscreation.com while the conversation sits in
 * the shared mailbox teampulse@. Before this build the app called that "a colleague wrote in"
 * and his Sent was empty of it.
 *
 * Also checked, because this rule is shared: a colleague's own mail goes to THAT person's Sent
 * and to nobody else's (R15), the team INBOX is not changed by any of it, and mail sent from the
 * mailbox itself behaves exactly as before.
 *
 * Run:  node server/test-sent-by-login.mjs
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof sentByUs !== "function") return "the __sentmine helper is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "ash", name: "Ashish Deshwal", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: { aliases: "ashish.d@rugscreation.com" } },
    { id: "gulab", name: "Gulab Tyagi", login: "merchandiser8@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} },
    { id: "vinay", name: "Vinay Kumar", login: "vinay@rugscreation.com", dept: "vin", role: "Executive", active: true, perm: {} },
    { id: "mgr", name: "Team Lead", login: "lead@rugscreation.com", dept: "tp", role: "Manager", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" }, { id: "vin", name: "Vinay", box: "vinay@", color: "#888" });
  const D = s => Date.parse(s);
  const BOX = "teampulse@rugscreation.com";
  const mk = (o) => Object.assign({
    box: BOX, dept: "tp", pre: "x", owner: "", status: "new", folder: "inbox", unread: false,
    hist: [], cats: [], flag: 0, pinned: 0, full: true
  }, o);
  const buyer = (gid, at, sub) => ({ gid, from: "A Buyer", email: "po@very.com", at, body: "Buyer writes.", subject: sub, to: BOX, cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "", full: true });

  /* 1 · THE REPORTED CASE: his own mail, out, no sent_by, From = his login, in the shared mailbox */
  const his = { gid: "h1", from: "Ashish Deshwal", fname: "Ashish Deshwal", email: "merchandiser9@rugscreation.com", at: D("2026-11-20T10:00:00Z"), body: "Please find the costing.", subject: "2122 costing", to: "robin@buyer.com, " + BOX, cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true };
  const t1 = mk({ id: "tp:1", from: "A Buyer", email: "po@very.com", sub: "2122 costing", last: D("2026-11-20T10:00:00Z"), msgs: [buyer("b1", D("2026-11-19T09:00:00Z"), "2122 costing"), his] });
  /* 2 · the same, from an ALIAS of his */
  const t2 = mk({ id: "tp:2", from: "A Buyer", email: "po2@very.com", sub: "Alias case", last: D("2026-11-21T10:00:00Z"),
    msgs: [buyer("b2", D("2026-11-21T08:00:00Z"), "Alias case"), { gid: "h2", from: "Ashish Deshwal", fname: "Ashish Deshwal", email: "ashish.d@rugscreation.com", at: D("2026-11-21T10:00:00Z"), body: "From my alias.", subject: "Alias case", to: "robin@buyer.com", cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }] });
  /* 3 · a COLLEAGUE's own mail into the same mailbox (must go to HIS Sent, not Ashish's) */
  const t3 = mk({ id: "tp:3", from: "A Buyer", email: "po3@very.com", sub: "Vinay wrote", last: D("2026-11-22T10:00:00Z"),
    msgs: [buyer("b3", D("2026-11-22T08:00:00Z"), "Vinay wrote"), { gid: "v1", from: "Vinay Kumar", fname: "Vinay Kumar", email: "vinay@rugscreation.com", at: D("2026-11-22T10:00:00Z"), body: "Vinay here.", subject: "Vinay wrote", to: "po3@very.com, " + BOX, cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }] });
  /* 4 · sent from the MAILBOX itself, no sent_by - the old behaviour must not change */
  const t4 = mk({ id: "tp:4", from: "A Buyer", email: "po4@very.com", sub: "From the mailbox", last: D("2026-11-23T10:00:00Z"),
    msgs: [{ gid: "x1", from: "Team mailbox", fname: "", email: BOX, at: D("2026-11-23T10:00:00Z"), body: "Sent from the shared address.", subject: "From the mailbox", to: "po4@very.com", cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }] });
  /* 5 · sent through Rugs Email by Gulab (sent_by set) - unchanged */
  const t5 = mk({ id: "tp:5", from: "A Buyer", email: "po5@very.com", sub: "Gulab via app", last: D("2026-11-24T10:00:00Z"),
    msgs: [{ gid: "g1", from: "Gulab Tyagi", email: BOX, at: D("2026-11-24T10:00:00Z"), body: "Sent in the app.", subject: "Gulab via app", to: "po5@very.com", cc: "", by: "gulab", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }] });
  /* 6 · a buyer's mail only - never Sent */
  const t6 = mk({ id: "tp:6", from: "A Buyer", email: "po6@very.com", sub: "Incoming only", last: D("2026-11-25T10:00:00Z"), msgs: [buyer("b6", D("2026-11-25T10:00:00Z"), "Incoming only")] });

  S.threads = [t1, t2, t3, t4, t5, t6];
  S.settings = {}; app = "mail";
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0 }) } catch (e) { }
  window.LIVE = false; api = async () => ({});

  window.__as = (who, folder) => {
    ME = who; view = { type: "box", dept: "tp", folder: folder };
    if (typeof lfilt !== "undefined") lfilt = "";
    render();
    const rows = listRows();
    return {
      ids: [...new Set(rows.map(r => r.id))],
      rowCount: rows.length,
      /* what the list really draws, so the row text is checked too */
      to: rows.map(r => (typeof sentTo === "function" ? sentTo(r) : ""))
    };
  };
  window.__helper = () => {
    const t = T_("tp:1"), his = t.msgs[1], buy = t.msgs[0], box = T_("tp:4").msgs[0], app5 = T_("tp:5").msgs[0], al = T_("tp:2").msgs[1], vin = T_("tp:3").msgs[1];
    return {
      hisOwnLogin: sentByUs(his, t), hisAlias: sentByUs(al, T_("tp:2")),
      buyer: sentByUs(buy, t), fromMailbox: sentByUs(box, T_("tp:4")),
      throughApp: sentByUs(app5, T_("tp:5")), colleague: sentByUs(vin, T_("tp:3")),
      whoSentHis: sentWho(his, t), colleagueInHis: colleagueIn(his, t),
      stillReceived: recvMsg(his, t)
    };
  };
  return "ok";
});
ck("fixture built", setup, "ok");

/* ---------- 1 · the helper itself ---------- */
const h = await page.evaluate(() => window.__helper());
ck("1 · his own login counts as sent by us", h.hisOwnLogin, true);
ck("1 · so does an alias of his", h.hisAlias, true);
ck("1 · a buyer's mail never does", h.buyer, false);
ck("1 · mail sent from the mailbox itself still does", h.fromMailbox, true);
ck("1 · mail sent through Rugs Email still does", h.throughApp, true);
ck("1 · a colleague's own mail counts as sent (by HIM - R15 then decides who sees it)", h.colleague, true);
ck("1 · the app can name him as the sender", h.whoSentHis, "ash");
ck("1 · and colleagueIn is still true, so nothing else changed meaning", h.colleagueInHis, true);
ck("1 · his mail is STILL received mail for the mailbox (the Inbox keeps it)", h.stillReceived, true);

/* ---------- 2 · his Sent folder ---------- */
const ashSent = await page.evaluate(() => window.__as("ash", "sent"));
/* tp:4 was already there before this build: it was sent from the shared address itself and
   nobody can be named, so the whole team sees it - that rule is untouched. */
ck("2 · his Sent shows the conversations he wrote in", ashSent.ids.sort(), ["tp:1", "tp:2", "tp:4"]);
ck("2 · one row per mail (R17): his two, plus the mailbox's own", ashSent.rowCount, 3);
ck("2 · the row names the buyer he wrote to", /robin/i.test(ashSent.to.join(" ")), true);
ck("2 · and not the conversations he did not send in", ashSent.ids.indexOf("tp:3") < 0 && ashSent.ids.indexOf("tp:5") < 0, true);

/* ---------- 3 · nobody else's Sent changed ---------- */
const gulabSent = await page.evaluate(() => window.__as("gulab", "sent"));
ck("3 · a colleague does NOT see his mail in Sent (R15)", gulabSent.ids.indexOf("tp:1") < 0 && gulabSent.ids.indexOf("tp:2") < 0, true);
ck("3 · but still sees the one he sent himself", gulabSent.ids.indexOf("tp:5") >= 0, true);
ck("3 · and the one sent from the shared address", gulabSent.ids.indexOf("tp:4") >= 0, true);
const mgrSent = await page.evaluate(() => window.__as("mgr", "sent"));
ck("3 · the manager sees everything sent, his included", ["tp:1", "tp:2", "tp:3", "tp:4", "tp:5"].every(x => mgrSent.ids.indexOf(x) >= 0), true);
const vinSent = await page.evaluate(() => window.__as("vinay", "sent"));
ck("3 · Vinay's own mail is in his Sent, nobody else's", vinSent.ids.indexOf("tp:3") >= 0, true);

/* the Inbox and the work lists are proved untouched by server/test-sent-before-after.mjs,
   which runs this same shape on the build before and after the change and compares them. */

/* ---------- 5 · the console check ---------- */
const rz = await page.evaluate(() => { ME = "ash"; view = { type: "box", dept: "tp", folder: "sent" }; render(); return window.rzSentCheck() });
ck("5 · rzSentCheck reports his two", [rz.onesISent, rz.mailbox], [2, "tp"]);
ck("5 · and the ones R15 keeps from him", rz.hiddenFromMeByR15 >= 2, true);

/* ---------- 6 · memory rule M1 ---------- */
const mem = await page.evaluate(() => { const r = window.rzMemCap ? window.rzMemCap() : null; return r ? r.nowMB : null });
ck("6 · the tab is under 250 MB", mem !== null && mem < 250, true);
ck("no page errors", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
