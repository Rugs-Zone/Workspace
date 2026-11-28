/* patch-saved-copy-client.js - 28 Nov 2026  URGENT (live), the app half
 *
 * Goes with server/patch-thread-rescue.js. The server now answers saved:true for a mail whose
 * original Gmail no longer has (404 on the stored id, and the rescue by sender+time found
 * nothing) and sends the copy Rugs Email saved instead of nothing. Four small edits:
 *
 *  1 + 2. the two places a mail is filled in (liveOpen for the whole conversation, openLight
 *         for one older mail) carry saved + why onto the mail, so
 *  3.     the reading pane says, once, in plain words, that this is the saved copy - and the
 *         "Shown exactly as received" line is not printed under it, because it is not.
 *  4.     a poll keeps the mark (mapRow), so the line does not flicker away 15 seconds later.
 *
 * Plus: folding a saved mail up no longer frees it (nothing to re-fetch - the saved text IS
 * the mail here), so it cannot bounce back to "Opening this mail...".
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-saved-copy-client.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");
if (s.includes("__savedcopy")) { console.log("already applied - nothing to do"); process.exit(0); }

let done = 0;
function edit(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(name + ": found " + n + " times, expected 1");
  s = s.replace(from, to);
  console.log("  edit " + (++done) + " ok  " + name);
}

/* 1 - the whole conversation (liveOpen) */
edit("liveOpen: keep saved + why",
  "x.light=false;x.raw=fixMailImgs(m.body_html||'');x.body=(m.body_text||x.body||'').trim();x.full=true;",
  "x.light=false;x.raw=fixMailImgs(m.body_html||'');x.body=(m.body_text||x.body||'').trim();x.full=true;x.saved=!!m.saved;x.savedWhy=m.why||'';   /* __savedcopy */"
);
/* 2 - one older mail (openLight) */
edit("openLight: keep saved + why",
  "x.raw=fixMailImgs(q.body_html||'');x.body=(q.body_text||x.body||'').trim();x.full=true;x.light=false;x.wasLight=true;",
  "x.raw=fixMailImgs(q.body_html||'');x.body=(q.body_text||x.body||'').trim();x.full=true;x.light=false;x.wasLight=true;x.saved=!!q.saved;x.savedWhy=q.why||'';   /* __savedcopy */"
);
/* 3a - say it, once, at the top of the mail */
edit("reading pane: the saved-copy line",
  '<div class="mbody">${!os.has(mi)?\'\':m.light?',
  '<div class="mbody">${os.has(mi)&&m.saved?`<div class="rawnote" style="margin:0 0 6px">\\u26a0 ${esc(m.savedWhy||\'Google Mail no longer has the original of this mail, so this is the copy Rugs Email saved.\')} Pictures and the exact layout are not in it.</div>`:\'\'}${!os.has(mi)?\'\':m.light?'
);
/* 3b - and do not claim it is shown exactly as received */
edit("reading pane: no 'exactly as received' on a saved copy",
  '<span class="rawnote">${ico(\'mail\')} Shown exactly as received — formatting, logo, signature and banners untouched</span>',
  '${m.saved?\'\':`<span class="rawnote">${ico(\'mail\')} Shown exactly as received — formatting, logo, signature and banners untouched</span>`}'
);
/* 4 - a poll must not lose the mark */
edit("mapRow: keep the saved mark across a poll",
  "full:!!prev?.full,sig:out?'':sigFromText(m.body_text)",
  "full:!!prev?.full,saved:!!prev?.saved,savedWhy:prev?.savedWhy||'',sig:out?'':sigFromText(m.body_text)"
);
/* 5 - and the memory guard must not throw the saved text away (there is nothing to re-fetch) */
edit("fold: never free a saved copy",
  " function freeMsg(t,m){\n  if(!m||!m.wasLight)return 0;",
  " function freeMsg(t,m){\n  if(!m||!m.wasLight||m.saved)return 0;   /* __savedcopy */"
);
/* 6 - RAWC is what a poll reads back, so the mark lives there too */
edit("RAWC: remember it is a saved copy",
  "RAWC[q.gmail_id]={raw:x.raw,body:x.body,full:true}",
  "RAWC[q.gmail_id]={raw:x.raw,body:x.body,full:true,saved:!!q.saved,savedWhy:q.why||''}"
);

fs.writeFileSync(F, s);
console.log("ok  " + done + " edits");
