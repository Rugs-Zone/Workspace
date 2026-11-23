// Minimal supabase-js look-alike on top of node-postgres, so the original rugs-mail code runs unchanged.
// Supports only what rugs-mail uses: from().select/insert/update/upsert/delete + eq/neq/gt/gte/lt/lte/in/is/not/ilike/like/filter,
// order/limit/range/single/maybeSingle, count exact/head, and rpc().
import pg from "pg";

// PostgREST-like value types: bigint/numeric -> number, timestamps -> ISO strings, date -> string
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(1114, (v) => new Date(v + "Z").toISOString());
pg.types.setTypeParser(1082, (v) => v);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
export { pool };

let jsonCols = null;   // "table.column" -> true for json/jsonb columns
let fnInfo = null;     // function name -> { retset, scalar }
async function init() {
  if (jsonCols) return;
  const c = await pool.query("select table_name, column_name from information_schema.columns where table_schema='public' and data_type in ('json','jsonb')");
  jsonCols = new Set(c.rows.map((r) => r.table_name + "." + r.column_name));
  const f = await pool.query("select p.proname, p.proretset, t.typtype, t.typname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype where n.nspname='public'");
  fnInfo = new Map(f.rows.map((r) => [r.proname, { retset: r.proretset, composite: r.typtype === "c" || r.typname === "record" }]));
}

const pkCache = new Map();
/* 23 Nov 2026: an upsert with no onConflict uses the table's primary key, the way PostgREST does.
   If the database has lost its primary keys (a pg_dump restored without them - exactly what
   happened on the office server, where saving the Admin page died with "upsert without onConflict
   is not supported by the shim"), fall back to the key the table is MEANT to have. This is the
   same key Supabase has, so a save behaves identically with or without the constraint. */
export const KEYS = {
  rm_users: ["id"],
  rm_departments: ["id"],
  rm_settings: ["key"],
  rm_mailboxes: ["mailbox"],
  rm_messages: ["mailbox", "gmail_id"],
  rm_threads: ["mailbox", "gmail_thread_id"],
  rm_presence: ["mailbox", "gmail_thread_id", "user_id"],
  rm_drive_folders: ["mailbox", "key"],
  rm_sessions: ["token_hash"],
  rm_login_attempts: ["login"],
  rm_activity: ["id"],
  rm_scheduled: ["id"]
};
async function pkOf(table) {
  if (!pkCache.has(table)) {
    const r = await pool.query("select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum = any(i.indkey) where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisprimary", [table]);
    let cols = r.rows.map((x) => x.attname);
    if (!cols.length && KEYS[table]) {
      cols = KEYS[table].slice();
      console.log(new Date().toISOString(), "sbshim: " + table + " has no primary key in this database - using the built-in key (" + cols.join(", ") + ")");
    }
    pkCache.set(table, cols);
  }
  return pkCache.get(table);
}
/* is there a unique index (or primary key) on exactly these columns? "on conflict" needs one. */
const uqCache = new Map();
async function hasUnique(table, cols) {
  const k = table + "|" + cols.slice().sort().join(",");
  if (!uqCache.has(k)) {
    const r = await pool.query(
      "select array_agg(a.attname::text order by a.attname) as cols from pg_index i" +
      " join lateral unnest(i.indkey) u(att) on true" +
      " join pg_attribute a on a.attrelid = i.indrelid and a.attnum = u.att" +
      " where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisunique and i.indpred is null" +
      " group by i.indexrelid", [table]);
    const want = cols.slice().sort().join(",");
    uqCache.set(k, r.rows.some((x) => (x.cols || []).join(",") === want));
  }
  return uqCache.get(k);
}
const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';
// "col", "prefs->ooo", "prefs->>ooo"  ->  SQL expression
function colExpr(c) {
  const m = String(c).split(/(->>|->)/);
  let out = q(m[0].trim());
  for (let i = 1; i < m.length; i += 2) out += m[i] + "'" + m[i + 1].trim().replace(/'/g, "''") + "'";
  return out;
}
function selList(cols) {
  cols = (cols || "*").trim();
  if (cols === "*") return "*";
  return cols.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (c === "*" ? "*" : colExpr(c))).join(", ");
}

