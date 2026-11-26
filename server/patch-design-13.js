/* 27 Nov 2026 - bug 13: design / UI / UX / theme pass for Rugs Email.
   No rule, no ownership and no server change: this only changes how the app LOOKS
   and how its own chrome is laid out.
     1  preview text only (row preview + the folded-mail one-liner) stops showing
        [cid:...] image markers and <https://linkprotect...> rewritten links
     2  the "You are using X's ID" banner is a slim bar in the document flow, above
        the Items/Unread bar, so it covers nothing (laptop and phone)
     3  one font family for the app's own chrome, list 13-14px, mail body 14.5px,
        nothing with words in it below 12px; buyer mail keeps its own type but
        can no longer push the pane sideways
     4  light and dark: text >= 4.5:1, unread rows clearly bold, chips/tags readable
     5  phone: every button at least 40px tall, no sideways scroll
     6  empty lists say something useful ("No mail needs an owner")
   Run: node server/mailapp-b64.js decode && node server/patch-design-13.js && node server/mailapp-b64.js encode
   Safe to run twice: it refuses once its own marker is in the file. */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('__design13:start')) { console.log('already applied - nothing to do'); process.exit(0); }

function one(find, repl, what) {
  const i = s.indexOf(find);
  if (i < 0) { console.error('NOT FOUND: ' + what); process.exit(1); }
  if (s.indexOf(find, i + 1) >= 0) { console.error('FOUND TWICE: ' + what); process.exit(1); }
  s = s.slice(0, i) + repl + s.slice(i + find.length);
  console.log('ok  ' + what);
}

/* (6) the one empty state every mail list uses */
one(
  'h+=`<div class="empty"><b>${typeof loadingNote===\'function\'&&loadingNote()?loadingNote():\'All clear\'}</b><span>${view.id===\'needs\'?\'Every email has an owner.\':\'No mail here.\'}</span></div>`;',
  'h+=emptyBox();/*__design13*/',
  '(6) list empty state -> emptyBox()');

/* (1) the folded mail's one-line preview in the reading pane */
one(
  '<div class="msnip">${esc((m.body||\'\').replace(/\\s+/g,\' \').slice(0,140))}</div>',
  '<div class="msnip">${esc(pvClean(m.body).slice(0,140))}</div>',
  '(1) folded-mail preview -> pvClean');

/* (2) the switched-ID banner: slim, in the flow, its own space */
one(
  "st.textContent='#swBar{position:fixed;left:16px;bottom:14px;z-index:9999;background:#0b0b0c;color:#fff;border:2px solid #ff5a0a;border-radius:12px;padding:8px 10px 8px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 6px 24px rgba(0,0,0,.3);font-size:13px;max-width:calc(100vw - 32px)}#swBar .btn{background:#ff5a0a;border-color:#ff5a0a;color:#fff}'",
  "st.textContent='#swBar{position:static;flex:none;z-index:auto;display:flex;gap:10px;align-items:center;min-height:30px;padding:4px 12px;background:#2b1205;color:#fff;border:0;border-top:2px solid #ff5a0a;border-radius:0;box-shadow:none;font:500 12.5px/1.3 var(--ui);max-width:none;overflow:hidden}'"
  + "+'#swBar>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'"
  + "+'#swBar .btn{flex:none;background:#c2410c;border-color:#c2410c;color:#fff;min-height:28px;padding:4px 10px;font-size:12.5px}'"
  + "+'@media (max-width:900px){#swBar{min-height:48px;padding:5px 10px}#swBar .btn{min-height:40px;padding:8px 12px}}'",
  '(2) #swBar css -> slim in-flow bar');

one(
  "if(!el){el=document.createElement('div');el.id='swBar';el.setAttribute('role','status');document.body.appendChild(el)}",
  "if(!el){el=document.createElement('div');el.id='swBar';el.setAttribute('role','status');const _an=document.getElementById('statusbar');if(_an&&_an.parentNode)_an.parentNode.insertBefore(el,_an);else document.body.appendChild(el)}/*__design13*/",
  '(2) #swBar sits above the Items/Unread bar');

/* (3) buyer mail keeps its own formatting, but a huge picture or a long URL can
       no longer push the reading pane sideways */
