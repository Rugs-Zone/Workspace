// server/sbshim.mjs
import pg from "pg";
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(1114, (v) => (/* @__PURE__ */ new Date(v + "Z")).toISOString());
pg.types.setTypeParser(1082, (v) => v);
var pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

// 23 Nov 2026: PostgREST-style upsert support (see patch-shim-upsert.mjs)
var RM_KEYS = { rm_users: ["id"], rm_departments: ["id"], rm_settings: ["key"], rm_mailboxes: ["mailbox"], rm_messages: ["mailbox", "gmail_id"], rm_threads: ["mailbox", "gmail_thread_id"], rm_presence: ["mailbox", "gmail_thread_id", "user_id"], rm_drive_folders: ["mailbox", "key"], rm_sessions: ["token_hash"], rm_login_attempts: ["login"], rm_activity: ["id"], rm_scheduled: ["id"] };
var rmPkCache = /* @__PURE__ */ new Map();
async function rmPkOf(table) {
  if (!rmPkCache.has(table)) {
    const r = await pool.query("select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum = any(i.indkey) where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisprimary", [table]);
    let cols = r.rows.map((x) => x.attname);
    if (!cols.length && RM_KEYS[table]) { cols = RM_KEYS[table].slice(); console.log(new Date().toISOString(), "shim: " + table + " has no primary key here - using the built-in key (" + cols.join(", ") + ")"); }
    rmPkCache.set(table, cols);
  }
  return rmPkCache.get(table);
}
var rmUqCache = /* @__PURE__ */ new Map();
async function rmHasUnique(table, cols) {
  const k = table + "|" + cols.slice().sort().join(",");
  if (!rmUqCache.has(k)) {
    const r = await pool.query("select array_agg(a.attname::text order by a.attname) as cols from pg_index i join lateral unnest(i.indkey) u(att) on true join pg_attribute a on a.attrelid = i.indrelid and a.attnum = u.att where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisunique and i.indpred is null group by i.indexrelid", [table]);
    const want = cols.slice().sort().join(",");
    rmUqCache.set(k, r.rows.some((x) => (x.cols || []).join(",") === want));
  }
  return rmUqCache.get(k);
}
// no unique index for these columns: update the row, and insert it only if there was none
async function rmUpsertByHand(self, T, rows, oc) {
  const out = [];
  for (const row of rows) {
    const wp = oc.map((k) => self._val(k, row[k]));
    const where = oc.map((k, i) => q(k) + " = $" + (i + 1)).join(" and ");
    const rest = Object.keys(row).filter((k) => !oc.includes(k));
    let hit = false;
    if (rest.length && !self.uo.ignoreDuplicates) {
      const p = wp.slice();
      const sets = rest.map((k) => { p.push(self._val(k, row[k])); return q(k) + " = $" + p.length; });
      const u = await pool.query("update " + T + " set " + sets.join(", ") + " where " + where + (self.ret ? " returning " + selList(self.cols) : ""), p);
      if (u.rowCount) { hit = true; if (self.ret && u.rows[0]) out.push(u.rows[0]); }
    } else {
      const e = await pool.query("select 1 from " + T + " where " + where + " limit 1", wp);
      if (e.rowCount) hit = true;
    }
    if (hit) continue;
    const ks = Object.keys(row);
    const p = []; const vals = ks.map((k) => { p.push(row[k] === void 0 ? null : self._val(k, row[k])); return "$" + p.length; });
    try {
      const i = await pool.query("insert into " + T + " (" + ks.map(q).join(", ") + ") values (" + vals.join(", ") + ")" + (self.ret ? " returning " + selList(self.cols) : ""), p);
      if (self.ret && i.rows[0]) out.push(i.rows[0]);
    } catch (e) {
      if (e.code !== "23505") throw e;
      if (rest.length && !self.uo.ignoreDuplicates) {
        const p2 = wp.slice();
        const sets = rest.map((k) => { p2.push(self._val(k, row[k])); return q(k) + " = $" + p2.length; });
        const u2 = await pool.query("update " + T + " set " + sets.join(", ") + " where " + where + (self.ret ? " returning " + selList(self.cols) : ""), p2);
        if (self.ret && u2.rows[0]) out.push(u2.rows[0]);
      }
    }
  }
  return self._fin(self.ret ? out : null);
}

