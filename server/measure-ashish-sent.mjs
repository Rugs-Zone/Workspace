/* measure-ashish-sent.mjs - 28 Nov 2026
 *
 * "Still not showing in Sent, although Gmail shows everything Ashish sent."
 * Read only. Measures, as HIM (a real Switch ID session) and on the shipped build, exactly how
 * many of his sent mails the app can show and where the rest are, so the next fix is aimed at
 * the real gap instead of a guess.
 *
 * Run:  node server/measure-ashish-sent.mjs <admin token>
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(__dirname, "..", ".tmp", "node_modules", "playwright-core"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE = "file:///" + path.join(__dirname, "..", "mail-app.html").replace(/\\/g, "/");
const T = process.argv[2];
if (!T) { console.log("usage: node server/measure-ashish-sent.mjs <admin token>"); process.exit(1); }
const ME = "umvkv0zd039", LOGIN = "merchandiser9@rugscreation.com";
const post = async (p, b) => {
  const r = await fetch("https://mail-api.rugserp.com" + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  return { s: r.status, j: await r.json().catch(() => null) };
};

/* ---- 1 · what the database holds, per mailbox (from the job's own report) ---- */
const st = await post("/rugs-mail", { action: "serverStatus", token: T, job: "ashish-sent-2026-11-28", lines: 5 });
const rep = ((st.j && st.j.job && st.j.job.rows) || []).map(r => r.value).find(v => v && v.per_mailbox);
console.log("=== 1 · his sent mail in the database, per mailbox ===");
let his = 0, other = 0;
(rep.per_mailbox || []).forEach(m => {
  const mine = String(m.mailbox).toLowerCase() === "teampulse@rugscreation.com";
  if (mine) his += m.sent; else other += m.sent;
  console.log("   " + String(m.mailbox).padEnd(34) + String(m.sent).padStart(5) + (mine ? "   <- his own team" : ""));
});
console.log("   his own team: " + his + " | in OTHER teams' mailboxes: " + other + " | total " + (his + other));

/* ---- 2 · his session, with the list paged as far as the app will keep ---- */
const sw = await post("/rugs-mail-switch", { action: "switch", id: ME, token: T });
const T2 = sw.j.token;
const boot = await post("/rugs-mail", { action: "boot", token: T2 });
const list = await post("/rugs-mail-list", { action: "list", token: T2 });
const L = list.j;
console.log("\n=== 2 · his own session ===");
console.log("   mailboxes his session is given: " + JSON.stringify((L.mailboxes || []).map(x => x.mailbox)));
console.log("   first page: " + (L.threads || []).length + " conversations, " + (L.messages || []).length + " mails");
let oldest = Math.min(...(L.threads || []).map(t => Date.parse(t.last_msg_at) || Date.now()));
for (let p = 0; p < 5; p++) {
  const more = await post("/rugs-mail-list", { action: "more", box: "teampulse@rugscreation.com", before: oldest, limit: 400, token: T2 });
  const th = (more.j && more.j.threads) || [];
  if (!th.length) break;
  L.threads = L.threads.concat(th);
  L.messages = L.messages.concat((more.j && more.j.messages) || []);
  oldest = Math.min(...th.map(t => Date.parse(t.last_msg_at) || Date.now()));
}
console.log("   after paging back: " + L.threads.length + " conversations, " + L.messages.length + " mails (back to " + new Date(oldest).toISOString().slice(0, 10) + ")");
const hisHere = (L.messages || []).filter(m => String(m.from_email || "").toLowerCase() === LOGIN);
console.log("   of those mails, sent by him: " + hisHere.length);

