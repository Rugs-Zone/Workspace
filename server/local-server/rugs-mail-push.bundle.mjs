// server/sbshim.mjs
import pg from "pg";
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(1114, (v) => (/* @__PURE__ */ new Date(v + "Z")).toISOString());
pg.types.setTypeParser(1082, (v) => v);
var pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
var jsonCols = null;
var fnInfo = null;
async function init() {
  if (jsonCols) return;
  const c = await pool.query("select table_name, column_name from information_schema.columns where table_schema='public' and data_type in ('json','jsonb')");
  jsonCols = new Set(c.rows.map((r) => r.table_name + "." + r.column_name));
  const f = await pool.query("select p.proname, p.proretset, t.typtype, t.typname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype where n.nspname='public'");
  fnInfo = new Map(f.rows.map((r) => [r.proname, { retset: r.proretset, composite: r.typtype === "c" || r.typname === "record" }]));
}
var pkCache = /* @__PURE__ */ new Map();
async function pkOf(table) {
  if (!pkCache.has(table)) {
    const r = await pool.query("select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum = any(i.indkey) where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisprimary", [table]);
    pkCache.set(table, r.rows.map((x) => x.attname));
  }
  return pkCache.get(table);
}
var q = (id) => '"' + String(id).replace(/"/g, '""') + '"';
function colExpr(c) {
  const m = String(c).split(/(->>|->)/);
  let out = q(m[0].trim());
  for (let i = 1; i < m.length; i += 2) out += m[i] + "'" + m[i + 1].trim().replace(/'/g, "''") + "'";
  return out;
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
        if (!oc.length) oc = await pkOf(this.t);
        if (!oc.length) throw new Error("upsert without onConflict is not supported by the shim");
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

// server/src-push.ts
var sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
var FN = "http://127.0.0.1:" + (Deno.env.get("PORT") || "8787") + "/rugs-mail";
var json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
var setting = async (k) => {
  const { data } = await sb.from("rm_settings").select("value").eq("key", k).maybeSingle();
  return data?.value ?? null;
};
var str = (v) => typeof v === "string" ? v : v == null ? "" : String(v);
var b64u = (d) => {
  const bytes = typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d);
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
function saJson() {
  let v = (Deno.env.get("RUGS_SA_JSON") || Deno.env.get("GOOGLE_SA_JSON") || "").trim();
  if (!v) return {};
  if (!v.startsWith("{")) v = "{" + v;
  if (!v.endsWith("}")) v = v + "}";
  return JSON.parse(v);
}
async function gToken(sub, scope) {
  const sa = saJson();
  if (!sa.private_key) throw new Error("Service account key is not set");
  const now = Math.floor(Date.now() / 1e3);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, sub, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3e3 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\\n/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (x) => x.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + b64u(sig) }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Google sign-in for " + sub + " failed: " + (j.error_description || j.error));
  return j.access_token;
}
async function watchAll() {
  const topic = str(await setting("push_topic"));
  if (!topic) return { error: "push_topic is not set" };
  const { data: ds } = await sb.from("rm_departments").select("mailbox");
  const out = [];
  for (const d of ds || []) {
    try {
      const tok = await gToken(d.mailbox, "https://www.googleapis.com/auth/gmail.readonly");
      const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ topicName: topic, labelIds: ["INBOX", "SENT"], labelFilterBehavior: "include" }) });
      const j = await r.json();
      out.push(r.ok ? { mailbox: d.mailbox, ok: true, expires: new Date(Number(j.expiration)).toISOString() } : { mailbox: d.mailbox, error: j.error?.message || r.status });
    } catch (e) {
      out.push({ mailbox: d.mailbox, error: String(e.message) });
    }
  }
  await sb.from("rm_settings").upsert({ key: "push_watch", value: { at: (/* @__PURE__ */ new Date()).toISOString(), result: out }, updated_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "key" });
  return { result: out };
}
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const cronKey = str(await setting("cron_key"));
    if (body.action === "watch" || body.action === "status") {
      if (!body.cron_key || body.cron_key !== cronKey) return json({ error: "forbidden" }, 403);
      return json(body.action === "watch" ? await watchAll() : { watch: await setting("push_watch"), last: await setting("push_last") });
    }
    const pk = str(await setting("push_key"));
    if (!pk || url.searchParams.get("k") !== pk) return json({ error: "forbidden" }, 403);
    let box = "";
    try {
      box = String(JSON.parse(atob(body?.message?.data || "")).emailAddress || "").toLowerCase();
    } catch {
    }
    const now = Date.now();
    const last = await setting("push_last");
    if (box) await sb.from("rm_mailboxes").update({ last_sync: null }).eq("mailbox", box);
    await sb.from("rm_settings").upsert({ key: "push_last", value: { at: new Date(now).toISOString(), mailbox: box, count: (Number(last?.count) || 0) + 1 }, updated_at: new Date(now).toISOString() }, { onConflict: "key" });
    if (!last?.ran || now - Date.parse(last.ran) > 8e3) {
      await sb.from("rm_settings").upsert({ key: "push_last", value: { at: new Date(now).toISOString(), ran: new Date(now).toISOString(), mailbox: box, count: (Number(last?.count) || 0) + 1 }, updated_at: new Date(now).toISOString() }, { onConflict: "key" });
      if (process.env.DISABLE_TIMERS !== "1") fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cron", cron_key: cronKey }) }).catch(() => null);
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    return json({ error: String(e.message) }, 500);
  }
});
