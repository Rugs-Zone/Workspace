/* 26 Nov 2026 - tests the SQL of the one-time job fix-aman-mail-2026-11-26 against a real
   Postgres with the real rm_ tables. Everything runs in ONE transaction that is ROLLED BACK,
   so the staging database is not changed. The SQL below is copied verbatim out of
   server/patch-fix-aman-mail.js. */
import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync("C:/Users/team3pr1/Claude/rugs-mail-local/server/.env", "utf8");
const pool = new pg.Pool({ connectionString: (env.match(/DATABASE_URL\s*=\s*(.+)/) || [])[1].trim(), max: 2 });
const c = await pool.connect();
const pass = [], fail = [];
const ck = (n, got, want) => (JSON.stringify(got) === JSON.stringify(want) ? pass : fail)
  .push(n + (JSON.stringify(got) === JSON.stringify(want) ? "" : "   (got " + JSON.stringify(got) + ", wanted " + JSON.stringify(want) + ")"));

const BOX = "teampulse@rugscreation.com", TID = "1a2092d6750c36d5", MID = "1a21297bd1d17233";
const SENT = "2026-11-25T12:04:08Z";

/* ---- the job's own two queries, verbatim ---- */
async function amanState(w) {
  const m = (await c.query("select gmail_id, sent_at, from_email, from_name from public.rm_messages where mailbox=$1 and gmail_id=$2", [w.box, w.mid])).rows[0] || null;
  const t = (await c.query(`select left(subject,70) subject, coalesce(folder,'inbox') folder,
      coalesce(status,'new') status, owner_id, (select u.name from public.rm_users u where u.id=owner_id) owner_name,
      unread, pinned, msg_count, last_msg_at, done_at, prev_folder, coalesce(cats,'[]'::jsonb) cats,
      (coalesce(cats,'[]'::jsonb) ? 'ignored') ignored
      from public.rm_threads where mailbox=$1 and gmail_thread_id=$2`, [w.box, w.tid])).rows[0] || null;
  const n = (await c.query(`select count(*)::int n, max(sent_at) newest,
      (select coalesce(nullif(from_name,''), from_email) from public.rm_messages z
        where z.mailbox=$1 and z.gmail_thread_id=$2 order by sent_at desc limit 1) newest_from
      from public.rm_messages where mailbox=$1 and gmail_thread_id=$2`, [w.box, w.tid])).rows[0];
  const mb = (await c.query("select cursor_s, back_s, status, last_sync, note from public.rm_mailboxes where mailbox=$1", [w.box])).rows[0] || null;
  const behind = mb && mb.cursor_s ? Math.round((Date.now() / 1000 - Number(mb.cursor_s)) / 3600) : null;
  return { message: m, thread: t, stored_messages: n.n, newest_stored: n.newest, row_is_named_after: n.newest_from, mailbox: mb, sync_hours_behind: behind };
}
/* the ordered force, steps (a) to (d), copied out of the patch */
async function force(w, newest) {
  const st = await amanState(w), ownerWas = st.thread.owner_id;
  const out = { was_ignored: null, date_fixed: false, owner_put_back: null };
  if (st.thread.ignored) {
    out.was_ignored = st.thread.cats;
    await c.query("update public.rm_threads set cats = coalesce(cats,'[]'::jsonb) - 'ignored' where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid]);
  }
  out.date_fixed = Date.parse(st.thread.last_msg_at || 0) < Date.parse(newest);
  if (out.date_fixed)
    await c.query("update public.rm_threads set last_msg_at = $3::timestamptz where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid, newest]);
  out.n = (await c.query(
    `update public.rm_threads
        set folder = 'inbox', unread = true, pinned = true,
            status = case when coalesce(status,'new') = 'done' then (case when owner_id is null then 'new' else 'open' end) else coalesce(status,'new') end,
            done_at = case when coalesce(status,'new') = 'done' then null else done_at end,
            prev_folder = null,
            updated_at = now()
      where mailbox = $1 and gmail_thread_id = $2`, [w.box, w.tid])).rowCount;
  const mid2 = (await c.query("select owner_id from public.rm_threads where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid])).rows[0];
  if (mid2 && mid2.owner_id !== ownerWas) {
    await c.query("update public.rm_threads set owner_id = $3 where mailbox=$1 and gmail_thread_id=$2", [w.box, w.tid, ownerWas]);
    out.owner_put_back = { a_rule_had_taken_it: mid2.owner_id, put_back_to: ownerWas };
  }
  return out;
}
const newestOf = (st) => st.newest_stored && Date.parse(st.newest_stored) > Date.parse(SENT) ? st.newest_stored : SENT;

try {
  await c.query("begin");
  const w = { box: BOX, tid: TID, mid: MID };

  /* ============ 1. the state the live database is probably in: the mail is NOT stored, ============
     but the conversation IS (Ashok replied from the app), closed and read. */
  const anyUser = (await c.query("select id, name from public.rm_users where active limit 1")).rows[0];
  await c.query(`insert into public.rm_threads
      (mailbox, gmail_thread_id, subject, msg_count, last_msg_at, has_in, has_out, unread, owner_id, status, folder, done_at, dept_id)
      values ($1,$2,$3,2,'2026-11-25T13:12:00Z',true,true,false,$4,'done','archive','2026-11-25T13:20:00Z',
        (select id from public.rm_departments where mailbox=$1))`,
    [BOX, TID, "R V1122 RUGS CREATION - PO 174871 AND 173728 PILLOWS", anyUser.id]);
  await c.query(`insert into public.rm_messages (mailbox, gmail_id, gmail_thread_id, direction, from_email, from_name, subject, sent_at)
      values ($1,'1a20cd2937698ff7',$2,'in','aman@induskrafts.com','Aman Singh Verma','R V1122 RUGS CREATION','2026-11-24T06:00:00Z'),
             ($1,'ashokreply',$2,'out',$1,'Ashok - Rugs Creation','RE: R V1122','2026-11-25T13:12:00Z')`, [BOX, TID]);

  let st = await amanState(w);
  ck("1 the mail is reported as NOT stored", !!st.message, false);
  ck("1 the conversation IS found", !!st.thread, true);
  ck("1 it reports the folder it is really in", st.thread.folder, "archive");
  ck("1 it reports that it is closed", st.thread.status, "done");
  ck("1 it reports that it is already read", st.thread.unread, false);
  ck("1 it reports the owner by name", st.thread.owner_name, anyUser.name);
  ck("1 it names the sender the row is named after", st.row_is_named_after, "Ashok - Rugs Creation");
  ck("1 it reports how far behind the sync cursor is", typeof st.sync_hours_behind, "number");

  /* ---- the import step: move the cursor to one hour before the mail, then put it back ---- */
  const was = st.mailbox.cursor_s;
  const to = String(Math.floor(Date.parse(SENT) / 1000) - 3600);
  await c.query("update public.rm_mailboxes set cursor_s=$2, status='backfilling', note=$3 where mailbox=$1", [BOX, to, "test"]);
  ck("2 the cursor is moved to one hour before the mail", (await amanState(w)).mailbox.cursor_s, to);
  ck("2 one hour before the mail is 25 Nov 11:04Z", new Date(Number(to) * 1000).toISOString(), "2026-11-25T11:04:08.000Z");
  /* the sync would now move the cursor forward; pretend it reached 25 Nov 20:00 */
  await c.query("update public.rm_mailboxes set cursor_s=$2 where mailbox=$1", [BOX, String(Math.floor(Date.parse("2026-11-25T20:00:00Z") / 1000))]);
  const cur = (await c.query("select cursor_s from public.rm_mailboxes where mailbox=$1", [BOX])).rows[0];
  if (was && Number(was) < Number(to) && Number(cur.cursor_s) > Number(was))
    await c.query("update public.rm_mailboxes set cursor_s=$2 where mailbox=$1", [BOX, was]);
  ck("2 the cursor is put back where the 25 Nov catch-up had reached", (await amanState(w)).mailbox.cursor_s, was);

  /* ---- the mail arrives (what the sync upserts), then the force ---- */
  await c.query(`insert into public.rm_messages (mailbox, gmail_id, gmail_thread_id, direction, from_email, from_name, subject, sent_at)
      values ($1,$2,$3,'in','aman@induskrafts.com','Aman Singh Verma','R V1122 RUGS CREATION - PO 174871 AND 173728 PILLOWS','2026-11-25T12:04:08Z'),
             ($1,'manfred',$3,'in','Manfred.Mui@nourison.com','Manfred Mui','RE: R V1122','2026-11-25T14:51:00Z')`, [BOX, MID, TID]);
  st = await amanState(w);
  ck("3 the mail is now reported as stored", !!st.message, true);
  ck("3 stored with Aman's own name", st.message.from_name, "Aman Singh Verma");
  const f3 = await force(w, newestOf(st));
  ck("3 exactly one row was forced", f3.n, 1);
  ck("3 the date needed correcting and was corrected", f3.date_fixed, true);
  const a = await amanState(w);
  ck("3 it is in the Inbox", a.thread.folder, "inbox");
  ck("3 it is unread", a.thread.unread, true);
  ck("3 it is PINNED, which is what puts it at the top", a.thread.pinned, true);
  ck("3 a closed conversation with an owner is reopened as 'open'", a.thread.status, "open");
  ck("3 done_at is cleared", a.thread.done_at, null);
  ck("3 THE OWNER IS UNCHANGED", a.thread.owner_id, anyUser.id);
  ck("3 the date is NOT faked - it is the true newest mail (Manfred 14:51Z)", new Date(a.thread.last_msg_at).toISOString(), "2026-11-25T14:51:00.000Z");
  ck("3 and the date was never pushed back", Date.parse(a.thread.last_msg_at) >= Date.parse(SENT), true);

  /* the history line */
  await c.query(`insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at) values ($1,$2,null,'n',$3,now())`,
    [BOX, TID, "Put back in the Inbox, marked unread and pinned to the top by the system (fix-aman-mail-2026-11-26)"]);
  ck("4 one history line is written on the conversation",
    (await c.query("select count(*)::int n from public.rm_activity where mailbox=$1 and gmail_thread_id=$2", [BOX, TID])).rows[0].n, 1);

  /* ---- running the force twice must change nothing more ---- */
  const before2 = JSON.stringify((await amanState(w)).thread);
  await force(w, newestOf(await amanState(w)));
  ck("5 running it again leaves the conversation exactly as it was", JSON.stringify((await amanState(w)).thread), before2);

  /* ---- a conversation with NO owner that was closed must come back as 'new', owner still
          null - this is the case where rm_assign_now used to hand it to Ashok ---- */
  await c.query("update public.rm_threads set status='done', owner_id=null, folder='archive', unread=false, pinned=false, last_msg_at='2026-11-24T06:00:00Z' where mailbox=$1 and gmail_thread_id=$2", [BOX, TID]);
  const f6 = await force(w, newestOf(await amanState(w)));
  const b = await amanState(w);
  ck("6 with nobody owning it, a closed conversation comes back as 'new'", b.thread.status, "new");
  ck("6 AND IT IS STILL OWNED BY NOBODY (rm_assign_now defeated)", b.thread.owner_id, null);
  /* no rule even gets a chance here: the date is corrected while the conversation is still
     outside the Inbox and still 'done', which is not the state rm_assign_now acts on */
  ck("6 no rule even ran, because the date is corrected before it is moved to the Inbox", f6.owner_put_back, null);

  /* ---- an OPEN conversation keeps its status (it is not forced to 'new') ---- */
  await c.query("update public.rm_threads set status='open', owner_id=$3 where mailbox=$1 and gmail_thread_id=$2", [BOX, TID, anyUser.id]);
  await force(w, newestOf(await amanState(w)));
  ck("7 an open conversation keeps status 'open'", (await amanState(w)).thread.status, "open");

  /* ---- the case where rm_assign_now REALLY fires: already in the Inbox, open, no owner.
          Correcting the date then runs the four rules, and step (d) must undo whatever they
          did. This is the check that proves "owner unchanged" instead of assuming it. ---- */
  await c.query(`update public.rm_threads set folder='inbox', status='new', owner_id=null, unread=false,
      pinned=false, cats='[]'::jsonb, last_msg_at='2026-11-24T06:00:00Z'
      where mailbox=$1 and gmail_thread_id=$2`, [BOX, TID]);
  const f11 = await force(w, newestOf(await amanState(w)));
  const h = await amanState(w);
  ck("11 with the rules firing, the conversation is still owned by nobody", h.thread.owner_id, null);
  if (f11.owner_put_back)
    ck("11 a rule did take it and step (d) put it back", f11.owner_put_back.put_back_to, null);
  else
    pass.push("11 the rules ran but none of them matched this conversation, so there was nothing to put back");
  ck("11 and it is in the Inbox, unread and pinned", [h.thread.folder, h.thread.unread, h.thread.pinned], ["inbox", true, true]);

  /* ---- an "ignored" conversation must end up in the INBOX, not in Deleted ---- */
  await c.query(`update public.rm_threads set cats='["ignored"]'::jsonb, folder='archive', status='done',
      unread=false, pinned=false, owner_id=$3, last_msg_at='2026-11-24T06:00:00Z'
      where mailbox=$1 and gmail_thread_id=$2`, [BOX, TID, anyUser.id]);
  const f10 = await force(w, newestOf(await amanState(w)));
  const g = await amanState(w);
  ck("10 the job reports that it had been ignored", JSON.stringify(f10.was_ignored), '["ignored"]');
  ck("10 IT IS IN THE INBOX, not pushed to Deleted by rm_ignore_trg", g.thread.folder, "inbox");
  ck("10 and it is unread, not silently marked read", g.thread.unread, true);
  ck("10 the ignored tag is gone, so later mail is not binned either", g.thread.ignored, false);
  /* proof the hazard is real: with 'ignored' left on, raising the date DOES bin it */
  await c.query(`update public.rm_threads set cats='["ignored"]'::jsonb, folder='inbox', last_msg_at='2026-11-24T06:00:00Z' where mailbox=$1 and gmail_thread_id=$2`, [BOX, TID]);
  await c.query("update public.rm_threads set last_msg_at=$3::timestamptz where mailbox=$1 and gmail_thread_id=$2", [BOX, TID, "2026-11-25T14:51:00Z"]);
  ck("10 (proof) leaving 'ignored' on and raising the date really does send it to Deleted",
    (await amanState(w)).thread.folder, "deleted");

  /* ---- the undo really puts it back ---- */
  const bef = { folder: "archive", unread: false, pinned: false, status: "done", done_at: "2026-11-25T13:20:00Z", last_msg_at: "2026-11-25T13:12:00Z" };
  await c.query(`update public.rm_threads set folder=$3, unread=$4, pinned=$5, status=$6, done_at=$7, last_msg_at=$8
      where mailbox=$1 and gmail_thread_id=$2`, [BOX, TID, bef.folder, bef.unread, bef.pinned, bef.status, bef.done_at, bef.last_msg_at]);
  const u = (await amanState(w)).thread;
  ck("8 the undo restores folder, unread, pinned and status exactly",
    [u.folder, u.unread, u.pinned, u.status], ["archive", false, false, "done"]);

  await c.query("rollback");
  ck("9 the staging database is unchanged (rolled back)",
    (await c.query("select count(*)::int n from public.rm_threads where gmail_thread_id=$1", [TID])).rows[0].n, 0);
} catch (e) {
  try { await c.query("rollback"); } catch {}
  fail.push("THREW: " + e.message);
}
c.release(); await pool.end();
console.log("PASS (" + pass.length + ")"); pass.forEach((p) => console.log("  ok  " + p));
if (fail.length) { console.log("\nFAIL (" + fail.length + ")"); fail.forEach((f) => console.log("  XX  " + f)); }
console.log("\n" + (fail.length ? "SOME CHECKS FAILED" : "ALL " + pass.length + " CHECKS PASS"));
process.exit(fail.length ? 1 : 0);
