/* 26 Nov 2026 - manager-first becomes a per-department setting, and designer@ is switched off.

   Two small server changes:

   1  `mgr_first_boxes` joins SHARED_KEYS, so boot sends it to the app (which now reads it
      instead of a list baked into the code) and an Admin can change it. Default: empty,
      i.e. NOBODY is manager-first and every member sees unassigned team mail.

   2  A one-time job sets `rm_settings.mgr_first_boxes` to `[]`, which switches Team
      Designing off. The same setting is what `rm_auto_give` consults on the server, so the
      auto-assign rules start handing designer@ mail to its people again, exactly as they do
      for the merchant teams. The old value is written down first so it can be put back.

   Run:  node server/patch-mgrfirst-setting.js
*/
const fs = require("fs");

/* ---- 1. the app must be told about the setting ---- */
const bundle = __dirname + "/local-server/rugs-mail.bundle.mjs";
let b = fs.readFileSync(bundle, "utf8");
const keysOld = 'var SHARED_KEYS = ["circulars", "folders", "alerts", "templates", "cats", "rules", "blocked", "contacts_extra"];';
if (b.includes('"mgr_first_boxes"')) console.log("bundle: already there");
else {
  if (!b.includes(keysOld)) throw new Error("SHARED_KEYS was not found");
  b = b.replace(keysOld,
    'var SHARED_KEYS = ["circulars", "folders", "alerts", "templates", "cats", "rules", "blocked", "contacts_extra", "mgr_first_boxes"];');
  fs.writeFileSync(bundle, b);
  console.log("bundle: boot now sends mgr_first_boxes to the app (and an admin can change it)");
}

/* ---- 2. the one-time job ---- */
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__mgrfirstoff:start")) { console.log("server.mjs: already there"); process.exit(0); }
const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const L = [
  "/* ---- 26 Nov 2026: manager-first off everywhere   __mgrfirstoff:start ---------------- */",
  "const MGRFIRST_OFF = { id: \"manager-first-off-2026-11-26\" };",
  "async function mgrFirstOffJob(j) {",
  "  const mark = \"job_\" + j.id, undo = \"undo_\" + j.id;",
  "  if ((await pool.query(\"select 1 from public.rm_settings where key = $1\", [mark])).rowCount) return;",
  "  try {",
  "    const cur = (await pool.query(\"select value from public.rm_settings where key = 'mgr_first_boxes'\")).rows[0];",
  "    const was = cur ? cur.value : null;",
  "    await put(pool, undo, { at: new Date().toISOString(), was: was,",
  "      note: \"to put it back: update rm_settings set value = <was> where key = 'mgr_first_boxes'\" });",
  "    await put(pool, \"mgr_first_boxes\", []);",
  "    const summary = \"manager-first switched off everywhere (was \" + JSON.stringify(was) + \"); every member of a team now sees its unassigned mail, and the auto-assign rules hand designer@ mail out again\";",
  "    await put(pool, mark, { at: new Date().toISOString(), ran: true, was: was, summary: summary, undo_key: undo });",
  "    log(\"one-time job\", j.id, \"- done:\", summary);",
  "  } catch (e) { log(\"one-time job\", j.id, \"FAILED, nothing was changed:\", e.message); }",
  "}",
  "if (process.env.ONETIME_OFF !== \"1\") setTimeout(() => mgrFirstOffJob(MGRFIRST_OFF).catch((e) => log(\"one-time job\", MGRFIRST_OFF.id, \"error:\", e.message)), 33000);",
  "/* __mgrfirstoff:end */",
  ""
];
s = s.replace(anchor, L.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("server.mjs: added the one-time job manager-first-off-2026-11-26");
