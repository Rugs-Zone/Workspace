/* 24 Nov 2026 - Rugs Email: the server side of "Report a problem".
 *
 * Three actions in rugs-mail-list (it already checks the session and who the person is):
 *   report      - anyone signed in: saves one row (note, conversation, mailbox, page, build,
 *                 browser, whether the session was a Switch ID one). At most 20 a day per
 *                 person, so a stuck finger cannot fill the table.
 *   reports     - Admin only: the newest 200, newest first.
 *   reportDone  - Admin only: marks one as handled (who and when).
 *
 * The table is created by server.mjs at start-up (rm_reports). If it is not there yet the
 * report is refused with a sentence that says so, rather than a database error.
 *
 * Re-runnable: it replaces its own block if it is already there.
 */
const fs = require('fs');
const F = 'server/local-server/rugs-mail-list.bundle.mjs';
let s = fs.readFileSync(F, 'utf8');
const nl = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const S0 = '    // __rzreport:start', S1 = '    // __rzreport:end';

const BLOCK = [
S0,
'    /* 24 Nov 2026: "Report a problem" - see server/patch-server-report.js */',
'    if (p.action === "report") {',
'      const note = String(p.note || "").trim().slice(0, 300);',
'      if (note.length < 3) return out({ error: "Please write one line about the problem" }, 400);',
'      try {',
'        const mine = await pool.query("select count(*)::int n from public.rm_reports where user_id = $1 and at > now() - interval \'1 day\'", [u.id]);',
'        if (mine.rows[0].n >= 20) return out({ error: "You have already sent 20 reports today - the admin has them" }, 429);',
'        const r = await pool.query(',
'          "insert into public.rm_reports (user_id, mailbox, gmail_thread_id, note, page, build, agent, switched_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",',
'          [u.id, String(p.box || "").toLowerCase().slice(0, 120) || null, String(p.thread || "").slice(0, 60) || null, note,',
'           String(p.page || "").slice(0, 120), String(p.build || "").slice(0, 40), String(p.agent || "").slice(0, 200), s.switched_by || null]);',
'        return out({ ok: true, id: r.rows[0].id });',
'      } catch (e) {',
'        if (/rm_reports/.test(String(e.message))) return out({ error: "The problem list is not set up on the server yet - tell the admin" }, 500);',
'        return out({ error: "Could not save it: " + e.message }, 500);',
'      }',
'    }',
'    if (p.action === "reports" || p.action === "reportDone") {',
'      if (u.role !== "Admin") return out({ error: "Only an admin can see the problem reports" }, 403);',
'      try {',
'        if (p.action === "reportDone") {',
'          await pool.query("update public.rm_reports set done_at = now(), done_by = $2 where id = $1", [Number(p.id) || 0, u.id]);',
'          return out({ ok: true });',
'        }',
'        const r = await pool.query("select id, user_id, mailbox, gmail_thread_id, note, page, build, agent, switched_by, at, done_at, done_by from public.rm_reports order by (done_at is null) desc, at desc limit $1", [Math.min(Number(p.limit) || 200, 500)]);',
'        return out({ reports: r.rows });',
'      } catch (e) {',
'        if (/rm_reports/.test(String(e.message))) return out({ reports: [] });',
'        return out({ error: "Could not read the problem reports: " + e.message }, 500);',
'      }',
'    }',
S1
].join('\n');

const has = s.indexOf(S0) >= 0;
if (has) {
  const a = s.indexOf(S0), b = s.indexOf(S1) + S1.length;
  s = s.slice(0, a) + BLOCK.replace(/\n/g, nl) + s.slice(b);
  console.log('replaced the existing block');
} else {
  const anchor = '    if (p.action === "find") {';
  if (s.split(anchor).length - 1 !== 1) throw new Error('anchor "find" not found exactly once (run patch-server-search.js first)');
  s = s.replace(anchor, BLOCK.replace(/\n/g, nl) + nl + anchor);
  console.log('block inserted');
}
/* the session row must also carry switched_by, so a report says whether the person was
   working as somebody else at the time */
const SEL0 = 'sb.from("rm_sessions").select("user_id,expires_at")';
if (s.indexOf(SEL0) >= 0) {
  s = s.replace(SEL0, 'sb.from("rm_sessions").select("user_id,expires_at,switched_by")');
  console.log('session select widened');
}
fs.writeFileSync(F, s);
console.log('patch-server-report: done');
