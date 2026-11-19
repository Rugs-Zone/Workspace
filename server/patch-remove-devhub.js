/* 19 Nov 2026 - "delete the Developer module". Takes the 🛠️ Developer module out of the Workspace
   completely: its tile, its screen, its stylesheet and all ~700 lines of its code (the CEO agent inbox,
   the six helper agents and the "publish index.html to GitHub" tools), plus every line that pointed at
   it. Nothing else loses anything - the two places that called into it were already written as
   "call this only if it exists".
   Checked before writing this: nothing outside the module uses its code (ahApi, ghApi, dhIsDev,
   AGENT_FN_URL, DEVHUB_FN_URL, the 183 dh.* uses - all inside it), and its stylesheet (.dh-*) is used
   by nothing else.
   The server side (edge function devhub-api, and agent-hub) is NOT deleted here - say the word and it
   goes too. The agents themselves were switched off earlier today.
   Run:  node server/patch-remove-devhub.js
*/
const fs = require('fs');
const F = 'index.html';
let lines = fs.readFileSync(F, 'utf8').split('\n');
let n = 0;

// ---- helpers that refuse to guess ----
function lineAt(i) { return lines[i - 1]; }
function cutRange(name, from, to, firstMust, lastMust) {
  if (!lineAt(from).includes(firstMust)) { console.error('FAILED ' + name + ': line ' + from + ' is not "' + firstMust + '"'); process.exit(1); }
  if (!lineAt(to).includes(lastMust)) { console.error('FAILED ' + name + ': line ' + to + ' is not "' + lastMust + '"'); process.exit(1); }
  lines.splice(from - 1, to - from + 1);
  n++; console.log('ok  ' + name + ' (' + (to - from + 1) + ' lines)');
}
function edit(name, old, nw) {
  const s = lines.join('\n');
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED ' + name + ': found ' + c + ' times'); process.exit(1); }
  lines = s.replace(old, () => nw).split('\n');
  n++; console.log('ok  ' + name);
}
function cutLine(name, needle, expect) {
  const hit = [];
  lines.forEach((l, i) => { if (l.includes(needle)) hit.push(i) });
  if (hit.length !== (expect || 1)) { console.error("FAILED " + name + ": found " + hit.length + " line(s), wanted " + (expect || 1)); process.exit(1) }
  hit.reverse().forEach(i => lines.splice(i, 1));
  n++; console.log("ok  " + name + " (" + hit.length + " line" + (hit.length > 1 ? "s" : "") + ")");
}
const find = (needle, from) => {
  for (let i = (from || 1); i <= lines.length; i++) if (lines[i - 1].includes(needle)) return i;
  console.error('FAILED: could not find ' + needle); process.exit(1);
};

// ---- 1. the code (biggest piece first, so the line numbers below are found fresh each time) ----
{
  const a = find('// ---------- 🛠️ Developer — CEO agent');
  const b = find('// ---------- 🧑‍🔧 My Helper — a personal agent', a) - 1;
  cutRange('the Developer code', a, b, '🛠️ Developer', '');
}
// ---- 2. its screen ----
{
  const a = find('<div id="view-devhub" class="hidden">');
  const b = find('<div id="view-helper" class="hidden">', a) - 1;
  cutRange('the Developer screen', a, b, 'view-devhub', '</div>');
}
// ---- 3. its stylesheet ----
{
  const a = find('/* ---------- 🛠️ Developer ---------- */');
  const b = find('/* ---------- 🧑‍🔧 My Helper ---------- */', a) - 1;
  cutRange('the Developer stylesheet', a, b, '🛠️ Developer', '');
}
// ---- 4. the tile ----
cutLine('the tile on the Workspace', '{ key: "devhub", icon:');

// ---- 5. everything that pointed at it ----
edit('bell notices no longer jump to it',
  '(/^agent_(brief|urgent)$/.test(String(n.type || "")) ? "devhub" : { complaint:',
  '({ complaint:');
edit('the "agents" shortcut', '    var alias = { agents: "devhub" };', '    var alias = {};');
edit('it is no longer a screen the app knows', '"dispatch", "devhub", "helper"]', '"dispatch", "helper"]');
cutLine('the "only for the Developer rank" check', 'if (view === "devhub" && !state.dhAccess)');
cutLine('nothing loads it any more', 'if (view === "devhub") dhLoad();');
edit('it is not filtered out of the tile list any more',
  ' && m.key !== "dispatch" && m.key !== "devhub" && m.key !== "helper"', ' && m.key !== "dispatch" && m.key !== "helper"');
cutLine('it is not added back for the Developer rank', 'if (state.dhAccess) { var dhDef');
cutLine('the access checks it used to do', 'if (typeof dhAccessCheck === "function") dhAccessCheck();', 2);

fs.writeFileSync(F, lines.join('\n'));
console.log(n + ' changes done');
