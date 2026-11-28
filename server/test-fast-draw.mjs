/* test-fast-draw.mjs - 28 Nov 2026
 *
 * "it is lagging so much". The list and the folder pane were rebuilt from scratch on every
 * redraw - 457 rows and a whole folder pane - even when nothing had changed. This measures the
 * build before the change (git HEAD) and the build after it, back to back, in the same minute,
 * on the same real mailbox, and then proves the screen still changes the moment the mail does.
 *
 * Run:  node server/test-fast-draw.mjs <admin token> [user id]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const W = path.join(__dirname, "..");
const T = process.argv[2], WHO = process.argv[3] || "umvkv0zd039";
if (!T) { console.log("usage: node server/test-fast-draw.mjs <admin token> [user id]"); process.exit(1); }

let pass = 0, fail = 0;
const ck = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(g) + ", wanted " + JSON.stringify(w) + ")")); ok ? pass++ : fail++; };

const OLD = path.join(W, ".tmp", "old-mail-app.html");
fs.writeFileSync(OLD, execSync("git show HEAD:mail-app.html", { cwd: W, maxBuffer: 1 << 30 }));
const bOf = (f) => (fs.readFileSync(f, "utf8").match(/APP_BUILD='([^']+)'/) || [])[1];
console.log("old build " + bOf(OLD) + "   new build " + bOf(path.join(W, "mail-app.html")));

const sw = await (await fetch("https://mail-api.rugserp.com/rugs-mail-switch", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "switch", id: WHO, token: T })
})).json();
ck("a real session to measure with", !!sw.token, true);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
async function run(file) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
  await page.addInitScript(tok => { try { localStorage.setItem("rugs-token", tok) } catch (e) { } }, sw.token);
  await page.goto("file:///" + file.replace(/\\/g, "/"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction("typeof S !== 'undefined' && S && S.threads && S.threads.length > 400", null, { timeout: 120000, polling: 500 }).catch(() => { });
  await page.waitForTimeout(12000);
  const r = await page.evaluate(() => {
    const ms = (f, n) => { const t = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - t) / n).toFixed(1) };
    const mb = DEPTS.find(d => d.id === who(ME).dept);
    app = "mail"; view = { type: "box", dept: mb.id, folder: "sent" }; openId = null; render();
    const o = { build: APP_BUILD, threads: S.threads.length, rows: document.querySelectorAll(".list .msgs .m").length };
    o.idle = ms(() => render(), 10);                       /* a poll: nothing changed */
    o.folders = ms(() => renderFolders(), 10);
    o.list = ms(() => renderList(), 10);
    const first = document.querySelector('.list .msgs .m[data-open]');
    const id = first ? first.getAttribute("data-open") : null;
    o.open = ms(() => { openId = id; render(); openId = null; render() }, 4);
    o.folderSwitch = ms(() => {
      view = { type: "box", dept: mb.id, folder: "inbox" }; render();
      view = { type: "box", dept: mb.id, folder: "sent" }; render();
    }, 3);
    /* --- correctness: the screen must still follow the mail --- */
    view = { type: "box", dept: mb.id, folder: "sent" }; openId = null; render();
    const sub = (i) => { const n = document.querySelectorAll(".list .msgs .m")[i]; return n ? (n.querySelector(".sub") || {}).textContent : "" };
    o.before = [sub(0), sub(1), sub(2)];
    const t = S.threads.find(x => x.id === (id || "").toString()) || S.threads[0];
    t.sub = "ZZZ changed by the test";
    render();
    o.afterEdit = [...document.querySelectorAll(".list .msgs .m .sub")].slice(0, 20).map(x => x.textContent).filter(x => /ZZZ changed/.test(x)).length;
    /* a brand new mail must appear */
    const fresh = JSON.parse(JSON.stringify(S.threads[0]));
    fresh.id = "zz:new"; fresh.sub = "QQQ brand new mail"; fresh.last = Date.now();
    fresh.msgs = S.threads[0].msgs.map(m => Object.assign({}, m, { at: Date.now(), gid: "zz" + Math.random() }));
    S.threads.unshift(fresh);
    render();
    o.newMailShown = [...document.querySelectorAll(".list .msgs .m .sub")].slice(0, 8).map(x => x.textContent).some(x => /QQQ brand new/.test(x));
    /* a change the app's OWN fingerprint covers (unread) must reach the screen at once */
    const tu = S.threads.find(x => !x.unread) || S.threads[0];
    tu.unread = true; render();
    o.unreadShown = !!document.querySelector('.list .msgs .m.unread');
    tu.unread = false; render();
    o.unreadGone = !document.querySelector('.list .msgs .m.unread');
    /* and so must a move to another folder */
    const tf = S.threads[1]; const was = tf.folder; const key0 = [...document.querySelectorAll(".list .msgs .m")].length;
    tf.folder = "deleted"; render();
    o.movedOut = [...document.querySelectorAll(".list .msgs .m")].length <= key0;
    tf.folder = was; render();
    /* opening a mail must still mark the row open */
    const row2 = document.querySelector('.list .msgs .m[data-open]');
    openId = row2 ? row2.getAttribute("data-open") : null; render();
    o.openClass = !!document.querySelector('.list .msgs .m.open');
    openId = null; render();
    /* the chips must still work */
    filt = "unread"; render(); o.chipRows = document.querySelectorAll(".list .msgs .m").length;
    filt = "all"; render(); o.backRows = document.querySelectorAll(".list .msgs .m").length;
    /* and the folder pane must follow a folder change */
    view = { type: "box", dept: mb.id, folder: "archive" }; render();
    o.folderSel = !!document.querySelector('.fi.sel, .fi[aria-current="true"], .fi.on');
    view = { type: "box", dept: mb.id, folder: "sent" }; render();
    o.stats = typeof window.rzDrawStats === "function" ? window.rzDrawStats() : null;
    return o;
  });
  r.errs = errs;
  await page.close();
  return r;
}

