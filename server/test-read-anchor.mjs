/* test-read-anchor.mjs - 27 Nov 2026  (night plan, bug 3:
 *   "clicking a mail makes the screen jump down to Activity trail")
 *
 * Real headless Edge on the BUILT app (mail-app.html). A six-mail conversation, as admin,
 * manager and member, at laptop width AND phone width: click every mail, the mail trail,
 * the Activity trail and "Show all N mails", and check the clicked thing does not move on
 * the screen. Measured INSIDE the reading pane, because that is the box that scrolls.
 *
 * Run:  node server/test-read-anchor.mjs
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
const near = (n, got, limit) => { const ok = Math.abs(got) <= limit; console.log((ok ? "  PASS  " : "  FAIL  ") + n + "  (moved " + Math.round(got) + "px)"); ok ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof raRestore !== "function") return "the read-anchor block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: {} },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "ta", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0; DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  const T0 = Date.parse("2026-11-27T09:00:00+05:30");
  const body = n => ("Paragraph " + n + " of this mail, long enough to need scrolling. ").repeat(40);
  const msgs = [];
  for (let i = 0; i < 6; i++) {
    const ours = i === 4;                       /* one of ours, carrying a mail trail */
    msgs.push({
      gid: "19a" + (100 + i), from: ours ? "Imran Khan" : "Buyer " + (i + 1),
      email: ours ? "teamalpha@rugscreation.com" : "b" + i + "@x.com",
      at: T0 + i * 60000, body: body(i + 1), raw: "", html: "", full: true,
      to: "teamalpha@rugscreation.com", cc: "", by: ours ? "imran" : "", ours: ours,
      atts: [], files: [], sig: "",
      trail: ours ? [{ from: "Buyer 4", email: "b3@x.com", at: T0 + 3 * 60000, to: "teamalpha@rugscreation.com", sub: "Six mails", html: "<p>" + body(99) + "</p>" }] : []
    });
  }
  const mk = (id) => ({
    id: "ta:" + id, box: "teamalpha@rugscreation.com", dept: "ta", from: "Buyer 1", email: "b0@x.com",
    sub: "Six mails - " + id, pre: "x", last: msgs[5].at, owner: null, status: "open", folder: "inbox",
    unread: false, hist: [], cats: [], msgs: msgs.map(m => Object.assign({}, m)), flag: 0, pinned: 0, full: true
  });
  S.threads = [mk(1), mk(2)];
  S.settings = {}; ME = "adm"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  const q = document.getElementById("q"); if (q) q.value = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }

  /* helpers the checks below use */
  window.__as = id => { ME = id; };
  window.__openConv = id => { open(id); render(); };
  window.__pane = () => document.querySelector(".rbody");
  window.__off = sel => {
    const rb = window.__pane(), el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!rb || !el) return null;
    return el.getBoundingClientRect().top - rb.getBoundingClientRect().top;
  };
  /* click a thing and report how far it moved inside the pane */
  window.__clickMove = (sel, scrollTo) => {
    const rb = window.__pane(); if (!rb) return { err: "no pane" };
    if (scrollTo != null) rb.scrollTop = scrollTo;
    const el = document.querySelector(sel); if (!el) return { err: "no element " + sel };
    const before = window.__off(el);
    const target = el.querySelector("header, summary") || el;
    target.click();
    return { before, sel, id: el.id || "" };
  };
  window.__after = (id, before) => {
    const el = document.getElementById(id); if (!el) return { err: "gone" };
    const now = window.__off(el);
    const rb = window.__pane();
    return { moved: now - before, now, atrailOff: window.__off(".rbody .atrail"), paneH: rb.clientHeight, scrollTop: rb.scrollTop };
  };
  return "ok";
});
ck("the read-anchor block is in the built app", setup, "ok");

