/* patch-server-owner-team.js - 27 Nov 2026  (night plan, bug 4 - locked rule R29a)
 *
 * The app no longer offers anybody outside the mailbox's own team in the Owner box, but the
 * app is only a screen: anyone who can sign in can post a `meta` change with any owner_id in
 * it. This closes that - the server checks the owner against the conversation's team and
 * refuses the write.
 *
 *   - the team is the one the conversation is IN, after any dept_id in the same patch (so a
 *     transfer that hands it to somebody in the receiving team still works);
 *   - the owner must be an ACTIVE user of that team;
 *   - clearing the owner (owner_id null) is always allowed - that is "back to unassigned",
 *     which is what the admin's "Move to team…" does.
 *
 * Re-runnable. Remember to put a new value in server/local-server/version.txt.
 *
 * Run:  node server/patch-server-owner-team.js
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "local-server", "rugs-mail.bundle.mjs");
let s = fs.readFileSync(F, "utf8");

const MARK = "__r29a_owner";
if (s.indexOf(MARK) >= 0) { console.log("already done - nothing changed"); process.exit(0); }

const FIND = '        if ("owner_id" in patch && patch.owner_id && patch.owner_id !== u.id && !can(u, "assign")) throw new E("You can\'t assign mail to others", 403);';
if (s.split(FIND).length - 1 !== 1) throw new Error("the owner check is not in the bundle exactly once");

const ADD = FIND + "\n" +
  '        /* ' + MARK + ' 27 Nov 2026 (R29a): a conversation can only belong to somebody in the\n' +
  '           team that owns that mailbox. The Owner box stopped offering anyone else, and this\n' +
  '           is the same rule on the server, so a crafted request cannot do it either.\n' +
  '           Clearing the owner is always allowed - that is "back to unassigned". */\n' +
  '        if ("owner_id" in patch && patch.owner_id) {\n' +
  '          const teamId = ("dept_id" in patch && patch.dept_id) ? patch.dept_id : d.id;\n' +
  '          const { data: ow } = await sb.from("rm_users").select("id,name,dept_id,active").eq("id", patch.owner_id).maybeSingle();\n' +
  '          if (!ow || ow.active === false) throw new E("That person is not an active user", 400);\n' +
  '          if (String(ow.dept_id || "") !== String(teamId || "")) {\n' +
  '            const { data: tm } = await sb.from("rm_departments").select("name").eq("id", teamId).maybeSingle();\n' +
  '            throw new E((ow.name || "That person") + " is not in " + ((tm && tm.name) || "that team") + ". Move the conversation to their team first.", 403);\n' +
  '          }\n' +
  '        }';

s = s.replace(FIND, ADD);
fs.writeFileSync(F, s);
console.log("patched " + path.basename(F) + " - the server now refuses an owner from another team");
