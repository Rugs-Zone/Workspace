// Rugs Email — one API for login, admin, mailbox sync (Gmail), send, tracking, Drive copies and Gemini.
// 15 Nov 2026 (v38): an empty Gmail reply (HTTP 204, "no mail in this window") is no longer read as a failure.
// 15 Nov 2026 (v37): one sync at a time (sync_lock), 25-second runs, a window Gmail fails to list is retried instead of skipped,
// Gmail errors say what was answered, and a switched (Switch ID) session is not blocked by "set your own password first".
// 14 Nov 2026: thread pictures limit 40 MB per conversation, big mails keep their HTML; threadPreview (timer key) for checks.
// 14 Nov 2026: To / Cc / Delivered-To saved (rm_messages.delivered_to, rm_threads.to_addrs) for the alias rule.
// Supabase keeps only light tracking data (rm_* tables, RLS on, no client policies). The full mail
// stays in Gmail and is opened live; attachments are copied to each department's Google Drive.
// Google access = service account with domain-wide delegation (secret RUGS_SA_JSON, fallback GOOGLE_SA_JSON).
// Nothing is ever deleted from Gmail.
// 24 Oct 2026: company-wide Gemini hold (deleg_meta "gemini_hold" {on:true}) pauses topic tagging and AI drafts;
// a batch Gemini cannot read is marked checked (no endless retries); tagging runs only from the 1-minute timer.
// 26 Oct 2026 (b): Outlook-style features — Bcc, importance, read receipt, file attachments, schedule send, rules, blocked senders,
// out-of-office replies, pin/snooze/reminders/categories, attachment preview, Gmail search (incl. inside attachments), "someone is replying" presence.
// 26 Oct 2026: lean mail list (no Gmail attachment ids, all rows paged) so old mail shows at sign-in; signature pictures found across the whole conversation.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeBase64Url } from "jsr:@std/encoding@1/base64url";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const DOMAIN = "rugscreation.com";
const DEADLINE_MS = 25000, WINDOW = 1 * 86400, FIRST_DAYS = 30;   // 15 Nov 2026: 25 s (was 45) so one 30-second cron run never overlaps the next
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const ok = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, "Content-Type": "application/json" } });
const bad = (m: string, s = 400) => new Response(JSON.stringify({ error: m }), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class E extends Error { constructor(m: string, public code = 400) { super(m); } }

/* ---------------- Google auth (same service account as mail-sync) ---------------- */
const b64u = (d: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d as ArrayBuffer);
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const decB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const dec = (s: string) => new TextDecoder().decode(decB64u(s));
function saJson(): any {
  let v = (Deno.env.get("RUGS_SA_JSON") || Deno.env.get("GOOGLE_SA_JSON") || "").trim();   // own key first, old shared key as fallback
  if (!v) return {};
  if (!v.startsWith("{")) v = "{" + v;
  if (!v.endsWith("}")) v = v + "}";
  return JSON.parse(v);
}
const tokCache = new Map<string, { t: string; exp: number }>();
async function gToken(sub: string, scope: string): Promise<string> {
  const k = sub + "|" + scope, c = tokCache.get(k);
  if (c && c.exp > Date.now() + 60000) return c.t;
  const sa = saJson();
  if (!sa.private_key) throw new E("Google service account (GOOGLE_SA_JSON) is not set", 500);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, sub, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3000 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\\n/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (x) => x.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + b64u(sig) }) });
  const j = await r.json();
  if (!j.access_token) {
    const why = j.error_description || j.error || "unknown";
    if (/unauthorized_client/i.test(String(j.error))) throw new E(`Google has not allowed ${scope.split("/").pop()} for ${sub}. Add the scope in Admin console → Domain-wide delegation.`, 403);
    throw new E("Google sign-in for " + sub + " failed: " + why, 502);
  }
  tokCache.set(k, { t: j.access_token, exp: Date.now() + 3000 * 1000 });
  return j.access_token;
}
const READ = "https://www.googleapis.com/auth/gmail.readonly";
const SEND = "https://www.googleapis.com/auth/gmail.send";
const DIR = "https://www.googleapis.com/auth/admin.directory.user.readonly";
const DRIVE = "https://www.googleapis.com/auth/drive.file";
const MODIFY = "https://www.googleapis.com/auth/gmail.modify";
async function gmail(tok: string, path: string, init?: RequestInit) {
  // 15 Nov 2026: 3 tries (was 4) with shorter waits, and the error says what Gmail actually answered
  // (status, type, length, first characters) so a bad reply can be understood from the log.
  let last = "";
  for (let i = 0; i < 3; i++) {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, { ...init, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(init?.headers || {}) } });
    if (r.status === 429 || r.status >= 500) { last = "Gmail " + r.status; try { await r.body?.cancel(); } catch { /* ignore */ } await new Promise((s) => setTimeout(s, 1000 * (i + 1))); continue; }
    const txt = await r.text();
    if (!r.ok) throw new E("Gmail " + r.status + ": " + txt.slice(0, 200), r.status === 404 ? 404 : 502);
    // 15 Nov 2026 (v38): Google answers 204 with an empty body when a short reply (fields=…) would be an
    // empty object — a time window with no mail in it, for example. That means "nothing found", NOT a
    // failure. Reading it as a failure is what filled the log with "Gmail sent an incomplete reply" and
    // made whole windows be skipped (and, in v36, their mail never fetched).
    if (r.status === 204 || !txt.trim()) return {};
    try { return JSON.parse(txt); }
    catch {
      last = `Gmail sent an incomplete reply (status ${r.status}, type ${r.headers.get("content-type") || "?"}, ${txt.length} chars: ${txt.slice(0, 120).replace(/\s+/g, " ")})`;
      if (i < 2 && (!init?.method || init.method === "GET")) { await new Promise((s) => setTimeout(s, 600 * (i + 1))); continue; }   // never repeat a send
      throw new E(last, 502);
    }
  }
  throw new E(last || "Gmail is busy, try again", 503);
}

