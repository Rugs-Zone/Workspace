/* patch-ignore-archive-server.js - 27 Nov 2026  (bug 8 - rule R13i, the server half)
 *
 * Puts one more one-time job into the office server (server/local-server/server.mjs). It
 * does two things, in one transaction, and writes itself down so it can never run twice:
 *
 *   1  REPLACES the trigger function rm_ignore_trg(). It used to send every later mail in an
 *      ignored conversation straight to Deleted, for ever and for the whole team. It now does
 *      the opposite: a NEW INCOMING mail in an ignored conversation puts it back in the INBOX,
 *      takes the "ignored" tag off, reopens it if it had been closed, and writes the Activity
 *      trail line "New mail - back in Inbox". The trigger itself (rm_ignore, BEFORE UPDATE on
 *      rm_threads) is left exactly as it is - only the function it calls changes.
 *   2  moves the conversations that are tagged "ignored" AND sitting in Deleted into ARCHIVE,
 *      keeping the tag. Only the folder is written (plus updated_at, so open browsers refresh):
 *      status, done_at, owner, read/unread, topic and last_msg_at are not even named, and
 *      nothing else in Deleted is looked at.
 *
 * The old function's source and every moved conversation's previous folder are kept in
 * rm_settings.undo_<id>, so both halves can be put back exactly.
 *
 * Run:  node server/patch-ignore-archive-server.js
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "local-server", "server.mjs");
let s = fs.readFileSync(F, "utf8");

const START = "/* ---- 27 Nov 2026: Ignore conversation = Archive   __ignorearchive:start";
const END = "/* __ignorearchive:end */";

