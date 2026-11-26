/* test-focus-mail.mjs - 27 Nov 2026  (night plan, bug 7:
 *   clicking the "Ashok 5:08 pm" row opened the conversation with Mia's 5:20 pm reply on top)
 *
 * Real headless Edge on the BUILT app (mail-app.html), with the reported case: the
 * "AW27 Spec" conversation in Team Pulse - Mia 4:50 pm, Ashok's reply 5:08 pm, Mia 5:20 pm.
 * Clicked as Shubham (the manager, who sees Ashok's reply as a row through R8m) and as
 * Ashok in Sent, plus the ways of opening a conversation that must NOT change.
 *
 * Run:  node server/test-focus-mail.mjs
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
  if (typeof focusMi !== "function") return "the __focusmail block is not in the app";
  if (typeof mgrSent !== "function") return "the R8m block is not in the app";
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "ashok", name: "Ashok Kumar", login: "merchandiser9@rugscreation.com", dept: "tp", role: "Executive", active: true, perm: {} },
    { id: "shubham", name: "Shubham Aneja", login: "dmm1@rugscreation.com", dept: "tp", role: "Manager", active: true, perm: { assign: 1 } },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "mkt", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "tp", name: "Team Pulse", box: "teampulse@", color: "#09c" },
    { id: "mkt", name: "Marketing", box: "marketing@", color: "#7a3fd1" });
  const D = (h, m) => Date.parse("2026-11-27T" + h + ":" + m + ":00+05:30");
  const msgs = [
    {
      gid: "g1", from: "Mia Chen", email: "mia@buyer.com", at: D("16", "50"),
      body: "Please send the AW27 spec.", to: "teampulse@rugscreation.com", cc: "sam@buyer.com",
      by: "", ours: false, atts: [{ name: "brief.pdf", mime: "application/pdf", size: 90000 }], files: [], sig: "", raw: "", html: ""
    },
    {
      gid: "g2", from: "Ashok Kumar", email: "teampulse@rugscreation.com", at: D("17", "08"),
      body: "Spec attached, please confirm.", to: "mia@buyer.com", cc: "", by: "ashok", ours: true,
      atts: [], files: [{ name: "spec.xlsx", size: 40000 }], sig: "", raw: "", html: ""
    },
    {
      gid: "g3", from: "Mia Chen", email: "mia@buyer.com", at: D("17", "20"),
      body: "Thank you, received.", to: "teampulse@rugscreation.com", cc: "lee@buyer.com",
      by: "", ours: false, atts: [{ name: "po.pdf", mime: "application/pdf", size: 70000 }], files: [], sig: "", raw: "", html: ""
    }
  ];
  const mk = (id, sub, ms) => ({
    id: "tp:" + id, box: "teampulse@rugscreation.com", dept: "tp", from: ms[0].from, email: ms[0].email,
    sub, pre: ms[0].body, last: ms[ms.length - 1].at, owner: null, status: "open", folder: "inbox",
    unread: false, hist: [], cats: [], flag: 0, pinned: 0, full: true, msgs: ms
  });
  S.threads = [mk(1, "AW27 Spec", msgs)];
  S.settings = {}; app = "mail";
  if (typeof filt !== "undefined") filt = "all";
  const q = document.getElementById("q"); if (q) q.value = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  try { S.threads.forEach(t => { metaSaved[t.id] = JSON.stringify(metaOf(t)); t._hn = t.hist.length; }); } catch (e) { }

  /* ---- helpers the checks use ---- */
  window.__go = (me, folder) => { ME = me; openId = null; FOC = null; view = { type: "box", dept: "tp", folder: folder || "inbox" }; render(); };
  /* the rows as they are drawn, with the mail each one stands for */
  window.__rows = () => [].slice.call(document.querySelectorAll(".list .m[data-open]")).map(el => ({
    mi: el.dataset.mi == null ? null : +el.dataset.mi,
    txt: el.textContent.replace(/\s+/g, " ").trim().slice(0, 90)
  }));
  /* click the row that stands for mail <mi> exactly as a person would */
  window.__clickRow = mi => {
    const el = document.querySelector('.list .m[data-open][data-mi="' + mi + '"]');
    if (!el) return "no row for mail " + mi;
    el.click(); return "ok";
  };
  /* what the reading pane shows now */
  window.__pane = () => {
    const rb = document.querySelector("#read .rbody");
    if (!rb) return { err: "no pane" };
    const arts = [].slice.call(rb.querySelectorAll("article.mail[data-mtog]")).map(a => ({
      mi: +a.getAttribute("data-mtog"),
      open: !a.classList.contains("collapsed"),
      shown: !!(a.offsetParent || a.getClientRects().length),
      top: a.getBoundingClientRect().top
    }));
    const bar = rb.querySelector(".fmbar");
    const seen = arts.filter(a => a.shown).sort((x, y) => x.top - y.top);
    return {
      bars: rb.querySelectorAll(".fmbar").length,
      bar: bar ? bar.textContent.replace(/\s+/g, " ").trim() : "",
      barAbove: bar && seen.length ? bar.getBoundingClientRect().top < seen[0].top : null,
      first: seen.length ? seen[0].mi : null,
      shown: seen.map(a => a.mi),
      openMails: arts.filter(a => a.open && a.shown).map(a => a.mi),
      hidden: arts.filter(a => !a.shown).map(a => a.mi)
    };
  };
  window.__clickBar = () => { const b = document.querySelector("#read .rbody .fmbar"); if (!b) return "no bar"; b.click(); return "ok"; };
  window.__showAll = () => { const b = document.querySelector('#read [data-mall="open"]'); if (!b) return "no button"; b.click(); return "ok"; };
  /* what a Reply / Reply all / Forward would carry */
  window.__quote = () => { const t = T_(openId); return trailOf(t).map(q => q.from + " " + tShort(q.at)); };
  window.__reply = all => {
    const t = T_(openId); document.getElementById("layer").innerHTML = "";
    compose({ t: t, all: !!all });
    const to = document.getElementById("ct"), cc = document.getElementById("cc"), ed = document.getElementById("cb");
    const r = {
      to: to ? to.value : "", cc: cc ? cc.value : "",
      quoted: ed ? [].slice.call(ed.querySelectorAll("[data-qm]")).map(x => +x.dataset.qm).sort() : [],
      ticks: [].slice.call(document.querySelectorAll("[data-qsel]")).length,
      body: ed ? ed.textContent.replace(/\s+/g, " ") : ""
    };
    document.getElementById("layer").innerHTML = "";
    return r;
  };
  window.__fwdFiles = () => {
    const t = T_(openId); document.getElementById("layer").innerHTML = "";
    compose({ t: t, fwd: true });
    const r = [].slice.call(document.querySelectorAll("[data-oatt]")).map(cb => ({
      name: cb.parentNode.textContent.replace(/\s+/g, " ").trim().split(" ")[0], on: cb.checked
    }));
    document.getElementById("layer").innerHTML = "";
    return r;
  };
  window.__eml = async () => {
    const t = T_(openId), real = compose; let got = null;
    compose = o => { got = o; };
    try { fwdAsAtt(t); } finally { compose = real; }
    if (!got || !got.files || !got.files[0]) return "nothing attached";
    return (await got.files[0].text()).replace(/\s+/g, " ");
  };
  return "ok";
});
ck("the focus block and R8m are both in the built app", setup, "ok");

