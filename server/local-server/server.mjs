// Rugs Mail local API server: runs the original rugs-mail code (compiled) on Node + local PostgreSQL.
import fs from "node:fs";
import http from "node:http";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));

/* ---- 25 Nov 2026: the server remembers its own last log lines   __srvlog:start ----
   The Server page in Rugs Zone / Rugs Email shows them, so nobody has to sit at this PC to
   find out why something was refused. Only what already goes to the screen is kept, and a
   long hex string (a session token hash), a "Bearer ..." or a password/token field is blanked
   out before it is kept, so a secret can never reach that page. */
const BOOT_AT = Date.now();
const LOGBUF = [];
const HIDE = [/\b[0-9a-f]{32,}\b/gi, /Bearer\s+[A-Za-z0-9._-]+/gi, /"b64"\s*:\s*"[^"]*"/gi,
  /"(token|password|pass|newPassword|oldPassword|cron_key|push_key)"\s*:\s*"[^"]*"/gi];
const scrub = (t) => { let o = String(t); for (const r of HIDE) o = o.replace(r, "***"); return o; };
const cut = (t) => t.length > 600 ? t.slice(0, 600) + " ..." : t;
function logText(a) {
  return cut(scrub(a.map((x) => typeof x === "string" ? x : x instanceof Error ? x.message
    : (() => { try { return JSON.stringify(x); } catch { return String(x); } })()).join(" ")));
}
function keep(line) { LOGBUF.push(line); if (LOGBUF.length > 900) LOGBUF.splice(0, LOGBUF.length - 900); }
const RAW_LOG = console.log.bind(console), RAW_ERR = console.error.bind(console);
console.log = (...a) => { try { keep(logText(a)); } catch {} RAW_LOG(...a); };
console.error = (...a) => { try { keep("ERROR " + logText(a)); } catch {} RAW_ERR(...a); };
/* __srvlog:end */


// .env (never committed / never pasted in chat)
try { for (const l of fs.readFileSync(path.join(here, ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !l.trim().startsWith("#")) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, ""); } } catch { console.error("No .env file found — copy .env.example to .env and fill it in."); process.exit(1); }
if (!process.env.RUGS_SA_JSON) { try { process.env.RUGS_SA_JSON = JSON.stringify(JSON.parse(fs.readFileSync(path.join(here, "sa.json"), "utf8"))); } catch { console.error("No Gmail key: put sa.json in this folder or set RUGS_SA_JSON in .env"); } }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing in .env"); process.exit(1); }

const H = {}; let loading = "";
globalThis.Deno = { env: { get: (k) => process.env[k] }, serve: (h) => { H[loading] = h; } };
const { pool } = await import("./sbshim.mjs");
for (const [name, file] of [["main", "rugs-mail.bundle.mjs"], ["list", "rugs-mail-list.bundle.mjs"], ["task", "rugs-mail-task.bundle.mjs"], ["switch", "rugs-mail-switch.bundle.mjs"], ["cal", "rugs-mail-cal.bundle.mjs"], ["push", "rugs-mail-push.bundle.mjs"]]) { loading = name; await import("./" + file); if (!H[name]) throw new Error(name + " did not register a handler"); }
const handler = H.main;
// which function does a request belong to? URL last segment first, else by action
const SLUG = { "rugs-mail": "main", "rugs-mail-list": "list", "rugs-mail-task": "task", "rugs-mail-switch": "switch", "rugs-mail-cal": "cal", "rugs-mail-push": "push" };
function pick(url, p) {
  const seg = url.split("?")[0].split("/").filter(Boolean).pop();
  if (SLUG[seg]) return SLUG[seg];
  const a = p && p.action;
  if (a === "events" || a === "invite" || a === "rsvp") return "cal";
  if (a === "watch" || (p && p.message && p.message.data)) return "push";
  if (a === "img" || a === "more") return "list";
  if (a === "taskDoers" || a === "taskCreate") return "task";
  if (a === "oldMailGet" || a === "oldMailSet" || (!a && p && p.id && p.token)) return "switch";
  if (!a && p && p.token) return "list";
  return "main";
}

/* 23 Nov 2026: admin changes are written to the log even when they work, so "who changed what,
   and when" can be answered afterwards. Rare actions only - ordinary mail traffic is not logged. */
