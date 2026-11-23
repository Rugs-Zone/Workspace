/* 23 Nov 2026 — Rugs Email, Admin panel → Users & passwords.
 *
 * Reported: "I'm creating Jatin Munjal's ID on admin but it is not showing" —
 * and the screenshot proves it: searching "jatin" shows 2 of 82 (Jatin and
 * Jatin Sharma) while the SERVER's own list, checked live, has 82 users
 * including Jatin Munjal, and no longer has the deleted Creation Team. So the
 * page was showing a user list saved on that computer from earlier in the day.
 *
 * Why that happens: the app keeps the user list in the browser (S.org) and only
 * replaces it with the server's copy when applyBoot() runs — at sign-in. A tab
 * left open all day never refreshes it, so a person added since (by another
 * admin, or in the database) is invisible, and pressing "+ Create user" for
 * them fails on the server because the user ID already exists.
 *
 * What this patch does:
 *   1. opening Users & passwords fetches the newest list from the server, once
 *      per visit (skipped if a field is being typed in, so nothing is wiped);
 *   2. a "↻ Refresh" button next to the search box to do it on demand;
 *   3. a plain-English message when a user ID is already taken, instead of the
 *      raw database error about a unique constraint.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-admin-user-refresh.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('expected 1 match for ' + what + ', found ' + c);
  s = s.replace(find, repl);
  n++;
}

/* 1. a plain message when the user ID is taken ---------------------------- */
one(
  " if(/set your own password/i.test(m))return 'Please set your own password first.';",
  " if(/set your own password/i.test(m))return 'Please set your own password first.';\n" +
  " if(/duplicate key|rm_users_login_key|already exists/i.test(m))return 'That user ID is already used by somebody else. Press \\u21bb Refresh to see the newest list \\u2014 they may already be there.';",
  'duplicate login message'
);

/* 2. a Refresh button in the search bar ----------------------------------- */
one(
  '<span class="sub" id="usrhint"></span></div>',
  '<button type="button" class="btn" id="usrref" title="Fetch the newest list of people from the server">↻ Refresh</button>' +
  '<span class="sub" id="usrhint"></span></div>',
  'refresh button'
);

/* 3. fetch the newest list when the tab is opened ------------------------- */
one(
  'const _rndUsr=render;',
  'let USRTAB=false;/* 23 Nov 2026: true while the Users tab is the one on screen */\n' +
  'function admUsrReload(force){\n' +
  '  /* never pull the list out from under somebody who is typing in it */\n' +
  '  const a=document.activeElement;\n' +
  "  if(!force&&a&&a.closest&&a.closest('.atable'))return;\n" +
  "  api('boot').then(function(b){applyBoot(b);render()}).catch(function(e){try{toast(e.message)}catch(x){}});\n" +
  '}\n' +
  'const _rndUsr=render;',
  'reload helper'
);

one(
  "  box.oninput=function(){USRQ=box.value;admUsrFilter()};\n  admUsrFilter();",
  "  box.oninput=function(){USRQ=box.value;admUsrFilter()};\n" +
  "  const rb=document.getElementById('usrref');\n" +
  "  if(rb)rb.onclick=function(){admUsrReload(true)};\n" +
  "  admUsrFilter();\n" +
  "  if(!USRTAB){USRTAB=true;admUsrReload(false)}/* opened the tab: get the newest list once */",
  'reload on opening the tab'
);

one(
  "  const box=document.getElementById('usrq');\n  if(!box)return;",
  "  const box=document.getElementById('usrq');\n  if(!box){USRTAB=false;return}",
  'forget the tab when leaving it'
);

fs.writeFileSync(F, s);
console.log('patched ' + F + ' — ' + n + ' edits');
