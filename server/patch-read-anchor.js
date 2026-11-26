/* patch-read-anchor.js - 27 Nov 2026  (night plan, bug 3:
 *   "clicking a mail makes the screen jump down to Activity trail")
 *
 * MEASURED FIRST, in a real browser on a six-mail conversation: clicking a folded mail
 * moved that mail 715 px OFF THE TOP of the screen, leaving the reader looking at the
 * bottom of the pane - which is where the Activity trail sits.
 *
 * THE CAUSE is not the Activity trail at all. The reading pane kept its place across a
 * redraw by remembering a PIXEL OFFSET (`rb.scrollTop`) and setting it back afterwards -
 * but fitFrames() sizes every open mail by first setting its iframe to `height:20px` and
 * then measuring, and a rebuilt iframe has no document yet, so for a moment every open mail
 * is 20 px tall. The old pixel offset is then restored into a page that is hundreds of
 * pixels shorter, so it lands much further down the conversation. When the frames finish
 * loading and grow again, the scroll stays where it was put.
 *
 * THE FIX is to stop counting pixels and anchor to an ELEMENT: remember which mail (or
 * trail) was clicked and how far it sat below the top of the pane, and after the redraw put
 * that same element back at that same spot - again a few times while the frames settle.
 *
 *  1  the clicked mail stays exactly where it is                   raSet / raRestore / raPump
 *  2  only "View mail ↑" moves the screen, and only to that mail   RA_JUMP
 *  3  the Activity trail starts CLOSED and remembers its state     ATOPEN
 *  4  a poll never moves an open conversation; it shows a pill     newInOpenBanner
 *
 * Nothing here touches who may see a mail.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-read-anchor.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

let n = 0;
function one(mark, find, rep, why) {
  if (mark && s.indexOf(mark) >= 0) { console.log("already done: " + why); return; }
  const i = s.indexOf(find);
  if (i < 0) throw new Error("could not find the place for: " + why);
  if (s.indexOf(find, i + find.length) >= 0) throw new Error("found more than once: " + why);
  s = s.slice(0, i) + rep + s.slice(i + find.length);
  n++;
  console.log("  " + why);
}

/* ---- 3. the Activity trail starts closed, and gets an id to anchor to ---- */
one(
  "__atrail:",
  "return `<details class=\"atrail\" open><summary>",
  "return `<details class=\"atrail\" id=\"atrail-${t.id}\" ${/* __atrail: closed like Outlook - the reader opens it, and it stays open for this conversation */(typeof ATOPEN!=='undefined'&&ATOPEN[t.id])?'open':''}><summary>",
  "the Activity trail starts closed and carries an id"
);

