/* 25 Nov 2026 - Rugs Zone: a "Server" tile (admins only) that opens the Server page.

   The page itself lives in Rugs Email (Admin -> Server), because that is where the
   signed-in mail session is - the office server only answers somebody signed in to
   Rugs Email as role Admin. So the tile opens mail.html?go=srv in the Rugs Email tab
   and lands straight on that page. Nothing is embedded, so there is no second sign-in
   and no duplicate copy of the page to keep in step.

   Run:  node server/patch-server-tile.js
*/
const fs = require("fs");
const file = __dirname + "/../index.html";
let s = fs.readFileSync(file, "utf8");
const done = [], skip = [];

function once(name, marker, find, make) {
  if (s.includes(marker)) { skip.push(name); return; }
  const i = s.indexOf(find);
  if (i < 0) throw new Error("not found for " + name + ": " + find.slice(0, 70));
  if (s.indexOf(find, i + 1) >= 0) throw new Error("appears more than once for " + name);
  s = s.slice(0, i) + make() + s.slice(i + find.length);
  done.push(name);
}

/* ---- 1. the tile ---- */
once("tile", '{ key: "srvmon"',
  '    { key: "directory", icon: "\u{1F4C7}", name: "Directory", status: "live", goto: "directory", category: "people" }',
  () => '    { key: "srvmon", icon: "\u{1F5A5}️", name: "Server", status: "live", goto: "srvmon", category: "work" },\n' +
        '    { key: "directory", icon: "\u{1F4C7}", name: "Directory", status: "live", goto: "directory", category: "people" }');

/* ---- 2. admins only (same shape as Management) ---- */
once("admins only", 'm.key !== "srvmon"',
  '      if (state.doer && state.doer.is_admin) { var mgDef = allModuleDefs.find(function (m) { return m.key === "management"; }); if (mgDef) modules.push(mgDef); }',
  () => '      if (state.doer && state.doer.is_admin) { var mgDef = allModuleDefs.find(function (m) { return m.key === "management"; }); if (mgDef) modules.push(mgDef); }\n' +
        '      // 25 Nov 2026: the Server page is for admins only (the mail server refuses anybody else anyway)\n' +
        '      modules = modules.filter(function (m) { return m.key !== "srvmon"; });\n' +
        '      if (state.doer && state.doer.is_admin && !state.demo) { var svDef = allModuleDefs.find(function (m) { return m.key === "srvmon"; }); if (svDef) modules.push(svDef); }');

/* ---- 3. what the tile does ---- */
once("open the page", 'view === "srvmon"',
  '    if (view === "customModule" && state.activeCustomModuleKey === MERCHANT_MODULE_KEY) view = "merchant";',
  () => '    // 25 Nov 2026: Server -> the Server page inside Rugs Email (same tab as the Email Tracker)\n' +
        '    if (view === "srvmon") {\n' +
        '      if (!(state.doer && state.doer.is_admin)) { toast("The Server page is for admins only."); return; }\n' +
        '      var srvWin = null; try { srvWin = window.open("mail.html?go=srv", "rugs-email"); } catch (e) {}\n' +
        '      if (srvWin) { try { srvWin.focus(); } catch (e) {} } else { toast("Allow pop-ups for this site, or open Rugs Email and go to Admin → Server."); }\n' +
        '      return;\n' +
        '    }\n' +
        '    if (view === "customModule" && state.activeCustomModuleKey === MERCHANT_MODULE_KEY) view = "merchant";');

fs.writeFileSync(file, s);
console.log("patched index.html");
console.log("  applied:      ", done.join(", ") || "(nothing)");
console.log("  already there:", skip.join(", ") || "(none)");
