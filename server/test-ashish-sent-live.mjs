/* test-ashish-sent-live.mjs - 28 Nov 2026
 *
 * The end-to-end check, with HIS OWN LIVE MAIL: the real list is fetched from the office server
 * through a real Switch ID session as Ashish Deshwal (umvkv0zd039), mapped by the app's own
 * mapRow() inside the built app in real headless Edge, and then his Sent folder is asked for -
 * first with the rule as it shipped before today, then with the rule of build 2026-11-28-3.
 *
 * Nothing is written anywhere: the only calls are 'switch' and 'list', both read only.
 *
 * Run:  node server/test-ashish-sent-live.mjs <admin token>
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
const BEFORE = path.join(__dirname, "..", ".tmp", "before.html");

const T = process.argv[2];
if (!T) { console.log("usage: node server/test-ashish-sent-live.mjs <admin token>"); process.exit(1); }
const ME = "umvkv0zd039", LOGIN = "merchandiser9@rugscreation.com";

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };
const post = async (p, b) => {
  const r = await fetch("https://mail-api.rugserp.com" + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  return { s: r.status, j: await r.json().catch(() => null) };
};

/* ---- his real mail, as his own session sees it ---- */
const sw = await post("/rugs-mail-switch", { action: "switch", id: ME, token: T });
ck("a Switch ID session as him", sw.s, 200);
const T2 = sw.j && sw.j.token;
const boot = await post("/rugs-mail", { action: "boot", token: T2 });
const list = await post("/rugs-mail-list", { action: "list", token: T2 });
ck("his boot", boot.s, 200);
ck("his list", list.s, 200);
const L = list.j;
console.log("  live: " + (L.threads || []).length + " conversations, " + (L.messages || []).length + " mails, mailbox " + JSON.stringify((L.mailboxes || []).map(x => x.mailbox)));
const hisMails = (L.messages || []).filter(m => String(m.from_email || "").toLowerCase() === LOGIN);
console.log("  of those, from his own address: " + hisMails.length +
  " (direction out: " + hisMails.filter(m => m.direction === "out").length +
  ", sent_by him: " + hisMails.filter(m => m.sent_by === ME).length + ")");

