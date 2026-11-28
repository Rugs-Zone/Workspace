/* test-sent-before-after.mjs - 28 Nov 2026
 *
 * The same fixture run twice in real headless Edge - on the build BEFORE the Sent rule changed
 * (.tmp/before.html, written from git HEAD) and on the build after it (mail-app.html) - and the
 * two answers compared. This is how "his Sent now shows his mail, and nothing else moved" is
 * proved rather than claimed: the Inbox, Needs owner, My work, Archive and the Flagged list must
 * come back IDENTICAL for every person, and only Sent may differ, and only by his own mail.
 *
 * Run:  node server/test-sent-before-after.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const url = p => "file:///" + path.join(__dirname, "..", p).replace(/\\/g, "/");

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "\n          got    " + JSON.stringify(g) + "\n          wanted " + JSON.stringify(w))); ok ? pass++ : fail++; };

if (!fs.existsSync(path.join(__dirname, "..", ".tmp", "before.html")))
  throw new Error("run:  git show HEAD:mail-app.html > .tmp/before.html");

const FIXTURE = function () {
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "ash", name: "Ashish Deshwal", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: { aliases: "ashish.d@rugscreation.com" } },
    { id: "gulab", name: "Gulab Tyagi", login: "merchandiser8@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} },
    { id: "vinay", name: "Vinay Kumar", login: "vinay@rugscreation.com", dept: "vin", role: "Executive", active: true, perm: {} },
    { id: "mgr", name: "Team Lead", login: "lead@rugscreation.com", dept: "tp", role: "Manager", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" }, { id: "vin", name: "Vinay", box: "vinay@", color: "#888" });
  const D = s => Date.parse(s), BOX = "teampulse@rugscreation.com";
  const mk = o => Object.assign({ box: BOX, dept: "tp", pre: "x", owner: "", status: "new", folder: "inbox", unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true }, o);
  const buyer = (gid, at) => ({ gid, from: "A Buyer", email: "po@very.com", at, body: "Buyer writes.", to: BOX, cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", html: "", full: true });
  const hisMail = (gid, at, from) => ({ gid, from: "Ashish Deshwal", fname: "Ashish Deshwal", email: from, at, body: "Please find the costing.", to: "robin@buyer.com, " + BOX, cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true });
  S.threads = [
    /* 1 his own login, out, no sent_by - the reported case (a buyer wrote first) */
    mk({ id: "tp:1", from: "A Buyer", email: "po@very.com", sub: "2122 costing", last: D("2026-11-20T10:00:00Z"), msgs: [buyer("b1", D("2026-11-19T09:00:00Z")), hisMail("h1", D("2026-11-20T10:00:00Z"), "merchandiser9@rugscreation.com")] }),
    /* 2 from an alias of his */
    mk({ id: "tp:2", from: "A Buyer", email: "po2@very.com", sub: "Alias case", last: D("2026-11-21T10:00:00Z"), msgs: [buyer("b2", D("2026-11-21T08:00:00Z")), hisMail("h2", D("2026-11-21T10:00:00Z"), "ashish.d@rugscreation.com")] }),
    /* 3 a colleague's own mail into the same mailbox */
    mk({ id: "tp:3", from: "A Buyer", email: "po3@very.com", sub: "Vinay wrote", last: D("2026-11-22T10:00:00Z"), msgs: [buyer("b3", D("2026-11-22T08:00:00Z")), { gid: "v1", from: "Vinay Kumar", fname: "Vinay Kumar", email: "vinay@rugscreation.com", at: D("2026-11-22T10:00:00Z"), body: "Vinay here.", to: "po3@very.com, " + BOX, cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }] }),
    /* 4 sent from the shared address itself, nobody named */
    mk({ id: "tp:4", from: "A Buyer", email: "po4@very.com", sub: "From the mailbox", last: D("2026-11-23T10:00:00Z"), msgs: [{ gid: "x1", from: "Team mailbox", fname: "", email: BOX, at: D("2026-11-23T10:00:00Z"), body: "Sent from the shared address.", to: "po4@very.com", cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }] }),
    /* 5 sent through Rugs Email by Gulab */
    mk({ id: "tp:5", from: "A Buyer", email: "po5@very.com", sub: "Gulab via app", last: D("2026-11-24T10:00:00Z"), msgs: [{ gid: "g1", from: "Gulab Tyagi", email: BOX, at: D("2026-11-24T10:00:00Z"), body: "Sent in the app.", to: "po5@very.com", cc: "", by: "gulab", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }] }),
    /* 6 a buyer's mail only */
    mk({ id: "tp:6", from: "A Buyer", email: "po6@very.com", sub: "Incoming only", last: D("2026-11-25T10:00:00Z"), msgs: [buyer("b6", D("2026-11-25T10:00:00Z"))] }),
    /* 7 his mail, and the buyer answered after it: the conversation belongs to the Inbox */
    mk({ id: "tp:7", from: "A Buyer", email: "po7@very.com", sub: "He wrote, buyer replied", last: D("2026-11-26T12:00:00Z"), flag: 1, msgs: [hisMail("h7", D("2026-11-26T09:00:00Z"), "merchandiser9@rugscreation.com"), buyer("b7", D("2026-11-26T12:00:00Z"))] }),
    /* 8 archived, with his mail in it */
    mk({ id: "tp:8", folder: "archive", from: "A Buyer", email: "po8@very.com", sub: "Archived", last: D("2026-11-18T10:00:00Z"), msgs: [buyer("b8", D("2026-11-18T08:00:00Z")), hisMail("h8", D("2026-11-18T10:00:00Z"), "merchandiser9@rugscreation.com")] })
  ];
  S.settings = {}; app = "mail";
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0 }) } catch (e) { }
  window.LIVE = false; api = async () => ({});

  /* the set of CONVERSATIONS a view shows for a person (rows can be per mail, so unique ids) */
  window.__view = (who, v) => {
    ME = who; view = v; openId = null;
    if (typeof filt !== "undefined") filt = "all";
    if (typeof lfilt !== "undefined") lfilt = "";
    render();
    return [...new Set(listRows().map(r => r.id))].sort();
  };
  window.__rows = (who, v) => { ME = who; view = v; if (typeof filt !== "undefined") filt = "all"; render(); return listRows().map(r => r.id + (r._one ? "#" + r._mi : "")) };
  window.__all = () => {
    const out = {};
    ["ash", "gulab", "vinay", "mgr"].forEach(p => {
      out[p + "|sent"] = window.__view(p, { type: "box", dept: "tp", folder: "sent" });
      out[p + "|inbox"] = window.__view(p, { type: "box", dept: "tp", folder: "inbox" });
      out[p + "|archive"] = window.__view(p, { type: "box", dept: "tp", folder: "archive" });
      out[p + "|needs"] = window.__view(p, { type: "fav", id: "needs" });
      out[p + "|mine"] = window.__view(p, { type: "fav", id: "mine" });
      out[p + "|flag"] = window.__view(p, { type: "fav", id: "flag" });
    });
    return out;
  };
  return "ok";
};

