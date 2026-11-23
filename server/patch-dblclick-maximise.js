/* 23 Nov 2026 — Rugs Email: double-click a mail in the list to open it full
 * screen, the way double-clicking opens a mail in its own window in Outlook.
 *
 * The app already has exactly the right full-screen mode: the reading pane's
 * "⤢ Maximise" button (data-maxread) puts `maxread` on <body>, and the CSS rule
 *     body.maxread .folders, body.maxread .list, body.maxread .split {display:none}
 * hides the folder pane, the mail list and the splitter, so the open mail fills
 * the window. Until now the only way in was that button.
 *
 * What this adds:
 *   • double-click a row  → opens that mail AND maximises it;
 *   • Esc                 → comes back to the list (Outlook closes the window
 *                           with Esc), and the "⤡ Restore" button still works.
 *
 * Care taken:
 *   • a double-click on the row's own hover buttons (Done, Flag, Archive,
 *     Delete, Transfer …) is ignored, so those keep doing their own job;
 *   • the text the double-click selects is cleared, otherwise the mail opens
 *     with a word highlighted in the row behind it;
 *   • phones are left alone — there the reading pane is already full screen and
 *     there is no maximise button;
 *   • Esc does nothing if a dialog or compose window is open, if the cursor is
 *     in a field, or if another handler has already dealt with that Esc (the
 *     immersive reader, the crop window and the attachment viewer all have
 *     their own).
 *
 * Run from the repo root:
 *   node server/mailapp-b64.js decode
 *   node server/patch-dblclick-maximise.js
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

const ANCHOR = "let USRTAB=false;";

const BLOCK =
"/* 23 Nov 2026: Outlook — double-click a mail to open it full screen, Esc to come back */\n" +
"function maxOpen(on){\n" +
"  const b=document.body;\n" +
"  if(on===b.classList.contains('maxread'))return;\n" +
"  b.classList.toggle('maxread',!!on);\n" +
"  try{renderRead();fitFrames()}catch(e){}\n" +
"}\n" +
"document.addEventListener('dblclick',function(e){\n" +
"  const el=e.target;\n" +
"  if(!el||!el.closest)return;\n" +
"  const row=el.closest('[data-open]');\n" +
"  if(!row)return;\n" +
"  if(el.closest('button,a,input,select,textarea,label'))return;   /* the row's own hover buttons */\n" +
"  if(matchMedia('(max-width:760px)').matches)return;               /* phones open full screen anyway */\n" +
"  let id;try{id=idv(row.getAttribute('data-open'))}catch(x){return}\n" +
"  if(!id)return;\n" +
"  e.preventDefault();\n" +
"  try{const sel=window.getSelection&&window.getSelection();if(sel&&sel.removeAllRanges)sel.removeAllRanges()}catch(x){}\n" +
"  try{if(typeof openId==='undefined'||openId!==id)open(id)}catch(x){}\n" +
"  maxOpen(true);\n" +
"});\n" +
"document.addEventListener('keydown',function(e){\n" +
"  if(e.key!=='Escape'||e.defaultPrevented)return;\n" +
"  if(!document.body.classList.contains('maxread'))return;\n" +
"  const t=e.target;\n" +
"  if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable=\"true\"]'))return;\n" +
"  const L=document.getElementById('layer');\n" +
"  if(L&&L.innerHTML.trim())return;                                 /* a dialog or compose window is open */\n" +
"  maxOpen(false);\n" +
"});\n";

one(ANCHOR, BLOCK + ANCHOR, 'double-click a row = open full screen; Esc = back to the list');

fs.writeFileSync(F, s);
console.log(n + ' edit(s) applied to ' + F);
