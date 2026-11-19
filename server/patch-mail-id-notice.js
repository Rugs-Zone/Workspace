/* 18 Nov 2026 — Team Alpha / Team Pulse: a notice under the signature that the old individual
   email IDs are closing and the team address is the one to save.
   Centrally added (not written into anybody's saved signature), so:
     - everyone in those two teams has exactly the same wording, new joiners included
     - nobody can delete it by accident, and "My signature" still edits only their own part
     - when the old IDs are gone, deleting this one block removes it everywhere
   Which notice is used follows the MAILBOX the mail goes out from (teamalpha@ / teampulse@), not the
   person, so an admin replying from a team mailbox carries it and the same admin writing from
   marketing@ does not.
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-mail-id-notice.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
let done = 0;
function sub(name, old, nw) {
  const n = s.split(old).length - 1;
  if (n !== 1) { console.error('FAILED (' + n + ' matches): ' + name); process.exit(1); }
  s = s.replace(old, nw); done++; console.log('ok  ' + name);
}

/* 1. sigOf has to be replaceable (it is a const today) */
sub('sigOf can be wrapped',
  `const sigOf=pid=>S.sigs?.[pid]||defaultSig(who(pid));`,
  `let sigOf=pid=>S.sigs?.[pid]||defaultSig(who(pid));`);

/* 2. the notice itself + the wrapper around sigOf */
sub('the notice block',
  `const sigView=s=>isHtmlSig(s)?\`<div class="sightml">\${s}</div>\`:esc(s||'');`,
  `const sigView=s=>isHtmlSig(s)?\`<div class="sightml">\${s}</div>\`:esc(s||'');
/* ---- 18 Nov 2026: "our email address has changed" notice under the signature ----
   The old individual IDs of the two merchant teams are being closed, so every mail that goes out of
   teamalpha@ / teampulse@ carries one short notice asking buyers to save the team address and to
   resend anything still pending on the old IDs. Nobody's saved signature is touched: the notice is
   added here, when the signature is used. To stop it, delete MAIL_ID_NOTICE's entries. */
const MAIL_ID_NOTICE={
 'teamalpha@rugscreation.com':{box:'teamalpha@rugscreation.com',old:'merchandiser2@, merchandiser4@, merchandiser7@, amr1@ and abhishek@rugscreation.com'},
 'teampulse@rugscreation.com':{box:'teampulse@rugscreation.com',old:'dmm1@, amr4@, merchandiser9@ and merchandiser5@rugscreation.com'}};
let SIG_BOX='';   // the mailbox the open compose window sends from
function noteBox(){try{
 if(SIG_BOX&&document.getElementById('cb'))return String(SIG_BOX).toLowerCase();   // writing a mail
 const t=(typeof openId!=='undefined'&&openId)?T_(openId):null;                    // quick reply in an open mail
 if(t)return String(mailOf(dept(t.dept))||'').toLowerCase();
 const d=who(ME)&&dept(who(ME).dept);return String(d?mailOf(d):'').toLowerCase()
}catch(e){return''}}
const noteFor=()=>MAIL_ID_NOTICE[noteBox()]||null;
const noteHTML=n=>\`<div data-mailnote="1" style="margin-top:14px;padding-top:9px;border-top:1px solid #e0e0e0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.6;color:#6b6b6b">\\
<b style="color:#c2410c">Please note \\u2014 our email address has changed.</b><br>\\
Kindly save and use <b>\${n.box}</b> for all mails to our team. Our old individual email IDs (\${n.old}) are being closed, and mail sent to them may not reach us.\\
 If anything is still pending on those addresses, please resend it to <b>\${n.box}</b> so that nothing is missed.</div>\`;
const stripNote=s=>String(s||'').replace(/<div data-mailnote="1"[\\s\\S]*?<\\/div>\\s*\$/i,'');
const sigRaw=sigOf;                                  // the person's own signature, as they saved it
sigOf=pid=>{const n=noteFor();const base=stripNote(sigRaw(pid));if(!n)return base;
 const body=isHtmlSig(base)?base:(base?'<div style="white-space:pre-wrap;font:13px Arial,Helvetica,sans-serif;color:#444">'+esc(base)+'</div>':'');
 return body+noteHTML(n)};`);

/* 3. compose(): remember which mailbox this mail goes out from */
sub('compose(): remember the From mailbox',
  ` const myBox=dept(t?t.dept:who(ME).dept);`,
  ` const myBox=dept(t?t.dept:who(ME).dept);
 SIG_BOX=mailOf(myBox);   // the notice under the signature follows the mailbox, not the person`);

/* 4. compose(): changing From on a new mail swaps the signature (and its notice) */
sub('compose(): From change refreshes the signature',
  ` q('#cSig').onchange=e=>{q('#sigPrev').hidden=!e.target.value};`,
  ` q('#cSig').onchange=e=>{q('#sigPrev').hidden=!e.target.value};
 /* a new mail can change From, and each team mailbox has its own notice under the signature */
 q('#cf').addEventListener('change',e=>{const d=dept(e.target.value);if(!d)return;SIG_BOX=mailOf(d);
  const pv=q('#sigPrev');if(pv)pv.innerHTML='<small>Signature \\u00b7 '+esc(who(ME).name.split(' ')[0])+'</small>'+sigView(sigOf(ME));
  const ed2=q('#cb');if(!ed2||!q('#cSig').value)return;const old=ed2.querySelector('[data-sig]');if(old)old.remove();
  const tb=ed2.querySelector('[data-trail]');const h=sigHTML(sigOf(ME));
  if(tb)tb.insertAdjacentHTML('beforebegin',h);else ed2.insertAdjacentHTML('beforeend',h)});`);

/* 5. "My signature" edits the person's own part only, never the notice */
sub('My signature: edit the saved signature, not the notice',
  `function sigDlg(){const p=who(ME),pr=S.profiles[ME]||{},cur=sigOf(ME),d=dept(p.dept);`,
  `function sigDlg(){const p=who(ME),pr=S.profiles[ME]||{},cur=stripNote(sigRaw(ME)),d=dept(p.dept);`);

fs.writeFileSync(F, s);
console.log(done + ' edits');
