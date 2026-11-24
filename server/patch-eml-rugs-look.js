/* 24 Nov 2026 - an attached mail is drawn in Rugs Email's own format, not as a raw dump, and a
 * .eml already on the computer can be opened without Outlook.
 *
 * (1) THE LOOK. emlMount now builds the SAME message card the reading pane builds: the round
 *     avatar and sender name, the address, a To / Cc line, the date on the right, the subject as
 *     the title, the body in the same sandboxed frame, and the same attachment chips with Open
 *     preview and Download - plus one small "Attached email (.eml)" label so it is clear this is
 *     a mail that arrived as a file. Same classes as the reading pane (article.mail / header /
 *     .mbody / .raw / .att), so it inherits every theme and the Outlook look with no second set
 *     of styles to keep.
 * (2) PICTURES SHOW, as they do in a normal mail: the mail's own pasted (cid:) pictures are
 *     already turned into data: pictures by the reader, and remote pictures are now allowed too.
 *     Scripts, frames, forms and javascript: links are still stripped, and the body is still
 *     drawn in a sandbox that cannot run anything.
 * (3) Signature pictures inside the attached mail are kept out of its file list by the same rule
 *     as everywhere else, with the same "Show hidden inline images" link.
 * (4) NO OUTLOOK NEEDED: "Open an .eml file" in the menu under your own name (a normal file
 *     picker) and drag-and-drop of a .eml anywhere onto the Rugs Email window - both read the
 *     file in the page itself and open this same preview. Nothing is uploaded.
 *
 *   node server/patch-eml-rugs-look.js   (then: node server/mailapp-b64.js encode)
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

/* ---------- (1)(2)(3) the reader draws a Rugs Email message card ---------- */
const OLD = s.slice(s.indexOf(`/* draw a parsed .eml into any container, like a received mail */`), s.indexOf(`/* the body of a .eml is shown in the same sandboxed iframe as received mail`));
if (!OLD || OLD.length < 400) throw new Error('could not find the old emlMount');

