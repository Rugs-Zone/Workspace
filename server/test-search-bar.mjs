/* test-search-bar.mjs - 27 Nov 2026  (night plan, bug 5: a regression from bug 1)
 *
 * The "Narrow it:" bar was added to the list header on EVERY renderList. That was fine when
 * the header was rebuilt each draw, but since the row-level redraw (25 Nov) a redraw that
 * only changes a row leaves the header alone - so the bar stacked up: 1, 2, 5 bars.
 *
 * This checks it in real headless Edge on the BUILT app (mail-app.html): exactly one bar
 * while searching, none when not, through ten clear-and-search cycles, three polls and a
 * change of folder - plus the new clear button in the search box.
 *
 * Run:  node server/test-search-bar.mjs
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
const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const setup = await page.evaluate(() => {
  if (typeof srchBarSync !== "function") return "the search-bar code is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push({ id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "ta", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0; DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  const at = Date.now();
  const mk = (i, sub) => ({
    id: "ta:" + i, box: "teamalpha@rugscreation.com", dept: "ta", from: "Buyer " + i, email: "b" + i + "@x.com",
    sub, pre: "preview " + i, last: at - i * 6e4, owner: null, status: "open", folder: "inbox",
    unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true,
    msgs: [{ gid: "g" + i, from: "Buyer " + i, email: "b" + i + "@x.com", at: at - i * 6e4, body: "body " + i, to: "x", cc: "", by: "", ours: false, atts: [], files: [], sig: "", raw: "" }]
  });
  S.threads = [mk(1, "IO 4815 zipper"), mk(2, "Packing list"), mk(3, "Weekly update"), mk(4, "Invoice")];
  S.settings = {}; ME = "adm"; app = "mail"; view = { type: "box", dept: "ta", folder: "inbox" };
  if (typeof filt !== "undefined") filt = "all";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  window.__n = () => ({
    bars: document.querySelectorAll(".list .lhead .schips").length,
    more: document.querySelectorAll(".list .lhead #srchmore").length,
    rows: (() => { try { return listRows().length; } catch (e) { return -1; } })(),
    q: (document.getElementById("q") || {}).value || "",
    xShown: (() => { const x = document.getElementById("qclear"); return !!x && getComputedStyle(x).display !== "none"; })()
  });
  window.__type = v => { const q = document.getElementById("q"); q.value = v; q.dispatchEvent(new Event("input")); render(); };
  window.__stamp = () => { const b = document.getElementById("srchbar"); if (b) b.dataset.stamp = "s1"; };
  window.__stamped = () => { const b = document.getElementById("srchbar"); return b ? b.dataset.stamp === "s1" : false; };
  return "ok";
});
ck("the search-bar code is in the built app", setup, "ok");

/* ------------------------------------------------------------- one bar --- */
console.log("\n=== 1 · the bar exists once ===");
ck("nothing showing before a search", (await page.evaluate(() => window.__n())).bars, 0);
await page.evaluate(() => window.__type("4815"));
ck("one bar while searching", (await page.evaluate(() => window.__n())).bars, 1);
const five = await page.evaluate(() => { window.__stamp(); for (let i = 0; i < 5; i++) render(); return { n: window.__n(), same: window.__stamped() }; });
ck("five more redraws still leave ONE bar", five.n.bars, 1);
ck("...and it is the SAME element, not a new one", five.same, true);
const twenty = await page.evaluate(() => { for (let i = 0; i < 20; i++) renderList(); return window.__n().bars; });
ck("twenty list redraws still leave one bar", twenty, 1);

/* ---------------------------------------------------------- the three ways */
console.log("\n=== 2 · the three ways out of a search ===");
const clearX = await page.evaluate(() => { document.getElementById("qclear").click(); return window.__n(); });
ck("the clear button empties the box", clearX.q, "");
ck("...takes the bar away", clearX.bars, 0);
ck("...and the whole folder is listed again", clearX.rows, 4);
await page.evaluate(() => window.__type("4815"));
ck("searching again brings one bar back", (await page.evaluate(() => window.__n())).bars, 1);
const esc = await page.evaluate(() => {
  const q = document.getElementById("q"); q.focus();
  q.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  return window.__n();
});
ck("Esc in the box empties it", esc.q, "");
ck("...and takes the bar away", esc.bars, 0);
await page.evaluate(() => window.__type("4815"));
const chip = await page.evaluate(() => { document.querySelector("#srchbar [data-sqclear]").click(); return window.__n(); });
ck("the \"Clear\" chip empties it", chip.q, "");
ck("...and takes the bar away", chip.bars, 0);

/* --------------------------------------------------------- ten cycles ---- */
console.log("\n=== ten search-and-clear cycles ===");
const cycles = await page.evaluate(() => {
  const how = ["x", "esc", "chip"], seen = [];
  for (let i = 0; i < 10; i++) {
    window.__type("4815");
    seen.push({ step: "search", bars: window.__n().bars, x: window.__n().xShown });
    const w = how[i % 3];
    if (w === "x") document.getElementById("qclear").click();
    else if (w === "esc") { const q = document.getElementById("q"); q.focus(); q.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); }
    else document.querySelector("#srchbar [data-sqclear]").click();
    seen.push({ step: "clear:" + w, bars: window.__n().bars, x: window.__n().xShown });
  }
  return seen;
});
ck("every search showed exactly one bar", cycles.filter(s => s.step === "search").every(s => s.bars === 1), true);
ck("every clear left none", cycles.filter(s => s.step.startsWith("clear")).every(s => s.bars === 0), true);
ck("the clear button showed whenever there was text", cycles.filter(s => s.step === "search").every(s => s.x === true), true);
ck("...and was hidden whenever the box was empty", cycles.filter(s => s.step.startsWith("clear")).every(s => s.x === false), true);
ck("all three ways out were used", new Set(cycles.filter(s => s.step.startsWith("clear")).map(s => s.step)).size, 3);

