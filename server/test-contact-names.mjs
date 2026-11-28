/* test-contact-names.mjs - 28 Nov 2026
 *
 * The Sent list's "To:" column read like gibberish because a contact's NAME had been harvested
 * from a mail's body or an image marker. Checked here in real headless Edge on the built app,
 * with the exact strings that were on Ashish Deshwal's screen.
 *
 * Run:  node server/test-contact-names.mjs
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
const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

/* ---------- 1 · the guard itself ---------- */
const g = await page.evaluate(() => {
  if (typeof goodName !== "function") return "the guard is missing";
  const junk = [
    "As mentioned, kindly let us know immediately if you have any",
    "[Une image contenant Police, Graphique, capture d\u2019\u00e9cran, gra",
    "[Loods 5 Home]<https://eu.content.exclaimer.net/?url=http%3A",
    "[cid:image001.jpg@01DD4CD7.8B8AEC40]<https://www.groupe-jja.",
    "[cid:image001.png@01DD78EF.E3F7D610]",
    "From: Puran Singh <puran@pridel.com>",
    "[Geodis]",
    "www.flairrugs.com",
    "Subject: RE: order",
    "12345",
    ""
  ];
  const real = ["Robin Vos", "Lily-Sue Martin", "Clara Blech-Grandin", "Jarratt, Fiona", "Kate O\u2019Meara",
    "Rugs Creation Pvt Ltd", "JJA SA", "Ashish Deshwal", "\u00c9lodie Bernard", "Shubham"];
  return {
    junkRejected: junk.filter(x => goodName(x)),
    realKept: real.filter(x => !goodName(x)),
    fromMail: ["lily-sue.martin@flairrugs.com", "m.wedman@loods5.nl", "operationspnp@speditionindia.com"].map(nameFromMail)
  };
});
ck("the guard exists", typeof g === "object", true);
ck("1 · every junk name is rejected", g.junkRejected, []);
ck("1 · every real name is kept", g.realKept, []);
ck("1 · an address becomes a readable name", g.fromMail, ["Lily Sue Martin", "M Wedman", "Operationspnp"]);

/* ---------- 2 · the Sent row, with the real data shape ---------- */
const setup = await page.evaluate(() => {
  PEOPLE.length = 0;
  PEOPLE.push({ id: "ash", name: "Ashish Deshwal", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} });
  DEPTS.length = 0; DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" });
  const BOX = "teampulse@rugscreation.com", at = Date.parse("2026-11-27T10:32:00Z");
  /* his mail to a buyer, and the buyer's earlier mail whose "signature" is really body text -
     that is what put the sentence into the contact's name */
  const mk = (id, sub, to, sig) => ({
    id, box: BOX, dept: "tp", from: "Lily-Sue Martin", email: "lily-sue.martin@flairrugs.com", sub,
    pre: "x", last: at, owner: "", status: "new", folder: "inbox", unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true,
    msgs: [
      { gid: id + "a", from: "Lily-Sue Martin", fname: "Lily-Sue Martin", email: "lily-sue.martin@flairrugs.com", at: at - 36e5, body: "Buyer writes.", to: BOX, cc: "", by: "", ours: false, atts: [], files: [], sig: sig, raw: "", html: "", full: true },
      { gid: id + "b", from: "Ashish Deshwal", fname: "Ashish Deshwal", email: "merchandiser9@rugscreation.com", at, body: "Noted.", to: to, cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", html: "", full: true }
    ]
  });
  S.threads = [
    mk("tp:1", "Romy Sample Delay", "lily-sue.martin@flairrugs.com", "As mentioned, kindly let us know immediately if you have any\nFlair Rugs\n+44 1234 567890"),
    mk("tp:2", "New order", '"[Loods 5 Home]<https://eu.content.exclaimer.net/x>" <m.wedman@loods5.nl>', "[cid:image001.png@01DD78EF.E3F7D610]\nLoods 5"),
    (() => {
      /* Robin is the SENDER here, with a proper signature, so his name must survive */
      const t = mk("tp:3", "Good one", '"Robin Vos" <r.vos@loods5.nl>', "Robin Vos\nLoods 5\n+31 6 1234 5678");
      t.from = "Robin Vos"; t.email = "r.vos@loods5.nl";
      t.msgs[0].from = "Robin Vos"; t.msgs[0].fname = "Robin Vos"; t.msgs[0].email = "r.vos@loods5.nl";
      return t;
    })()
  ];
  S.settings = {}; S.contactEdits = {}; ME = "ash"; app = "mail";
  view = { type: "box", dept: "tp", folder: "sent" };
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0 }) } catch (e) { }
  window.LIVE = false; api = async () => ({});
  render();
  const rows = listRows();
  return {
    rows: rows.length,
    to: rows.map(r => sentTo(r)),
    contactNames: contacts().map(c => c.email + " = " + c.name),
    junkContacts: contacts().filter(c => !goodName(c.name)).map(c => c.name)
  };
});
console.log("   the Sent rows now read: " + JSON.stringify(setup.to));
console.log("   contacts: " + JSON.stringify(setup.contactNames));
ck("2 · the row no longer prints the buyer's sentence", setup.to.some(x => /As mentioned/.test(x)), false);
ck("2 · nor an image marker or a link", setup.to.some(x => /cid:|https?:|\[/.test(x)), false);
/* a name where one is known, and otherwise the real address - never junk */
ck("2 · it names the buyer instead", setup.to.slice().sort(), ["Lily-Sue Martin", "Robin Vos", "m.wedman@loods5.nl"]);
ck("2 · every To: reads as a name or an address", setup.to.every(x => /^[\w .'’-]+$/.test(x) || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x)), true);
ck("2 · and no contact is left with a junk name", setup.junkContacts, []);

/* ---------- 3 · a name somebody typed themselves is always kept ---------- */
const typed = await page.evaluate(() => {
  S.contactEdits = { "lily-sue.martin@flairrugs.com": { name: "L-S M." } };
  const c = contacts().find(x => x.email === "lily-sue.martin@flairrugs.com");
  return c ? c.name : "(gone)";
});
ck("3 · a typed name is kept as typed", typed, "L-S M.");

/* ---------- 4 · a good signature still names the contact ---------- */
const good = await page.evaluate(() => {
  S.contactEdits = {};
  const c = contacts().find(x => x.email === "r.vos@loods5.nl") || contacts().find(x => /robin/i.test(x.name || ""));
  return c ? c.name : "(none)";
});
ck("4 · a real signature still gives the name", good, "Robin Vos");

/* ---------- 5 · rule M1 and no errors ---------- */
const mem = await page.evaluate(() => { const r = window.rzMemCap ? window.rzMemCap() : null; return r ? r.nowMB : null });
ck("5 · the tab is under 250 MB", mem !== null && mem < 250, true);
ck("no page errors", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
