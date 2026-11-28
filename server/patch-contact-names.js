/* patch-contact-names.js - 28 Nov 2026
 *
 * "Still not showing in Sent." Driven on the REAL published site as Ashish Deshwal (a real
 * session), his Sent folder holds 154 conversations and 684 rows, newest 27 Nov, every one
 * attributed to him - so the mail is there. What is wrong is what the rows SAY. The "To:" column
 * read, verbatim:
 *
 *   To: As mentioned, kindly let us know immediately if you have any
 *   To: [Une image contenant Police, Graphique, capture d'ecran, gra
 *   To: [Loods 5 Home]<https://eu.content.exclaimer.net/?url=http%3A
 *   To: [cid:image001.jpg@01DD4CD7.8B8AEC40]<https://www.groupe-jja.
 *
 * while the mail's real To was a plain address (lily-sue.martin@flairrugs.com, and so on). A
 * Sent list that reads like that looks exactly like "my sent mail is not showing".
 *
 * THE CAUSE. parseSig() takes the FIRST LINE of a mail's signature block as the person's name:
 *   if (i === 0 && !/desk|payable/i.test(l)) { o.name = l; return }
 * For a mail whose "signature" is really body text, an Exclaimer banner or a [cid:...] image
 * marker, that first line is a sentence or a picture marker - and it became the contact's name.
 * Measured on his live session: 33 of 327 contacts carried a name like that, and the Sent row
 * shows the contact's name, so the junk surfaced there (and on the Contacts page, and in the
 * contact card, and on any avatar built from the name).
 *
 * THE FIX, one shared guard, goodName(): a name must look like a name - no markup, no address,
 * no link, no [cid:], not a quoted "From:" header, letters in it, at most five words, not a
 * sentence, 48 characters at most. It is used in three places:
 *   1. parseSig  - a signature's first line only becomes the name if it looks like one, so the
 *                  junk never enters a contact (the From display name stays instead).
 *   2. contacts()- anything already stored that fails the guard falls back to the sender's own
 *                  display name, and failing that to a readable form of the address itself.
 *   3. sentTo()  - the Sent row never prints a name that fails the guard.
 * (the last fallback inside sentTo is fixed by server/patch-sent-to-fallback.js)
 * A name a person TYPED themselves (S.contactEdits) is always kept, guard or no guard.
 *
 * Nothing is written to the server and no rule changes: this is what the screen reads.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-contact-names.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__goodname")) { console.log("already applied - nothing to do"); process.exit(0); }

let done = 0;
function edit(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(name + ": found " + n + " times, expected 1");
  s = s.replace(from, to);
  console.log("  edit " + (++done) + " ok  " + name);
}

/* 1 - the guard, next to parseSig so both see it */
edit("the guard",
  "function parseSig(sig,email,fromName){",
  "/* __goodname 28 Nov 2026: does this look like a person's or a company's name? The ones that got\n" +
  "   through were picture markers, Exclaimer banners, whole sentences and quoted \"From:\" lines. */\n" +
  "function goodName(x){const v=String(x==null?'':x).trim();\n" +
  " if(!v||v.length>48)return false;\n" +
  " if(/[<>\\[\\]{}|@]/.test(v))return false;                       /* markup, an address, an image marker */\n" +
  " if(/https?:|cid:|www\\./i.test(v))return false;                /* a link */\n" +
  " if(/^(from|to|cc|bcc|subject|sent|date|re|fw|fwd)\\s*:/i.test(v))return false;   /* a quoted header */\n" +
  " if(!/[A-Za-z\\u00C0-\\u024F]/.test(v))return false;             /* no letters at all */\n" +
  " if(v.split(/\\s+/).length>5)return false;                      /* a name is short */\n" +
  " if(/[.!?,;]$/.test(v)&&v.split(/\\s+/).length>2)return false;   /* a sentence */\n" +
  " return true}\n" +
  "/* a readable last resort: lily-sue.martin@x.com -> Lily Sue Martin */\n" +
  "function nameFromMail(e){const l=String(e||'').split('@')[0].replace(/[._+-]+/g,' ').replace(/\\d+/g,' ').trim();\n" +
  " if(!l)return String(e||'');\n" +
  " return l.split(/\\s+/).filter(Boolean).slice(0,4).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}\n" +
  "function parseSig(sig,email,fromName){"
);

