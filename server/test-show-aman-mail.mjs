/* 26 Nov 2026 - tests the one-time job show-aman-mail-2026-11-26b against a real Postgres with
   the real rm_ tables AND the real triggers. Everything runs in ONE transaction that is
   ROLLED BACK, so the staging database is not changed. The SQL below is copied verbatim out
   of server/patch-show-aman-mail.js.

   Run from anywhere:  node server/test-show-aman-mail.mjs
*/
import { createRequire } from "node:module";
import fs from "node:fs";
const SRV = "C:/Users/team3pr1/Claude/rugs-mail-local/server/";
const require = createRequire("file:///" + SRV);
const pg = require("pg");

const env = fs.readFileSync(SRV + ".env", "utf8");
const raw = (env.match(/DATABASE_URL\s*=\s*(.+)/) || [])[1].trim();
const u = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+):(\d+)\/(.+)$/);
if (!u) { console.error("cannot parse DATABASE_URL"); process.exit(1); }
const pool = new pg.Pool({ user: u[1], password: u[2], host: u[3], port: +u[4], database: u[5], max: 2 });
const c = await pool.connect();

let pass = 0, fail = 0;
const ck = (n, got, want) => {
  const ok = typeof want === "function" ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : "   (got " + JSON.stringify(got) + ")"));
  ok ? pass++ : fail++;
};

/* the job's own identifiers */
const J = {
  rfc: "<01c401dd7cd5$139df460$3ad9dd20$@induskrafts.com>",
  from_email: "aman@induskrafts.com",
  sent_at: "2026-11-25T12:04:08Z"
};
const BOX = "teampulse@rugscreation.com";
const TID = "zz-test-" + Date.now();          /* a test conversation, never a real one */
const MID = "zz-msg-aman-" + Date.now();

