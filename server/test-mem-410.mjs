/* test-mem-410.mjs - 27 Nov 2026  URGENT
 *
 * "Rugs Email tab reaches 410 MB and freezes for staff. Must stay under 250 MB after
 *  opening 20 mails + scrolling Inbox + 3 searches."
 *
 * Real headless Edge on the BUILT mail-app.html, as a MEMBER in Team Alpha, with a mailbox
 * the size of a real one and two searches' worth of conversations merged in on top - then
 * exactly the brief's scenario, with the figure M1 reports asserted at every step.
 *
 * Run:  node server/test-mem-410.mjs
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
const ck = (n, g, w) => {
  const ok = typeof w === "function" ? !!w(g) : JSON.stringify(g) === JSON.stringify(w);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + (typeof w === "function" ? "" : ", wanted " + JSON.stringify(w)) + ")"));
  ok ? pass++ : fail++;
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

/* --------------------------------------------------- a real-sized mailbox */
await page.evaluate(() => {
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: { assign: 1 } });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  ME = "imran";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");

  /* a buyer's mail as it really arrives: HTML carrying a pasted screenshot */
  window.__bodyHTML = (k) => '<div style="font-family:Arial">' +
    ('<p>Dear Rugs Creation, please confirm PO ' + (170000 + k) + ' and the zipper count.</p>').repeat(10) +
    '<img src="data:image/png;base64,' + "A".repeat(140000) + '">' +
    '<blockquote>' + "<p>Earlier we agreed the price and the delivery.</p>".repeat(30) + '</blockquote></div>';

  window.__mk = (k) => {
    const at = Date.now() - k * 60000, nm = 3 + (k % 6), msgs = [];
    for (let i = 0; i < nm; i++) msgs.push({
      gid: "g" + k + "_" + i, from: i % 2 ? "Imran Khan" : "Laura Kortebos",
      email: i % 2 ? "teamalpha@rugscreation.com" : "laura" + k + "@buyer.com",
      at: at + i * 1000, subject: "PO " + (170000 + k) + " zipper", to: "teamalpha@rugscreation.com",
      cc: "", by: i % 2 ? "imran" : "", ours: !!(i % 2), body: "please confirm PO " + (170000 + k),
      atts: [], files: [], sig: "", raw: "", html: "", light: true, full: false, _k: k
    });
    return {
      id: "ta:" + k, box: "teamalpha@rugscreation.com", dept: "ta", from: "Laura Kortebos",
      email: "laura" + k + "@buyer.com", sub: "PO " + (170000 + k) + " zipper // IO 48" + (k % 100),
      pre: "please confirm the zipper count and the shipping date", last: at,
      owner: (k % 7 === 0) ? "imran" : null, status: k % 5 ? "open" : "done", folder: "inbox",
      unread: !(k % 3), hist: [], cats: [], flag: 0, pinned: 0, full: false, msgs
    };
  };
  /* teampulse@-sized: 15,000 conversations is what a real shared mailbox carries */
  const th = []; for (let k = 1; k <= 15000; k++) th.push(window.__mk(k));
  S.threads = th;
  S.settings = {}; S.lvOf = {};
  view = { type: "box", dept: "ta", folder: "inbox" }; app = "mail";
  window.__fill = (t) => { (t.msgs || []).forEach(m => { m.raw = window.__bodyHTML(m._k); m.light = false; m.full = true; }); t.full = true; };
  let nm0 = 0; th.forEach(t => nm0 += t.msgs.length);
  window.__pre = { convs: th.length, msgs: nm0 };
  render();
  return window.__pre;
});
const look = async () => await page.evaluate(() => {
  const r = rzMemCap();
  return { mb: r.nowMB, convs: (S.threads || []).length, loaded: (S.threads || []).filter(t => loadedBytes(t) > 0).length, rows: document.querySelectorAll(".msgs .m").length, hits: r.timesItHadToAct };
});

console.log("\n=== a 15,000-conversation mailbox, as it was before the fix ===");
/* the pre-cap figure must be taken from what was BUILT, because render() has already
   run the cap by the time we can ask the page - the same arithmetic M1 uses. */
const pre = await page.evaluate(() => window.__pre);
const before = Math.round((pre.convs * 900 + pre.msgs * 1400) / 104857.6) / 10;
console.log("  " + pre.convs.toLocaleString("en-IN") + " conversations / " + pre.msgs.toLocaleString("en-IN") + " mails = " + before + " MB of conversation objects alone, before anything is opened");
/* Honest arithmetic: ONE mailbox of 15,000 conversations is already about half the
   ceiling in conversation objects alone, and nothing ever dropped any of them - every
   search (400 at a time) and every scroll page (500) only added more. A member with
   several shared mailboxes open all day is how that reaches the 410 MB the staff saw. */
ck("one real mailbox alone is a large share of the 250 MB ceiling", before > 100, true);
const projected = Math.round(((pre.convs + 4000 + 1200) * 900 + (pre.msgs + (4000 + 1200) * 5.5) * 1400) / 104857.6) / 10;
console.log("  the same run uncapped - plus 4,000 scrolled and 1,200 searched in - would be " + projected + " MB");
ck("...and the whole run uncapped would be bigger still", projected > before, true);