/* ---------------- helpers ---------------- */
const addrs = (s: string) => ((s || "").match(/[\w.+'-]+@[\w-]+(\.[\w-]+)+/g) || []).map((x) => x.toLowerCase());
const isOwn = (e: string) => (e.split("@")[1] || "") === DOMAIN;
const AUTO_RE = /(no-?reply|notification|newsletter|mailer-daemon)/i;   // automatic senders: their threads are closed as "Auto"
// sessions are stored only as a sha256 hash of the token (like deleg_sessions)
async function tokHash(t: unknown): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(t || "")));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const oneLine = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();   // no header injection via line breaks
const nameOf = (h: string) => (h || "").replace(/<.*$/, "").replace(/"/g, "").trim();
function partOf(p: any, mime: string): string {
  if (!p) return "";
  if (p.mimeType === mime && p.body?.data) return dec(p.body.data);
  for (const c of p.parts || []) { const r = partOf(c, mime); if (r) return r; }
  return "";
}
function attachments(p: any, out: any[] = []): any[] {
  if (!p) return out;
  if (p.filename && p.body?.attachmentId) out.push({ id: p.body.attachmentId, name: p.filename, mime: p.mimeType, size: p.body.size || 0 });
  for (const c of p.parts || []) attachments(c, out);
  return out;
}
// pictures pasted inside a mail (logos, screenshots, signature images) are referenced as cid:… — find those parts
function inlineParts(p: any, out: any[] = []): any[] {
  if (!p) return out;
  const hv = (n: string) => (p.headers || []).find((h: any) => h.name.toLowerCase() === n)?.value || "";
  const cid = hv("content-id").replace(/[<>\s]/g, "") || hv("x-attachment-id").trim();
  if (cid && /^image\//i.test(p.mimeType || "")) out.push({ cid, mime: p.mimeType, data: p.body?.data || "", aid: p.body?.attachmentId || "", size: p.body?.size || 0, name: p.filename || "" });
  for (const c of p.parts || []) inlineParts(c, out);
  return out;
}
const toStdB64 = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");
// pool = pictures from every mail in the conversation (a reply often points at the signature logo of an earlier mail)
// cache = one download per picture, reused by every mail that shows it
async function withInlineImages(tok: string, msgId: string, payload: any, html: string, budget: { left: number }, pool: any[] = [], cache = new Map<string, Promise<string>>()) {
  if (!/cid:/i.test(html)) return html;
  const own = inlineParts(payload).map((x) => ({ ...x, mid: msgId }));
  const ownCids = new Set(own.map((x) => x.cid.toLowerCase()));
  const parts = [...own, ...pool.filter((x) => !ownCids.has(String(x.cid).toLowerCase()))];
  await Promise.all(parts.map(async (pt) => {
    const re = new RegExp("cid:" + pt.cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const reName = pt.name ? new RegExp("cid:" + pt.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[\"'])", "gi") : null;
    if (!re.test(html) && !(reName && reName.test(html))) return;
    const ck = (pt.mid || msgId) + "|" + pt.cid;
    if (!cache.has(ck)) {
      if (pt.size > budget.left) return;
      budget.left -= pt.size;
      cache.set(ck, (async () => {
        if (pt.data) return pt.data;
        if (!pt.aid) return "";
        const a = await gmail(tok, `messages/${pt.mid || msgId}/attachments/${pt.aid}`).catch(() => null);
        return a?.data || "";
      })());
    }
    const data = await cache.get(ck)!;
    if (!data) return;
    const uri = `data:${pt.mime};base64,${toStdB64(data)}`;
    html = html.replace(new RegExp(re.source, "gi"), uri);
    if (reName) html = html.replace(new RegExp(reName.source, "gi"), uri);
  }));
  return html;
}
// 18 Nov 2026: "Only the short preview is shown — 546". withInlineImages pasted every picture into EVERY
// mail of the conversation as base64 text, so a long claim trail (15-20 replies quoting the same photos)
// carried the same pictures 15-20 times and the function ran out of memory / CPU (546).
// Now each cid: picture becomes a small link  rmcid:<gmail message id>/<cid>  and the app fetches the
// pictures one by one with the "inlineImg" action below. The mail text arrives at once, never 546.
// 19 Nov 2026: "a 72-mail trail takes far too long" - it did not open at all: a 49-mail conversation
// answered 546 after 7 s and the log said "CPU Time exceeded". This function was the reason. It walked
// EVERY picture of the WHOLE conversation and ran two regular expressions over the WHOLE mail for each
// one, for every mail: 49 mails x ~300 pictures x 2 passes over 100 KB+ of HTML. Now the index is built
// once and the mail is read ONCE, looking each cid: reference up as it goes - the work grows with the
// size of the conversation instead of with its square. A cid nothing matches is left alone, so the app
// never asks Gmail for a picture that does not exist.
function cidIndex(parts: any[], mid?: string) {
  const ix = new Map<string, any>();
  for (const x of parts) {
    const p = { ...x, mid: x.mid || mid };
    const k = String(x.cid || "").toLowerCase(); if (k && !ix.has(k)) ix.set(k, p);
    const n = String(x.name || "").toLowerCase(); if (n && !ix.has(n)) ix.set(n, p);
  }
  return ix;
}
function withCidLinks(msgId: string, payload: any, html: string, all?: Map<string, any>) {
  if (!html || !/cid:/i.test(html)) return html;
  const own = cidIndex(inlineParts(payload), msgId);          // this mail's own pictures win
  return html.replace(/cid:([^"'\s<>)\]]+)/gi, (m0: string, raw: string) => {
    const k = String(raw).toLowerCase();
    const pt = own.get(k) || (all && all.get(k));
    return pt ? `rmcid:${pt.mid || msgId}/${encodeURIComponent(pt.cid)}` : m0;
  });
}
const htmlToText = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n");

/* ---------------- auth + access ---------------- */
async function me(token: string) {
  if (!token) throw new E("Please sign in", 401);
  const { data: s } = await sb.from("rm_sessions").select("user_id,expires_at,switched_by").eq("token_hash", await tokHash(token)).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) throw new E("Your session ended. Please sign in again.", 401);
  const { data: u } = await sb.from("rm_users").select("*").eq("id", s.user_id).maybeSingle();
  if (!u || !u.active) throw new E("This user is deactivated. Ask the admin.", 403);
  u._switched = !!s.switched_by;   // 15 Nov 2026: Switch ID session (admin acting for this person)
  return u;
}
async function depts() { const { data } = await sb.from("rm_departments").select("*").order("created_at"); return data || []; }
const access = (u: any, deptId: string) => u.role === "Admin" ? "full" : u.dept_id === deptId ? "full" : (u.access || {})[deptId] || "";
const can = (u: any, k: string) => u.role === "Admin" || !!(u.perm || {})[k];
async function deptOfBox(box: string) { const { data } = await sb.from("rm_departments").select("*").eq("mailbox", box).maybeSingle(); if (!data) throw new E("Unknown mailbox"); return data; }
async function needBox(u: any, box: string, level: "view" | "full") {
  const d = await deptOfBox(box), a = access(u, d.id);
  if (!a || (level === "full" && a !== "full")) throw new E("You don't have " + (level === "full" ? "full" : "") + " access to " + box, 403);
  return d;
}
/* a transferred thread belongs to its dept_id; otherwise to the mailbox's department */
async function threadAccess(u: any, box: string, tid: string, level: "view" | "full") {
  const { data: t } = await sb.from("rm_threads").select("dept_id").eq("mailbox", box).eq("gmail_thread_id", tid).maybeSingle();
  if (!t) throw new E("Conversation not found", 404);
  const home = await deptOfBox(box);
  const ok = (id: string | null) => { if (!id) return false; const a = access(u, id); return level === "full" ? a === "full" : !!a; };
  if (ok(t.dept_id || home.id) || ok(home.id)) return home;
  throw new E("You don't have access to this conversation", 403);
}
const safeUser =(u: any) => ({ id: u.id, name: u.name, login: u.login, dept_id: u.dept_id, role: u.role, active: u.active, perm: u.perm, access: u.access, profile: u.profile, signature: u.signature, on_leave: u.on_leave, has_password: !!u.pass_hash, must_change: !!u.must_change, prefs: u.prefs || {} });
async function boot(u: any) {
  const [{ data: users }, { data: st }] = await Promise.all([sb.from("rm_users").select("*").order("created_at"), sb.from("rm_settings").select("key,value").in("key", SHARED_KEYS)]);
  const settings: any = {}; (st || []).forEach((r: any) => settings[r.key] = r.value);
  return { me: safeUser(u), depts: await depts(), users: (users || []).map(safeUser), settings, gone: await deletedUsers(), ai: !!Deno.env.get("GEMINI_API_KEY") && !(await aiHeld()) };
}
/* 18 Nov 2026: names of deleted users, { id: { name, login, at, by } } */
async function deletedUsers(): Promise<Record<string, any>> {
  const { data } = await sb.from("rm_settings").select("value").eq("key", "deleted_users").maybeSingle();
  return data?.value && typeof data.value === "object" ? data.value : {};
}
const SHARED_KEYS = ["circulars", "folders", "alerts", "templates", "cats", "rules", "blocked", "contacts_extra"];
const ADMIN_KEYS = ["rules", "blocked", "cats", "folders", "templates", "circulars"];   // only role Admin may change these
async function log(box: string, tid: string, uid: string | null, kind: string, text: string) {
  await sb.from("rm_activity").insert({ mailbox: box, gmail_thread_id: tid, user_id: uid, kind, text });
}

/* ---------------- Gmail sync ---------------- */
async function saveMessage(box: string, m: any, sentBy: string | null = null) {
  const h: Record<string, string> = {};
  const dlv: string[] = [];
  for (const x of m.payload?.headers || []) { const k = x.name.toLowerCase(); h[k] = x.value; if (k === "delivered-to" || k === "x-original-to") dlv.push(x.value); }
  const fromA = addrs(h.from)[0] || "";
  let html = partOf(m.payload, "text/html"), text = partOf(m.payload, "text/plain");
  if (!text && html) text = htmlToText(html.slice(0, 150000));
  const atts = attachments(m.payload);
  const row = {
    mailbox: box, gmail_id: m.id, gmail_thread_id: m.threadId, direction: fromA === box || isOwn(fromA) ? "out" : "in",   // anyone @rugscreation.com = our side
    from_email: fromA, from_name: nameOf(h.from) || fromA, to_text: h.to || "", cc_text: h.cc || "", subject: h.subject || "",
    snippet: m.snippet || "", body_text: text.slice(0, 8000), body_html: "",   // full mail stays in Gmail; opened live (no copy in Supabase)
    sent_at: new Date(Number(m.internalDate)).toISOString(), has_attachments: atts.length > 0, attachments: atts,
    labels: m.labelIds || [], rfc_message_id: h["message-id"] || null, list_unsub: !!h["list-unsubscribe"], delivered_to: dlv.join(", ").slice(0, 1000), ...(sentBy ? { sent_by: sentBy } : {}),
  };
  await sb.from("rm_messages").upsert(row, { onConflict: "mailbox,gmail_id" });
  return row;
}
async function rebuildThread(box: string, tid: string, newIn: boolean) {
  const { data: ms } = await sb.from("rm_messages").select("direction,subject,snippet,sent_at,labels,from_email,from_name,to_text,cc_text,delivered_to,list_unsub").eq("mailbox", box).eq("gmail_thread_id", tid).order("sent_at");
  if (!ms || !ms.length) return;
  // our side = the mailbox or anyone @rugscreation.com; the counterpart is the first EXTERNAL sender
  const ext = (x: any) => x.direction === "in" && !isOwn(String(x.from_email || "").toLowerCase());
  const last = ms[ms.length - 1], firstIn = ms.find(ext);
  const cpEmail = firstIn ? firstIn.from_email : (ms.flatMap((x: any) => addrs(x.to_text)).find((e) => e !== box && !isOwn(e)) || "");
  const cpName = firstIn ? firstIn.from_name : cpEmail;
  const firstReply = firstIn ? ms.find((x: any) => !ext(x) && x.sent_at > firstIn.sent_at) : null;
  const { data: cur } = await sb.from("rm_threads").select("status,owner_id,cats").eq("mailbox", box).eq("gmail_thread_id", tid).maybeSingle();
  // automatic mail (no-reply / notification / newsletter / mailer-daemon sender, or a List-Unsubscribe header) leaves the New list
  const auto = !!firstIn && (AUTO_RE.test(String(cpEmail)) || ms.some((x: any) => ext(x) && x.list_unsub));
  const row: any = {
    mailbox: box, gmail_thread_id: tid, subject: ms[0].subject, snippet: last.snippet, counterpart_email: cpEmail, counterpart_name: cpName,
    msg_count: ms.length, last_msg_at: last.sent_at, has_in: !!firstIn, has_out: ms.some((x: any) => !ext(x)),
    unread: ms.some((x: any) => ext(x) && (x.labels || []).includes("UNREAD")), updated_at: new Date().toISOString(),
    first_reply_at: firstReply ? firstReply.sent_at : null,
    // every To / Cc / Delivered-To address (newest mail first) — used by the alias rule and the "via" tag
    to_addrs: [...new Set([...ms].reverse().flatMap((x: any) => [...addrs(x.to_text), ...addrs(x.cc_text), ...addrs(x.delivered_to)]).map((e: string) => e.toLowerCase()))].slice(0, 40),
  };
  if (auto && (!cur || ((cur.status || "new") === "new" && !cur.owner_id))) {
    const c = Array.isArray(cur?.cats) ? cur.cats : [];
    row.status = "done"; row.done_at = new Date().toISOString(); row.cats = c.includes("auto") ? c : [...c, "auto"];
    await log(box, tid, null, "rule", "Auto-closed — automatic mail (" + cpEmail + ")");
  }
  else if (!auto && cur && cur.status === "done" && newIn && last.direction === "in") { row.status = cur.owner_id ? "open" : "new"; await log(box, tid, null, "reopen", "Reopened — new mail from " + cpName); }
  await sb.from("rm_threads").upsert(row, { onConflict: "mailbox,gmail_thread_id" });
}
// one Gmail time window: list ids, skip ones we already have, save up to `left` new messages
async function syncWindow(box: string, tok: string, from: number, to: number, left: number, t0: number, size = 200) {
  const ids: string[] = []; let pt = "";
  do {
    const j = await gmail(tok, `messages?maxResults=${size}&fields=messages(id),nextPageToken&q=${encodeURIComponent(`after:${from} before:${to} -in:chats -in:spam -in:trash`)}${pt ? "&pageToken=" + pt : ""}`);
    for (const m of j.messages || []) ids.push(m.id);
    pt = j.nextPageToken || "";
  } while (pt && ids.length < 5000);
  const have = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) { const { data } = await sb.from("rm_messages").select("gmail_id").eq("mailbox", box).in("gmail_id", ids.slice(i, i + 300)); (data || []).forEach((x: any) => have.add(x.gmail_id)); }
  const todo = ids.filter((i) => !have.has(i));
  let saved = 0, complete = true;
  for (let i = 0; i < todo.length; i += 4) {
    if (saved >= left || Date.now() - t0 > DEADLINE_MS) { complete = false; break; }
    const touched = new Map<string, boolean>();
    await Promise.all(todo.slice(i, i + 4).map(async (id) => {
      try {
        const m = await gmail(tok, `messages/${id}?format=full`);
        const r = await saveMessage(box, m);
        touched.set(m.threadId, (touched.get(m.threadId) || false) || r.direction === "in");
      } catch (e) { console.log("skip message", box, id, String((e as Error).message).slice(0, 120)); }   // one bad mail must not stop the mailbox
      saved++;
    }));
    for (const [tid, newIn] of touched) await rebuildThread(box, tid, newIn);
  }
  return { scanned: ids.length, saved, complete };
}
async function historyDays() { const { data } = await sb.from("rm_settings").select("value").eq("key", "history_days").maybeSingle(); const n = Number(data?.value); return n >= 7 && n <= 730 ? n : 60; }
async function syncBox(box: string, t0: number, force = false, budget = 25) {
  // Small steps: edge functions have a tight CPU budget, so each call saves at most `budget` new messages.
  // 1) forward: newest mail first priority, until "live"; 2) then older history backwards to `history_days`.
  const { data: st } = await sb.from("rm_mailboxes").select("*").eq("mailbox", box).maybeSingle();
  if (!force && st?.last_sync && Date.now() - new Date(st.last_sync).getTime() < 15000) return { mailbox: box, skipped: true };
  const tok = await gToken(box, READ);
  const nowS = Math.floor(Date.now() / 1000);
  let cursor = Number(st?.cursor_s) || nowS - FIRST_DAYS * 86400;
  let back = Number(st?.back_s) || (Number(st?.cursor_s) ? nowS - FIRST_DAYS * 86400 : cursor);
  let saved = 0, scanned = 0, live = true, skipped = 0, stalled = false;
  while (Date.now() - t0 < DEADLINE_MS) {
    const from = cursor - 3600, to = Math.min(nowS + 60, cursor + WINDOW);
    let r: any;
    try { r = await syncWindow(box, tok, from, to, budget - saved, t0); }
    catch (e) {   // a Gmail hiccup: retry in small pages; if that fails too, keep the cursor where it is
      try { r = await syncWindow(box, tok, from, to, budget - saved, t0, 50); }
      catch (e2) {
        console.log("skip window", box, from, to, String((e2 as Error).message));
        skipped++;
        // 15 Nov 2026: the window used to be marked done and the cursor moved on, so mail that arrived in a
        // window Gmail failed to list was never fetched. Now the cursor stays and the same window is listed
        // again on the next run (30 s later). Only a window older than 6 hours is given up, so a mailbox can't stall for ever.
        if (nowS - cursor < 6 * 3600) { stalled = true; break; }
        r = { saved: 0, scanned: 0, complete: true };
      }
    }
    saved += r.saved; scanned += r.scanned;
    if (!r.complete) { live = false; break; }
    cursor = to > nowS ? nowS - 600 : to;
    await sb.from("rm_mailboxes").upsert({ mailbox: box, cursor_s: cursor }, { onConflict: "mailbox" });   // keep progress even if a later step fails
    if (to > nowS) break;
  }
  live = live && cursor >= nowS - 700;
  const target = nowS - (await historyDays()) * 86400;
  if (live) {
    while (back > target && saved < budget && Date.now() - t0 < DEADLINE_MS) {
      const from = Math.max(target, back - WINDOW);
      let r: any;
      try { r = await syncWindow(box, tok, from, back + 3600, budget - saved, t0); }
      catch { try { r = await syncWindow(box, tok, from, back + 3600, budget - saved, t0, 50); } catch { r = { saved: 0, scanned: 0, complete: true }; skipped++; } }
      saved += r.saved; scanned += r.scanned;
      if (!r.complete) break;
      back = from;
    }
  }
  const histDone = back <= target;
  await sb.from("rm_mailboxes").upsert({ mailbox: box, cursor_s: cursor, back_s: back, last_sync: new Date().toISOString(), status: live ? "live" : "backfilling", note: `scanned ${scanned}, saved ${saved}${skipped ? (stalled ? `, Gmail could not list the latest mail (${skipped}x) - retrying` : `, skipped ${skipped} day(s) Gmail could not list`) : ""}${live ? (histDone ? " · history complete" : " · loading history to " + new Date(target * 1000).toISOString().slice(0, 10) + ", now at " + new Date(back * 1000).toISOString().slice(0, 10)) : ""}` }, { onConflict: "mailbox" });
  return { mailbox: box, scanned, saved, live, history: histDone ? "complete" : new Date(back * 1000).toISOString().slice(0, 10) };
}

/* ---------------- send ---------------- */
function mime(o: { from: string; to: string; cc?: string; bcc?: string; subject: string; html: string; inReplyTo?: string; refs?: string; important?: boolean; receipt?: string; files?: { name: string; type: string; b64: string }[] }) {
  const images: { cid: string; type: string; b64: string }[] = [];
  let n = 0;
  const html = o.html.replace(/<img([^>]*?)src="data:(image\/[a-z+.-]+);base64,([^"]+)"/gi, (_m, a, type, b64) => { const cid = `img${++n}.${Date.now()}@rugsmail`; images.push({ cid, type, b64 }); return `<img${a}src="cid:${cid}"`; });
  const enc = (s: string) => /[^\x20-\x7e]/.test(s) ? "=?UTF-8?B?" + btoa(unescape(encodeURIComponent(s))) + "?=" : s;
  const B = "rm" + crypto.randomUUID().replace(/-/g, "");
  const htmlB64 = btoa(unescape(encodeURIComponent(html))).replace(/(.{76})/g, "$1\r\n");
  let s = `From: ${o.from}\r\nTo: ${o.to}\r\n${o.cc ? `Cc: ${o.cc}\r\n` : ""}${o.bcc ? `Bcc: ${o.bcc}\r\n` : ""}Subject: ${enc(o.subject)}\r\nMIME-Version: 1.0\r\n`;
  if (o.important) s += "X-Priority: 1 (Highest)\r\nImportance: High\r\n";
  if (o.receipt) s += `Disposition-Notification-To: ${o.receipt}\r\nReturn-Receipt-To: ${o.receipt}\r\n`;
  const files = (o.files || []).filter((f) => f && f.name && f.b64);
  const M = "rmm" + crypto.randomUUID().replace(/-/g, "");
  if (o.inReplyTo) s += `In-Reply-To: ${o.inReplyTo}\r\nReferences: ${o.refs || o.inReplyTo}\r\n`;
  if (files.length) s += `Content-Type: multipart/mixed; boundary="${M}"\r\n\r\n--${M}\r\n`;
  s += `Content-Type: multipart/related; boundary="${B}"\r\n\r\n--${B}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${htmlB64}\r\n`;
  for (const im of images) s += `--${B}\r\nContent-Type: ${im.type}\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${im.cid}>\r\nContent-Disposition: inline\r\n\r\n${im.b64.replace(/(.{76})/g, "$1\r\n")}\r\n`;
  s += `--${B}--`;
  if (files.length) {
    for (const f of files) {
      const nm = enc(String(f.name).replace(/["\r\n]/g, ""));
      const ct = /^text\/calendar/i.test(f.type) ? `${f.type}; method=REQUEST; charset=UTF-8` : (f.type || "application/octet-stream");
      s += `\r\n--${M}\r\nContent-Type: ${ct}; name="${nm}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${nm}"\r\n\r\n${String(f.b64).replace(/\s/g, "").replace(/(.{76})/g, "$1\r\n")}`;
    }
    s += `\r\n--${M}--`;
  }
  return s;
}
async function send(u: any, p: any) {
  const box = p.mailbox;
  if (p.threadId) await threadAccess(u, box, p.threadId, "full"); else await needBox(u, box, "full");
  const to = oneLine(p.to); if (!to) throw new E("Add who it goes to");
  let threadId: string | undefined, inReplyTo: string | undefined, refs: string | undefined, subject = p.subject || "(no subject)";
  if (p.threadId) {
    const { data: ms } = await sb.from("rm_messages").select("rfc_message_id,subject").eq("mailbox", box).eq("gmail_thread_id", p.threadId).order("sent_at");
    if (ms && ms.length && !p.forward) { threadId = p.threadId; inReplyTo = ms[ms.length - 1].rfc_message_id || undefined; refs = ms.map((x: any) => x.rfc_message_id).filter(Boolean).slice(-10).join(" "); }
    const base = (ms && ms[0]?.subject) || subject;
    subject = p.forward ? (/^fwd?:/i.test(base) ? base : "Fwd: " + base) : (/^re:/i.test(base) ? base : "Re: " + base);
  }
  subject = oneLine(subject) || "(no subject)";
  const cc = oneLine(p.cc), bcc = oneLine(p.bcc);
  const fromName = oneLine(`${u.name} – Rugs Creation`.replace(/"/g, ""));
  // 16 Nov 2026: the name holds an en-dash, which is not plain ASCII. A raw non-ASCII From header
  // reached buyers as "Priyanshu Tomar a?? Rugs Creation", so encode it the same way as the subject.
  const fromHdr = /[^ -~]/.test(fromName)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(fromName)))}?= <${box}>`
    : `"${fromName}" <${box}>`;
  const files = (Array.isArray(p.files) ? p.files : []).slice(0, 20).map((f: any) => ({ name: String(f.name || "file"), type: String(f.type || ""), b64: String(f.b64 || "") }));
  // 16 Nov 2026: a file arrives base64-encoded, so the upload is about a third bigger than the file.
  // A 22 MB file made a 29.7 MB request and killed this function with 546 (out of resources), and Gmail
  // itself only carries about 25 MB per message. The app stops at 15 MB of files; this is the backstop.
  if (files.reduce((a: number, f: any) => a + f.b64.length * 0.75, 0) > 16 * 1024 * 1024) throw new E("Those files are too big to send — a mail carries about 15 MB. Remove one, or put it in Google Drive and send the link.");
  const raw = mime({ from: fromHdr, to, cc, bcc, subject, html: String(p.html || ""), inReplyTo, refs, important: !!p.important, receipt: p.receipt ? box : "", files });
  const tok = await gToken(box, SEND);
  const sent = await gmail(tok, "messages/send", { method: "POST", body: JSON.stringify({ raw: b64u(raw), ...(threadId ? { threadId } : {}) }) });
  // store immediately so it shows in Sent without waiting for the next sync
  let row: any = null;
  try { const rt = await gToken(box, READ); const full = await gmail(rt, `messages/${sent.id}?format=full`); row = await saveMessage(box, full, u.id); }
  catch { row = { gmail_thread_id: sent.threadId }; await sb.from("rm_messages").upsert({ mailbox: box, gmail_id: sent.id, gmail_thread_id: sent.threadId, direction: "out", from_email: box, from_name: fromName, to_text: to, cc_text: cc, subject, body_text: String(p.text || "").slice(0, 8000), body_html: "", sent_at: new Date().toISOString(), sent_by: u.id }, { onConflict: "mailbox,gmail_id" }); }
  await rebuildThread(box, sent.threadId, false);
  if (!p.threadId) await sb.from("rm_threads").update({ owner_id: u.id, status: "open" }).eq("mailbox", box).eq("gmail_thread_id", sent.threadId);
  await log(box, sent.threadId, u.id, p.forward ? "forward" : "send", `${p.auto ? "Out-of-office reply sent for " + u.name : (p.forward ? "Forwarded to " + to : p.threadId ? "Replied" : "New mail sent") + " by " + u.name}${p.scheduled ? " (scheduled)" : ""}${bcc ? " · Bcc: " + bcc.slice(0, 120) : ""}`);
  return { threadId: sent.threadId, messageId: sent.id };
}


/* ---------------- Gmail two-way: app → Gmail (read/unread, archive, trash) and Gmail → app (History API) ---------------- */
// Only for mailboxes listed in rm_settings.gmail_write_boxes (a list of mailboxes, or "all").
async function gmailOn(box: string) {
  const { data } = await sb.from("rm_settings").select("value").eq("key", "gmail_write_boxes").maybeSingle();
  const v = data?.value;
  return v === "all" || (Array.isArray(v) && v.map((x: any) => String(x).toLowerCase()).includes(String(box).toLowerCase()));
}
// app change → Gmail. before = the thread row before the change. Never throws: returns what happened.
async function gmailWrite(box: string, tid: string, patch: any, before: any) {
  const did: string[] = [];
  if (!(await gmailOn(box))) return did;
  const wantFolder = "folder" in patch && patch.folder !== (before?.folder || "inbox");
  const wantRead = "unread" in patch && !!patch.unread !== !!before?.unread;
  if (!wantFolder && !wantRead) return did;
  try {
    const tok = await gToken(box, MODIFY);
    const mod = (body: any) => gmail(tok, `threads/${tid}/modify`, { method: "POST", body: JSON.stringify(body) });
    if (wantFolder) {
      const to = patch.folder, from = before?.folder || "inbox";
      if (to === "deleted") { await gmail(tok, `threads/${tid}/trash`, { method: "POST" }); did.push("trash"); }
      else {
        if (from === "deleted") { await gmail(tok, `threads/${tid}/untrash`, { method: "POST" }); did.push("untrash"); }
        if (to === "inbox") { await mod({ addLabelIds: ["INBOX"] }); did.push("inbox"); }
        else if (to === "archive") { await mod({ removeLabelIds: ["INBOX"] }); did.push("archive"); }
      }
    }
    if (wantRead) {
      if (patch.unread) {   // like Gmail: the latest incoming message becomes unread
        const { data: m } = await sb.from("rm_messages").select("gmail_id").eq("mailbox", box).eq("gmail_thread_id", tid).eq("direction", "in").order("sent_at", { ascending: false }).limit(1).maybeSingle();
        if (m) { await gmail(tok, `messages/${m.gmail_id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: ["UNREAD"] }) }); did.push("unread"); }
      } else { await mod({ removeLabelIds: ["UNREAD"] }); did.push("read"); }
    }
  } catch (e) { console.log("gmailWrite", box, tid, String((e as Error).message).slice(0, 200)); did.push("error: " + String((e as Error).message).slice(0, 160)); }
  return did;
}
// Gmail → app: label changes since rm_mailboxes.history_id (read/unread, archive, trash, back to inbox)
async function historySync(box: string, t0: number) {
  const { data: st } = await sb.from("rm_mailboxes").select("history_id").eq("mailbox", box).maybeSingle();
  const tok = await gToken(box, READ);
  const restart = async (why: string) => { const pr = await gmail(tok, "profile"); await sb.from("rm_mailboxes").update({ history_id: String(pr.historyId) }).eq("mailbox", box); return { mailbox: box, history: why, at: pr.historyId }; };
  if (!st?.history_id) return restart("started");
  const msgs = new Map<string, { tid: string; labels: string[] }>();
  const ev = new Map<string, string[]>();   // thread → INBOX+/INBOX-/TRASH+/TRASH- in order
  let pt = "", latest = st.history_id, complete = true;
  do {
    if (Date.now() - t0 > DEADLINE_MS) { complete = false; break; }
    let j: any;
    try { j = await gmail(tok, `history?startHistoryId=${st.history_id}&maxResults=500&historyTypes=labelAdded&historyTypes=labelRemoved${pt ? "&pageToken=" + pt : ""}`); }
    catch (e) { if ((e as E).code === 404) return restart("expired, restarted"); throw e; }
    for (const h of j.history || []) {
      for (const [list, sign] of [[h.labelsAdded, "+"], [h.labelsRemoved, "-"]] as any[]) for (const x of list || []) {
        const m = x.message || {}; if (!m.id) continue;
        msgs.set(m.id, { tid: m.threadId, labels: m.labelIds || [] });
        for (const l of x.labelIds || []) if (l === "INBOX" || l === "TRASH") { const a = ev.get(m.threadId) || []; a.push(l + sign); ev.set(m.threadId, a); }
      }
    }
    if (j.historyId) latest = String(j.historyId);
    pt = j.nextPageToken || "";
  } while (pt);
  if (!complete) return { mailbox: box, history: "partial, will continue" };
  const tids = new Set<string>();
  const all = [...msgs];
  for (let i = 0; i < all.length; i += 25) {   // keep our copy of each message's labels in step with Gmail (25 at a time)
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
    const patch: any = {};
    const unread = (ms || []).some((x: any) => x.direction === "in" && !isOwn(String(x.from_email || "").toLowerCase()) && (x.labels || []).includes("UNREAD"));
    if (unread !== !!t.unread) patch.unread = unread;
    let folder = t.folder || "inbox", prev = t.prev_folder, note = "";
    for (const e of ev.get(tid) || []) {
      if (e === "TRASH+" && folder !== "deleted") { prev = folder; folder = "deleted"; note = "moved to Trash in Gmail"; }
      else if (e === "TRASH-" && folder === "deleted") { folder = prev && prev !== "deleted" ? prev : "inbox"; note = "restored from Trash in Gmail"; }
      else if (e === "INBOX-" && folder === "inbox") { prev = "inbox"; folder = "archive"; note = "archived in Gmail"; }
      else if (e === "INBOX+" && (folder === "archive" || folder === "deleted")) { prev = folder; folder = "inbox"; note = "moved back to Inbox in Gmail"; }
    }
    if (folder !== (t.folder || "inbox")) { patch.folder = folder; patch.prev_folder = prev; }
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      await sb.from("rm_threads").update(patch).eq("mailbox", box).eq("gmail_thread_id", tid);
      if (note) await log(box, tid, null, "n", "Changed in Gmail: " + note);
      changed++;
    }
  }));
  await sb.from("rm_mailboxes").update({ history_id: latest }).eq("mailbox", box);
  return { mailbox: box, history: "ok", messages: msgs.size, threads_changed: changed };
}

