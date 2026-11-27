/* patch-r30a.js - 27 Nov 2026 (bug 16, redone from scratch)
 *
 * RULE R30a, as asked for in this terminal:
 *
 *   "a conversation whose mails are ALL older than the team's go-live is visible to every
 *    member of Team Alpha and Team Pulse whatever its owner - but ONLY in search and
 *    'Show in Inbox', NOT in the Inbox list (so the Inbox does not grow). Never work,
 *    no Done button, owner never changes. Per-team switch on Admin -> Mail rules."
 *
 * The half-written R30a another terminal left in server/mail-rules.view.js (marker
 * __r30arule, a registry row whose helper r30aTeam() and chooser button did not exist in
 * the app) was REMOVED first; nothing of it is reused here.
 *
 * WHY IT IS A HOLE IN R3 ON PURPOSE
 *   R3 (26 Nov) makes a conversation somebody has TAKEN private to the people who worked
 *   it, plus the manager / lead / CRM / admin. That is right for live mail and wrong for
 *   history nobody is working any more: a member looking for last season's PO could not
 *   find it because a colleague owned it. R30a opens that history - and stops dead at the
 *   team's own go-live date (rm_depts.track_from, the same date rule R30 uses), so it can
 *   never open up live mail.
 *
 * HOW "ONLY IN SEARCH AND SHOW IN INBOX" IS GUARANTEED
 *   The exception is not a property of the mail, it is a property of the QUESTION. It is
 *   asked through two flags and nothing else:
 *     R30A_Q    - up only while the search branch of listRows is running (i.e. only while
 *                 the search box has text). Set and cleared in a finally, synchronously,
 *                 so it cannot leak into a count pass or a folder pass.
 *     R30A_SHOW - one conversation id, set only by sibShow (the "Show in Inbox" jump of
 *                 rule R17b) so the row the person asked for is really drawn, flashed and
 *                 selected. It is cleared the moment they change mailbox or folder.
 *   With both flags down, seeMine answers exactly what it answered before this patch, so a
 *   member's Inbox, Sent, Needs owner, My work, every folder count and every Home number
 *   are unchanged. The Inbox does not grow.
 *
 * NEVER WORK / NO DONE BUTTON / OWNER NEVER CHANGES
 *   never work  - isWork() already answers false for a conversation whose newest mail is
 *                 older than track_from (rule R30). isWork is a `const` arrow and must not
 *                 be wrapped (the 25 Nov "Assignment to constant variable" lesson), so this
 *                 is proved by test rather than re-stated in code.
 *   no Done     - the row's Done tick and the pane's Done / Reopen are taken off a
 *                 conversation a person can see only because of R30a.
 *   owner       - R30a writes nothing, ever. Take over / Assign / Transfer are taken off
 *                 such a conversation too, because those are the only things that could
 *                 change its owner from a screen R30a opened.
 *
 * CACHES
 *   The row-HTML cache and the drawn-row cache are both INSIDE these wrappers, so the Done
 *   button is stripped after every cache hit, and R30A_SHOW goes into listKey() so a
 *   cached list cannot hide the row somebody just asked for.
 *
 * M1 (tab under 250 MB) - nothing is stored: r30aOld() compares one number with one number
 *   per conversation and this block keeps no map, list or cache of its own.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-r30a.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

const START = "<script>/* __r30a:start 27 Nov 2026 - server/patch-r30a.js (rule R30a) */";
const END = "/* __r30a:end */";
const CLOSE = "</scr" + "ipt>";