/* ---------------------------------------------------------- the main case */
for (const [vw, vh, where] of [[1280, 800, "laptop"], [390, 780, "phone"]]) {
  await page.setViewportSize({ width: vw, height: vh });
  for (const [who, label] of [["adm", "admin"], ["jagjit", "manager"], ["imran", "member"]]) {
    console.log("\n=== " + where + " " + vw + "px, as " + label + " ===");
    await page.evaluate(w => { window.__as(w); window.__openConv("ta:1"); }, who);
    await page.waitForTimeout(350);
    const seen = await page.evaluate(() => document.querySelectorAll(".rbody article.mail").length);
    ck("the six mails are all there", seen, 6);
    let worst = 0, worstWhich = "";
    for (let i = 0; i < 6; i++) {
      const r = await page.evaluate(i => window.__clickMove(".rbody article.mail:nth-of-type(" + (i + 1) + ")", 260), i);
      if (r.err) { ck("clicking mail " + (i + 1), r.err, "ok"); continue; }
      await page.waitForTimeout(260);
      const a = await page.evaluate(([id, b]) => window.__after(id, b), [r.id, r.before]);
      if (Math.abs(a.moved) > Math.abs(worst)) { worst = a.moved; worstWhich = "mail " + (i + 1); }
    }
    near("clicking each of the six mails leaves it where it was (worst: " + (worstWhich || "none") + ")", worst, 2);
    /* the Activity trail must never be dragged into view by a click on a mail */
    const atv = await page.evaluate(() => {
      const off = window.__off(".rbody .atrail"), rb = window.__pane();
      return off == null ? null : off < rb.clientHeight;
    });
    ck("the Activity trail is NOT on screen after clicking mails", atv, false);
  }
}
await page.setViewportSize({ width: 1280, height: 800 });

/* ------------------------------------------------- the trail and Show all */
console.log("\n=== the mail trail and \"Show all\" ===");
await page.evaluate(() => { window.__as("adm"); window.__openConv("ta:1"); });
await page.waitForTimeout(300);
const trail = await page.evaluate(() => {
  const rb = window.__pane(); rb.scrollTop = 200;
  const d = document.querySelector(".rbody details.trail");
  if (!d) return { skip: true };
  const art = d.closest("article.mail");
  const before = window.__off(art);
  d.querySelector("summary").click();
  return { id: art.id, before, open: d.hasAttribute("open") };
});
if (trail.skip) { console.log("  (no mail trail rendered - the trail only shows on a mail we sent)"); }
else {
  await page.waitForTimeout(300);
  const a = await page.evaluate(([id, b]) => window.__after(id, b), [trail.id, trail.before]);
  near("opening \"Mail trail · N earlier mails\" leaves its mail where it was", a.moved, 2);
}
const showAll = await page.evaluate(() => {
  const rb = window.__pane(); rb.scrollTop = 150;
  const first = document.querySelector(".rbody article.mail");
  const before = window.__off(first);
  const b = document.querySelector('[data-mall="open"]');
  if (!b) return { err: "no Show all button" };
  b.click();
  return { id: first.id, before };
});
ck("the \"Show all\" button is there", !showAll.err, true);
await page.waitForTimeout(400);
const sa = await page.evaluate(([id, b]) => window.__after(id, b), [showAll.id, showAll.before]);
near("\"Show all 6 mails\" keeps the top of the conversation still", sa.moved, 2);
const allOpen = await page.evaluate(() => [...document.querySelectorAll(".rbody article.mail")].filter(a => !a.classList.contains("collapsed")).length);
ck("...and every mail is open", allOpen, 6);

/* ------------------------------------------------- 3 · the Activity trail */
console.log("\n=== 3 · the Activity trail ===");
await page.evaluate(() => { window.__as("adm"); openId = null; window.__openConv("ta:1"); });
await page.waitForTimeout(300);
ck("it starts CLOSED", await page.evaluate(() => document.querySelector(".rbody .atrail").hasAttribute("open")), false);
const atOpen = await page.evaluate(() => {
  const rb = window.__pane(); rb.scrollTop = Math.max(0, rb.scrollHeight - rb.clientHeight - 20);
  const d = document.querySelector(".rbody .atrail");
  const before = window.__off(d);
  d.querySelector("summary").click();
  return { id: d.id, before };
});
await page.waitForTimeout(300);
const at2 = await page.evaluate(([id, b]) => window.__after(id, b), [atOpen.id, atOpen.before]);
near("opening it keeps its heading where it was", at2.moved, 2);
ck("it is open now", await page.evaluate(() => document.querySelector(".rbody .atrail").hasAttribute("open")), true);
await page.evaluate(() => { const a = document.querySelectorAll(".rbody article.mail")[2]; a.querySelector("header").click(); });
await page.waitForTimeout(300);
ck("it stays open while the same conversation is open", await page.evaluate(() => document.querySelector(".rbody .atrail").hasAttribute("open")), true);
await page.evaluate(() => { window.__openConv("ta:2"); });
await page.waitForTimeout(300);
ck("another conversation starts with it closed again", await page.evaluate(() => document.querySelector(".rbody .atrail").hasAttribute("open")), false);

