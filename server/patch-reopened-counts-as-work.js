/* 24 Nov 2026 - a conversation the system puts back counts as work again.
 *
 * Found while testing the 16 November repair: putting those 178 conversations back to
 * "waiting" is not enough on its own. isWork(t) decides what shows in Needs owner, To assign,
 * Late, Due today and the Home numbers, and it only counts a conversation whose newest mail
 * arrived AFTER the team's work-tracking start:
 *
 *     const isWork = t => { ... const w = Math.max(WF(), tf); return (t.last||0) >= w };
 *
 * Those buyer mails are from 12 and 13 November and Go live was 16 November at 10:55, so they
 * would have come back into the Inbox as open, but into nobody's work list - exactly the kind
 * of "visible if you happen to look" that let them be missed in the first place.
 *
 * So a conversation carrying the system's own "Reopened by system" history line counts as work
 * whatever its date. It is deliberately narrow: only the server's one-time repair writes that
 * line (see ONETIME in server/local-server/server.mjs), a person marking something done or
 * undone does not, and the answer is worked out once per conversation and remembered.
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-reopened-counts-as-work.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');

const FIND = "const isWork=t=>{if(isWsNotif(t))return false;if(!hasRecv(t))return false;const tf=(S.trackFrom||{})[t.dept];if(!tf)return false;const w=Math.max(WF(),tf);return(t.last||0)>=w};";
const REPL =
  "/* 24 Nov 2026: a conversation the system put back after a wrong bulk-done is work again,\n" +
  "   however old it is - otherwise the repair would hand it back into nobody's list. */\n" +
  "const sysReopened=t=>{if(t._sysre===undefined)t._sysre=(t.hist||[]).some(h=>String(h.txt||'').indexOf('Reopened by system')===0);return t._sysre};\n" +
  "const isWork=t=>{if(isWsNotif(t))return false;if(!hasRecv(t))return false;if(sysReopened(t))return true;const tf=(S.trackFrom||{})[t.dept];if(!tf)return false;const w=Math.max(WF(),tf);return(t.last||0)>=w};";

const c = s.split(FIND).length - 1;
if (c !== 1) throw new Error('expected 1 match for isWork, found ' + c);
fs.writeFileSync(F, s.replace(FIND, REPL));
console.log('patch-reopened-counts-as-work: 1 edit applied');