/* ---- 3 · what the app shows him ---- */
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on("pageerror", e => errs.push(String(e.message || e)));
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const r = await page.evaluate(({ boot, L, LOGIN }) => {
  PEOPLE.length = 0; (boot.users || []).forEach(u => PEOPLE.push({ id: u.id, name: u.name, login: u.login, dept: u.dept_id, role: u.role, active: u.active, perm: u.perm || {}, access: u.access || {} }));
  DEPTS.length = 0; (boot.depts || []).forEach(d => DEPTS.push({ id: d.id, name: d.name, box: String(d.mailbox || "").split("@")[0] + "@", mailbox: d.mailbox, color: "#09c" }));
  S.settings = boot.settings || {};
  const by = {}, ac = {};
  (L.messages || []).forEach(m => { const k = m.mailbox + "|" + m.gmail_thread_id; (by[k] = by[k] || []).push(m) });
  const home = {}; (boot.depts || []).forEach(d => home[String(d.mailbox).toLowerCase()] = d.id);
  S.threads = [];
  (L.threads || []).forEach(row => {
    const h = home[String(row.mailbox).toLowerCase()]; if (!h) return;
    const k = row.mailbox + "|" + row.gmail_thread_id;
    const t = mapRow(row, by[k] || [], ac[k] || [], null, h);
    if (t.msgs.length) S.threads.push(t);
  });
  ME = "umvkv0zd039"; app = "mail";
  if (typeof filt !== "undefined") filt = "all";
  if (typeof lfilt !== "undefined") lfilt = "";
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  window.LIVE = false; api = async () => ({});
  /* every conversation in memory that holds a mail of his */
  const mine = S.threads.filter(t => (t.msgs || []).some(m => String(m.email || "").toLowerCase() === LOGIN));
  const mineMails = mine.reduce((a, t) => a + (t.msgs || []).filter(m => String(m.email || "").toLowerCase() === LOGIN).length, 0);
  view = { type: "box", dept: "dmvkv30v5", folder: "sent" }; openId = null; render();
  const rows = listRows();
  const sentIds = new Set(rows.map(x => x.id));
  const shown = mine.filter(t => sentIds.has(t.id));
  const hidden = mine.filter(t => !sentIds.has(t.id));
  const why = hidden.slice(0, 12).map(t => {
    const hm = (t.msgs || []).filter(m => String(m.email || "").toLowerCase() === LOGIN);
    return {
      sub: String(t.sub).slice(0, 34), folder: t.folder, owner: t.owner || "",
      byUs: hm.some(m => sentByUs(m, t)),
      r15: typeof sentSeen === "function" ? sentSeen(t) : null,
      r3: typeof seeMine === "function" ? seeMine(t) : null,
      inView: typeof inView === "function" ? inView(t) : null,
      age: Math.round((Date.now() - t.last) / 864e5) + "d"
    };
  });
  /* and can he see the other teams' mailboxes at all? */
  const boxes = DEPTS.map(d => ({ box: d.mailbox, canSee: typeof canSee === "function" ? (canSee(d.id) || "none") : "?" }));
  return {
    conversationsInMemory: S.threads.length,
    hisConversations: mine.length, hisMails: mineMails,
    sentRows: rows.length, sentConversations: sentIds.size,
    hisShown: shown.length, hisHidden: hidden.length, why, boxes,
    memMB: window.rzMemCap ? window.rzMemCap().nowMB : null
  };
}, { boot: boot.j, L, LOGIN });
await browser.close();

console.log("\n=== 3 · what the shipped app shows him ===");
console.log("   conversations in memory: " + r.conversationsInMemory + " (tab " + r.memMB + " MB)");
console.log("   conversations holding a mail of his: " + r.hisConversations + " (" + r.hisMails + " of his mails)");
console.log("   his Sent: " + r.sentConversations + " conversations / " + r.sentRows + " rows");
console.log("   of his conversations: SHOWN " + r.hisShown + " | NOT shown " + r.hisHidden);
if (r.why.length) { console.log("   why the hidden ones are hidden:"); r.why.forEach(w => console.log("     " + JSON.stringify(w))); }
console.log("\n=== 4 · which mailboxes he may open at all ===");
r.boxes.forEach(b => console.log("   " + String(b.box).padEnd(34) + b.canSee));
console.log("\npage errors: " + JSON.stringify(errs));
