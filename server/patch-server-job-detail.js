/* patch-server-job-detail.js - 28 Nov 2026
 *
 * Admin -> Server -> One-time jobs showed only each job's 300-character summary, so the full
 * report a job writes into rm_settings could not be read anywhere. serverStatus (read only,
 * admin only) now takes  job: "<id>"  and returns that job's own mark, report and undo keys in
 * full. Nothing can be changed through it; it is the same admin check as the rest of that page.
 *
 * Run:  node server/patch-server-job-detail.js
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "local-server", "server.mjs");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__jobdetail")) { console.log("already applied - nothing to do"); process.exit(0); }
const A = "  /* __findconv:start 26 Nov 2026: look a conversation up in the live database */";
if (s.indexOf(A) < 0) throw new Error("anchor not found");
const B = `  /* __jobdetail:start 28 Nov 2026: one job's own report, in full, for the admin who asks.
     Read only - it selects three rm_settings rows by key and returns them as they are. */
  if (p.job) {
    const id = String(p.job).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
    try {
      const r = await pool.query(
        "select key, value, updated_at from public.rm_settings where key = any($1::text[])",
        [["job_" + id, "report_" + id, "undo_" + id]]);
      out.job = { id: id, rows: r.rows.map((x) => ({ key: x.key, at: x.updated_at, value: x.value })) };
    } catch (e) { out.job = { id: id, error: String(e.message || e).slice(0, 200) }; }
  }
  /* __jobdetail:end */
`;
s = s.replace(A, B + A);
fs.writeFileSync(F, s);
console.log("ok  serverStatus can now return one job's full report");
