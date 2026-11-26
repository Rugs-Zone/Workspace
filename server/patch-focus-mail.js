/* patch-focus-mail.js - 27 Nov 2026  (night plan, bug 7:
 *   "clicking the Ashok 5:08 pm row opens the conversation with Mia's 5:20 pm reply on top")
 *
 * R17 is LOCKED: one row per mail. Clicking a row already EXPANDED that mail, but the
 * reading pane still drew the whole conversation newest-first, so a mail that arrived
 * AFTER the one you clicked sat above it - and on a short exchange that newer mail is
 * what you read first. That breaks the rule the row promises.
 *
 * From now on, when a conversation is opened from a per-mail row (data-mi / WANT_MI):
 *   1  the clicked mail is the main mail - first on the page and expanded
 *   2  below it, ONLY older mails, newest first going down (unchanged)
 *   3  mails NEWER than the clicked one are folded behind one thin bar at the top:
 *      "N newer mail(s) in this conversation - <sender> <time> ^" - click it and they
 *      come back above, exactly where they belong
 *   4  Reply / Reply all / Forward / Forward as attachment answer the CLICKED mail:
 *      the quote stops at it, Reply goes to its sender, Reply all takes its Cc, and a
 *      forward offers its files - nothing newer is quoted or attached
 *
 * Opening a conversation ANY OTHER WAY is untouched - a search hit, a link, a bell
 * notification, "Show all N mails" and "Collapse all" all have no focus, so the pane is
 * exactly what it is today (the newest three bodies open).
 *
 * It works for an R8m "Sent by <name>" row and in Sent, because those rows carry _mi too.
 *
 * All of it is a layer ON TOP: nothing in _renderRead, compose or sendReply is rewritten,
 * so every other rule and wrapper is untouched.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-focus-mail.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

/* the app must already have the pieces this leans on */
["let WANT_MI=null;", "data-mtog=", "function trailOf(", "function allCc(", "function origAtts(", "function fwdAsAtt("]
  .forEach(k => { if (s.indexOf(k) < 0) throw new Error("the app does not contain: " + k); });

const END = "/* __focusmail:end */</scr" + "ipt>";

