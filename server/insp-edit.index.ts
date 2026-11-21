// insp-edit — Inspection: let anyone who can OPEN the Inspection module correct a logged
// inspection (the person's name, the buyer, the date and time, the reason, the location).
//
// 21 Nov 2026. Before this, the only way to fix a wrong date was the shared admin Edit in
// deleg-admin (adminRecordUpdate), which calls requireAdmin() — so a merchant who logged an
// inspection himself could not correct his own typo and had to ask an admin.
//
// WHY ITS OWN FUNCTION, and not a change to deleg-admin:
//   deleg-admin is one 700-line file that also carries Press & Blogs, the whole buyer portal
//   (register / login / samples / orders), the staff buyer dashboard and in-app notifications.
//   Deploying it means replacing that entire file to change four lines, which risks all of those
//   for no reason. This function does one thing, so the permission rule for it is in one small
//   place that can be read end to end. DELETING an inspection is deliberately NOT here: that
//   stays with admins through deleg-admin, exactly as before.
//
// Security: the caller must present a live server-side session (the same deleg_sessions
// token_hash the Workspace login issues) that belongs to the doc_id it claims — a bare doc_id is
// not proof of anything. Only the five editable columns are ever written, and who edited it is
// recorded, because the edit right is now shared by the whole team.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ok = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), { headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (message: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { ...CORS, "Content-Type": "application/json" } });
// 401 + SESSION_EXPIRED is what makes the Workspace ask for a fresh login (same as deleg-admin).
const sessionFail = () =>
  new Response(JSON.stringify({ ok: false, error: "Please sign in again.", code: "SESSION_EXPIRED" }), {
    status: 401, headers: { ...CORS, "Content-Type": "application/json" },
  });

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** doc_id that owns a live session, or null. Same table and hash as the Workspace login. */
async function sessionDocId(token: unknown): Promise<string | null> {
  const t = typeof token === "string" ? token.trim() : "";
  if (t.length < 10) return null;
  const { data } = await sb
    .from("deleg_sessions")
    .select("doc_id,expires_at,revoked_at")
    .eq("token_hash", await sha256Hex(t))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.doc_id;
}

/** The app shows a module tile when visible_modules is not a list (null = every module) or it
 *  contains the key, and when an admin has not switched the module off in module_overrides.
 *  This mirrors that exactly, so "can edit" can never be wider than "can open". */
async function canOpenInspection(docId: string): Promise<{ ok: boolean; why?: string; name: string; admin: boolean }> {
  const { data: d, error } = await sb
    .from("deleg_doers")
    .select("is_admin,visible_modules,is_deleted,name,delegation_name")
    .eq("doc_id", docId)
    .maybeSingle();
  if (error) throw error;
  const name = String((d as any)?.delegation_name || d?.name || docId);
  if (!d || d.is_deleted) return { ok: false, why: "Your account is no longer active.", name, admin: false };
  const admin = !!d.is_admin;

  const { data: meta } = await sb.from("deleg_meta").select("value").eq("key", "module_overrides").maybeSingle();
  const ov = (meta?.value as Record<string, { off?: boolean }>) || {};
  if (ov?.inspection?.off && !admin) return { ok: false, why: "The Inspection module is switched off.", name, admin };

  if (admin) return { ok: true, name, admin };
  const vm = d.visible_modules;
  if (!Array.isArray(vm)) return { ok: true, name, admin };           // null = every module
  if (vm.includes("inspection")) return { ok: true, name, admin };
  return { ok: false, why: "You do not have the Inspection module.", name, admin };
}

/** The only columns this function will ever write — the same five the admin edit allows. */
const FIELDS = ["visitor_name", "buyer_name", "visit_at", "reason", "location"] as const;
/** Columns that the table declares NOT NULL, so they may be corrected but never emptied. */
const REQUIRED = new Set(["visitor_name", "buyer_name", "reason"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);

  let body: any = {};
  try { body = await req.json(); } catch { return fail("invalid JSON"); }
  if (body.action !== "inspectionUpdate") return fail("unknown action: " + body.action);

  try {
    const claimed = String(body.requester_doc_id || "").trim();
    const sdoc = await sessionDocId(body.session_token);
    if (!claimed || !sdoc || sdoc !== claimed) return sessionFail();

    const gate = await canOpenInspection(claimed);
    if (!gate.ok) return fail(gate.why || "not allowed", 403);

    const id = String(body.id || "").trim();
    if (!id) return fail("id required");

    const patch = (body.patch && typeof body.patch === "object") ? body.patch : {};
    const clean: Record<string, unknown> = {};
    for (const k of FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      const raw = patch[k];
      const v = typeof raw === "string" ? raw.trim() : raw;
      if (v === "" || v === null || v === undefined) {
        // location may be cleared; the others are NOT NULL in the table, so refuse plainly
        // instead of letting Postgres answer with its own error text.
        if (REQUIRED.has(k)) return fail("Please fill in the " + k.replace(/_/g, " ") + ".");
        clean[k] = null;
        continue;
      }
      if (k === "visit_at") {
        const t = new Date(String(v));
        if (isNaN(t.getTime())) return fail("That date and time could not be read.");
        clean[k] = t.toISOString();
      } else {
        clean[k] = String(v).slice(0, 500);
      }
    }
    if (!Object.keys(clean).length) return fail("nothing to update");

    const { data: before, error: e0 } = await sb
      .from("deleg_inspections").select("id").eq("id", id).maybeSingle();
    if (e0) throw e0;
    if (!before) return fail("That inspection no longer exists.", 404);

    // Who changed it, because every member of the team can now edit any inspection.
    clean.edited_by = gate.name;
    clean.edited_at = new Date().toISOString();

    const { error } = await sb.from("deleg_inspections").update(clean).eq("id", id);
    if (error) throw error;
    return ok({ id, edited_by: gate.name, edited_at: clean.edited_at });
  } catch (e) {
    console.error(e);
    return fail((e as Error).message || "internal error", 500);
  }
});