const ADMIN_ACTIONS = new Set(["saveOrg", "setPassword", "setPasswords", "deleteUser", "oldMailSet", "emailGoLive"]);
const PORT = Number(process.env.PORT || 8787);
http.createServer(async (rq, rs) => {
  if (rq.method === "GET" && rq.url.startsWith("/health")) {
    const out = { server: "ok", version: ver(), functions: Object.keys(H), timers: process.env.DISABLE_TIMERS === "1" ? "off" : "ON", workspace_link: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "not set (only needed for Create task)" };
    try { const r = await pool.query("select (select count(*) from rm_messages) m, (select count(*) from rm_threads) t, (select count(*) from rm_users) u, (select count(*) from rm_mailboxes) b, (select count(*) from pg_proc where proname = 'rm_list') rm_list_fn"); out.db = r.rows[0]; } catch (e) { out.db = "ERROR: " + e.message; }
    try { const j = JSON.parse(process.env.RUGS_SA_JSON || "{}"); out.gmail_key = j.client_email ? "loaded (" + j.client_email + ")" : "MISSING"; } catch { out.gmail_key = "INVALID JSON"; }
    rs.writeHead(200, { "content-type": "application/json" }); return rs.end(JSON.stringify(out, null, 1));
  }
  let pj = {};
  try {
    const chunks = []; for await (const c of rq) chunks.push(c);
    const body = Buffer.concat(chunks);
    const req = new Request("http://localhost" + rq.url, { method: rq.method, headers: rq.headers, body: ["GET", "HEAD"].includes(rq.method) ? undefined : body });
    try { pj = JSON.parse(body.toString("utf8") || "{}"); } catch {}
    if (pj.action === "serverStatus") {
      const r2 = await serverStatus(pj);
      if (r2.status >= 400) log("REFUSED serverStatus ->", r2.status, String(r2.body.error || ""));
      rs.writeHead(r2.status, { ...SRV_CORS, "content-type": "application/json" });
      return rs.end(JSON.stringify(r2.body));
    }
    const res = await H[pick(rq.url, pj)](req);
    const out = Buffer.from(await res.arrayBuffer());
    /* 23 Nov 2026: a refused request used to leave NOTHING in server-log.txt, which is why
       "the user was not created" could not be looked up afterwards. Only the action name, the
       status and the server's own message are written - never the body, so no password or
       token is ever logged. Admin changes are logged when they succeed too, because they are
       rare and it must be possible to see afterwards what was done and when. */
    if (res.status >= 400) log("REFUSED", pj.action || rq.url, "->", res.status, out.toString("utf8").slice(0, 300));
    else if (ADMIN_ACTIONS.has(pj.action)) log("admin:", pj.action, "ok");
    rs.writeHead(res.status, { ...Object.fromEntries(res.headers), "access-control-allow-private-network": "true" });   // Chrome: public page -> localhost
    rs.end(out);
  } catch (e) { log("CRASHED", pj.action || rq.url, "->", String(e.message || e)); rs.writeHead(500, { "content-type": "application/json" }); rs.end(JSON.stringify({ error: String(e.message || e) })); }
}).listen(PORT, () => console.log(new Date().toISOString(), "rugs-mail local API on port", PORT));

/* ---- timers that replace the pg_cron jobs ---- */
const log = (...a) => console.log(new Date().toISOString(), ...a);
let busy = false;
async function cronCall(action) {
  const k = (await pool.query("select value#>>'{}' as v from public.rm_settings where key='cron_key'")).rows[0]?.v;
  if (!k) return log("cron_key missing in rm_settings");
  const res = await handler(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ action, cron_key: k }) }));
  if (res.status !== 200) log(action, "->", res.status, (await res.text()).slice(0, 200));
}
const sql = (name, text) => async () => { try { await pool.query(text); } catch (e) { log(name, "failed:", e.message); } };
const every = (ms, fn) => setInterval(() => fn().catch((e) => log("timer error", e.message)), ms);
if (process.env.DISABLE_TIMERS === "1") log("timers DISABLED (test mode)");
else {
  every(30000, async () => { if (busy) return; busy = true; try { await cronCall("cron"); } finally { busy = false; } });   // rugs-mail-1min (every 30 s)
  every(60000, sql("rm-alias-assign", "select public.rm_alias_assign(); select public.rm_domain_assign(); select public.rm_name_assign(2,false); select public.rm_trail_assign(2,false); select public.rm_buddy_assign();"));
  every(300000, sql("rm-keyword-topics", "select public.rm_keyword_topics(300, false)"));
  every(300000, sql("rm-ooo-tick", "select public.rm_ooo_tick()"));
  every(600000, sql("rm-sync-recheck", "select public.rm_sync_recheck()"));
}

