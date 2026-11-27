/* measure-mem-live.mjs - 27 Nov 2026
 *
 * "Rugs Email tab reaches 410 MB and freezes for staff" - measure it before changing anything.
 * A member in Team Alpha, a mailbox the size of a real one, then exactly what the user does:
 * open 20 mails, scroll the Inbox, run 3 searches. Samples the TAB's heap, every store the
 * app keeps, the DOM, and how often the M1 guard has had to act, at every step.
 *
 * Run:  node server/measure-mem-live.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");

const CONVS = Number(process.env.CONVS || 4000);
const FAST = process.env.FAST === "1";
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ["--js-flags=--expose-gc"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

/* ---------------------------------------------------- a real-sized mailbox */
const built = await page.evaluate((N) => {
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: { assign: 1 } },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  ME = "imran";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");

  /* a buyer's mail as it really arrives: HTML with a pasted screenshot inside it */
  const shot = "data:image/png;base64," + "iVBORw0KGgo".repeat(1);
  const bodyHTML = (k) => '<div style="font-family:Arial">' +
    '<p>Dear Rugs Creation, please confirm PO ' + (170000 + k) + ' and the zipper count.</p>'.repeat(12) +
    '<img src="' + shot + "A".repeat(140000) + '">' +
    '<blockquote>' + ("<p>Earlier in this correspondence we agreed the price and the delivery.</p>".repeat(40)) + '</blockquote></div>';

  const T = (d, h) => Date.parse("2026-11-" + d + "T" + h + ":00:00+05:30");
  const th = [];
  for (let k = 1; k <= N; k++) {
    const day = String(1 + (k % 26)).padStart(2, "0");
    const nm = 3 + (k % 6);
    const msgs = [];
    for (let i = 0; i < nm; i++) {
      msgs.push({
        gid: "g" + k + "_" + i, from: i % 2 ? "Imran Khan" : "Laura Kortebos",
        email: i % 2 ? "teamalpha@rugscreation.com" : "laura" + k + "@buyer.com",
        at: T(day, String(9 + i).padStart(2, "0")), subject: "PO " + (170000 + k) + " zipper",
        to: "teamalpha@rugscreation.com", cc: "", by: i % 2 ? "imran" : "", ours: !!(i % 2),
        body: "please confirm PO " + (170000 + k), atts: [], files: [], sig: "", raw: "", html: "",
        light: true, full: false, _k: k
      });
    }
    th.push({
      id: "ta:" + k, box: "teamalpha@rugscreation.com", dept: "ta",
      from: "Laura Kortebos", email: "laura" + k + "@buyer.com",
      sub: "PO " + (170000 + k) + " zipper // IO 48" + (k % 100),
      pre: "please confirm the zipper count and the shipping date",
      last: T(day, "10"), owner: (k % 7 === 0) ? "imran" : null,
      status: k % 5 ? "open" : "done", folder: "inbox", unread: !(k % 3),
      hist: [], cats: [], flag: 0, pinned: 0, full: false, msgs: msgs
    });
  }
  window.__bodyHTML = bodyHTML;
  S.threads = th;
  S.settings = {}; S.lvOf = {};
  view = { type: "box", dept: "ta", folder: "inbox" };
  app = "mail";
  render();
  return { convs: S.threads.length, msgs: S.threads.reduce((n, t) => n + t.msgs.length, 0) };
}, CONVS);
console.log("mailbox: " + built.convs + " conversations, " + built.msgs + " mails\n");

