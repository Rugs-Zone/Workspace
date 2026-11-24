/* 24 Nov 2026 - the DRY RUN asked for before anything is put back in people's Inboxes.
 *
 * It changes NOTHING. It counts, per mailbox, and keeps ten example subjects of:
 *   (1) conversations sitting in the Sent folder although somebody sent us mail in them
 *       (the shape that would have to be put back if a reply really moved the folder), and
 *   (2) conversations a COLLEAGUE wrote back in that stayed marked Done - the real damage of
 *       the bug fixed today, because a mail from another @rugscreation.com address was never
 *       counted as incoming, so it neither reopened the conversation nor made it unread.
 * The report goes into rm_settings (report_<id>) and into the server log, and the job records
 * itself so it runs once. Putting (2) back is one small update, held back on purpose: it makes
 * mail reappear in people's work lists, so it waits for the word to go ahead.
 *
 *   node server/patch-onetime-inbox-report.js
 */
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, 'local-server', 'server.mjs');
let s = fs.readFileSync(F, 'utf8');
const CRLF = s.indexOf('\r\n') >= 0;
if (CRLF) s = s.split('\r\n').join('\n');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 70));
  s = s.replace(a, b); n++;
};

const RECV = "(m.direction = 'in' or (m.sent_by is null and lower(coalesce(m.from_email,'')) <> lower(t.mailbox)))";

const JOB = `
/* ---- 24 Nov 2026: dry run, nothing is changed (see server/patch-onetime-inbox-report.js) ---- */
const REPORTS = [{
  id: "restore-inbox-after-reply-2026-11-24",
  parts: [{
    name: "in the Sent folder although somebody sent us mail in them",
    sql: \`select t.mailbox, t.gmail_thread_id as id, t.subject, t.last_msg_at,
                  (t.last_msg_at > now() - interval '60 days') as in_window
             from public.rm_threads t
            where coalesce(t.folder, 'inbox') = 'sent'
              and exists (select 1 from public.rm_messages m
                           where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id
                             and ${RECV})
            order by t.last_msg_at desc\`
  }, {
    name: "a colleague wrote back but the conversation stayed Done (last 60 days)",
    sql: \`select t.mailbox, t.gmail_thread_id as id, t.subject, t.last_msg_at, true as in_window
             from public.rm_threads t
            where t.status = 'done' and coalesce(t.folder, 'inbox') = 'inbox'
              and t.last_msg_at > now() - interval '60 days'
              and t.done_at is not null and t.last_msg_at > t.done_at
              and (select m.direction from public.rm_messages m
                    where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id
                    order by m.sent_at desc, m.gmail_id desc limit 1) = 'out'
              and (select (m.sent_by is null and lower(coalesce(m.from_email,'')) <> lower(t.mailbox))
                     from public.rm_messages m
                    where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id
                    order by m.sent_at desc, m.gmail_id desc limit 1)
            order by t.last_msg_at desc\`
  }]
}];

async function oneTimeReportJob(j) {
  const mark = "report_" + j.id;
  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;
  const c = await pool.connect();
  try {
    await c.query("set statement_timeout = '120s'");
    const out = { at: new Date().toISOString(), note: "dry run only - nothing was changed", parts: [] };
    for (const part of j.parts) {
      const rows = (await c.query(part.sql)).rows;
      const per = {};
      rows.forEach((r) => { per[r.mailbox] = (per[r.mailbox] || 0) + 1; });
      const p = {
        what: part.name,
        total: rows.length,
        inside_the_60_day_inbox_window: rows.filter((r) => r.in_window).length,
        older: rows.filter((r) => !r.in_window).length,
        per_mailbox: per,
        samples: rows.slice(0, 10).map((r) => ({ mailbox: r.mailbox, id: r.id, subject: String(r.subject || "").slice(0, 120) })),
        ids: rows.map((r) => r.mailbox + "|" + r.id).slice(0, 5000)
      };
      out.parts.push(p);
      log("dry run", j.id, "-", part.name + ":", p.total, "conversations",
        p.total ? "(" + Object.keys(per).map((k) => k.split("@")[0] + " " + per[k]).join(", ") + ")" : "");
      p.samples.forEach((x) => log("   e.g.", x.mailbox.split("@")[0], x.subject));
    }
    await put(c, mark, out);
    log("dry run", j.id, "- written to rm_settings." + mark + "; NOTHING was changed");
  } catch (e) {
    log("dry run", j.id, "failed (nothing was changed):", e.message);
  } finally { c.release(); }
}
`;

sub(
  'if (process.env.ONETIME_OFF === "1") log("one-time repairs are OFF (ONETIME_OFF=1)");\nelse setTimeout(async () => { for (const j of ONETIME) await oneTimeJob(j).catch((e) => log("one-time job", j.id, "error:", e.message)); }, 9000);',
  JOB.trimEnd() + '\n' +
  'if (process.env.ONETIME_OFF === "1") log("one-time repairs are OFF (ONETIME_OFF=1)");\n' +
  'else setTimeout(async () => {\n' +
  '  for (const j of ONETIME) await oneTimeJob(j).catch((e) => log("one-time job", j.id, "error:", e.message));\n' +
  '  for (const j of REPORTS) await oneTimeReportJob(j).catch((e) => log("dry run", j.id, "error:", e.message));\n' +
  '}, 9000);'
);

if (CRLF) s = s.split('\n').join('\r\n');
fs.writeFileSync(F, s);
console.log('server.mjs patched, ' + n + ' edits');