/* 2 - a signature's first line only becomes the name if it looks like one */
edit("parseSig: the first line must look like a name",
  "if(i===0&&!/desk|payable/i.test(l)){o.name=l;return}",
  "if(i===0&&!/desk|payable/i.test(l)){if(goodName(l))o.name=l;return}   /* __goodname */"
);

/* 3 - contacts(): keep the sender's own display name as a fallback */
edit("contacts: remember the display name",
  "c.mails++;c.last=Math.max(c.last,m.at);c.depts.add(t.dept);if(t.owner)c.owners.add(t.owner)}));",
  "c.mails++;c.last=Math.max(c.last,m.at);c.depts.add(t.dept);if(t.owner)c.owners.add(t.owner);\n" +
  "  if(m.from&&!goodName(c.fromName)&&goodName(String(m.from).split(' (')[0]))c.fromName=String(m.from).split(' (')[0];   /* __goodname */" +
  "}));"
);
/* 4 - and never hand out a junk name */
edit("contacts: never hand out a junk name",
  "return Object.values(map).map(c=>({...c,...(S.contactEdits?.[c.email]||{}),depts:[...c.depts],owners:[...c.owners]})).sort((a,b)=>b.last-a.last)}",
  "return Object.values(map).map(c=>{const o={...c,...(S.contactEdits?.[c.email]||{}),depts:[...c.depts],owners:[...c.owners]};\n" +
  "  /* __goodname: a name somebody typed is kept as typed; a harvested one has to look like a name */\n" +
  "  const typed=S.contactEdits?.[o.email]?.name;\n" +
  "  if(!typed&&!goodName(o.name))o.name=goodName(o.fromName)?o.fromName:nameFromMail(o.email);\n" +
  "  return o}).sort((a,b)=>b.last-a.last)}"
);

/* 5a - and the address it picks must BE an address. A real header from Loods 5 reads
        "[Loods 5 Home]<https://eu.content.exclaimer.net/?url=...>" <m.wedman@loods5.nl>
        - the first <...> is a LINK, and that link was being shown as the recipient. */
edit("sentTo: pick the address, not a link",
  "const em=((p.match(/<([^>]+)>/)||[])[1]||p).replace(/[\"']/g,'').trim().toLowerCase();if(!em||skip.has(em))return;",
  "const all=String(p).match(/[^\\s<>\"',;:]+@[^\\s<>\"',;:]+\\.[A-Za-z]{2,}/g)||[];   /* __goodname: the LAST address in the part, so a link in a display name cannot be mistaken for one */\n" +
  "   const em=String(all.length?all[all.length-1]:'').replace(/[\"']/g,'').trim().toLowerCase();\n" +
  "   if(!em||skip.has(em))return;"
);

/* 5 - the Sent row's "To:" never prints a junk name */
edit("sentTo: only a real name",
  "let nm=((p.match(/^\\s*\"?([^\"<]+?)\"?\\s*</)||[])[1]||'').trim();if(!nm||nm.toLowerCase()===em)nm=_sentCt.m.get(em)||em;",
  "let nm=((p.match(/^\\s*\"?([^\"<]+?)\"?\\s*</)||[])[1]||'').trim();\n" +
  "   if(nm&&!goodName(nm))nm='';                                     /* __goodname */\n" +
  "   if(!nm||nm.toLowerCase()===em){const cn=_sentCt.m.get(em);nm=goodName(cn)?cn:em}"
);

fs.writeFileSync(F, s);
console.log("ok  " + done + " edits");
