/* patch-fast-draw.js - 28 Nov 2026
 *
 * "it is lagging so much"
 *
 * MEASURED FIRST, on the real published app with a real mailbox (server/measure-lag.mjs, as
 * Ashish: 1,072 conversations, 5,855 mails, 457 rows on screen). One redraw:
 *
 *     render()            73 - 160 ms   (and 227 - 400 ms when the machine is busy)
 *       renderFolders()   24 -  48 ms   <- the folder pane, rebuilt from scratch
 *       renderList()      25 -  43 ms   <- all 457 rows built again as one string
 *       everything else    1 -   2 ms
 *     listRows()           0.2 ms       (already cached since 27 Nov)
 *
 * So the app was deciding WHAT to show quickly and then REBUILDING the whole screen anyway -
 * on every poll, every mark-read, every count repaint, every click, twenty-four hours a day.
 * On the office PCs, which are two to four times slower, that is the lag people feel.
 *
 * WHAT THIS DOES: before the list or the folder pane is built again, it asks one cheap
 * question - "has anything I would draw actually changed?" - and if the answer is no, it
 * leaves the screen alone. The question is answered with the app's OWN fingerprint of the
 * mail (mailFp, the same one the row cache, the folder counts and the personal rules use)
 * plus everything else those two draws read: the view, the folder, the chips, the topic
 * filter, the search box, which mail is open, how many rows the window holds, the drafts, the
 * sync state, the personal folders, the saved searches, who is signed in, R36's group and
 * R30a's one-row exception. Anything it cannot answer, or any error at all, and it draws in
 * full exactly as before.
 *
 * Nothing about WHAT is shown changes - no rule, no ownership, no folder, no count, no server
 * call. rzDrawStats() in the console reports how many draws were saved.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-fast-draw.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__fastdraw")) { console.log("already applied - nothing to do"); process.exit(0); }

const BUILD_OLD = "APP_BUILD='2026-11-28-8'";
if (s.split(BUILD_OLD).length - 1 !== 1) throw new Error("APP_BUILD 2026-11-28-8 not found exactly once");
s = s.replace(BUILD_OLD, "APP_BUILD='2026-11-28-9'");
console.log("  APP_BUILD -> 2026-11-28-9");

const BLOCK = [
'<script>/* __fastdraw:start  28 Nov 2026 - do not rebuild a screen that has not changed.',
'   What was measured first, and why: server/patch-fast-draw.js · server/measure-lag.mjs */',
'(function(){',
' var ST={listSkipped:0,listDrawn:0,foldersSkipped:0,foldersDrawn:0};',
' try{window.rzDrawStats=function(){return JSON.parse(JSON.stringify(ST))}}catch(e){}',
' function g(f,d){try{var v=f();return v===undefined?d:v}catch(e){return d}}',
' function fp(){return g(function(){return typeof mailFp===\'function\'?mailFp():Math.random()},Math.random())}',
' /* ---------- the message list ---------- */',
' var lk=null,lastBox=null;',
' function listKey36(){',
'  return JSON.stringify([',
'   g(function(){return app},\'\'),',
'   g(function(){return view},null),',
'   g(function(){return tab},\'\'),',
'   g(function(){return filt},\'\'),',
'   g(function(){return lfilt},\'\'),',
'   g(function(){return (($(\'#q\')||{}).value)||\'\'},\'\'),',
'   g(function(){return openId||\'\'},\'\'),',
'   g(function(){return _cap},0),',
'   fp(),',
'   g(function(){return (S.drafts||[]).length},0),',
'   g(function(){return !!syncing},false),',
'   g(function(){return S.lastSync||0},0),',
'   g(function(){return (FS36===null?\'?\':FS36.length)+\'/\'+FS36err+\'/\'+FS36at},\'\'),',
'   g(function(){return JSON.stringify(LV())},\'\'),',
'   g(function(){return typeof R30A_SHOW!==\'undefined\'?R30A_SHOW:\'\'},\'\'),',
'   g(function(){return ME},\'\')',
'  ])}',
' var _rl=renderList;',
' renderList=function(){',
'  var box=null,k=null;',
'  try{box=document.querySelector(\'.list .msgs\');k=listKey36()}catch(e){box=null;k=null}',
'  if(box&&k!==null&&k===lk&&box===lastBox&&box.children.length){',
'   ST.listSkipped++;',
'   try{if(typeof fs36Draw===\'function\')fs36Draw()}catch(e){}',
'   return}',
'  var r=_rl.apply(this,arguments);',
'  try{lk=k;lastBox=document.querySelector(\'.list .msgs\')}catch(e){lk=null;lastBox=null}',
'  ST.listDrawn++;',
'  return r};',
' try{window.renderList=renderList}catch(e){}',
' /* ---------- the folder pane ---------- */',
' var fk=null,lastPane=null;',
' function foldKey(){',
'  return JSON.stringify([',
'   g(function(){return app},\'\'),',
'   g(function(){return view},null),',
'   fp(),',
'   g(function(){return (S.drafts||[]).length},0),',
'   g(function(){return JSON.stringify(S.folders||[])},\'\'),',
'   g(function(){return JSON.stringify(S.saved||[])},\'\'),',
'   g(function(){return JSON.stringify(S.ui||{})},\'\'),',
'   g(function(){return DEPTS.length},0),',
'   g(function(){return ME},\'\')',
'  ])}',
' var _rf=renderFolders;',
' renderFolders=function(){',
'  var pane=null,k=null;',
'  try{pane=document.querySelector(\'#folders\')||document.querySelector(\'.folders\');k=foldKey()}catch(e){pane=null;k=null}',
'  if(pane&&k!==null&&k===fk&&pane===lastPane&&pane.children.length){',
'   ST.foldersSkipped++;',
'   try{if(typeof fcPaint===\'function\')fcPaint()}catch(e){}',
'   return}',
'  var r=_rf.apply(this,arguments);',
'  try{fk=k;lastPane=document.querySelector(\'#folders\')||document.querySelector(\'.folders\')}catch(e){fk=null;lastPane=null}',
'  ST.foldersDrawn++;',
'  return r};',
' try{window.renderFolders=renderFolders}catch(e){}',
'})();',
'/* __fastdraw:end */<' + '/script>',
''
].join('\n');

s = s.replace(/\s*$/, '\n') + BLOCK;
fs.writeFileSync(F, s);
console.log("ok  the list and the folder pane are only rebuilt when something changed");
