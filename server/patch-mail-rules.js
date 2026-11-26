/* patch-mail-rules.js - 26 Nov 2026
 *
 * "Publish my rules as a setting in Rugs Email, in Settings and Admin control, so that if we
 *  change any rule it tells us what it conflicts with and what error that change will cause."
 *
 * WHAT IT DOES
 *   1. embeds server/mail-rules.view.js into the mail app between __rules:start / __rules:end
 *      (safe to run again - the old block is replaced, never doubled);
 *   2. makes EIGHT rules genuinely switchable by adding a gate at the one place each is
 *      decided, so a switch on the page really changes the app and is not a dead control:
 *        R1  mail nobody has taken is seen by the whole team   -> seeMine
 *        R3  a conversation somebody has taken is private      -> seeMine
 *        R7  Done mail stays in the Inbox                      -> wrappers in the block
 *        R10 a login code is shown to the whole team           -> the OTP wrapper
 *        R11 Workspace notifications keep their own folder      -> wrapper in the block
 *        R17 one row per mail / one row per conversation       -> LV()
 *        R27 replying takes ownership                          -> sendReply
 *        C5  everybody may transfer and assign                 -> can()
 *   3. fixes a latent bug found while doing it: applyBoot never set S.settings, so the
 *      26 Nov per-department manager-first setting (mgr_first_boxes) was never read from the
 *      server at all - mgrFirstBoxes() always fell back to the empty built-in list;
 *   4. records each person's View menu "Show" filter in S.lvOf, so the page can name the
 *      people whose own filter is hiding their mail (the commonest "my mail is missing").
 *
 * EVERY DEFAULT IS TODAY'S BEHAVIOUR. Nothing changes until an admin moves a switch.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-mail-rules.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
const V = path.join(__dirname, "mail-rules.view.js");
let s = fs.readFileSync(F, "utf8");
const view = fs.readFileSync(V, "utf8");
if (view.indexOf("</scr" + "ipt>") >= 0) throw new Error("the view file must not contain a closing script tag");

let n = 0;
/* Every gate carries a __rules<id> marker, and that marker - not the text being replaced -
   is what says "already done". Two of these gates KEEP the line they patch (they only add a
   line above it), so looking for the old text found it again on a second run and wired the
   gate twice. Marker first, always - and each marker ends at its colon, because "__rulesR1"
   is a prefix of "__rulesR17" and matched it. */
function one(mark, find, rep, why) {
  if (mark && s.indexOf(mark) >= 0) { console.log("already done: " + why); return; }
  const i = s.indexOf(find);
  if (i < 0) throw new Error("could not find the place for: " + why);
  if (s.indexOf(find, i + find.length) >= 0) throw new Error("found more than once: " + why);
  s = s.slice(0, i) + rep + s.slice(i + find.length);
  n++;
  console.log("  " + why);
}

/* ---- 1. applyBoot: keep the shared settings, and each person's Show filter ---- */
one(
  "__rulesboot ",
  " ['cats','rules','blocked'].forEach(k=>{S[k]=Array.isArray(b.settings?.[k])?b.settings[k]:[];metaSaved['__'+k]=JSON.stringify(S[k])})}",
  " ['cats','rules','blocked'].forEach(k=>{S[k]=Array.isArray(b.settings?.[k])?b.settings[k]:[];metaSaved['__'+k]=JSON.stringify(S[k])});\n" +
  " /* __rulesboot 26 Nov 2026: the shared settings were never kept, so mgrFirstBoxes() (and\n" +
  "    anything else reading S.settings) always fell back to its empty built-in list. */\n" +
  " S.settings=b.settings&&typeof b.settings==='object'?b.settings:{};\n" +
  " /* every person's own View menu \"Show\" filter, so Admin -> Mail rules can name whoever\n" +
  "    has one set - it is the commonest cause of \"my mail is missing\". */\n" +
  " S.lvOf={};b.users.forEach(u=>{const f=u&&u.prefs&&u.prefs.lv&&u.prefs.lv.vf;if(f&&f!=='all')S.lvOf[u.id]=f})}",
  "applyBoot keeps b.settings in S.settings, and collects each person's Show filter"
);

/* ---- 2. can(): C5 gives transfer and assign to everybody ---- */
one(
  "__rulesC5:",
  "const can=(k,pid=ME)=>{const p=who(pid);return !!p&&(p.role==='Admin'||!!p.perm?.[k])};",
  "const can=(k,pid=ME)=>{const p=who(pid);return !!p&&(p.role==='Admin'||!!p.perm?.[k]||(typeof RCAN==='function'&&RCAN(k)))};   /* __rulesC5: rule C5 on Admin -> Mail rules */",
  "can() asks rule C5 (everybody may transfer and assign)"
);