/* ------------------------------------------------------------- polls ----- */
console.log("\n=== 3 · three polls move nothing ===");
const polls = await page.evaluate(() => {
  window.__type("4815"); window.__stamp();
  const before = document.querySelector("#srchbar").previousSibling ? 1 : 0;
  const idx = () => [...document.querySelector(".list .lhead").children].indexOf(document.getElementById("srchbar"));
  const pos0 = idx();
  for (let i = 0; i < 3; i++) { renderListKeep(); render(); }     /* what the 15-second poll does */
  return { bars: window.__n().bars, same: window.__stamped(), pos0, pos1: idx(), before };
});
ck("still one bar after three polls", polls.bars, 1);
ck("...the same element", polls.same, true);
ck("...in the same place in the header", polls.pos1, polls.pos0);

/* -------------------------------------------------------- folder change -- */
console.log("\n=== 2 · changing folder ends the search ===");
const fold = await page.evaluate(() => {
  window.__type("4815");
  const was = window.__n();
  view = { type: "box", dept: "ta", folder: "sent" };
  render();
  const now = window.__n();
  view = { type: "box", dept: "ta", folder: "inbox" }; render();
  return { was, now, back: window.__n() };
});
ck("the bar was there before the change", fold.was.bars, 1);
ck("changing folder takes it away", fold.now.bars, 0);
ck("...and empties the search box", fold.now.q, "");
ck("...and the clear button goes with it", fold.now.xShown, false);
ck("coming back shows the folder, not a search", fold.back.rows, 4);

/* ------------------------------------------------- the clear button ------ */
console.log("\n=== 4 · the clear button itself ===");
const btn = await page.evaluate(() => {
  window.__type("4815");
  const x = document.getElementById("qclear"), r = x.getBoundingClientRect(), cs = getComputedStyle(x);
  const q = document.getElementById("q");
  return {
    inside: x.parentNode === q.parentNode, title: x.title, aria: x.getAttribute("aria-label"),
    w: Math.round(r.width), h: Math.round(r.height), right: r.left > q.getBoundingClientRect().left,
    colour: cs.color, opacity: +cs.opacity, tag: x.tagName, type: x.type
  };
});
ck("it sits inside the search box", btn.inside, true);
ck("...at the right end", btn.right, true);
ck("its tooltip says \"Clear search\"", btn.title, "Clear search");
ck("its aria-label says \"Clear search\"", btn.aria, "Clear search");
ck("the click area is at least 32px wide", btn.w >= 32, true);
ck("...and at least 32px tall", btn.h >= 32, true);
ck("it is a real button, not a link", btn.tag, "BUTTON");
ck("...of type button, so it cannot submit anything", btn.type, "button");
ck("it is visible (not transparent)", btn.opacity > 0.4, true);
const dark = await page.evaluate(() => {
  document.documentElement.setAttribute("data-theme", "dark");
  const x = document.getElementById("qclear"), cs = getComputedStyle(x);
  const out = { shown: cs.display !== "none", colour: cs.color, opacity: +cs.opacity };
  document.documentElement.removeAttribute("data-theme");
  return out;
});
ck("it is still shown in dark mode", dark.shown, true);
ck("...and still visible there", dark.opacity > 0.4, true);
const phone = await (async () => { await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(200); return page.evaluate(() => { render(); const x = document.getElementById("qclear"), r = x.getBoundingClientRect(); return { bars: window.__n().bars, w: Math.round(r.width), h: Math.round(r.height), shown: getComputedStyle(x).display !== "none" }; }); })();
ck("on a phone there is still one bar", phone.bars, 1);
ck("...the clear button is shown", phone.shown, true);
ck("...and is at least 32px", phone.w >= 32 && phone.h >= 32, true);
await page.setViewportSize({ width: 1280, height: 850 });

/* ------------------------------------------------- it really clears ------ */
console.log("\n=== what the clear button actually clears ===");
const cleared = await page.evaluate(() => {
  window.__type("4815");
  SEARCH_HITS = new Set(["teamalpha@rugscreation.com|abc"]); SEARCH_Q = "4815";
  FND = { q: "4815", ids: new Set(["ta:1"]), busy: false, err: "", text: true, at: Date.now(), n: 1, ms: 5, more: true, off: 0 };
  document.getElementById("qclear").click();
  return { hits: SEARCH_HITS, sq: SEARCH_Q, fndq: FND.q, fndIds: FND.ids ? FND.ids.size : -1, bars: window.__n().bars, more: window.__n().more };
});
ck("the server hits are cleared", cleared.hits, null);
ck("the remembered query is cleared", cleared.sq, "");
ck("the server-find record is cleared", cleared.fndq, "");
ck("...including the ids it found", cleared.fndIds, 0);
ck("the bar is gone", cleared.bars, 0);
ck("the \"Show more\" line is gone too", cleared.more, 0);

console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
if (errs.length) fail += errs.length;
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
