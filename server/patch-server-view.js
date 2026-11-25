/* 25 Nov 2026 - patch server/local-server/server.mjs for the Server page.

   What it adds to the office mail server:
     1  it remembers its own last log lines in memory (secrets blanked out)
     2  a read-only "serverStatus" action, only for somebody signed in to
        Rugs Email as role Admin
     3  /health also says which version is running
     4  node:crypto + node:os imports used by the above

   Re-running this patch is safe: every edit is skipped if it is already there.
   Run:  node server/patch-server-view.js
*/
const fs = require("fs");
const file = __dirname + "/local-server/server.mjs";
let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const L = (lines) => lines.join(eol) + eol;
const done = [], skip = [];

function insert(name, marker, anchor, where, text) {
  if (s.includes(marker)) { skip.push(name); return; }
  const i = s.indexOf(anchor);
  if (i < 0) throw new Error("anchor not found for " + name);
  if (s.indexOf(anchor, i + 1) >= 0) throw new Error("anchor is not unique for " + name);
  const at = where === "after" ? i + anchor.length : i;
  s = s.slice(0, at) + text + s.slice(at);
  done.push(name);
}

/* ---- 1. imports ---- */
insert("imports", 'import crypto from "node:crypto"', 'import http from "node:http";', "after",
  eol + 'import crypto from "node:crypto";' + eol + 'import os from "node:os";');

/* ---- 2. the log buffer ---- */
insert("log buffer", "__srvlog:start",
  "const here = path.dirname(fileURLToPath(import.meta.url));", "after", eol + L([
  "",
  "/* ---- 25 Nov 2026: the server remembers its own last log lines   __srvlog:start ----",
  "   The Server page in Rugs Zone / Rugs Email shows them, so nobody has to sit at this PC to",
  "   find out why something was refused. Only what already goes to the screen is kept, and a",
  "   long hex string (a session token hash), a \"Bearer ...\" or a password/token field is blanked",
  "   out before it is kept, so a secret can never reach that page. */",
  "const BOOT_AT = Date.now();",
  "const LOGBUF = [];",
  "const HIDE = [/\\b[0-9a-f]{32,}\\b/gi, /Bearer\\s+[A-Za-z0-9._-]+/gi, /\"b64\"\\s*:\\s*\"[^\"]*\"/gi,",
  "  /\"(token|password|pass|newPassword|oldPassword|cron_key|push_key)\"\\s*:\\s*\"[^\"]*\"/gi];",
  "const scrub = (t) => { let o = String(t); for (const r of HIDE) o = o.replace(r, \"***\"); return o; };",
  "const cut = (t) => t.length > 600 ? t.slice(0, 600) + \" ...\" : t;",
  "function logText(a) {",
  "  return cut(scrub(a.map((x) => typeof x === \"string\" ? x : x instanceof Error ? x.message",
  "    : (() => { try { return JSON.stringify(x); } catch { return String(x); } })()).join(\" \")));",
  "}",
  "function keep(line) { LOGBUF.push(line); if (LOGBUF.length > 900) LOGBUF.splice(0, LOGBUF.length - 900); }",
  "const RAW_LOG = console.log.bind(console), RAW_ERR = console.error.bind(console);",
  "console.log = (...a) => { try { keep(logText(a)); } catch {} RAW_LOG(...a); };",
  "console.error = (...a) => { try { keep(\"ERROR \" + logText(a)); } catch {} RAW_ERR(...a); };",
  "/* __srvlog:end */"]));

/* ---- 3. the request branch ---- */
insert("serverStatus branch", 'pj.action === "serverStatus"',
  "    const res = await H[pick(rq.url, pj)](req);", "before", L([
  "    if (pj.action === \"serverStatus\") {",
  "      const r2 = await serverStatus(pj);",
  "      if (r2.status >= 400) log(\"REFUSED serverStatus ->\", r2.status, String(r2.body.error || \"\"));",
  "      rs.writeHead(r2.status, { ...SRV_CORS, \"content-type\": \"application/json\" });",
  "      return rs.end(JSON.stringify(r2.body));",
  "    }"]));

/* ---- 4. /health says the version ---- */
(function () {
  const old = '    const out = { server: "ok", functions: Object.keys(H),';
  const neu = '    const out = { server: "ok", version: ver(), functions: Object.keys(H),';
  if (s.includes(neu)) { skip.push("health version"); return; }
  if (!s.includes(old)) throw new Error("the /health line was not found");
  s = s.replace(old, neu);
  done.push("health version");
})();

