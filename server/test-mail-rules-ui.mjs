/* test-mail-rules-ui.mjs - 26 Nov 2026
 *
 * The screen half of Admin -> Mail rules, in a real browser (headless Edge) on the BUILT
 * mail-app.html, because a confirm dialog, a toggle and a stylesheet cannot be checked in
 * node. It signs nobody in: it loads the page, fills in the few globals the renderer reads,
 * and then draws and clicks the real thing.
 *
 * What it proves
 *   - the page draws, groups every rule, and shows the checks panel;
 *   - a toggle opens the CONFIRM dialog with the effect, the conflict and the cost in it;
 *   - "Leave it as it is" changes nothing (the switch must never move before the question);
 *   - a change with a hard conflict still needs the "I have read the conflict" button;
 *   - the read-only version for everybody else has no working switch;
 *   - the page does not scroll sideways at phone width.
 *
 * Run:  node server/test-mail-rules-ui.mjs
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message || e)));
/* the maintenance window would cover the page, and nobody is signed in here */
await page.addInitScript(() => { try { localStorage.setItem("rugs-maint-ok", "1"); } catch (e) { } });
await page.goto(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

/* put a small world into the page, then draw the real rules screen into #rltest */
const ready = await page.evaluate(() => {
  if (typeof rulesHTML !== "function") return "rulesHTML is not in the app";
  /* ME, PEOPLE and DEPTS are top-level `let`s, so they are reachable by name but not on
     window. S.org + applyOrg() is the app's own way in. */
  PEOPLE.length = 0;
  PEOPLE.push(
    { id: "imran", name: "Imran Khan", login: "merchandiser4@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "gulab", name: "Gulab Tyagi", login: "amr1@rugscreation.com", dept: "ta", role: "Executive", active: true, perm: {} },
    { id: "jagjit", name: "Jagjit Singh", login: "merchandiser2@rugscreation.com", dept: "ta", role: "Manager", active: true, perm: {} },
    { id: "adm", name: "Priyanshu Tomar", login: "marketing@rugscreation.com", dept: "ta", role: "Admin", active: true, perm: {} });
  DEPTS.length = 0;
  DEPTS.push({ id: "ta", name: "Team Alpha", box: "teamalpha@", color: "#ff5001" });
  const buyer = { at: 1, from: "Buyer", email: "b@x.com" };
  S.threads = [
    { id: "ta:1", dept: "ta", folder: "inbox", owner: null, status: "new", sub: "New enquiry", hist: [], msgs: [buyer] },
    { id: "ta:2", dept: "ta", folder: "inbox", owner: "gulab", status: "open", sub: "PO 174871", hist: [], msgs: [buyer] },
    { id: "ta:3", dept: "ta", folder: "inbox", owner: null, status: "done", sub: "Old history", hist: [], msgs: [buyer] }
  ];
  S.settings = {}; S.lvOf = { gulab: "unread" };
  ME = "adm";
  /* nobody is signed in, so #rltest is hidden - draw into a container of our own that is on
     top of the login screen but still inside the app's own stylesheet */
  const lg = document.getElementById("login"); if (lg) lg.hidden = true;
  document.body.classList.remove("signedout");
  window.__draw = (edit) => {
    window.__edit = !!edit;
    let w = document.getElementById("rltest");
    if (!w) {
      w = document.createElement("div"); w.id = "rltest"; w.className = "page";
      w.style.cssText = "position:fixed;inset:0;overflow:auto;z-index:5;background:#fff;padding:12px";
      document.body.appendChild(w);
    }
    w.innerHTML = rulesHTML(!!edit);
  };
  /* the page's own buttons call render(); point it at our container so a click really redraws */
  render = function () { try { window.__draw(window.__edit); } catch (e) { } };
  window.__draw(true);
  return "ok";
});
ck("the rules screen is in the built app and draws", ready, "ok");

/* ---------------------------------------------------------------- the page */
console.log("\n=== the page ===");
ck("every group has a box of its own", await page.evaluate(() => RGROUPS.filter(g => [...document.querySelectorAll('#rltest .box h3')].some(h => h.textContent.indexOf(g) === 0)).length), await page.evaluate(() => RGROUPS.length));
/* 27 Nov 2026: rule M1 (mandatory) - this tab stays under 250 MB */
const m1ui = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#rltest .rlrow')].find(x => (x.querySelector('.rlid') || {}).textContent === 'M1');
  if (!row) return { there: false };
  return { there: true, badge: (row.querySelector('.rlbadge') || {}).textContent || '',
    switches: row.querySelectorAll('[data-rtog]').length,
    act: (row.querySelector('.rlact em') || {}).textContent || '',
    says: (row.querySelector('.rlnow') || {}).textContent || '' };
});
ck("rule M1 is drawn on the real page", m1ui.there, true);
ck("...with the Mandatory badge", m1ui.badge, "Mandatory");
ck("...no switch an admin could press", m1ui.switches, 0);
ck("...and it says so where the switch would be", m1ui.act, "cannot be switched off");
ck("...and it names the ceiling", /250 MB/.test(m1ui.says), true);
ck("one row per rule is drawn", await page.locator("#rltest .rlrow").count(), await page.evaluate(() => RULES.length));
ck("8 working switches", await page.locator("#rltest .rsw[data-rtog]").count(), 8);
ck("none of them is disabled for an admin", await page.locator("#rltest .rsw[data-rtog][disabled]").count(), 0);
ck("the checks panel names the person whose Show filter is set",
  (await page.locator("#rltest .rlck").allTextContents()).some(t => t.includes("Gulab")), true);