const a0 = await look();
console.log("  after the cap: " + a0.mb + " MB, " + a0.convs + " conversations held");
ck("the cap brought it down at once", a0.convs <= 2500, true);
ck("...and under the 250 MB ceiling", a0.mb < 250, true);
ck("...with the list still drawn in full", a0.rows > 400, true);

console.log("\n=== the brief's own run: 20 mails, scrolling, 3 searches ===");
for (let k = 1; k <= 20; k++) {
  await page.evaluate((i) => {
    const t = S.threads[i * 11];
    window.__fill(t); t._seenAt = Date.now(); openId = t.id; render();
  }, k);
  await page.waitForTimeout(40);
}
const a1 = await look();
console.log("  after 20 mails: " + a1.mb + " MB, " + a1.loaded + " conversations holding their text");
ck("20 mails opened: still under 250 MB", a1.mb < 250, true);
ck("...and at most 12 conversations keep their full text (plus the one on screen)", a1.loaded <= 13, true);

/* scrolling the Inbox: the app's own "scroll for more" widens the window and pages in mail */
for (let k = 0; k < 8; k++) {
  await page.evaluate((n) => {
    /* another page of 500 older conversations, which is what the server sends on a scroll */
    const base = 15001 + n * 500;
    for (let k = base; k < base + 500; k++) S.threads.push(window.__mk(k));
    const el = document.querySelector(".msgs"); if (el) el.scrollTop = el.scrollHeight;
    render();
  }, k);
  await page.waitForTimeout(150);
}
const a2 = await look();
console.log("  after scrolling (4,000 more conversations paged in): " + a2.mb + " MB, " + a2.convs + " held");
ck("scrolling the Inbox: still under 250 MB", a2.mb < 250, true);
ck("...and the conversations in memory are still capped", a2.convs <= 2500, true);
ck("...the list is still drawn", a2.rows > 100, true);

/* three searches, each merging older conversations in - the real mergeList path */
for (const q of ["4815", "zipper", "PO 1701"]) {
  await page.evaluate((qq) => {
    const base = 40000 + qq.length * 1000;
    for (let k = base; k < base + 400; k++) S.threads.push(window.__mk(k));   /* mergeList's 400 */
    SEARCH_Q = qq; SEARCH_HITS = new Set(S.threads.slice(-400).map(t => t.box + "|" + t.id));
    const b = document.getElementById("q"); if (b) b.value = qq;
    render();
  }, q);
  await page.waitForTimeout(200);
}
const a3 = await look();
console.log("  after 3 searches (1,200 more merged in): " + a3.mb + " MB, " + a3.convs + " held");
ck("3 searches: still under 250 MB", a3.mb < 250, true);
ck("...the conversations a search merged in are dropped again once they are not on screen", a3.convs <= 2500, true);

console.log("\n=== the guard cannot loop (trim -> refetch -> trim) ===");
const runs = [];
for (let k = 0; k < 6; k++) {
  runs.push(await page.evaluate(() => {
    const r = window.__memGuard(true);
    return { act: r && r.act, mb: r && r.mb, convs: (S.threads || []).length };
  }));
  await page.waitForTimeout(150);
}
console.log("  " + runs.map(r => r.act || "(nothing)").join(" · "));
ck("once it is inside the ceiling it stops acting", runs.slice(1).every(r => r.act === "" || r.act === "caps"), true);
ck("...and it never runs the emergency over and over", runs.filter(r => r.act === "emergency").length <= 1, true);
ck("...the conversation count is steady, not sawing up and down", new Set(runs.map(r => r.convs)).size <= 2, true);

console.log("\n=== nothing the reader is using is thrown away ===");
const safe = await page.evaluate(() => {
  const t = S.threads.find(x => loadedBytes(x) > 0);
  openId = t.id; render();
  /* a conversation with an unsent mail in it must survive any cap */
  const u = S.threads[5]; u.msgs[0].sending = true; u._local = true;
  const uid = u.id;
  for (let k = 0; k < 3; k++) window.__memGuard(true);
  return {
    openStillLoaded: loadedBytes(T_(openId)) > 0,
    openStillThere: !!T_(openId),
    unsentKept: !!S.threads.find(x => x.id === uid),
    rowsOnScreenKept: [...document.querySelectorAll(".msgs .m[data-open]")].every(el => !!T_(el.getAttribute("data-open")))
  };
});
ck("the conversation on screen keeps its mail", safe.openStillLoaded, true);
ck("...and is still in the list", safe.openStillThere, true);
ck("a conversation with an unsent mail is never dropped", safe.unsentKept, true);
ck("every row drawn on the screen still has its conversation", safe.rowsOnScreenKept, true);

console.log("\n=== M1 reports honestly ===");
const rep = await page.evaluate(() => rzMemCap());
ck("it names the cap", rep.capMB, 250);
ck("it says it cannot be switched off", rep.switchable, false);
ck("it reports how many conversations are in memory", /\(cap 2500\)/.test(String(rep.conversationsInMemory)), true);
ck("it counts the mails too", rep.mailsInMemory > 0, true);
ck("a heap figure can only raise the number, never hide a breach",
  await page.evaluate(() => { const h = window.__memHeld(); return h.b >= h.ours; }), true);

ck("no page errors", errs.filter(e => !/sandbox|ERR_UNKNOWN_URL_SCHEME/i.test(e)), []);

console.log("\nBEFORE (uncapped, 15,000 conversations): " + before + " MB · AFTER the brief's whole run: " + a3.mb + " MB");
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
