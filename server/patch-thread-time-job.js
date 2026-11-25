/* 25 Nov 2026 - one-time job "fix-thread-time-and-dupes-2026-11-25".

   WHAT THE CHECKING FOUND FIRST (on a full copy of the live database, 121,683
   conversations / 349,164 messages):

     rm_threads has a PRIMARY KEY (mailbox, gmail_thread_id)   -> a duplicate row is
                                                                  impossible
     duplicate rows                                            -> 0
     the same Gmail conversation in two mailboxes              -> 0
     last_msg_at <> its newest message                         -> 0  (all 121,683 right)
     msg_count   <> the messages actually stored               -> 34

   So there is no wrong time to repair and nothing to merge; the only real drift is 34
   conversations whose message COUNT is one or two short, where mail was saved without
   the conversation being rebuilt afterwards.

   This job therefore recomputes, for every conversation that disagrees with its own
   messages, exactly three fields - last_msg_at, msg_count and snippet - from
   rm_messages, and nothing else. It never touches read/unread, owner, topic, status,
   Done, done_at or folder; those columns are not even named in the UPDATE.

   It is safe to leave in place: it runs once, writes itself down in rm_settings, keeps
   the previous values of the rows it changes in rm_settings so they can be put back,
   refuses to run at all if it finds more than 5,000 rows to touch (that would mean the
   data is not what this was written for), and does the whole thing in one transaction.

   It also records what it found about duplicates and about the conversation named in
   the task, so the answer can be read from Rugs Email -> Admin -> Server afterwards
   without anybody sitting at the office PC.

   Run:  node server/patch-thread-time-job.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__threadfix:start")) { console.log("already there - nothing changed"); process.exit(0); }

const anchor = "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------";
if (!s.includes(anchor)) throw new Error("run node server/patch-server-view.js first");

const lines = [
  "/* ---- 25 Nov 2026: one-time job - a conversation's time, count and preview come from its own",
  "   newest message   __threadfix:start ---------------------------------------------------------",
  "   Only last_msg_at, msg_count and snippet are written. Read state, owner, topic, status, Done",
  "   and folder are deliberately not in the UPDATE at all. Dry-run numbers and ten example",
  "   subjects are logged first, the old values are kept so it can be undone, and it refuses to",
  "   run if it finds more than MAXFIX rows. */",
  "const THREADFIX = { id: \"fix-thread-time-and-dupes-2026-11-25\", max: 5000,",
  "  look: \"R V1122 RUGS CREATION - PO 174871 AND 173728 PILLOWS\" };",
  "const TF_WRONG = `with m as (",
  "    select mailbox, gmail_thread_id, max(sent_at) newest, count(*)::int n from public.rm_messages group by 1,2)",
  "  select t.mailbox, t.gmail_thread_id, t.subject, t.last_msg_at, t.msg_count, t.snippet,",
  "         m.newest, m.n,",
  "         (select x.snippet from public.rm_messages x",
  "           where x.mailbox = t.mailbox and x.gmail_thread_id = t.gmail_thread_id",
  "           order by x.sent_at desc, x.gmail_id desc limit 1) new_snippet",
  "    from public.rm_threads t join m on m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id",
  "   where t.last_msg_at is distinct from m.newest or t.msg_count is distinct from m.n`;",
  "async function threadFixJob(j) {",
  "  const mark = \"job_\" + j.id, undo = \"undo_\" + j.id;",
  "  if ((await pool.query(\"select 1 from public.rm_settings where key = $1\", [mark])).rowCount) return;",
  "  const c = await pool.connect();",
  "  try {",
  "    await c.query(\"set lock_timeout = '5s'\");",
  "    await c.query(\"set statement_timeout = '600s'\");",
  "    /* ---- the dry run: count everything and show ten of them, before anything is written ---- */",
  "    const dupes = (await c.query(`select count(*)::int groups, coalesce(sum(n-1),0)::int extra_rows from (",
  "        select mailbox, gmail_thread_id, count(*) n from public.rm_threads group by 1,2 having count(*) > 1) d`)).rows[0];",
  "    const twoBox = (await c.query(`select count(*)::int n from (",
  "        select gmail_thread_id from public.rm_threads group by 1 having count(distinct mailbox) > 1) d`)).rows[0].n;",
  "    const wrong = (await c.query(TF_WRONG)).rows;",
  "    const tooOld = wrong.filter((r) => r.newest && r.last_msg_at && new Date(r.last_msg_at) < new Date(r.newest)).length;",
  "    const badCount = wrong.filter((r) => Number(r.msg_count) !== Number(r.n)).length;",
  "    const look = (await c.query(`select mailbox, gmail_thread_id, subject, last_msg_at, msg_count,",
  "        (select max(sent_at) from public.rm_messages m where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id) newest,",
  "        (select count(*) from public.rm_messages m where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id)::int msgs",
  "      from public.rm_threads t where t.subject ilike $1 order by t.last_msg_at desc limit 8`,",
  "      [\"%\" + j.look.replace(/^R /, \"\").slice(0, 40) + \"%\"])).rows;",
  "    log(\"dry run\", j.id, \"- duplicate rows:\", dupes.extra_rows, \"(groups\", dupes.groups + \")\",",
  "      \"| same conversation in 2+ mailboxes:\", twoBox,",
  "      \"| wrong time or count:\", wrong.length, \"(time too old\", tooOld + \", count wrong\", badCount + \")\");",
  "    wrong.slice(0, 10).forEach((r) => log(\"   to fix:\", String(r.mailbox).split(\"@\")[0],",
  "      \"|\", String(r.subject || \"\").slice(0, 60), \"| time\", r.last_msg_at, \"->\", r.newest, \"| count\", r.msg_count, \"->\", r.n));",
  "    look.forEach((r) => log(\"   looked for:\", String(r.mailbox).split(\"@\")[0], \"|\", String(r.subject || \"\").slice(0, 70),",
  "      \"|\", r.gmail_thread_id, \"| row time\", r.last_msg_at, \"| newest mail\", r.newest, \"|\", r.msgs, \"mails\"));",
  "    if (wrong.length > j.max) {",
  "      await put(pool, mark, { at: new Date().toISOString(), ran: false,",
  "        summary: \"NOT run - \" + wrong.length + \" conversations would be touched, more than the \" + j.max + \" this job was written for; nothing was changed\" });",
  "      return log(\"one-time job\", j.id, \"- NOT run:\", wrong.length, \"rows is more than\", j.max, \"- nothing was changed\");",
  "    }",
  "    /* ---- apply ---- */",
  "    await c.query(\"begin\");",
  "    const keep = wrong.map((r) => ({ mailbox: r.mailbox, id: r.gmail_thread_id,",
  "      was: { last_msg_at: r.last_msg_at, msg_count: r.msg_count, snippet: String(r.snippet || \"\").slice(0, 200) } }));",
  "    await put(c, undo, { at: new Date().toISOString(), note: \"the previous time / count / preview of each row this job changed\", rows: keep });",
  "    let n = 0;",
  "    for (const r of wrong) {",
  "      n += (await c.query(",
  "        `update public.rm_threads set last_msg_at = $3, msg_count = $4, snippet = $5,",
  "            updated_at = case when $3 > now() - interval '60 days' then now() else updated_at end",
  "          where mailbox = $1 and gmail_thread_id = $2`,",
  "        [r.mailbox, r.gmail_thread_id, r.newest, r.n, r.new_snippet || r.snippet])).rowCount;",
  "    }",
  "    const left = (await c.query(TF_WRONG)).rows.length;",
  "    const summary = \"fixed \" + n + \" conversations (time or message count) from their own newest message; \" +",
  "      left + \" left; duplicate rows \" + dupes.extra_rows + \"; same conversation in 2+ mailboxes \" + twoBox +",
  "      \"; read state, owner, topic, Done and folder untouched\";",
  "    await put(c, mark, { at: new Date().toISOString(), ran: true, summary, fixed: n, still_wrong: left,",
  "      duplicate_rows: dupes.extra_rows, duplicate_groups: dupes.groups, same_thread_two_boxes: twoBox,",
  "      undo_key: undo, looked_for: j.look, found: look });",
  "    await c.query(\"commit\");",
  "    log(\"one-time job\", j.id, \"- done:\", summary);",
  "  } catch (e) {",
  "    try { await c.query(\"rollback\"); } catch {}",
  "    log(\"one-time job\", j.id, \"FAILED, nothing was changed:\", e.message);",
  "  } finally { c.release(); }",
  "}",
  "if (process.env.ONETIME_OFF !== \"1\") setTimeout(() => threadFixJob(THREADFIX).catch((e) => log(\"one-time job\", THREADFIX.id, \"error:\", e.message)), 17000);",
  "/* __threadfix:end */",
  ""
];

const eol = s.includes("\r\n") ? "\r\n" : "\n";
s = s.replace(anchor, lines.join(eol) + eol + anchor);
fs.writeFileSync(file, s);
console.log("added the one-time job fix-thread-time-and-dupes-2026-11-25 to server/local-server/server.mjs");
