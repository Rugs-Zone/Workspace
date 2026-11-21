/* Test the two app-side changes with the code exactly as it ships in index.html.
   Each block is cut out of index.html and run in a real browser against the same markup and the
   same stubs the app gives it, so what is tested is the shipped text, not a copy of it.
     1. The Inspection list: Edit for anyone who can open the page, Delete only for an admin,
        and the "edited by" note under Logged by.
     2. Assign New Task photos: a cross takes one off, picking again ADDS up to three.
   Usage: node server/test-insp-photos-ui.js                                                    */
const { chromium } = require("C:/Users/team3pr1/Desktop/Workspace/.tmp/node_modules/playwright-core");
const fs = require("fs");
const EXE = "C:/Program Files/Google/Chrome/Application/chrome.exe";
/* index.html is saved with Windows line endings; the markers below use plain \n */
const SRC = fs.readFileSync("C:/Users/team3pr1/Desktop/Workspace/index.html", "utf8").replace(/\r\n/g, "\n");

function cut(from, to, what) {
  const a = SRC.indexOf(from);
  if (a < 0) throw new Error("not found in index.html: " + what + " (start)");
  const b = SRC.indexOf(to, a);
  if (b < 0) throw new Error("not found in index.html: " + what + " (end)");
  return SRC.slice(a, b + to.length);
}

/* the shipped blocks, verbatim */
const BTNS = cut("  function admBtnsFor(kind, row, canEdit, canDelete) {",
  "    return admBtnsFor(kind, row, isAdm, isAdm);\n  }", "admBtnsFor/admBtns");
const RENDER = cut("  function renderInspections() {", "wrap.innerHTML = \"<table><thead>", "renderInspections");
const RENDER_FULL = SRC.slice(SRC.indexOf("  function renderInspections() {"),
  SRC.indexOf("\n  }", SRC.indexOf("</tbody></table>\";", SRC.indexOf("  function renderInspections() {"))) + 4);
const PHOTOS = cut("    var ntImages = [];\n    var NT_MAX_IMGS = 3;",
  "}).catch(function () { toast(\"Couldn't read that image\", true); });\n    });", "task photo handling");

console.log("cut from index.html: buttons " + BTNS.length + " chars, inspection list " +
  RENDER_FULL.length + " chars, photos " + PHOTOS.length + " chars");

const PAGE = `<!doctype html><meta charset="utf-8">
<style>
 .adm-actions{display:inline-flex;gap:4px}
 .adm-btn{font-size:11.5px;padding:4px 8px}
 .task-att-row{display:flex;gap:6px;flex-wrap:wrap}
 .task-att-row img{width:56px;height:56px;display:block}
 .nt-img{position:relative;display:inline-block}
 .nt-img-x{position:absolute;top:-7px;right:-7px;width:20px;height:20px}
 .nt-img-note{font-size:11.5px}
 .insp-edited{display:block;font-size:11px}
</style>
<div id="inspListWrap"></div>
<div id="ntFilePrev" class="task-att-row"></div>
<input type="file" id="ntFiles" accept="image/*" multiple />
<script>
/* --- the few things the app gives these blocks --- */
window.TOASTS = [];
var PNG1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
function toast(m){ TOASTS.push(String(m)) }
function esc(x){ return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") }
var ADM_DEFS = { inspection: { label: "inspection", stateKey: "inspections", fields: [] } };
var ADM_ROWS = {};
function admIdOf(kind, row){ return row.id }
var state = { doer: null, inspections: [] };
/* a picked photo is read and shrunk by this in the app */
function opsCompressImage(f){ return Promise.resolve({ data: PNG1 + "#" + f.name }) }

${BTNS}
${RENDER_FULL}
${PHOTOS}

/* expose what the test drives */
window.renderInspections = renderInspections;
window.ntImagesNow = function(){ return ntImages.slice() };
<\/script>`;