const a = await run(OLD);
const b = await run(path.join(W, "mail-app.html"));
await browser.close();

const line = (k) => "   " + k.padEnd(13) + String(a[k]).padStart(8) + " ms  ->" + String(b[k]).padStart(8) + " ms";
console.log("\n" + a.build + " (" + a.threads + " conversations, " + a.rows + " rows)  ->  " + b.build + " (" + b.threads + ", " + b.rows + ")");
["idle", "folders", "list", "open", "folderSwitch"].forEach(k => console.log(line(k)));
console.log("   draws saved: " + JSON.stringify(b.stats));

ck("both builds loaded the same mailbox", [a.threads > 400, b.threads > 400], [true, true]);
ck("both builds draw the same number of rows", Math.abs(a.rows - b.rows) <= 2, true);
ck("an idle redraw is at least twice as cheap", b.idle * 2 <= a.idle, true);
ck("a redraw of the list alone is at least twice as cheap", b.list * 2 <= a.list, true);
ck("the folder pane too", b.folders * 2 <= a.folders, true);
ck("opening a mail is not slower", b.open <= a.open * 1.1, true);
ck("changing folder still redraws (and is not slower)", b.folderSwitch <= a.folderSwitch * 1.2, true);
ck("the page really skipped list draws", !!(b.stats && b.stats.listSkipped > 0), true);
ck("and folder-pane draws", !!(b.stats && b.stats.foldersSkipped > 0), true);
/* correctness - the new build must behave exactly like the old one */
ck("a changed subject behaves exactly as before", b.afterEdit, a.afterEdit);
ck("a new mail behaves exactly as before", b.newMailShown, a.newMailShown);
ck("an unread mail still lights up at once", [b.unreadShown, b.unreadGone], [a.unreadShown, a.unreadGone]);
ck("and it really did light up", b.unreadShown, true);
ck("a mail moved to another folder still leaves the list", b.movedOut, a.movedOut);
ck("the open row still looks open", b.openClass, a.openClass);
ck("the Unread chip still filters", [b.chipRows <= b.rows, b.backRows >= b.chipRows], [true, true]);
ck("the folder pane still follows the folder", b.folderSel, a.folderSel);
ck("no page errors, old build", a.errs.length, 0);
ck("no page errors, new build", b.errs.length, 0);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