const NEW = `/* draw a parsed .eml into any container, as the same message card the reading pane uses */
function emlMount(el,u8,name){
 let P=null;try{P=emlParse(u8)}catch(e){P=null}
 if(!P||(!P.html&&!P.text&&!P.atts.length&&!P.subject&&!P.from)){
  el.innerHTML='<div class="empty" style="padding:18px"><b>'+esc(name||'This mail file')+'</b><span>This mail file is empty or damaged, so it cannot be shown. Press Download to keep a copy.</span></div>';return}
 const addr=(String(P.from).match(/[\\w.+-]+@[\\w.-]+\\.\\w+/)||[''])[0];
 const who1=String(P.from||'').replace(/<[^>]*>/g,'').replace(/^["'\\s]+|["'\\s]+$/g,'')||addr||'(unknown sender)';
 /* stands in for a message: pictures show, exactly as in a normal mail */
 const pm={email:addr,from:who1,showPics:true,raw:P.html};
 const when=(()=>{const d=Date.parse(P.date);return d?tLong(d):esc(P.date||'')})();
 const nmOf=a=>{try{return typeof olkNameFor==='function'?olkNameFor(a):a}catch(e){return a}};
 const people=v=>String(v||'').split(/,(?![^<]*>)/).map(x=>x.trim()).filter(Boolean).map(nmOf).join(', ');
 const KEY='eml:'+(name||'')+':'+(P.subject||'');
 const fake={gid:KEY,raw:P.html,html:'',atts:P.atts.map(a=>({name:a.name,mime:a.mime,size:(a.bin||'').length,inline:!!a.inline,cid:a.cid||''})),files:null};
 const draw=()=>{
  const sp=(typeof attSplit==='function')?attSplit(fake):{show:fake.atts,hide:[]};
  const open=!!(window.rzShowInl&&window.rzShowInl[KEY]);
  const shown=open?sp.show.concat(sp.hide):sp.show;
  const ix=a=>P.atts.findIndex(x=>x.name===a.name);
  const bodyHTML=P.html||'<pre style="white-space:pre-wrap;font:14px Segoe UI,Arial,sans-serif;margin:0">'+esc(P.text||'(this mail has no message)')+'</pre>';
  el.innerHTML='<div class="emltag" title="This is a mail that arrived as a file">'+ico('mail')+' Attached email (.eml)</div>'
   +'<h1 class="emlsub">'+esc(P.subject||'(no subject)')+'</h1>'
   +'<article class="mail emlcard"><header>'+av(who1)+'<div class="w"><b>'+esc(who1)+'</b><span>'+esc(addr||'')+'</span>'
   +(P.to?'<span class="olkto">To: '+esc(people(P.to))+'</span>':'')
   +(P.cc?'<span class="olkto">Cc: '+esc(people(P.cc))+'</span>':'')
   +'</div><time>'+when+'</time></header>'
   +'<div class="mbody">'
   +'<div class="raw"><iframe sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" title="'+esc(P.subject||name||'Attached mail')+'" data-pics="1" srcdoc="'+esc(picHTML(pm,emlSafe(bodyHTML)))+'"></iframe></div>'
   +(shown.length?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+shown.map(a=>'<span class="att" title="'+esc(a.name)+'">'+ico('clip')+' '+esc(a.name)+' <small style="color:var(--muted)">'+fsize(a.size)+'</small><button class="olkam" type="button" data-emlv="'+ix(a)+'" title="Open preview">\\u{1f441}</button><button class="olkam" type="button" data-emld="'+ix(a)+'" title="Download">\\u2b07</button></span>').join('')+'</div>':'')
   +(sp.hide.length?'<div class="attinl"><button type="button" class="lnk" data-'+(open?'atthide':'attshow')+'="'+esc(KEY)+'">'+(open?'Hide the '+sp.hide.length+' inline picture'+(sp.hide.length>1?'s':''):'\\u{1f5bc} Show hidden inline images ('+sp.hide.length+')')+'</button><small>pictures this mail already shows in its text</small></div>':'')
   +'</div></article>';
  try{fitFrames()}catch(e){}
  el.querySelectorAll('[data-emlv]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const a=P.atts[+b.dataset.emlv];if(a)cfView(emlFile(a))});
  el.querySelectorAll('[data-emld]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const a=P.atts[+b.dataset.emld];if(!a)return;const f=emlFile(a);saveFile(f,a.name,f.type)});
  el.querySelectorAll('[data-attshow],[data-atthide]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();
   window.rzShowInl=window.rzShowInl||{};
   if(b.hasAttribute('data-attshow'))window.rzShowInl[KEY]=true;else delete window.rzShowInl[KEY];draw()});
 };
 draw()}
(function(){const st=document.createElement('style');st.textContent=
 '.emltag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:3px 9px;margin:0 0 8px}'
 +'.emltag svg{width:13px;height:13px}'
 +'.emlsub{font-size:18px;font-weight:600;margin:0 0 6px;line-height:1.3;word-break:break-word}'
 +'.mail.emlcard{border:0;padding:0}'
 +'.mail.emlcard header{margin-bottom:6px}'
 +'.mail.emlcard .olkto{display:block;font-size:12px;color:var(--muted)}';
 document.head.appendChild(st)})();
window.rzEmlMount=emlMount;window.rzEmlIs=emlIs;window.rzEmlIsMsg=emlIsMsg;   /* mail-v2.js draws .eml with this */
`;
s = s.replace(OLD, NEW); n++;

/* the picture helper from the earlier patch is no longer used - pictures show */
sub(
`/* pictures from the internet in an attached mail: blocked until asked for, whoever sent it */
function emlPicHTML(pm,h){const out=picHTML(pm,h);
 if(pm.showPics||!hasRemote(h)||out.indexOf(PIC_CSP)>=0)return out;
 const hd=out.match(/<head\\b[^>]*>/i);return hd?out.replace(hd[0],hd[0]+PIC_CSP):PIC_CSP+out}
`,
``
);

