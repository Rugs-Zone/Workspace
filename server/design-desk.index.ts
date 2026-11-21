// design-desk — Rugs Creation Design Desk (14 Nov 2026).
// Work mail: the Design TL mailbox (dd_config.mailbox). The TL assigns each mail to a designer.
// A designer either uploads a photo / file path (Done) or replies. Replies go out FROM the TL mailbox,
// with "Replied by: <designer>" added and the From name "<designer> – Design Team".
// Own mail: each designer's old mailbox (dd_users.email) — last 90 days + new ones — shown on their dashboard (dd_mails.own = true).
// History: TL mailbox since 2019 (dd_config.tl_history_days) imported as status "Old". Backfill + live sync run from pg_cron (action "cron").
// Files: every real attachment indexed in dd_files and copied to the TL's Google Drive, folder "Design Desk Files" (action "cron" with job "files").
// Google: the Rugs Email service account (RUGS_SA_JSON / GOOGLE_SA_JSON) with domain-wide delegation.
// Login: PIN (dd_users.pin_hash = sha256("dd:" + pin)). Sessions: dd_sessions.token_hash = sha256(token).
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class E extends Error { constructor(m: string, public code = 400) { super(m); } }

const CFG = {
  LIVE_Q: "in:inbox newer_than:14d",
  NOT_JUNK: " -in:spam -in:trash -in:chats -in:drafts",
  TL_HISTORY_DAYS: 730,
  OWN_HISTORY_DAYS: 90,
  TEAM_NAME: "Design Team, Rugs Creation",
  FROM_SUFFIX: " – Design Team",
  MAX_FILE_MB: 10,
  SESSION_HOURS: 12,
  SYNC_EVERY_SEC: 60,
  // was 100000 — far past the Edge Function's real CPU/wall-clock budget, so every tick crashed
  // ("CPU Time exceeded" / "Memory limit exceeded") and the next cron tick (every ~1 min) restarted
  // it from scratch. 10s keeps each tick small and safe; the saved bf:/fx: progress in dd_config
  // means it still finishes the same backfill over many small ticks instead of one huge one.
  CRON_BUDGET_MS: 10000,
  FILES_BUDGET_MS: 25000, // 21 Nov 2026: the copying step is no longer memory-bound, so give it a real share
  BUCKET: "design-desk",
  BATCH: 4, // concurrent Gmail calls per step — was 10, too much memory per tick
  LOCK_TTL_MS: 150000, // skip a tick if the previous one (same job) hasn't finished within this.
  // 21 Nov 2026: was 30000, which is SHORTER than a files run is now allowed to take - the next
  // tick would have treated a healthy run as stale and started a second one on top of it. 150 s is
  // the function's own wall-clock limit, so a run is only ever treated as dead once it really is.
};
const READ = "https://www.googleapis.com/auth/gmail.readonly";
const SEND = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.modify"];
const GM = "https://gmail.googleapis.com/gmail/v1/users/me/";
const LIST_COLS = "thread_id,mailbox,own,received,from_addr,subject,snippet,status,assigned_to,assigned_name,assigned_at,done_at,replied_by,replied_at";

// ---------- small helpers ----------
async function sha(t: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const pinHash = (pin: string) => sha("dd:" + pin);
function bytesToB64(bytes: Uint8Array) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
const b64u = (d: ArrayBuffer | string | Uint8Array) => bytesToB64(typeof d === "string" ? new TextEncoder().encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const u2s = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");
const decB64u = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(u2s(s)), (c) => c.charCodeAt(0)));
const clean = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, n);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const encWord = (s: string) => /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + bytesToB64(new TextEncoder().encode(s)) + "?=";
const wrap76 = (s: string) => s.replace(/(.{76})/g, "$1\r\n");
const addrOf = (s: string) => ((String(s || "").match(/<([^>]+)>/) || [])[1] || String(s || "")).trim().toLowerCase();
const nowIso = () => new Date().toISOString();
// "Ã¢Â€Â“" style text (UTF-8 read twice as Windows-1252) back to normal
const CP1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
function fixMoji(v: string) {
  let s = String(v || "");
  for (let i = 0; i < 3 && /[ÃÂâ][\u0080-\u00ff\u0152-\u2122]/.test(s); i++) {
    const bytes: number[] = []; let ok = true;
    for (const ch of s) { const c = ch.charCodeAt(0); if (c < 256) bytes.push(c); else { const k = CP1252.indexOf(ch); if (k < 0) { ok = false; break; } bytes.push(0x80 + k); } }
    if (!ok) break;
    const t = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    if (t.includes("\ufffd") || t === s) break;
    s = t;
  }
  return s;
}
const unent = (s: string) => String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

async function getCfg(key: string) { const { data } = await sb.from("dd_config").select("value").eq("key", key).maybeSingle(); return String(data?.value || ""); }
async function setCfg(key: string, value: string) { await sb.from("dd_config").upsert({ key, value }); }
async function log(user: string, action: string, thread = "", detail = "") { await sb.from("dd_log").insert({ user_name: user, action, thread_id: thread, detail: detail.slice(0, 500) }).then(() => {}, () => {}); }

// The two cron schedules (design-desk-1min, design-desk-files) tick every ~1 minute each.
// If one run is still finishing (or crashed without clearing its lock) when the next tick for the
// SAME job fires, skip instead of piling a second run on top — that overlap is what was driving
// the repeated memory/CPU crashes and the matching spike in Gmail/Drive network traffic.
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T | { skipped: "already running" }> {
  const key = "lock:" + name;
  const since = Number(await getCfg(key)) || 0;
  if (since && Date.now() - since < CFG.LOCK_TTL_MS) return { skipped: "already running" };
  await setCfg(key, String(Date.now()));
  try { return await fn(); } finally { await setCfg(key, "0"); }
}

// ---------- Google (service account, domain-wide delegation) ----------
function saJson(): any { let v = (Deno.env.get("RUGS_SA_JSON") || Deno.env.get("GOOGLE_SA_JSON") || "").trim(); if (!v) return {}; if (!v.startsWith("{")) v = "{" + v; if (!v.endsWith("}")) v = v + "}"; return JSON.parse(v); }
const tokCache = new Map<string, { t: string; exp: number }>();
async function gToken(sub: string, scope: string) {
  const k = sub + "|" + scope, c = tokCache.get(k); if (c && c.exp > Date.now() + 60000) return c.t;
  const sa = saJson(); if (!sa.private_key) throw new E("Google service account is not set", 500);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, sub, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3000 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\\n/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (x) => x.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + b64u(sig) }) });
  const j = await r.json();
  if (!j.access_token) throw new E("Google sign-in for " + sub + " failed: " + (j.error_description || j.error), /unauthorized_client/i.test(String(j.error)) ? 403 : 502);
  tokCache.set(k, { t: j.access_token, exp: Date.now() + 3000 * 1000 });
  return j.access_token as string;
}
async function sendToken(box: string) {
  let last: unknown;
  for (const s of SEND) { try { return await gToken(box, s); } catch (e) { last = e; } }
  throw last;
}
async function api(tok: string, url: string, init?: RequestInit) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 1000 * (i + 1))); continue; }
    const t = await r.text(); let j: any = {}; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
    if (!r.ok) throw new E(j.error?.message || ("Google " + r.status), r.status === 404 ? 404 : 502);
    return j;
  }
  throw new E("Google is busy, try again", 503);
}
async function tlBox() { const b = (await getCfg("mailbox")).toLowerCase(); if (!b) throw new E("TL mailbox is not set yet. Ask the admin.", 500); return b; }
const hdr = (m: any, name: string) => String(((m.payload?.headers || []).find((h: any) => String(h.name).toLowerCase() === name.toLowerCase()) || {}).value || "");

