/* 24 Nov 2026 - Rugs Email: when mail is being hidden, the list now SAYS SO.
 *
 * "Team Alpha mail from 3 Nov to 15 Nov is not in the Inbox" could have been any of three
 * things, and none of them said a word on screen:
 *
 *   1. it had not been fetched yet (the real cause - server/patch-loader-gap.js);
 *   2. the admin's "Hide mail from before Go live" tick, which removes everything older than
 *      16 Nov 10:55 from every list and count, silently, for everybody;
 *   3. a filter chip left on - and since 23 Nov the app REMEMBERS your last filter across a
 *      reload, so "Open" stays on for ever and hides every finished conversation. 184 of the
 *      190 Team Alpha conversations from 3-15 Nov are Done (the 17 Nov sweep), so that filter
 *      alone empties that fortnight.
 *
 * So a plain line now sits under the list header whenever something is being left out:
 *
 *   "Mail from before Go live (16 Nov) is hidden - 214 conversations here. Admin -> Old mail"
 *   "The Open filter is hiding 184 finished conversations.  [Show all]"
 *
 * Counting is done with the app's own listRows (filter off, then on), so the number is exactly
 * what is being withheld - no second opinion about the rules.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-why-missing.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');

const BLOCK = [
"",
"/* ---------- 24 Nov 2026: say what is being hidden, instead of just hiding it ---------- */",
"function hiddenNote(){",
" if(app!=='mail')return '';",
" const bits=[];",
" /* (a) the admin's \"hide everything from before Go live\" tick */",
" if(OLDMAIL.hide_before_live&&OLDMAIL.live_at){",
"  const n=S.threads.filter(t=>beforeLive(t)&&(view.type!=='box'||t.dept===view.dept)).length;",
"  const day=new Date(OLDMAIL.live_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'});",
"  if(n)bits.push('Mail from before Go live ('+day+') is hidden for everyone \\u2014 '+n+' conversation'+(n===1?'':'s')+' here. '+(who(ME).role==='Admin'?'Admin \\u2192 Overview \\u2192 Old mail to show them again.':'Ask the admin to untick it in Admin \\u2192 Old mail.'));",
" }",
" /* (b) a filter chip that is leaving rows out */",
" if(filt!=='all'){",
"  const was=filt;let all=0;",
"  try{filt='all';all=listRows().length}finally{filt=was}",
"  const now=listRows().length;",
"  const name={unread:'Unread',open:'Open',mine:'Assigned to me',alias:'Alias'}[filt]||filt;",
"  if(all>now)bits.push('The '+name+' filter is hiding '+(all-now)+' conversation'+(all-now===1?'':'s')+' in this folder.<button class=\"btn\" data-showall style=\"margin-left:8px\">Show all</button>');",
" }",
" return bits.length?'<div class=\"shelp\"><span>\\u2139\\ufe0f '+bits.join('</span></div><div class=\"shelp\"><span>')+'</span></div>':'';",
"}",
"const _rlHid=renderList;renderList=function(){_rlHid();",
" const h=document.querySelector('.list .lhead');if(!h)return;",
" const n=hiddenNote();if(n)h.insertAdjacentHTML('beforeend',n)};",
"document.addEventListener('click',e=>{if(e.target.closest('[data-showall]')){filt='all';render()}});",
""].join('\n');

const anchor = "function gSearch(){";
if (s.split(anchor).length - 1 !== 1) throw new Error('anchor gSearch not found exactly once');
if (s.indexOf('function hiddenNote(') >= 0) throw new Error('already applied');
fs.writeFileSync(F, s.replace(anchor, BLOCK + anchor));
console.log('patch-why-missing: 1 edit applied');
