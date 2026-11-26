/* 26 Nov 2026 - "I click the 5:34 mail and it opens the mail above it as well".

   THE CAUSE: two overrides of open() fight, and the wrong one wins.

     line 3921 (25 Nov, heavy-thread rule step 3):
       open = id => { if (id !== openId) openMsgs[t.id] = new Set(all indexes .slice(-3)) ... }
     line 5933 (__rowmail, the per-mail click):
       open = id => { if (a row with data-mi was clicked) openMsgs[id] = new Set([that mail]);
                      return _openRow(id)   <-- this calls the line-3921 one }

   __rowmail sets "open only the mail that was clicked" and THEN calls the older wrapper,
   which overwrites openMsgs with the newest THREE. So clicking Aman's 17:34 row opened
   mails 3, 4 and 5 - his mail, Ashok's reply, and Manfred Mui's 20:21 above it.

   THE FIX: while a per-mail row click is being handled, the newest-three rule stands aside.
   A click that does not name a mail (from Search, Home, a notification) still opens the
   newest three exactly as before.

   Run:  node server/patch-open-one-mail.js     (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
if (s.includes("__openonemail")) { console.log("already there - nothing changed"); process.exit(0); }
let n = 0;
const sub = (what, from, to) => {
  if (s.split(from).length !== 2) { console.error("STOP - " + what + ": not found exactly once"); process.exit(1); }
  s = s.replace(from, to); n++;
};

/* 1. the newest-three rule stands aside for a per-mail click */
sub("the newest-three open override",
  "const _openOne=open;open=function(id){if(id!==openId){const t=T_(id);if(t&&t.msgs&&t.msgs.length)openMsgs[t.id]=new Set(t.msgs.map((_,i)=>i).slice(-3))}return _openOne(id)};",
  "/* __openonemail 26 Nov 2026: `&&!window.__openOneMail` - when a per-mail row names the mail\n" +
  "   it wants (see __rowmail), opening the newest three on top of it is what put the mail\n" +
  "   above the clicked one on screen. A click that names no mail is unchanged. */\n" +
  "const _openOne=open;open=function(id){if(id!==openId&&!window.__openOneMail){const t=T_(id);if(t&&t.msgs&&t.msgs.length)openMsgs[t.id]=new Set(t.msgs.map((_,i)=>i).slice(-3))}return _openOne(id)};");

/* 2. __rowmail raises the flag around the call it makes */
sub("the per-mail open wrapper",
  " const r=_openRow.apply(this,arguments);\n" +
  " if(t&&want!=null&&t.msgs&&t.msgs[want]){",
  " const oneMail=!!(t&&want!=null&&t.msgs&&t.msgs[want]);\n" +
  " if(oneMail)window.__openOneMail=true;                 /* __openonemail: just this mail */\n" +
  " let r;try{r=_openRow.apply(this,arguments)}finally{window.__openOneMail=false}\n" +
  " if(oneMail&&t&&t.msgs&&t.msgs[want]){openMsgs[id]=new Set([want])}   /* last word, whatever ran underneath */\n" +
  " if(t&&want!=null&&t.msgs&&t.msgs[want]){");

fs.writeFileSync(f, s);
console.log("patch-open-one-mail: " + n + " edit(s) applied");