/* ---- 3. LV(): rule R17, one row per mail or one row per conversation ---- */
one(
  "__rulesR17:",
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:true});",
  "const LV=()=>Object.assign({},LV_DEF,(S.prefs&&S.prefs.lv)||{},{conv:!(typeof RON==='function'&&RON('R17'))});   /* __rulesR17: rule R17 on Admin -> Mail rules. OFF = one row per conversation (the shipped behaviour) */",
  "LV() asks rule R17 (one row per mail)"
);

/* ---- 4. seeMine: rule R1 (unassigned seen by the whole team) ---- */
one(
  "__rulesR1:",
  " if(!t.owner)return !mgrFirst(t.dept);        /* nobody has taken it: the whole team can pick it up */",
  " /* __rulesR1: rule R1 on Admin -> Mail rules. ON (shipped) = the whole team sees it.\n" +
  "    OFF = only the manager / lead / CRM / admin, and a member finds it under Needs owner. */\n" +
  " if(!t.owner)return !mgrFirst(t.dept)&&((typeof RON!=='function'||RON('R1'))||!hideUnowned(t));",
  "seeMine asks rule R1 (mail nobody has taken is seen by the whole team)"
);

/* ---- 5. seeMine: rule R3 (a taken conversation is private) ---- */
one(
  "__rulesR3:",
  " return (typeof isMyWork==='function')?isMyWork(t):(t.msgs||[]).some(m=>msgMine(m,t))}\n" +
  "/* 20 Nov 2026: a mailbox somebody sees ONLY the critical mail of.",
  " /* __rulesR3: rule R3 on Admin -> Mail rules. OFF = everybody in the team sees every\n" +
  "    conversation, whoever owns it (what was reported and reversed on 26 November). */\n" +
  " if(typeof RON==='function'&&!RON('R3'))return true;\n" +
  " return (typeof isMyWork==='function')?isMyWork(t):(t.msgs||[]).some(m=>msgMine(m,t))}\n" +
  "/* 20 Nov 2026: a mailbox somebody sees ONLY the critical mail of.",
  "seeMine asks rule R3 (a conversation somebody has taken is private)"
);

/* ---- 6. the OTP wrapper: rule R10 ---- */
one(
  "__rulesR10:",
  "const _smOtp=seeMine;seeMine=function(t){return (t&&isOtp(t))?true:_smOtp(t)};     /* the whole team sees a code */",
  "const _smOtp=seeMine;seeMine=function(t){return (t&&isOtp(t)&&(typeof RON!=='function'||RON('R10')))?true:_smOtp(t)};     /* __rulesR10: the whole team sees a code - rule R10 on Admin -> Mail rules */",
  "the login-code wrapper asks rule R10"
);

/* ---- 7. sendReply: rule R27 (replying takes ownership) ---- */
one(
  "__rulesR27:",
  " if(t.status==='new'&&!t.owner)t.status='open';   /* answered - a status, not an owner */",
  " if(t.status==='new'&&!t.owner)t.status='open';   /* answered - a status, not an owner */\n" +
  " /* __rulesR27: rule R27 on Admin -> Mail rules, OFF as shipped. ON, answering mail nobody\n" +
  "    has taken makes it yours - and it ALWAYS writes a history line, which is what was missing\n" +
  "    when a stale browser copy silently moved Gulab's conversation to Jagjit on 20 November. */\n" +
  " try{if(typeof RON==='function'&&RON('R27')&&!t.owner){t.owner=ME;hist(t,'a','Taken by '+who(ME).name+' - answered it (rule R27)')}}catch(e){}",
  "sendReply asks rule R27 (replying takes ownership)"
);

/* ---- 8. the block itself ---- */
const BLOCK = "<script>" + view.replace(/\s*$/, "") + "\n</scr" + "ipt>\n";
const a = s.indexOf("<script>/* mail-rules.view.js");
if (a >= 0) {
  const b = s.indexOf("/* __rules:end */", a);
  if (b < 0) throw new Error("the old __rules block has no end marker");
  const e = s.indexOf("</scr" + "ipt>", b);
  s = s.slice(0, a) + BLOCK.trim() + s.slice(e + ("</scr" + "ipt>").length);
  console.log("  replaced the existing Mail rules block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  Mail rules block appended");
}

fs.writeFileSync(F, s);
console.log(n + " gate(s) wired + the page. written to " + F);
