/* patch-ignore-archive.js - 27 Nov 2026  (bug 8 - new locked rule R13i: Ignore conversation)
 *
 * Today "Ignore conversation" moves the conversation to DELETED and a trigger on the office
 * server (rm_ignore_trg) sends every later mail in it straight to Deleted as well - for the
 * whole team, silently, for ever. It is the one person-made setting that hides mail from
 * colleagues, and a conversation that "stopped arriving" is very hard to explain.
 *
 * R13i, the app half:
 *   1  Ignore conversation -> ARCHIVE (not Deleted), tagged "ignored", with the Activity
 *      trail line "Ignored by <name> - moved to Archive". Toast and Undo exactly as today.
 *      It is still marked done, which is what kept an ignored conversation out of the work
 *      lists when it went to Deleted - and Undo puts the old status back.
 *   2  a NEW mail in it comes back to the Inbox and the tag is taken off: that is the
 *      server half (the trigger), in server/local-server/server.mjs.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-ignore-archive.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

if (s.indexOf("__r13i") >= 0) { console.log("already done (marker __r13i is there)"); process.exit(0); }

/* ---- 1 · ignoring archives instead of deleting ---- */
const OLD_ON = "  const from=t.folder,prev=t.prev;t.cats=[...c,'ignored'];t.prev=from;t.folder='deleted';hist(t,'n',`Conversation ignored by ${who(ME).name} — new mails in it go straight to Deleted`);save();if(openId===t.id)openId=null;render();\n" +
  "  if(typeof undoToast==='function')undoToast('Conversation ignored — new mails go to Deleted',()=>{t.cats=(t.cats||[]).filter(x=>x!=='ignored');t.folder=from;t.prev=prev;hist(t,'n',`Ignore undone by ${who(ME).name}`);save();render()})}";

const NEW_ON = "  /* __r13i 27 Nov 2026: ignoring ARCHIVES the conversation. It used to go to Deleted, and a\n" +
  "     trigger on the office server then sent every later mail in it to Deleted as well. A new mail\n" +
  "     in it now comes back to the Inbox by itself and the tag is taken off (see rm_ignore_trg).\n" +
  "     It is still marked done, so it leaves the work lists exactly as it did in Deleted. */\n" +
  "  const from=t.folder,prev=t.prev,was=t.status,wasAt=t.doneAt;\n" +
  "  t.cats=[...c,'ignored'];t.prev=from;t.folder='archive';\n" +
  "  if(t.status!=='done'){t.status='done';t.doneAt=Date.now()}\n" +
  "  hist(t,'n',`Ignored by ${who(ME).name} — moved to Archive`);save();if(openId===t.id)openId=null;render();\n" +
  "  if(typeof undoToast==='function')undoToast('Conversation ignored — moved to Archive',()=>{t.cats=(t.cats||[]).filter(x=>x!=='ignored');t.folder=from;t.prev=prev;t.status=was;t.doneAt=wasAt;hist(t,'n',`Ignore undone by ${who(ME).name}`);save();render()})}";

if (s.split(OLD_ON).length - 1 !== 1) throw new Error("the ignore action is not where it was - look at cmOpen's 'ignore' branch");
s = s.split(OLD_ON).join(NEW_ON);

/* ---- 2 · "Stop ignoring" no longer promises anything about new mail: a new mail always
            comes back to the Inbox now, whether the tag is on or off ---- */
const OLD_OFF = "hist(t,'n',`Ignore turned off by ${who(ME).name} — new mails stay in the Inbox again`)";
const NEW_OFF = "hist(t,'n',`Ignore turned off by ${who(ME).name}`)";
if (s.split(OLD_OFF).length - 1 !== 1) throw new Error("the 'Stop ignoring' line is not where it was");
s = s.split(OLD_OFF).join(NEW_OFF);

/* ---- 3 · the menu entry says where it goes ---- */
const OLD_IT = "it('ignore',ign?'\u{1F514} Stop ignoring':'\u{1F515} Ignore conversation'";
const NEW_IT = "it('ignore',ign?'\u{1F514} Stop ignoring':'\u{1F515} Ignore conversation (to Archive)'";
if (s.split(OLD_IT).length - 1 !== 1) throw new Error("the Ignore menu entry is not where it was");
s = s.split(OLD_IT).join(NEW_IT);

fs.writeFileSync(F, s);
console.log("3 edits written to " + F);
