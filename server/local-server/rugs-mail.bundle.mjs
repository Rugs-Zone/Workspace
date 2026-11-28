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

// server/b64u.mjs
var decodeBase64Url = (s) => new Uint8Array(Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64"));

// server/rugs-mail.src.ts
var sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
var DOMAIN = "rugscreation.com";
var DEADLINE_MS = 25e3;
var WINDOW = 1 * 86400;
var FIRST_DAYS = 30;
var CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
var ok = (d) => new Response(JSON.stringify(d), { headers: { ...CORS, "Content-Type": "application/json" } });
var bad = (m, s = 400) => new Response(JSON.stringify({ error: m }), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
var E = class extends Error {
  constructor(m, code = 400) {
    super(m);
    this.code = code;
  }
  code;
};
// 23 Nov 2026: sbshim returns { data, error } like supabase-js and never throws, so every
// admin write is put through this - a refused write is raised instead of looking like success.
var must = (r, what) => { if (r && r.error) throw new E((what ? what + ": " : "") + (r.error.message || "the database refused the change"), 500); return r; };
var b64u = (d) => {
  const bytes = typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d);
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
var decB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
var dec = (s) => new TextDecoder().decode(decB64u(s));
function saJson() {
  let v = (Deno.env.get("RUGS_SA_JSON") || Deno.env.get("GOOGLE_SA_JSON") || "").trim();
  if (!v) return {};
  if (!v.startsWith("{")) v = "{" + v;
  if (!v.endsWith("}")) v = v + "}";
  return JSON.parse(v);
}
var tokCache = /* @__PURE__ */ new Map();
async function gToken(sub, scope) {
  const k = sub + "|" + scope, c = tokCache.get(k);
  if (c && c.exp > Date.now() + 6e4) return c.t;
  const sa = saJson();
  if (!sa.private_key) throw new E("Google service account (GOOGLE_SA_JSON) is not set", 500);
  const now = Math.floor(Date.now() / 1e3);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, sub, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3e3 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\\n/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (x) => x.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + b64u(sig) }) });
  const j = await r.json();
  if (!j.access_token) {
    const why = j.error_description || j.error || "unknown";
    if (/unauthorized_client/i.test(String(j.error))) throw new E(`Google has not allowed ${scope.split("/").pop()} for ${sub}. Add the scope in Admin console \u2192 Domain-wide delegation.`, 403);
    throw new E("Google sign-in for " + sub + " failed: " + why, 502);
  }
  tokCache.set(k, { t: j.access_token, exp: Date.now() + 3e3 * 1e3 });
  return j.access_token;
}
var READ = "https://www.googleapis.com/auth/gmail.readonly";
var SEND = "https://www.googleapis.com/auth/gmail.send";
var DIR = "https://www.googleapis.com/auth/admin.directory.user.readonly";
var DRIVE = "https://www.googleapis.com/auth/drive.file";
var MODIFY = "https://www.googleapis.com/auth/gmail.modify";
async function gmail(tok, path, init2) {
  let last = "";
  for (let i = 0; i < 3; i++) {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, { ...init2, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...init2?.headers || {} } });
    if (r.status === 429 || r.status >= 500) {
      last = "Gmail " + r.status;
      try {
        await r.body?.cancel();
      } catch {
      }
      await new Promise((s) => setTimeout(s, 1e3 * (i + 1)));
      continue;
    }
    const txt = await r.text();
    if (!r.ok) throw new E("Gmail " + r.status + ": " + txt.slice(0, 200), r.status === 404 ? 404 : 502);
    if (r.status === 204 || !txt.trim()) return {};
    try {
      return JSON.parse(txt);
    } catch {
      last = `Gmail sent an incomplete reply (status ${r.status}, type ${r.headers.get("content-type") || "?"}, ${txt.length} chars: ${txt.slice(0, 120).replace(/\s+/g, " ")})`;
      if (i < 2 && (!init2?.method || init2.method === "GET")) {
        await new Promise((s) => setTimeout(s, 600 * (i + 1)));
        continue;
      }
      throw new E(last, 502);
    }
  }
  throw new E(last || "Gmail is busy, try again", 503);
}
var addrs = (s) => ((s || "").match(/[\w.+'-]+@[\w-]+(\.[\w-]+)+/g) || []).map((x) => x.toLowerCase());
var isOwn = (e) => (e.split("@")[1] || "") === DOMAIN;
var AUTO_RE = /(no-?reply|notification|newsletter|mailer-daemon)/i;
async function tokHash(t) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(t || "")));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var oneLine = (v) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();
var nameOf = (h) => (h || "").replace(/<.*$/, "").replace(/"/g, "").trim();
function partOf(p, mime2) {
  if (!p) return "";
  if (p.mimeType === mime2 && p.body?.data) return dec(p.body.data);
  for (const c of p.parts || []) {
    const r = partOf(c, mime2);
    if (r) return r;
  }
  return "";
}
function attachments(p, out = []) {
  if (!p) return out;
  const hv = (nm) => (p.headers || []).find((h) => h.name.toLowerCase() === nm)?.value || "";
  const disp = hv("content-disposition");
  const cid = hv("content-id").replace(/[<>\s]/g, "") || hv("x-attachment-id").trim();
  const inline = /^\s*inline/i.test(disp) || (!!cid && !/^\s*attachment/i.test(disp));
  if (p.filename && p.body?.attachmentId) out.push({ id: p.body.attachmentId, name: p.filename, mime: p.mimeType, size: p.body.size || 0, ...inline ? { inline: true } : {}, ...cid ? { cid } : {} });
  /* 24 Nov 2026: a mail attached as a file that Gmail expanded instead of keeping whole - no
     attachmentId to fetch, so it is marked and the download rebuilds it from these parts */
  else if (/^message\/rfc822$/i.test(p.mimeType || "") && (p.parts || []).length) {
    const nm = p.filename || ((p.parts[0].headers || []).find((h) => h.name.toLowerCase() === "subject")?.value || "Attached mail").replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 80) + ".eml";
    out.push({ id: "", name: /\.eml$/i.test(nm) ? nm : nm + ".eml", mime: "message/rfc822", size: p.body?.size || 0, rebuild: true, part: p });
  }
  for (const c of p.parts || []) attachments(c, out);
  return out;
}
/* write a Gmail payload back out as a mail file. Gmail hands us each body already decoded, so
   every part goes out as base64 and says so; headers are kept as they came. */
function rfc822Raw(part) {
  const CRLF = "\r\n";
  const one = (p) => {
    const keep = (p.headers || []).filter((h) => !/^content-transfer-encoding$/i.test(h.name));
    const ct = keep.find((h) => /^content-type$/i.test(h.name));
    if ((p.parts || []).length) {
      let bd = /boundary="?([^";]+)"?/i.exec(ct?.value || "")?.[1] || "";
      const hs = keep.slice();
      if (!bd) { bd = "rzb" + Math.random().toString(36).slice(2, 10); hs.push({ name: "Content-Type", value: (p.mimeType || "multipart/mixed") + '; boundary="' + bd + '"' }); }
      return hs.map((h) => h.name + ": " + h.value).join(CRLF) + CRLF + CRLF +
        (p.parts || []).map((c) => "--" + bd + CRLF + one(c)).join("") + "--" + bd + "--" + CRLF;
    }
    const b64 = toStdB64(String(p.body?.data || "")).replace(/[^A-Za-z0-9+/=]/g, "");
    const wrapped = (b64.match(/.{1,76}/g) || []).join(CRLF);
    const hs = keep.concat(b64 ? [{ name: "Content-Transfer-Encoding", value: "base64" }] : []);
    return hs.map((h) => h.name + ": " + h.value).join(CRLF) + CRLF + CRLF + wrapped + CRLF;
  };
  const msg = (part.parts || [])[0];
  if (!msg) throw new E("That attached mail could not be read from Gmail", 502);
  return one(msg);
}
function inlineParts(p, out = []) {
  if (!p) return out;
  const hv = (n) => (p.headers || []).find((h) => h.name.toLowerCase() === n)?.value || "";
  const cid = hv("content-id").replace(/[<>\s]/g, "") || hv("x-attachment-id").trim();
  if (cid && /^image\//i.test(p.mimeType || "")) out.push({ cid, mime: p.mimeType, data: p.body?.data || "", aid: p.body?.attachmentId || "", size: p.body?.size || 0, name: p.filename || "" });
  for (const c of p.parts || []) inlineParts(c, out);
  return out;
}
var toStdB64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/");
function cidIndex(parts, mid) {
  const ix = /* @__PURE__ */ new Map();
  for (const x of parts) {
    const p = { ...x, mid: x.mid || mid };
    const k = String(x.cid || "").toLowerCase();
    if (k && !ix.has(k)) ix.set(k, p);
    const n = String(x.name || "").toLowerCase();
    if (n && !ix.has(n)) ix.set(n, p);
  }
  return ix;
}
function withCidLinks(msgId, payload, html, all) {
  if (!html || !/cid:/i.test(html)) return html;
  const own = cidIndex(inlineParts(payload), msgId);
  return html.replace(/cid:([^"'\s<>)\]]+)/gi, (m0, raw) => {
    const k = String(raw).toLowerCase();
    const pt = own.get(k) || all && all.get(k);
    return pt ? `rmcid:${pt.mid || msgId}/${encodeURIComponent(pt.cid)}` : m0;
  });
}
var htmlToText = (h) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n");
async function me(token) {
  if (!token) throw new E("Please sign in", 401);
  const { data: s } = await sb.from("rm_sessions").select("user_id,expires_at,switched_by").eq("token_hash", await tokHash(token)).maybeSingle();
  if (!s || new Date(s.expires_at) < /* @__PURE__ */ new Date()) throw new E("Your session ended. Please sign in again.", 401);
  const { data: u } = await sb.from("rm_users").select("*").eq("id", s.user_id).maybeSingle();
  if (!u || !u.active) throw new E("This user is deactivated. Ask the admin.", 403);
  u._switched = !!s.switched_by;
  return u;
}
async function depts() {
  const { data } = await sb.from("rm_departments").select("*").order("created_at");
  return data || [];
}
var access = (u, deptId) => u.role === "Admin" ? "full" : u.dept_id === deptId ? "full" : (u.access || {})[deptId] || "";
var can = (u, k) => u.role === "Admin" || !!(u.perm || {})[k];
async function deptOfBox(box) {
  const { data } = await sb.from("rm_departments").select("*").eq("mailbox", box).maybeSingle();
  if (!data) throw new E("Unknown mailbox");
  return data;
}
async function needBox(u, box, level) {
  const d = await deptOfBox(box), a = access(u, d.id);
  if (!a || level === "full" && a !== "full") throw new E("You don't have " + (level === "full" ? "full" : "") + " access to " + box, 403);
  return d;
}
async function threadAccess(u, box, tid, level) {
  const { data: t } = await sb.from("rm_threads").select("dept_id").eq("mailbox", box).eq("gmail_thread_id", tid).maybeSingle();
  if (!t) throw new E("Conversation not found", 404);
  const home = await deptOfBox(box);
  const ok2 = (id) => {
    if (!id) return false;
    const a = access(u, id);
    return level === "full" ? a === "full" : !!a;
  };
  if (ok2(t.dept_id || home.id) || ok2(home.id)) return home;
  throw new E("You don't have access to this conversation", 403);
}
var safeUser = (u) => ({ id: u.id, name: u.name, login: u.login, dept_id: u.dept_id, role: u.role, active: u.active, perm: u.perm, access: u.access, profile: u.profile, signature: u.signature, on_leave: u.on_leave, has_password: !!u.pass_hash, must_change: !!u.must_change, prefs: u.prefs || {} });
async function boot(u) {
  const [{ data: users }, { data: st }] = await Promise.all([sb.from("rm_users").select("*").order("created_at"), sb.from("rm_settings").select("key,value").in("key", SHARED_KEYS)]);
  const settings = {};
  (st || []).forEach((r) => settings[r.key] = r.value);
  return { me: safeUser(u), depts: await depts(), users: (users || []).map(safeUser), settings, gone: await deletedUsers(), ai: !!Deno.env.get("GEMINI_API_KEY") && !await aiHeld() };
}
async function deletedUsers() {
  const { data } = await sb.from("rm_settings").select("value").eq("key", "deleted_users").maybeSingle();
  return data?.value && typeof data.value === "object" ? data.value : {};
}
var SHARED_KEYS = ["circulars", "folders", "alerts", "templates", "cats", "rules", "blocked", "contacts_extra", "mgr_first_boxes", "mail_rules", "hidden_msgs"];
var ADMIN_KEYS = ["rules", "blocked", "cats", "folders", "templates", "circulars", "mgr_first_boxes", "mail_rules", "hidden_msgs"];
async function log(box, tid, uid, kind, text) {
  await sb.from("rm_activity").insert({ mailbox: box, gmail_thread_id: tid, user_id: uid, kind, text });
}
async function saveMessage(box, m, sentBy = null) {
  const h = {};
  const dlv = [];
  for (const x of m.payload?.headers || []) {
    const k = x.name.toLowerCase();
    h[k] = x.value;
    if (k === "delivered-to" || k === "x-original-to") dlv.push(x.value);
  }
  const fromA = addrs(h.from)[0] || "";
  let html = partOf(m.payload, "text/html"), text = partOf(m.payload, "text/plain");
  if (!text && html) text = htmlToText(html.slice(0, 15e4));
  const atts = attachments(m.payload);
  const row = {
    mailbox: box,
    gmail_id: m.id,
    gmail_thread_id: m.threadId,
    direction: fromA === box || isOwn(fromA) ? "out" : "in",
    // anyone @rugscreation.com = our side
    from_email: fromA,
    from_name: nameOf(h.from) || fromA,
    to_text: h.to || "",
    cc_text: h.cc || "",
    subject: h.subject || "",
    snippet: m.snippet || "",
    body_text: text.slice(0, 8e3),
    body_html: "",
    // full mail stays in Gmail; opened live (no copy in Supabase)
    sent_at: new Date(Number(m.internalDate)).toISOString(),
    has_attachments: atts.length > 0,
    attachments: atts.map(({ part, ...x }) => x),   /* 24 Nov 2026: never store the Gmail payload of an expanded attached mail */
    labels: m.labelIds || [],
    rfc_message_id: h["message-id"] || null,
    list_unsub: !!h["list-unsubscribe"],
    delivered_to: dlv.join(", ").slice(0, 1e3),
    ...sentBy ? { sent_by: sentBy } : {}
  };
  await sb.from("rm_messages").upsert(row, { onConflict: "mailbox,gmail_id" });
  return row;
}
async function rebuildThread(box, tid, newIn) {
  const { data: ms } = await sb.from("rm_messages").select("direction,subject,snippet,sent_at,labels,from_email,from_name,to_text,cc_text,delivered_to,list_unsub,sent_by").eq("mailbox", box).eq("gmail_thread_id", tid).order("sent_at");
  if (!ms || !ms.length) return;
  const ext = (x) => x.direction === "in" && !isOwn(String(x.from_email || "").toLowerCase());
  /* 24 Nov 2026: a colleague's mail (another @rugscreation.com address, not sent from Rugs Email)
     is mail somebody sent TO this mailbox - it makes the conversation unread and reopens it. */
  const colleague = (x) => x.direction === "out" && !x.sent_by && String(x.from_email || "").toLowerCase() !== String(box).toLowerCase() && isOwn(String(x.from_email || "").toLowerCase());
  const inb = (x) => ext(x) || colleague(x);
  const last = ms[ms.length - 1], firstIn = ms.find(ext);
  const cpEmail = firstIn ? firstIn.from_email : ms.flatMap((x) => addrs(x.to_text)).find((e) => e !== box && !isOwn(e)) || "";
  const cpName = firstIn ? firstIn.from_name : cpEmail;
  const firstReply = firstIn ? ms.find((x) => !ext(x) && x.sent_at > firstIn.sent_at) : null;
  const { data: cur } = await sb.from("rm_threads").select("status,owner_id,cats").eq("mailbox", box).eq("gmail_thread_id", tid).maybeSingle();
  const auto = !!firstIn && (AUTO_RE.test(String(cpEmail)) || ms.some((x) => ext(x) && x.list_unsub));
  const row = {
    mailbox: box,
    gmail_thread_id: tid,
    subject: ms[0].subject,
    snippet: last.snippet,
    counterpart_email: cpEmail,
    counterpart_name: cpName,
    msg_count: ms.length,
    last_msg_at: last.sent_at,
    has_in: !!firstIn,
    has_out: ms.some((x) => !ext(x)),
    unread: ms.some((x) => inb(x) && (x.labels || []).includes("UNREAD")),
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    first_reply_at: firstReply ? firstReply.sent_at : null,
    // every To / Cc / Delivered-To address (newest mail first) — used by the alias rule and the "via" tag
    to_addrs: [...new Set([...ms].reverse().flatMap((x) => [...addrs(x.to_text), ...addrs(x.cc_text), ...addrs(x.delivered_to)]).map((e) => e.toLowerCase()))].slice(0, 40)
  };
  if (auto && (!cur || (cur.status || "new") === "new" && !cur.owner_id)) {
    const c = Array.isArray(cur?.cats) ? cur.cats : [];
    row.status = "done";
    row.done_at = (/* @__PURE__ */ new Date()).toISOString();
    row.cats = c.includes("auto") ? c : [...c, "auto"];
    await log(box, tid, null, "rule", "Auto-closed \u2014 automatic mail (" + cpEmail + ")");
  } else if (!auto && cur && cur.status === "done" && newIn && inb(last)) {
    row.status = cur.owner_id ? "open" : "new";
    await log(box, tid, null, "reopen", "Reopened \u2014 new mail from " + cpName);
  }
  await sb.from("rm_threads").upsert(row, { onConflict: "mailbox,gmail_thread_id" });
}
async function syncWindow(box, tok, from, to, left, t0, size = 200) {
  const ids = [];
  let pt = "";
  do {
    const j = await gmail(tok, `messages?maxResults=${size}&fields=messages(id),nextPageToken&q=${encodeURIComponent(`after:${from} before:${to} -in:chats -in:spam -in:trash`)}${pt ? "&pageToken=" + pt : ""}`);
    for (const m of j.messages || []) ids.push(m.id);
    pt = j.nextPageToken || "";
  } while (pt && ids.length < 5e3);
  const have = /* @__PURE__ */ new Set();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await sb.from("rm_messages").select("gmail_id").eq("mailbox", box).in("gmail_id", ids.slice(i, i + 300));
    (data || []).forEach((x) => have.add(x.gmail_id));
  }
  const todo = ids.filter((i) => !have.has(i));
  let saved = 0, complete = true;
  for (let i = 0; i < todo.length; i += 4) {
    if (saved >= left || Date.now() - t0 > DEADLINE_MS) {
      complete = false;
      break;
    }
    const touched = /* @__PURE__ */ new Map();
    await Promise.all(todo.slice(i, i + 4).map(async (id) => {
      try {
        const m = await gmail(tok, `messages/${id}?format=full`);
        const r = await saveMessage(box, m);
        touched.set(m.threadId, touched.get(m.threadId) || false || r.direction === "in" || (!r.sent_by && String(r.from_email || "").toLowerCase() !== String(box).toLowerCase() && isOwn(String(r.from_email || "").toLowerCase())));
      } catch (e) {
        console.log("skip message", box, id, String(e.message).slice(0, 120));
      }
      saved++;
    }));
    for (const [tid, newIn] of touched) await rebuildThread(box, tid, newIn);
  }
  return { scanned: ids.length, saved, complete };
}
async function historyDays() {
  const { data } = await sb.from("rm_settings").select("value").eq("key", "history_days").maybeSingle();
  const n = Number(data?.value);
  return n >= 7 && n <= 730 ? n : 60;
}
async function syncBox(box, t0, force = false, budget = 25) {
  const { data: st } = await sb.from("rm_mailboxes").select("*").eq("mailbox", box).maybeSingle();
  if (!force && st?.last_sync && Date.now() - new Date(st.last_sync).getTime() < 15e3) return { mailbox: box, skipped: true };
  const tok = await gToken(box, READ);
  const nowS = Math.floor(Date.now() / 1e3);
  let cursor = Number(st?.cursor_s) || nowS - FIRST_DAYS * 86400;
  let back = Number(st?.back_s) || (Number(st?.cursor_s) ? nowS - FIRST_DAYS * 86400 : cursor);
  let saved = 0, scanned = 0, live = true, skipped = 0, stalled = false;
  /* __newestfirst 26 Nov 2026: THE NEWEST MAIL IS NEVER STARVED. The walk below is
     sequential from cursor_s and a window that fills the budget does not advance it, so
     while the cursor is behind (an outage, Gmail list errors, or a job that wound it back
     to re-read a window) no newer mail was fetched at all and a mail sitting in Gmail's
     inbox today never reached the app. Read the last two hours FIRST with its own slice of
     the budget; the cursor is not moved, so the catch-up still fills the gap behind it. */
  if (nowS - cursor > 2 * 3600) {
    try {
      const r0 = await syncWindow(box, tok, nowS - 2 * 3600, nowS + 60, Math.max(5, Math.floor(budget / 2)), t0);
      saved += r0.saved;
      scanned += r0.scanned;
      if (r0.saved) console.log("newest first", box, "saved", r0.saved, "mail from the last 2 hours while the cursor is", Math.round((nowS - cursor) / 3600), "hour(s) behind");
    } catch (e) {
      console.log("newest-first window failed", box, String(e.message).slice(0, 120));
    }
  }
  while (Date.now() - t0 < DEADLINE_MS) {
    const from = cursor - 3600, to = Math.min(nowS + 60, cursor + WINDOW);
    let r;
    try {
      r = await syncWindow(box, tok, from, to, budget - saved, t0);
    } catch (e) {
      try {
        r = await syncWindow(box, tok, from, to, budget - saved, t0, 50);
      } catch (e2) {
        console.log("skip window", box, from, to, String(e2.message));
        skipped++;
        if (nowS - cursor < 6 * 3600) {
          stalled = true;
          break;
        }
        r = { saved: 0, scanned: 0, complete: true };
      }
    }
    saved += r.saved;
    scanned += r.scanned;
    if (!r.complete) {
      live = false;
      break;
    }
    cursor = to > nowS ? nowS - 600 : to;
    await sb.from("rm_mailboxes").upsert({ mailbox: box, cursor_s: cursor }, { onConflict: "mailbox" });
    if (to > nowS) break;
  }
  live = live && cursor >= nowS - 700;
  const target = nowS - await historyDays() * 86400;
  if (live) {
    while (back > target && saved < budget && Date.now() - t0 < DEADLINE_MS) {
      const from = Math.max(target, back - WINDOW);
      let r;
      try {
        r = await syncWindow(box, tok, from, back + 3600, budget - saved, t0);
      } catch {
        try {
          r = await syncWindow(box, tok, from, back + 3600, budget - saved, t0, 50);
        } catch {
          r = { saved: 0, scanned: 0, complete: true };
          skipped++;
        }
      }
      saved += r.saved;
      scanned += r.scanned;
      if (!r.complete) break;
      back = from;
    }
  }
  const histDone = back <= target;
  await sb.from("rm_mailboxes").upsert({ mailbox: box, cursor_s: cursor, back_s: back, last_sync: (/* @__PURE__ */ new Date()).toISOString(), status: live ? "live" : "backfilling", note: `scanned ${scanned}, saved ${saved}${skipped ? stalled ? `, Gmail could not list the latest mail (${skipped}x) - retrying` : `, skipped ${skipped} day(s) Gmail could not list` : ""}${live ? histDone ? " \xB7 history complete" : " \xB7 loading history to " + new Date(target * 1e3).toISOString().slice(0, 10) + ", now at " + new Date(back * 1e3).toISOString().slice(0, 10) : ""}` }, { onConflict: "mailbox" });
  return { mailbox: box, scanned, saved, live, history: histDone ? "complete" : new Date(back * 1e3).toISOString().slice(0, 10) };
}
function foldAddr(v) {
  return String(v || "").split(/\s*,\s*/).filter(Boolean).join(",\r\n ");
}
function mime(o) {
  const images = [];
  let n = 0;
  const html = o.html.replace(/<img([^>]*?)src="data:(image\/[a-z+.-]+);base64,([^"]+)"/gi, (_m, a, type, b64) => {
    const cid = `img${++n}.${Date.now()}@rugsmail`;
    images.push({ cid, type, b64 });
    return `<img${a}src="cid:${cid}"`;
  });
  const enc = (s2) => /[^\x20-\x7e]/.test(s2) ? "=?UTF-8?B?" + btoa(unescape(encodeURIComponent(s2))) + "?=" : s2;
  const B = "rm" + crypto.randomUUID().replace(/-/g, "");
  const htmlB64 = btoa(unescape(encodeURIComponent(html))).replace(/(.{76})/g, "$1\r\n");
  let s = `From: ${o.from}\r
To: ${foldAddr(o.to)}\r
${o.cc ? `Cc: ${foldAddr(o.cc)}\r
` : ""}${o.bcc ? `Bcc: ${foldAddr(o.bcc)}\r
` : ""}Subject: ${enc(o.subject)}\r
MIME-Version: 1.0\r
`;
  if (o.important) s += "X-Priority: 1 (Highest)\r\nImportance: High\r\n";
  if (o.receipt) s += `Disposition-Notification-To: ${o.receipt}\r
Return-Receipt-To: ${o.receipt}\r
`;
  const files = (o.files || []).filter((f) => f && f.name && f.b64);
  const M = "rmm" + crypto.randomUUID().replace(/-/g, "");
  if (o.inReplyTo) s += `In-Reply-To: ${o.inReplyTo}\r
References: ${o.refs || o.inReplyTo}\r
`;
  if (files.length) s += `Content-Type: multipart/mixed; boundary="${M}"\r
\r
--${M}\r
`;
  s += `Content-Type: multipart/related; boundary="${B}"\r
\r
--${B}\r
Content-Type: text/html; charset="UTF-8"\r
Content-Transfer-Encoding: base64\r
\r
${htmlB64}\r
`;
  for (const im of images) s += `--${B}\r
Content-Type: ${im.type}\r
Content-Transfer-Encoding: base64\r
Content-ID: <${im.cid}>\r
Content-Disposition: inline\r
\r
${im.b64.replace(/(.{76})/g, "$1\r\n")}\r
`;
  s += `--${B}--`;
  if (files.length) {
    for (const f of files) {
      const nm = enc(String(f.name).replace(/["\r\n]/g, ""));
      const ct = /^text\/calendar/i.test(f.type) ? `${f.type}; method=REQUEST; charset=UTF-8` : f.type || "application/octet-stream";
      s += `\r
--${M}\r
Content-Type: ${ct}; name="${nm}"\r
Content-Transfer-Encoding: base64\r
Content-Disposition: attachment; filename="${nm}"\r
\r
${String(f.b64).replace(/\s/g, "").replace(/(.{76})/g, "$1\r\n")}`;
    }
    s += `\r
--${M}--`;
  }
  return s;
}
async function send(u, p) {
  const box = p.mailbox;
  if (p.threadId) await threadAccess(u, box, p.threadId, "full");
  else await needBox(u, box, "full");
  const to = oneLine(p.to);
  if (!to) throw new E("Add who it goes to");
  let threadId, inReplyTo, refs, subject = p.subject || "(no subject)";
  if (p.threadId) {
    const { data: ms } = await sb.from("rm_messages").select("rfc_message_id,subject").eq("mailbox", box).eq("gmail_thread_id", p.threadId).order("sent_at");
    if (ms && ms.length && !p.forward) {
      threadId = p.threadId;
      inReplyTo = ms[ms.length - 1].rfc_message_id || void 0;
      refs = ms.map((x) => x.rfc_message_id).filter(Boolean).slice(-10).join(" ");
    }
    const base = ms && ms[0]?.subject || subject;
    subject = p.forward ? /^fwd?:/i.test(base) ? base : "Fwd: " + base : /^re:/i.test(base) ? base : "Re: " + base;
  }
  subject = oneLine(subject) || "(no subject)";
  const cc = oneLine(p.cc), bcc = oneLine(p.bcc);
  const fromName = oneLine(`${u.name} \u2013 Rugs Creation`.replace(/"/g, ""));
  const fromHdr = /[^ -~]/.test(fromName) ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(fromName)))}?= <${box}>` : `"${fromName}" <${box}>`;
  const files = (Array.isArray(p.files) ? p.files : []).slice(0, 20).map((f) => ({ name: String(f.name || "file"), type: String(f.type || ""), b64: String(f.b64 || "") }));
  if (files.reduce((a, f) => a + f.b64.length * 0.75, 0) > 16 * 1024 * 1024) throw new E("Those files are too big to send \u2014 a mail carries about 15 MB. Remove one, or put it in Google Drive and send the link.");
  const raw = mime({ from: fromHdr, to, cc, bcc, subject, html: String(p.html || ""), inReplyTo, refs, important: !!p.important, receipt: p.receipt ? box : "", files });
  const tok = await gToken(box, SEND);
  const sent = await gmail(tok, "messages/send", { method: "POST", body: JSON.stringify({ raw: b64u(raw), ...threadId ? { threadId } : {} }) });
  let row = null;
  try {
    const rt = await gToken(box, READ);
    const full = await gmail(rt, `messages/${sent.id}?format=full`);
    row = await saveMessage(box, full, u.id);
  } catch {
    row = { gmail_thread_id: sent.threadId };
    await sb.from("rm_messages").upsert({ mailbox: box, gmail_id: sent.id, gmail_thread_id: sent.threadId, direction: "out", from_email: box, from_name: fromName, to_text: to, cc_text: cc, subject, body_text: String(p.text || "").slice(0, 8e3), body_html: "", sent_at: (/* @__PURE__ */ new Date()).toISOString(), sent_by: u.id }, { onConflict: "mailbox,gmail_id" });
  }
  await rebuildThread(box, sent.threadId, false);
  if (!p.threadId) await sb.from("rm_threads").update({ owner_id: u.id, status: "open" }).eq("mailbox", box).eq("gmail_thread_id", sent.threadId);
  await log(box, sent.threadId, u.id, p.forward ? "forward" : "send", `${p.auto ? "Out-of-office reply sent for " + u.name : (p.forward ? "Forwarded to " + to : p.threadId ? "Replied" : "New mail sent") + " by " + u.name}${p.scheduled ? " (scheduled)" : ""}${bcc ? " \xB7 Bcc: " + bcc.slice(0, 120) : ""}`);
  return { threadId: sent.threadId, messageId: sent.id };
}
async function gmailOn(box) {
  const { data } = await sb.from("rm_settings").select("value").eq("key", "gmail_write_boxes").maybeSingle();
  const v = data?.value;
  return v === "all" || Array.isArray(v) && v.map((x) => String(x).toLowerCase()).includes(String(box).toLowerCase());
}
async function gmailWrite(box, tid, patch, before) {
  const did = [];
  if (!await gmailOn(box)) return did;
  const wantFolder = "folder" in patch && patch.folder !== (before?.folder || "inbox");
  const wantRead = "unread" in patch && !!patch.unread !== !!before?.unread;
  if (!wantFolder && !wantRead) return did;
  try {
    const tok = await gToken(box, MODIFY);
    const mod = (body) => gmail(tok, `threads/${tid}/modify`, { method: "POST", body: JSON.stringify(body) });
    if (wantFolder) {
      const to = patch.folder, from = before?.folder || "inbox";
      if (to === "deleted") {
        await gmail(tok, `threads/${tid}/trash`, { method: "POST" });
        did.push("trash");
      } else {
        if (from === "deleted") {
          await gmail(tok, `threads/${tid}/untrash`, { method: "POST" });
          did.push("untrash");
        }
        if (to === "inbox") {
          await mod({ addLabelIds: ["INBOX"] });
          did.push("inbox");
        } else if (to === "archive") {
          await mod({ removeLabelIds: ["INBOX"] });
          did.push("archive");
        }
      }
    }
    if (wantRead) {
      if (patch.unread) {
        let { data: m } = await sb.from("rm_messages").select("gmail_id").eq("mailbox", box).eq("gmail_thread_id", tid).eq("direction", "in").order("sent_at", { ascending: false }).limit(1).maybeSingle();
        if (!m) {
          /* 24 Nov 2026: a colleague's mail - newest message that is not ours and was not sent from here */
          const { data: all } = await sb.from("rm_messages").select("gmail_id,from_email,sent_by,sent_at").eq("mailbox", box).eq("gmail_thread_id", tid).order("sent_at", { ascending: false }).limit(20);
          m = (all || []).find((x) => !x.sent_by && String(x.from_email || "").toLowerCase() !== String(box).toLowerCase()) || null;
        }
        if (m) {
          await gmail(tok, `messages/${m.gmail_id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: ["UNREAD"] }) });
          did.push("unread");
        }
      } else {
        await mod({ removeLabelIds: ["UNREAD"] });
        did.push("read");
      }
    }
  } catch (e) {
    console.log("gmailWrite", box, tid, String(e.message).slice(0, 200));
    did.push("error: " + String(e.message).slice(0, 160));
  }
  return did;
}
async function historySync(box, t0, budget = DEADLINE_MS) {
  const { data: st } = await sb.from("rm_mailboxes").select("history_id").eq("mailbox", box).maybeSingle();
  const tok = await gToken(box, READ);
  const restart = async (why) => {
    const pr = await gmail(tok, "profile");
    await sb.from("rm_mailboxes").update({ history_id: String(pr.historyId) }).eq("mailbox", box);
    return { mailbox: box, history: why, at: pr.historyId };
  };
  if (!st?.history_id) return restart("started");
  const msgs = /* @__PURE__ */ new Map();
  const ev = /* @__PURE__ */ new Map();
  let pt = "", latest = st.history_id, complete = true;
  do {
    if (Date.now() - t0 > budget) {
      complete = false;
      break;
    }
    let j;
    try {
      j = await gmail(tok, `history?startHistoryId=${st.history_id}&maxResults=500&historyTypes=labelAdded&historyTypes=labelRemoved${pt ? "&pageToken=" + pt : ""}`);
    } catch (e) {
      if (e.code === 404) return restart("expired, restarted");
      throw e;
    }
    for (const h of j.history || []) {
      for (const [list, sign] of [[h.labelsAdded, "+"], [h.labelsRemoved, "-"]]) for (const x of list || []) {
        const m = x.message || {};
        if (!m.id) continue;
        msgs.set(m.id, { tid: m.threadId, labels: m.labelIds || [] });
        for (const l of x.labelIds || []) if (l === "INBOX" || l === "TRASH") {
          const a = ev.get(m.threadId) || [];
          a.push(l + sign);
          ev.set(m.threadId, a);
        }
      }
    }
    if (j.historyId) latest = String(j.historyId);
    pt = j.nextPageToken || "";
  } while (pt);
  if (!complete) return { mailbox: box, history: "partial, will continue" };
  const tids = /* @__PURE__ */ new Set();
  const all = [...msgs];
  for (let i = 0; i < all.length; i += 25) {
    /* 24 Nov 2026: stop at the budget rather than eating the whole tick. history_id is not
       moved forward, so the next tick reads this same window again. */
    if (Date.now() - t0 > budget + 4e3) return { mailbox: box, history: "partial, will continue", wrote: i };
    await Promise.all(all.slice(i, i + 25).map(async ([id, m]) => {
      const { data } = await sb.from("rm_messages").update({ labels: m.labels }).eq("mailbox", box).eq("gmail_id", id).select("gmail_id");
      if (data && data.length) tids.add(m.tid);
    }));
  }
  let changed = 0;
  const tlist = [...tids];
  for (let i = 0; i < tlist.length; i += 10) await Promise.all(tlist.slice(i, i + 10).map(async (tid) => {
    const { data: t } = await sb.from("rm_threads").select("folder,prev_folder,unread").eq("mailbox", box).eq("gmail_thread_id", tid).maybeSingle();
    if (!t) return;
    const { data: ms } = await sb.from("rm_messages").select("direction,from_email,labels").eq("mailbox", box).eq("gmail_thread_id", tid);
    const patch = {};
    const unread = (ms || []).some((x) => x.direction === "in" && !isOwn(String(x.from_email || "").toLowerCase()) && (x.labels || []).includes("UNREAD"));
    if (unread !== !!t.unread) patch.unread = unread;
    let folder2 = t.folder || "inbox", prev = t.prev_folder, note = "";
    for (const e of ev.get(tid) || []) {
      if (e === "TRASH+" && folder2 !== "deleted") {
        prev = folder2;
        folder2 = "deleted";
        note = "moved to Trash in Gmail";
      } else if (e === "TRASH-" && folder2 === "deleted") {
        folder2 = prev && prev !== "deleted" ? prev : "inbox";
        note = "restored from Trash in Gmail";
      } else if (e === "INBOX-" && folder2 === "inbox") {
        prev = "inbox";
        folder2 = "archive";
        note = "archived in Gmail";
      } else if (e === "INBOX+" && (folder2 === "archive" || folder2 === "deleted")) {
        prev = folder2;
        folder2 = "inbox";
        note = "moved back to Inbox in Gmail";
      }
    }
    if (folder2 !== (t.folder || "inbox")) {
      patch.folder = folder2;
      patch.prev_folder = prev;
    }
    if (Object.keys(patch).length) {
      patch.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await sb.from("rm_threads").update(patch).eq("mailbox", box).eq("gmail_thread_id", tid);
      if (note) await log(box, tid, null, "n", "Changed in Gmail: " + note);
      changed++;
    }
  }));
  await sb.from("rm_mailboxes").update({ history_id: latest }).eq("mailbox", box);
  return { mailbox: box, history: "ok", messages: msgs.size, threads_changed: changed };
}
var MAX_FILE = 20 * 1024 * 1024;
async function drv(tok, url, init2) {
  const r = await fetch(url.startsWith("http") ? url : "https://www.googleapis.com/drive/v3/" + url, { ...init2, headers: { Authorization: "Bearer " + tok, ...init2?.headers || {} } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new E(/has not been used|disabled/i.test(j.error?.message || "") ? "Google Drive API is off in the Rugs Email Google Cloud project" : "Drive " + r.status + ": " + (j.error?.message || ""), 502);
  return j;
}
async function folder(tok, box, key, name, parent) {
  const { data } = await sb.from("rm_drive_folders").select("folder_id").eq("mailbox", box).eq("key", key).maybeSingle();
  if (data) return data.folder_id;
  const f = await drv(tok, "files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...parent ? { parents: [parent] } : {} }) });
  if (!parent) await drv(tok, `files/${f.id}/permissions?sendNotificationEmail=false`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "domain", role: "reader", domain: DOMAIN, allowFileDiscovery: false }) }).catch(() => null);
  await sb.from("rm_drive_folders").upsert({ mailbox: box, key, folder_id: f.id });
  return f.id;
}
var skipAtt = (a) => /^image\//i.test(a.mime || "") && (a.size || 0) < 4e4;
var slimAtts = (a) => (Array.isArray(a) ? a : []).map((x) => ({ name: x.name, mime: x.mime, size: x.size, ...x.inline ? { inline: true } : {}, ...x.cid ? { cid: x.cid } : {} }));
async function driveCopy(limit = 5, t0 = Date.now()) {
  const cols = "mailbox,gmail_id,gmail_thread_id,direction,from_email,to_text,sent_at,attachments,drive_tries";
  const { data: fresh } = await sb.from("rm_messages").select(cols).eq("has_attachments", true).is("drive_status", null).order("sent_at", { ascending: false }).limit(limit);
  let ms = fresh || [];
  if (ms.length < limit) {
    const { data: retry } = await sb.from("rm_messages").select(cols).eq("drive_status", "error").lt("drive_tries", 3).order("sent_at", { ascending: false }).limit(limit - ms.length);
    ms = ms.concat(retry || []);
  }
  let n = 0;
  for (const m of ms) {
    if (Date.now() - t0 > DEADLINE_MS) break;
    const files = [];
    try {
      const atts = (m.attachments || []).filter((a) => !skipAtt(a) && a.id);   /* 24 Nov 2026: an expanded attached mail has no id to fetch */
      if (!atts.length) {
        await sb.from("rm_messages").update({ drive_status: "none", drive_files: [], attachments: slimAtts(m.attachments) }).eq("mailbox", m.mailbox).eq("gmail_id", m.gmail_id);
        continue;
      }
      const gt = await gToken(m.mailbox, READ), dt = await gToken(m.mailbox, DRIVE);
      const other = m.direction === "in" ? m.from_email : addrs(m.to_text).find((e) => e !== m.mailbox) || "outgoing";
      const dom = (other.split("@")[1] || other).toLowerCase();
      const root = await folder(dt, m.mailbox, "root", "Rugs Email Attachments", null);
      const sub = await folder(dt, m.mailbox, "d:" + dom, dom, root);
      const day = String(m.sent_at).slice(0, 10);
      for (const a of atts) {
        if ((a.size || 0) > MAX_FILE) {
          files.push({ name: a.name, size: a.size, big: true });
          continue;
        }
        const g = await gmail(gt, `messages/${m.gmail_id}/attachments/${a.id}`);
        const bytes = decodeBase64Url(g.data || "");
        const B = "rmd" + crypto.randomUUID().replace(/-/g, "");
        const meta = JSON.stringify({ name: `${day} \xB7 ${a.name}`, parents: [sub], description: `From Rugs Email \xB7 ${m.mailbox} \xB7 ${other}` });
        const body = new Blob([`--${B}\r
Content-Type: application/json; charset=UTF-8\r
\r
${meta}\r
--${B}\r
Content-Type: ${/^[\w.+-]+\/[\w.+-]+$/.test(a.mime || "") ? a.mime : "application/octet-stream"}\r
\r
`, bytes, `\r
--${B}--`]);
        const f = await drv(dt, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${B}` }, body });
        files.push({ name: a.name, size: a.size, id: f.id, link: f.webViewLink });
      }
      await sb.from("rm_messages").update({ drive_status: "done", drive_files: files, attachments: slimAtts(m.attachments) }).eq("mailbox", m.mailbox).eq("gmail_id", m.gmail_id);
      await sb.from("rm_threads").update({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("mailbox", m.mailbox).eq("gmail_thread_id", m.gmail_thread_id);
      n++;
    } catch (e) {
      const msg = String(e.message || e);
      if (/drive\.file|Drive API is off|has not allowed/i.test(msg)) return { error: msg };
      await sb.from("rm_messages").update({ drive_status: "error", drive_files: [{ error: msg.slice(0, 200) }], drive_tries: (Number(m.drive_tries) || 0) + 1 }).eq("mailbox", m.mailbox).eq("gmail_id", m.gmail_id);
    }
  }
  return { saved: n };
}
async function aiHeld() {
  try {
    const { data } = await sb.from("deleg_meta").select("value").eq("key", "gemini_hold").maybeSingle();
    return !!(data?.value && data.value.on);
  } catch {
    return true;
  }
}
var TOPICS = ["quote", "sample", "prod", "ship", "buyer", "test", "art", "order"];
var MODEL = "";
async function pickModel(key, avoid = "") {
  const fixed = Deno.env.get("GEMINI_MODEL");
  if (fixed && fixed !== avoid) return fixed;
  if (MODEL && MODEL !== avoid) return MODEL;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key } });
  const j = await r.json().catch(() => ({}));
  const ver = (n) => (n.match(/gemini-([\d.]+)/)?.[1] || "0").split(".").map(Number);
  const names = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace("models/", "")).filter((n) => /^gemini-[\d.]+-flash$/.test(n) && n !== avoid).sort((x, y) => {
    const a = ver(x), b = ver(y);
    for (let i = 0; i < 3; i++) if ((b[i] || 0) !== (a[i] || 0)) return (b[i] || 0) - (a[i] || 0);
    return 0;
  });
  MODEL = names[0] || "gemini-flash-latest";
  return MODEL;
}
async function gemini(prompt, json) {
  if (await aiHeld()) throw new E("AI (Gemini) is paused by the admin to save cost. Please write it yourself for now.", 503);
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new E("Gemini key is not set (Supabase \u2192 Edge Functions \u2192 Secrets \u2192 GEMINI_API_KEY)", 501);
  let model = await pickModel(key);
  for (let attempt = 0; attempt < 2; attempt++) {
    const gc = json ? { responseMimeType: "application/json", temperature: 0.1 } : { temperature: 0.4 };
    if (/2\.5-flash/.test(model)) gc.thinkingConfig = { thinkingBudget: 0 };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: gc }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || "").join("");
    const msg = String(j.error?.message || r.status);
    if (attempt === 0 && (r.status === 404 || /no longer available|not found|not supported/i.test(msg))) {
      MODEL = "";
      model = await pickModel(key, model);
      continue;
    }
    throw new E("Gemini: " + msg, 502);
  }
  throw new E("Gemini is not available right now", 502);
}
async function tagTopics(limit = 20) {
  if (!Deno.env.get("GEMINI_API_KEY")) return 0;
  if (await aiHeld()) return 0;
  const { data: ts } = await sb.from("rm_threads").select("mailbox,gmail_thread_id,subject,counterpart_name,topic_ai").eq("topic_checked", false).eq("has_in", true).order("last_msg_at", { ascending: false }).limit(limit);
  if (!ts || !ts.length) return 0;
  const items = [];
  for (const t of ts) {
    const { data: m } = await sb.from("rm_messages").select("body_text").eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id).eq("direction", "in").order("sent_at").limit(1).maybeSingle();
    items.push({ id: t.mailbox + "|" + t.gmail_thread_id, from: t.counterpart_name, subject: t.subject, body: (m?.body_text || "").slice(0, 1200) });
  }
  const prompt = `You tag e-mails for a rug exporter's merchandising team (Rugs Creation, India). A topic only describes what the conversation is about.
Pick ONE topic id per e-mail from: quote=Quotation, sample=Sampling, prod=Production, ship=Shipping, buyer=Buyer talk (general talk with buyer or buying agency), test=Testing, art=Artwork, order=New order.
Return JSON {"<id>": {"topic":"<topic id>","confidence":<0-100>}}.

` + items.map((m) => `ID: ${m.id}
From: ${m.from}
Subject: ${m.subject}
Body: ${m.body}`).join("\n---\n");
  let r = {};
  try {
    r = JSON.parse(await gemini(prompt, true) || "{}");
  } catch (e) {
    if (e.code === 503) return 0;
    r = {};
  }
  for (const t of ts) {
    const x = r[t.mailbox + "|" + t.gmail_thread_id], upd = { topic_checked: true };
    if (x && TOPICS.includes(x.topic) && t.topic_ai !== false) {
      upd.topic = x.topic;
      upd.topic_conf = Math.round(x.confidence || 85);
      upd.topic_ai = true;
    }
    await sb.from("rm_threads").update(upd).eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id);
  }
  return ts.length;
}
async function sendScheduled(t0) {
  const { data: due } = await sb.from("rm_scheduled").select("*").eq("status", "waiting").lte("send_at", (/* @__PURE__ */ new Date()).toISOString()).order("send_at").limit(5);
  let n = 0;
  for (const j of due || []) {
    if (Date.now() - t0 > DEADLINE_MS) break;
    await sb.from("rm_scheduled").update({ status: "sending" }).eq("id", j.id).eq("status", "waiting");
    try {
      const { data: u } = await sb.from("rm_users").select("*").eq("id", j.user_id).maybeSingle();
      if (!u || !u.active) throw new E("The person who scheduled it is deactivated");
      await send(u, { ...j.payload, scheduled: true });
      await sb.from("rm_scheduled").update({ status: "sent", sent_at: (/* @__PURE__ */ new Date()).toISOString(), payload: { to: j.payload.to, subject: j.payload.subject } }).eq("id", j.id);
      n++;
    } catch (e) {
      await sb.from("rm_scheduled").update({ status: "failed", error: String(e.message).slice(0, 300) }).eq("id", j.id);
    }
  }
  return n;
}
var low = (x) => String(x || "").toLowerCase();
async function applyRules() {
  const { data: st } = await sb.from("rm_settings").select("key,value").in("key", ["rules", "blocked"]);
  const rules = (st || []).find((x) => x.key === "rules")?.value || [];
  const blocked = ((st || []).find((x) => x.key === "blocked")?.value || []).map(low);
  const { data: ts } = await sb.from("rm_threads").select("mailbox,gmail_thread_id,subject,counterpart_email,counterpart_name,folder").eq("rules_checked", false).limit(300);
  let n = 0;
  for (const t of ts || []) {
    const em = low(t.counterpart_email), dom = em.split("@")[1] || "", patch = { rules_checked: true };
    if (blocked.some((b) => b && (em === b || dom === b.replace(/^@/, "")))) {
      patch.folder = "junk";
      patch.prev_folder = t.folder || "inbox";
    } else for (const r of rules) {
      if (!r || r.off) continue;
      if (r.mailbox && low(r.mailbox) !== low(t.mailbox)) continue;
      if (r.from && !(em.includes(low(r.from)) || low(t.counterpart_name).includes(low(r.from)))) continue;
      if (r.subject && !low(t.subject).includes(low(r.subject))) continue;
      if (!r.from && !r.subject && !r.mailbox) continue;
      if (r.folder) {
        patch.folder = r.folder;
        patch.prev_folder = t.folder || "inbox";
      }
      if (r.owner) {
        patch.owner_id = r.owner;
        patch.status = "open";
      }
      if (r.topic) {
        patch.topic = r.topic;
        patch.topic_ai = false;
        patch.topic_checked = true;
      }
      if (r.flag) patch.flagged = true;
      if (r.cat) patch.cats = [r.cat];
      n++;
      if (r.stop !== false) break;
    }
    await sb.from("rm_threads").update(patch).eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id);
    if (patch.folder || patch.owner_id) await log(t.mailbox, t.gmail_thread_id, null, "rule", patch.folder === "junk" && blocked.length ? "Blocked sender \u2014 moved to Junk" : "Rule applied" + (patch.folder ? " \xB7 moved to " + patch.folder : "") + (patch.owner_id ? " \xB7 assigned" : ""));
  }
  return n;
}
async function outOfOffice(t0) {
  const { data: us } = await sb.from("rm_users").select("*").eq("active", true).not("prefs->ooo", "is", null);
  let n = 0;
  for (const u of us || []) {
    const o = u.prefs?.ooo;
    if (!o?.on || !o.message) continue;
    if (o.until && Date.parse(o.until) < Date.now()) {
      await sb.from("rm_users").update({ prefs: { ...u.prefs, ooo: { ...o, on: false } } }).eq("id", u.id);
      continue;
    }
    const { data: ts } = await sb.from("rm_threads").select("mailbox,gmail_thread_id,counterpart_email,last_msg_at").eq("owner_id", u.id).eq("ooo_sent", false).eq("has_in", true).gt("last_msg_at", o.since || new Date(Date.now() - 864e5).toISOString()).limit(10);
    for (const t of ts || []) {
      if (Date.now() - t0 > DEADLINE_MS) return n;
      await sb.from("rm_threads").update({ ooo_sent: true }).eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id);
      const { data: last } = await sb.from("rm_messages").select("direction,from_email").eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id).order("sent_at", { ascending: false }).limit(1).maybeSingle();
      const em = low(last?.from_email);
      if (!last || last.direction !== "in" || !em || isOwn(em) || /no-?reply|mailer-daemon|notification|bounce/.test(em)) continue;
      try {
        await send(u, { mailbox: t.mailbox, threadId: t.gmail_thread_id, to: em, html: String(o.message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"), text: o.message, auto: true });
        n++;
      } catch (e) {
        console.log("ooo", e.message);
      }
    }
  }
  return n;
}
var MISS_CACHE = /* __threadrescue */ new Map();   /* mailbox|stored id -> { at, id } ; id null = Gmail really does not have it */
var MISS_TTL = 30 * 60 * 1e3;
var gDay = (t) => { const d = new Date(t); return d.getUTCFullYear() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); };
/* 28 Nov 2026 (__threadrescue): a stored gmail_id Gmail answers 404 for. Look the same mail up
   in the same mailbox by sender and time - an id can be stale rather than the mail gone. */
async function rescueMsg(tok, box, x) {
  const key = box + "|" + x.gmail_id;
  const c = MISS_CACHE.get(key);
  if (c && Date.now() - c.at < MISS_TTL) {
    if (!c.id) return null;
    try { return await gmail(tok, `messages/${c.id}?format=full`); } catch { return null; }
  }
  let found = null;
  try {
    const at = Date.parse(x.sent_at);
    if (at) {
      const q = [x.from_email ? "from:" + String(x.from_email).trim() : "", "in:anywhere",
        "after:" + gDay(at - 864e5), "before:" + gDay(at + 864e5)].filter(Boolean).join(" ");
      const j = await gmail(tok, `messages?maxResults=10&q=${encodeURIComponent(q)}&fields=messages(id)`);
      const cand = (j.messages || []).map((y) => String(y.id)).slice(0, 5);
      for (const id of cand) {
        if (id === String(x.gmail_id)) continue;
        let h = null;
        try { h = await gmail(tok, `messages/${id}?format=minimal&fields=internalDate`); } catch { continue; }
        if (Math.abs(Number(h && h.internalDate || 0) - at) <= 12e4) {
          try { found = await gmail(tok, `messages/${id}?format=full`); } catch { found = null; }
          if (found) { console.log("thread msg rescued", x.gmail_id, "->", id, "(the stored id was stale)"); break; }
        }
      }
    }
  } catch (e) { console.log("thread msg rescue failed", x.gmail_id, String(e && e.message || e).slice(0, 120)); }
  MISS_CACHE.set(key, { at: Date.now(), id: found ? String(found.id) : null });
  if (MISS_CACHE.size > 5e3) MISS_CACHE.clear();
  return found;
}
async function threadFull(box, tid, ids) {
  const { data: m } = await sb.from("rm_messages").select("gmail_id,direction,body_text,sent_at,from_email").eq("mailbox", box).eq("gmail_thread_id", tid).order("sent_at");
  const tok = await gToken(box, READ);
  const FULL_N = 3;   /* 25 Nov 2026: the pane opens the newest, a reply quotes the newest 3 - see server/patch-thread-full3.js */
  const rows = m || [];
  const want = Array.isArray(ids) && ids.length ? new Set(ids.slice(0, 20).map(String)) : null;
  const need = want ? rows.filter((x) => want.has(String(x.gmail_id))) : rows.slice(-FULL_N);
  const asked = new Set(need.map((x) => String(x.gmail_id)));
  const gone = new Set();     /* Gmail said 404 for this stored id - permanent, never retried */
  const getMsg = async (id) => {
    for (let i = 0; i < 2; i++) {
      try {
        return await gmail(tok, `messages/${id}?format=full`);
      } catch (e) {
        if (e && e.code === 404) { gone.add(String(id)); console.log("thread msg miss", id, "- Gmail does not have this id (404), not retried"); return null; }
        if (i) { console.log("thread msg miss", id, String(e && e.message || e).slice(0, 140)); return null; }
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return null;
  };
  const got = (await Promise.all(need.map((x) => getMsg(String(x.gmail_id))))).filter(Boolean);
  const byId = new Map(got.map((x) => [x.id, x]));
  /* __threadrescue: only for the ones Gmail answered 404 for, at most four in a request */
  const rescued = new Map();
  const lost = need.filter((x) => gone.has(String(x.gmail_id))).slice(0, 4);
  if (lost.length) {
    const rs = await Promise.all(lost.map((x) => rescueMsg(tok, box, x)));
    rs.forEach((r, i) => { if (r) rescued.set(String(lost[i].gmail_id), r); });
  }
  const pool2 = [];
  for (const gm of got) for (const x of inlineParts(gm.payload)) pool2.push({ ...x, mid: gm.id, data: "" });
  for (const gm of rescued.values()) for (const x of inlineParts(gm.payload)) pool2.push({ ...x, mid: gm.id, data: "" });
  const allIx = cidIndex(pool2);
  const out = await Promise.all(rows.map(async (x) => {
    const gm = byId.get(x.gmail_id) || rescued.get(String(x.gmail_id)) || null;
    if (!gm) {
      /* never asked for, or a transient failure: a one-line summary, exactly as before */
      if (!asked.has(String(x.gmail_id)) || !gone.has(String(x.gmail_id)))
        return { ...x, body_html: "", body_text: (x.body_text || "").slice(0, 4e3), light: true };
      /* asked for, and Gmail really does not have it: send the copy we saved, so it can be read */
      return { ...x, body_html: "", body_text: (x.body_text || "").slice(0, 6e4), light: false, saved: true,
        why: "Google Mail no longer has this message, so Rugs Email is showing the copy it saved." };
    }
    /* the mail Gmail gave us. A rescued one keeps the id the app asked for on purpose. */
    let html = partOf(gm.payload, "text/html");
    const text = partOf(gm.payload, "text/plain") || (html ? htmlToText(html.slice(0, 15e4)) : "");
    if (html) html = withCidLinks(x.gmail_id, gm.payload, html, allIx);
    return { ...x, body_html: html, body_text: (text || x.body_text || "").slice(0, 6e4) };
  }));
  return { messages: out };
}
async function cronRun(t0) {
  const out = [];
  const { data: stt } = await sb.from("rm_mailboxes").select("mailbox,last_sync");
  const ls = new Map((stt || []).map((x) => [x.mailbox, x.last_sync ? Date.parse(x.last_sync) : 0]));
  const order = (await depts()).sort((x, y) => (ls.get(x.mailbox) || 0) - (ls.get(y.mailbox) || 0));
  try {
    out.push({ scheduled: await sendScheduled(t0) });
  } catch (e) {
    out.push({ scheduled: e.message });
  }
  /* 24 Nov 2026: what changed in GMAIL is copied over FIRST, with its own small budget.
     It used to run after every mailbox had fetched its new mail, against the same 25-second
     budget - so on a busy tick it never ran at all and a mail read, archived or deleted in
     Gmail never reached Rugs Email. See server/patch-gmail-history-first.js. */
  const HIST_MS = 8e3;
  let histLeft = 4;                       // at most four mailboxes a tick, so fetching mail always gets its turn
  for (const d of order) {
    if (histLeft <= 0 || Date.now() - t0 > HIST_MS) break;
    try {
      if (await gmailOn(d.mailbox)) { histLeft--; out.push(await historySync(d.mailbox, t0, HIST_MS)); }
    } catch (e) {
      out.push({ mailbox: d.mailbox, history_error: String(e.message).slice(0, 200) });
    }
  }
  for (const d of order) {
    if (Date.now() - t0 > DEADLINE_MS) break;
    try {
      out.push(await syncBox(d.mailbox, t0));
    } catch (e) {
      await sb.from("rm_mailboxes").upsert({ mailbox: d.mailbox, status: "error", note: String(e.message).slice(0, 300) }, { onConflict: "mailbox" });
      out.push({ mailbox: d.mailbox, error: e.message });
    }
  }

  try {
    out.push({ rules: await applyRules() });
  } catch (e) {
    out.push({ rules: e.message });
  }
  try {
    out.push({ ooo: await outOfOffice(t0) });
  } catch (e) {
    out.push({ ooo: e.message });
  }
  await sb.from("rm_presence").delete().lt("at", new Date(Date.now() - 6e5).toISOString());
  try {
    await tagTopics();
  } catch {
  }
  try {
    out.push({ drive: await driveCopy(5, t0) });
  } catch (e) {
    out.push({ drive: e.message });
  }
  await sb.from("rm_sessions").delete().lt("expires_at", (/* @__PURE__ */ new Date()).toISOString());
  return out;
}
async function takeLock() {
  await sb.from("rm_settings").upsert({ key: "sync_lock", value: {}, updated_at: "2000-01-01T00:00:00Z" }, { onConflict: "key", ignoreDuplicates: true });
  const { data } = await sb.from("rm_settings").update({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("key", "sync_lock").lt("updated_at", new Date(Date.now() - 65e3).toISOString()).select("key");
  return !!(data && data.length);
}
async function freeLock() {
  try {
    await sb.from("rm_settings").update({ updated_at: "2000-01-01T00:00:00Z" }).eq("key", "sync_lock");
  } catch {
  }
}
var META_COLS = ["dept_id", "owner_id", "status", "promise", "due_at", "topic", "topic_ai", "topic_conf", "flagged", "folder", "prev_folder", "unread", "pinned", "snooze_until", "remind_at", "cats"];
async function handle(a, p, t0) {
  if (a === "login") {
    const login = String(p.login || "").trim().toLowerCase().slice(0, 200);
    if (!login) throw new E("Enter your user ID", 400);
    const { data: lk } = await sb.from("rm_login_attempts").select("locked_until").eq("login", login).maybeSingle();
    const lockedMin = (t) => Math.max(1, Math.ceil((new Date(t).getTime() - Date.now()) / 6e4));
    if (lk?.locked_until && new Date(lk.locked_until).getTime() > Date.now()) throw new E(`Too many wrong passwords. This ID is locked for ${lockedMin(lk.locked_until)} more minute(s). Try again later or ask the admin.`, 429);
    const id = (await sb.rpc("rm_check_password", { p_login: login, p_pw: String(p.password || "") })).data;
    if (!id) {
      const { data: until } = await sb.rpc("rm_login_fail", { p_login: login });
      if (until) throw new E("Too many wrong passwords. This ID is locked for 15 minutes. Try again later or ask the admin.", 429);
      const { data: u3 } = await sb.from("rm_users").select("active,pass_hash").ilike("login", login).maybeSingle();
      if (!u3) throw new E("No user with that ID. Ask the admin (marketing@" + DOMAIN + ").", 401);
      if (!u3.active) throw new E("This user is deactivated. Ask the admin.", 403);
      if (!u3.pass_hash) throw new E("No password set yet. Ask the admin to set your password.", 401);
      throw new E("Wrong password. Try again or ask the admin to reset it.", 401);
    }
    await sb.from("rm_login_attempts").delete().eq("login", login);
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    await sb.from("rm_sessions").insert({ token_hash: await tokHash(token), user_id: id });
    const { data: u2 } = await sb.from("rm_users").select("*").eq("id", id).single();
    return { token, ...await boot(u2) };
  }
  if (a === "gmailRefresh") {
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    const box = String(p.box || "").toLowerCase(), days = Math.min(90, Math.max(1, Number(p.days) || 30));
    await deptOfBox(box);
    const tok = await gToken(box, READ);
    const unread = [];
    let pt = "";
    do {
      const j = await gmail(tok, `messages?maxResults=500&fields=messages(id),nextPageToken&q=${encodeURIComponent(`is:unread newer_than:${days}d -in:chats -in:spam -in:trash`)}${pt ? "&pageToken=" + pt : ""}`);
      for (const m of j.messages || []) unread.push(m.id);
      pt = j.nextPageToken || "";
    } while (pt && unread.length < 5e4);
    const { data: r, error } = await sb.rpc("rm_unread_refresh", { p_box: box, p_unread: unread, p_since: new Date(Date.now() - days * 864e5).toISOString(), p_dry: !!p.dry });
    if (error) throw new E(error.message, 500);
    const ids = r.push_ids || [];
    delete r.push_ids;
    let pushed = 0;
    if (!p.dry && ids.length) {
      const mt = await gToken(box, MODIFY);
      for (let i = 0; i < ids.length; i += 1e3) {
        await gmail(mt, "messages/batchModify", { method: "POST", body: JSON.stringify({ ids: ids.slice(i, i + 1e3), removeLabelIds: ["UNREAD"] }) });
        pushed += Math.min(1e3, ids.length - i);
      }
    }
    return { mailbox: box, days, gmail_unread_msgs: unread.length, ...r, pushed_read_to_gmail: pushed };
  }
  if (a === "threadPreview") {
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    return threadFull(String(p.mailbox || ""), String(p.threadId || ""));
  }
  if (a === "cron") {
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    if (!await takeLock()) return [{ skipped: "another sync is still running" }];
    try {
      return await cronRun(t0);
    } finally {
      await freeLock();
    }
  }
  const u = await me(p.token);
  if (u.must_change && !u._switched && !["boot", "logout", "changePassword", "list", "thread", "sync"].includes(a)) throw new E("Please set your own password first", 428);
  switch (a) {
    case "boot":
      return boot(u);
    case "logout":
      await sb.from("rm_sessions").delete().eq("token_hash", await tokHash(p.token));
      return { ok: true };
    case "list": {
      const all = await depts();
      const ds = all.filter((d) => access(u, d.id)), ids = ds.map((d) => d.id);
      const boxes = ds.map((d) => d.mailbox);
      const homeOf = new Map(all.map((d) => [d.mailbox, d.id]));
      const q1 = (q2) => p.since ? q2.gt("updated_at", new Date(p.since - 5e3).toISOString()) : q2;
      const [{ data: a1 }, { data: a2 }] = await Promise.all([
        Promise.all([0, 1e3].map((f) => q1(sb.from("rm_threads").select("*").in("mailbox", boxes).order("last_msg_at", { ascending: false }).order("gmail_thread_id")).range(f, f + 999))).then((rs) => ({ data: rs.flatMap((r) => r.data || []).slice(0, 1500) })),
        // two pages: Supabase caps one query at 1000 rows
        ids.length ? q1(sb.from("rm_threads").select("*").in("dept_id", ids).order("last_msg_at", { ascending: false }).limit(500)) : Promise.resolve({ data: [] })
      ]);
      const seen = /* @__PURE__ */ new Set(), threads = [];
      for (const t of [...a1 || [], ...a2 || []]) {
        const k = t.mailbox + "|" + t.gmail_thread_id;
        if (seen.has(k)) continue;
        if (!access(u, t.dept_id || homeOf.get(t.mailbox))) continue;
        seen.add(k);
        threads.push(t);
      }
      const keys = [...new Set(threads.map((t) => t.gmail_thread_id))];
      const msgs = [], acts = [];
      for (let i = 0; i < keys.length; i += 200) {
        const part = keys.slice(i, i + 200);
        const pageAll = async (mk) => {
          const rows = [];
          for (let f = 0; f < 2e4; f += 1e3) {
            const { data } = await mk().range(f, f + 999);
            rows.push(...data || []);
            if (!data || data.length < 1e3) break;
          }
          return rows;
        };
        const [m, ac] = await Promise.all([
          pageAll(() => sb.from("rm_messages").select("mailbox,gmail_id,gmail_thread_id,direction,from_email,from_name,to_text,cc_text,snippet,body_text,sent_at,sent_by,has_attachments,attachments,drive_status,drive_files").in("gmail_thread_id", part).order("sent_at")),
          pageAll(() => sb.from("rm_activity").select("mailbox,gmail_thread_id,user_id,kind,text,at").in("gmail_thread_id", part).order("at"))
        ]);
        m.forEach((x) => {
          if (!seen.has(x.mailbox + "|" + x.gmail_thread_id)) return;
          x.body_text = (x.body_text || "").slice(0, 1500);
          x.attachments = (x.attachments || []).map((a3) => ({ name: a3.name, mime: a3.mime, size: a3.size }));
          msgs.push(x);
        });
        ac.forEach((x) => {
          if (seen.has(x.mailbox + "|" + x.gmail_thread_id)) acts.push(x);
        });
      }
      const { data: boxesState } = await sb.from("rm_mailboxes").select("mailbox,status,last_sync,note").in("mailbox", boxes);
      return { threads, messages: msgs, activity: acts, mailboxes: boxesState || [], now: Date.now() };
    }
    case "thread": {
      await threadAccess(u, p.mailbox, p.threadId, "view");
      return threadFull(p.mailbox, p.threadId, p.ids);
    }
    case "sync": {
      const ds = (await depts()).filter((d) => access(u, d.id));
      if (!await takeLock()) return ds.map((d) => ({ mailbox: d.mailbox, skipped: "a sync is already running" }));
      const out = [];
      try {
        for (const d of ds) {
          try {
            out.push(await syncBox(d.mailbox, t0, !!p.force));
          } catch (e) {
            out.push({ mailbox: d.mailbox, error: e.message });
          }
        }
      } finally {
        await freeLock();
      }
      return out;
    }
    case "meta": {
      const out = [], gm = [];
      for (const c of p.changes || []) {
        const d = await threadAccess(u, c.mailbox, c.threadId, "full");
        const patch = {};
        for (const k of META_COLS) if (k in (c.patch || {})) patch[k] = c.patch[k];
        if ("owner_id" in patch && patch.owner_id && patch.owner_id !== u.id && !can(u, "assign")) throw new E("You can't assign mail to others", 403);
        /* __r29a_owner 27 Nov 2026 (R29a): a conversation can only belong to somebody in the
           team that owns that mailbox. The Owner box stopped offering anyone else, and this
           is the same rule on the server, so a crafted request cannot do it either.
           Clearing the owner is always allowed - that is "back to unassigned". */
        if ("owner_id" in patch && patch.owner_id) {
          const teamId = ("dept_id" in patch && patch.dept_id) ? patch.dept_id : d.id;
          const { data: ow } = await sb.from("rm_users").select("id,name,dept_id,active").eq("id", patch.owner_id).maybeSingle();
          if (!ow || ow.active === false) throw new E("That person is not an active user", 400);
          if (String(ow.dept_id || "") !== String(teamId || "")) {
            const { data: tm } = await sb.from("rm_departments").select("name").eq("id", teamId).maybeSingle();
            throw new E((ow.name || "That person") + " is not in " + ((tm && tm.name) || "that team") + ". Move the conversation to their team first.", 403);
          }
        }
        /* __purgeright 27 Nov 2026: 'purged' is what "Empty Deleted" writes - it needs the same
           right as a delete, or anyone could empty somebody's Deleted folder. */
        if ((patch.folder === "deleted" || patch.folder === "purged") && !can(u, "delete")) throw new E("You can't delete mail", 403);
        if ("topic" in patch && patch.topic_ai === false) patch.topic_checked = true;
        if ("dept_id" in patch && patch.dept_id && !can(u, "transfer")) throw new E("You can't transfer mail", 403);
        if ("dept_id" in patch && patch.dept_id === d.id) patch.dept_id = null;
        if (patch.status === "done") patch.done_at = (/* @__PURE__ */ new Date()).toISOString();
        else if ("status" in patch) patch.done_at = null;
        let before = null;
        if ("folder" in patch || "unread" in patch) {
          const { data: b0 } = await sb.from("rm_threads").select("folder,unread").eq("mailbox", c.mailbox).eq("gmail_thread_id", c.threadId).maybeSingle();
          before = b0;
        }
        if (Object.keys(patch).length) {
          patch.updated_at = (/* @__PURE__ */ new Date()).toISOString();
          await sb.from("rm_threads").update(patch).eq("mailbox", c.mailbox).eq("gmail_thread_id", c.threadId);
        }
        if (before) {
          const did = await gmailWrite(c.mailbox, c.threadId, patch, before);
          if (did.length) gm.push({ threadId: c.threadId, gmail: did });
        }
        for (const h of c.log || []) await log(c.mailbox, c.threadId, u.id, h.kind || "note", String(h.text || "").slice(0, 500));
        out.push(d.id);
      }
      return { ok: true, n: out.length, gmail: gm };
    }
    case "send":
      return send(u, p);
    case "aiWrite": {
      const prompt = `Write a short, polite, professional business e-mail body (no subject line, no signature \u2014 it is added automatically) for ${u.name} (${u.role}, Rugs Creation, a rug manufacturer and exporter in India).
What to say: ${p.ask}
` + (p.thread ? `It is a reply to this e-mail from ${p.thread.from} \u2014 subject "${p.thread.subject}":
${String(p.thread.body || "").slice(0, 3e3)}
` : "") + "Plain text, short paragraphs, start with a greeting using the recipient's first name if known.";
      return { text: await gemini(prompt, false) };
    }
    case "saveProfile": {
      const upd = {};
      if (p.profile) upd.profile = p.profile;
      if ("signature" in p) upd.signature = p.signature;
      if ("on_leave" in p) upd.on_leave = !!p.on_leave;
      await sb.from("rm_users").update(upd).eq("id", u.id);
      return { ok: true };
    }
    case "changePassword": {
      const np = String(p.newPassword || "");
      if (np.length < 8 || !/[A-Za-z]/.test(np) || !/\d/.test(np)) throw new E("Use at least 8 characters with letters and a number");
      if (np === String(p.oldPassword || "")) throw new E("The new password must be different from the old one");
      const chk = (await sb.rpc("rm_check_password", { p_login: u.login, p_pw: String(p.oldPassword || "") })).data;
      if (chk !== u.id) throw new E("Current password is wrong", 401);
      await sb.rpc("rm_set_password", { p_user: u.id, p_pw: np });
      await sb.from("rm_users").update({ must_change: false }).eq("id", u.id);
      await sb.from("rm_sessions").delete().eq("user_id", u.id).neq("token_hash", await tokHash(p.token));
      const { data: nu } = await sb.from("rm_users").select("*").eq("id", u.id).single();
      return boot(nu);
    }
    case "savePrefs": {
      const prefs = { ...u.prefs || {}, ...p.prefs || {} };
      const wasOn = !!u.prefs?.ooo?.on, nowOn = !!prefs.ooo?.on;
      if (nowOn && !wasOn) {
        prefs.ooo.since = (/* @__PURE__ */ new Date()).toISOString();
        await sb.from("rm_threads").update({ ooo_sent: false }).eq("owner_id", u.id);
      }
      await sb.from("rm_users").update({ prefs }).eq("id", u.id);
      return { ok: true, prefs };
    }
    case "schedule": {
      const at = Date.parse(p.sendAt);
      if (!at || at < Date.now() + 3e4) throw new E("Pick a time at least one minute from now");
      if (at > Date.now() + 90 * 864e5) throw new E("Pick a time within the next 90 days");
      if (p.payload?.threadId) await threadAccess(u, p.payload.mailbox, p.payload.threadId, "full");
      else await needBox(u, p.payload?.mailbox, "full");
      if (JSON.stringify(p.payload).length > 20 * 1024 * 1024) throw new E("Too big to schedule \u2014 attach big files as a Drive link");
      const { data } = await sb.from("rm_scheduled").insert({ user_id: u.id, mailbox: p.payload.mailbox, payload: p.payload, send_at: new Date(at).toISOString() }).select("id").single();
      return { id: data?.id };
    }
    case "scheduledList": {
      const { data } = await sb.from("rm_scheduled").select("id,mailbox,send_at,status,error,created_at,sent_at,payload->>to,payload->>subject").eq("user_id", u.id).order("send_at", { ascending: false }).limit(100);
      return { items: data || [] };
    }
    case "scheduledCancel": {
      await sb.from("rm_scheduled").update({ status: "cancelled" }).eq("id", p.id).eq("user_id", u.id).eq("status", "waiting");
      return { ok: true };
    }
    case "inlineImg": {
      await needBox(u, p.mailbox, "view");
      const tok = await gToken(p.mailbox, READ);
      const m = await gmail(tok, `messages/${p.gmailId}?format=full`);
      const cid = String(p.cid || "").toLowerCase();
      const pt = inlineParts(m.payload).find((x) => x.cid.toLowerCase() === cid || x.name && x.name.toLowerCase() === cid);
      if (!pt) {
        console.log("inlineImg miss", JSON.stringify({ mid: p.gmailId, cid, have: inlineParts(m.payload).map((x) => x.cid + "|" + x.name).slice(0, 10) }));
        throw new E("Picture not found", 404);
      }
      if ((pt.size || 0) > 8 * 1024 * 1024) throw new E("Picture too big to show here \u2014 download it instead");
      let data = pt.data || "";
      if (!data && pt.aid) data = (await gmail(tok, `messages/${p.gmailId}/attachments/${pt.aid}`)).data || "";
      if (!data) throw new E("Picture not found", 404);
      return { data: `data:${pt.mime};base64,${toStdB64(data)}` };
    }
    case "attachment": {
      await needBox(u, p.mailbox, "view");
      const tok = await gToken(p.mailbox, READ);
      const m = await gmail(tok, `messages/${p.gmailId}?format=full`);
      /* 24 Nov 2026: with p.size (the size the attachment list recorded) the right part is picked
         when one mail carries two parts of the same name - a mail attached inside a mail. */
      const named = attachments(m.payload).filter((x) => x.name === p.name).concat(inlineParts(m.payload).filter((x) => x.name === p.name));
      const want = Number(p.size) || 0;
      const a2 = (want && named.find((x) => Math.abs((x.size || 0) - want) <= 64)) || named[0];
      if (!a2) throw new E("Attachment not found", 404);
      const mb = (a2.size || 0) / 1048576;
      if (mb > 25) throw new E("This file is " + mb.toFixed(1) + " MB \u2014 too big to open in Rugs Email. Open the mail in Gmail to get it.");
      if (a2.rebuild) {
        /* an attached mail Gmail expanded: build the .eml back from its parts */
        const raw = rfc822Raw(a2.part);
        return { name: a2.name, mime: "message/rfc822", b64: Buffer.from(raw, "utf8").toString("base64"), rebuilt: true };
      }
      let data = a2.data || "";
      const aid = a2.id || a2.aid;
      if (!data && aid) data = (await gmail(tok, `messages/${p.gmailId}/attachments/${aid}`)).data || "";
      return { name: a2.name, mime: a2.mime, b64: toStdB64(data) };
    }
    case "search": {
      const q2 = String(p.q || "").trim();
      if (!q2) return { hits: [] };
      const ds = (await depts()).filter((d) => access(u, d.id));
      const hits = [];
      await Promise.all(ds.map(async (d) => {
        try {
          const tok = await gToken(d.mailbox, READ);
          const j = await gmail(tok, `threads?maxResults=100&fields=threads(id)&q=${encodeURIComponent(q2 + " -in:chats")}`);
          for (const t of j.threads || []) hits.push({ mailbox: d.mailbox, threadId: t.id });
        } catch (_e) {
        }
      }));
      return { hits };
    }
    case "presence": {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (p.typing) await sb.from("rm_presence").upsert({ mailbox: p.mailbox, gmail_thread_id: p.threadId, user_id: u.id, at: now });
      else await sb.from("rm_presence").delete().eq("mailbox", p.mailbox).eq("gmail_thread_id", p.threadId).eq("user_id", u.id);
      const { data } = await sb.from("rm_presence").select("user_id,at").eq("mailbox", p.mailbox).eq("gmail_thread_id", p.threadId).neq("user_id", u.id).gt("at", new Date(Date.now() - 12e4).toISOString());
      return { others: (data || []).map((x) => x.user_id) };
    }
    case "hideMsg": {
      /* __hidemsg 28 Nov 2026 */
      if (!p.mailbox || !p.threadId || !p.gmailId) throw new E("Which mail?", 400);
      await threadAccess(u, p.mailbox, p.threadId, "full");
      const key = String(p.mailbox).toLowerCase() + "|" + String(p.gmailId);
      const { data: cur } = await sb.from("rm_settings").select("value").eq("key", "hidden_msgs").maybeSingle();
      const v = cur && cur.value && typeof cur.value === "object" && !Array.isArray(cur.value) ? cur.value : {};
      if (p.undo) delete v[key]; else v[key] = { by: u.id, at: (/* @__PURE__ */ new Date()).toISOString(), t: String(p.threadId) };
      await sb.from("rm_settings").upsert({ key: "hidden_msgs", value: v, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      try { await log(p.mailbox, p.threadId, u.id, "note", (p.undo ? "A deleted mail was brought back by " : "One mail was deleted from this conversation (Rugs Email only) by ") + u.name); } catch (e) { }
      return { ok: true, hidden: v };
    }
    case "getSetting": {
      if (!SHARED_KEYS.includes(p.key)) throw new E("Unknown setting");
      const { data } = await sb.from("rm_settings").select("value").eq("key", p.key).maybeSingle();
      return { value: data ? data.value : null };
    }
    case "saveSetting": {
      if (!SHARED_KEYS.includes(p.key)) throw new E("Unknown setting");
      if (ADMIN_KEYS.includes(p.key) && u.role !== "Admin") throw new E("Only the admin can change this", 403);
      await sb.from("rm_settings").upsert({ key: p.key, value: p.value, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      return { ok: true };
    }
    /* ---------- admin ---------- */
    case "saveOrg":
    case "setPassword":
    case "status":
    case "dirUsers":
    case "setPasswords": {
      if (u.role !== "Admin") throw new E("Only the admin can do this", 403);
      if (a === "dirUsers") {
        const { data: s0 } = await sb.from("rm_settings").select("value").eq("key", "dir_admin").maybeSingle();
        const adminEmail = String(s0?.value || "");
        if (!adminEmail) throw new E("Google admin account for the staff list is not set", 500);
        const tok = await gToken(adminEmail, DIR);
        const users = [];
        let pt = "";
        do {
          const r = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&orderBy=email&fields=users(primaryEmail,name/fullName,suspended,orgUnitPath,organizations),nextPageToken${pt ? "&pageToken=" + pt : ""}`, { headers: { Authorization: "Bearer " + tok } });
          const j = await r.json();
          if (!r.ok) throw new E(/has not been used|disabled/i.test(j.error?.message || "") ? "Admin SDK API is off. Turn it on in Google Cloud (project quiet-maxim-504613-g7), wait 2 minutes, then try again." : "Google staff list: " + (j.error?.message || r.status), 502);
          for (const x of j.users || []) users.push({ email: String(x.primaryEmail).toLowerCase(), name: x.name?.fullName || x.primaryEmail, suspended: !!x.suspended, ou: x.orgUnitPath || "/", title: x.organizations?.[0]?.title || "", department: x.organizations?.[0]?.department || "" });
          pt = j.nextPageToken || "";
        } while (pt && users.length < 5e3);
        return { users };
      }
      if (a === "setPasswords") {
        const list = Array.isArray(p.list) ? p.list.slice(0, 500) : [];
        for (const x of list) {
          if (String(x.password || "").length < 6) throw new E("Each password needs at least 6 characters");
        }
        for (const x of list) {
          must(await sb.rpc("rm_set_password", { p_user: x.id, p_pw: String(x.password) }), "setting the password for " + x.id);
          must(await sb.from("rm_users").update({ must_change: true }).eq("id", x.id), "updating " + x.id);
        }
        return { ok: true, n: list.length };
      }
      if (a === "setPassword") {
        if (String(p.password || "").length < 6) throw new E("Password needs at least 6 characters");
        must(await sb.rpc("rm_set_password", { p_user: p.id, p_pw: String(p.password) }), "setting the password");
        must(await sb.from("rm_users").update({ must_change: true }).eq("id", p.id), "asking them to choose their own password");
        must(await sb.from("rm_sessions").delete().eq("user_id", p.id).neq("token_hash", await tokHash(p.token)), "signing out their other devices");
        const { data: pu } = await sb.from("rm_users").select("login").eq("id", p.id).maybeSingle();
        if (pu?.login) await sb.from("rm_login_attempts").delete().eq("login", String(pu.login).toLowerCase());
        return { ok: true };
      }
      if (a === "status") {
        const { data } = await sb.from("rm_mailboxes").select("*");
        return { mailboxes: data || [] };
      }
      const ds = p.org?.depts || [], us = p.org?.people || [];
      for (const d of ds) {
        const mailbox = String(d.mailbox || "").toLowerCase();
        if (!d.id || !d.name || !/^[^@\s]+@[^@\s]+$/.test(mailbox)) throw new E("Each department needs a name and a mailbox");
        if (d.id === "alpha" && mailbox !== "teamalpha@" + DOMAIN) throw new E("Team Alpha is fixed to teamalpha@" + DOMAIN);
        must(await sb.from("rm_departments").upsert({ id: d.id, name: d.name, mailbox, color: d.color || "#ff5001" }), "department " + d.name);
        must(await sb.from("rm_mailboxes").upsert({ mailbox }, { onConflict: "mailbox", ignoreDuplicates: true }), "mailbox " + mailbox);
      }
      const keep = new Set(ds.map((d) => d.id));
      for (const d of await depts()) if (!keep.has(d.id)) {
        const [{ count: nu }, { count: nt }] = await Promise.all([sb.from("rm_users").select("id", { count: "exact", head: true }).eq("dept_id", d.id), sb.from("rm_threads").select("gmail_thread_id", { count: "exact", head: true }).eq("mailbox", d.mailbox)]);
        if (!nu && !nt) must(await sb.from("rm_departments").delete().eq("id", d.id), "removing department " + d.name);
      }
      const goneIds = await deletedUsers();
      for (const x of us) {
        if (x.id && goneIds[x.id]) continue;
        if (!x.id || !x.name || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(x.login || ""))) throw new E("Each user needs a name and a valid user ID");
        if (x.id === u.id && x.role !== "Admin") throw new E("You cannot remove your own admin role");
        must(await sb.from("rm_users").upsert({ id: x.id, name: x.name, login: String(x.login).toLowerCase(), dept_id: x.dept_id, role: x.role, active: x.active !== false, perm: x.perm || {}, access: x.access || {} }), "user " + x.login);
        if (x.active === false) must(await sb.from("rm_sessions").delete().eq("user_id", x.id), "signing out " + x.login);
      }
      return boot(u);
    }
    /* 18 Nov 2026: Admin -> Users -> Delete. Only role Admin. Not yourself, never the last admin.
       Their conversations go back to the team's To assign, mail they scheduled is cancelled,
       sessions / presence / login lock go, and their name is kept in rm_settings `deleted_users`
       so old history and sent mail still show who it was. Nothing is touched in Gmail. */
    case "deleteUser": {
      if (u.role !== "Admin") throw new E("Only an admin can delete a user", 403);
      const id = String(p.id || "");
      if (!id) throw new E("Which user?");
      if (id === u.id) throw new E("You cannot delete your own user");
      const { data: x } = await sb.from("rm_users").select("id,name,login,role").eq("id", id).maybeSingle();
      if (!x) throw new E("That user does not exist any more");
      if (x.role === "Admin") {
        const { count } = await sb.from("rm_users").select("id", { count: "exact", head: true }).eq("role", "Admin").eq("active", true).neq("id", id);
        if (!count) throw new E("This is the last admin \u2014 make someone else Admin first");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data: un } = await sb.from("rm_threads").update({ owner_id: null, updated_at: now }).eq("owner_id", id).select("gmail_thread_id");
      must(await sb.from("rm_scheduled").update({ status: "cancelled", error: "The user was deleted" }).eq("user_id", id).eq("status", "waiting"), "cancelling their scheduled mail");
      must(await sb.from("rm_presence").delete().eq("user_id", id), "clearing their presence");
      must(await sb.from("rm_sessions").delete().eq("user_id", id), "signing them out");
      if (x.login) must(await sb.from("rm_login_attempts").delete().eq("login", String(x.login).toLowerCase()), "clearing their login lock");
      const gone = await deletedUsers();
      gone[id] = { name: x.name, login: x.login, at: now, by: u.name };
      must(await sb.from("rm_settings").upsert({ key: "deleted_users", value: gone, updated_at: now }), "keeping their name for old history");
      const { error } = await sb.from("rm_users").delete().eq("id", id);
      if (error) throw new E("Could not delete: " + error.message, 500);
      return { ...await boot(u), unassigned: (un || []).length };
    }
  }
  throw new E("Unknown action");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const t0 = Date.now();
  try {
    const p = await req.json().catch(() => ({}));
    return ok(await handle(String(p.action || ""), p, t0));
  } catch (e) {
    const err = e;
    return bad(err.message || "Something went wrong", err.code || 500);
  }
});