const sample = async (label) => {
  const s = await page.evaluate(() => {
    const mb = b => Math.round(b / 104857.6) / 10;
    const m = performance.memory || {};
    let loadedConv = 0, onList = 0;
    try { (S.threads || []).forEach(t => { const b = loadedBytes(t); if (b) { loadedConv++; onList += b; } }); } catch (e) { }
    const r = (typeof rzMem === "function") ? rzMem() : {};
    return {
      heap: mb(m.usedJSHeapSize || 0), total: mb(m.totalJSHeapSize || 0),
      /* performance.memory is quantised in Edge, so count what we really hold ourselves. */
      stores: mb((function(){var b=0;
        try{Object.keys(RAWC).forEach(function(k){var v=RAWC[k];b+=((v&&v.raw)||"").length+((v&&v.body)||"").length})}catch(e){}
        try{Object.keys(ATT_SZ).forEach(function(k){b+=ATT_SZ[k]||0})}catch(e){}
        try{Object.keys(ATHUMB).forEach(function(k){b+=String(ATHUMB[k]||"").length})}catch(e){}
        try{RHC.forEach(function(v){b+=String(v||"").length})}catch(e){}
        try{PRE_B64.forEach(function(v){b+=(v&&v.__len)||0})}catch(e){}
        try{(S.threads||[]).forEach(function(t){b+=loadedBytes(t)})}catch(e){}
        return b})()),
      /* the conversation OBJECTS themselves - no budget counts these today */
      objMB: mb(JSON.stringify((S.threads||[]).map(function(t){return{i:t.id,s:t.sub,p:t.pre,m:(t.msgs||[]).map(function(m){return{g:m.gid,f:m.from,e:m.email,s:m.subject,t:m.to,c:m.cc,b:m.body}})}})).length),
      loadedConv, onListMB: mb(onList),
      rawc: (() => { try { return Object.keys(RAWC).length } catch (e) { return -1 } })(),
      rhc: (() => { try { return RHC.size } catch (e) { return -1 } })(),
      rowsDrawn: document.querySelectorAll(".msgs .m").length,
      nodes: document.querySelectorAll("*").length,
      iframes: document.querySelectorAll("iframe").length,
      guardHits: (typeof rzMemCap === "function") ? rzMemCap().timesItHadToAct : null,
      m1: (typeof rzMemCap === "function") ? rzMemCap().nowMB : null,
      convs: (S.threads||[]).length,
      detail: r
    };
  });
  console.log(label.padEnd(34) + " heap " + String(s.heap).padStart(6) + " MB · stores " + String(s.stores).padStart(6) + " MB · conv objects " + String(s.objMB).padStart(6) +
    " MB · M1 reads " + String(s.m1).padStart(6) + " MB · convs " + String(s.convs).padStart(5) + " · loaded convs " + String(s.loadedConv).padStart(4) + " (" + s.onListMB + " MB) · RAWC " + s.rawc +
    " · rowHTML " + s.rhc + " · rows " + s.rowsDrawn + " · nodes " + s.nodes + " · iframes " + s.iframes +
    " · guard acted " + s.guardHits);
  return s;
};

await sample("1 · just the mailbox loaded");

/* ------------------------------------------------- open 20 mails, for real */
await page.evaluate(() => {
  /* the app fetches a body from the server; here the body is already beside the message,
     so "opening" fills it in exactly the way the real fetch does (x.raw = the HTML) */
  window.__fill = (t) => { (t.msgs || []).forEach(m => { m.raw = window.__bodyHTML(m._k); m.light = false; m.full = true; }); t.full = true; };
});
for (let k = 1; k <= 20; k++) {
  await page.evaluate((i) => {
    const t = S.threads[i * 7];
    window.__fill(t);
    t._seenAt = Date.now();
    open(t.id);
  }, k);
  await page.waitForTimeout(120);
  if (k === 5 || k === 10 || k === 20) await sample("2 · after opening " + k + " mails");
}

/* ------------------------------------------------------- scroll the Inbox */
await page.evaluate(() => { openId = null; render(); });
for (let k = 0; k < 12; k++) {
  await page.evaluate(() => {
    const el = document.querySelector(".msgs");
    if (el) el.scrollTop = el.scrollHeight;
    window.dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(200);
}
await sample("3 · after scrolling the Inbox");

/* ------------------------------------------------------------- 3 searches */
for (const q of ["4815", "zipper", "PO 1701"]) {
  await page.evaluate((t) => {
    const b = document.getElementById("q");
    if (b) { b.value = t; b.dispatchEvent(new Event("input", { bubbles: true })); }
  }, q);
  await page.waitForTimeout(700);
  await sample("4 · search \"" + q + "\"");
}

await page.evaluate(() => { const b = document.getElementById("q"); if (b) { b.value = ""; b.dispatchEvent(new Event("input", { bubbles: true })); } });
await page.waitForTimeout(500);
const end = await sample("5 · back to the Inbox");

/* ---------------------------------- does the guard settle, or does it loop? */
console.log("\n--- the guard: five forced runs in a row ---");
for (let k = 0; k < 5; k++) {
  const r = await page.evaluate(() => {
    const a = window.__memGuard(true);
    return { act: a && a.act, mb: a && a.mb, hits: rzMemCap().timesItHadToAct, loaded: (S.threads || []).filter(t => loadedBytes(t) > 0).length };
  });
  console.log("  run " + (k + 1) + ": act=" + (r.act || "(nothing)") + " · it reads " + r.mb + " MB · loaded convs " + r.loaded + " · acted " + r.hits + " times");
  await page.waitForTimeout(300);
}

console.log("\npage errors: " + JSON.stringify(errs.filter(e => !/sandbox|ERR_UNKNOWN_URL_SCHEME/i.test(e)).slice(0, 5)));
console.log("\nWORST heap seen: see the lines above. Final heap " + end.heap + " MB, stores " + end.stores + " MB.");
await browser.close();
