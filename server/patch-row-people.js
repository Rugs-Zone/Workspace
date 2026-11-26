/* 26 Nov 2026 - "the mail from Aman is not showing in Team Pulse".
   WHY. Since 25 Nov the list is ONE ROW PER CONVERSATION (LV() forces conv:true), and
   rowName(t) names that row after the NEWEST message only. Aman Singh Verma wrote to
   teampulse@ on 25 Nov at 17:34 IST, Ashok replied from the app at 18:42, and Manfred Mui
   wrote at 20:21 - so the conversation's row reads "Manfred Mui, 8:21 pm" and there is no
   row anywhere called "Aman Singh Verma". Nothing hid the mail; it simply had no row.
   FIX. The row now names the conversation's PEOPLE, newest first, the way Gmail and Outlook
   do it - "Manfred Mui, me, Aman Singh Verma 6" - so every sender in a conversation is on
   the row, visible and findable. One row per conversation is unchanged, the time stays the
   newest mail's, the avatar stays the newest sender's, and Sent keeps its "To: ..." line.
   Run:  node server/patch-row-people.js        (then: node server/mailapp-b64.js encode)
*/
const fs = require("fs");
const f = __dirname + "/../.tmp/email.html";
let s = fs.readFileSync(f, "utf8");
let n = 0;
const need = (ok, what) => { if (!ok) { console.error("STOP - " + what); process.exit(1); } };

if (s.includes("__rowpeople")) { console.log("already there - nothing changed"); process.exit(0); }

/* 1. rowWho(), right after rowName() */
const anchor = "function rowHTML(t){const s=st(t),[l,c]=TAG[s]";
need(s.split(anchor).length === 2, "rowHTML anchor not found exactly once");
const add =
"/* __rowpeople 26 Nov 2026: with ONE row per conversation the row used to name only the\n" +
" newest message's sender, so a mail from anybody else in the same conversation had no name\n" +
" on screen at all (Aman Singh Verma 25 Nov 17:34 sat under a row reading \"Manfred Mui,\n" +
" 8:21 pm\", who wrote after him). The row now names the conversation's people, newest\n" +
" first, like Gmail and Outlook. rowName() is untouched - the avatar still follows the\n" +
" newest sender - and the Sent folder keeps its own \"To: ...\" line. */\n" +
"function rowWho(t){const ms=(t&&t.msgs)||[];if(ms.length<2)return rowName(t);\n" +
" const out=[],seen=new Set();\n" +
" for(let i=ms.length-1;i>=0&&out.length<3;i--){const m=ms[i];let nm='';\n" +
"  if(m&&m.by)nm=(m.by===ME?'me':String(((who(m.by)||{}).name)||''));\n" +
"  if(!nm&&m)nm=String(m.from||m.email||'');\n" +
"  nm=nm.trim();if(!nm)continue;\n" +
"  const k=nm.toLowerCase();if(seen.has(k))continue;seen.add(k);out.push(nm)}\n" +
" if(!out.length)return rowName(t);\n" +
" return out.join(', ')+' '+ms.length}\n";
s = s.replace(anchor, add + anchor); n++;

/* 2. the row's name span uses it */
const oldWho = "<span class=\"who\">${view.type==='box'&&view.folder==='sent'?'To: '+esc(t.email):esc(rowName(t))}</span>";
need(s.split(oldWho).length === 2, "the row's name span not found exactly once");
s = s.replace(oldWho, "<span class=\"who\">${view.type==='box'&&view.folder==='sent'?'To: '+esc(t.email):esc(rowWho(t))}</span>"); n++;

fs.writeFileSync(f, s);
console.log("patch-row-people: " + n + " edit(s) applied");