const BLOCK = `${START} ------------
   Rule R13i. "Ignore conversation" used to move the conversation to Deleted, and this
   trigger then kept every later mail in it out of the Inbox for ever - the one person-made
   setting that silently hid a whole correspondence from the rest of the team. Now ignoring
   archives it (the app half), and a NEW INCOMING mail brings it back to the Inbox and takes
   the tag off. Everything the job changes is written down first, so it can be undone. */
const IGN_ARCH = { id: "ignore-to-archive-2026-11-27", max: 20000 };
const IGN_FN = \`create or replace function public.rm_ignore_trg() returns trigger
language plpgsql as $fn$
declare last_in boolean;
begin
  /* R13i (27 Nov 2026): a NEW mail in an ignored conversation comes BACK to the Inbox and the
     conversation stops being ignored. Before this it was the other way round: the mail was
     sent to Deleted and the conversation stayed ignored for ever. */
  if coalesce(new.cats, '[]'::jsonb) ? 'ignored'
     and new.last_msg_at is distinct from old.last_msg_at
     and new.last_msg_at > coalesce(old.last_msg_at, '-infinity') then
    /* only mail somebody sent TO this mailbox - the same test the app and the sync use:
       an incoming mail, or a colleague writing from another @rugscreation.com address */
    select (m.direction = 'in'
            or (m.sent_by is null
                and lower(coalesce(m.from_email,'')) <> lower(new.mailbox)
                and lower(coalesce(m.from_email,'')) like '%@rugscreation.com'))
      into last_in
      from public.rm_messages m
     where m.mailbox = new.mailbox and m.gmail_thread_id = new.gmail_thread_id
     order by m.sent_at desc, m.gmail_id desc
     limit 1;
    if coalesce(last_in, true) then
      new.cats := coalesce(new.cats, '[]'::jsonb) - 'ignored';
      new.prev_folder := coalesce(new.folder, 'inbox');
      new.folder := 'inbox';
      if new.status = 'done' then
        new.status := case when new.owner_id is null then 'new' else 'open' end;
        new.done_at := null;
      end if;
      insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at)
        values (new.mailbox, new.gmail_thread_id, null, 'reopen', 'New mail - back in Inbox', now());
    end if;
  end if;
  return new;
end $fn$;\`;
async function ignoreArchiveJob(j) {
  const mark = "job_" + j.id, undo = "undo_" + j.id;
  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;
  const c = await pool.connect();
  try {
    await c.query("set lock_timeout = '5s'");
    await c.query("set statement_timeout = '180s'");
    await c.query("begin");
    /* the old function's own source, so it can be put back word for word */
    const was = (await c.query("select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rm_ignore_trg'")).rows[0];
    /* 2 · the conversations to move: tagged "ignored" and sitting in Deleted */
    const rows = (await c.query(\`select mailbox, gmail_thread_id as id, coalesce(folder,'inbox') folder, subject
                                   from public.rm_threads
                                  where coalesce(cats,'[]'::jsonb) ? 'ignored'
                                    and coalesce(folder,'inbox') = 'deleted'
                                  order by mailbox, gmail_thread_id\`)).rows;
    if (rows.length > j.max) {
      await c.query("rollback");
      return log("one-time job", j.id, "- NOT run:", rows.length, "ignored conversations in Deleted, which is more than this job was written for (" + j.max + "); nothing was changed");
    }
    const per = {};
    rows.forEach((r) => { per[r.mailbox] = (per[r.mailbox] || 0) + 1; });
    await put(c, undo, {
      at: new Date().toISOString(),
      note: "to put it back: run the SQL in old_function, and set folder='deleted' on the conversations in threads",
      old_function: was ? was.def : null,
      threads: rows.map((r) => ({ mailbox: r.mailbox, id: r.id, folder: r.folder }))
    });
    /* 1 · the trigger function - the trigger rm_ignore keeps pointing at it */
    await c.query(IGN_FN);
    /* 2 · folder only. status, done_at, owner, unread, topic and last_msg_at are not touched,
           so rm_assign_now (AFTER UPDATE OF to_addrs, last_msg_at) cannot fire either. */
    let moved = 0;
    for (const r of rows) {
      moved += (await c.query("update public.rm_threads set folder = 'archive', updated_at = now() where mailbox = $1 and gmail_thread_id = $2", [r.mailbox, r.id])).rowCount;
      await c.query("insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at) values ($1, $2, null, 'move', 'Ignored conversation moved from Deleted to Archive (rule R13i)', now())", [r.mailbox, r.id]);
    }
    const summary = "the ignore trigger now brings a conversation BACK to the Inbox on new mail (it used to send every later mail to Deleted), and " + moved + " ignored conversation(s) were moved from Deleted to Archive"
      + (moved ? " (" + Object.keys(per).map((k) => k.split("@")[0] + " " + per[k]).join(", ") + ")" : "");
    await put(c, mark, { at: new Date().toISOString(), moved: moved, per_mailbox: per, trigger_replaced: true, summary: summary, undo_key: undo, samples: rows.slice(0, 10).map((r) => ({ mailbox: r.mailbox, id: r.id, subject: String(r.subject || "").slice(0, 120) })) });
    await c.query("commit");
    log("one-time job", j.id, "- done:", summary);
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    log("one-time job", j.id, "FAILED, nothing was changed:", e.message);
  } finally { c.release(); }
}
if (process.env.ONETIME_OFF !== "1") setTimeout(() => ignoreArchiveJob(IGN_ARCH).catch((e) => log("one-time job", IGN_ARCH.id, "error:", e.message)), 79000);
${END}

`;

const a = s.indexOf(START);
if (a >= 0) {
  const b = s.indexOf(END, a);
  if (b < 0) throw new Error("the old __ignorearchive block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + "\n\n" + s.slice(b + END.length).replace(/^\s*/, "");
  console.log("  replaced the existing block");
} else {
  const anchor = '/* ---- 25 Nov 2026: what the Server page reads   __srvview:start';
  if (s.indexOf(anchor) < 0) throw new Error("the __srvview anchor is not in server.mjs");
  s = s.replace(anchor, BLOCK + anchor);
  console.log("  block inserted before the Server page");
}

fs.writeFileSync(F, s);
console.log("written to " + F);
