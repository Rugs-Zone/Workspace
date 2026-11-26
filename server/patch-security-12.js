/* patch-security-12.js - 27 Nov 2026  (bug 12 - two small security holes)
 *
 * 1 · "Empty Deleted" writes the folder 'purged' (it takes a conversation out of Rugs Email's
 *     folders altogether), but the server only ever checked the delete right for the exact
 *     value 'deleted' - so somebody without that right could empty the Deleted folder, or
 *     post folder:'purged' by hand, and the server would allow it. The check now covers
 *     'purged' as well, and refuses it in the same words.
 *
 * 2 · The maintenance window could be walked past by anybody who set one value in their own
 *     browser (localStorage 'rugs-maint-ok'), because that was checked FIRST and on its own.
 *     The bypass is now only for a signed-in ADMIN, and "admin" means the role the SERVER
 *     sent with this session (boot -> PEOPLE/ME), not anything the browser can set.
 *
 * The app half is written into .tmp/email.html; the server half into
 * server/local-server/rugs-mail.bundle.mjs, which the office machine picks up with the next
 * version.txt.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-security-12.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
const B = path.join(__dirname, "local-server", "rugs-mail.bundle.mjs");

/* ---------------------------------------------------------------- 1 · server */
let b = fs.readFileSync(B, "utf8");
const OLD_DEL = 'if (patch.folder === "deleted" && !can(u, "delete")) throw new E("You can\'t delete mail", 403);';
const NEW_DEL = '/* __purgeright 27 Nov 2026: \'purged\' is what "Empty Deleted" writes - it needs the same\n'
  + '           right as a delete, or anyone could empty somebody\'s Deleted folder. */\n'
  + '        if ((patch.folder === "deleted" || patch.folder === "purged") && !can(u, "delete")) throw new E("You can\'t delete mail", 403);';
if (b.indexOf("__purgeright") >= 0) console.log("  server: already done");
else {
  if (b.split(OLD_DEL).length - 1 !== 1) throw new Error("the server's delete check is not where it was");
  b = b.split(OLD_DEL).join(NEW_DEL);
  fs.writeFileSync(B, b);
  console.log("  server: the delete right is now needed for 'purged' too");
}

/* ------------------------------------------------------------------ 2 · app */
let s = fs.readFileSync(F, "utf8");
const OLD_M = `/* who keeps working: Priyanshu, any switched session (only he can start one), and the
   escape hatch localStorage['rugs-maint-ok']='1' */
function maintMe(){
 try{
  if(localStorage.getItem('rugs-maint-ok')==='1')return true;
  if(typeof swOn==='function'&&swOn())return true;
  if(MAINT_IDS.indexOf(ME)>=0)return true;
  const p=(typeof who==='function'&&who(ME))||{};
  if(/^marketing@/i.test(String(p.login||'')))return true;
 }catch(e){}
 return false;
}`;
const NEW_M = `/* __maintadmin 27 Nov 2026 (bug 12): who keeps working during the window - an ADMIN, and
   nobody else. "Admin" is the role the SERVER sent with this session (boot fills PEOPLE and
   ME from the session token), so it cannot be claimed by the browser.
   What was here before: localStorage['rugs-maint-ok']='1' was checked FIRST and on its own,
   so anyone who set one value in their own browser was straight past the window. That value
   is now ignored unless the session is an admin's, and the id list and the "marketing@"
   login test are gone with it - a role is the thing to check, not an address. */
function maintMe(){
 try{
  if(!ME)return false;                                  /* nobody is signed in */
  const p=(typeof who==='function'&&who(ME))||null;
  if(!p||p.active===false)return false;
  if(p.role!=='Admin')return false;                     /* the only way past the window */
  return true;
 }catch(e){}
 return false;
}`;
if (s.indexOf("__maintadmin") >= 0) console.log("  app: already done");
else {
  if (s.split(OLD_M).length - 1 !== 1) throw new Error("the maintenance check is not where it was");
  s = s.split(OLD_M).join(NEW_M);
  /* the hard-coded id list is not used any more - a role is the thing to check */
  const OLD_IDS = "const MAINT_IDS=['adm'];\n";
  if (s.split(OLD_IDS).length - 1 === 1) s = s.split(OLD_IDS).join("");
  fs.writeFileSync(F, s);
  console.log("  app: only a signed-in admin can work during the maintenance window");
}
console.log("done");