class QB {
  constructor(table) { this.t = table; this.op = "select"; this.cols = "*"; this.f = []; this.ord = []; this.lim = null; this.off = null; this.mode = null; this.cnt = false; this.head = false; this.ret = false; }
  select(cols = "*", o = {}) { if (this.op === "select") { this.cols = cols; if (o.count) this.cnt = true; if (o.head) this.head = true; } else { this.ret = true; this.cols = cols; } return this; }
  insert(v) { this.op = "insert"; this.vals = v; return this; }
  update(v) { this.op = "update"; this.vals = v; return this; }
  upsert(v, o = {}) { this.op = "upsert"; this.vals = v; this.uo = o; return this; }
  delete() { this.op = "delete"; return this; }
  _f(c, op, v) { this.f.push([c, op, v]); return this; }
  eq(c, v) { return this._f(c, "=", v); } neq(c, v) { return this._f(c, "<>", v); }
  gt(c, v) { return this._f(c, ">", v); } gte(c, v) { return this._f(c, ">=", v); }
  lt(c, v) { return this._f(c, "<", v); } lte(c, v) { return this._f(c, "<=", v); }
  like(c, v) { return this._f(c, "like", v); } ilike(c, v) { return this._f(c, "ilike", v); }
  in(c, v) { return this._f(c, "in", v); }
  is(c, v) { return this._f(c, v === null ? "isnull" : "is", v); }
  not(c, op, v) { return this._f(c, "not " + op, v); }
  filter(c, op, v) { return this._f(c, op, v); }
  match(o) { for (const k in o) this.eq(k, o[k]); return this; }
  order(c, o = {}) { this.ord.push(colExpr(c) + (o.ascending === false ? " desc" : " asc") + (o.nullsFirst === true ? " nulls first" : o.nullsFirst === false ? " nulls last" : "")); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.off = a; this.lim = b - a + 1; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  then(res, rej) { return this._run().then(res, rej); }

  _where(params) {
    if (!this.f.length) return "";
    const parts = this.f.map(([c, op, v]) => {
      const e = colExpr(c);
      let neg = false;
      if (op.startsWith("not ")) { neg = true; op = op.slice(4); }
      let s;
      if (op === "isnull" || (op === "is" && v === null)) s = e + " is null";
      else if (op === "is") { s = e + " is " + (v === true ? "true" : v === false ? "false" : "null"); }
      else if (op === "in") { if (typeof v === "string") v = v.replace(/^\(|\)$/g, "").split(",").map((x) => x.trim().replace(/^"|"$/g, "")); params.push(v); s = e + "::text = any($" + params.length + "::text[])"; }
      else if (op === "eq" || op === "neq" || op === "gt" || op === "gte" || op === "lt" || op === "lte") { params.push(v); s = e + " " + { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op] + " $" + params.length; }
      else { params.push(v); s = e + " " + op + " $" + params.length; }
      return neg ? "not (" + s + ")" : s;
    });
    return " where " + parts.join(" and ");
  }
  _val(col, v) { return v !== null && v !== undefined && typeof v === "object" && !(v instanceof Date) && jsonCols.has(this.t + "." + col) ? JSON.stringify(v) : v; }

  async _run() {
    try {
      await init();
      const T = "public." + q(this.t), params = [];
      let sql, r;
      if (this.op === "select") {
        const w = this._where(params);
        if (this.head) { r = await pool.query("select count(*) as c from " + T + w, params); return { data: null, error: null, count: r.rows[0].c * 1 }; }
        sql = "select " + selList(this.cols) + " from " + T + w + (this.ord.length ? " order by " + this.ord.join(", ") : "") + (this.lim != null ? " limit " + this.lim : "") + (this.off ? " offset " + this.off : "");
        r = await pool.query(sql, params);
        return this._fin(r.rows, this.cnt ? r.rowCount : undefined);
      }
      if (this.op === "delete") { sql = "delete from " + T + this._where(params) + (this.ret ? " returning " + selList(this.cols) : ""); r = await pool.query(sql, params); return this._fin(this.ret ? r.rows : null); }
      if (this.op === "update") {
        const sets = Object.keys(this.vals).map((k) => { params.push(this._val(k, this.vals[k])); return q(k) + " = $" + params.length; });
        sql = "update " + T + " set " + sets.join(", ") + this._where(params) + (this.ret ? " returning " + selList(this.cols) : "");
        r = await pool.query(sql, params); return this._fin(this.ret ? r.rows : null);
      }
      // insert / upsert
      const rows = Array.isArray(this.vals) ? this.vals : [this.vals];
      if (!rows.length) return { data: this.ret ? [] : null, error: null };
      /* 23 Nov 2026: "on conflict (...)" needs a real unique index on those columns. If this
         database has lost it, do the same job by hand - update the row, and insert it only if
         there was nothing to update - so a save works with no change to the database. */
      if (this.op === "upsert") {
        const oc0 = (this.uo.onConflict || "").split(",").map((s) => s.trim()).filter(Boolean);
        const oc1 = oc0.length ? oc0 : await pkOf(this.t);
        if (!oc1.length) throw new Error("upsert without onConflict is not supported by the shim");
        if (!(await hasUnique(this.t, oc1))) return await this._upsertByHand(T, rows, oc1);
      }
      const keys = [...new Set(rows.flatMap((x) => Object.keys(x)))];
      const tuples = rows.map((x) => "(" + keys.map((k) => { params.push(x[k] === undefined ? null : this._val(k, x[k])); return "$" + params.length; }).join(", ") + ")");
      sql = "insert into " + T + " (" + keys.map(q).join(", ") + ") values " + tuples.join(", ");
      if (this.op === "upsert") {
        let oc = (this.uo.onConflict || "").split(",").map((s) => s.trim()).filter(Boolean);
        if (!oc.length) oc = await pkOf(this.t);   // PostgREST default: the primary key
        if (!oc.length) throw new Error("upsert without onConflict is not supported by the shim");
        const upd = keys.filter((k) => !oc.includes(k));
        sql += " on conflict (" + oc.map(q).join(", ") + ")" + (this.uo.ignoreDuplicates || !upd.length ? " do nothing" : " do update set " + upd.map((k) => q(k) + " = excluded." + q(k)).join(", "));
      }
      if (this.ret) sql += " returning " + selList(this.cols);
      r = await pool.query(sql, params);
      return this._fin(this.ret ? r.rows : null);
    } catch (e) { return { data: null, error: { message: e.message, code: e.code, details: e.detail || null } }; }
  }
  /* upsert on a table that has no unique index for these columns: update, else insert.
     One row at a time, so one bad row cannot take the others down with it. */
  async _upsertByHand(T, rows, oc) {
    const out = [];
    for (const row of rows) {
      const wp = oc.map((k) => this._val(k, row[k]));
      const where = oc.map((k, i) => q(k) + " = $" + (i + 1)).join(" and ");
      const rest = Object.keys(row).filter((k) => !oc.includes(k));
      let hit = false;
      if (rest.length && !this.uo.ignoreDuplicates) {
        const p = wp.slice();
        const sets = rest.map((k) => { p.push(this._val(k, row[k])); return q(k) + " = $" + p.length; });
        const u = await pool.query("update " + T + " set " + sets.join(", ") + " where " + where + (this.ret ? " returning " + selList(this.cols) : ""), p);
        if (u.rowCount) { hit = true; if (this.ret && u.rows[0]) out.push(u.rows[0]); }
      } else {
        const e = await pool.query("select 1 from " + T + " where " + where + " limit 1", wp);
        if (e.rowCount) hit = true;
      }
      if (hit) continue;
      const ks = Object.keys(row);
      const p = []; const vals = ks.map((k) => { p.push(row[k] === undefined ? null : this._val(k, row[k])); return "$" + p.length; });
      try {
        const i = await pool.query("insert into " + T + " (" + ks.map(q).join(", ") + ") values (" + vals.join(", ") + ")" + (this.ret ? " returning " + selList(this.cols) : ""), p);
        if (this.ret && i.rows[0]) out.push(i.rows[0]);
      } catch (e) {
        if (e.code !== "23505") throw e;   // somebody inserted the same row a moment ago: update it instead
        if (rest.length && !this.uo.ignoreDuplicates) {
          const p2 = wp.slice();
          const sets = rest.map((k) => { p2.push(this._val(k, row[k])); return q(k) + " = $" + p2.length; });
          const u2 = await pool.query("update " + T + " set " + sets.join(", ") + " where " + where + (this.ret ? " returning " + selList(this.cols) : ""), p2);
          if (this.ret && u2.rows[0]) out.push(u2.rows[0]);
        }
      }
    }
    return this._fin(this.ret ? out : null);
  }
  _fin(rows, count) {
    if (rows === null) return { data: null, error: null };
    if (this.mode === "single") { if (rows.length !== 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } }; return { data: rows[0], error: null }; }
    if (this.mode === "maybe") { if (rows.length > 1) return { data: null, error: { message: "multiple rows returned", code: "PGRST116" } }; return { data: rows[0] || null, error: null }; }
    const o = { data: rows, error: null }; if (count !== undefined) o.count = count; return o;
  }
}

