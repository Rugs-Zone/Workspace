/* 25 Nov 2026 - FIX a real bug in my own speed work from an hour ago.

   patch-speed-everywhere.js remembers the answers of seeMine / sentSeen / inView /
   isInboxMail for the length of one redraw, keyed ONLY on a pass counter that each
   drawing entry point bumps. That is wrong: those four answers also depend on WHICH
   mailbox and folder are being asked about and on WHO is asking - and plenty of code
   changes `view` or `ME` and calls them again without a redraw in between:

     * inboxUnreadN(dept) is asked for every mailbox in turn
     * the mirror rule swaps ME to judge a mail as somebody else
     * the dashboard and the Home numbers walk several departments
     * the repo's own server/test-inbox-stays.js does exactly this, and that is how
       the bug showed up: 4 of its 20 checks failed (a buyer's mail appearing in Sent,
       a colleague seeing someone else's sent mail, an unanswered sent mail in the
       Inbox, a colleague seeing owned mail) - the second question was answered with
       the first question's answer.

   The key now carries the context as well: the mailbox/folder/view, the person, the
   tab, the filter and the topic filter. Building it is a handful of short string
   joins, far cheaper than the rules themselves, so the speed gain stays.

   Run:  node server/patch-memo-context-fix.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");

const old = `function memoPass(fn){
 let map=new WeakMap(),at=-1;
 return function(t){
  if(!t||typeof t!=='object')return fn.apply(this,arguments);
  if(at!==PASS){map=new WeakMap();at=PASS}`;
const neu = `function memoCtx(){
 /* the same question about the same mail has a different answer in another mailbox,
    another folder or for another person - so all of that belongs in the key */
 try{return PASS+'|'+(view.type||'')+'|'+(view.folder||'')+'|'+(view.dept||'')+'|'+(view.id||'')
  +'|'+(view.key||'')+'|'+ME+'|'+(typeof tab==='undefined'?'':tab)+'|'+(typeof filt==='undefined'?'':filt)
  +'|'+(typeof lfilt==='undefined'?'':lfilt)}catch(e){return 'x'+Math.random()}
}
function memoPass(fn){
 let map=new WeakMap(),at='\\u0000';
 return function(t){
  if(!t||typeof t!=='object')return fn.apply(this,arguments);
  const now=memoCtx();
  if(at!==now){map=new WeakMap();at=now}`;

if (s.includes("function memoCtx()")) { console.log("already fixed - nothing changed"); process.exit(0); }
if (!s.includes(old)) throw new Error("the memo from patch-speed-everywhere.js was not found");
s = s.replace(old, neu);
fs.writeFileSync(file, s);
console.log("fixed: the remembered answers now know which mailbox, folder and person they belong to");