var jsonCols = null;
var fnInfo = null;
async function init() {
  if (jsonCols) return;
  const c = await pool.query("select table_name, column_name from information_schema.columns where table_schema='public' and data_type in ('json','jsonb')");
  jsonCols = new Set(c.rows.map((r) => r.table_name + "." + r.column_name));
  const f = await pool.query("select p.proname, p.proretset, t.typtype, t.typname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype where n.nspname='public'");
  fnInfo = new Map(f.rows.map((r) => [r.proname, { retset: r.proretset, composite: r.typtype === "c" || r.typname === "record" }]));
}
var q = (id) => '"' + String(id).replace(/"/g, '""') + '"';
function colExpr(c) {
  const m = String(c).split(/(->>|->)/);
  let out2 = q(m[0].trim());
  for (let i = 1; i < m.length; i += 2) out2 += m[i] + "'" + m[i + 1].trim().replace(/'/g, "''") + "'";
  return out2;
}
function selList(cols) {
  cols = (cols || "*").trim();
  if (cols === "*") return "*";
  return cols.split(",").map((c) => c.trim()).filter(Boolean).map((c) => c === "*" ? "*" : colExpr(c)).join(", ");
}
var QB = class {
  constructor(table) {
    this.t = table;
    this.op = "select";
    this.cols = "*";
    this.f = [];
    this.ord = [];
    this.lim = null;
    this.off = null;
    this.mode = null;
    this.cnt = false;
    this.head = false;
    this.ret = false;
  }
  select(cols = "*", o = {}) {
    if (this.op === "select") {
      this.cols = cols;
      if (o.count) this.cnt = true;
      if (o.head) this.head = true;
    } else {
      this.ret = true;
      this.cols = cols;
    }
    return this;
  }
  insert(v) {
    this.op = "insert";
    this.vals = v;
    return this;
  }
  update(v) {
    this.op = "update";
    this.vals = v;
    return this;
  }
  upsert(v, o = {}) {
    this.op = "upsert";
    this.vals = v;
    this.uo = o;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  _f(c, op, v) {
    this.f.push([c, op, v]);
    return this;
  }
  eq(c, v) {
    return this._f(c, "=", v);
  }
  neq(c, v) {
    return this._f(c, "<>", v);
  }
  gt(c, v) {
    return this._f(c, ">", v);
  }
  gte(c, v) {
    return this._f(c, ">=", v);
  }
  lt(c, v) {
    return this._f(c, "<", v);
  }
  lte(c, v) {
    return this._f(c, "<=", v);
  }
  like(c, v) {
    return this._f(c, "like", v);
  }
  ilike(c, v) {
    return this._f(c, "ilike", v);
  }
  in(c, v) {
    return this._f(c, "in", v);
  }
  is(c, v) {
    return this._f(c, v === null ? "isnull" : "is", v);
  }
  not(c, op, v) {
    return this._f(c, "not " + op, v);
  }
  filter(c, op, v) {
    return this._f(c, op, v);
  }
  match(o) {
    for (const k in o) this.eq(k, o[k]);
    return this;
  }
  order(c, o = {}) {
    this.ord.push(colExpr(c) + (o.ascending === false ? " desc" : " asc") + (o.nullsFirst === true ? " nulls first" : o.nullsFirst === false ? " nulls last" : ""));
    return this;
  }
  limit(n) {
    this.lim = n;
    return this;
  }
  range(a, b) {
    this.off = a;
    this.lim = b - a + 1;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  then(res, rej) {
    return this._run().then(res, rej);
  }
  _where(params) {
    if (!this.f.length) return "";
    const parts = this.f.map(([c, op, v]) => {
      const e = colExpr(c);
      let neg = false;
      if (op.startsWith("not ")) {
        neg = true;
        op = op.slice(4);
      }
      let s;
      if (op === "isnull" || op === "is" && v === null) s = e + " is null";
      else if (op === "is") {
        s = e + " is " + (v === true ? "true" : v === false ? "false" : "null");
      } else if (op === "in") {
        if (typeof v === "string") v = v.replace(/^\(|\)$/g, "").split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
        params.push(v);
        s = e + "::text = any($" + params.length + "::text[])";
      } else if (op === "eq" || op === "neq" || op === "gt" || op === "gte" || op === "lt" || op === "lte") {
        params.push(v);
        s = e + " " + { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op] + " $" + params.length;
      } else {
        params.push(v);
        s = e + " " + op + " $" + params.length;
      }
      return neg ? "not (" + s + ")" : s;
    });
    return " where " + parts.join(" and ");
  }
  _val(col, v) {
    return v !== null && v !== void 0 && typeof v === "object" && !(v instanceof Date) && jsonCols.has(this.t + "." + col) ? JSON.stringify(v) : v;
  }
  async _run() {
    try {
      await init();
      const T = "public." + q(this.t), params = [];
      let sql, r;
      if (this.op === "select") {
        const w = this._where(params);
        if (this.head) {
          r = await pool.query("select count(*) as c from " + T + w, params);
          return { data: null, error: null, count: r.rows[0].c * 1 };
        }
        sql = "select " + selList(this.cols) + " from " + T + w + (this.ord.length ? " order by " + this.ord.join(", ") : "") + (this.lim != null ? " limit " + this.lim : "") + (this.off ? " offset " + this.off : "");
        r = await pool.query(sql, params);
        return this._fin(r.rows, this.cnt ? r.rowCount : void 0);
      }
      if (this.op === "delete") {
        sql = "delete from " + T + this._where(params) + (this.ret ? " returning " + selList(this.cols) : "");
        r = await pool.query(sql, params);
        return this._fin(this.ret ? r.rows : null);
      }
      if (this.op === "update") {
        const sets = Object.keys(this.vals).map((k) => {
          params.push(this._val(k, this.vals[k]));
          return q(k) + " = $" + params.length;
        });
        sql = "update " + T + " set " + sets.join(", ") + this._where(params) + (this.ret ? " returning " + selList(this.cols) : "");
        r = await pool.query(sql, params);
        return this._fin(this.ret ? r.rows : null);
      }
      const rows = Array.isArray(this.vals) ? this.vals : [this.vals];
      if (!rows.length) return { data: this.ret ? [] : null, error: null };
      const keys = [...new Set(rows.flatMap((x) => Object.keys(x)))];
      const tuples = rows.map((x) => "(" + keys.map((k) => {
        params.push(x[k] === void 0 ? null : this._val(k, x[k]));
        return "$" + params.length;
      }).join(", ") + ")");
      sql = "insert into " + T + " (" + keys.map(q).join(", ") + ") values " + tuples.join(", ");
      if (this.op === "upsert") {
        let oc = (this.uo.onConflict || "").split(",").map((s) => s.trim()).filter(Boolean);
        if (!oc.length) oc = await rmPkOf(this.t);
        if (!oc.length) throw new Error("upsert without onConflict is not supported by the shim");
        if (!(await rmHasUnique(this.t, oc))) return await rmUpsertByHand(this, T, rows, oc);
        const upd = keys.filter((k) => !oc.includes(k));
        sql += " on conflict (" + oc.map(q).join(", ") + ")" + (this.uo.ignoreDuplicates || !upd.length ? " do nothing" : " do update set " + upd.map((k) => q(k) + " = excluded." + q(k)).join(", "));
      }
      if (this.ret) sql += " returning " + selList(this.cols);
      r = await pool.query(sql, params);
      return this._fin(this.ret ? r.rows : null);
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code, details: e.detail || null } };
    }
  }
  _fin(rows, count) {
    if (rows === null) return { data: null, error: null };
    if (this.mode === "single") {
      if (rows.length !== 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      return { data: rows[0], error: null };
    }
    if (this.mode === "maybe") {
      if (rows.length > 1) return { data: null, error: { message: "multiple rows returned", code: "PGRST116" } };
      return { data: rows[0] || null, error: null };
    }
    const o = { data: rows, error: null };
    if (count !== void 0) o.count = count;
    return o;
  }
};
var RPC = class {
  constructor(fn, args) {
    this.fn = fn;
    this.args = args || {};
  }
  then(res, rej) {
    return this._run().then(res, rej);
  }
  async _run() {
    try {
      await init();
      const names = Object.keys(this.args), params = names.map((k) => {
        const v = this.args[k];
        return v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) ? JSON.stringify(v) : v;
      });
      const call = "public." + q(this.fn) + "(" + names.map((k, i) => q(k) + " => $" + (i + 1)).join(", ") + ")";
      const info = fnInfo.get(this.fn) || { retset: false, composite: false };
      let r;
      if (info.retset || info.composite) {
        r = await pool.query("select * from " + call, params);
        return { data: info.retset ? r.rows : r.rows[0] || null, error: null };
      }
      r = await pool.query("select " + call + " as r", params);
      return { data: r.rows[0] ? r.rows[0].r : null, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code } };
    }
  }
};
var remote = null;
async function getRemote() {
  if (remote !== null) return remote;
  remote = false;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const m = await import("@supabase/supabase-js");
    remote = m.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return remote;
}
function remoteQB(table) {
  const calls = [];
  const run = async () => {
    const r = await getRemote();
    if (!r) return { data: null, error: { message: "Workspace (Supabase) is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env" } };
    let b = r.from(table);
    for (const [k, a] of calls) b = b[k](...a);
    return await b;
  };
  const proxy = new Proxy({}, { get: (_, k) => k === "then" ? (res, rej) => run().then(res, rej) : (...a) => {
    calls.push([k, a]);
    return proxy;
  } });
  return proxy;
}
var createClient = () => ({ from: (t) => String(t).startsWith("deleg_") ? remoteQB(t) : new QB(t), rpc: (fn, a) => new RPC(fn, a) });

// server/src-list.ts
var sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
var CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
var out = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
var access = (u, deptId) => u.role === "Admin" ? "full" : u.dept_id === deptId ? "full" : (u.access || {})[deptId] || "";
async function tokHash(t) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(t || "")));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function historyDays() {
  const { data } = await sb.from("rm_settings").select("value").eq("key", "history_days").maybeSingle();
  const n = Number(data?.value);
  return n >= 7 && n <= 730 ? n : 60;
}
function driveId(url) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/) || url.match(/docs\.google\.com\/uc\?(?:[^#]*&)?id=([\w-]{20,})/);
  return m ? m[1] : "";
}
async function grab(url) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8e3);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (RugsEmail image fetcher)", "Accept": "image/*,*/*;q=0.5" } });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "").split(";")[0].trim();
    if (!/^image\//i.test(type)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) return null;
    let s = "";
    for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
    return `data:${type};base64,${btoa(s)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json().catch(() => ({}));
    if (!p.token) return out({ error: "Please sign in" }, 401);
    const { data: s } = await sb.from("rm_sessions").select("user_id,expires_at").eq("token_hash", await tokHash(p.token)).maybeSingle();
    if (!s || new Date(s.expires_at) < /* @__PURE__ */ new Date()) return out({ error: "Your session ended. Please sign in again." }, 401);
    const { data: u } = await sb.from("rm_users").select("id,role,dept_id,access,active").eq("id", s.user_id).maybeSingle();
    if (!u || !u.active) return out({ error: "This user is deactivated. Ask the admin." }, 403);
    if (p.action === "img") {
      let url = String(p.url || "").trim();
      if (!/^https?:\/\//i.test(url)) return out({ error: "Not a web picture" }, 400);
      const host = new URL(url).hostname;
      if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host.endsWith(".internal") || host.endsWith(".supabase.co")) return out({ error: "Blocked address" }, 400);
      const id = driveId(url);
      const tries = id ? [`https://lh3.googleusercontent.com/d/${id}=w800`, `https://drive.google.com/uc?export=view&id=${id}`, `https://drive.google.com/thumbnail?id=${id}&sz=w800`] : [url.replace(/^http:\/\//i, "https://"), url];
      for (const t of [...new Set(tries)]) {
        const d = await grab(t);
        if (d) return out({ data: d });
      }
      return out({ error: "Picture not reachable \u2014 it may be private (shared only inside the sender's company)" }, 404);
    }
    const { data: all } = await sb.from("rm_departments").select("id,mailbox");
    const homeOf = new Map((all || []).map((d) => [d.mailbox, d.id]));
    if (p.action === "more") {
      const box = String(p.box || "").toLowerCase();
      const dep = (all || []).find((d) => String(d.mailbox).toLowerCase() === box);
      if (!dep || !access(u, dep.id)) return out({ error: "No access to this mailbox" }, 403);
      const before = new Date(Number(p.before) || Date.now()).toISOString();
      const days = await historyDays();
      const after = new Date(Date.now() - days * 864e5).toISOString();
      const { data: data2, error: error2 } = await sb.rpc("rm_list_box", { p_box: dep.mailbox, p_before: before, p_after: after, p_limit: Math.min(Number(p.limit) || 400, 800) });
      if (error2) return out({ error: "Could not load mail: " + error2.message }, 500);
      return out({ threads: data2?.threads || [], messages: data2?.messages || [], activity: data2?.activity || [], mailboxes: [], now: Date.now(), history_days: days });
    }
    const ds = (all || []).filter((d) => access(u, d.id));
    const boxes = ds.map((d) => d.mailbox), ids = ds.map((d) => d.id);
    const since = p.since ? new Date(Number(p.since) - 5e3).toISOString() : null;
    const { data, error } = await sb.rpc("rm_list", { p_boxes: boxes, p_depts: ids, p_since: since, p_limit: Math.min(Number(p.limit) || 1e3, 2e3) });
    if (error) return out({ error: "Could not load mail: " + error.message }, 500);
    const seen = /* @__PURE__ */ new Set();
    const threads = (data?.threads || []).filter((t) => {
      if (!access(u, t.dept_id || homeOf.get(t.mailbox))) return false;
      seen.add(t.mailbox + "|" + t.gmail_thread_id);
      return true;
    });
    const k = (x) => x.mailbox + "|" + x.gmail_thread_id;
    const { data: mb } = await sb.from("rm_mailboxes").select("mailbox,status,last_sync,note").in("mailbox", boxes);
    return out({ threads, messages: (data?.messages || []).filter((x) => seen.has(k(x))), activity: (data?.activity || []).filter((x) => seen.has(k(x))), mailboxes: mb || [], now: Date.now(), history_days: await historyDays() });
  } catch (e) {
    return out({ error: e.message || "Something went wrong" }, 500);
  }
});
