/* 25 Nov 2026 - "still no mail in the Inbox" (Mala, Team Designing).

   MEASURED, signed in as the login she actually uses - there is no Rugs Email user called
   Mala; she signs in as "Designer Rugs Creation", which is a MANAGER of designer@ (and that
   matches the From name on her 24 Nov 2:18 pm mail, "Designer Rugs Creation - Rugs Creation"):

     conversations loaded for designer@ : 727   (of 3,873 in the mailbox)
     Inbox with the All filter          : 557
     Inbox with the Open filter         :  25     <-- what she was looking at
     Inbox with the Unread filter       :   9
     Other tab                          :  73
     Sent                               : 299

   So her Inbox is NOT empty - it holds 557 conversations. Two things stack up:

     1  designer@ was added on 16 Nov, AFTER Go live, so its whole past arrived as history and
        the 17 Nov guard trigger files pre-Go-live mail as Done + read on arrival:
        3,828 of its 3,873 Inbox conversations are Done. Only 45 are not.
     2  since 23 Nov a reload RESTORES the narrowing she last used - `uiRestore` puts back the
        filter chip, the topic filter and even the leftover search text for up to 12 hours. With
        "Open" stuck on, an inbox of 557 shows 25; with "Unread", 9; with a stale search, almost
        nothing. It looks exactly like "no mail came".

   THE FIX: a reload restores the PLACE, not the narrowing. The page, the mailbox, the folder,
   the Focused/Other tab, the open conversation, the admin tab and whose dashboard you were on
   all come back as before - but the filter chip, the topic filter and the search box start
   clean, so an Inbox always opens showing its mail. Choosing "Open" again is one click, and
   the line added on 24 Nov still says "The Open filter is hiding N conversations - Show all"
   whenever something is being narrowed away.

   Run:  node server/patch-inbox-opens-clean.js
   then: node server/mailapp-b64.js encode
*/
const fs = require("fs");
const file = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(file, "utf8");
if (s.includes("__cleanopen:start")) { console.log("already there - nothing changed"); process.exit(0); }

const old = "   if(typeof s.tab==='string')tab=s.tab;\n   if(typeof s.filt==='string')filt=s.filt;\n   if(typeof s.lfilt==='string')lfilt=s.lfilt;";
if (!s.includes(old)) throw new Error("the uiRestore block was not found");
const neu = "   if(typeof s.tab==='string')tab=s.tab;\n" +
  "   /* __cleanopen:start 25 Nov 2026: the PLACE comes back, the NARROWING does not.\n" +
  "      A filter chip, a topic filter or a leftover search used to be restored for 12 hours, and\n" +
  "      that is what made an Inbox of 557 conversations show 25 (\"Open\"), 9 (\"Unread\") or none at\n" +
  "      all (a stale search). The Inbox now always opens showing its mail; choosing Open again is\n" +
  "      one click, and the list still says when a filter is hiding something. __cleanopen:end */\n" +
  "   filt='all';lfilt='';";
s = s.replace(old, neu);

/* the search box must not be refilled either */
const qOld = "   const q=$('#q');if(q&&typeof s.q==='string')q.value=s.q;";
if (!s.includes(qOld)) throw new Error("the restored search line was not found");
s = s.replace(qOld, "   const q=$('#q');if(q)q.value='';   /* 25 Nov 2026: never reopen into somebody's old search */");

fs.writeFileSync(file, s);
console.log("patched .tmp/email.html - a reload no longer restores the filter, the topic filter or the search box");