one(
  "const block=!picsOk(m)&&hasRemote(h),inj=BASE+(block?PIC_CSP:'');",
  "const block=!picsOk(m)&&hasRemote(h),inj=BASE+(block?PIC_CSP:'')+'<style>img{max-width:100%;height:auto}body{overflow-wrap:anywhere}</style>'/*__design13*/;",
  '(3) buyer mail never overflows');

/* the block itself */
const BLOCK = [
'',
'<script>/* __design13:start  27 Nov 2026 (bug 13): design / UI / UX / theme pass */',
'/* ---------- (1) preview text only ----------------------------------------',
'   A row preview and the folded-mail one-liner are plain words for a person to',
'   read, so the plumbing is taken out of them: [cid:image001.png@01DC...] image',
'   markers and <https://linkprotect.cudasvc.com/...> rewritten links.',
'   The mail itself is NEVER touched - this runs on the preview string only. */',
'function pvClean(s){',
' let x=String(s==null?\'\':s);',
' try{',
'  x=x.replace(/\\[cid:[^\\]]*\\]?/gi,\' \')',
'     .replace(/\\[image:[^\\]]*\\]?/gi,\' \')',
'     .replace(/\\bcid:[A-Za-z0-9._%+\\-@]+/gi,\' \')',
'     .replace(/<\\s*(?:https?:\\/\\/|mailto:)[^>]*>?/gi,\' \')',
'     .replace(/https?:\\/\\/[a-z0-9.\\-]*(?:linkprotect\\.cudasvc\\.com|safelinks\\.protection\\.outlook\\.com|urldefense\\.(?:com|proofpoint\\.com))\\/\\S*/gi,\' \')',
'     .replace(/&nbsp;?/gi,\' \')',
'     .replace(/[\\u200b-\\u200f\\u202a-\\u202e\\ufeff]/g,\'\')',
'     .replace(/\\s+/g,\' \').trim();',
' }catch(e){}',
' return x;',
'}',
'if(typeof rowPre===\'function\'){const _rpD=rowPre;rowPre=function(){return pvClean(_rpD.apply(this,arguments))}}',
'',
'/* ---------- (6) an empty list says what it means ------------------------- */',
'function emptyBox(){',
' try{',
'  const ld=(typeof loadingNote===\'function\'&&loadingNote())||\'\';',
'  if(ld)return \'<div class="empty"><b>\'+esc(ld)+\'</b><span>Mail appears here on its own as it arrives - nothing to press.</span></div>\';',
'  const qv=((typeof $===\'function\'&&$(\'#q\')&&$(\'#q\').value)||\'\').trim();',
'  if(qv)return \'<div class="empty"><b>Nothing matches \\u201c\'+esc(qv)+\'\\u201d</b><span>Try fewer words, or a PO number, a buyer name or an address. Clear the search to see the whole folder again.</span></div>\';',
'  const V=view||{};let t=\'Nothing here\',p=\'No mail in this list.\';',
'  const FAV={',
'   mine:[\'Nothing on your plate\',\'No conversation is assigned to you and still open.\'],',
'   handled:[\'Nothing handled by you yet\',\'A conversation shows here once it is given to you.\'],',
'   mylate:[\'No late promises\',\'Every date you gave a buyer is still ahead of you.\'],',
'   mytoday:[\'Nothing of yours is due today\',\'No promise of yours falls due today.\'],',
'   needs:[\'No mail needs an owner\',\'Every conversation in your team has somebody working on it.\'],',
'   assign:[\'Everything is assigned\',\'No mail is waiting to be given to somebody.\'],',
'   late:[\'Nothing is late\',\'Every promise made to a buyer is still inside its date.\'],',
'   today:[\'Nothing is due today\',\'No promise falls due today.\'],',
'   flag:[\'Nothing flagged\',\'Press the flag on a row to keep it here.\'],',
'   pinned:[\'Nothing pinned\',\'Press \\ud83d\\udccc on a row to keep it at hand.\'],',
'   snoozed:[\'Nothing snoozed\',\'A snoozed conversation comes back by itself on the day you chose.\'],',
'   remind:[\'No follow-up reminders\',\'Set one on a conversation to be reminded about it.\'],',
'   nudge:[\'Every buyer has answered\',\'Nothing you wrote has been waiting three days or more.\']};',
'  const BOX={',
'   inbox:[\'Inbox is clear\',\'No mail from a buyer or a colleague is waiting in this mailbox.\'],',
'   sent:[\'Nothing sent from here yet\',\'Every mail you or your team send from this mailbox shows here.\'],',
'   archive:[\'Nothing archived\',\'Mail you archive is kept here, out of the Inbox.\'],',
'   junk:[\'No junk\',\'Nothing in this mailbox has been marked as junk.\'],',
'   deleted:[\'Deleted is empty\',\'Mail you delete waits here until you empty it.\'],',
'   drafts:[\'No drafts\',\'A mail you start and do not send is kept here.\']};',
'  if(filt===\'unread\'){t=\'Nothing unread\';p=\'Every mail in this list has been read.\'}',
'  else if(filt===\'needs\'){t=\'No mail needs an owner\';p=\'Every conversation here has somebody working on it.\'}',
'  else if(filt===\'mine\'){t=\'Nothing of yours here\';p=\'No conversation in this list is assigned to you.\'}',
'  else if(V.type===\'fav\'&&FAV[V.id]){t=FAV[V.id][0];p=FAV[V.id][1]}',
'  else if(V.type===\'box\'&&BOX[V.folder]){t=BOX[V.folder][0];p=BOX[V.folder][1]}',
'  else if(V.type===\'folder\'){t=\'\\u201c\'+esc(V.folder||\'This folder\')+\'\\u201d is empty\';p=\'Drag a mail onto this folder, or make a rule in \\ud83d\\udccb My rules to file mail here by itself.\'}',
'  else if(V.type===\'person\'){const w=(typeof who===\'function\'&&who(V.id))||null;t=\'Nothing assigned to \'+esc((w&&w.name)||\'this person\');p=\'A conversation shows here once it is given to them.\'}',
'  else if(V.type===\'crit\'){t=\'No critical mail\';p=\'Nothing in this list is a claim, a complaint or a shipping problem.\'}',
'  else if(V.type===\'cat\'){t=\'Nothing in this topic\';p=\'Give a conversation this topic and it shows here.\'}',
'  return \'<div class="empty"><b>\'+t+\'</b><span>\'+p+\'</span></div>\';',
' }catch(e){return \'<div class="empty"><b>Nothing here</b><span>No mail in this list.</span></div>\'}',
'}',
'',
'/* ---------- (3) (4) (5) type, themes and the phone ----------------------',
'   mail-v2.js, the Outlook pack and the 26 Nov contrast block all inject their',
'   styles AFTER this script, so these carry !important and are put again at',
'   2s and 6s - the same trick the contrast block uses. */',
'(function(){',
' const CSS=[',
' /* (3) ONE font family for everything the app itself draws. The buyer\'s own mail',
'    (.rich / the sandboxed .raw iframe) and what we write to send (.editor, .sig)',
'    deliberately keep their own type - that is the letter, not the app. */',
' \'body,button,input,select,textarea,.list,.lhead,.msgs,.m,.day,.chip,.tag,.btn,.folders,.fi,.read,.rtop,.rbody,.mail header,.mail .msnip,.mail p,.hist,.hi,.empty,.stbar,.rail,.mobnav,.track,.dlg,.pop,.toast{font-family:var(--ui)!important}\',',
' \'.cfb{font-family:var(--ui)!important}.ofx-tabs button{font-family:var(--ui)!important;font-size:12.5px!important}\',',
' /* (3) the list: 13-14px, and nothing with words in it under 12px */',
' \'.m .who{font-size:14px!important}\',',
' \'.m .sub{font-size:13.5px!important}\',',
' \'.m .pre{font-size:13px!important}\',',
' \'.m .time{font-size:12px!important}\',',
' \'.day{font-size:12px!important}\',',
' \'.tag,.lchip,.lb,.src,.chip{font-size:12px!important}\',',
' \'.lhead h2 small{font-size:12px!important}\',',
' \'.rail button{font-size:12px!important;line-height:1.2}\',',
' \'.mobnav button{font-size:12px!important}\',',
' \'.aihint small,.note small,.ctrail .ost,.sigopt span,.frow small,.cd small,.ch,.pwrules,.shelp,.asv{font-size:12px!important}\',',
' \'.fgroup .h4,.fgroup .h4 button,.fgroup .h4 span,.mbxname,.hi .go,.lbtog,.ci,.calk .ci{font-size:12px!important}\',',
' /* the rail needs a little more room once its labels are 12px */',
' \'.rail{width:76px!important}.rail button{width:64px!important;min-height:48px}\',',
' /* (3) the reading pane: mail body 14.5px, its header 12-14px */',
' \'.mail p,.mail .rich{font-size:14.5px!important;line-height:1.6}\',',
' \'.mail header .w b{font-size:14px!important}\',',
' \'.mail header .w span,.mail header time{font-size:12px!important}\',',
' \'.mail .msnip{font-size:13px!important}\',',
' \'.sig,.hi,.att,.rawnote{font-size:12.5px!important}\',',
' /* (3) buyer mail keeps its own formatting but never pushes the pane sideways */',
' \'.mail .mbody{min-width:0;max-width:100%}\',',
' \'.rich{overflow-x:auto;overflow-wrap:anywhere}\',',
' \'.rich img,.mail .mbody img{max-width:100%;height:auto}\',',
' \'.raw{overflow-x:hidden}.raw iframe{max-width:100%}\',',
' /* (4) themes: the two tag colours the audit block never darkened */',
' \'.t-xfer{color:color-mix(in srgb,var(--violet) 72%,var(--fg))!important}\',',
' \'.src{color:color-mix(in srgb,var(--green) 70%,var(--fg))!important}\',',
' \'.t-asg{color:var(--muted)!important}\',',
' /* (4) unread rows: unmistakable in both themes */',
' \'.m.unread .who,.m.unread .sub{font-weight:800!important}\',',
' \'.m.unread .time{font-weight:700!important}\',',
' \'.m.unread{border-left-width:4px!important;border-left-color:var(--brand)!important}\',',
' /* (5) phone: 40px of something to press, and nothing scrolls sideways */',
' \'@media (max-width:900px){\'',
'  +\'button,.btn,.chip,.lchip,.fi,.dpick,.tonerow,.sigopt{min-height:40px}\'',
'  +\'.tick,.msel input,.ddot,.av{min-height:0}\'',
'  +\'.hamb,.me,.back,.lbtog,.ib,.rail button,.mobnav button{min-height:40px!important}\'',
'  +\'.hamb,.back{width:40px!important;height:40px!important}\'',
'  +\'.olk-bar .btn,.rtb .btn,.rtop .btn,.acts .btn{min-height:40px!important}\'',
'  +\'.chip,.lchip{display:inline-flex;align-items:center}\'',
'  +\'.rtop .acts .btn,.bkbar .btn,.xacts .btn,.prevrow .btn,.mchips .btn,.rtb .attg .btn{min-height:40px!important}\'',
'  +\'.qa button{width:40px!important;height:40px!important}\'',
'  +\'select,input[type=text],input[type=date],input[type=datetime-local],input[type=email],input[type=password]{min-height:40px}\'',
'  +\'.ib,.ib.sm{min-width:40px;min-height:40px}\'',
'  +\'.m{padding:13px 14px 13px 12px}\'',
'  +\'.list,.msgs,.read,.rbody,.page{overflow-x:hidden}\'',
'  +\'.split{display:none}\'',   /* both panes a splitter drags are hidden or full width on a phone, so the handles were 6px of nothing sticking out */
'  +\'.m,.m .body,.mail,.mail header .w{min-width:0}\'',
'  +\'.lhead,.seg,.acts{flex-wrap:wrap}\'',
'  +\'.undobar{max-width:calc(100vw - 24px)}\'',
' +\'}\',',
' \'@media (max-width:640px){.mobnav button{padding:9px 0;min-height:48px}}\'',
' ].join(\'\');',
' const put=function(){let st=document.getElementById(\'design13css\');if(!st){st=document.createElement(\'style\');st.id=\'design13css\'}st.textContent=CSS;document.head.appendChild(st)};',
' put();setTimeout(put,2000);setTimeout(put,6000);',
'})();',
'/* __design13:end */<' + '/script>',
''
].join('\n');

/* the app has no </body> of its own (there is one inside a JS string, which is why
   this appends at the very end instead of looking for a tag) */
s = s.replace(/\s*$/, '\n') + BLOCK;
console.log('ok  design13 block appended at the end of the file');
fs.writeFileSync(F, s);
console.log('done: ' + n0 + ' -> ' + s.length + ' chars');