/* a real File, so the change event carries a genuine FileList */
const mkFiles = (names) => names;

let bad = 0;
const ok = (name, cond, got) => { if (!cond) bad++; console.log((cond ? "ok   " : "FAIL ") + name + (got ? "   [" + got + "]" : "")); };

(async () => {
  const br = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await br.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  await page.setContent(PAGE, { waitUntil: "load" });

  const rows = [
    { id: "I1", visit_at: new Date(Date.now() + 5 * 86400000).toISOString(), visitor_name: "Kashish", buyer_name: "VCNY", reason: "Final inspection", created_by: "KASHISH" },
    { id: "I2", visit_at: new Date(Date.now() + 6 * 86400000).toISOString(), visitor_name: "Prince", buyer_name: "Flair", reason: "Mid inspection", created_by: "GAURAV", edited_by: "ASHOK - Merchant", edited_at: new Date().toISOString() },
  ];

  /* ---------- 1. an ordinary person (not an admin) ---------- */
  const r1 = await page.evaluate((rws) => {
    state.doer = { doc_id: "ashok_merchant", is_admin: false };
    state.inspections = rws;
    renderInspections();
    const w = document.getElementById("inspListWrap");
    return {
      edits: w.querySelectorAll(".adm-edit").length,
      dels: w.querySelectorAll(".adm-del").length,
      headers: Array.prototype.map.call(w.querySelectorAll("th"), (t) => t.textContent),
      cellsPerRow: w.querySelector("tbody tr").querySelectorAll("td").length,
      editTitle: (w.querySelector(".adm-edit") || {}).title || "",
      editedNote: (w.querySelector(".insp-edited") || {}).textContent || "",
      notes: w.querySelectorAll(".insp-edited").length,
      kinds: Array.prototype.map.call(w.querySelectorAll(".adm-edit"), (b) => b.dataset.kind + ":" + b.dataset.id),
    };
  }, rows);
  ok("a non-admin gets an Edit button on every inspection", r1.edits === 2, "found " + r1.edits);
  ok("a non-admin gets NO Delete button", r1.dels === 0, "found " + r1.dels);
  ok("the button column has a header, so the table lines up", r1.headers.length === 7 && r1.headers[6] === "", r1.headers.join("|"));
  ok("every row has the same number of cells as the header", r1.cellsPerRow === 7, "cells " + r1.cellsPerRow);
  ok("the Edit button explains itself", /fix the details or the date/i.test(r1.editTitle), r1.editTitle);
  ok("the Edit button carries the right record (newest visit first)", r1.kinds.join(",") === "inspection:I2,inspection:I1", r1.kinds.join(","));
  ok("an edited inspection shows who corrected it", r1.notes === 1 && /edited by ASHOK/i.test(r1.editedNote), r1.editedNote);
  ok("an untouched inspection shows no such note", r1.notes === 1, "notes " + r1.notes);

  /* ---------- 2. an admin still gets both ---------- */
  const r2 = await page.evaluate(() => {
    state.doer = { doc_id: "vinay", is_admin: true };
    renderInspections();
    const w = document.getElementById("inspListWrap");
    return { edits: w.querySelectorAll(".adm-edit").length, dels: w.querySelectorAll(".adm-del").length,
             title: (w.querySelector(".adm-edit") || {}).title || "" };
  });
  ok("an admin still gets Edit on every inspection", r2.edits === 2, "found " + r2.edits);
  ok("an admin still gets Delete", r2.dels === 2, "found " + r2.dels);
  ok("the admin keeps its own wording", /admin/i.test(r2.title), r2.title);

  /* ---------- 3. nothing at all before sign-in ---------- */
  const r3 = await page.evaluate(() => {
    state.doer = null;
    const w = document.getElementById("inspListWrap");
    w.innerHTML = "";
    try { renderInspections(); } catch (e) { return { threw: e.message, html: w.innerHTML }; }
    return { threw: "", html: w.innerHTML };
  });
  ok("it does not fall over when nobody is signed in", !r3.threw && r3.html === "", r3.threw || "drew nothing");

  /* ---------- 4. the photos: add, cross off, and the cap of three ---------- */
  const pick = async (names) => page.evaluate((ns) => {
    const inp = document.getElementById("ntFiles");
    const dt = new DataTransfer();
    ns.forEach((n) => dt.items.add(new File([new Uint8Array([1, 2, 3])], n, { type: "image/png" })));
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change"));
    return new Promise((r) => setTimeout(() => r({
      imgs: window.ntImagesNow().length,
      thumbs: document.querySelectorAll("#ntFilePrev .nt-img").length,
      crosses: document.querySelectorAll("#ntFilePrev .nt-img-x").length,
      note: (document.querySelector(".nt-img-note") || {}).textContent || "",
      inputCleared: inp.value === "",
      toast: window.TOASTS[window.TOASTS.length - 1] || "",
    }), 60));
  }, ns = names);

  const p1 = await pick(["a.png"]);
  ok("picking one photo shows it with a cross", p1.imgs === 1 && p1.thumbs === 1 && p1.crosses === 1, "imgs " + p1.imgs);
  ok("it says how many of the three are used", /1 of 3/.test(p1.note), p1.note);
  ok("the file input is cleared, so the same file can be picked again", p1.inputCleared);

  const p2 = await pick(["b.png"]);
  ok("picking again ADDS instead of replacing", p2.imgs === 2 && p2.thumbs === 2, "imgs " + p2.imgs);

  const p3 = await pick(["c.png", "d.png"]);
  ok("it stops at three", p3.imgs === 3, "imgs " + p3.imgs);
  ok("it says the extra photo was left out", /left out/i.test(p3.toast), p3.toast);
  ok("at three it says that is the most", /that is the most/i.test(p3.note), p3.note);

  const p4 = await pick(["e.png"]);
  ok("picking a fourth is refused with a clear message", p4.imgs === 3 && /take one off first/i.test(p4.toast), p4.toast);

  /* the cross, and that it removes the RIGHT one */
  const x = await page.evaluate(() => {
    const before = window.ntImagesNow();
    document.querySelectorAll("#ntFilePrev .nt-img-x")[1].click();
    const after = window.ntImagesNow();
    return { before, after, thumbs: document.querySelectorAll("#ntFilePrev .nt-img").length,
             note: (document.querySelector(".nt-img-note") || {}).textContent || "" };
  });
  ok("the cross takes a photo off", x.after.length === 2 && x.thumbs === 2, "left " + x.after.length);
  ok("it takes off the one that was clicked, not another", x.after[0] === x.before[0] && x.after[1] === x.before[2],
     x.before.map((s) => s.slice(-5)).join(",") + " -> " + x.after.map((s) => s.slice(-5)).join(","));
  ok("the count follows", /2 of 3/.test(x.note), x.note);

  const x2 = await page.evaluate(() => {
    document.querySelectorAll("#ntFilePrev .nt-img-x").forEach((b) => b.click());
    return { imgs: window.ntImagesNow().length, html: document.getElementById("ntFilePrev").innerHTML };
  });
  ok("taking them all off leaves a clean, empty row", x2.imgs === 0 && x2.html === "", "left " + x2.imgs);

  const p5 = await pick(["f.png", "g.png", "h.png"]);
  ok("after clearing, three can be picked at once again", p5.imgs === 3, "imgs " + p5.imgs);

  await br.close();
  console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "none"));
  console.log((bad ? bad + " CHECK(S) FAILED" : "all " + (0) + " checks passed").replace("all 0 checks", "all checks"));
  process.exit(bad || errs.length ? 1 : 0);
})().catch((e) => { console.error("FAILED " + String(e.message).split("\n")[0]); process.exit(1); });