/* -------------------------------------------------- 2 · "View mail ↑" ---- */
console.log("\n=== 2 · only \"View mail ↑\" may move the screen ===");
const jump = await page.evaluate(() => {
  window.__openConv("ta:1");
  const d = document.querySelector(".rbody .atrail");
  d.setAttribute("open", "");
  const rb = window.__pane(); rb.scrollTop = rb.scrollHeight;
  const b = document.querySelector(".rbody .atrail [data-jump]");
  if (!b) return { err: "no View mail button" };
  const before = rb.scrollTop, target = b.dataset.jump;
  b.click();
  return { before, target };
});
ck("the Activity trail has \"View mail ↑\" buttons", !jump.err, true);
await page.waitForTimeout(600);
const jr = await page.evaluate(t => {
  const rb = window.__pane(), el = document.getElementById("msg-" + t);
  return { moved: rb.scrollTop, onScreen: el ? (window.__off(el) > -40 && window.__off(el) < rb.clientHeight) : null };
}, jump.target);
ck("it really moves the screen to that mail", jr.onScreen, true);

/* ------------------------------------------------------- 4 · the poll ---- */
console.log("\n=== 4 · a poll never moves an open conversation ===");
const poll = await page.evaluate(() => {
  window.__openConv("ta:1");
  const rb = window.__pane(); rb.scrollTop = 420;
  const first = document.querySelector(".rbody article.mail");
  const before = window.__off(first), sBefore = rb.scrollTop;
  renderRead();                                  /* what a poll-driven redraw does */
  return { id: first.id, before, sBefore };
});
await page.waitForTimeout(400);
const pr = await page.evaluate(([id, b]) => window.__after(id, b), [poll.id, poll.before]);
near("a redraw with nothing clicked keeps the screen still", pr.moved, 2);
const pill = await page.evaluate(() => {
  const rb = window.__pane(); const s = rb.scrollTop;
  newInOpenBanner();
  const p = document.querySelector("#read .newpill");
  return { text: p ? p.textContent.trim() : "", moved: rb.scrollTop - s, isBar: !!document.querySelector("#read .newbar") };
});
ck("a new mail shows a small pill", /1 new mail/.test(pill.text), true);
ck("...with a down arrow", /\u2193/.test(pill.text), true);
ck("...and it did NOT move the screen", pill.moved, 0);
ck("...and the old full-width banner is gone", pill.isBar, false);
const pill2 = await page.evaluate(() => { newInOpenBanner(); const p = document.querySelector("#read .newpill"); return p ? p.textContent.trim() : ""; });
ck("a second one counts up", /2 new mails/.test(pill2), true);
const pillClick = await page.evaluate(() => {
  const rb = window.__pane(); rb.scrollTop = 0;
  document.querySelector("#read .newpill").click();
  return true;
});
await page.waitForTimeout(500);
const pc = await page.evaluate(() => {
  const rb = window.__pane(), t = T_(openId);
  const el = document.getElementById("msg-" + t.id + "-" + (t.msgs.length - 1));
  return { gone: !document.querySelector("#read .newpill"), onScreen: el ? (window.__off(el) > -40 && window.__off(el) < rb.clientHeight) : null };
});
ck("clicking the pill takes the pill away", pc.gone, true);
ck("...and shows the newest mail", pc.onScreen, true);

console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
if (errs.length) fail += errs.length;
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