async function sentFor(file) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
  await page.goto("file:///" + file.replace(/\\/g, "/"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const r = await page.evaluate(({ boot, L, ME, LOGIN }) => {
    /* the app's own people, departments and mapping - nothing is faked */
    PEOPLE.length = 0; (boot.users || []).forEach(u => PEOPLE.push({ id: u.id, name: u.name, login: u.login, dept: u.dept_id, role: u.role, active: u.active, perm: u.perm || {} }));
    DEPTS.length = 0; (boot.depts || []).forEach(d => DEPTS.push({ id: d.id, name: d.name, box: String(d.mailbox || "").split("@")[0] + "@", color: "#09c" }));
    S.settings = boot.settings || {};
    const by = {}, ac = {};
    (L.messages || []).forEach(m => { const k = m.mailbox + "|" + m.gmail_thread_id; (by[k] = by[k] || []).push(m) });
    (L.activity || []).forEach(a => { const k = a.mailbox + "|" + a.gmail_thread_id; (ac[k] = ac[k] || []).push(a) });
    const home = {}; (boot.depts || []).forEach(d => home[String(d.mailbox).toLowerCase()] = d.id);
    S.threads = [];
    (L.threads || []).forEach(row => {
      const h = home[String(row.mailbox).toLowerCase()]; if (!h) return;
      const k = row.mailbox + "|" + row.gmail_thread_id;
      const t = mapRow(row, by[k] || [], ac[k] || [], null, h);
      if (t.msgs.length) S.threads.push(t);
    });
    ME = "umvkv0zd039"; app = "mail";
    const dept = (PEOPLE.find(p => p.id === ME) || {}).dept;
    if (typeof filt !== "undefined") filt = "all";
    if (typeof lfilt !== "undefined") lfilt = "";
    const lg = document.getElementById("login"); if (lg) lg.hidden = true;
    document.body.classList.remove("signedout");
    window.LIVE = false; api = async () => ({});
    const ids = v => { view = v; openId = null; render(); return [...new Set(listRows().map(r => r.id))] };
    const sent = ids({ type: "box", dept: dept, folder: "sent" });
    const inbox = ids({ type: "box", dept: dept, folder: "inbox" });
    const needs = ids({ type: "fav", id: "needs" });
    /* which of the Sent conversations hold a mail of HIS, and the Robin ones */
    const mineIn = S.threads.filter(t => (t.msgs || []).some(m => String(m.email || "").toLowerCase() === LOGIN));
    const robin = S.threads.filter(t => (t.msgs || []).some(m => String(m.email || "").toLowerCase() === LOGIN &&
      /robin/i.test(String(m.to || "") + " " + String(m.cc || ""))));
    view = { type: "box", dept: dept, folder: "sent" }; render();
    const rows = listRows();
    return {
      conversations: S.threads.length, dept: dept,
      sentCount: sent.length, inboxCount: inbox.length, needsCount: needs.length,
      hisConversations: mineIn.length,
      hisInSent: mineIn.filter(t => sent.indexOf(t.id) >= 0).length,
      /* a conversation in Deleted is not in Sent, by the app's own rule - so it is counted apart */
      hisDeleted: mineIn.filter(t => t.folder === "deleted").length,
      hisLive: mineIn.filter(t => t.folder !== "deleted").length,
      hisLiveInSent: mineIn.filter(t => t.folder !== "deleted" && sent.indexOf(t.id) >= 0).length,
      missing: mineIn.filter(t => t.folder !== "deleted" && sent.indexOf(t.id) < 0).map(t => ({ id: t.id, folder: t.folder, sub: String(t.sub).slice(0, 40) })),
      robinTotal: robin.length,
      robinInSent: robin.filter(t => sent.indexOf(t.id) >= 0).length,
      robinSample: robin.slice(0, 3).map(t => ({ id: t.id, sub: String(t.sub).slice(0, 50), inSent: sent.indexOf(t.id) >= 0 })),
      sentRows: rows.length,
      helper: typeof sentByUs === "function"
    };
  }, { boot: boot.j, L, ME, LOGIN });
  await browser.close();
  return { r, errs };
}

const after = await sentFor(path.join(__dirname, "..", "mail-app.html"));
const before = fs.existsSync(BEFORE) ? await sentFor(BEFORE) : null;

console.log("\nHIS OWN MAIL, through the app:");
if (before) console.log("  BEFORE: Sent " + before.r.sentCount + " conversations, of his " + before.r.hisInSent + "/" + before.r.hisConversations + ", Robin in Sent " + before.r.robinInSent + "/" + before.r.robinTotal);
console.log("  AFTER : Sent " + after.r.sentCount + " conversations, of his " + after.r.hisInSent + "/" + after.r.hisConversations + ", Robin in Sent " + after.r.robinInSent + "/" + after.r.robinTotal);
console.log("  rows drawn in his Sent: " + after.r.sentRows + " | his Inbox " + after.r.inboxCount + " | Needs owner " + after.r.needsCount);
console.log("  Robin sample: " + JSON.stringify(after.r.robinSample));

ck("the new build has the helper", after.r.helper, true);
ck("his live mail is really in the fixture", after.r.hisConversations > 0, true);
console.log("  of his " + after.r.hisConversations + " conversations, " + after.r.hisDeleted + " are in Deleted (never in Sent, by the app's own rule)");
ck("AFTER: every conversation he wrote in that is not deleted is in his Sent", [after.r.hisLiveInSent, after.r.missing], [after.r.hisLive, []]);
if (before) ck("BEFORE: almost none of them were", before.r.hisInSent < after.r.hisInSent, true);
if (before) ck("his Inbox did not change", after.r.inboxCount, before.r.inboxCount);
if (before) ck("Needs owner did not change", after.r.needsCount, before.r.needsCount);
if (after.r.robinTotal) ck("his Robin mail shows in Sent", after.r.robinInSent, after.r.robinTotal);
else console.log("  NOTE  no mail of his to/cc Robin is inside the app's history window, so there is nothing to show in the app - the database report says how many exist");
ck("no page errors", after.errs, []);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