class RPC {
  constructor(fn, args) { this.fn = fn; this.args = args || {}; }
  then(res, rej) { return this._run().then(res, rej); }
  async _run() {
    try {
      await init();
      const names = Object.keys(this.args), params = names.map((k) => { const v = this.args[k]; return v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) ? JSON.stringify(v) : v; });
      const call = "public." + q(this.fn) + "(" + names.map((k, i) => q(k) + " => $" + (i + 1)).join(", ") + ")";
      const info = fnInfo.get(this.fn) || { retset: false, composite: false };
      let r;
      if (info.retset || info.composite) { r = await pool.query("select * from " + call, params); return { data: info.retset ? r.rows : r.rows[0] || null, error: null }; }
      r = await pool.query("select " + call + " as r", params);
      return { data: r.rows[0] ? r.rows[0].r : null, error: null };
    } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
  }
}

// Workspace tables (deleg_*) stay on Supabase: reached over its REST API with the service key (only if configured in .env)
let remote = null;
async function getRemote() {
  if (remote !== null) return remote;
  remote = false;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) { const m = await import("@supabase/supabase-js"); remote = m.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }); }
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
  const proxy = new Proxy({}, { get: (_, k) => (k === "then" ? (res, rej) => run().then(res, rej) : (...a) => { calls.push([k, a]); return proxy; }) });
  return proxy;
}
export const createClient = () => ({ from: (t) => (String(t).startsWith("deleg_") ? remoteQB(t) : new QB(t)), rpc: (fn, a) => new RPC(fn, a) });
