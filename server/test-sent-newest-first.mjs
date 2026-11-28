/* test-sent-newest-first.mjs - 28 Nov 2026
 * R36 mail (own mail sent from a mailbox the person cannot open) that is NEWER than the top of Sent is drawn at the
 * TOP under its own heading; older R36 mail stays in the group at the bottom.
 * Run:  node server/test-sent-newest-first.mjs     (needs .tmp/node_modules/playwright-core and Edge, like the other tests)
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

/* ---------- the fixture: his own mailbox, and three mails of his the server found in
   mailboxes he cannot open (exactly the shape of the "mysent" answer) ---------- */
const setup = await page.evaluate(() => {
  PEOPLE.length = 0;
  PEOPLE.push({ id: "ash", name: "Ashish Deshwal", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {}, access: {} });
  PEOPLE.push({ id: "gul", name: "Gulab Tyagi", login: "merchandiser8@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {}, access: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", mailbox: "teampulse@rugscreation.com", color: "#09c" });
  const BOX = "teampulse@rugscreation.com", at = Date.parse("2026-11-27T10:32:00Z");
  S.threads = [{
    id: "tp:1", box: BOX, dept: "tp", from: "Lily-Sue Martin", email: "lily-sue.martin@flairrugs.com",
    sub: "Romy Sample Delay", pre: "x", last: at, owner: "ash", status: "open", folder: "inbox",
    unread: true, hist: [], cats: [], flag: 0, pinned: 0, full: true, to: [BOX],
    msgs: [
      { gid: "1a", from: "Lily-Sue Martin", fname: "Lily-Sue Martin", email: "lily-sue.martin@flairrugs.com", at: at - 36e5, body: "Buyer writes.", to: BOX, cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "", full: true },
      { gid: "1b", from: "Ashish Deshwal", fname: "Ashish Deshwal", email: "merchandiser9@rugscreation.com", at, body: "Noted, shipping on Friday.", to: "lily-sue.martin@flairrugs.com", cc: "", by: "", ours: true, atts: [], files: [], sig: "", raw: "", full: true }
    ]
  }];
  S.settings = {}; ME = "ash"; app = "mail";
  view = { type: "box", dept: "tp", folder: "sent" };
  if (typeof filt !== "undefined") filt = "all";
  if (typeof lfilt !== "undefined") lfilt = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = 0 }) } catch (e) { }
  window.LIVE = false; api = async () => ({});

  /* what the real server answers - his own mail out of mailboxes he may not open */
  window.__fsCalls = 0;
  window.__fsFixture = [
    { mailbox: "vinay@rugscreation.com", gmail_id: "g1", gmail_thread_id: "t1",
      subject: "RE: New order | Po 26314003986", to_text: '"Robin Vos | Loods 5" <r.vos@loods5.nl>, noorul@a2zbuyingservices.com',
      cc_text: '"Maud Wedman" <m.wedman@loods5.nl>', sent_at: "2026-11-26T09:00:00.000Z", has_attachments: true,
      body: "Dear Robin,\n\nThe order is confirmed and the samples leave on Friday.\n\nAshish" },
    { mailbox: "shipping@rugscreation.com", gmail_id: "g2", gmail_thread_id: "t2",
      subject: "Booking request MUNDRA 40HQ", to_text: "[Geodis]<https://eu.content.exclaimer.net/?url=x> ops@geodis.com",
      cc_text: "", sent_at: "2026-11-25T06:10:00.000Z", has_attachments: false,
      body: "Please book one 40HQ for week 49." },
    { mailbox: "designer@rugscreation.com", gmail_id: "g3", gmail_thread_id: "t3",
      subject: "SS27 CAD approval", to_text: "jai@rugscreation.com", cc_text: "", sent_at: "2026-11-24T11:45:00.000Z",
      has_attachments: false, body: "CADs attached for approval." }
  ];
  window.fs36Api = async () => { window.__fsCalls++; return { mails: window.__fsFixture, closed: ["vinay@rugscreation.com"], now: Date.now() } };

  /* what his Sent and his Inbox look like BEFORE R36 has fetched anything */
  const before = { sentRows: listRows().length, threads: S.threads.length, inboxUnread: inboxUnreadN() };
  render();
  return { before, hasHook: typeof fs36Draw === "function", liveReadyUsed: !window.__liveReady };
});
ck("the R36 block is in the built app", setup.hasHook, true);
ck("nothing is fetched before the app says it is live", setup.liveReadyUsed, true);

/* nothing happens at all until the session is live */
const offline = await page.evaluate(() => ({ group: !!document.querySelector("[data-fs36group]"), calls: window.__fsCalls }));
ck("signed out / not live: no group, no call", offline, { group: false, calls: 0 });


const nt = await page.evaluate(async () => {
  window.__liveReady = true;
  const newest = Math.max(...S.threads.map(t => t.last));
  window.__fsFixture = [
    { mailbox: "vinay@rugscreation.com", gmail_id: "n1", gmail_thread_id: "n1", subject: "TODAY mail sent from another box",
      to_text: "buyer@x.com", cc_text: "", sent_at: new Date(newest + 3600e3).toISOString(), has_attachments: false, body: "hello today" },
    { mailbox: "vinay@rugscreation.com", gmail_id: "g1", gmail_thread_id: "t1", subject: "OLD mail", to_text: "old@x.com", cc_text: "",
      sent_at: new Date(newest - 86400e3 * 3).toISOString(), has_attachments: false, body: "old" }
  ];
  FS36 = null; render(); await new Promise(r => setTimeout(r, 150));
  const box = document.querySelector(".list .msgs");
  const kids = [...box.children].map(e => e.hasAttribute("data-fs36group") ? "H:" + e.textContent.trim().slice(0, 12) : (e.hasAttribute("data-fs36") ? "R:" + e.querySelector(".sub").textContent.trim() : "x"));
  const r1 = { first3: kids.slice(0, 3), last3: kids.slice(-3), heads: kids.filter(k => k[0] === "H") };
  render(); render(); await new Promise(r => setTimeout(r, 50));
  r1.groups = document.querySelectorAll("[data-fs36group]").length; r1.rows = document.querySelectorAll("[data-fs36]").length;
  return r1;
});
console.log(JSON.stringify(nt));
ck("today's mail group is the FIRST thing in Sent", nt.first3[0].startsWith("H:") && nt.first3[1], "R:TODAY mail sent from another box");
ck("the old one stays at the bottom", nt.last3[nt.last3.length - 1], "R:OLD mail");
ck("two headings, no duplicates after redraws", [nt.groups, nt.rows], [2, 2]);
ck("no page errors", errs, []);
console.log(pass + " passed, " + fail + " failed");
await browser.close();