/* ---- 23 Nov 2026: put back any primary key this database is missing ----
   A pg_dump restored without its constraints leaves tables with no primary key, and then an
   upsert has nothing to match on - that is what killed saving the Admin page on the office
   server ("upsert without onConflict is not supported by the shim"). The shim now copes on its
   own, so this is only to put the database right. It is deliberately timid: a key is added ONLY
   when the columns hold no NULLs and no duplicates, every table is handled on its own, and a
   failure is logged and skipped. Nothing outside the rm_ tables is touched. */
async function ensureKeys() {
  const { KEYS } = await import("./sbshim.mjs");
  let made = 0, skipped = 0;
  for (const [t, cols] of Object.entries(KEYS)) {
    try {
      const ex = await pool.query("select to_regclass('public.' || $1) is not null as there, (select count(*) from pg_index i where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisprimary) as pk", [t]);
      if (!ex.rows[0].there) continue;                 // table not in this database
      if (Number(ex.rows[0].pk) > 0) continue;         // already has one
      const list = cols.map((c) => '"' + c + '"').join(", ");
      const nulls = await pool.query(`select count(*)::int n from public."${t}" where ` + cols.map((c) => `"${c}" is null`).join(" or "));
      if (nulls.rows[0].n) { skipped++; log("key check:", t, "- NOT added,", nulls.rows[0].n, "row(s) have an empty", cols.join("/")); continue; }
      const dup = await pool.query(`select count(*)::int n from (select 1 from public."${t}" group by ${list} having count(*) > 1) d`);
      if (dup.rows[0].n) { skipped++; log("key check:", t, "- NOT added,", dup.rows[0].n, "duplicate value(s) of", cols.join("+")); continue; }
      /* Adding a primary key locks the table while the index is built. On a big table that
         would stop the whole mailbox answering, so a large table is left alone unless somebody
         asks for it, and we never wait more than 3 seconds for the lock. */
      const big = (await pool.query(`select count(*)::int n from (select 1 from public."${t}" limit 60000) z`)).rows[0].n;
      if (big >= 50000 && process.env.KEYREPAIR_BIG !== "1") { skipped++; log("key check:", t, "- NOT added, too big to lock during the day (set KEYREPAIR_BIG=1 to allow it)"); continue; }
      const t0 = Date.now();
      const c = await pool.connect();
      try {
        await c.query("set lock_timeout = '3s'");
        await c.query(`alter table public."${t}" add primary key (${list})`);
        made++; log("key check:", t, "- primary key (" + cols.join(", ") + ") added in", Date.now() - t0, "ms");
      } finally { c.release(); }
    } catch (e) { skipped++; log("key check:", t, "- could not add the key:", e.message); }
  }
  log("key check finished:", made, "added,", skipped, "left alone");
}
if (process.env.KEYREPAIR_OFF === "1") log("key check is OFF (KEYREPAIR_OFF=1)");
else setTimeout(() => ensureKeys().catch((e) => log("key check failed:", e.message)), 5000);

/* ---- 24 Nov 2026: one-time repairs ----------------------------------------------------
   A job here runs ONCE on this database and then never again: it writes itself down in
   rm_settings ("job_<id>"), and the next start sees that and does nothing. Before it changes
   anything it saves the old values in rm_settings ("undo_<id>"), so it can be put back
   exactly. It also refuses to run if the number of conversations it finds is not close to
   what was expected, because that means the data is not what the job was written for.
   Everything happens in ONE transaction, so a crash can never leave it half done.

   reopen-bulk-done-2026-11-16: on 16 Nov between 13:40 and 14:00 UTC (19:10-19:30 IST) 367
   Team Alpha conversations were marked done in one go. In 178 of them the BUYER wrote last and
   nobody had answered, so real work was closed and disappeared from the work lists. Those 178
   are put back to waiting. Nothing else is touched - not the owner, not read/unread, not the
   folder - and the mail itself is never moved or changed. */
const ONETIME = [{
  id: "reopen-bulk-done-2026-11-16",
  box: "teamalpha@rugscreation.com",
  min: 50, max: 400,
  note: "Reopened by system: marked done by mistake on 16 Nov",
  // done threads of that mailbox, closed inside that half hour, still in the Inbox,
  // whose NEWEST message came in (the buyer wrote last and was never answered)
  find: `select t.gmail_thread_id as id, t.status, t.done_at, t.owner_id
           from public.rm_threads t
          where t.mailbox = $1
            and t.status = 'done'
            and t.done_at >= '2026-11-16 13:40:00+00'
            and t.done_at <  '2026-11-16 14:00:00+00'
            and coalesce(t.folder, 'inbox') = 'inbox'
            and (select m.direction from public.rm_messages m
                  where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id
                  order by m.sent_at desc, m.gmail_id desc limit 1) = 'in'
          order by t.gmail_thread_id`
}];

