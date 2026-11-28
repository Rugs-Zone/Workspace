/* measure-lag.mjs - 28 Nov 2026
 * "it is lagging so much". Measure WHERE, on the real published app, as a real person with a
 * real mailbox - before changing a line. Read only.
 *
 * Run:  node server/measure-lag.mjs <admin token> [user id]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SITE = process.env.RZ_SITE || "https://rugs-zone.github.io/Workspace/mail.html";
const T = process.argv[2], WHO = process.argv[3] || "umvkv0zd039";
if (!T) { console.log("usage: node server/measure-lag.mjs <admin token> [user id]"); process.exit(1); }

const sw = await (await fetch("https://mail-api.rugserp.com/rugs-mail-switch", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "switch", id: WHO, token: T })
})).json();
if (!sw.token) { console.log("could not open a session: " + JSON.stringify(sw).slice(0, 200)); process.exit(1); }

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(tok => { try { localStorage.setItem("rugs-token", tok) } catch (e) { } }, sw.token);
const t0 = Date.now();
await page.goto(SITE, { waitUntil: "domcontentloaded" });
await page.waitForFunction("typeof S !== 'undefined' && S && S.threads && S.threads.length > 0", null, { timeout: 120000, polling: 500 }).catch(() => { });
const firstMail = Date.now() - t0;
await page.waitForTimeout(20000);

const info = await page.evaluate(() => ({
  build: typeof APP_BUILD !== "undefined" ? APP_BUILD : "?",
  me: (typeof ME !== "undefined" && typeof who === "function" && who(ME)) ? who(ME).name : "",
  threads: S.threads.length,
  msgs: S.threads.reduce((a, t) => a + (t.msgs ? t.msgs.length : 0), 0),
  mem: window.rzMemCap ? window.rzMemCap() : null
}));
console.log("site " + SITE);
console.log("build " + info.build + " | " + info.me + " | " + info.threads + " conversations, " + info.msgs + " mails");
console.log("first mail on screen after " + (firstMail / 1000).toFixed(1) + " s");
if (info.mem) console.log("tab holds " + info.mem.nowMB + " MB (" + (info.mem.ours || "?") + ")");

/* ---- where the time goes, measured inside the page ---- */
const r = await page.evaluate(async () => {
  const ms = (f, n) => { const t = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - t) / n).toFixed(1) };
  const go = (v) => { view = v; openId = null };
  const out = {};
  const mb = DEPTS.find(d => d.id === who(ME).dept);
  app = "mail";
  go({ type: "box", dept: mb.id, folder: "inbox" });
  render();
  out.inbox_render = ms(() => render(), 5);
  out.inbox_listRows = ms(() => listRows(), 5);
  out.inbox_rows = listRows().length;
  go({ type: "box", dept: mb.id, folder: "sent" });
  out.sent_render = ms(() => render(), 5);
  out.sent_listRows = ms(() => listRows(), 5);
  const sr = listRows();
  out.sent_rows = sr.length;
  out.sent_rowHTML = ms(() => { for (let i = 0; i < Math.min(50, sr.length); i++) rowHTML(sr[i]) }, 3) ;
  out.sent_sentTo = ms(() => { for (let i = 0; i < Math.min(50, sr.length); i++) sentTo(sr[i]) }, 3);
  out.drawn = document.querySelectorAll(".list .msgs .m").length;
  out.domNodes = document.getElementsByTagName("*").length;
  out.iframes = document.querySelectorAll("iframe").length;
  /* a keystroke in the search box */
  const q = document.getElementById("q");
  out.search_keystroke = ms(() => { q.value = "robin"; render(); q.value = ""; }, 3);
  q.value = ""; render();
  /* opening a mail */
  const row = document.querySelector(".list .msgs .m[data-open]");
  if (row) {
    const id = row.getAttribute("data-open");
    const t = performance.now(); openId = id; render(); out.open_render = +(performance.now() - t).toFixed(1);
    openId = null; render();
  }
  /* the per-draw helpers everyone shares */
  /* where listRows spends its time */
  go({ type: "box", dept: mb.id, folder: "inbox" }); render();
  out.b_filter = ms(() => S.threads.filter(inView), 5);
  const base = S.threads.filter(inView);
  out.b_baseRows = base.length;
  out.b_explode = (typeof explode === "function") ? ms(() => explode(base), 5) : "?";
  out.b_seeMine = (typeof seeMine === "function") ? ms(() => { for (const t of S.threads) seeMine(t) }, 5) : "?";
  out.b_isWork = (typeof isWork === "function") ? ms(() => { for (const t of S.threads) isWork(t) }, 5) : "?";
  out.b_sort = ms(() => base.slice().sort((a, b) => b.last - a.last), 5);
  out.b_listRowsCalls = 0;
  const _lr = listRows; listRows = function () { out.b_listRowsCalls++; return _lr.apply(this, arguments) };
  render();
  listRows = _lr;
  out.mailFp = ms(() => (typeof mailFp === "function" ? mailFp() : 0), 20);
  out.folderPane = ms(() => renderFolders(), 5);
  out.inboxUnreadN = ms(() => inboxUnreadN(), 5);
  out.capRows = (typeof capRows === "function") ? capRows(sr) : "?";
  return out;
});
console.log("\n--- milliseconds, measured in the page ---");
Object.entries(r).forEach(([k, v]) => console.log("   " + k.padEnd(20) + " " + v));
console.log("\npage errors: " + JSON.stringify(errs.slice(0, 5)));
await browser.close();