// ---------- sessions ----------
async function me(token: unknown) {
  const t = String(token || ""); if (t.length < 16 || t.length > 200) throw new E("SESSION_EXPIRED", 401);
  const { data: s } = await sb.from("dd_sessions").select("user_id,expires_at").eq("token_hash", await sha(t)).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) throw new E("SESSION_EXPIRED", 401);
  const { data: u } = await sb.from("dd_users").select("id,name,role,active,email").eq("id", s.user_id).maybeSingle();
  if (!u || !u.active) throw new E("SESSION_EXPIRED", 401);
  return u as { id: string; name: string; role: "TL" | "Designer"; email: string | null };
}
async function login(pin: unknown) {
  const p = String(pin || "").trim();
  const since = new Date(Date.now() - 10 * 60000).toISOString();
  const { count } = await sb.from("dd_log").select("id", { count: "exact", head: true }).eq("action", "Login failed").gte("at", since);
  if ((count || 0) >= 20) throw new E("Too many wrong PINs. Wait 10 minutes.", 429);
  if (!/^\d{4,8}$/.test(p)) { await log("-", "Login failed"); throw new E("Wrong PIN", 401); }
  const { data: u } = await sb.from("dd_users").select("id,name,role,active").eq("pin_hash", await pinHash(p)).maybeSingle();
  if (!u || !u.active) { await log("-", "Login failed"); throw new E("Wrong PIN", 401); }
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  await sb.from("dd_sessions").delete().lt("expires_at", nowIso());
  await sb.from("dd_sessions").insert({ token_hash: await sha(token), user_id: u.id, expires_at: new Date(Date.now() + CFG.SESSION_HOURS * 3600e3).toISOString() });
  await log(u.name, "Login");
  return { token, name: u.name, role: u.role, isDefaultPin: u.role === "TL" && p === "1234" };
}

// ---------- sync one mailbox (one page of threads) ----------
// mode.kind: "live" (TL inbox, new work → New) | "history" (TL past years → Old) | "own" (designer mailbox → Own mail)
type Mode = { kind: "live" | "history" | "own"; userId?: string; userName?: string };
async function syncBox(box: string, q: string, mode: Mode, pageToken = "") {
  const tok = await gToken(box, READ);
  const list = await api(tok, GM + "threads?maxResults=100&q=" + encodeURIComponent(q) + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""));
  const threads: any[] = list.threads || [];
  let added = 0;
  if (threads.length) {
    const { data: have } = await sb.from("dd_mails").select("thread_id,mailbox,history_id,msg_count,assigned_to,status,own,replied_by").in("thread_id", threads.map((t) => t.id));
    const known = new Map<string, any>((have || []).map((r: any) => [r.thread_id, r]));
    const todo = threads.filter((t) => {
      const r = known.get(t.id);
      if (!r) return true;
      if ((r.mailbox || box) !== box) return false;         // same id in another mailbox: leave it
      return mode.kind !== "history" && r.history_id !== t.historyId;
    });
    for (let i = 0; i < todo.length; i += CFG.BATCH) {
      await Promise.all(todo.slice(i, i + CFG.BATCH).map(async (t) => {
        const th = await api(tok, GM + "threads/" + t.id + "?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject");
        const msgs: any[] = th.messages || [];
        if (!msgs.length) return;
        const fromOther = (m: any) => addrOf(hdr(m, "From")) !== box;
        const lastM = msgs[msgs.length - 1];
        const row: any = known.get(t.id);
        if (row) {
          const upd: any = { history_id: t.historyId, msg_count: msgs.length, updated_at: nowIso() };
          if (msgs.length > row.msg_count && fromOther(lastM)) {
            if (!row.own) upd.status = row.assigned_to ? "New reply" : "New";
            upd.received = new Date(Number(lastM.internalDate)).toISOString();
            upd.snippet = clean(fixMoji(unent(lastM.snippet)), 220);
          } else if (msgs.length > row.msg_count && !row.own && ["New", "New reply", "Assigned"].includes(row.status)) {
            // someone answered straight from Gmail
            upd.status = "Replied"; upd.replied_by = row.replied_by || "Gmail"; upd.replied_at = new Date(Number(lastM.internalDate)).toISOString();
          }
          await sb.from("dd_mails").update(upd).eq("thread_id", t.id);
          return;
        }
        const first = msgs.find(fromOther);
        if (!first && mode.kind === "live") return; // only TL's own sent mail — not a work item
        const from = first ? hdr(first, "From") : "To: " + hdr(msgs[0], "To");
        const ins: any = {
          thread_id: t.id, mailbox: box, own: mode.kind === "own", history_id: t.historyId, msg_count: msgs.length,
          status: mode.kind === "own" ? "Own mail" : mode.kind === "history" ? "Old" : fromOther(lastM) ? "New" : "Replied",
          received: new Date(Number(lastM.internalDate)).toISOString(), from_addr: clean(fixMoji(from), 300),
          subject: clean(fixMoji(hdr(msgs[0], "Subject")), 300) || "(no subject)", snippet: clean(fixMoji(unent(lastM.snippet)), 220),
        };
        if (mode.kind === "own") { ins.assigned_to = mode.userId; ins.assigned_name = mode.userName; }
        const { error } = await sb.from("dd_mails").upsert(ins, { onConflict: "thread_id", ignoreDuplicates: true });
        if (!error) added++;
      }));
    }
  }
  return { next: String(list.nextPageToken || ""), seen: threads.length, added };
}

async function liveSync(force = false) {
  const last = Number(await getCfg("last_sync")) || 0;
  if (!force && Date.now() - last < CFG.SYNC_EVERY_SEC * 1000) return;
  await setCfg("last_sync", String(Date.now()));
  const box = await tlBox();
  let pt = "";
  for (let i = 0; i < 5; i++) { const r = await syncBox(box, CFG.LIVE_Q, { kind: "live" }, pt); if (!r.next) break; pt = r.next; }
}