async function oneTimeJob(j) {
  const mark = "job_" + j.id, undo = "undo_" + j.id;
  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;
  const c = await pool.connect();
  try {
    await c.query("set lock_timeout = '5s'");
    await c.query("set statement_timeout = '180s'");
    await c.query("begin");
    const rows = (await c.query(j.find, [j.box])).rows;
    if (rows.length < j.min || rows.length > j.max) {
      await c.query("rollback");
      return log("one-time job", j.id, "- NOT run:", rows.length, "conversations found, expected between", j.min, "and", j.max, "- the data is not what this job was written for, so nothing was changed");
    }
    const ids = rows.map((r) => r.id);
    /* keep the old status and done_at first, so this can be undone exactly */
    const keep = { at: new Date().toISOString(), mailbox: j.box, threads: rows.map((r) => ({ id: r.id, status: r.status, done_at: r.done_at })) };
    await put(c, undo, keep);
    /* the same rule the sync uses when a new mail reopens a closed conversation:
       somebody owns it -> open, nobody owns it -> new (waiting to be given out) */
    const n = (await c.query(
      `update public.rm_threads
          set status = case when owner_id is null then 'new' else 'open' end,
              done_at = null,
              updated_at = now()
        where mailbox = $1 and gmail_thread_id = any($2::text[])`, [j.box, ids])).rowCount;
    await c.query(
      `insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at)
       select $1, x, null, 'reopen', $2, now() from unnest($3::text[]) as x`, [j.box, j.note, ids]);
    await put(c, mark, { at: new Date().toISOString(), reopened: n, undo_key: undo });
    await c.query("commit");
    log("one-time job", j.id, "- done:", n, "conversations put back to waiting; the old values are in rm_settings." + undo);
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    log("one-time job", j.id, "FAILED, nothing was changed:", e.message);
  } finally { c.release(); }
}
/* written this way (delete, then insert) so it also works on a database whose rm_settings
   has lost its primary key - an upsert there has nothing to match on */
async function put(c, key, value) {
  await c.query("delete from public.rm_settings where key = $1", [key]);
  await c.query("insert into public.rm_settings (key, value, updated_at) values ($1, $2::jsonb, now())", [key, JSON.stringify(value)]);
}

