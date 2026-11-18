// dash-upload — "File upload" card on the Rugs Zone Workspace Home dashboard
// (18 Nov 2026).
//
// What it does
//   start   browser asks for a one-time upload link into the private bucket
//           "dash-uploads" (nothing is stored yet)
//   done    browser says "the file is in" -> one row in public.dash_uploads
//           (file name, size, who, when)
//   list    the card's own list of recent uploads, with 1-hour download links
//   remove  hides a row and deletes the file from the bucket
//
// The Z:\ copier script on the company server uses two more actions, signed
// with the secret in public.dash_sync_keys (name 'zdrive') instead of a login:
//   pending  files not yet copied to Z:\, each with a download link
//   mark     "copied to this Z:\ path" (or "it failed, here is why")
//
// Sign-in: the normal Workspace session token (deleg_sessions), and the person
// must be an admin — the card is admin-only for now.
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BUCKET = "dash-uploads";
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB per file (same as the bucket)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const bad = (msg: string, status = 400) => Object.assign(new Error(msg), { status });

async function sha256Hex(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---- who is calling ----------------------------------------------------
async function signedIn(tok: string) {
  if (!tok || tok.length < 32 || tok.length > 128) throw bad("Please sign in to Rugs Zone again.", 401);
  const { data: ses } = await sb.from("deleg_sessions")
    .select("doc_id,expires_at,revoked_at").eq("token_hash", await sha256Hex(tok)).maybeSingle();
  if (!ses || ses.revoked_at || new Date(ses.expires_at).getTime() < Date.now())
    throw bad("Your session has ended — please sign in again.", 401);
  const { data: d } = await sb.from("deleg_doers")
    .select("doc_id,name,delegation_name,is_admin,role,is_deleted").eq("doc_id", ses.doc_id).maybeSingle();
  if (!d || d.is_deleted) throw bad("Your account is not active.", 401);
  if (!(d.is_admin || d.role === "super_admin")) throw bad("Only admins can upload files here.", 403);
  return d;
}

async function syncCaller(key: string) {
  if (!key || key.length < 32) throw bad("Not allowed.", 401);
  const { data } = await sb.from("dash_sync_keys").select("key_hash").eq("name", "zdrive").maybeSingle();
  if (!data || data.key_hash !== (await sha256Hex(key))) throw bad("Not allowed.", 401);
  await sb.from("dash_sync_keys").update({ last_used_at: new Date().toISOString() }).eq("name", "zdrive");
  return true;
}

// ---- helpers -----------------------------------------------------------
// Keep the person's own file name readable but safe for a Windows folder and
// for a storage key: letters, digits, space, dot, dash, underscore, brackets.
function safeName(n: string) {
  const clean = String(n || "file").replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
    .replace(/[^\w .()\-\[\]]+/g, "_").replace(/_{2,}/g, "_").replace(/^[. ]+/, "").trim();
  return (clean || "file").slice(0, 120);
}
function newPath(name: string) {
  const now = new Date();
  const y = now.getUTCFullYear(), m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${y}/${m}/${stamp}-${crypto.randomUUID().slice(0, 8)}-${safeName(name)}`;
}
const rowCols = "id,file_name,stored_path,size_bytes,mime,note,uploaded_by,uploaded_by_name,uploaded_at,z_copied_at,z_path,z_error";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // ---------------- the Z:\ copier script ----------------
    if (action === "pending" || action === "mark") {
      await syncCaller(String(body.sync_key || ""));

      if (action === "pending") {
        const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
        const { data: rows, error } = await sb.from("dash_uploads").select(rowCols)
          .is("z_copied_at", null).is("deleted_at", null).lt("z_tries", 6)
          .order("id", { ascending: true }).limit(limit);
        if (error) throw new Error(error.message);
        const out: unknown[] = [];
        for (const r of rows || []) {
          const { data: link } = await sb.storage.from(BUCKET).createSignedUrl(r.stored_path, 3600);
          if (link?.signedUrl) out.push({ ...r, url: link.signedUrl });
        }
        return json({ ok: true, data: { files: out } });
      }

      const id = Number(body.id);
      if (!id) throw bad("Which file?");
      if (body.error) {
        const { data: cur } = await sb.from("dash_uploads").select("z_tries").eq("id", id).maybeSingle();
        await sb.from("dash_uploads").update({ z_error: String(body.error).slice(0, 500), z_tries: (cur?.z_tries || 0) + 1 }).eq("id", id);
        return json({ ok: true, data: { saved: true } });
      }
      await sb.from("dash_uploads").update({
        z_copied_at: new Date().toISOString(), z_path: String(body.z_path || "").slice(0, 500), z_error: null,
      }).eq("id", id);
      return json({ ok: true, data: { saved: true } });
    }

    // ---------------- the dashboard card ----------------
    const me: any = await signedIn(String(body.session_token || ""));
    const myName = String(me.delegation_name || me.name || "").replace(/\s+-\s+.*$/, "");

    if (action === "list") {
      const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
      const { data: rows, error } = await sb.from("dash_uploads").select(rowCols)
        .is("deleted_at", null).order("id", { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      const paths = (rows || []).map((r: any) => r.stored_path);
      const links: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
        for (const s of signed || []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
      }
      const { count } = await sb.from("dash_uploads").select("id", { count: "exact", head: true }).is("deleted_at", null);
      return json({ ok: true, data: { files: (rows || []).map((r: any) => ({ ...r, url: links[r.stored_path] || "" })), total: count || 0 } });
    }

    if (action === "start") {
      const name = String(body.name || "").trim();
      const size = Number(body.size) || 0;
      if (!name) throw bad("The file has no name.");
      if (size > MAX_BYTES) throw bad("That file is over 100 MB — please send it as a Google Drive link instead.");
      const path = newPath(name);
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data?.signedUrl) throw new Error(error?.message || "Could not start the upload.");
      return json({ ok: true, data: { path, signed_url: data.signedUrl } });
    }

    if (action === "done") {
      const path = String(body.path || "");
      const name = String(body.name || "").trim();
      if (!path || !name) throw bad("Missing the file details.");
      // Trust the bucket, not the browser: read the real object back.
      const folder = path.split("/").slice(0, -1).join("/");
      const base = path.split("/").pop() || "";
      const { data: found } = await sb.storage.from(BUCKET).list(folder, { search: base, limit: 1 });
      const obj = (found || [])[0];
      if (!obj) throw bad("The file did not arrive — please try again.");
      const { data: row, error } = await sb.from("dash_uploads").insert({
        file_name: safeName(name), stored_path: path,
        size_bytes: Number((obj as any).metadata?.size) || Number(body.size) || 0,
        mime: String((obj as any).metadata?.mimetype || body.mime || "").slice(0, 160) || null,
        note: body.note ? String(body.note).slice(0, 500) : null,
        uploaded_by: me.doc_id, uploaded_by_name: myName,
      }).select(rowCols).single();
      if (error) throw new Error(error.message);
      return json({ ok: true, data: { file: row } });
    }

    if (action === "remove") {
      const id = Number(body.id);
      if (!id) throw bad("Which file?");
      const { data: row } = await sb.from("dash_uploads").select("stored_path").eq("id", id).maybeSingle();
      if (!row) throw bad("That file is already gone.", 404);
      await sb.storage.from(BUCKET).remove([row.stored_path]);
      await sb.from("dash_uploads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true, data: { removed: true } });
    }

    throw bad("Unknown action: " + action);
  } catch (e) {
    const st = (e as any)?.status || 500;
    if (st === 500) console.error("dash-upload", e);
    return json({ ok: false, error: (e as Error).message || "Something went wrong" }, st);
  }
});
