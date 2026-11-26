/* 26 Nov 2026 - the counting fix (app) and the unpin job (server, real Postgres, rolled back).
   Run:  node server/test-counts-and-unpin.mjs
*/
import { createRequire } from "node:module";
import fs from "node:fs";
const SRV = "C:/Users/team3pr1/Claude/rugs-mail-local/server/";
const require = createRequire("file:///" + SRV);
const pg = require("pg");

let pass = 0, fail = 0;
const ck = (n, got, want) => {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(got) + ")"));
  ok ? pass++ : fail++;
};

/* ---------- 1. the counts, from the shipped app ---------- */
console.log("=== the Inbox counts conversations again, not rows ===");
const src = fs.readFileSync(".tmp/email.html", "utf8");
const i = src.indexOf("function convCount(rows,upto){"), j = src.indexOf("function capRows(rows){", i);
if (i < 0 || j < 0) { console.error("convCount not found in the app"); process.exit(1); }
const convCount = new Function(src.slice(i, j) + "; return convCount")();

const convs = [];
for (let c = 0; c < 15000; c++) convs.push({ id: "c" + c, n: 3 + (c % 2) });
const perMail = [];
convs.forEach((c) => { for (let m = 0; m < c.n; m++) perMail.push({ id: c.id, _one: true, _mi: m }); });
const perConv = convs.map((c) => ({ id: c.id }));
console.log("     a Team Pulse-sized Inbox: " + perMail.length.toLocaleString("en-IN") + " rows, " + perConv.length.toLocaleString("en-IN") + " conversations");
ck("the status bar says conversations, not 52,500 rows", convCount(perMail), 15000);
ck("one row per conversation is unchanged", convCount(perConv), 15000);
ck("the footer counts the drawn conversations", convCount(perMail, 350), (g) => g === 100);
ck("an empty list is 0", convCount([]), 0);
ck("a short list is itself", convCount(perMail.slice(0, 7)), (g) => g >= 1 && g <= 7);

/* ---------- 2. the unpin job, against the real tables ---------- */
console.log("\n=== the unpin job touches ONLY the pin ===");
const env = fs.readFileSync(SRV + ".env", "utf8");
const raw = (env.match(/DATABASE_URL\s*=\s*(.+)/) || [])[1].trim();
const u = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+):(\d+)\/(.+)$/);
const pool = new pg.Pool({ user: u[1], password: u[2], host: u[3], port: +u[4], database: u[5], max: 2 });
const c = await pool.connect();
const BOX = "teampulse@rugscreation.com", TID = "zz-unpin-" + Date.now();
try {
  await c.query("begin");
  const owner = (await c.query("select id from public.rm_users where active limit 1")).rows[0].id;
  await c.query("insert into public.rm_mailboxes (mailbox, cursor_s) values ($1,$2) on conflict (mailbox) do nothing", [BOX, "1700000000"]);
  await c.query(
    "insert into public.rm_threads (mailbox, gmail_thread_id, subject, folder, unread, pinned, status, owner_id, msg_count, last_msg_at, has_in, has_out)" +
    " values ($1,$2,'s','inbox',true,true,'open',$3,4,'2026-11-25T14:51:35Z'::timestamptz,true,true)", [BOX, TID, owner]);
  const snap = async () => (await c.query(
    "select folder, unread, pinned, status, owner_id, done_at, last_msg_at, msg_count from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [BOX, TID])).rows[0];
  const before = await snap();
  ck("it starts pinned", before.pinned, true);

  /* the job's own statement, verbatim */
  const r = await c.query(
    "update public.rm_threads set pinned = false, updated_at = now()" +
    " where mailbox = $1 and gmail_thread_id = $2 and pinned is true", [BOX, TID]);
  const after = await snap();
  ck("one conversation was unpinned", r.rowCount, 1);
  ck("the pin is off", after.pinned, false);
  ck("the folder is untouched", after.folder, before.folder);
  ck("unread is untouched", after.unread, before.unread);
  ck("the owner is untouched", after.owner_id, before.owner_id);
  ck("the status is untouched", after.status, before.status);
  ck("done_at is untouched", after.done_at, before.done_at);
  ck("the date is untouched", String(after.last_msg_at), String(before.last_msg_at));
  const again = await c.query("update public.rm_threads set pinned = false, updated_at = now() where mailbox=$1 and gmail_thread_id=$2 and pinned is true", [BOX, TID]);
  ck("running it again does nothing (it is safe to repeat)", again.rowCount, 0);
  await c.query("rollback");
  console.log("     (transaction rolled back - the staging database was not changed)");
} catch (e) {
  try { await c.query("rollback"); } catch {}
  console.error("TEST ERROR: " + e.message); fail++;
}
c.release(); await pool.end();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