async function designers() {
  const { data } = await sb.from("dd_users").select("id,name,email").eq("role", "Designer").eq("active", true).not("email", "is", null);
  return (data || []).filter((d: any) => /@/.test(d.email || ""));
}

// cron: live TL sync, new mail in designer mailboxes, then history backfill until the time budget is used
async function cronTick() {
  const t0 = Date.now(), report: any = { live: "", own: [], backfill: [] };
  try { await liveSync(true); report.live = "ok"; } catch (e) { report.live = (e as Error).message; }
  const ds = await designers();
  for (const d of ds) {
    try { await syncBox(d.email.toLowerCase(), "newer_than:2d" + CFG.NOT_JUNK, { kind: "own", userId: d.id, userName: d.name }); report.own.push(d.email + " ok"); }
    catch (e) { report.own.push(d.email + " " + (e as Error).message); }
  }
  const jobs: { box: string; q: string; mode: Mode }[] = [
    { box: await tlBox(), q: "newer_than:" + (Number(await getCfg("tl_history_days")) || CFG.TL_HISTORY_DAYS) + "d" + CFG.NOT_JUNK, mode: { kind: "history" } },
    ...ds.map((d: any) => ({ box: d.email.toLowerCase(), q: "newer_than:" + CFG.OWN_HISTORY_DAYS + "d" + CFG.NOT_JUNK, mode: { kind: "own" as const, userId: d.id, userName: d.name } })),
  ];
  for (const j of jobs) {
    const key = "bf:" + j.box;
    let st: any = {}; try { st = JSON.parse(await getCfg(key) || "{}"); } catch { st = {}; }
    if (st.done) { report.backfill.push(j.box + " done (" + (st.added || 0) + ")"); continue; }
    while (Date.now() - t0 < CFG.CRON_BUDGET_MS) {
      try {
        const r = await syncBox(j.box, j.q, j.mode, st.pt || "");
        st = { pt: r.next, added: (st.added || 0) + r.added, seen: (st.seen || 0) + r.seen, done: !r.next, at: nowIso() };
        await setCfg(key, JSON.stringify(st));
        if (st.done) break;
      } catch (e) {
        st.error = (e as Error).message; st.at = nowIso(); await setCfg(key, JSON.stringify(st));
        break;
      }
    }
    report.backfill.push(j.box + (st.done ? " done" : " running") + " (" + (st.added || 0) + ")" + (st.error ? " " + st.error : ""));
    if (Date.now() - t0 >= CFG.CRON_BUDGET_MS) break;
  }
  return report;
}