async function run(file) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
  await page.goto(url(file), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const ok = await page.evaluate(FIXTURE);
  if (ok !== "ok") throw new Error(file + ": fixture failed");
  const all = await page.evaluate(() => window.__all());
  const rows = await page.evaluate(() => window.__rows("ash", { type: "box", dept: "tp", folder: "sent" }));
  const helper = await page.evaluate(() => (typeof sentByUs === "function") ? "yes" : "no");
  await browser.close();
  return { all, rows, helper, errs };
}

const before = await run(".tmp/before.html");
const after = await run("mail-app.html");
ck("the old build has no new helper", before.helper, "no");
ck("the new build has it", after.helper, "yes");
ck("no page errors, old build", before.errs, []);
ck("no page errors, new build", after.errs, []);

/* ---------- 1 · his Sent ---------- */
ck("1 · BEFORE: his Sent did not show his own mail", before.all["ash|sent"], ["tp:4"]);
ck("1 · AFTER: his Sent shows every conversation he wrote in", after.all["ash|sent"], ["tp:1", "tp:2", "tp:4", "tp:7", "tp:8"]);
ck("1 · one row per mail he sent, and only his", after.rows.slice().sort(), ["tp:1#1", "tp:2#1", "tp:4#0", "tp:7#0", "tp:8#1"]);
ck("1 · newest of his first, as the Sent list sorts", after.rows, ["tp:7#0", "tp:4#0", "tp:2#1", "tp:1#1", "tp:8#1"]);

/* ---------- 2 · nothing else moved, for anybody ---------- */
const keys = Object.keys(before.all).filter(k => !/\|sent$/.test(k));
const moved = keys.filter(k => JSON.stringify(before.all[k]) !== JSON.stringify(after.all[k]));
ck("2 · Inbox, Archive, Needs owner, My work and Flagged are identical for all four people", moved, []);
ck("2 · and his Inbox in particular still holds the team's work", after.all["ash|inbox"], before.all["ash|inbox"]);
ck("2 · Needs owner is unchanged", after.all["ash|needs"], before.all["ash|needs"]);

/* ---------- 3 · the other people's Sent ---------- */
ck("3 · a colleague's Sent gains nothing of his (R15)", after.all["gulab|sent"], before.all["gulab|sent"]);
ck("3 · Vinay's own Sent gains his own mail", [before.all["vinay|sent"], after.all["vinay|sent"]], [["tp:4"], ["tp:3", "tp:4"]]);
ck("3 · the manager sees all the sent mail of the team", after.all["mgr|sent"], ["tp:1", "tp:2", "tp:3", "tp:4", "tp:5", "tp:7", "tp:8"]);

console.log("\nBEFORE  ash|sent " + JSON.stringify(before.all["ash|sent"]) + "   gulab|sent " + JSON.stringify(before.all["gulab|sent"]) + "   mgr|sent " + JSON.stringify(before.all["mgr|sent"]));
console.log("AFTER   ash|sent " + JSON.stringify(after.all["ash|sent"]) + "   gulab|sent " + JSON.stringify(after.all["gulab|sent"]) + "   mgr|sent " + JSON.stringify(after.all["mgr|sent"]));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
