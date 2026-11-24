/* 24 Nov 2026 — wire the "USD–INR Rates" screen (module key "fxrates") into index.html.
 *
 * The screen itself lives in server/fx-rates.view.js — edit that file and run this again
 * (the block between the markers is replaced, never doubled). The backend (edge function
 * fx-api + the two pg_cron jobs) is already live and is not touched.
 *
 * Eight places, the same ones every native Workspace screen uses:
 *   1. the screen's markup           (next to view-spareparts)
 *   2. the code                      (between __fx:start / __fx:end, by the ops helpers)
 *   3. the tile                      (MODULE_DEFS)
 *   4. ALL_VIEWS
 *   5. the render call               (next to renderSpareParts)
 *   6. the "can you open it" check   (switchView)
 *   7. the tile is always there for admins (the module grid)
 *   8. one line in renderNoticeTicker, so the rate leads the Bulletin bar
 *
 * Access note: fx-api decides with `is_admin || visible_modules contains "fxrates"`, so the
 * tile follows Manage Visibility like plantelec — NOT "Delegated module access"
 * (managed_modules), which is what spareparts and courier use. Wiring it the spareparts way
 * would show the tile to people the function then refuses.
 *
 *   node server/patch-fx-rates.js
 */
const fs = require('fs');
const F = 'index.html';
let s = fs.readFileSync(F, 'utf8');
const nl = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const R = (x) => x.replace(/\n/g, nl);
let n = 0;
function one(find, repl, what) {
  const f = R(find);
  const c = s.split(f).length - 1;
  if (c !== 1) throw new Error('expected 1 match for ' + what + ', found ' + c);
  s = s.replace(f, R(repl));
  n++;
  console.log('  ok  ' + what);
}
function already(probe, what) {
  if (s.indexOf(R(probe)) >= 0) { console.log('  --  ' + what + ': already there'); return true; }
  return false;
}

/* ---- 1. the screen's markup ---- */
if (!already('id="view-fxrates"', 'screen markup')) {
  one(
`    <div id="view-spareparts" class="hidden">`,
`    <div id="view-fxrates" class="hidden">
      <div class="page-head">
        <h2>USD–INR Rates 💵</h2>
      </div>
      <div class="page-sub" style="margin-top:-14px">Today's dollar rate in rupees, the week's and the month's high and low, and who gets the 10 AM email.</div>
      <div id="fxWrap"></div>
    </div>
    <div id="view-spareparts" class="hidden">`,
    'screen markup'
  );
}

/* ---- 2. the code ---- */
const S0 = '  /* __fx:start */', S1 = '  /* __fx:end */';
const view = fs.readFileSync('server/fx-rates.view.js', 'utf8').replace(/\r\n/g, '\n').trim();
const block = [S0, view.split('\n').map((l) => (l ? '  ' + l : l)).join('\n'), S1].join('\n');
if (s.indexOf(S0) >= 0) {
  const a = s.indexOf(S0), b = s.indexOf(S1) + S1.length;
  s = s.slice(0, a) + R(block) + s.slice(b);
  n++;
  console.log('  ok  code (block replaced)');
} else {
  one('  function opsApi(action, payload) {', block + nl + '  function opsApi(action, payload) {', 'code');
}

/* ---- 3. the tile ---- */
if (!already('key: "fxrates"', 'tile')) {
  one(
`    { key: "plantelec", icon: "⚡", name: "Plant Electrical", status: "live", goto: "plantelec", category: "production" },`,
`    { key: "plantelec", icon: "⚡", name: "Plant Electrical", status: "live", goto: "plantelec", category: "production" },
    { key: "fxrates", icon: "💵", name: "USD–INR Rates", status: "live", goto: "fxrates", category: "work" },`,
    'tile'
  );
}

/* ---- 4. ALL_VIEWS ---- */
if (!already('ALL_VIEWS = ["myday", "fxrates"', 'ALL_VIEWS')) {
  one('var ALL_VIEWS = ["myday", "plantelec",', 'var ALL_VIEWS = ["myday", "fxrates", "plantelec",', 'ALL_VIEWS');
}

/* ---- 5. the render call ---- */
if (!already('if (view === "fxrates") renderFxRates();', 'render call')) {
  one(
'    if (view === "spareparts") renderSpareParts();',
'    if (view === "fxrates") renderFxRates();\n    if (view === "spareparts") renderSpareParts();',
    'render call'
  );
}

/* ---- 6. the "can you open it" check ---- */
if (!already('if (view === "fxrates" && !canSeeFxRates())', 'access check')) {
  one(
'    if (view === "spareparts" && !canManageModule("spareparts")) { toast("You don\'t have access to Spare Parts. Ask your admin (Module access)."); return; }',
'    if (view === "fxrates" && !canSeeFxRates()) { toast("USD–INR Rates isn\'t switched on for you. Ask your admin (Manage Visibility)."); return; }\n' +
'    if (view === "spareparts" && !canManageModule("spareparts")) { toast("You don\'t have access to Spare Parts. Ask your admin (Module access)."); return; }',
    'access check'
  );
}

/* ---- 7. admins always see the tile ---- */
if (!already('m.key !== "fxrates"', 'tile for admins')) {
  one(
`      // Spare Parts: admins + people given it in Module access.`,
`      // USD–INR Rates: admins always; everybody else when it is ticked in Manage Visibility
      // (the same rule fx-api enforces on the server).
      modules = modules.filter(function (m) { return m.key !== "fxrates"; });
      if (canSeeFxRates()) { var fxDef = allModuleDefs.find(function (m) { return m.key === "fxrates"; }); if (fxDef) modules.push(fxDef); }
      // Spare Parts: admins + people given it in Module access.`,
    'tile for admins'
  );
}

/* ---- 8. the rate rides in the Bulletin bar at the top of every page ---- */
if (!already('if (typeof fxTickerItem === "function") { var fxLine', 'rate in the bulletin')) {
  one(
    ['    var items = [];', '    notices.forEach(function (n) {'].join('\n'),
    [
      '    var items = [];',
      '    /* 24 Nov 2026: the USD–INR rate leads the bulletin, for the people who may see it */',
      '    if (typeof fxTickerItem === "function") { var fxLine = fxTickerItem(); if (fxLine) items.push(fxLine); }',
      '    notices.forEach(function (n) {'
    ].join('\n'),
    'rate in the bulletin'
  );
}

fs.writeFileSync(F, s);
console.log('patch-fx-rates: ' + n + ' edits applied');