const BLOCK = `
<script>/* __focusmail:start 27 Nov 2026 - server/patch-focus-mail.js (bug 7) */
/* R17 says a row is one mail. So a row must open THAT mail as the main mail: it sits first
   and expanded, only OLDER mails are listed below it, and anything NEWER in the conversation
   waits behind one thin bar at the top. Opened any other way there is no focus at all, and
   the pane is exactly what it was. */
let FOC=null;                                   /* {id, mi, show} - only ever one */
function focusMi(t){try{
 if(!t||!FOC||FOC.id!==t.id||FOC.show)return null;
 if(!t.msgs||!t.msgs[FOC.mi])return null;
 return FOC.mi;
}catch(e){return null}}

/* 1 · which mail was clicked? __rowmail has already put it in WANT_MI (capture phase), and
   it does not clear it until the app's own open() runs underneath us. */
const _openFoc=open;
open=function(id){
 let mi=null;
 try{if(typeof WANT_MI!=='undefined'&&WANT_MI&&WANT_MI.id===id)mi=WANT_MI.mi}catch(e){}
 try{
  const t=T_(id);
  FOC=(t&&mi!=null&&t.msgs&&t.msgs[mi])?{id:id,mi:mi,show:false}:null;   /* no row, no focus */
 }catch(e){FOC=null}
 return _openFoc.apply(this,arguments)};

/* which mail is in focus is part of what the reading pane shows, so it belongs in
   __readspeed's own key: a focus change redraws the pane, and nothing else does. Forcing
   the redraw by hand on every open() instead re-created every iframe in the pane and moved
   the screen under the reader - test-read-anchor caught exactly that. */
const _rkFoc=readKey;
readKey=function(){
 let k='';try{k=FOC?(FOC.id+':'+FOC.mi+':'+(FOC.show?1:0)):''}catch(e){}
 return _rkFoc.apply(this,arguments)+'|foc'+k};

/* 3 · the bar, and the newer mails folded behind it. Done on the drawn pane, so nothing in
   _renderRead changes and every other wrapper keeps working. It is idempotent: everything
   is put back first, then folded again. */
function focusPaint(){
 const rb=document.querySelector('#read .rbody');if(!rb)return;
 rb.querySelectorAll('.fmbar').forEach(n=>n.remove());
 const arts=[].slice.call(rb.querySelectorAll('article.mail[data-mtog]'));
 arts.forEach(a=>{if(a.getAttribute('data-fmhid')){a.removeAttribute('data-fmhid');a.hidden=false;a.style.display=''}});
 const t=openId&&T_(openId);if(!t)return;
 const mi=focusMi(t);if(mi==null)return;
 let me=null;const newer=[];
 arts.forEach(a=>{const i=+a.getAttribute('data-mtog');if(i===mi)me=a;else if(i>mi)newer.push(a)});
 if(!me||!newer.length)return;
 newer.forEach(a=>{a.setAttribute('data-fmhid','1');a.hidden=true;a.style.display='none'});
 const top=t.msgs[t.msgs.length-1]||{},n=newer.length;
 const when=(typeof rowTime==='function'&&top.at)?rowTime(top.at):'';
 const bar=document.createElement('button');
 bar.type='button';bar.className='fmbar';bar.setAttribute('data-fmshow','1');
 bar.title='These arrived after the mail you opened. Click to show them above.';
 bar.innerHTML='<b>'+n+' newer mail'+(n>1?'s':'')+'</b> in this conversation \\u00b7 <span>'
  +esc(top.from||'')+' '+esc(when)+'</span> <i>\\u2191</i>';
 me.insertAdjacentElement('beforebegin',bar);
}
const _rrFoc=renderRead;
renderRead=function(){
 const r=_rrFoc.apply(this,arguments);
 try{focusPaint()}catch(e){}
 /* mail-v2.js and the Outlook pack decorate the pane after us; paint once more so their
    redraw can never leave a newer mail on top. It costs nothing when there is no focus. */
 try{if(FOC)setTimeout(()=>{try{focusPaint();fitFrames()}catch(e){}},0)}catch(e){}
 return r};

/* pressing the bar: the newer mails come back above, and the reader keeps their place */
document.addEventListener('click',e=>{
 let b=null;try{b=e.target&&e.target.closest&&e.target.closest('[data-fmshow]')}catch(x){}
 if(!b)return;
 e.preventDefault();e.stopPropagation();
 const mi=FOC?FOC.mi:null,id=FOC?FOC.id:null;
 if(FOC)FOC.show=true;
 try{renderRead()}catch(x){}
 if(id!=null&&mi!=null)setTimeout(()=>{try{
  const a=document.getElementById('msg-'+id+'-'+mi),box=a&&a.closest('.rbody');
  if(!a||!box)return;
  let y=0,nd=a;while(nd&&nd!==box){y+=nd.offsetTop;nd=nd.offsetParent}
  if(nd!==box)y=a.offsetTop-box.offsetTop;
  box.scrollTo({top:Math.max(0,y-12),behavior:'auto'});
 }catch(x){}},40);
},true);

/* "Show all N mails" / "Collapse all" mean the WHOLE conversation, so they drop the focus;
   and jumping to a newer mail from the Activity trail must not land on a hidden mail. */
document.addEventListener('click',e=>{try{
 const el=e.target;if(!el||!el.closest)return;
 if(el.closest('[data-mall]')){if(FOC)FOC.show=true;return}
 const j=el.closest('[data-jump]');
 if(j&&FOC&&j.dataset.jump){const d=j.dataset.jump,k=d.lastIndexOf('-'),mi=+d.slice(k+1);
  if(String(idv(d.slice(0,k)))===String(FOC.id)&&mi>FOC.mi)FOC.show=true}
}catch(x){}},true);

/* 4 · Reply / Reply all / Forward answer the CLICKED mail --------------------- */
/* the quote stops at it (trailOf feeds the editor, the per-mail tickboxes and sendReply) */
const _trailFoc=trailOf;
trailOf=function(t,upto){
 try{if(upto==null){const mi=focusMi(t);if(mi!=null&&mi<(t.msgs||[]).length-1)upto=mi+1}}catch(e){}
 return _trailFoc.call(this,t,upto)};
/* Reply all takes that mail's own To/Cc, not every address in the conversation */
const _ccFoc=allCc;
allCc=function(t){
 try{
  const mi=focusMi(t);
  if(mi!=null&&mi<(t.msgs||[]).length-1){
   const m=t.msgs[mi],own=new Set([String(m.email||'').toLowerCase()]),out=[];
   [].concat(String(m.to||'').match(ADR_RX)||[],String(m.cc||'').match(ADR_RX)||[]).forEach(a=>{
    a=String(a||'').toLowerCase();
    if(!a||own.has(a)||a.endsWith('@'+DOMAIN))return;own.add(a);out.push(a)});
   return out.join(', ');
  }
 }catch(e){}
 return _ccFoc.apply(this,arguments)};
/* a forward offers that mail's files, not a newer mail's */
const _oaFoc=origAtts;
origAtts=function(t){
 const out=_oaFoc.apply(this,arguments);
 try{const mi=focusMi(t);if(mi!=null)return out.filter(a=>a&&a.mi<=mi)}catch(e){}
 return out};
/* Reply goes to the person who wrote the mail you clicked (when it came from outside) */
const _cmpFoc=compose;
compose=function(o){
 try{
  if(o&&o.t&&!o.fwd&&!o.asAtt&&o.to==null){
   const mi=focusMi(o.t),m=mi!=null?o.t.msgs[mi]:null;
   if(m&&!(m.by||m.ours)&&m.email)o=Object.assign({},o,{to:m.email});
  }
 }catch(e){}
 return _cmpFoc.call(this,o)};
/* Forward as attachment sends the clicked mail as the .eml, not the newest one */
const _faFoc=fwdAsAtt;
fwdAsAtt=function(t){
 try{
  const mi=focusMi(t);
  if(mi!=null&&mi<(t.msgs||[]).length-1){
   const m=t.msgs[mi];let f;
   try{const nm=(String(cleanSub(t.sub)||'mail').replace(/[^A-Za-z0-9 ._-]+/g,' ').trim().slice(0,60)||'mail')+'.eml';
    f=new File([emlText(t,m)],nm,{type:'message/rfc822'})}
   catch(e){toast('This browser cannot build the .eml file');return}
   compose({t:t,fwd:true,asAtt:true,to:'',sub:'Fwd: '+(cleanSub(t.sub)||'(no subject)'),files:[f]});
   const miss=(m.atts||[]).map(a=>a&&a.name).filter(Boolean);
   if(miss.length)setTimeout(()=>toast('The mail itself is attached. Its own '+miss.length+' file'+(miss.length>1?'s':'')+' are not inside it - attach them separately if they are needed.'),900);
   return}
 }catch(e){}
 return _faFoc.apply(this,arguments)};

/* ------------------------------------------------------------------ CSS --- */
(function fmCSS(){
 if(document.getElementById('fmCSS'))return;
 const st=document.createElement('style');st.id='fmCSS';
 st.textContent=[
  '.fmbar{display:flex;align-items:center;gap:6px;width:100%;text-align:left;margin:2px 0 8px;',
  'padding:7px 10px;border:1px solid var(--line);border-radius:7px;background:var(--pane);',
  'color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer}',
  '.fmbar b{color:var(--fg);font-weight:700}',
  '.fmbar:hover{border-color:var(--brand)}',
  '.fmbar i{margin-left:auto;font-style:normal;font-weight:700}',
  'article.mail[data-fmhid]{display:none!important}'
 ].join('');
 document.head.appendChild(st);
})();
${END}
`;

const a = s.indexOf("<script>/* __focusmail:start");
if (a >= 0) {
  const b = s.indexOf(END, a);
  if (b < 0) throw new Error("the old __focusmail block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + END.length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

fs.writeFileSync(F, s);
console.log("written to " + F);