/* ---- 24 Nov 2026: dry run, nothing is changed (see server/patch-onetime-inbox-report.js) ---- */
const REPORTS = [{
  id: "restore-inbox-after-reply-2026-11-24",
  parts: [{
    name: "in the Sent folder although somebody sent us mail in them",
    sql: `select t.mailbox, t.gmail_thread_id as id, t.subject, t.last_msg_at,
                  (t.last_msg_at > now() - interval '60 days') as in_window
             from public.rm_threads t
            where coalesce(t.folder, 'inbox') = 'sent'
              and exists (select 1 from public.rm_messages m
                           where m.mailbox = t.mailbox and m.gmail_thread_id = t.gmail_thread_id
                             and (m.direction = 'in' or (m.sent_by is null and lower(coalesce(m.from_email,'')) <> lower(t.mailbox))))
            order by t.last_msg_at desc`
  }, {
    name: "a colleague wrote back but the conversation stayed Done (last 60 days)",
    sql: `select t.mailbox, t.gmail_thread_id as id, t.subject, t.last_msg_at, true as in_window
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
            order by t.last_msg_at desc`
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
if (process.env.ONETIME_OFF === "1") log("one-time repairs are OFF (ONETIME_OFF=1)");
else setTimeout(async () => {
  for (const j of ONETIME) await oneTimeJob(j).catch((e) => log("one-time job", j.id, "error:", e.message));
  for (const j of REPORTS) await oneTimeReportJob(j).catch((e) => log("dry run", j.id, "error:", e.message));
}, 9000);

/* ---- 24 Nov 2026: where "Report a problem" lands ----------------------------------------
   One small table. It is created here rather than by hand, because this server is the only
   thing that can reach the office database. Created once; after that the statement does
   nothing. The admin reads it in Rugs Email -> Admin -> Problems. */
async function reportsTable() {
  try {
    await pool.query(`create table if not exists public.rm_reports (
      id bigserial primary key,
      user_id text,
      mailbox text,
      gmail_thread_id text,
      note text,
      page text,
      build text,
      agent text,
      switched_by text,
      at timestamptz not null default now(),
      done_at timestamptz,
      done_by text)`);
    await pool.query("create index if not exists rm_reports_at on public.rm_reports (at desc)");
  } catch (e) { log("problem reports table:", e.message); }
}
setTimeout(() => reportsTable().catch((e) => log("problem reports table failed:", e.message)), 7000);

/* ---- 24 Nov 2026: the index that makes searching the mail TEXT possible ----------------
   Searching inside the mail text means reading rm_messages.body_text, which Postgres keeps
   out of line (TOAST): on the live data that is a 2.2 GB read and about 10 seconds per
   search - far too slow, and far too heavy for this little server, which is exactly the kind
   of thing that used to make Rugs Email answer "the mail server was busy".

   A trigram index fixes it. Measured on a full copy of the live database (349,164 messages):
   built in 175 seconds, 468 MB on disk, and a search then takes 0.7 s instead of 10 s.

   Until this index exists, rugs-mail-list's "find" action simply does not look inside the
   mail text (it answers "text": false and the app says so) - so nothing breaks either way.

   It is built with CREATE INDEX CONCURRENTLY, which does NOT lock the table: people can read
   and write mail normally the whole time. If it is interrupted it leaves an unusable index
   behind; that is detected and dropped, and the next start tries again. */
async function searchIndex() {
  const mark = "job_search-index-2026-11-24";
  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;
  try {
    const st = fs.statfsSync(here);
    const freeGB = (st.bsize * st.bavail) / 1073741824;
    if (freeGB < 3) return log("search index - NOT built: only", freeGB.toFixed(1), "GB free on this disk (it needs about 0.5 GB, and 3 GB free to be safe)");
  } catch { /* older Node: no disk check, carry on */ }
  const c = await pool.connect();
  try {
    const sz = (await pool.query("select pg_total_relation_size('public.rm_messages') b")).rows[0].b;
    if (Number(sz) > 12 * 1073741824) return log("search index - NOT built: rm_messages is", (Number(sz) / 1073741824).toFixed(1), "GB, bigger than this job was written for");
    /* an unusable leftover from an interrupted build */
    const bad = await pool.query("select c.relname from pg_class c join pg_index i on i.indexrelid = c.oid where c.relname = 'rm_msg_body_trgm' and not i.indisvalid");
    if (bad.rowCount) { await c.query("drop index if exists public.rm_msg_body_trgm"); log("search index - dropped an unfinished index from an earlier try"); }
    await c.query("create extension if not exists pg_trgm");
    const t0 = Date.now();
    await c.query("set lock_timeout = '30s'");
    await c.query("set statement_timeout = 0");                 // a real build takes minutes
    await c.query("set maintenance_work_mem = '256MB'");
    log("search index - building it now (people can keep using their mail; it takes a few minutes)");
    await c.query("create index concurrently if not exists rm_msg_body_trgm on public.rm_messages using gin (body_text gin_trgm_ops)");
    const ok = (await pool.query("select i.indisvalid v from pg_class c join pg_index i on i.indexrelid = c.oid where c.relname = 'rm_msg_body_trgm'")).rows[0];
    if (!ok || !ok.v) throw new Error("the index was built but is not usable");
    const size = (await pool.query("select pg_size_pretty(pg_relation_size('public.rm_msg_body_trgm')) s")).rows[0].s;
    await put(c, mark, { at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), size });
    log("search index - done in", Math.round((Date.now() - t0) / 1000), "s,", size, "- searching the mail text is now fast");
  } catch (e) {
    log("search index - NOT built (searching the mail text stays off, everything else works):", e.message);
    try { await c.query("drop index if exists public.rm_msg_body_trgm"); } catch {}
  } finally { c.release(); }
}
if (process.env.SEARCHINDEX_OFF === "1") log("the search index job is OFF (SEARCHINDEX_OFF=1)");
else setTimeout(() => searchIndex().catch((e) => log("search index error:", e.message)), 60000);

/* ---- 25 Nov 2026: one-time job - same mailbox access as somebody else  __jatinjob:start ----
   Asked for: "Jatin Munjal must see exactly the same mailboxes as Ashok." Access in Rugs
   Email comes from the DEPARTMENT, not from the person (see access() in rugs-mail: Admin, or
   your own department, or an entry in "access"), so this copies the four fields that decide
   it and nothing else. It runs once, saves the old values first, and never touches Ashok. */
const SAME_ACCESS = {
  id: "jatin-munjal-same-access-as-ashok-2026-11-25",
  copyFrom: "Ashok",
  copyTo: "Jatin Munjal",
  fields: ["dept_id", "role", "perm", "access"]
};
const USER_COLS = "id, name, login, dept_id, role, active, perm, access, on_leave, must_change, (pass_hash is not null) as has_password";
async function findPerson(c, name) {
  let r = await c.query("select " + USER_COLS + " from public.rm_users where lower(btrim(name)) = lower(btrim($1))", [name]);
  if (!r.rowCount) r = await c.query("select " + USER_COLS + " from public.rm_users where lower(name) like '%' || lower(btrim($1)) || '%'", [name]);
  return r.rows;
}
/* the same rule the app and rugs-mail use: an Admin sees every mailbox, otherwise your own
   department plus anything shared with you in "access" */
function boxesFor(u, depts) {
  return depts.filter((d) => u.role === "Admin" || u.dept_id === d.id || (u.access || {})[d.id]);
}
async function countsFor(c, u, depts) {
  const ds = boxesFor(u, depts);
  const boxes = ds.map((d) => d.mailbox), ids = ds.map((d) => d.id);
  const out = { mailboxes: boxes, departments: ids };
  if (!boxes.length) { out.note = "no mailbox at all - this person can see nothing"; return out; }
  const j = (await c.query("select public.rm_list($1::text[], $2::text[], null, 2000) j", [boxes, ids])).rows[0].j || {};
  out.rm_list_conversations = (j.threads || []).length;
  const sql = "select count(*) filter (where coalesce(t.folder,'inbox') = 'inbox' and t.has_in)::int inbox,"
    + " count(*) filter (where coalesce(t.folder,'inbox') = 'inbox' and t.has_out and not t.has_in)::int sent_only,"
    + " count(*) filter (where 'merchandiser5@rugscreation.com' = any(t.to_addrs))::int via_merchandiser5,"
    + " count(*) filter (where 'packaging@rugscreation.com' = any(t.to_addrs))::int via_packaging,"
    + " count(*) filter (where t.owner_id = $2)::int owned_by_him,"
    + " count(*) filter (where t.owner_id is null and coalesce(t.status,'') <> 'done')::int waiting_for_an_owner"
    + " from public.rm_threads t where t.mailbox = any($1::text[])";
  const r = (await c.query(sql, [boxes, u.id])).rows[0];
  return { ...out, ...r };
}
async function sameAccessJob(j) {
  const mark = "job_" + j.id, undo = "undo_" + j.id;
  if ((await pool.query("select 1 from public.rm_settings where key = $1", [mark])).rowCount) return;
  const c = await pool.connect();
  try {
    await c.query("set lock_timeout = '5s'");
    await c.query("set statement_timeout = '120s'");
    await c.query("begin");
    const from = await findPerson(c, j.copyFrom), to = await findPerson(c, j.copyTo);
    const names = (rows) => rows.map((r) => r.name + " [" + r.id + (r.active ? "" : ", switched off") + "]").join(", ");
    if (from.length !== 1 || to.length !== 1) {
      await c.query("rollback");
      const why = "NOT run - " + (from.length !== 1
        ? from.length + " people match '" + j.copyFrom + "' (" + (names(from) || "nobody") + ")"
        : to.length + " people match '" + j.copyTo + "' (" + (names(to) || "nobody") + ")")
        + ", so it cannot tell who is meant; nothing was changed";
      await put(pool, mark, { at: new Date().toISOString(), ran: false, summary: why });
      return log("one-time job", j.id, "-", why);
    }
    const A = from[0], J = to[0];
    const depts = (await c.query("select id, name, mailbox from public.rm_departments")).rows;
    const before = await countsFor(c, J, depts), his = await countsFor(c, A, depts);
    const diff = j.fields.filter((f) => JSON.stringify(J[f]) !== JSON.stringify(A[f]));
    if (!diff.length) {
      await c.query("commit");
      const why = "nothing to do - " + J.name + " already has the same dept_id / role / perm / access as "
        + A.name + " (department " + (J.dept_id || "none") + ")";
      await put(pool, mark, { at: new Date().toISOString(), ran: false, summary: why, jatin: before, ashok: his });
      return log("one-time job", j.id, "-", why);
    }
    /* keep the old values first, so this can be undone exactly */
    const old = {}; for (const f of j.fields) old[f] = J[f];
    await put(c, undo, { at: new Date().toISOString(), user_id: J.id, name: J.name, login: J.login, was: old });
    await c.query("insert into public.rm_activity (mailbox, gmail_thread_id, user_id, kind, text, at) values (null, null, $1, 'admin', $2, now())",
      [J.id, "Access copied from " + A.name + " (" + j.id + "). Before: " + JSON.stringify(old)
        + ". Only dept_id, role, perm and access were changed - login, password and signature were not touched."
        + " To undo, see rm_settings." + undo]);
    await c.query("update public.rm_users set dept_id = $2, role = $3, perm = $4, access = $5 where id = $1",
      [J.id, A.dept_id, A.role, A.perm || {}, A.access || {}]);
    /* read him back and check him with the app's own rules */
    const J2 = (await findPerson(c, j.copyTo))[0];
    const after = await countsFor(c, J2, depts);
    const matches = JSON.stringify(after.mailboxes) === JSON.stringify(his.mailboxes)
      && after.rm_list_conversations === his.rm_list_conversations;
    const summary = "copied " + diff.join(", ") + " from " + A.name + " to " + J.name
      + "; mailboxes " + (before.mailboxes.join(",") || "none") + " -> " + (after.mailboxes.join(",") || "none")
      + "; conversations " + (before.rm_list_conversations || 0) + " -> " + after.rm_list_conversations
      + " (" + A.name + " " + his.rm_list_conversations + ")"
      + "; " + (matches ? "the two now match" : "THEY STILL DIFFER - look at the job record");
    await put(c, mark, { at: new Date().toISOString(), ran: true, summary, copied: diff, from: A.name, to: J.name,
      undo_key: undo, jatin_before: before, jatin_after: after, ashok: his, matches });
    await c.query("commit");
    log("one-time job", j.id, "- done:", summary);
    log("   ", J.name, "inbox", after.inbox, "sent-only", after.sent_only, "via merchandiser5", after.via_merchandiser5,
      "via packaging", after.via_packaging, "owns", after.owned_by_him, "waiting for an owner", after.waiting_for_an_owner);
    log("   ", A.name, "inbox", his.inbox, "sent-only", his.sent_only, "via merchandiser5", his.via_merchandiser5,
      "via packaging", his.via_packaging, "owns", his.owned_by_him, "waiting for an owner", his.waiting_for_an_owner);
    log("    NOTE this gives him the same MAILBOX. A mail somebody already owns stays that person's",
      "(the 16 Nov rule), so his list is not identical to " + A.name + "'s until the app's mirror rule is switched on.");
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    log("one-time job", j.id, "FAILED, nothing was changed:", e.message);
  } finally { c.release(); }
}
if (process.env.ONETIME_OFF !== "1") setTimeout(() => sameAccessJob(SAME_ACCESS).catch((e) => log("one-time job", SAME_ACCESS.id, "error:", e.message)), 13000);
/* __jatinjob:end */

/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------
   Read-only, and only for somebody signed in to Rugs Email as role Admin: it is checked with
   the session token the app already holds, hashed the same way rugs-mail hashes it (sha256).
   Nothing in here can change anything - it only reports. */
const SRV_CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const ver = () => { try { return myVer() || "(none)"; } catch { return "?"; } };
async function adminOf(token) {
  if (!token) return null;
  const h = crypto.createHash("sha256").update(String(token)).digest("hex");
  const r = await pool.query(`select u.id, u.name, u.role from public.rm_sessions s
       join public.rm_users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.active`, [h]);
  const u = r.rows[0];
  return u && u.role === "Admin" ? u : null;
}
/* the log file the runner writes (run-service.bat). It holds the history across restarts,
   so it is preferred over what this run happens to remember. */
function logFileTail(n) {
  try {
    const full = path.join(here, "server-log.txt"), st = fs.statSync(full);
    const want = Math.min(st.size, 400000);
    const fd = fs.openSync(full, "r"), buf = Buffer.alloc(want);
    fs.readSync(fd, buf, 0, want, st.size - want); fs.closeSync(fd);
    let lines = buf.toString("utf8").split(/\r?\n/).filter((x) => x.trim());
    if (st.size > want && lines.length) lines = lines.slice(1);   // a half line at the start
    return { from: "server-log.txt", size_kb: Math.round(st.size / 1024),
      lines: lines.slice(-n).map((x) => cut(scrub(x))) };
  } catch { return null; }
}
async function serverStatus(p) {
  const me = await adminOf(p.token);
  if (!me) return { status: 403, body: { error: "Only a Rugs Email admin can open the Server page." } };
  const n = Math.max(20, Math.min(Number(p.lines) || 200, 900));
  const out = {
    ok: true, asked_by: me.name, version: ver(), node: process.version, host: os.hostname(),
    started_at: new Date(BOOT_AT).toISOString(), up_seconds: Math.round((Date.now() - BOOT_AT) / 1000),
    memory_mb: Math.round(process.memoryUsage().rss / 1048576), functions: Object.keys(H),
    timers: process.env.DISABLE_TIMERS === "1" ? "off" : "on",
    self_update: process.env.UPDATE_OFF === "1" ? "off" : "on",
    update_from: UPD_BASE, update_every_min: Number(process.env.UPDATE_EVERY || 10), now: Date.now()
  };
  try { const j = JSON.parse(process.env.RUGS_SA_JSON || "{}"); out.gmail_key = j.client_email ? "loaded (" + j.client_email + ")" : "MISSING"; } catch { out.gmail_key = "INVALID"; }
  try {
    const r = await pool.query(`select (select count(*) from public.rm_messages)::int messages,
      (select count(*) from public.rm_threads)::int threads,
      (select count(*) from public.rm_users)::int users,
      (select count(*) from public.rm_users where active)::int active_users,
      (select count(*) from public.rm_mailboxes)::int mailboxes,
      (select count(*) from public.rm_sessions where expires_at > now())::int sessions,
      (select count(*) from public.rm_scheduled where status = 'waiting')::int waiting_mail,
      pg_size_pretty(pg_database_size(current_database())) db_size`);
    out.db = { ok: true, ...r.rows[0] };
  } catch (e) { out.db = { ok: false, error: e.message }; }
  try { out.boxes = (await pool.query("select mailbox, status, note, last_sync from public.rm_mailboxes order by mailbox")).rows; } catch {}
  try {
    out.jobs = (await pool.query("select key, value, updated_at from public.rm_settings where key like 'job=_%' escape '=' or key like 'report=_%' escape '=' order by updated_at desc")).rows
      .map((r) => ({ id: String(r.key).replace(/^(job|report)_/, ""), kind: String(r.key).split("_")[0],
        at: r.updated_at, summary: scrub(String((r.value && (r.value.summary || r.value.note)) || "")).slice(0, 300) }));
  } catch {}
  const f = logFileTail(n);
  out.log = f ? f.lines : LOGBUF.slice(-n);
  out.log_source = f ? f.from + " (" + f.size_kb + " KB, the whole history)" : "this run only - there is no log file on this PC";
  if (p.find) { const q = String(p.find).toLowerCase(); out.log = out.log.filter((x) => x.toLowerCase().includes(q)); }
  return { status: 200, body: out };
}
/* __srvview:end */

/* ---- 23 Nov 2026: the server keeps itself up to date (no more copying by hand) ---- */
const UPD_BASE = (process.env.UPDATE_BASE || "https://raw.githubusercontent.com/Rugs-Zone/Workspace/main/server/local-server/").replace(/[/]+$/, "") + "/";
const UPD_FILES = ["server.mjs", "sbshim.mjs", "rugs-mail.bundle.mjs", "rugs-mail-list.bundle.mjs", "rugs-mail-task.bundle.mjs", "rugs-mail-switch.bundle.mjs", "rugs-mail-cal.bundle.mjs", "rugs-mail-push.bundle.mjs"];
const verFile = path.join(here, "version.txt");
const myVer = () => { try { return fs.readFileSync(verFile, "utf8").trim(); } catch { return ""; } };
async function selfUpdate() {
  const r = await fetch(UPD_BASE + "version.txt", { cache: "no-store" });
  if (!r.ok) return log("update check: the update address answered", r.status);
  const want = (await r.text()).trim();
  if (!want || want === myVer()) return;
  log("update available:", myVer() || "(none)", "->", want, "- downloading");
  const got = [];
  for (const f of UPD_FILES) {
    const x = await fetch(UPD_BASE + f, { cache: "no-store" });
    if (!x.ok) return log("update stopped -", f, "answered", x.status, "- nothing was changed");
    const txt = await x.text();
    if (txt.length < 2000 || /^\s*</.test(txt)) return log("update stopped -", f, "does not look like code - nothing was changed");
    got.push([f, txt]);
  }
  for (const [f, txt] of got) {
    const p = path.join(here, f);
    try { fs.copyFileSync(p, p + ".bak"); } catch {}
    fs.writeFileSync(p + ".new", txt);
    fs.renameSync(p + ".new", p);
  }
  fs.writeFileSync(verFile, want);
  log("updated to", want, "- restarting now");
  process.exit(0);
}
if (process.env.UPDATE_OFF === "1") log("self-update is OFF (UPDATE_OFF=1)");
else {
  log("self-update ON - checking", UPD_BASE);
  setTimeout(() => selfUpdate().catch((e) => log("update error:", e.message)), 20000);
  every(Number(process.env.UPDATE_EVERY || 10) * 60000, () => selfUpdate().catch((e) => log("update error:", e.message)));
}