/* ------------------------------------------- 1 · as Shubham, the manager --- */
console.log("\n=== 1 · Shubham's Inbox: the rows ===");
await page.evaluate(() => window.__go("shubham", "inbox"));
const rows = await page.evaluate(() => window.__rows());
console.log("     " + rows.map(r => "mi=" + r.mi + "  " + r.txt).join("\n     "));
ck("AW27 Spec gives him three rows, one per mail", rows.length, 3);
ck("every row names its own mail", rows.map(r => r.mi).sort(), [0, 1, 2]);
ck("Ashok's 5:08 row is the R8m copy", /Sent by Ashok/.test(rows.find(r => r.mi === 1).txt), true);

console.log("\n=== 2 · he clicks the Ashok 5:08 pm row ===");
ck("the row click lands", await page.evaluate(() => window.__clickRow(1)), "ok");
await page.waitForTimeout(260);
let p = await page.evaluate(() => window.__pane());
console.log("     " + JSON.stringify(p));
ck("the clicked mail (5:08) is the first mail on the page", p.first, 1);
ck("...and it is the one that is expanded", p.openMails, [1]);
ck("Mia's 5:20 pm is NOT shown - it is behind the bar", p.hidden, [2]);
ck("the older 4:50 pm mail is still listed below", p.shown.indexOf(0) > p.shown.indexOf(1), true);
ck("there is exactly one bar", p.bars, 1);
ck("the bar sits above the clicked mail", p.barAbove, true);
ck("the bar says how many and who", p.bar, "1 newer mail in this conversation \u00b7 Mia Chen 5:20 pm \u2191");

console.log("\n=== 3 · Reply / Reply all / Forward answer the clicked mail ===");
ck("the quote stops at the clicked mail", await page.evaluate(() => window.__quote()), ["Mia Chen 4:50 pm", "Ashok Kumar 5:08 pm"]);
const rep = await page.evaluate(() => window.__reply(false));
ck("Reply quotes only those two mails", rep.quoted, [0, 1]);
ck("...and offers a tickbox for each of them", rep.ticks, 2);
ck("...with nothing of Mia's 5:20 pm in the body", /Thank you, received/.test(rep.body), false);
const fwdF = await page.evaluate(() => window.__fwdFiles());
console.log("     forward files: " + JSON.stringify(fwdF));
ck("a Forward offers the clicked mail's file and the older one", fwdF.map(f => f.name), ["brief.pdf", "spec.xlsx"]);
ck("...and ticks the clicked mail's own file", fwdF.filter(f => f.on).map(f => f.name), ["spec.xlsx"]);
const eml = await page.evaluate(() => window.__eml());
ck("Forward as attachment sends the clicked mail", /From: Ashok Kumar/.test(eml) && !/From: Mia Chen/.test(eml), true);