ck("every rule shows a 'what breaks' link", await page.locator("#rltest [data-rmore]").count(), await page.evaluate(() => RULES.length));
ck("the detail opens on click", await (async () => {
  await page.locator('#rltest [data-rmore="R7"]').click(); await page.waitForTimeout(250);
  return await page.locator("#rltest .rlexp").count() > 0;
})(), true);
ck("...and the 17 November sweep is named in it",
  (await page.locator("#rltest .rlexp").first().textContent()).includes("43,296"), true);

/* ------------------------------------------------------- the question first */
console.log("\n=== a switch asks before it moves ===");
const before = await page.evaluate(() => RON("R7"));
await page.locator('#rltest .rsw[data-rtog="R7"]').click();
await page.waitForTimeout(350);
ck("clicking the switch opens a dialog, it does not just flip", await page.locator(".scrim .dlg").count(), 1);
ck("the switch has NOT moved yet", await page.evaluate(() => RON("R7")), before);
const dtext = await page.locator(".scrim .dlg").textContent();
ck("the dialog says what happens the moment you press it", dtext.includes("What happens the moment you press it"), true);
/* textContent glues the sections together ("...press it1 conversation of the 3..."), so no \b */
ck("...with the real number counted from the mail loaded here", /1 conversation of the 3 now in the Inbox/.test(dtext), true);
ck("the dialog shows the conflict", dtext.includes("This conflicts with how the rest of the app works"), true);
ck("...and names the 17 November sweep as the reason", dtext.includes("43,296"), true);
ck("the dialog shows what it will cost", dtext.includes("What it will cost"), true);
ck("the dialog says who it affects", dtext.includes("Who it affects"), true);
ck("a conflicting change needs the 'I have read the conflict' button",
  (await page.locator(".scrim .dlg footer [data-ryes]").textContent()).includes("read the conflict"), true);
ck("'Leave it as it is' is the button that has the focus",
  await page.evaluate(() => !!document.activeElement && document.activeElement.hasAttribute("data-rno")), true);
await page.locator(".scrim .dlg [data-rno]").click();
await page.waitForTimeout(300);
ck("cancelling closes the dialog", await page.locator(".scrim .dlg").count(), 0);
ck("cancelling leaves the rule exactly as it was", await page.evaluate(() => RON("R7")), before);

console.log("\n=== a change with no conflict is a plain question ===");
await page.evaluate(() => window.__draw(true));
await page.locator('#rltest .rsw[data-rtog="R17"]').click();
await page.waitForTimeout(350);
const d2 = await page.locator(".scrim .dlg").textContent();
ck("R17 has no hard conflict", d2.includes("This conflicts with how the rest of the app works"), false);
/* R17 ships ON since the night of 26/27 Nov, so clicking its switch proposes OFF */
ck("...so the button just says what it will do",
  (await page.locator(".scrim .dlg footer [data-ryes]").textContent()).includes("Change it to OFF"), true);
ck("...and it still says what the list would look like afterwards", /one row per conversation/.test(d2), true);
ck("...and warns that a single mail then has no row of its own", /no row of its own/.test(d2), true);
await page.locator(".scrim .dlg [data-rno]").click();
await page.waitForTimeout(250);

/* ----------------------------------------------------------- read only ---- */
console.log("\n=== everybody else can read it, not change it ===");
await page.evaluate(() => window.__draw(false));
ck("every switch is disabled", await page.locator("#rltest .rsw[data-rtog][disabled]").count(), 8);
ck("it says only an admin can change a rule",
  (await page.locator("#rltest .rlhead").textContent()).includes("Only an admin can change a rule"), true);
ck("clicking a disabled switch opens nothing", await (async () => {
  await page.locator('#rltest .rsw[data-rtog="R7"]').click({ force: true }).catch(() => null);
  await page.waitForTimeout(250); return await page.locator(".scrim .dlg").count();
})(), 0);
ck("the rules themselves are still all readable", await page.locator("#rltest .rlrow").count(), await page.evaluate(() => RULES.length));

/* ------------------------------------------------------------- the phone -- */
console.log("\n=== on a phone ===");
await page.setViewportSize({ width: 390, height: 780 });
await page.evaluate(() => window.__draw(true));
await page.waitForTimeout(300);
ck("the page does not scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
ck("the switches are still there", await page.locator("#rltest .rsw[data-rtog]").count(), 8);

console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
if (errs.length) fail += errs.length;
await browser.close();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