/* ---- the block ---- */
const BLOCK = `
<script>/* __readanchor:start 27 Nov 2026 - server/patch-read-anchor.js */
/* ---------------------------------------------------------------- state --- */
let RA=null;              /* {id, top} - the element that must not move */
let RA_JUMP=false;        /* a "View mail ↑" jump is running - let it move the screen */
let RA_T=0;               /* the pump's deadline */
const ATOPEN={};          /* per conversation: is the Activity trail open? */
let PILL_N=0;             /* how many new mails have landed while this one is open */

const raBody=()=>document.querySelector('.rbody');
function raOff(el,rb){return el.getBoundingClientRect().top-rb.getBoundingClientRect().top}

/* remember an element and where it sits now */
function raSet(el){const rb=raBody();if(!rb||!el||!el.id)return;RA={id:el.id,top:raOff(el,rb)}}
/* nothing was clicked: keep whatever is at the top of the pane where it is */
function raAuto(){const rb=raBody();if(!rb)return;
 let best=null,bd=1e9;
 rb.querySelectorAll('[id^="msg-"],[id^="atrail-"]').forEach(e=>{const d=raOff(e,rb);if(d>=-48&&d<bd){bd=d;best=e}});
 RA=best?{id:best.id,top:bd}:null}
/* put it back where it was */
function raRestore(){const rb=raBody();if(!rb||!RA)return false;
 const el=document.getElementById(RA.id);if(!el)return false;
 const d=raOff(el,rb)-RA.top;
 if(Math.abs(d)>1){rb.scrollTop+=d;return true}
 return false}
/* an iframe only reports its height once it has loaded, and fitFrames shrinks it to 20px to
   measure - so the pane keeps changing height for a moment after the redraw. Re-anchor until
   it settles, and stop the moment the reader scrolls for themselves. */
function raPump(){RA_T=Date.now()+1500;
 const tick=()=>{if(!RA)return;
  if(Date.now()>RA_T){RA=null;return}        /* the anchor only lives while the pane settles */
  raRestore();requestAnimationFrame(tick)};
 requestAnimationFrame(tick)}
function raStop(){RA_T=0;RA=null}            /* the reader scrolled - their place wins from now on */
['wheel','touchmove','keydown'].forEach(ev=>document.addEventListener(ev,e=>{
 const rb=raBody();if(rb&&rb.contains(e.target))raStop()},{passive:true,capture:true}));

/* ------------------------------------------------- 1 · the redraw itself -- */
const _rrAnchor=renderRead;
renderRead=function(){
 if(!RA_JUMP&&!RA)raAuto();
 const r=_rrAnchor.apply(this,arguments);
 if(!RA_JUMP){try{raRestore();raPump()}catch(e){}}
 /* RA is NOT cleared here: the pump owns it until the frames have settled (that was a real
    bug - clearing it here killed the pump on its first tick, so the late iframe growth was
    never corrected and the mail still slid down the screen). */
 return r};

/* a different conversation starts at the top, with nothing remembered */
const _opAnchor=open;
open=function(id){if(id!==openId){RA=null;RA_JUMP=false;PILL_N=0;const p=document.querySelector('.newpill');if(p)p.remove()}return _opAnchor.apply(this,arguments)};

/* ------------------------------------------- 1 + 2 · what a click means --- */
/* capture phase, so the anchor is taken BEFORE the app redraws anything */
document.addEventListener('click',function(e){
 const rb=raBody();if(!rb)return;
 const read=document.getElementById('read');if(!read||!read.contains(e.target))return;
 /* 2 · "View mail ↑" is the one thing allowed to move the screen */
 if(e.target.closest&&e.target.closest('[data-jump]')){RA=null;RA_JUMP=true;raStop();
  setTimeout(()=>{RA_JUMP=false},1200);return}
 /* "Show all N mails" / "Collapse all": hold the top of the conversation still */
 if(e.target.closest&&e.target.closest('[data-mall]')){const first=rb.querySelector('article.mail');if(first)raSet(first);return}
 /* a mail, the Activity trail, or a mail trail inside one */
 const el=e.target.closest&&e.target.closest('article.mail,details.atrail,details.trail');
 if(el){if(el.id)raSet(el);
  else{const art=el.closest('article.mail');if(art&&art.id)raSet(art)}}
},true);

/* ------------------------------------------------ 3 · the Activity trail -- */
/* "toggle" does not bubble, so it is caught in the capture phase */
document.addEventListener('toggle',function(e){
 const d=e.target;if(!d||!d.classList||!d.classList.contains('atrail'))return;
 if(openId)ATOPEN[openId]=d.open;
},true);

/* ------------------------------------------------------- 4 · the pill ----- */
/* The 15-second poll must never move an open conversation. It did not redraw it before and
   it does not now - it puts a small pill in the corner, the way Outlook does. */
newInOpenBanner=function(){
 const read=document.getElementById('read');if(!read)return;
 const old=read.querySelector('.newbar');if(old)old.remove();
 PILL_N++;
 let p=read.querySelector('.newpill');
 if(!p){p=document.createElement('button');p.className='btn newpill';p.type='button';read.appendChild(p);
  p.onclick=function(){
   const t=(typeof T_==='function')&&T_(openId);p.remove();PILL_N=0;
   if(!t)return;
   (openMsgs[t.id]=openMsgs[t.id]||new Set()).add(t.msgs.length-1);
   RA=null;RA_JUMP=true;raStop();
   renderRead();
   setTimeout(function(){try{
    const rb=raBody(),el=document.getElementById('msg-'+t.id+'-'+(t.msgs.length-1));
    if(rb&&el){rb.scrollTop+=raOff(el,rb)-8;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}
   }catch(e){}finally{RA_JUMP=false}},0);
  };
 }
 p.innerHTML=PILL_N+' new mail'+(PILL_N>1?'s':'')+' \\u2193';
 p.title='Jump to the newest mail in this conversation';
};

/* ------------------------------------------------------------------ CSS --- */
(function raCSS(){
 if(document.getElementById('raCSS'))return;
 const st=document.createElement('style');st.id='raCSS';
 st.textContent=[
  '#read{position:relative}',
  '.newpill{position:absolute;right:18px;bottom:18px;z-index:40;border-radius:99px;padding:7px 14px;',
  ' font-size:12.5px;font-weight:700;background:var(--blue,#2b6cb0);color:#fff;border-color:transparent;',
  ' box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:pointer}',
  '.newpill:hover{filter:brightness(1.07)}',
  '@media (max-width:620px){.newpill{right:12px;bottom:72px}}'
 ].join('');
 document.head.appendChild(st);
})();
/* __readanchor:end */</script>
`;
const a = s.indexOf("<script>/* __readanchor:start");
if (a >= 0) {
  const b = s.indexOf("/* __readanchor:end */</scr" + "ipt>", a);
  if (b < 0) throw new Error("the old __readanchor block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + ("/* __readanchor:end */</scr" + "ipt>").length);
  console.log("  replaced the existing block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("  block appended");
}

fs.writeFileSync(F, s);
console.log(n + " edit(s) + the block. written to " + F);
