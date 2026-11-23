/* 23 Nov 2026 — follow-up to patch-dblclick-maximise.js, found by testing it
 * with a REAL mouse in a real browser instead of a synthetic event.
 *
 * The first version listened for the browser's own `dblclick`. That works only
 * while the row survives both clicks — and it does not: the FIRST click opens
 * the mail, which redraws the whole list, so the row element the first click
 * landed on is thrown away and replaced. The second click therefore lands on a
 * different element, and the browser fires `dblclick` on the nearest common
 * ancestor (the message container), where `closest('[data-open]')` finds
 * nothing. Synthetic dispatch on one element passed; a real double-click did
 * not open full screen at all.
 *
 * So the double-click is now counted by the app itself: two clicks on the SAME
 * conversation within 500 ms = open it full screen. That survives the redraw,
 * because it compares the conversation's id, not the element.
 *
 * The `dblclick` listener is kept as well — it still fires when the list is not
 * redrawn (clicking a mail that is already open), and both routes end in the
 * same maxOpen(true).
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-dblclick-maximise2.js
 *   node server/mailapp-b64.js encode
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;

function one(find, repl, what) {
  const c = s.split(find).length - 1;
  if (c !== 1) { console.error('STOP: "' + what + '" matched ' + c + ' times, expected 1'); process.exit(1); }
  s = s.replace(find, repl);
  n++;
  console.log('  ok  ' + what);
}

const ANCHOR = "document.addEventListener('dblclick',function(e){";

const BLOCK =
"/* the row is replaced when the first click opens the mail, so count the clicks by conversation */\n" +
"let _dcId=null,_dcAt=0;\n" +
"function dcRow(e){\n" +
"  const el=e.target;\n" +
"  if(!el||!el.closest)return null;\n" +
"  const row=el.closest('[data-open]');\n" +
"  if(!row)return null;\n" +
"  if(el.closest('button,a,input,select,textarea,label'))return null;   /* the row's own hover buttons */\n" +
"  if(matchMedia('(max-width:760px)').matches)return null;              /* phones open full screen anyway */\n" +
"  try{return idv(row.getAttribute('data-open'))||null}catch(x){return null}\n" +
"}\n" +
"document.addEventListener('click',function(e){\n" +
"  const id=dcRow(e);\n" +
"  if(!id){_dcId=null;return}\n" +
"  const now=Date.now();\n" +
"  if(_dcId===id&&now-_dcAt<500){\n" +
"    _dcId=null;_dcAt=0;\n" +
"    try{const sel=window.getSelection&&window.getSelection();if(sel&&sel.removeAllRanges)sel.removeAllRanges()}catch(x){}\n" +
"    maxOpen(true);\n" +
"    return;\n" +
"  }\n" +
"  _dcId=id;_dcAt=now;\n" +
"},true);\n";

one(ANCHOR, BLOCK + ANCHOR, 'count two clicks on the same conversation (survives the redraw)');

fs.writeFileSync(F, s);
console.log(n + ' edit(s) applied to ' + F);