/* ---- 5. the status code itself ---- */
insert("server view block", "__srvview:start",
  "/* ---- 23 Nov 2026: the server keeps itself up to date (no more copying by hand) ---- */", "before", L([
  "/* ---- 25 Nov 2026: what the Server page reads   __srvview:start ----------------------",
  "   Read-only, and only for somebody signed in to Rugs Email as role Admin: it is checked with",
  "   the session token the app already holds, hashed the same way rugs-mail hashes it (sha256).",
  "   Nothing in here can change anything - it only reports. */",
  "const SRV_CORS = { \"access-control-allow-origin\": \"*\", \"access-control-allow-headers\": \"authorization, x-client-info, apikey, content-type\", \"access-control-allow-methods\": \"POST, OPTIONS\" };",
  "const ver = () => { try { return myVer() || \"(none)\"; } catch { return \"?\"; } };",
  "async function adminOf(token) {",
  "  if (!token) return null;",
  "  const h = crypto.createHash(\"sha256\").update(String(token)).digest(\"hex\");",
  "  const r = await pool.query(`select u.id, u.name, u.role from public.rm_sessions s",
  "       join public.rm_users u on u.id = s.user_id",
  "      where s.token_hash = $1 and s.expires_at > now() and u.active`, [h]);",
  "  const u = r.rows[0];",
  "  return u && u.role === \"Admin\" ? u : null;",
  "}",
  "/* the log file the runner writes (run-service.bat). It holds the history across restarts,",
  "   so it is preferred over what this run happens to remember. */",
  "function logFileTail(n) {",
  "  try {",
  "    const full = path.join(here, \"server-log.txt\"), st = fs.statSync(full);",
  "    const want = Math.min(st.size, 400000);",
  "    const fd = fs.openSync(full, \"r\"), buf = Buffer.alloc(want);",
  "    fs.readSync(fd, buf, 0, want, st.size - want); fs.closeSync(fd);",
  "    let lines = buf.toString(\"utf8\").split(/\\r?\\n/).filter((x) => x.trim());",
  "    if (st.size > want && lines.length) lines = lines.slice(1);   // a half line at the start",
  "    return { from: \"server-log.txt\", size_kb: Math.round(st.size / 1024),",
  "      lines: lines.slice(-n).map((x) => cut(scrub(x))) };",
  "  } catch { return null; }",
  "}",
  "async function serverStatus(p) {",
  "  const me = await adminOf(p.token);",
  "  if (!me) return { status: 403, body: { error: \"Only a Rugs Email admin can open the Server page.\" } };",
  "  const n = Math.max(20, Math.min(Number(p.lines) || 200, 900));",
  "  const out = {",
  "    ok: true, asked_by: me.name, version: ver(), node: process.version, host: os.hostname(),",
  "    started_at: new Date(BOOT_AT).toISOString(), up_seconds: Math.round((Date.now() - BOOT_AT) / 1000),",
  "    memory_mb: Math.round(process.memoryUsage().rss / 1048576), functions: Object.keys(H),",
  "    timers: process.env.DISABLE_TIMERS === \"1\" ? \"off\" : \"on\",",
  "    self_update: process.env.UPDATE_OFF === \"1\" ? \"off\" : \"on\",",
  "    update_from: UPD_BASE, update_every_min: Number(process.env.UPDATE_EVERY || 10), now: Date.now()",
  "  };",
  "  try { const j = JSON.parse(process.env.RUGS_SA_JSON || \"{}\"); out.gmail_key = j.client_email ? \"loaded (\" + j.client_email + \")\" : \"MISSING\"; } catch { out.gmail_key = \"INVALID\"; }",
  "  try {",
  "    const r = await pool.query(`select (select count(*) from public.rm_messages)::int messages,",
  "      (select count(*) from public.rm_threads)::int threads,",
  "      (select count(*) from public.rm_users)::int users,",
  "      (select count(*) from public.rm_users where active)::int active_users,",
  "      (select count(*) from public.rm_mailboxes)::int mailboxes,",
  "      (select count(*) from public.rm_sessions where expires_at > now())::int sessions,",
  "      (select count(*) from public.rm_scheduled where status = 'waiting')::int waiting_mail,",
  "      pg_size_pretty(pg_database_size(current_database())) db_size`);",
  "    out.db = { ok: true, ...r.rows[0] };",
  "  } catch (e) { out.db = { ok: false, error: e.message }; }",
  "  try { out.boxes = (await pool.query(\"select mailbox, status, note, last_sync from public.rm_mailboxes order by mailbox\")).rows; } catch {}",
  "  try {",
  "    out.jobs = (await pool.query(\"select key, value, updated_at from public.rm_settings where key like 'job=_%' escape '=' or key like 'report=_%' escape '=' order by updated_at desc\")).rows",
  "      .map((r) => ({ id: String(r.key).replace(/^(job|report)_/, \"\"), kind: String(r.key).split(\"_\")[0],",
  "        at: r.updated_at, summary: scrub(String((r.value && (r.value.summary || r.value.note)) || \"\")).slice(0, 300) }));",
  "  } catch {}",
  "  const f = logFileTail(n);",
  "  out.log = f ? f.lines : LOGBUF.slice(-n);",
  "  out.log_source = f ? f.from + \" (\" + f.size_kb + \" KB, the whole history)\" : \"this run only - there is no log file on this PC\";",
  "  if (p.find) { const q = String(p.find).toLowerCase(); out.log = out.log.filter((x) => x.toLowerCase().includes(q)); }",
  "  return { status: 200, body: out };",
  "}",
  "/* __srvview:end */",
  ""]));

fs.writeFileSync(file, s);
console.log("patched", file.replace(/\\/g, "/"));
console.log("  applied:      ", done.join(", ") || "(nothing)");
console.log("  already there:", skip.join(", ") || "(none)");