/* ---------------- Drive: attachments copied to each department's Google Drive ---------------- */
// Folder: <department mailbox> My Drive → "Rugs Email Attachments" → <buyer domain> → "YYYY-MM-DD · file name"
// Readable by anyone at rugscreation.com who has the link. Mail itself stays in Gmail.
const MAX_FILE = 20 * 1024 * 1024;
async function drv(tok: string, url: string, init?: RequestInit) {
  const r = await fetch(url.startsWith("http") ? url : "https://www.googleapis.com/drive/v3/" + url, { ...init, headers: { Authorization: "Bearer " + tok, ...(init?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new E(/has not been used|disabled/i.test(j.error?.message || "") ? "Google Drive API is off in the Rugs Email Google Cloud project" : "Drive " + r.status + ": " + (j.error?.message || ""), 502);
  return j;
}
async function folder(tok: string, box: string, key: string, name: string, parent: string | null) {
  const { data } = await sb.from("rm_drive_folders").select("folder_id").eq("mailbox", box).eq("key", key).maybeSingle();
  if (data) return data.folder_id;
  const f = await drv(tok, "files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }) });
  if (!parent) await drv(tok, `files/${f.id}/permissions?sendNotificationEmail=false`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "domain", role: "reader", domain: DOMAIN, allowFileDiscovery: false }) }).catch(() => null);
  await sb.from("rm_drive_folders").upsert({ mailbox: box, key, folder_id: f.id });
  return f.id;
}
const skipAtt = (a: any) => /^image\//i.test(a.mime || "") && (a.size || 0) < 40000;   // logos / signature images
// after the Drive copy the long Gmail attachment ids are not needed (the attachment action finds files by name)
const slimAtts = (a: any[]) => (Array.isArray(a) ? a : []).map((x: any) => ({ name: x.name, mime: x.mime, size: x.size }));
async function driveCopy(limit = 5, t0 = Date.now()) {
  const cols = "mailbox,gmail_id,gmail_thread_id,direction,from_email,to_text,sent_at,attachments,drive_tries";
  const { data: fresh } = await sb.from("rm_messages").select(cols).eq("has_attachments", true).is("drive_status", null).order("sent_at", { ascending: false }).limit(limit);
  let ms: any[] = fresh || [];
  if (ms.length < limit) {   // then failed copies again, at most 3 retries each
    const { data: retry } = await sb.from("rm_messages").select(cols).eq("drive_status", "error").lt("drive_tries", 3).order("sent_at", { ascending: false }).limit(limit - ms.length);
    ms = ms.concat(retry || []);
  }
  let n = 0;
  for (const m of ms) {
    if (Date.now() - t0 > DEADLINE_MS) break;
    const files: any[] = [];
    try {
      const atts = (m.attachments || []).filter((a: any) => !skipAtt(a));
      if (!atts.length) { await sb.from("rm_messages").update({ drive_status: "none", drive_files: [], attachments: slimAtts(m.attachments) }).eq("mailbox", m.mailbox).eq("gmail_id", m.gmail_id); continue; }
      const gt = await gToken(m.mailbox, READ), dt = await gToken(m.mailbox, DRIVE);
      const other = m.direction === "in" ? m.from_email : (addrs(m.to_text).find((e) => e !== m.mailbox) || "outgoing");
      const dom = (other.split("@")[1] || other).toLowerCase();
      const root = await folder(dt, m.mailbox, "root", "Rugs Email Attachments", null);
      const sub = await folder(dt, m.mailbox, "d:" + dom, dom, root);
      const day = String(m.sent_at).slice(0, 10);
      for (const a of atts) {
        if ((a.size || 0) > MAX_FILE) { files.push({ name: a.name, size: a.size, big: true }); continue; }
        const g = await gmail(gt, `messages/${m.gmail_id}/attachments/${a.id}`);
        const bytes = decodeBase64Url(g.data || "");
        const B = "rmd" + crypto.randomUUID().replace(/-/g, "");
        const meta = JSON.stringify({ name: `${day} · ${a.name}`, parents: [sub], description: `From Rugs Email · ${m.mailbox} · ${other}` });
        const body = new Blob([`--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${B}\r\nContent-Type: ${/^[\w.+-]+\/[\w.+-]+$/.test(a.mime || "") ? a.mime : "application/octet-stream"}\r\n\r\n`, bytes, `\r\n--${B}--`]);
        const f = await drv(dt, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${B}` }, body });
        files.push({ name: a.name, size: a.size, id: f.id, link: f.webViewLink });
      }
      await sb.from("rm_messages").update({ drive_status: "done", drive_files: files, attachments: slimAtts(m.attachments) }).eq("mailbox", m.mailbox).eq("gmail_id", m.gmail_id);
      await sb.from("rm_threads").update({ updated_at: new Date().toISOString() }).eq("mailbox", m.mailbox).eq("gmail_thread_id", m.gmail_thread_id);
      n++;
    } catch (e) {
      const msg = String((e as Error).message || e);
      if (/drive\.file|Drive API is off|has not allowed/i.test(msg)) return { error: msg };   // not set up yet — try again next minute
      await sb.from("rm_messages").update({ drive_status: "error", drive_files: [{ error: msg.slice(0, 200) }], drive_tries: (Number(m.drive_tries) || 0) + 1 }).eq("mailbox", m.mailbox).eq("gmail_id", m.gmail_id);
    }
  }
  return { saved: n };
}

/* ---------------- Gemini ---------------- */
// Company-wide hold: deleg_meta "gemini_hold" = {on:true} pauses every Gemini call (cost control).
async function aiHeld(): Promise<boolean> {
  try { const { data } = await sb.from("deleg_meta").select("value").eq("key", "gemini_hold").maybeSingle(); return !!(data?.value && (data.value as any).on); }
  catch { return true; }   // cannot check → do not spend
}
const TOPICS = ["quote", "sample", "prod", "ship", "buyer", "test", "art", "order"];
// Picks the newest available "gemini-X-flash" model automatically (Google retires old ones), unless GEMINI_MODEL is set.
let MODEL = "";
async function pickModel(key: string, avoid = "") {
  const fixed = Deno.env.get("GEMINI_MODEL"); if (fixed && fixed !== avoid) return fixed;
  if (MODEL && MODEL !== avoid) return MODEL;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key } });
  const j = await r.json().catch(() => ({}));
  const ver = (n: string) => (n.match(/gemini-([\d.]+)/)?.[1] || "0").split(".").map(Number);
  const names = (j.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m: any) => String(m.name).replace("models/", ""))
    .filter((n: string) => /^gemini-[\d.]+-flash$/.test(n) && n !== avoid)
    .sort((x: string, y: string) => { const a = ver(x), b = ver(y); for (let i = 0; i < 3; i++) if ((b[i] || 0) !== (a[i] || 0)) return (b[i] || 0) - (a[i] || 0); return 0; });
  MODEL = names[0] || "gemini-flash-latest";
  return MODEL;
}
async function gemini(prompt: string, json: boolean) {
  if (await aiHeld()) throw new E("AI (Gemini) is paused by the admin to save cost. Please write it yourself for now.", 503);
  const key = Deno.env.get("GEMINI_API_KEY"); if (!key) throw new E("Gemini key is not set (Supabase → Edge Functions → Secrets → GEMINI_API_KEY)", 501);
  let model = await pickModel(key);
  for (let attempt = 0; attempt < 2; attempt++) {
    const gc: any = json ? { responseMimeType: "application/json", temperature: 0.1 } : { temperature: 0.4 };
    if (/2\.5-flash/.test(model)) gc.thinkingConfig = { thinkingBudget: 0 };   // no paid "thinking" tokens for simple tagging / drafts
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: gc }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return (j.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || "").join("");
    const msg = String(j.error?.message || r.status);
    if (attempt === 0 && (r.status === 404 || /no longer available|not found|not supported/i.test(msg))) { MODEL = ""; model = await pickModel(key, model); continue; }
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
  for (const t of ts) { const { data: m } = await sb.from("rm_messages").select("body_text").eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id).eq("direction", "in").order("sent_at").limit(1).maybeSingle(); items.push({ id: t.mailbox + "|" + t.gmail_thread_id, from: t.counterpart_name, subject: t.subject, body: (m?.body_text || "").slice(0, 1200) }); }
  const prompt = "You tag e-mails for a rug exporter's merchandising team (Rugs Creation, India). A topic only describes what the conversation is about.\nPick ONE topic id per e-mail from: quote=Quotation, sample=Sampling, prod=Production, ship=Shipping, buyer=Buyer talk (general talk with buyer or buying agency), test=Testing, art=Artwork, order=New order.\nReturn JSON {\"<id>\": {\"topic\":\"<topic id>\",\"confidence\":<0-100>}}.\n\n" + items.map((m) => `ID: ${m.id}\nFrom: ${m.from}\nSubject: ${m.subject}\nBody: ${m.body}`).join("\n---\n");
  let r: any = {};
  try { r = JSON.parse(await gemini(prompt, true) || "{}"); }
  catch (e) {
    if ((e as E).code === 503) return 0;   // held — leave them for later
    r = {};                                 // unreadable answer: mark this batch checked below so it is not sent again every minute
  }
  for (const t of ts) {
    const x = r[t.mailbox + "|" + t.gmail_thread_id], upd: any = { topic_checked: true };
    if (x && TOPICS.includes(x.topic) && t.topic_ai !== false) { upd.topic = x.topic; upd.topic_conf = Math.round(x.confidence || 85); upd.topic_ai = true; }
    await sb.from("rm_threads").update(upd).eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id);
  }
  return ts.length;
}

/* ---------------- timer jobs: scheduled mail, rules + blocked senders, out-of-office ---------------- */
async function sendScheduled(t0: number) {
  const { data: due } = await sb.from("rm_scheduled").select("*").eq("status", "waiting").lte("send_at", new Date().toISOString()).order("send_at").limit(5);
  let n = 0;
  for (const j of due || []) {
    if (Date.now() - t0 > DEADLINE_MS) break;
    await sb.from("rm_scheduled").update({ status: "sending" }).eq("id", j.id).eq("status", "waiting");
    try {
      const { data: u } = await sb.from("rm_users").select("*").eq("id", j.user_id).maybeSingle();
      if (!u || !u.active) throw new E("The person who scheduled it is deactivated");
      await send(u, { ...j.payload, scheduled: true });
      await sb.from("rm_scheduled").update({ status: "sent", sent_at: new Date().toISOString(), payload: { to: j.payload.to, subject: j.payload.subject } }).eq("id", j.id);
      n++;
    } catch (e) { await sb.from("rm_scheduled").update({ status: "failed", error: String((e as Error).message).slice(0, 300) }).eq("id", j.id); }
  }
  return n;
}
const low = (x: unknown) => String(x || "").toLowerCase();
async function applyRules() {
  const { data: st } = await sb.from("rm_settings").select("key,value").in("key", ["rules", "blocked"]);
  const rules: any[] = (st || []).find((x: any) => x.key === "rules")?.value || [];
  const blocked: string[] = ((st || []).find((x: any) => x.key === "blocked")?.value || []).map(low);
  const { data: ts } = await sb.from("rm_threads").select("mailbox,gmail_thread_id,subject,counterpart_email,counterpart_name,folder").eq("rules_checked", false).limit(300);
  let n = 0;
  for (const t of ts || []) {
    const em = low(t.counterpart_email), dom = em.split("@")[1] || "", patch: any = { rules_checked: true };
    if (blocked.some((b) => b && (em === b || dom === b.replace(/^@/, "")))) { patch.folder = "junk"; patch.prev_folder = t.folder || "inbox"; }
    else for (const r of rules) {
      if (!r || r.off) continue;
      if (r.mailbox && low(r.mailbox) !== low(t.mailbox)) continue;
      if (r.from && !(em.includes(low(r.from)) || low(t.counterpart_name).includes(low(r.from)))) continue;
      if (r.subject && !low(t.subject).includes(low(r.subject))) continue;
      if (!r.from && !r.subject && !r.mailbox) continue;
      if (r.folder) { patch.folder = r.folder; patch.prev_folder = t.folder || "inbox"; }
      if (r.owner) { patch.owner_id = r.owner; patch.status = "open"; }
      if (r.topic) { patch.topic = r.topic; patch.topic_ai = false; patch.topic_checked = true; }
      if (r.flag) patch.flagged = true;
      if (r.cat) patch.cats = [r.cat];
      n++;
      if (r.stop !== false) break;
    }
    await sb.from("rm_threads").update(patch).eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id);
    if (patch.folder || patch.owner_id) await log(t.mailbox, t.gmail_thread_id, null, "rule", patch.folder === "junk" && blocked.length ? "Blocked sender — moved to Junk" : "Rule applied" + (patch.folder ? " · moved to " + patch.folder : "") + (patch.owner_id ? " · assigned" : ""));
  }
  return n;
}
async function outOfOffice(t0: number) {
  const { data: us } = await sb.from("rm_users").select("*").eq("active", true).not("prefs->ooo", "is", null);
  let n = 0;
  for (const u of us || []) {
    const o = u.prefs?.ooo; if (!o?.on || !o.message) continue;
    if (o.until && Date.parse(o.until) < Date.now()) { await sb.from("rm_users").update({ prefs: { ...u.prefs, ooo: { ...o, on: false } } }).eq("id", u.id); continue; }
    const { data: ts } = await sb.from("rm_threads").select("mailbox,gmail_thread_id,counterpart_email,last_msg_at").eq("owner_id", u.id).eq("ooo_sent", false).eq("has_in", true).gt("last_msg_at", o.since || new Date(Date.now() - 86400000).toISOString()).limit(10);
    for (const t of ts || []) {
      if (Date.now() - t0 > DEADLINE_MS) return n;
      await sb.from("rm_threads").update({ ooo_sent: true }).eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id);
      const { data: last } = await sb.from("rm_messages").select("direction,from_email").eq("mailbox", t.mailbox).eq("gmail_thread_id", t.gmail_thread_id).order("sent_at", { ascending: false }).limit(1).maybeSingle();
      const em = low(last?.from_email);
      if (!last || last.direction !== "in" || !em || isOwn(em) || /no-?reply|mailer-daemon|notification|bounce/.test(em)) continue;
      try { await send(u, { mailbox: t.mailbox, threadId: t.gmail_thread_id, to: em, html: String(o.message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"), text: o.message, auto: true }); n++; } catch (e) { console.log("ooo", (e as Error).message); }
    }
  }
  return n;
}

// full conversation straight from Gmail (HTML as received, pasted cid pictures from the whole conversation inlined)
async function threadFull(box: string, tid: string, ids?: any) {   // 19 Nov 2026: ids = open these older mails of a long trail in full
    const { data: m } = await sb.from("rm_messages").select("gmail_id,direction,body_text,sent_at").eq("mailbox", box).eq("gmail_thread_id", tid).order("sent_at");
    // full original (HTML exactly as received) comes straight from Gmail — nothing heavy is stored in Supabase
    const tok = await gToken(box, READ);
    // 19 Nov 2026: a long trail (49, 72 mails) is mostly the same text quoted over and over. Asking Gmail
    // for the WHOLE conversation and sending every mail's HTML is what made the function run out of CPU
    // (546) and sent 10 MB for one click. The reading pane only opens the NEWEST mail - the rest are
    // folded one-liners - so only the newest FULL_N mails are fetched, one Gmail call each, and the older
    // ones come back as a summary (light:true). Opening one asks for it by id (p.ids) and gets it in full.
    const FULL_N = 5;
    const rows = m || [];
    const want: Set<string> | null = Array.isArray(ids) && ids.length ? new Set(ids.slice(0, 20).map(String)) : null;
    const need = want ? rows.filter((x: any) => want.has(String(x.gmail_id))) : rows.slice(-FULL_N);
    // one retry each: a single Gmail hiccup used to leave that mail folded and empty with no explanation
    const getMsg = async (id: string) => {
      for (let i = 0; i < 2; i++) {
        try { return await gmail(tok, `messages/${id}?format=full`); }
        catch (e) { if (i) { console.log("thread msg miss", id, (e as Error).message); return null; } await new Promise((r) => setTimeout(r, 300)); }
      }
      return null;
    };
    const got = (await Promise.all(need.map((x: any) => getMsg(String(x.gmail_id))))).filter(Boolean);
    const byId = new Map<string, any>(got.map((x: any) => [x.id, x]));
    // 18 Nov 2026: pictures are NOT pasted in any more (that caused 546 on long trails) - see withCidLinks / inlineImg
    const pool: any[] = []; for (const gm of got) for (const x of inlineParts(gm.payload)) pool.push({ ...x, mid: gm.id, data: "" });
    const allIx = cidIndex(pool);          // built once for the mails being sent, not once per mail
    const out = await Promise.all(rows.map(async (x: any) => {
      const gm = byId.get(x.gmail_id);
      if (!gm) return { ...x, body_html: "", body_text: (x.body_text || "").slice(0, 4000), light: true };
      let html = gm ? partOf(gm.payload, "text/html") : "";
      const text = gm ? (partOf(gm.payload, "text/plain") || (html ? htmlToText(html.slice(0, 150000)) : "")) : x.body_text;
      if (gm && html) html = withCidLinks(x.gmail_id, gm.payload, html, allIx);
      return { ...x, body_html: html, body_text: (text || x.body_text || "").slice(0, 60000) };   // big mails keep their HTML; the app lets the mail scroll
    }));
    return { messages: out };
}

/* the 30-second sync run (timer, Gmail push, Sync button) — always under the sync_lock */
async function cronRun(t0: number) {
    const out = [];
    // oldest-synced mailbox first, so every department gets its turn as more mailboxes are added
    const { data: stt } = await sb.from("rm_mailboxes").select("mailbox,last_sync");
    const ls = new Map((stt || []).map((x: any) => [x.mailbox, x.last_sync ? Date.parse(x.last_sync) : 0]));
    const order = (await depts()).sort((x: any, y: any) => (ls.get(x.mailbox) || 0) - (ls.get(y.mailbox) || 0));
    // 18 Nov 2026: scheduled mail goes FIRST. It used to run after syncing every mailbox, and with
    // 9 mailboxes the sync always used the whole time budget, so sendScheduled() found its mail due
    // but stopped at once on the deadline — "scheduled":0 on every run, nothing scheduled ever went out.
    try { out.push({ scheduled: await sendScheduled(t0) }); } catch (e) { out.push({ scheduled: (e as Error).message }); }
    for (const d of order) { if (Date.now() - t0 > DEADLINE_MS) break; try { out.push(await syncBox(d.mailbox, t0)); } catch (e) { await sb.from("rm_mailboxes").upsert({ mailbox: d.mailbox, status: "error", note: String((e as Error).message).slice(0, 300) }, { onConflict: "mailbox" }); out.push({ mailbox: d.mailbox, error: (e as Error).message }); } }
    for (const d of order) { if (Date.now() - t0 > DEADLINE_MS) break; try { if (await gmailOn(d.mailbox)) out.push(await historySync(d.mailbox, t0)); } catch (e) { out.push({ mailbox: d.mailbox, history_error: String((e as Error).message).slice(0, 200) }); } }
    try { out.push({ rules: await applyRules() }); } catch (e) { out.push({ rules: (e as Error).message }); }
    try { out.push({ ooo: await outOfOffice(t0) }); } catch (e) { out.push({ ooo: (e as Error).message }); }
    await sb.from("rm_presence").delete().lt("at", new Date(Date.now() - 600000).toISOString());
    try { await tagTopics(); } catch { /* ignore */ }
    try { out.push({ drive: await driveCopy(5, t0) }); } catch (e) { out.push({ drive: (e as Error).message }); }
    await sb.from("rm_sessions").delete().lt("expires_at", new Date().toISOString());
    return out;
}
/* sync_lock: one row in rm_settings; updated_at = when the lock was taken, year 2000 = free. A lock older than 65 s is stale (crashed run). */
async function takeLock(): Promise<boolean> {
  await sb.from("rm_settings").upsert({ key: "sync_lock", value: {}, updated_at: "2000-01-01T00:00:00Z" }, { onConflict: "key", ignoreDuplicates: true });
  const { data } = await sb.from("rm_settings").update({ updated_at: new Date().toISOString() }).eq("key", "sync_lock").lt("updated_at", new Date(Date.now() - 65000).toISOString()).select("key");
  return !!(data && data.length);
}
async function freeLock() { try { await sb.from("rm_settings").update({ updated_at: "2000-01-01T00:00:00Z" }).eq("key", "sync_lock"); } catch { /* ignore */ } }

/* ---------------- actions ---------------- */
const META_COLS = ["dept_id", "owner_id", "status", "promise", "due_at", "topic", "topic_ai", "topic_conf", "flagged", "folder", "prev_folder", "unread", "pinned", "snooze_until", "remind_at", "cats"];
async function handle(a: string, p: any, t0: number) {
  if (a === "login") {
    const login = String(p.login || "").trim().toLowerCase().slice(0, 200);
    if (!login) throw new E("Enter your user ID", 400);
    // 5 wrong passwords lock this ID for 15 minutes
    const { data: lk } = await sb.from("rm_login_attempts").select("locked_until").eq("login", login).maybeSingle();
    const lockedMin = (t: any) => Math.max(1, Math.ceil((new Date(t).getTime() - Date.now()) / 60000));
    if (lk?.locked_until && new Date(lk.locked_until).getTime() > Date.now()) throw new E(`Too many wrong passwords. This ID is locked for ${lockedMin(lk.locked_until)} more minute(s). Try again later or ask the admin.`, 429);
    const id = (await sb.rpc("rm_check_password", { p_login: login, p_pw: String(p.password || "") })).data;
    if (!id) {
      const { data: until } = await sb.rpc("rm_login_fail", { p_login: login });
      if (until) throw new E("Too many wrong passwords. This ID is locked for 15 minutes. Try again later or ask the admin.", 429);
      const { data: u } = await sb.from("rm_users").select("active,pass_hash").ilike("login", login).maybeSingle();
      if (!u) throw new E("No user with that ID. Ask the admin (marketing@" + DOMAIN + ").", 401);
      if (!u.active) throw new E("This user is deactivated. Ask the admin.", 403);
      if (!u.pass_hash) throw new E("No password set yet. Ask the admin to set your password.", 401);
      throw new E("Wrong password. Try again or ask the admin to reset it.", 401);
    }
    await sb.from("rm_login_attempts").delete().eq("login", login);
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    await sb.from("rm_sessions").insert({ token_hash: await tokHash(token), user_id: id });
    const { data: u } = await sb.from("rm_users").select("*").eq("id", id).single();
    return { token, ...(await boot(u)) };
  }
  if (a === "gmailRefresh") {   // one-time read/unread refresh for one mailbox, last N days ("read wins"); dry = counts only
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    const box = String(p.box || "").toLowerCase(), days = Math.min(90, Math.max(1, Number(p.days) || 30));
    await deptOfBox(box);
    const tok = await gToken(box, READ);
    const unread: string[] = []; let pt = "";
    do {
      const j = await gmail(tok, `messages?maxResults=500&fields=messages(id),nextPageToken&q=${encodeURIComponent(`is:unread newer_than:${days}d -in:chats -in:spam -in:trash`)}${pt ? "&pageToken=" + pt : ""}`);
      for (const m of j.messages || []) unread.push(m.id);
      pt = j.nextPageToken || "";
    } while (pt && unread.length < 50000);
    const { data: r, error } = await sb.rpc("rm_unread_refresh", { p_box: box, p_unread: unread, p_since: new Date(Date.now() - days * 864e5).toISOString(), p_dry: !!p.dry });
    if (error) throw new E(error.message, 500);
    const ids: string[] = r.push_ids || []; delete r.push_ids;
    let pushed = 0;
    if (!p.dry && ids.length) {
      const mt = await gToken(box, MODIFY);
      for (let i = 0; i < ids.length; i += 1000) { await gmail(mt, "messages/batchModify", { method: "POST", body: JSON.stringify({ ids: ids.slice(i, i + 1000), removeLabelIds: ["UNREAD"] }) }); pushed += Math.min(1000, ids.length - i); }
    }
    return { mailbox: box, days, gmail_unread_msgs: unread.length, ...r, pushed_read_to_gmail: pushed };
  }
  if (a === "threadPreview") {   // same as "thread", with the timer key instead of a person's login (checks only)
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    return threadFull(String(p.mailbox || ""), String(p.threadId || ""));
  }
  if (a === "cron") {
    const { data: k } = await sb.from("rm_settings").select("value").eq("key", "cron_key").single();
    if (!p.cron_key || p.cron_key !== k.value) throw new E("forbidden", 403);
    // 15 Nov 2026: only one sync runs at a time. The 30-second timer, Gmail push and the app's Sync used to start
    // 3-4 copies at once (each 45-55 s long); Gmail then answered with broken replies and the server ran out of resources (546).
    if (!(await takeLock())) return [{ skipped: "another sync is still running" }];
    try { return await cronRun(t0); } finally { await freeLock(); }
  }
  const u = await me(p.token);
  // reading keeps working; sending, assigning and admin wait until the person has set their own password
  if (u.must_change && !u._switched && !["boot", "logout", "changePassword", "list", "thread", "sync"].includes(a)) throw new E("Please set your own password first", 428);
  switch (a) {
    case "boot": return boot(u);
    case "logout": await sb.from("rm_sessions").delete().eq("token_hash", await tokHash(p.token)); return { ok: true };
    case "list": {
      const all = await depts();
      const ds = all.filter((d: any) => access(u, d.id)), ids = ds.map((d: any) => d.id);
      const boxes = ds.map((d: any) => d.mailbox);
      const homeOf = new Map(all.map((d: any) => [d.mailbox, d.id]));
      const q1 = (q: any) => p.since ? q.gt("updated_at", new Date(p.since - 5000).toISOString()) : q;
      const [{ data: a1 }, { data: a2 }] = await Promise.all([
        Promise.all([0, 1000].map((f) => q1(sb.from("rm_threads").select("*").in("mailbox", boxes).order("last_msg_at", { ascending: false }).order("gmail_thread_id")).range(f, f + 999)))
          .then((rs: any[]) => ({ data: rs.flatMap((r: any) => r.data || []).slice(0, 1500) })),   // two pages: Supabase caps one query at 1000 rows
        ids.length ? q1(sb.from("rm_threads").select("*").in("dept_id", ids).order("last_msg_at", { ascending: false }).limit(500)) : Promise.resolve({ data: [] }),
      ]);
      const seen = new Set<string>(), threads: any[] = [];
      for (const t of [...(a1 || []), ...(a2 || [])]) {
        const k = t.mailbox + "|" + t.gmail_thread_id; if (seen.has(k)) continue;
        if (!access(u, t.dept_id || homeOf.get(t.mailbox))) continue;   // transferred away and not shared with me
        seen.add(k); threads.push(t);
      }
      const keys = [...new Set(threads.map((t: any) => t.gmail_thread_id))];
      const msgs: any[] = [], acts: any[] = [];
      for (let i = 0; i < keys.length; i += 200) {
        const part = keys.slice(i, i + 200);
        // page through every row (Supabase returns at most 1000 rows per query)
        const pageAll = async (mk: () => any) => { const rows: any[] = []; for (let f = 0; f < 20000; f += 1000) { const { data } = await mk().range(f, f + 999); rows.push(...(data || [])); if (!data || data.length < 1000) break; } return rows; };
        const [m, ac] = await Promise.all([
          pageAll(() => sb.from("rm_messages").select("mailbox,gmail_id,gmail_thread_id,direction,from_email,from_name,to_text,cc_text,snippet,body_text,sent_at,sent_by,has_attachments,attachments,drive_status,drive_files").in("gmail_thread_id", part).order("sent_at")),
          pageAll(() => sb.from("rm_activity").select("mailbox,gmail_thread_id,user_id,kind,text,at").in("gmail_thread_id", part).order("at")),
        ]);
        m.forEach((x: any) => {
          if (!seen.has(x.mailbox + "|" + x.gmail_thread_id)) return;
          x.body_text = (x.body_text || "").slice(0, 1500);
          // the list only needs name / type / size — Gmail's long attachment ids made the reply huge
          x.attachments = (x.attachments || []).map((a: any) => ({ name: a.name, mime: a.mime, size: a.size }));
          msgs.push(x);
        });
        ac.forEach((x: any) => { if (seen.has(x.mailbox + "|" + x.gmail_thread_id)) acts.push(x); });
      }
      const { data: boxesState } = await sb.from("rm_mailboxes").select("mailbox,status,last_sync,note").in("mailbox", boxes);
      return { threads, messages: msgs, activity: acts, mailboxes: boxesState || [], now: Date.now() };
    }
    case "thread": {
      await threadAccess(u, p.mailbox, p.threadId, "view");
      return threadFull(p.mailbox, p.threadId, p.ids);   // 19 Nov 2026: p.ids = open one older mail of a long trail
    }
    case "sync": {
      const ds = (await depts()).filter((d: any) => access(u, d.id));
      // 15 Nov 2026: the Sync button / sign-in never runs beside the timer's sync (same lock); the timer catches up within 30 s anyway
      if (!(await takeLock())) return ds.map((d: any) => ({ mailbox: d.mailbox, skipped: "a sync is already running" }));
      const out = [];
      try { for (const d of ds) { try { out.push(await syncBox(d.mailbox, t0, !!p.force)); } catch (e) { out.push({ mailbox: d.mailbox, error: (e as Error).message }); } } }
      finally { await freeLock(); }
      // topic tagging runs only from the 1-minute timer (cron), not on every Sync press
      return out;
    }
    case "meta": {
      const out: any[] = [], gm: any[] = [];
      for (const c of p.changes || []) {
        const d = await threadAccess(u, c.mailbox, c.threadId, "full");
        const patch: any = {};
        for (const k of META_COLS) if (k in (c.patch || {})) patch[k] = c.patch[k];
        if ("owner_id" in patch && patch.owner_id && patch.owner_id !== u.id && !can(u, "assign")) throw new E("You can't assign mail to others", 403);
        if (patch.folder === "deleted" && !can(u, "delete")) throw new E("You can't delete mail", 403);
        if ("topic" in patch && patch.topic_ai === false) patch.topic_checked = true;
        if ("dept_id" in patch && patch.dept_id && !can(u, "transfer")) throw new E("You can't transfer mail", 403);
        if ("dept_id" in patch && patch.dept_id === d.id) patch.dept_id = null;
        if (patch.status === "done") patch.done_at = new Date().toISOString(); else if ("status" in patch) patch.done_at = null;
        let before: any = null;
        if ("folder" in patch || "unread" in patch) { const { data: b0 } = await sb.from("rm_threads").select("folder,unread").eq("mailbox", c.mailbox).eq("gmail_thread_id", c.threadId).maybeSingle(); before = b0; }
        if (Object.keys(patch).length) { patch.updated_at = new Date().toISOString(); await sb.from("rm_threads").update(patch).eq("mailbox", c.mailbox).eq("gmail_thread_id", c.threadId); }
        if (before) { const did = await gmailWrite(c.mailbox, c.threadId, patch, before); if (did.length) gm.push({ threadId: c.threadId, gmail: did }); }
        for (const h of c.log || []) await log(c.mailbox, c.threadId, u.id, h.kind || "note", String(h.text || "").slice(0, 500));
        out.push(d.id);
      }
      return { ok: true, n: out.length, gmail: gm };
    }
    case "send": return send(u, p);
    case "aiWrite": {
      const prompt = `Write a short, polite, professional business e-mail body (no subject line, no signature — it is added automatically) for ${u.name} (${u.role}, Rugs Creation, a rug manufacturer and exporter in India).\nWhat to say: ${p.ask}\n` + (p.thread ? `It is a reply to this e-mail from ${p.thread.from} — subject "${p.thread.subject}":\n${String(p.thread.body || "").slice(0, 3000)}\n` : "") + "Plain text, short paragraphs, start with a greeting using the recipient's first name if known.";
      return { text: await gemini(prompt, false) };
    }
    case "saveProfile": {
      const upd: any = {};
      if (p.profile) upd.profile = p.profile;
      if ("signature" in p) upd.signature = p.signature;
      if ("on_leave" in p) upd.on_leave = !!p.on_leave;
      await sb.from("rm_users").update(upd).eq("id", u.id); return { ok: true };
    }
    case "changePassword": {
      const np = String(p.newPassword || "");
      if (np.length < 8 || !/[A-Za-z]/.test(np) || !/\d/.test(np)) throw new E("Use at least 8 characters with letters and a number");
      if (np === String(p.oldPassword || "")) throw new E("The new password must be different from the old one");
      const chk = (await sb.rpc("rm_check_password", { p_login: u.login, p_pw: String(p.oldPassword || "") })).data;
      if (chk !== u.id) throw new E("Current password is wrong", 401);
      await sb.rpc("rm_set_password", { p_user: u.id, p_pw: np });
      await sb.from("rm_users").update({ must_change: false }).eq("id", u.id);
      await sb.from("rm_sessions").delete().eq("user_id", u.id).neq("token_hash", await tokHash(p.token));   // sign out other devices
      const { data: nu } = await sb.from("rm_users").select("*").eq("id", u.id).single();
      return boot(nu);
    }
    case "savePrefs": {   // my own: several signatures, out-of-office
      const prefs = { ...(u.prefs || {}), ...(p.prefs || {}) };
      const wasOn = !!u.prefs?.ooo?.on, nowOn = !!prefs.ooo?.on;
      if (nowOn && !wasOn) { prefs.ooo.since = new Date().toISOString(); await sb.from("rm_threads").update({ ooo_sent: false }).eq("owner_id", u.id); }
      await sb.from("rm_users").update({ prefs }).eq("id", u.id);
      return { ok: true, prefs };
    }
    case "schedule": {   // send later (the 1-minute timer sends it)
      const at = Date.parse(p.sendAt);
      if (!at || at < Date.now() + 30000) throw new E("Pick a time at least one minute from now");
      if (at > Date.now() + 90 * 86400000) throw new E("Pick a time within the next 90 days");
      if (p.payload?.threadId) await threadAccess(u, p.payload.mailbox, p.payload.threadId, "full"); else await needBox(u, p.payload?.mailbox, "full");
      if (JSON.stringify(p.payload).length > 20 * 1024 * 1024) throw new E("Too big to schedule — attach big files as a Drive link");
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
    case "inlineImg": {   // 18 Nov 2026: one pasted (cid:) picture of a mail, asked for by the app after the mail text has arrived
      await needBox(u, p.mailbox, "view");
      const tok = await gToken(p.mailbox, READ);
      const m = await gmail(tok, `messages/${p.gmailId}?format=full`);
      const cid = String(p.cid || "").toLowerCase();
      const pt = inlineParts(m.payload).find((x: any) => x.cid.toLowerCase() === cid || (x.name && x.name.toLowerCase() === cid));
      if (!pt) { console.log("inlineImg miss", JSON.stringify({ mid: p.gmailId, cid, have: inlineParts(m.payload).map((x: any) => x.cid + "|" + x.name).slice(0, 10) })); throw new E("Picture not found", 404); }
      if ((pt.size || 0) > 8 * 1024 * 1024) throw new E("Picture too big to show here — download it instead");
      let data = pt.data || "";
      if (!data && pt.aid) data = (await gmail(tok, `messages/${p.gmailId}/attachments/${pt.aid}`)).data || "";
      if (!data) throw new E("Picture not found", 404);
      return { data: `data:${pt.mime};base64,${toStdB64(data)}` };
    }
    case "attachment": {   // preview / download one attachment straight from Gmail
      await needBox(u, p.mailbox, "view");
      const tok = await gToken(p.mailbox, READ);
      const m = await gmail(tok, `messages/${p.gmailId}?format=full`);
      const a = attachments(m.payload).find((x: any) => x.name === p.name) || inlineParts(m.payload).find((x: any) => x.name === p.name);
      if (!a) throw new E("Attachment not found", 404);
      if ((a.size || 0) > 15 * 1024 * 1024) throw new E("Over 15 MB — open it in Google Drive or Gmail");
      let data = a.data || "";
      const aid = a.id || a.aid;
      if (!data && aid) data = (await gmail(tok, `messages/${p.gmailId}/attachments/${aid}`)).data || "";
      return { name: a.name, mime: a.mime, b64: toStdB64(data) };
    }
    case "search": {   // Gmail search, also inside attachments (PDF, Word, Excel)
      const q = String(p.q || "").trim(); if (!q) return { hits: [] };
      const ds = (await depts()).filter((d: any) => access(u, d.id));
      const hits: any[] = [];
      await Promise.all(ds.map(async (d: any) => {
        try {
          const tok = await gToken(d.mailbox, READ);
          const j = await gmail(tok, `threads?maxResults=100&fields=threads(id)&q=${encodeURIComponent(q + " -in:chats")}`);
          for (const t of j.threads || []) hits.push({ mailbox: d.mailbox, threadId: t.id });
        } catch (_e) { /* one mailbox failing must not stop the search */ }
      }));
      return { hits };
    }
    case "presence": {   // "Priya is replying to this" warning
      const now = new Date().toISOString();
      if (p.typing) await sb.from("rm_presence").upsert({ mailbox: p.mailbox, gmail_thread_id: p.threadId, user_id: u.id, at: now });
      else await sb.from("rm_presence").delete().eq("mailbox", p.mailbox).eq("gmail_thread_id", p.threadId).eq("user_id", u.id);
      const { data } = await sb.from("rm_presence").select("user_id,at").eq("mailbox", p.mailbox).eq("gmail_thread_id", p.threadId).neq("user_id", u.id).gt("at", new Date(Date.now() - 120000).toISOString());
      return { others: (data || []).map((x: any) => x.user_id) };
    }
    case "getSetting": {   // latest copy of one shared list, so the app can merge before saving
      if (!SHARED_KEYS.includes(p.key)) throw new E("Unknown setting");
      const { data } = await sb.from("rm_settings").select("value").eq("key", p.key).maybeSingle();
      return { value: data ? data.value : null };
    }
    case "saveSetting": {
      if (!SHARED_KEYS.includes(p.key)) throw new E("Unknown setting");
      if (ADMIN_KEYS.includes(p.key) && u.role !== "Admin") throw new E("Only the admin can change this", 403);
      await sb.from("rm_settings").upsert({ key: p.key, value: p.value, updated_at: new Date().toISOString() }); return { ok: true };
    }
    /* ---------- admin ---------- */
    case "saveOrg": case "setPassword": case "status": case "dirUsers": case "setPasswords": {
      if (u.role !== "Admin") throw new E("Only the admin can do this", 403);
      if (a === "dirUsers") {
        const { data: s0 } = await sb.from("rm_settings").select("value").eq("key", "dir_admin").maybeSingle();
        const adminEmail = String(s0?.value || "");
        if (!adminEmail) throw new E("Google admin account for the staff list is not set", 500);
        const tok = await gToken(adminEmail, DIR);
        const users: any[] = []; let pt = "";
        do {
          const r = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&orderBy=email&fields=users(primaryEmail,name/fullName,suspended,orgUnitPath,organizations),nextPageToken${pt ? "&pageToken=" + pt : ""}`, { headers: { Authorization: "Bearer " + tok } });
          const j = await r.json();
          if (!r.ok) throw new E(/has not been used|disabled/i.test(j.error?.message || "") ? "Admin SDK API is off. Turn it on in Google Cloud (project quiet-maxim-504613-g7), wait 2 minutes, then try again." : "Google staff list: " + (j.error?.message || r.status), 502);
          for (const x of j.users || []) users.push({ email: String(x.primaryEmail).toLowerCase(), name: x.name?.fullName || x.primaryEmail, suspended: !!x.suspended, ou: x.orgUnitPath || "/", title: x.organizations?.[0]?.title || "", department: x.organizations?.[0]?.department || "" });
          pt = j.nextPageToken || "";
        } while (pt && users.length < 5000);
        return { users };
      }
      if (a === "setPasswords") {
        const list = Array.isArray(p.list) ? p.list.slice(0, 500) : [];
        for (const x of list) { if (String(x.password || "").length < 6) throw new E("Each password needs at least 6 characters"); }
        for (const x of list) { await sb.rpc("rm_set_password", { p_user: x.id, p_pw: String(x.password) }); await sb.from("rm_users").update({ must_change: true }).eq("id", x.id); }
        return { ok: true, n: list.length };
      }
      if (a === "setPassword") {
        if (String(p.password || "").length < 6) throw new E("Password needs at least 6 characters");
        await sb.rpc("rm_set_password", { p_user: p.id, p_pw: String(p.password) });
        await sb.from("rm_users").update({ must_change: true }).eq("id", p.id);
        await sb.from("rm_sessions").delete().eq("user_id", p.id).neq("token_hash", await tokHash(p.token));
        const { data: pu } = await sb.from("rm_users").select("login").eq("id", p.id).maybeSingle();
        if (pu?.login) await sb.from("rm_login_attempts").delete().eq("login", String(pu.login).toLowerCase());   // a reset also lifts a lock
        return { ok: true };
      }
      if (a === "status") { const { data } = await sb.from("rm_mailboxes").select("*"); return { mailboxes: data || [] }; }
      const ds = p.org?.depts || [], us = p.org?.people || [];
      for (const d of ds) {
        const mailbox = String(d.mailbox || "").toLowerCase();
        if (!d.id || !d.name || !/^[^@\s]+@[^@\s]+$/.test(mailbox)) throw new E("Each department needs a name and a mailbox");
        if (d.id === "alpha" && mailbox !== "teamalpha@" + DOMAIN) throw new E("Team Alpha is fixed to teamalpha@" + DOMAIN);
        await sb.from("rm_departments").upsert({ id: d.id, name: d.name, mailbox, color: d.color || "#ff5001" });
        await sb.from("rm_mailboxes").upsert({ mailbox }, { onConflict: "mailbox", ignoreDuplicates: true });
      }
      const keep = new Set(ds.map((d: any) => d.id));
      for (const d of await depts()) if (!keep.has(d.id)) {
        const [{ count: nu }, { count: nt }] = await Promise.all([sb.from("rm_users").select("id", { count: "exact", head: true }).eq("dept_id", d.id), sb.from("rm_threads").select("gmail_thread_id", { count: "exact", head: true }).eq("mailbox", d.mailbox)]);
        if (!nu && !nt) await sb.from("rm_departments").delete().eq("id", d.id);
      }
      const goneIds = await deletedUsers();
      for (const x of us) {
        // 18 Nov 2026: an admin whose page still lists a deleted user must not bring them back by saving
        if (x.id && goneIds[x.id]) continue;
        if (!x.id || !x.name || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(x.login || ""))) throw new E("Each user needs a name and a valid user ID");
        if (x.id === u.id && x.role !== "Admin") throw new E("You cannot remove your own admin role");
        await sb.from("rm_users").upsert({ id: x.id, name: x.name, login: String(x.login).toLowerCase(), dept_id: x.dept_id, role: x.role, active: x.active !== false, perm: x.perm || {}, access: x.access || {} });
        if (x.active === false) await sb.from("rm_sessions").delete().eq("user_id", x.id);
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
        if (!count) throw new E("This is the last admin — make someone else Admin first");
      }
      const now = new Date().toISOString();
      const { data: un } = await sb.from("rm_threads").update({ owner_id: null, updated_at: now }).eq("owner_id", id).select("gmail_thread_id");
      await sb.from("rm_scheduled").update({ status: "cancelled", error: "The user was deleted" }).eq("user_id", id).eq("status", "waiting");
      await sb.from("rm_presence").delete().eq("user_id", id);
      await sb.from("rm_sessions").delete().eq("user_id", id);
      if (x.login) await sb.from("rm_login_attempts").delete().eq("login", String(x.login).toLowerCase());
      const gone = await deletedUsers();
      gone[id] = { name: x.name, login: x.login, at: now, by: u.name };
      await sb.from("rm_settings").upsert({ key: "deleted_users", value: gone, updated_at: now });
      const { error } = await sb.from("rm_users").delete().eq("id", id);
      if (error) throw new E("Could not delete: " + error.message, 500);
      return { ...(await boot(u)), unassigned: (un || []).length };
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
    const err = e as E;
    return bad(err.message || "Something went wrong", err.code || 500);
  }
});
