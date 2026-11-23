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

// server/src-cal.ts
var sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
var CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
var out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
var E = class extends Error {
  constructor(m, code = 400) {
    super(m);
    this.code = code;
  }
  code;
};
var CAL = "https://www.googleapis.com/auth/calendar.events";
var READ = "https://www.googleapis.com/auth/gmail.readonly";
async function sha256Hex(t) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
var b64u = (d) => {
  const bytes = typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d);
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
var decB64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
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
  if (!sa.private_key) throw new E("Google service account is not set", 500);
  const now = Math.floor(Date.now() / 1e3);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, sub, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3e3 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\\n/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (x) => x.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + b64u(sig) }) });
  const j = await r.json();
  if (!j.access_token) {
    if (/unauthorized_client/i.test(String(j.error))) throw new E("Google Calendar is not switched on for Rugs Email yet. Ask the admin to add the scope " + scope + " to the Rugs Email service account (Admin console \u2192 Security \u2192 API controls \u2192 Domain-wide delegation).", 403);
    throw new E("Google sign-in for " + sub + " failed: " + (j.error_description || j.error), 502);
  }
  tokCache.set(k, { t: j.access_token, exp: Date.now() + 3e3 * 1e3 });
  return j.access_token;
}
async function api(tok, url, init2) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { ...init2, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
    if (r.status === 429 || r.status >= 500) {
      await new Promise((s) => setTimeout(s, 1e3 * (i + 1)));
      continue;
    }
    const t = await r.text();
    let j = {};
    try {
      j = t ? JSON.parse(t) : {};
    } catch {
      j = { raw: t };
    }
    if (!r.ok) throw new E(j.error?.message || "Google " + r.status, r.status === 404 ? 404 : 502);
    return j;
  }
  throw new E("Google is busy, try again", 503);
}
var GM = "https://gmail.googleapis.com/gmail/v1/users/me/";
var GC = "https://www.googleapis.com/calendar/v3/calendars/primary/";
async function me(token) {
  const t = String(token || "");
  if (!t || t.length > 200) throw new E("Please sign in", 401);
  const { data: s } = await sb.from("rm_sessions").select("user_id,expires_at").eq("token_hash", await sha256Hex(t)).maybeSingle();
  if (!s || new Date(s.expires_at) < /* @__PURE__ */ new Date()) throw new E("Your session ended. Please sign in again.", 401);
  const { data: u } = await sb.from("rm_users").select("id,name,login,role,dept_id,access,active").eq("id", s.user_id).maybeSingle();
  if (!u || !u.active) throw new E("This user is deactivated. Ask the admin.", 403);
  return u;
}
async function needBox(u, box) {
  const { data: d } = await sb.from("rm_departments").select("id,mailbox").eq("mailbox", String(box || "").toLowerCase()).maybeSingle();
  if (!d) throw new E("Unknown mailbox");
  const a = u.role === "Admin" ? "full" : u.dept_id === d.id ? "full" : (u.access || {})[d.id] || "";
  if (a !== "full") throw new E("You need full access to " + d.mailbox + " to answer its invites", 403);
  return d.mailbox;
}
var WIN_TZ = {
  "india standard time": "Asia/Kolkata",
  "gmt standard time": "Europe/London",
  "greenwich standard time": "Atlantic/Reykjavik",
  "w. europe standard time": "Europe/Berlin",
  "central europe standard time": "Europe/Budapest",
  "romance standard time": "Europe/Paris",
  "central european standard time": "Europe/Warsaw",
  "e. europe standard time": "Europe/Chisinau",
  "gtb standard time": "Europe/Bucharest",
  "fle standard time": "Europe/Kiev",
  "turkey standard time": "Europe/Istanbul",
  "russian standard time": "Europe/Moscow",
  "eastern standard time": "America/New_York",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "pacific standard time": "America/Los_Angeles",
  "atlantic standard time": "America/Halifax",
  "e. south america standard time": "America/Sao_Paulo",
  "arabian standard time": "Asia/Dubai",
  "arab standard time": "Asia/Riyadh",
  "pakistan standard time": "Asia/Karachi",
  "bangladesh standard time": "Asia/Dhaka",
  "nepal standard time": "Asia/Kathmandu",
  "sri lanka standard time": "Asia/Colombo",
  "se asia standard time": "Asia/Bangkok",
  "singapore standard time": "Asia/Singapore",
  "china standard time": "Asia/Shanghai",
  "tokyo standard time": "Asia/Tokyo",
  "korea standard time": "Asia/Seoul",
  "aus eastern standard time": "Australia/Sydney",
  "w. australia standard time": "Australia/Perth",
  "new zealand standard time": "Pacific/Auckland",
  "south africa standard time": "Africa/Johannesburg",
  "egypt standard time": "Africa/Cairo",
  "utc": "UTC",
  "coordinated universal time": "UTC"
};
function ianaTz(t) {
  const s = String(t || "").replace(/^"|"$/g, "").trim();
  if (!s) return "";
  try {
    new Intl.DateTimeFormat("en", { timeZone: s });
    return s;
  } catch {
  }
  return WIN_TZ[s.toLowerCase()] || "Asia/Kolkata";
}
function findCal(p, out2 = []) {
  if (!p) return out2;
  if (/^(text\/calendar|application\/ics)/i.test(p.mimeType || "") || /\.ics$/i.test(p.filename || "")) out2.push(p);
  for (const c of p.parts || []) findCal(c, out2);
  return out2;
}
function parseIcs(txt) {
  const lines = txt.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const ev = {};
  let inEv = false, method = "";
  for (const l of lines) {
    if (/^METHOD:/i.test(l)) method = l.slice(7).trim().toUpperCase();
    if (/^BEGIN:VEVENT/i.test(l)) {
      inEv = true;
      continue;
    }
    if (/^END:VEVENT/i.test(l)) break;
    if (!inEv) continue;
    const i = l.indexOf(":");
    if (i < 0) continue;
    const k = l.slice(0, i), v = l.slice(i + 1), name = k.split(";")[0].toUpperCase();
    if (["UID", "SUMMARY", "LOCATION", "DTSTART", "DTEND", "ORGANIZER", "STATUS"].includes(name) && !(name in ev)) ev[name] = { v: v.replace(/\\n/g, "\n").replace(/\\([,;\\])/g, "$1"), p: k };
  }
  const when = (x) => {
    if (!x) return null;
    const m = x.v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
    if (!m) return null;
    if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
    const tz = ianaTz((x.p.match(/TZID=("[^"]+"|[^;:]+)/i) || [])[1] || "");
    return { local: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`, utc: !!m[7], tz };
  };
  return { method, uid: ev.UID?.v || "", summary: ev.SUMMARY?.v || "(no title)", location: ev.LOCATION?.v || "", organizer: (ev.ORGANIZER?.v || "").replace(/^mailto:/i, ""), cancelled: method === "CANCEL" || /CANCELLED/i.test(ev.STATUS?.v || ""), start: when(ev.DTSTART), end: when(ev.DTEND) };
}
async function inviteOf(box, gmailId) {
  const gt = await gToken(box, READ);
  const m = await api(gt, GM + "messages/" + encodeURIComponent(gmailId) + "?format=full");
  const part = findCal(m.payload)[0];
  if (!part) throw new E("This mail has no calendar invite", 404);
  let data = part.body?.data || "";
  if (!data && part.body?.attachmentId) data = (await api(gt, GM + "messages/" + encodeURIComponent(gmailId) + "/attachments/" + part.body.attachmentId)).data || "";
  const ics = parseIcs(decB64u(data));
  if (!ics.uid) throw new E("The invite in this mail can't be read", 422);
  return ics;
}
async function eventOf(box, uid) {
  const ct = await gToken(box, CAL);
  const j = await api(ct, GC + "events?iCalUID=" + encodeURIComponent(uid) + "&showDeleted=true&maxResults=5");
  return { ct, ev: (j.items || [])[0] || null };
}
var mine = (ev, box) => (ev?.attendees || []).find((a) => a.self || String(a.email || "").toLowerCase() === box.toLowerCase());
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json().catch(() => ({}));
    const a = String(p.action || "");
    if (a === "check") {
      const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
      if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
      const box = String(p.box || "marketing@rugscreation.com");
      if (p.gmailId) {
        const ics = await inviteOf(box, String(p.gmailId));
        const { ev } = await eventOf(box, ics.uid);
        return out({ ok: true, box, invite: { ...ics, uid: ics.uid.slice(0, 12) + "\u2026" }, inCalendar: !!ev, eventStatus: ev?.status || "", response: mine(ev, box)?.responseStatus || "" });
      }
      const ct = await gToken(box, CAL);
      const j = await api(ct, GC + "events?maxResults=1&singleEvents=true&timeMin=" + encodeURIComponent((/* @__PURE__ */ new Date()).toISOString()));
      return out({ ok: true, box, calendar: "reachable", upcoming: (j.items || []).length });
    }
    const u = await me(p.token);
    if (a === "events") {
      const from = new Date(Number(p.from) || Date.now() - 31 * 864e5), to = new Date(Number(p.to) || Date.now() + 62 * 864e5);
      if (to.getTime() - from.getTime() > 100 * 864e5) throw new E("Ask for at most 100 days");
      const ct = await gToken(String(u.login).toLowerCase(), CAL);
      const items = [];
      let pt = "";
      do {
        const j = await api(ct, GC + "events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=" + encodeURIComponent(from.toISOString()) + "&timeMax=" + encodeURIComponent(to.toISOString()) + (pt ? "&pageToken=" + pt : ""));
        for (const e of j.items || []) if (e.status !== "cancelled") items.push({
          id: e.id,
          title: e.summary || "(no title)",
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          allDay: !e.start?.dateTime,
          location: e.location || "",
          meet: e.hangoutLink || "",
          link: e.htmlLink || "",
          organizer: e.organizer?.email || "",
          response: mine(e, u.login)?.responseStatus || (e.organizer?.self ? "organizer" : "")
        });
        pt = j.nextPageToken || "";
      } while (pt && items.length < 1e3);
      return out({ ok: true, calendar: u.login, events: items });
    }
    if (a === "invite" || a === "rsvp") {
      const box = await needBox(u, p.mailbox);
      const gmailId = String(p.gmailId || "");
      if (!/^[0-9a-f]{8,24}$/i.test(gmailId)) throw new E("Mail id missing");
      const ics = await inviteOf(box, gmailId);
      let { ct, ev } = await eventOf(box, ics.uid);
      if (a === "invite") return out({ ok: true, invite: { ...ics, inCalendar: !!ev, eventCancelled: ev?.status === "cancelled", response: mine(ev, box)?.responseStatus || "", link: ev?.htmlLink || "" } });
      const resp = String(p.response || "");
      if (!["accepted", "tentative", "declined"].includes(resp)) throw new E("Pick Accept, Maybe or Decline");
      if (ics.cancelled || ev?.status === "cancelled") throw new E("This meeting was cancelled");
      if (!ev) {
        const st = ics.start, en = ics.end || ics.start;
        const dt = (x) => x?.allDay ? { date: x.date } : { dateTime: x?.local + (x?.utc ? "Z" : ""), timeZone: x?.utc ? "UTC" : x?.tz || "Asia/Kolkata" };
        ev = await api(ct, GC + "events/import", { method: "POST", body: JSON.stringify({
          iCalUID: ics.uid,
          summary: ics.summary,
          location: ics.location,
          start: dt(st),
          end: dt(en),
          organizer: { email: ics.organizer },
          attendees: [{ email: box, responseStatus: "needsAction" }]
        }) });
      }
      const att = (ev.attendees || []).slice();
      const i = att.findIndex((x) => x.self || String(x.email || "").toLowerCase() === box);
      if (i >= 0) att[i] = { ...att[i], responseStatus: resp };
      else att.push({ email: box, responseStatus: resp });
      const upd = await api(ct, GC + "events/" + encodeURIComponent(ev.id) + "?sendUpdates=all", { method: "PATCH", body: JSON.stringify({ attendees: att }) });
      await sb.from("rm_activity").insert({ mailbox: box, gmail_thread_id: String(p.threadId || "").slice(0, 40) || gmailId, user_id: u.id, kind: "n", text: "\u{1F4C5} Invite " + { accepted: "accepted", tentative: "answered Maybe", declined: "declined" }[resp] + " by " + u.name + ": " + ics.summary });
      return out({ ok: true, response: mine(upd, box)?.responseStatus || resp, link: upd.htmlLink || "" });
    }
    throw new E("Unknown action");
  } catch (e) {
    const err = e;
    return out({ ok: false, error: err.message || "Something went wrong" }, err.code || 500);
  }
});
