// 28 Nov 2026: delete ONE mail from a conversation (Rugs Email only - Gmail keeps it; can be undone).
// Anyone with full access to the conversation may do it. Stored in rm_settings.hidden_msgs as
// { "<mailbox>|<gmail id>": { by, at, t } } - sent to every app at boot (SHARED_KEYS), written only here
// (ADMIN_KEYS blocks a direct overwrite through saveSetting).
const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
if (s.includes('case "hideMsg"')) { console.log('already patched'); process.exit(0); }
const rep = (a, b) => { const c = s.split(a).length - 1; if (c !== 1) throw new Error('expected 1 of ' + a + ' found ' + c); s = s.replace(a, b); };
rep('"mgr_first_boxes", "mail_rules"];\nvar ADMIN_KEYS', '"mgr_first_boxes", "mail_rules", "hidden_msgs"];\nvar ADMIN_KEYS');
rep('var ADMIN_KEYS = ["rules", "blocked", "cats", "folders", "templates", "circulars", "mgr_first_boxes", "mail_rules"];',
    'var ADMIN_KEYS = ["rules", "blocked", "cats", "folders", "templates", "circulars", "mgr_first_boxes", "mail_rules", "hidden_msgs"];');
rep('    case "getSetting": {', `    case "hideMsg": {
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
    case "getSetting": {`);
fs.writeFileSync(f, s);
console.log('server hideMsg patched');
