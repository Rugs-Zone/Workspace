// Rugs Mail local API server: runs the original rugs-mail code (compiled) on Node + local PostgreSQL.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));

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
    const out = { server: "ok", functions: Object.keys(H), timers: process.env.DISABLE_TIMERS === "1" ? "off" : "ON", workspace_link: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "not set (only needed for Create task)" };
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
      const t0 = Date.now();
      await pool.query(`alter table public."${t}" add primary key (${list})`);
      made++; log("key check:", t, "- primary key (" + cols.join(", ") + ") added in", Date.now() - t0, "ms");
    } catch (e) { skipped++; log("key check:", t, "- could not add the key:", e.message); }
  }
  log("key check finished:", made, "added,", skipped, "left alone");
}
setTimeout(() => ensureKeys().catch((e) => log("key check failed:", e.message)), 5000);

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