/* ---------- the job's queries, verbatim ---------- */
async function amanFind(box, mid) {
  const r = await c.query(
    "select mailbox, gmail_id, gmail_thread_id, sent_at, from_name, from_email, left(subject,90) subject" +
    "  from public.rm_messages" +
    " where mailbox = $1" +
    "   and (gmail_id = $2 or rfc_message_id = $3" +
    "        or (lower(from_email) = $4" +
    "            and sent_at between $5::timestamptz - interval '5 minutes'" +
    "                            and $5::timestamptz + interval '5 minutes'))" +
    " order by sent_at desc limit 1", [box, mid, J.rfc, J.from_email, J.sent_at]);
  return r.rows[0] || null;
}
async function amanThread(box, tid) {
  const t = (await c.query(
    "select left(subject,90) subject, coalesce(folder,'inbox') folder," +
    "       coalesce(status,'new') status, owner_id, unread, pinned, msg_count," +
    "       last_msg_at, done_at, prev_folder, coalesce(cats,'[]'::jsonb) cats," +
    "       (coalesce(cats,'[]'::jsonb) ? 'ignored') ignored," +
    "       (select u.name from public.rm_users u where u.id = owner_id) owner_name" +
    "  from public.rm_threads where mailbox = $1 and gmail_thread_id = $2", [box, tid])).rows[0] || null;
  if (!t) return null;
  const n = (await c.query(
    "select count(*)::int n, max(sent_at) newest," +
    "       (select coalesce(nullif(from_name,''), from_email) from public.rm_messages z" +
    "         where z.mailbox = $1 and z.gmail_thread_id = $2 order by sent_at desc limit 1) newest_from" +
    "  from public.rm_messages where mailbox = $1 and gmail_thread_id = $2", [box, tid])).rows[0];
  t.stored_messages = n.n; t.newest_stored = n.newest; t.row_is_named_after = n.newest_from;
  return t;
}
async function force(box, tid) {
  const before = await amanThread(box, tid);
  const ownerWas = before.owner_id;
  const newest = before.newest_stored && Date.parse(before.newest_stored) > Date.parse(J.sent_at) ? before.newest_stored : J.sent_at;
  const B = {};
  if (before.ignored) {
    await c.query("update public.rm_threads set cats = coalesce(cats,'[]'::jsonb) - 'ignored' where mailbox=$1 and gmail_thread_id=$2", [box, tid]);
    B.was_ignored = true;
  }
  B.date_fixed = Date.parse(before.last_msg_at || 0) < Date.parse(newest);
  if (B.date_fixed) await c.query("update public.rm_threads set last_msg_at = $3::timestamptz where mailbox=$1 and gmail_thread_id=$2", [box, tid, newest]);
  await c.query(
    "update public.rm_threads" +
    "   set folder = 'inbox', unread = true, pinned = true," +
    "       status = case when coalesce(status,'new') = 'done' then (case when owner_id is null then 'new' else 'open' end) else coalesce(status,'new') end," +
    "       done_at = case when coalesce(status,'new') = 'done' then null else done_at end," +
    "       prev_folder = null, updated_at = now()" +
    " where mailbox = $1 and gmail_thread_id = $2", [box, tid]);
  const o2 = (await c.query("select owner_id from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [box, tid])).rows[0];
  if (o2 && o2.owner_id !== ownerWas) {
    await c.query("update public.rm_threads set owner_id = $3 where mailbox=$1 and gmail_thread_id=$2", [box, tid, ownerWas]);
    B.owner_put_back = true;
  }
  const after = await amanThread(box, tid);
  B.after = after;
  B.verified = !!(after && after.folder === "inbox" && after.unread && after.pinned);
  B.newest = newest;
  B.ownerWas = ownerWas;
  return B;
}

const msg = (gid, at, from, email, dir, rfc) => c.query(
  "insert into public.rm_messages (mailbox, gmail_id, gmail_thread_id, direction, from_email, from_name," +
  " to_text, subject, snippet, body_text, sent_at, rfc_message_id)" +
  " values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10::timestamptz,$11)",
  [BOX, gid, TID, dir, email, from, BOX, "RE: R V1122 RUGS CREATION - PO 174871 AND 173728 PILLOWS + PO 175033", "x", at, rfc || null]);

try {
  await c.query("begin");

  /* the triggers must really be here, or this test proves nothing */
  const trg = (await c.query("select tgname from pg_trigger t join pg_class k on k.oid=t.tgrelid where k.relname='rm_threads' and not t.tgisinternal")).rows.map(r => r.tgname);
  console.log("=== the real triggers on rm_threads: " + trg.join(", ") + " ===\n");
  ck("rm_assign_now is present (the trigger that could steal the owner)", trg.some(x => /assign/i.test(x)), true);
  ck("rm_ignore_trg is present (the trigger that could bin the mail)", trg.some(x => /ignore/i.test(x)), true);

  const owner = (await c.query("select id from public.rm_users where active limit 1")).rows[0].id;
  await c.query("insert into public.rm_mailboxes (mailbox, cursor_s) values ($1,$2) on conflict (mailbox) do nothing", [BOX, "1700000000"]);

  /* ---------------- the real conversation's shape, hidden the worst way ---------------- */
  console.log("\n=== a conversation hidden every way at once: archived, read, done, ignored ===");
  await msg("zz-m1-" + Date.now(), "2026-11-23T16:11:33Z", "Manfred Mui", "Manfred.Mui@nourison.com", "in");
  await msg(MID, J.sent_at, "Aman Singh Verma", J.from_email, "in", J.rfc);
  await msg("zz-m3-" + Date.now(), "2026-11-25T13:12:24Z", "Ashok \u2013 Rugs Creation", BOX, "out");
  await msg("zz-m4-" + Date.now(), "2026-11-25T14:51:35Z", "Manfred Mui", "Manfred.Mui@nourison.com", "in");
  await c.query(
    "insert into public.rm_threads (mailbox, gmail_thread_id, subject, folder, prev_folder, unread, pinned," +
    " status, done_at, owner_id, msg_count, last_msg_at, cats, has_in, has_out)" +
    " values ($1,$2,$3,'archive','inbox',false,false,'done',now(),$4,4,$5::timestamptz,'[\"ignored\"]'::jsonb,true,true)",
    [BOX, TID, "RE: R V1122 RUGS CREATION + PO 175033", owner, "2026-11-23T16:11:33Z"]);

  /* the finder: three independent ways in */
  ck("found by its Gmail id", (await amanFind(BOX, MID))?.gmail_id, MID);
  ck("found by its RFC Message-Id even with the wrong Gmail id", (await amanFind(BOX, "nope"))?.gmail_id, MID);
  const byTime = await c.query(
    "select gmail_id from public.rm_messages where mailbox=$1 and lower(from_email)=$2" +
    " and sent_at between $3::timestamptz - interval '5 minutes' and $3::timestamptz + interval '5 minutes'",
    [BOX, J.from_email, J.sent_at]);
  ck("found by sender and send time as the last resort", byTime.rows.some(r => r.gmail_id === MID), true);
  ck("a mail that is not there is not invented", await amanFind(BOX, "zz-absent"), (g) => g === null || g.gmail_id === MID);

  /* the force */
  const r1 = await force(BOX, TID);
  ck("it is in the Inbox", r1.after.folder, "inbox");
  ck("it is unread", r1.after.unread, true);
  ck("it is pinned to the top", r1.after.pinned, true);
  ck("it is no longer marked done", r1.after.status, (g) => g !== "done");
  ck("done_at was cleared", r1.after.done_at, null);
  ck("THE OWNER IS UNCHANGED", r1.after.owner_id, r1.ownerWas);
  ck("the \"ignored\" tag is gone", r1.after.ignored, false);
  ck("the date is the newest stored mail, not a faked today", new Date(r1.after.last_msg_at).toISOString(), "2026-11-25T14:51:35.000Z");
  ck("the job calls it verified", r1.verified, true);
  ck("the row is named after the newest sender - the whole reason it was invisible", r1.after.row_is_named_after, "Manfred Mui");
  ck("running it again changes nothing more", (await force(BOX, TID)).after.folder, "inbox");

  /* the hazard, proved the other way round: leave "ignored" on and raise the date */
  console.log("\n=== the hazard the ordering exists to avoid ===");
  await c.query("update public.rm_threads set cats='[\"ignored\"]'::jsonb, folder='inbox' where mailbox=$1 and gmail_thread_id=$2", [BOX, TID]);
  await c.query("update public.rm_threads set last_msg_at = now() where mailbox=$1 and gmail_thread_id=$2", [BOX, TID]);
  const bad = await amanThread(BOX, TID);
  ck("with \"ignored\" left on, raising the date really does bin it", bad.folder, "deleted");

  /* the cursor must never be moved backwards */
  console.log("\n=== the sync cursor is never left behind ===");
  const back = async (was) => {
    const now = (await c.query("select cursor_s from public.rm_mailboxes where mailbox=$1", [BOX])).rows[0];
    const here = now && now.cursor_s ? Number(now.cursor_s) : 0;
    const keep = Math.max(Number(was), here);
    if (keep > here) await c.query("update public.rm_mailboxes set cursor_s=$2 where mailbox=$1", [BOX, String(keep)]);
    return (await c.query("select cursor_s from public.rm_mailboxes where mailbox=$1", [BOX])).rows[0].cursor_s;
  };
  const rewound = String(Math.floor(Date.parse(J.sent_at) / 1000) - 3600);
  /* the normal case by now: the cursor has already moved PAST the mail. "was" must really be
     ahead of the rewind point, or this proves nothing - the first run of this test used a
     2025 timestamp by mistake and was simply asserting the wrong thing. */
  const was = String(Math.floor(Date.now() / 1000));
  ck("the test's own setup: the cursor really is ahead of the rewind point", Number(was) > Number(rewound), true);
  await c.query("update public.rm_mailboxes set cursor_s=$2 where mailbox=$1", [BOX, rewound]);        /* the job rewinds */
  ck("a cursor that was AHEAD is restored (the old job left it behind here)", await back(was), was);
  await c.query("update public.rm_mailboxes set cursor_s=$2 where mailbox=$1", [BOX, rewound]);
  ck("a cursor that has got further is not dragged back", await back("1690000000"), rewound);

  await c.query("rollback");
  console.log("\n(transaction rolled back - the staging database was not changed)");
} catch (e) {
  try { await c.query("rollback"); } catch {}
  console.error("\nTEST ERROR: " + e.message);
  fail++;
}
c.release();
await pool.end();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