console.log("\n=== 4 · pressing the bar brings the newer mail back ===");
ck("the bar click lands", await page.evaluate(() => window.__clickBar()), "ok");
await page.waitForTimeout(260);
p = await page.evaluate(() => window.__pane());
ck("Mia's 5:20 pm is shown again", p.hidden, []);
ck("...above the clicked mail, where it belongs", p.first, 2);
ck("the bar is gone", p.bars, 0);
ck("the clicked mail is still the open one", p.openMails, [1]);
ck("and a reply now quotes the whole conversation again", (await page.evaluate(() => window.__quote())).length, 3);

/* ------------------------------------------- 5 · clicking the newest row --- */
console.log("\n=== 5 · he clicks the Mia 5:20 pm row ===");
await page.evaluate(() => window.__go("shubham", "inbox"));
await page.evaluate(() => window.__clickRow(2));
await page.waitForTimeout(260);
p = await page.evaluate(() => window.__pane());
ck("Mia's 5:20 pm is the first mail", p.first, 2);
ck("...and the only one expanded", p.openMails, [2]);
ck("Ashok's 5:08 pm is below it, not hidden", p.shown, [2, 1, 0]);
ck("no bar is needed", p.bars, 0);
const rep2 = await page.evaluate(() => window.__reply(true));
ck("Reply to it goes to Mia", rep2.to, "mia@buyer.com");
/* the newest mail IS the whole conversation up to now, so Reply all is exactly as today */
ck("...and Reply all is unchanged on the newest mail", rep2.cc, "sam@buyer.com, lee@buyer.com");

/* ------------------------------------- 6 · a mail we sent, from an old row -- */
console.log("\n=== 6 · he clicks the oldest row (Mia 4:50 pm) ===");
await page.evaluate(() => window.__go("shubham", "inbox"));
await page.evaluate(() => window.__clickRow(0));
await page.waitForTimeout(260);
p = await page.evaluate(() => window.__pane());
ck("the 4:50 pm mail is the only one on the page", p.shown, [0]);
ck("...and it is expanded", p.openMails, [0]);
ck("both newer mails are behind the bar", p.hidden.slice().sort(), [1, 2]);
ck("the bar counts them", /^2 newer mails in this conversation/.test(p.bar), true);
ck("a reply quotes only that one mail", await page.evaluate(() => window.__quote()), ["Mia Chen 4:50 pm"]);
const rep3 = await page.evaluate(() => window.__reply(true));
ck("Reply goes to the person who wrote THAT mail", rep3.to, "mia@buyer.com");
ck("...and Reply all takes only that mail's own Cc", rep3.cc, "sam@buyer.com");

/* --------------------------------- 7 · opened any other way: as today ------ */
console.log("\n=== 7 · opened any other way ===");
const other = await page.evaluate(() => {
  window.__go("shubham", "inbox");
  open("tp:1"); render();            /* a search hit / a link / a bell notification */
  return window.__pane();
});
ck("no bar when it was not opened from a row", other.bars, 0);
ck("every mail is on the page", other.shown, [2, 1, 0]);
ck("the newest three bodies are open, as today", other.openMails.sort(), [0, 1, 2]);
const sa = await page.evaluate(async () => {
  window.__go("shubham", "inbox"); window.__clickRow(0);
  await new Promise(r => setTimeout(r, 200));
  const before = window.__pane().bars;
  window.__showAll();
  await new Promise(r => setTimeout(r, 200));
  return { before, after: window.__pane() };
});
ck('"Show all N mails" drops the focus (bar was there)', sa.before, 1);
ck("...and shows the whole conversation", sa.after.shown, [2, 1, 0]);
ck("...with no bar left", sa.after.bars, 0);

/* ---------------------------------------- 8 · Ashok in Sent (R8m / R8) ----- */
console.log("\n=== 8 · as Ashok, in Sent ===");
const sent = await page.evaluate(async () => {
  window.__go("ashok", "sent");
  const rows = window.__rows();
  const hit = window.__clickRow(1);
  await new Promise(r => setTimeout(r, 200));
  return { rows, hit, pane: window.__pane(), quote: window.__quote() };
});
console.log("     " + sent.rows.map(r => "mi=" + r.mi + "  " + r.txt).join("\n     "));
ck("his own 5:08 mail is the row in Sent", sent.hit, "ok");
ck("clicking it puts his mail on top", sent.pane.first, 1);
ck("...expanded", sent.pane.openMails, [1]);
ck("Mia's later reply is behind the bar", sent.pane.hidden, [2]);
ck("the bar is there", sent.pane.bars, 1);
ck("a reply from Sent also stops at his mail", sent.quote.length, 2);

/* ------------------------------------------------------- 9 · no errors ---- */
console.log("\n=== 9 · the browser console ===");
ck("no page errors", errs, []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
