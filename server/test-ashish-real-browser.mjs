/* test-ashish-real-browser.mjs - 28 Nov 2026
 *
 * No harness at all: the REAL published app (https://rugs-zone.github.io/Workspace/mail.html) is
 * opened in a real browser, signed in as Ashish Deshwal with a real session token, left to boot
 * itself (its own loadList, its own IndexedDB cache, its own render), and then his Sent folder is
 * clicked and read off the screen - exactly what he sees.
 *
 * Read only: it signs in with a Switch ID session token and reads. Nothing is sent or changed.
 *
 * Run:  node server/test-ashish-real-browser.mjs <admin token>
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SITE = "https://rugs-zone.github.io/Workspace/mail.html";
const T = process.argv[2];
if (!T) { console.log("usage: node server/test-ashish-real-browser.mjs <admin token>"); process.exit(1); }

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

const sw = await (await fetch("https://mail-api.rugserp.com/rugs-mail-switch", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "switch", id: "umvkv0zd039", token: T })
})).json();
ck("a real session as Ashish", !!sw.token, true);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
await page.addInitScript(tok => { try { localStorage.setItem("rugs-token", tok) } catch (e) { } }, sw.token);
await page.goto(SITE, { waitUntil: "domcontentloaded" });

/* let the real app boot and load his mail */
await page.waitForFunction(() => typeof window.APP_BUILD !== "undefined" || document.querySelector("#list .m") || document.querySelector("#login:not([hidden])"), null, { timeout: 90000 }).catch(() => { });
await page.waitForTimeout(25000);

const boot = await page.evaluate(() => ({
  build: (typeof APP_BUILD !== "undefined") ? APP_BUILD : "?",
  helper: typeof sentByUs === "function",
  signedIn: !!(typeof ME !== "undefined" && ME),
  me: (typeof ME !== "undefined" && typeof who === "function" && who(ME)) ? who(ME).name : "",
  threads: (typeof S !== "undefined" && S.threads) ? S.threads.length : -1,
  loginVisible: !!document.querySelector("#login:not([hidden])")
}));
console.log("  the real app: build " + boot.build + " | signed in as " + boot.me + " | conversations " + boot.threads);
ck("the published app is the new build", boot.build, "2026-11-28-4");
ck("it has the new Sent rule", boot.helper, true);
ck("it signed in as him", boot.me, "Ashish Deshwal");

/* click Sent, the way he does */
const sent = await page.evaluate(async () => {
  /* the app opens on Home: click the mailbox first (that is what puts him on the mail screen
     and draws its folders), then the Sent row - exactly the two clicks he makes. */
  const mb = document.querySelector('.fi[data-box][data-f="inbox"]');
  if (mb) mb.click();
  await new Promise(r => setTimeout(r, 2500));
  const b = document.querySelector('.fi[data-box][data-f="sent"]');
  if (b) b.click();
  await new Promise(r => setTimeout(r, 3000));
  const rows = [].slice.call(document.querySelectorAll("#list .m"));
  return {
    clicked: !!b,
    folder: (typeof view !== "undefined") ? (view.folder || "") + "/" + (view.dept || "") : "?",
    rowsOnScreen: rows.length,
    listRows: (typeof listRows === "function") ? listRows().length : -1,
    first: rows.slice(0, 8).map(el => (el.textContent || "").replace(/\s+/g, " ").slice(0, 80)),
    toColumn: (typeof listRows === "function" && typeof sentTo === "function") ? listRows().slice(0, 8).map(r => String(sentTo(r)).slice(0, 44)) : [],
    junkTo: (typeof listRows === "function" && typeof sentTo === "function")
      ? listRows().filter(r => { const v = String(sentTo(r)); return /cid:|https?:|\[|^\s*$/.test(v) || v.split(/\s+/).length > 6 }).length : -1,
    mine: (typeof rzSentCheck === "function") ? rzSentCheck() : null,
    /* what the Sent list really holds, by the app's own listRows */
    sentConversations: (typeof listRows === "function") ? [...new Set(listRows().map(r => r.id))].length : -1,
    minesInSent: (typeof listRows === "function" && typeof msgMine === "function")
      ? [...new Set(listRows().filter(r => { const t = T_(r.id); return t && (t.msgs || []).some(m => msgMine(m, t)) }).map(r => r.id))].length : -1,
    empty: (document.querySelector("#list .empty") || {}).textContent || ""
  };
});
console.log("\n  HIS SENT FOLDER, on the real site:");
console.log("   view " + sent.folder + " | rows on screen " + sent.rowsOnScreen + " | listRows " + sent.listRows);
sent.first.forEach(t => console.log("     " + t));
if (sent.empty) console.log("   the empty message says: " + sent.empty.replace(/\s+/g, " ").slice(0, 120));
console.log("   rzSentCheck(): " + JSON.stringify(sent.mine));

ck("the Sent folder was reachable", sent.clicked, true);
ck("he is in Sent", /^sent/.test(sent.folder), true);
ck("his Sent is not empty", sent.rowsOnScreen > 0, true);
ck("and it holds mail he himself sent", sent.mine && sent.mine.onesISent > 0, true);
ck("no junk in the To: column", sent.junkTo, 0);
ck("no page errors", errs.filter(e => !/ResizeObserver|Script error/.test(e)), []);

await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