const BODY = [
  "/* ==================== RULE R30a - old mail is open to the team ==================== */",
  "/* ON by default for Team Alpha and Team Pulse. An admin changes it per team on",
  "   Admin -> Mail rules; the chosen teams live in the shared setting mail_rules.r30a. */",
  "const R30A_DEF=['teamalpha','teampulse'];",
  "const r30aLocal=x=>String(x||'').toLowerCase().split('@')[0];",
  "function r30aList(){",
  " try{const o=(S.settings&&S.settings.mail_rules)||{};const v=o.r30a;",
  "  if(Array.isArray(v))return v.map(r30aLocal);",
  "  return R30A_DEF.slice()}catch(e){return R30A_DEF.slice()}",
  "}",
  "/* is R30a on for this team? compare LOCAL PARTS - a department carries box WITHOUT the",
  "   domain, so comparing full addresses silently matched nothing (the 26 Nov lesson). */",
  "function r30aTeam(deptId){",
  " try{const d=(typeof dept==='function')?dept(deptId):null;if(!d)return false;",
  "  return r30aList().indexOf(r30aLocal(d.box))>=0}catch(e){return false}",
  "}",
  "/* R17 is on, so a row is ONE MAIL: explode() builds it with Object.create(conversation)",
  "   and overwrites .last with that mail's own time. Asking a row therefore answers \"is",
  "   THIS MAIL old\", and a conversation with one old mail and one new one would have shown",
  "   its old row to the whole team - the exact opposite of \"ALL of its mails are older\".",
  "   So always climb back to the conversation first. (Found by server/test-r30a.mjs.) */",
  "function r30aConv(t){",
  " try{if(t&&t._one){const p=Object.getPrototypeOf(t);if(p&&p.id===t.id)return p}}catch(e){}",
  " return t;",
  "}",
  "/* every mail in it is older than that team's go-live */",
  "function r30aOld(t){",
  " try{const c=r30aConv(t);",
  "  if(!c||!r30aTeam(c.dept))return false;",
  "  const tf=(S.trackFrom||{})[c.dept];if(!tf)return false;",
  "  /* the conversation's own last IS its newest mail's time (convDedupe keeps it true), so",
  "     this one comparison answers it and costs nothing on the 99% that are newer */",
  "  const last=+(c.last||0);if(!(last>0&&last<tf))return false;",
  "  /* belt: every mail this browser actually holds is older too, so a stale date can",
  "     never open up live mail */",
  "  const ms=c.msgs||[];",
  "  for(let i=0;i<ms.length;i++){if(+(ms[i].at||0)>=tf)return false}",
  "  return true}catch(e){return false}",
  "}",
  "let R30A_Q=false;          /* up only while the search branch of listRows is running */",
  "let R30A_SHOW='';          /* the one conversation somebody pressed \"Show in Inbox\" on */",
  "let R30A_SHOW_K='';        /* the mailbox+folder that jump landed in */",
  "function r30aAsking(t){return !!(R30A_Q||(R30A_SHOW&&t&&t.id===R30A_SHOW))}",
  "function r30aLets(t){return r30aAsking(t)&&r30aOld(t)}",
  "",
  "/* ---- the gate: outermost, so it is never served from the per-pass memo ---- */",
  "const _smR30a=seeMine;",
  "seeMine=function(t){if(r30aLets(t))return true;return _smR30a.apply(this,arguments)};",
  "/* \"can I see this ONLY because of R30a?\" - what decides the tag and the missing",
  "   buttons. Asked with both flags down, so it is the plain R3 answer. */",
  "function r30aOnly(t){",
  " try{if(!t||!r30aOld(t))return false;",
  "  const q=R30A_Q,sh=R30A_SHOW;R30A_Q=false;R30A_SHOW='';",
  "  let base;try{base=_smR30a(t)}finally{R30A_Q=q;R30A_SHOW=sh}",
  "  return !base}catch(e){return false}",
  "}",
  "",
  "/* ---- 1 - search: the flag is up only while the search branch really runs ---- */",
  "const _lrR30a=listRows;",
  "listRows=function(){",
  " /* the \"Show in Inbox\" row belongs to the mailbox and folder it was asked for */",
  " try{const k=(view.dept||'')+'|'+(view.folder||'');",
  "  if(R30A_SHOW&&R30A_SHOW_K&&k!==R30A_SHOW_K){R30A_SHOW='';R30A_SHOW_K=''}}catch(e){}",
  " let q='';try{const el=document.getElementById('q');q=el?el.value.trim():''}catch(e){}",
  " if(!q)return _lrR30a.apply(this,arguments);",
  " R30A_Q=true;",
  " try{return _lrR30a.apply(this,arguments)}finally{R30A_Q=false}",
  "};",
  "/* the drawn-row cache must not be able to hide the row somebody just asked for */",
  "const _lkR30a=listKey;",
  "listKey=function(){return _lkR30a.apply(this,arguments)+'|r30a:'+R30A_SHOW};",
  "",
  "/* ---- 2 - \"Show in Inbox\" (rule R17b): let the jump through, remember which one ---- */",
  "if(typeof sibShow==='function'){",
  " const _sibR30a=sibShow;",
  " sibShow=function(t,mi){",
  "  const old=R30A_SHOW,oldK=R30A_SHOW_K;",
  "  if(t&&r30aOld(t)){R30A_SHOW=t.id;R30A_SHOW_K=''}",
  "  let r;",
  "  try{r=_sibR30a.apply(this,arguments)}",
  "  catch(e){R30A_SHOW=old;R30A_SHOW_K=oldK;throw e}",
  "  /* sibShow has moved the view by now, so this is where the jump landed */",
  "  try{if(t&&R30A_SHOW===t.id)R30A_SHOW_K=(view.dept||'')+'|'+(view.folder||'')}catch(e){}",
  "  return r};",
  "}",
  "",
  "/* ---- 3 - no Done tick on a row R30a opened, and a tag saying why it is there ---- */",
  "/* take one button out of a string of HTML, from its own <button to its own </button> */",
  "function r30aStrip(h,attr){",
  " try{let out=String(h);",
  "  for(let g=0;g<8;g++){",
  "   let p=0,found=-1;",
  "   while((p=out.indexOf('<button',p))>=0){const e=out.indexOf('>',p);if(e<0)break;",
  "    if(out.slice(p,e).indexOf(attr)>=0){found=p;break}p=e+1}",
  "   if(found<0)break;",
  "   const close=out.indexOf('</button>',found);if(close<0)break;",
  "   out=out.slice(0,found)+out.slice(close+9)}",
  "  return out}catch(e){return h}",
  "}",
  "const R30A_TIP='Every mail in this conversation is older than this team\\u2019s go-live, so the whole team may read it (rule R30a). It is nobody\\u2019s work and its owner does not change.';",
  "const _rhR30a=rowHTML;",
  "rowHTML=function(t){",
  " let h=_rhR30a.apply(this,arguments);",
  " try{",
  "  if(!r30aOnly(t))return h;",
  "  h=r30aStrip(h,'data-qdone');",
  "  h=h.replace('<div class=\"tags\">','<div class=\"tags\"><span class=\"tag r30atag\" title=\"'+R30A_TIP+'\">\\u{1F4DC} Old mail \\u00b7 open to the team</span>');",
  " }catch(e){}",
  " return h};",
  "",
  "/* ---- 4 - the reading pane: no Done / Reopen, and nothing that changes the owner ---- */",
  "function r30aPaint(){",
  " try{",
  "  const R=document.getElementById('read');if(!R)return;",
  "  const t=(typeof openId!=='undefined'&&openId)?(S.threads||[]).find(x=>x.id===openId):null;",
  "  if(!t||!r30aOnly(t)){const n=R.querySelector('.r30anote');if(n)n.remove();return}",
  "  R.querySelectorAll('[data-done],[data-reopen],[data-qdone],[data-take],[data-xfer],[data-assign]').forEach(b=>b.remove());",
  "  if(!R.querySelector('.r30anote')){",
  "   const d=document.createElement('div');",
  "   d.className='r30anote';d.setAttribute('role','note');",
  "   d.style.cssText='margin:0 0 8px;padding:7px 10px;border-radius:8px;font-size:12.5px;line-height:1.5;background:color-mix(in srgb,var(--brand) 9%,transparent);color:var(--fg)';",
  "   d.textContent='\\u{1F4DC} Every mail here is older than this team\\u2019s go-live, so the whole team may read it (rule R30a). It is nobody\\u2019s work \\u2014 there is no Done button, and its owner does not change.';",
  "   R.insertBefore(d,R.firstChild)}",
  " }catch(e){}",
  "}",
  "const _rdR30a=render;",
  "render=function(){const r=_rdR30a.apply(this,arguments);try{r30aPaint()}catch(e){}return r};",
  "if(typeof renderRead==='function'){const _rrR30a=renderRead;",
  " renderRead=function(){const r=_rrR30a.apply(this,arguments);try{r30aPaint()}catch(e){}return r}}"
].join("\n");

const BLOCK = START + "\n" + BODY + "\n" + END + "\n" + CLOSE + "\n";

const a = s.indexOf(START);
if (a >= 0) {
  const b = s.indexOf(END, a);
  if (b < 0) throw new Error("the old __r30a block has no end marker");
  const e = s.indexOf(CLOSE, b);
  if (e < 0) throw new Error("the old __r30a block has no closing script tag");
  s = s.slice(0, a) + BLOCK.replace(/\n$/, "") + s.slice(e + CLOSE.length);
  console.log("  replaced the existing R30a block");
} else {
  /* append at the END OF THE FILE, never at the last </body> - that one is inside a
     JavaScript string (originalHTML) and a block landing there breaks the whole app
     (found on 27 Nov by check-scripts.js). */
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  R30a block appended");
}
fs.writeFileSync(F, s);
console.log("written to " + F);
