/* 23 Nov 2026 — Rugs Email: in Team Designing a mail may only be given to
 * somebody in that team.
 *
 * On 20 Nov the Owner box was widened so an Admin / CRM / Manager / Lead could
 * also pick a person from ANOTHER team, which moves the conversation to that
 * team and makes it theirs in one step (`ownerSelect` wrapper + `assignAway`).
 * That is right for the merchant teams, where Priya has to push work out of a
 * one-person mailbox such as Vinay's.
 *
 * Team Designing is the manager-first team (MGR_FIRST): Anamika hands the work
 * out inside her own team. Offering her the other eight teams in the same list
 * is how a design mail ends up in Marketing by one wrong click.
 *
 * So for a conversation in a manager-first mailbox the Owner box now lists that
 * team's own people only — the other teams' groups are not added. Everything
 * else is untouched: the same box in every other team still offers them, and
 * Transfer is still there for the rare case where a Designing mail really does
 * belong to another team (it asks which team, and that team's own manager then
 * picks the owner).
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-designing-assign-own-dept.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;

function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) { console.error('STOP: "' + what + '" matched ' + c + ' times, expected 1'); process.exit(1); }
  s = s.replace(find, repl);
  n++;
  console.log('  ok  ' + what);
}

one(
  " if(!canAssignOut())return base;",
  " if(!canAssignOut())return base;\n" +
  " /* 23 Nov 2026: a manager-first team (Team Designing) hands work out inside its own team only */\n" +
  " if(mgrFirst(t.dept))return base;",
  'Team Designing: the Owner box offers that team only'
);

fs.writeFileSync(F, s);
console.log(n + ' edit(s) applied to ' + F);