// ---------- files: index every real attachment + keep a backup copy in Google Drive ----------
const FILE_BACKUP_MAX = 25 * 1048576;
// 21 Nov 2026: how much file one cron tick may handle, and how many goes a single file gets
// before it is set aside.
// Memory is now bounded by the BIGGEST SINGLE file (FILE_BACKUP_MAX, 25 MB), not by the total,
// because each one is streamed, written to Drive and released before the next is picked up. So
// TICK_BYTES is only about not hogging the worker and the Gmail/Drive quota for a whole run: most
// of these files are 0.3-8 MB .tif, so this is several of them a tick, and a single big one ends
// the tick early. BACKUP_TRIES is the real safety net: a file that still kills the run is set
// aside after this many goes instead of being picked again for ever.
const TICK_BYTES = 80 * 1048576;
const BACKUP_TRIES = 3;
const KINDS: Record<string, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic"],
  pdf: ["pdf"],
  design: ["ai", "psd", "cdr", "eps", "svg", "dwg", "dxf", "ned", "indd", "sketch", "fig"],
  office: ["xls", "xlsx", "xlsm", "csv", "doc", "docx", "ppt", "pptx", "txt"],
  zip: ["zip", "rar", "7z", "gz", "tar"],
};
function kindOf(name: string, mime: string) {
  const ext = (String(name).match(/\.([a-z0-9]{1,6})$/i) || [])[1]?.toLowerCase() || "";
  for (const k of Object.keys(KINDS)) if (KINDS[k].includes(ext)) return { ext, kind: k };
  if (/^image\//.test(mime)) return { ext, kind: "image" };
  if (/pdf/.test(mime)) return { ext, kind: "pdf" };
  return { ext, kind: "other" };
}
// real attachments only: skip signature logos / small inline images
function fileParts(p: any, out: any[] = []) {
  if (!p) return out;
  const mt = String(p.mimeType || "").toLowerCase();
  if (p.filename && p.body?.attachmentId) {
    const disp = partHdr(p, "content-disposition").toLowerCase();
    const size = Number(p.body.size || 0);
    const img = /^image\//.test(mt);
    const junk = img && (size < 20000 || (disp.startsWith("inline") && size < 150000));
    if (!junk) out.push({ part: String(p.partId || ""), name: p.filename, mime: mt, size });
  }
  for (const c of p.parts || []) fileParts(c, out);
  return out;
}
async function scanFiles(box: string, q: string, pageToken: string) {
  const tok = await gToken(box, READ);
  const list = await api(tok, GM + "messages?maxResults=100&q=" + encodeURIComponent("has:attachment " + q) + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""));
  const ids: string[] = (list.messages || []).map((m: any) => m.id);
  let added = 0;
  if (ids.length) {
    const { data: seen } = await sb.from("dd_file_msgs").select("message_id").in("message_id", ids);
    const done = new Set((seen || []).map((r: any) => r.message_id));
    const todo = ids.filter((id) => !done.has(id));
    for (let i = 0; i < todo.length; i += CFG.BATCH) {
      await Promise.all(todo.slice(i, i + CFG.BATCH).map(async (id) => {
        const m = await api(tok, GM + "messages/" + id + "?format=full&fields=id,threadId,internalDate,payload(partId,filename,mimeType,headers,body(size,attachmentId),parts(partId,filename,mimeType,headers,body(size,attachmentId),parts(partId,filename,mimeType,headers,body(size,attachmentId),parts(partId,filename,mimeType,headers,body(size,attachmentId),parts(partId,filename,mimeType,headers,body(size,attachmentId))))))");
        const rows = fileParts(m.payload).map((f) => {
          const k = kindOf(f.name, f.mime);
          return { mailbox: box, thread_id: m.threadId, message_id: m.id, part_id: f.part || f.name, name: clean(fixMoji(f.name), 250), mime: f.mime, ext: k.ext, kind: k.kind, size: f.size,
            sent_at: new Date(Number(m.internalDate)).toISOString(), from_addr: clean(fixMoji(hdr(m, "From")), 300), subject: clean(fixMoji(hdr(m, "Subject")), 300) };
        });
        if (rows.length) { const { error } = await sb.from("dd_files").upsert(rows, { onConflict: "message_id,part_id", ignoreDuplicates: true }); if (!error) added += rows.length; }
        await sb.from("dd_file_msgs").upsert({ message_id: m.id, mailbox: box });
      }));
    }
  }
  return { next: String(list.nextPageToken || ""), added };
}
// find the current Gmail attachment id of a stored file (Gmail ids are not stable)
// 21 Nov 2026: read an attachment off the response body as it arrives.
// It used to be  Uint8Array.from(atob(pad64(String(j.data))), c => c.charCodeAt(0))  on the result
// of res.json(). For a 25 MB file that keeps the raw body (~33 MB of base64), the parsed JS string
// (33 MB at 2 bytes a character = 66 MB) and atob's binary string (50 MB) alive at the same time -
// over 130 MB, and "Memory limit exceeded" killed the whole function, Rugs Email's requests with
// it. Decoding each whole 4-character group as it arrives means the only big thing in memory is
// the file. A base64 tail split across two network chunks is carried over, so nothing is lost.
async function attBytes(res: Response, size: number) {
  if (!res.ok) throw new E("Gmail " + res.status + " while reading the file", res.status === 404 ? 404 : 502);
  let out = new Uint8Array(Math.ceil((size || 0) * 1.05) + 1024), o = 0;
  const grow = (need: number) => {
    if (o + need <= out.length) return;
    const n = new Uint8Array(Math.max(out.length * 2, o + need));
    n.set(out.subarray(0, o)); out = n;
  };
  const put = (b64: string) => {
    const n = b64.length - (b64.length % 4);
    if (!n) return b64;
    const s2 = atob(b64.slice(0, n).replace(/-/g, "+").replace(/_/g, "/"));
    grow(s2.length);
    for (let k = 0; k < s2.length; k++) out[o++] = s2.charCodeAt(k);
    return b64.slice(n);
  };
  const td = new TextDecoder();
  let head = "", tail = "", inData = false, ended = false;
  for await (const c of (res.body as any)) {
    if (ended) continue;
    let t = td.decode(c, { stream: true });
    if (!inData) {
      head += t;
      const i = head.indexOf('"data"');
      const c2 = i < 0 ? -1 : head.indexOf(":", i);
      const q2 = c2 < 0 ? -1 : head.indexOf('"', c2);
      if (q2 < 0) { if (head.length > 8192) head = head.slice(-8192); continue; }
      t = head.slice(q2 + 1); head = ""; inData = true;
    }
    const q = t.indexOf('"');
    if (q >= 0) { t = t.slice(0, q); ended = true; }
    tail = put(tail + t);
  }
  if (!inData) throw new E("Gmail sent no file data", 502);
  if (tail) { let p = tail; while (p.length % 4) p += "="; put(p); }
  return out.subarray(0, o);
}
async function fileBytes(f: any) {
  const tok = await gToken(f.mailbox, READ);
  const m = await api(tok, GM + "messages/" + f.message_id + "?format=full&fields=payload(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId),parts(partId,filename,body(attachmentId))))))");
  let found: any = null;
  const look = (p: any) => { if (!p || found) return; if ((String(p.partId) === f.part_id || p.filename === f.name) && p.body?.attachmentId) { found = p; return; } (p.parts || []).forEach(look); };
  look(m.payload);
  if (!found) throw new E("This file is no longer in Gmail", 404);
  const url = GM + "messages/" + f.message_id + "/attachments/" + encodeURIComponent(found.body.attachmentId);
  const res = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
  return await attBytes(res, f.size || 0);
}
// ----- backup to Google Drive (TL mailbox's Drive, folder "Design Desk Files/<mailbox>/<year>/<date — mail subject>") -----
const DRIVE = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"];
const DRV = "https://www.googleapis.com/drive/v3/files";
async function driveToken(box: string) {
  let last: unknown;
  for (const s of DRIVE) { try { return await gToken(box, s); } catch (e) { last = e; } }
  throw last;
}
async function driveFolder(tok: string, name: string, parent: string | null, key: string) {
  const cached = await getCfg("drv:" + key);
  if (cached) return cached;
  const q = "mimeType='application/vnd.google-apps.folder' and trashed=false and name='" + name.replace(/'/g, "\\'") + "'" + (parent ? " and '" + parent + "' in parents" : " and 'root' in parents");
  const found = await api(tok, DRV + "?fields=files(id)&pageSize=1&q=" + encodeURIComponent(q));
  let id = found.files?.[0]?.id;
  if (!id) {
    const made = await api(tok, DRV + "?fields=id", { method: "POST", body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: parent ? [parent] : undefined }) });
    id = made.id;
  }
  await setCfg("drv:" + key, id);
  return id as string;
}
async function driveUpload(tok: string, parent: string, name: string, mime: string, bytes: Uint8Array, desc: string) {
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", {
    method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime || "application/octet-stream", "X-Upload-Content-Length": String(bytes.length) },
    body: JSON.stringify({ name, parents: [parent], description: desc.slice(0, 900) }),
  });
  if (!start.ok) { const t = await start.text(); throw new Error("Drive: " + (t.match(/"message":\s*"([^"]+)/)?.[1] || start.status)); }
  const loc = start.headers.get("location"); if (!loc) throw new Error("Drive: no upload address");
  const put = await fetch(loc, { method: "PUT", headers: { "Content-Type": mime || "application/octet-stream" }, body: bytes as unknown as BodyInit });
  const j = await put.json().catch(() => ({}));
  if (!put.ok || !j.id) throw new Error("Drive upload failed (" + put.status + ")");
  return { id: j.id as string, link: String(j.webViewLink || "") };
}
// one Drive folder per mail trail: "2026-11-14 — Fall27 Everyday" (Re:/Fw: removed), under the year it started
function trailName(subject: string, at: string) {
  let s = fixMoji(String(subject || "")).replace(/^\s*((re|fw|fwd|aw|wg)\s*(\[\d+\])?\s*:\s*)+/i, "").replace(/[\\/:*?"<>|#%]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) s = "(no subject)";
  return new Date(at || Date.now()).toISOString().slice(0, 10) + " — " + s.slice(0, 90);
}
async function trailFolder(tok: string, root: string, f: any) {
  const key = "tr:" + f.mailbox + ":" + f.thread_id;
  const cached = await getCfg("drv:" + key);
  if (cached) return cached;
  const { data: first } = await sb.from("dd_files").select("subject,sent_at").eq("thread_id", f.thread_id).order("sent_at", { ascending: true }).limit(1);
  const s0 = first?.[0] || f;
  const yr = String(new Date(s0.sent_at || Date.now()).getFullYear());
  const boxF = await driveFolder(tok, f.mailbox, root, "box:" + f.mailbox);
  const yrF = await driveFolder(tok, yr, boxF, "yr:" + f.mailbox + ":" + yr);
  return await driveFolder(tok, trailName(s0.subject, s0.sent_at), yrF, key);
}
async function driveBytes(tl: string, id: string) {
  const tok = await driveToken(tl);
  const r = await fetch(DRV + "/" + encodeURIComponent(id) + "?alt=media", { headers: { Authorization: "Bearer " + tok } });
  if (!r.ok) throw new E("Could not read the file from Drive (" + r.status + ")", 502);
  return new Uint8Array(await r.arrayBuffer());
}
async function backupFiles(endAt: number) {
  let n = 0;
  const tl = await tlBox();
  // copies made earlier in Supabase Storage: remove them (backups now live in Drive)
  const { data: old } = await sb.from("dd_files").select("id,storage_path").not("storage_path", "is", null).limit(100);
  if (old && old.length) {
    await sb.storage.from(CFG.BUCKET).remove(old.map((o: any) => o.storage_path));
    await sb.from("dd_files").update({ storage_path: null }).in("id", old.map((o: any) => o.id));
  }
  let tok = "";
  try { tok = await driveToken(tl); } catch (e) { return "Drive not allowed: " + (e as Error).message; }
  const root = await driveFolder(tok, "Design Desk Files", null, "root");
  // files saved earlier straight into year folders: move them into their mail-trail folder
  const { data: loose } = await sb.from("dd_files").select("*").not("drive_id", "is", null).eq("trail_ok", false).limit(30);
  for (const f of loose || []) {
    if (Date.now() >= endAt) break;
    try {
      const trF = await trailFolder(tok, root, f);
      const cur = await api(tok, DRV + "/" + f.drive_id + "?fields=parents");
      const rm = (cur.parents || []).filter((x: string) => x !== trF).join(",");
      if (rm || !(cur.parents || []).includes(trF)) await api(tok, DRV + "/" + f.drive_id + "?addParents=" + trF + (rm ? "&removeParents=" + rm : "") + "&fields=id", { method: "PATCH", body: "{}" });
      await sb.from("dd_files").update({ trail_ok: true }).eq("id", f.id);
    } catch (e) { console.error("move", f.id, (e as Error).message); await sb.from("dd_files").update({ trail_ok: true }).eq("id", f.id); }
  }
  // 21 Nov 2026: one file at a time, and the try is written down BEFORE the file is fetched.
  // This used to take five rows at a time and keep going until the time budget, so one tick could
  // line up several 10-25 MB downloads. When a tick was killed for memory, nothing was recorded
  // (a kill never reaches a catch), so the very next tick picked the same files - for ever.
  // That is why 578 of 1,433 runs died and only 180 of 89,247 files had ever been copied, with
  // zero recorded failures. Counting the try first means a file that cannot be copied is set
  // aside after BACKUP_TRIES goes instead of blocking the queue and knocking over the server that
  // Rugs Email is also using.
  let spent = 0;
  while (Date.now() < endAt && spent < TICK_BYTES) {
    const { data } = await sb.from("dd_files").select("*")
      .is("drive_id", null).is("backup_error", null).lt("backup_tries", BACKUP_TRIES)
      .order("sent_at", { ascending: false }).limit(1);
    const f = data && data[0];
    if (!f) break;
    if ((f.size || 0) > FILE_BACKUP_MAX) { await sb.from("dd_files").update({ backup_error: "too big for backup (kept in Gmail)" }).eq("id", f.id); continue; }
    const tries = (f.backup_tries || 0) + 1;
    await sb.from("dd_files").update({ backup_tries: tries }).eq("id", f.id);
    spent += f.size || 0;
    try {
      const bytes = await fileBytes(f);
      const trF = await trailFolder(tok, root, f);
      const up = await driveUpload(tok, trF, f.name, f.mime || "application/octet-stream", bytes, "From: " + (f.from_addr || "") + "\nSubject: " + (f.subject || "") + "\nDate: " + (f.sent_at || ""));
      await sb.from("dd_files").update({ drive_id: up.id, drive_link: up.link, trail_ok: true }).eq("id", f.id);
      n++;
    } catch (e) {
      const why = clean((e as Error).message, 200) || "failed";
      if (tries >= BACKUP_TRIES) await sb.from("dd_files").update({ backup_error: why + " (gave up after " + tries + " goes)" }).eq("id", f.id);
      else console.error("backup try " + tries + " failed for file " + f.id + ": " + why);
    }
  }
  return n;
}
// cron for files: index new attachments (TL since 2019, designers 90 days), then copy them to Drive
async function filesTick() {
  const t0 = Date.now(), budget = CFG.FILES_BUDGET_MS || CFG.CRON_BUDGET_MS, report: any = { scan: [], backup: 0 };
  const tl = await tlBox();
  const days = Number(await getCfg("tl_history_days")) || CFG.TL_HISTORY_DAYS;
  const ds = await designers();
  const jobs = [{ box: tl, days }, ...ds.map((d: any) => ({ box: d.email.toLowerCase(), days: CFG.OWN_HISTORY_DAYS }))];
  // new mail first (cheap), then the history, a page at a time
  for (const j of jobs) { try { await scanFiles(j.box, "newer_than:3d", ""); } catch (e) { report.scan.push(j.box + " " + (e as Error).message); } }
  for (const j of jobs) {
    if (Date.now() - t0 > budget * 0.6) break;
    const key = "fx:" + j.box;
    let st: any = {}; try { st = JSON.parse(await getCfg(key) || "{}"); } catch { st = {}; }
    if (st.done) continue;
    while (Date.now() - t0 < budget * 0.6) {
      try {
        const r = await scanFiles(j.box, "newer_than:" + j.days + "d", st.pt || "");
        st = { pt: r.next, added: (st.added || 0) + r.added, done: !r.next, at: nowIso() };
        await setCfg(key, JSON.stringify(st));
        if (st.done) break;
      } catch (e) { st.error = (e as Error).message; await setCfg(key, JSON.stringify(st)); break; }
    }
    report.scan.push(j.box + (st.done ? " done" : " running") + " (" + (st.added || 0) + ")");
  }
  report.backup = await backupFiles(t0 + budget);
  return report;
}

// ---------- mail rows ----------
async function rowOf(threadId: string) {
  const { data } = await sb.from("dd_mails").select("*").eq("thread_id", clean(threadId, 40)).maybeSingle();
  if (!data) throw new E("Mail not found", 404);
  return data;
}
function canSee(u: any, row: any) { if (u.role !== "TL" && row.assigned_to !== u.id) throw new E("This mail is not assigned to you", 403); }
async function boxOf(row: any) { return String(row.mailbox || await tlBox()).toLowerCase(); }
async function withLinks(row: any) {
  const files = await Promise.all((row.files || []).map(async (f: any) => {
    const { data } = await sb.storage.from(CFG.BUCKET).createSignedUrl(f.path, 3600);
    return { ...f, url: data?.signedUrl || "" };
  }));
  return { ...row, files };
}

// ---------- read one mail ----------
// decode a text part in its own charset (windows-1252, iso-8859-1, gb2312 … not only UTF-8)
function decPart(p: any) {
  const cs = ((partHdr(p, "content-type").match(/charset="?([^";\s]+)/i) || [])[1] || "utf-8").toLowerCase();
  let b64 = u2s(String(p.body.data)); while (b64.length % 4) b64 += "=";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try { return new TextDecoder(cs).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
}
const partHdr = (p: any, name: string) => String(((p.headers || []).find((h: any) => String(h.name).toLowerCase() === name) || {}).value || "");
function walk(p: any, acc: { html: string; text: string; atts: any[] }) {
  if (!p) return acc;
  const mt = String(p.mimeType || "").toLowerCase();
  const cid = partHdr(p, "content-id").replace(/[<>]/g, "").trim();
  const xid = partHdr(p, "x-attachment-id").trim();
  const loc = partHdr(p, "content-location").trim();
  if ((p.filename || cid || xid) && (p.body?.attachmentId || p.body?.data) && !/^text\/(html|plain)$/.test(mt) || (p.filename && p.body?.attachmentId)) {
    acc.atts.push({ name: p.filename || ("image-" + (cid || xid).split("@")[0]), size: p.body.size || 0, id: p.body.attachmentId || "", data: p.body.data || "", cid, xid, loc, mime: mt || "application/octet-stream" });
  } else if (mt === "text/html" && p.body?.data && !acc.html) acc.html = decPart(p);
  else if (mt === "text/plain" && p.body?.data && !acc.text) acc.text = decPart(p);
  for (const c of p.parts || []) walk(c, acc);
  return acc;
}
const pad64 = (s: string) => { s = u2s(s); while (s.length % 4) s += "="; return s; };
// one Gmail message -> html with inline (cid:) images embedded + list of real attachments
async function readMsg(tok: string, m: any) {
  const b = walk(m.payload, { html: "", text: "", atts: [] });
  let html = b.html || ("<pre style='white-space:pre-wrap;font-family:inherit;margin:0'>" + esc(b.text || m.snippet || "") + "</pre>");
  const used = new Set<any>();
  let budget = 8 * 1048576;
  for (const a of b.atts) {
    const keys = [a.cid, a.xid].filter(Boolean).map((k: string) => "cid:" + k);
    if (a.loc) keys.push(a.loc);
    const hit = keys.filter((k) => html.indexOf(k) >= 0);
    if (!hit.length) continue;
    used.add(a);
    if (a.size > budget) continue;
    try {
      const data = a.data || (await api(tok, GM + "messages/" + m.id + "/attachments/" + encodeURIComponent(a.id))).data || "";
      budget -= a.size;
      const uri = "data:" + (/^image\//.test(a.mime) ? a.mime : "image/png") + ";base64," + pad64(String(data));
      for (const k of hit) html = html.split(k).join(uri);
    } catch { /* leave image broken */ }
  }
  return {
    id: m.id, from: fixMoji(hdr(m, "From")), to: fixMoji(hdr(m, "To")), cc: fixMoji(hdr(m, "Cc")), replyTo: hdr(m, "Reply-To"), subject: fixMoji(hdr(m, "Subject")),
    date: new Date(Number(m.internalDate)).toISOString(), html,
    attachments: b.atts.filter((a) => !used.has(a) && (a.id || a.data)).map((a) => ({ name: a.name, size: a.size, id: a.id, mid: m.id, mime: a.mime, data: a.id ? undefined : pad64(String(a.data)) })),
    raw: b.atts,
  };
}
async function getMail(u: any, threadId: string) {
  const row = await rowOf(threadId); canSee(u, row);
  const box = await boxOf(row);
  const tok = await gToken(box, READ);
  const th = await api(tok, GM + "threads/" + row.thread_id + "?format=full");
  const messages = await Promise.all((th.messages || []).map(async (m: any) => { const r: any = await readMsg(tok, m); delete r.raw; return r; }));
  return { info: await withLinks(row), messages, tl: await tlBox(), box };
}
async function getAtt(u: any, threadId: string, mid: string, aid: string, name: string) {
  const row = await rowOf(threadId); canSee(u, row);
  const tok = await gToken(await boxOf(row), READ);
  const j = await api(tok, GM + "messages/" + encodeURIComponent(mid) + "/attachments/" + encodeURIComponent(aid));
  if ((j.size || 0) > CFG.MAX_FILE_MB * 1048576) throw new E("File too big to download here. Ask TL.");
  return { name: clean(name, 200) || "file", data: pad64(String(j.data || "")) };
}

// ---------- uploads ----------
function decodeFiles(files: any) {
  const list = Array.isArray(files) ? files.slice(0, 10) : [];
  return list.map((f: any) => {
    const bytes = Uint8Array.from(atob(String(f.data || "")), (c) => c.charCodeAt(0));
    if (bytes.length > CFG.MAX_FILE_MB * 1048576) throw new E(clean(f.name, 80) + " is bigger than " + CFG.MAX_FILE_MB + " MB");
    return { name: clean(f.name, 150).replace(/[\\/]/g, "_") || "file", mime: clean(f.mime, 100) || "application/octet-stream", bytes };
  });
}

// ---------- send: reply / reply all / forward / new mail (always from the TL mailbox) ----------
function addrList(v: unknown) {
  const parts = String(v || "").split(/[,;](?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of parts) if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(addrOf(s))) throw new E("Check this address: " + s);
  return parts.slice(0, 50);
}
function safeHtml(h: string) {
  return String(h || "").replace(/<(script|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "").replace(/<(script|iframe|object|embed|form)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript:/gi, "");
}
const htmlToText = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function sendMail(u: any, p: any) {
  const mode = ["reply", "all", "forward", "new"].includes(p.mode) ? p.mode : "reply";
  const tl = await tlBox();
  const to = addrList(p.to), cc = addrList(p.cc);
  if (!to.length) throw new E("Add at least one person in To");
  const bodyHtml = safeHtml(clean(p.html, 200000));
  if (!htmlToText(bodyHtml) && mode !== "forward") throw new E("Write your message first");
  const files = decodeFiles(p.files);
  let subject = clean(p.subject, 300), inReply = "", refs = "", quote = "", row: any = null, src = tl, threadKeep = "";
  const fwdFiles: { name: string; mime: string; bytes: Uint8Array }[] = [];

  if (mode !== "new") {
    row = await rowOf(String(p.threadId || "")); canSee(u, row);
    src = await boxOf(row);
    const rtok = await gToken(src, READ);
    const th = await api(rtok, GM + "threads/" + row.thread_id + "?format=metadata&metadataHeaders=From");
    const ms: any[] = th.messages || [];
    const pick = String(p.messageId || "");
    const tm = ms.find((m) => m.id === pick) || [...ms].reverse().find((m) => addrOf(hdr(m, "From")) !== src) || ms[ms.length - 1];
    if (!tm) throw new E("Mail not found", 404);
    const full = await api(rtok, GM + "messages/" + tm.id + "?format=full");
    const orig: any = await readMsg(rtok, full);
    const msgId = hdr(full, "Message-ID");
    if (mode !== "forward" && msgId) { inReply = msgId; refs = [hdr(full, "References"), msgId].filter(Boolean).join(" "); }
    if (!subject) subject = (mode === "forward" ? "Fw: " : "Re: ") + String(orig.subject || row.subject || "").replace(/^(re|fw|fwd):\s*/i, "");
    quote = '<br><div style="border-top:1px solid #e1dfdd;padding-top:8px;margin-top:8px;font-family:Calibri,Arial,sans-serif;font-size:13px">' +
      "<b>From:</b> " + esc(orig.from) + "<br><b>Sent:</b> " + esc(fmtDate(orig.date)) + "<br><b>To:</b> " + esc(orig.to) +
      (orig.cc ? "<br><b>Cc:</b> " + esc(orig.cc) : "") + "<br><b>Subject:</b> " + esc(orig.subject) + "</div><br>" + orig.html;
    if (mode === "forward") {
      let total = 0;
      for (const a of orig.raw || []) {
        if (!a.id && !a.data) continue;
        if (total + a.size > 20 * 1048576) break;
        const data = a.data || (await api(rtok, GM + "messages/" + tm.id + "/attachments/" + encodeURIComponent(a.id))).data || "";
        fwdFiles.push({ name: clean(a.name, 150) || "file", mime: a.mime, bytes: Uint8Array.from(atob(pad64(String(data))), (c) => c.charCodeAt(0)) });
        total += a.size;
      }
    }
    if (src === tl && mode !== "forward") threadKeep = row.thread_id;
  }
  if (!subject) throw new E("Add a subject");

  const sigLabel = mode === "reply" || mode === "all" ? "Replied by" : "Sent by";
  const sig = '<br><div style="color:#555;font-size:13px">--<br><b>' + sigLabel + ": " + esc(u.name) + "</b><br>" + esc(CFG.TEAM_NAME) + "</div>";
  const html = '<div style="font-family:Calibri,Arial,sans-serif;font-size:14px">' + bodyHtml + sig + quote + "</div>";
  const plain = htmlToText(bodyHtml) + "\r\n\r\n--\r\n" + sigLabel + ": " + u.name + "\r\n" + CFG.TEAM_NAME;
  const B1 = "dd_mix_" + crypto.randomUUID().replace(/-/g, ""), B2 = "dd_alt_" + crypto.randomUUID().replace(/-/g, "");
  const enc = (s: string) => wrap76(bytesToB64(new TextEncoder().encode(s)));
  const lines = [
    "From: " + encWord(u.name + CFG.FROM_SUFFIX) + " <" + tl + ">",
    "To: " + to.join(", "),
    ...(cc.length ? ["Cc: " + cc.join(", ")] : []),
    "Subject: " + encWord(subject),
    ...(inReply ? ["In-Reply-To: " + inReply, "References: " + refs] : []),
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="' + B1 + '"', "",
    "--" + B1, 'Content-Type: multipart/alternative; boundary="' + B2 + '"', "",
    "--" + B2, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", enc(plain),
    "--" + B2, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", enc(html),
    "--" + B2 + "--",
  ];
  for (const f of [...fwdFiles, ...files]) {
    lines.push("--" + B1, "Content-Type: " + f.mime + '; name="' + encWord(f.name) + '"', 'Content-Disposition: attachment; filename="' + encWord(f.name) + '"', "Content-Transfer-Encoding: base64", "", wrap76(bytesToB64(f.bytes)));
  }
  lines.push("--" + B1 + "--", "");
  const stok = await sendToken(tl);
  const body: any = { raw: b64u(lines.join("\r\n")) };
  if (threadKeep) body.threadId = threadKeep;
  const sent = await api(stok, GM + "messages/send", { method: "POST", body: JSON.stringify(body) });

  const label = { reply: "Replied", all: "Replied all", forward: "Forwarded", new: "New mail" }[mode as string];
  if (row && mode !== "forward") {
    const upd: any = { status: "Replied", replied_by: u.name, replied_at: nowIso(), updated_at: nowIso() };
    await sb.from("dd_mails").update(upd).eq("thread_id", row.thread_id);
  }
  if (mode === "new" || mode === "forward" || (row && src !== tl)) {
    // the sent mail starts its own conversation in the TL mailbox: keep it on the sender's work list
    await sb.from("dd_mails").upsert({
      thread_id: sent.threadId, mailbox: tl, own: false, status: "Replied", msg_count: 1, received: nowIso(),
      from_addr: clean("To: " + to.join(", "), 300), subject: subject, snippet: clean(htmlToText(bodyHtml), 220),
      assigned_to: u.role === "Designer" ? u.id : null, assigned_name: u.role === "Designer" ? u.name : null,
      replied_by: u.name, replied_at: nowIso(),
    }, { onConflict: "thread_id", ignoreDuplicates: true });
  }
  await log(u.name, String(label), String(row?.thread_id || sent.threadId), subject + " → " + to.join(", "));
  return { threadId: sent.threadId };
}

// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const p = await req.json().catch(() => ({}));
    const a = String(p.action || "");
    if (a === "login") return out({ ok: true, data: await login(p.pin) });
    if (a === "cron") {
      const k = await getCfg("cron_key");
      if (!k || p.cron_key !== k) throw new E("forbidden", 403);
      const job = p.job === "files" ? "files" : "live";
      return out({ ok: true, data: await withLock(job, () => (job === "files" ? filesTick() : cronTick())) });
    }

    const u = await me(p.token);
    const isTL = u.role === "TL";
    const needTL = () => { if (!isTL) throw new E("Only TL can do this", 403); };

    if (a === "logout") { await sb.from("dd_sessions").delete().eq("token_hash", await sha(String(p.token))); return out({ ok: true }); }

    if (a === "list" || a === "refresh") {
      let syncError = "";
      if (a === "refresh") { try { await liveSync(true); } catch (e) { syncError = (e as Error).message; console.error("sync", e); } }
      else { const ls = Number(await getCfg("last_sync")) || 0; if (Date.now() - ls > 10 * 60000) syncError = "Mail has not synced for " + Math.round((Date.now() - ls) / 60000) + " min"; }
      const own = p.scope === "own";
      const who = isTL ? clean(p.who, 60) : u.id;
      let q = sb.from("dd_mails").select(LIST_COLS).eq("own", own).order("received", { ascending: false }).limit(300);
      if (who) q = q.eq("assigned_to", who);
      const st = Array.isArray(p.statuses) ? p.statuses.map((s: unknown) => clean(s, 20)).slice(0, 10) : [];
      if (st.length) q = q.in("status", st);
      const term = clean(p.q, 80).replace(/[%,()"'\\*:]/g, " ").replace(/\s+/g, " ").trim();
      if (term) q = q.or("subject.ilike.%" + term + "%,from_addr.ilike.%" + term + "%,snippet.ilike.%" + term + "%");
      const { data, error } = await q; if (error) throw error;
      const { data: cnt } = await sb.rpc("dd_counts", { p_own: own, p_user: who || null });
      const counts: Record<string, number> = {}; for (const c of cnt || []) counts[c.status] = Number(c.n);
      const res: any = { user: { name: u.name, role: u.role }, mails: data || [], counts, syncError };
      if (isTL) { const { data: ds } = await sb.from("dd_users").select("id,name,email").eq("role", "Designer").eq("active", true).order("name"); res.designers = ds || []; }
      return out({ ok: true, data: res });
    }

    if (a === "importStatus") {
      needTL();
      const { data } = await sb.from("dd_config").select("key,value").like("key", "bf:%");
      return out({ ok: true, data: (data || []).map((r: any) => { let v: any = {}; try { v = JSON.parse(r.value); } catch { /* */ } return { box: r.key.slice(3), done: !!v.done, added: v.added || 0, error: v.error || "" }; }) });
    }

    if (a === "get") return out({ ok: true, data: await getMail(u, String(p.threadId || "")) });
    if (a === "att") return out({ ok: true, data: await getAtt(u, String(p.threadId || ""), String(p.mid || ""), String(p.aid || ""), String(p.name || "")) });

    if (a === "assign") {
      needTL();
      const row = await rowOf(String(p.threadId || ""));
      if (row.own) throw new E("This is a designer's own mail. It already belongs to them.");
      const { data: d } = await sb.from("dd_users").select("id,name,active,role").eq("id", String(p.designerId || "")).maybeSingle();
      if (!d || !d.active || d.role !== "Designer") throw new E("Pick a designer");
      const status = ["New", "New reply", "Old"].includes(row.status) || row.assigned_to !== d.id ? "Assigned" : row.status;
      await sb.from("dd_mails").update({ assigned_to: d.id, assigned_name: d.name, assigned_at: nowIso(), status, updated_at: nowIso() }).eq("thread_id", row.thread_id);
      await log(u.name, "Assigned to " + d.name, row.thread_id, row.subject || "");
      return out({ ok: true });
    }

    if (a === "done") {
      const row = await rowOf(String(p.threadId || "")); canSee(u, row);
      const path = clean(p.path, 500), note = clean(p.note, 1000);
      const files = decodeFiles(p.files);
      if (!files.length && !path) throw new E("Upload a photo or write a file path");
      const saved = [...(row.files || [])];
      for (const f of files) {
        const key = row.thread_id + "/" + Date.now() + "-" + f.name;
        const { error } = await sb.storage.from(CFG.BUCKET).upload(key, f.bytes, { contentType: f.mime, upsert: false });
        if (error) throw new E("Upload failed: " + error.message, 500);
        saved.push({ name: f.name, path: key, by: u.name, at: nowIso() });
      }
      await sb.from("dd_mails").update({ files: saved, file_path: path || row.file_path, note: note || row.note, status: "Done", done_at: nowIso(), updated_at: nowIso() }).eq("thread_id", row.thread_id);
      await log(u.name, "Marked done", row.thread_id, (files.length ? files.length + " file(s) " : "") + path);
      return out({ ok: true });
    }

    if (a === "send") return out({ ok: true, data: await sendMail(u, p) });

    // ----- files (all attachments) -----
    if (a === "files") {
      const term = clean(p.q, 80).replace(/[%_\\]/g, " ").trim();
      const { data, error } = await sb.rpc("dd_files_list", { p_user: u.id, p_is_tl: isTL, p_q: term, p_kind: clean(p.kind, 20), p_box: isTL ? clean(p.box, 120) : "", p_limit: 200, p_offset: Math.max(0, Number(p.offset) || 0) });
      if (error) throw error;
      const res: any = { files: data || [] };
      if (isTL) { const { data: st } = await sb.rpc("dd_files_stats"); res.stats = st || []; }
      return out({ ok: true, data: res });
    }
    if (a === "file") {
      const { data: f } = await sb.from("dd_files").select("*").eq("id", Number(p.id) || 0).maybeSingle();
      if (!f) throw new E("File not found", 404);
      if (!isTL) {
        const { data: ok } = await sb.from("dd_mails").select("thread_id").eq("thread_id", f.thread_id).eq("assigned_to", u.id).limit(1);
        if (!ok || !ok.length) throw new E("This file is not in your mails", 403);
      }
      if ((f.size || 0) > FILE_BACKUP_MAX) throw new E("This file is very big — open the mail and download it there");
      let bytes: Uint8Array;
      try { bytes = f.drive_id ? await driveBytes(await tlBox(), f.drive_id) : await fileBytes(f); } catch { bytes = await fileBytes(f); }
      return out({ ok: true, data: { name: f.name, mime: f.mime, data: bytesToB64(bytes) } });
    }

    // ----- TL: team (add designers, change PINs, deactivate) -----
    if (a === "team") {
      needTL();
      const { data } = await sb.from("dd_users").select("id,name,role,active,email,created_at").order("role").order("name");
      return out({ ok: true, data: data || [] });
    }
    if (a === "userSave") {
      needTL();
      const id = clean(p.id, 60), name = clean(p.name, 80), pin = String(p.pin || "").trim();
      const role = p.role === "TL" ? "TL" : "Designer";
      if (!id && name.length < 2) throw new E("Write the name");
      if (pin && !/^\d{4,8}$/.test(pin)) throw new E("PIN must be 4 to 8 digits");
      const upd: any = {};
      if (name) upd.name = name;
      if (pin) {
        const h = await pinHash(pin);
        const { data: clash } = await sb.from("dd_users").select("id").eq("pin_hash", h).maybeSingle();
        if (clash && clash.id !== id) throw new E("This PIN is already used. Pick another.");
        upd.pin_hash = h;
      }
      if (typeof p.active === "boolean") {
        if (id === u.id && !p.active) throw new E("You can't deactivate yourself");
        upd.active = p.active;
      }
      if (id) {
        if (p.role) upd.role = role;
        const { error } = await sb.from("dd_users").update(upd).eq("id", id); if (error) throw error;
        if (upd.active === false || upd.pin_hash) await sb.from("dd_sessions").delete().eq("user_id", id).neq("token_hash", await sha(String(p.token)));
        if (upd.name) await sb.from("dd_mails").update({ assigned_name: upd.name }).eq("assigned_to", id);
      } else {
        if (!pin) throw new E("Give a PIN");
        const { error } = await sb.from("dd_users").insert({ name, role, pin_hash: upd.pin_hash }); if (error) throw error;
      }
      await log(u.name, id ? "Edited user" : "Added user", "", name || id);
      return out({ ok: true });
    }

    throw new E("Unknown action");
  } catch (e) {
    const err = e as E;
    if (!err.code || err.code === 500) console.error("design-desk", e);
    return out({ ok: false, error: err.message || "Something went wrong" }, err.code || 500);
  }
});