/* ---------- (4) open a .eml that is already on the computer ---------- */
sub(
`window.rzEmlMount=emlMount;window.rzEmlIs=emlIs;window.rzEmlIsMsg=emlIsMsg;   /* mail-v2.js draws .eml with this */`,
`window.rzEmlMount=emlMount;window.rzEmlIs=emlIs;window.rzEmlIsMsg=emlIsMsg;
/* ---- 24 Nov 2026: a .eml on this computer, opened in the page itself (no upload, no Outlook) ---- */
function emlOpenLocal(file){
 if(!file)return;
 if(!emlIs(file.name,file.type)&&!emlIsMsg(file.name)){toast('That is not a mail file. Pick a .eml file.');return}
 emlOverlay(file)}
window.rzEmlOpenLocal=emlOpenLocal;
function emlPick(){
 const i=document.createElement('input');i.type='file';i.accept='.eml,.msg,message/rfc822';
 i.style.display='none';document.body.appendChild(i);
 i.onchange=()=>{const f=i.files&&i.files[0];i.remove();if(f)emlOpenLocal(f)};
 i.click()}
window.rzEmlPick=emlPick;
/* drag a .eml anywhere onto the window */
(function(){
 let bar=null;const show=on=>{
  if(on&&!bar){bar=document.createElement('div');bar.className='emldrop';bar.textContent='\\u{1f4e7} Drop the mail file here to open it';document.body.appendChild(bar)}
  else if(!on&&bar){bar.remove();bar=null}};
 const isFile=e=>!!e.dataTransfer&&[...(e.dataTransfer.types||[])].indexOf('Files')>=0;
 const inCompose=()=>!!document.querySelector('.cfwrap,.cdock,#cb');   /* compose has its own drop handling */
 addEventListener('dragover',e=>{if(!isFile(e)||inCompose())return;e.preventDefault();show(true)});
 addEventListener('dragleave',e=>{if(e.relatedTarget)return;show(false)});
 addEventListener('drop',e=>{
  if(!isFile(e)||inCompose())return;
  const f=[...(e.dataTransfer.files||[])].find(x=>emlIs(x.name,x.type)||emlIsMsg(x.name));
  show(false);if(!f)return;e.preventDefault();emlOpenLocal(f)});
 const st=document.createElement('style');st.textContent=
  '.emldrop{position:fixed;inset:auto 0 24px 0;margin:0 auto;width:fit-content;z-index:90;background:var(--blue,#0f6cbd);color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none}';
 document.head.appendChild(st)})();
/* the app can be told to open a file by the operating system (installed as an app) */
(function(){
 try{if(!('launchQueue' in window)||!window.LaunchParams)return;
  launchQueue.setConsumer(p=>{if(!p||!p.files||!p.files.length)return;
   p.files[0].getFile().then(f=>{const go=()=>emlOpenLocal(f);
    if(window.__liveReady)go();else setTimeout(go,1500)}).catch(()=>{})})}catch(e){}})();`
);

/* the menu under your own name gets the button */
sub(
  `<button id="mB">\\u{1F6E0} Report a problem</button>`,
  `<button id="mE">\\u{1f4e7} Open an .eml file</button><button id="mB">\\u{1F6E0} Report a problem</button>`
);
sub(
  ` $('#mP').onclick=()=>{$('#layer').innerHTML='';profileDlg()};`,
  ` if($('#mE'))$('#mE').onclick=()=>{$('#layer').innerHTML='';emlPick()};
 $('#mP').onclick=()=>{$('#layer').innerHTML='';profileDlg()};`
);

fs.writeFileSync(F, s);
console.log('email.html patched, ' + n + ' edits');
