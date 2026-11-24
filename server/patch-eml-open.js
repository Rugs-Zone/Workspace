/* 24 Nov 2026 - a mail sent as a file (.eml) can be opened and saved in Rugs Email.
 *
 * What was wrong: the app has had a complete .eml reader since 18 Nov (emlParse / emlMount,
 * used by previewAtt), but the LIVE layout is Rugs Email 2.0 (mail-v2.js), whose own
 * full-screen viewer decides what to draw with kindOf(name) - and .eml matched nothing, so it
 * fell to v:"none" and answered "This kind of file can't be previewed". emlMount was also an
 * inner function of the module, so mail-v2.js could not reach it. Nothing was wrong with the
 * server: a real check of seven mailboxes found every attached mail stored by Gmail with its
 * own attachmentId and its bytes fetching fine - except files over the 15 MB download cap
 * (one real 27 MB mail), which is why the cap is raised in the server bundle.
 *
 * This patch, in the app: hand emlMount (and the two name tests) to mail-v2.js on window,
 * block pictures from the internet in a .eml until the reader asks for them, and make "Open"
 * on an attached mail open it HERE instead of sending the person to Google Drive, which
 * cannot show a .eml at all.
 *   node server/patch-eml-open.js   (then: node server/mailapp-b64.js encode)
 */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const sub = (a, b) => {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error('anchor found ' + c + ' times: ' + a.slice(0, 60));
  s = s.replace(a, b); n++;
};

/* 1. a .eml is read-only, so pictures from the internet stay blocked until the reader
      presses Show pictures (the sender of an attached mail is not necessarily a sender
      we know, and nothing in it has been through the Inbox's own picture rule) */
sub(
  `  const blocked=!picsOk(pm)&&hasRemote(bodyHTML);`,
  `  const blocked=!pm.showPics&&hasRemote(bodyHTML);   /* 24 Nov 2026: in a .eml, pictures from the internet are blocked until asked for */`
);

/* 2. let the 2.0 layout (mail-v2.js) use the same reader */
sub(
  `/* the body of a .eml is shown in the same sandboxed iframe as received mail`,
  `window.rzEmlMount=emlMount;window.rzEmlIs=emlIs;window.rzEmlIsMsg=emlIsMsg;   /* 24 Nov 2026: mail-v2.js draws .eml with this */
/* the body of a .eml is shown in the same sandboxed iframe as received mail`
);

/* 3. "Open" on an attached mail opens it here. Google Drive has no viewer for message/rfc822,
      so "Open in Drive" was a dead end for exactly these files. */
sub(
  `  if(k==='open'&&a.link){window.open(a.link,'_blank','noopener');return}`,
  `  if(k==='open'&&emlIs(a.name,a.mime)&&a.gid){previewAtt(a.box,a.gid,a.name);return}   /* 24 Nov 2026: Drive cannot show a mail file */
  if(k==='open'&&a.link){window.open(a.link,'_blank','noopener');return}`
);

/* 4. the same for the plain chip in the classic layout, which is a link straight to Drive */
sub(
  `   const mb=document.createElement('button');
   mb.type='button';mb.className='olkam';mb.textContent='⋯';`,
  `   /* 24 Nov 2026: an attached mail (.eml) opens in Rugs Email, not in Drive */
   if(emlIs(name,mime)&&gid)el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();previewAtt(t.box,gid,name)},true);
   const mb=document.createElement('button');
   mb.type='button';mb.className='olkam';mb.textContent='⋯';`
);

fs.writeFileSync(F, s);
console.log('email.html patched, ' + n + ' edits');
