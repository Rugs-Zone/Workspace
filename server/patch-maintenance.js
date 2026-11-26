/* patch-maintenance.js — 26 Nov 2026
 *
 * "Close mail for all user for preview apart from me and start countdown for all user as of
 *  now for 20 min that mail is going for under maintenance within 20 minutes"
 * "If I have to switch there id than i can see that"
 *
 * WHAT IT DOES
 *   - from now until 18:52 IST every person sees a red countdown bar at the top of Rugs
 *     Email: "goes under maintenance in 12:34 — send or save what you are writing";
 *   - at 18:52 everyone except the people below gets a full-screen maintenance notice
 *     instead of the app;
 *   - WHO KEEPS ACCESS: Priyanshu (id 'adm' / a marketing@ login), ANY switched session
 *     (Admin -> Switch ID, which only he can start - so working as Ashok still works), and
 *     anyone who has set the escape hatch in the browser console:
 *         localStorage.setItem('rugs-maint-ok','1')
 *     That hatch exists so a wrong id in this list can never lock him out of his own app.
 *
 * NOTHING IS LOST when it locks: compose auto-saves to Drafts every 5 seconds, and the
 * 20-minute bar is the warning. The polling timer is stopped behind the notice so the
 * locked pages stop asking the server for mail.
 *
 * TO END THE MAINTENANCE: set MAINT_OFF to true below (or move MAINT_FROM), run this patch
 * again, re-encode and bump APP_BUILD + mail-version.txt - every open page comes back by
 * itself within a minute.
 *
 * Run:  node server/mailapp-b64.js decode
 *       node server/patch-maintenance.js
 *       node server/mailapp-b64.js encode
 */
const fs = require("fs");
const path = require("path");

/* ---- set these two to end it ---- */
const MAINT_OFF = false;
const MAINT_FROM  = 1795699357493;       /* 26 Nov 2026 18:52 IST - it locks */
const MAINT_UNTIL = 1795752000000;       /* 27 Nov 2026 09:30 IST - it opens again BY ITSELF */
const MAINT_LABEL = "18:52";
const MAINT_BACK = "9:30 tomorrow morning";

const F = path.join(__dirname, "..", ".tmp", "email.html");
let s = fs.readFileSync(F, "utf8");

const BLOCK = `
<script>/* __maint:start 26 Nov 2026 — maintenance window. server/patch-maintenance.js */
const MAINT_OFF=${MAINT_OFF};
const MAINT_FROM=${MAINT_FROM};
const MAINT_UNTIL=${MAINT_UNTIL};
const MAINT_LABEL='${MAINT_LABEL}';
const MAINT_BACK='${MAINT_BACK}';
const MAINT_IDS=['adm'];

/* who keeps working: Priyanshu, any switched session (only he can start one), and the
   escape hatch localStorage['rugs-maint-ok']='1' */
function maintMe(){
 try{
  if(localStorage.getItem('rugs-maint-ok')==='1')return true;
  if(typeof swOn==='function'&&swOn())return true;
  if(MAINT_IDS.indexOf(ME)>=0)return true;
  const p=(typeof who==='function'&&who(ME))||{};
  if(/^marketing@/i.test(String(p.login||'')))return true;
 }catch(e){}
 return false;
}
function maintLeft(){return MAINT_FROM-Date.now()}
function maintOn(){return !MAINT_OFF&&maintLeft()<=0&&Date.now()<MAINT_UNTIL}

(function(){
 const st=document.createElement('style');
 st.textContent=
 '#maintBar{position:fixed;left:0;right:0;top:0;z-index:99998;background:#b3200f;color:#fff;'+
 'font:600 13.5px/1.35 "Segoe UI",system-ui,sans-serif;padding:9px 14px;text-align:center;'+
 'box-shadow:0 1px 6px rgba(0,0,0,.25)}'+
 '#maintBar b{font-variant-numeric:tabular-nums}'+
 '#maintBar .ok{font-weight:400;opacity:.9}'+
 'body.maintbar{padding-top:34px}'+
 '#maintWrap{position:fixed;inset:0;z-index:99999;background:#0b0b0c;color:#f2f2f3;display:flex;'+
 'align-items:center;justify-content:center;padding:24px;'+
 'font:400 15px/1.55 "Segoe UI",system-ui,sans-serif}'+
 '#maintWrap .card{max-width:460px;text-align:center}'+
 '#maintWrap h2{font:600 22px/1.25 "Segoe UI",system-ui,sans-serif;margin:0 0 10px}'+
 '#maintWrap p{margin:0 0 10px;color:#c9c9cc}'+
 '#maintWrap .ic{font-size:34px;margin-bottom:10px}'+
 '#maintWrap .sm{font-size:13px;color:#8e8e93;margin-top:16px}';
 document.head.appendChild(st);
})();

function maintPaint(){
 try{
  if(MAINT_OFF){const a=document.getElementById('maintBar'),b=document.getElementById('maintWrap');
   if(a)a.remove();if(b)b.remove();document.body.classList.remove('maintbar');return}
  const signedIn=!!(typeof ME!=='undefined'&&ME);
  const left=maintLeft(),mine=maintMe();

  /* the lock */
  let w=document.getElementById('maintWrap');
  if(signedIn&&maintOn()&&!mine){
   if(!w){
    w=document.createElement('div');w.id='maintWrap';w.setAttribute('role','alertdialog');
    w.innerHTML='<div class="card"><div class="ic">🛠️</div>'+
     '<h2>Rugs Email is under maintenance</h2>'+
     '<p>We are making the changes that were agreed today. Rugs Email opens again <b>'+MAINT_BACK+'</b>.</p>'+
     '<p>Nothing of yours is lost — anything you were writing was saved in <b>Drafts</b>, and no mail stops arriving.</p>'+
     '<div class="sm">Closed at '+MAINT_LABEL+' this evening. This page opens again by itself — you do not have to do anything.</div></div>';
    document.body.appendChild(w);
   }
   try{if(typeof pollT!=='undefined'&&pollT)clearInterval(pollT)}catch(e){}
   return;                                  /* locked: no countdown bar needed */
  }
  if(w)w.remove();

  /* the countdown */
  let bar=document.getElementById('maintBar');
  if(signedIn&&left>0){
   if(!bar){bar=document.createElement('div');bar=Object.assign(bar,{id:'maintBar'});
    bar.setAttribute('role','status');document.body.appendChild(bar);}
   const m=Math.floor(left/60000),sec=Math.floor((left%60000)/1000);
   const t=m+':'+String(sec).padStart(2,'0');
   bar.innerHTML='⚠️ Rugs Email goes under maintenance at '+MAINT_LABEL+' — <b>'+t+'</b> left. '+
    'Please send or save what you are writing — it stays closed until '+MAINT_BACK+'.'+
    (mine?' <span class="ok">(you keep access)</span>':'');
   document.body.classList.add('maintbar');
  }else{
   if(bar)bar.remove();
   document.body.classList.remove('maintbar');
  }
 }catch(e){}
}

const _rdMaint=render;
render=function(){const r=_rdMaint.apply(this,arguments);try{maintPaint()}catch(e){}return r};
try{setInterval(maintPaint,1000)}catch(e){}
try{maintPaint()}catch(e){}
/* __maint:end */</script>
`;

/* replace an earlier block if one is there, so this is safe to run again */
const a = s.indexOf("<script>/* __maint:start");
if (a >= 0) {
  const b = s.indexOf("/* __maint:end */</script>", a);
  if (b < 0) throw new Error("the old __maint block has no end marker");
  s = s.slice(0, a) + BLOCK.trim() + s.slice(b + "/* __maint:end */</script>".length);
  console.log("replaced the existing maintenance block");
} else {
  s = s.replace(/\s*$/, "") + "\n" + BLOCK;
  console.log("maintenance block appended");
}

fs.writeFileSync(F, s);
console.log("MAINT_OFF=" + MAINT_OFF + "  at " + MAINT_LABEL + " IST  (" + MAINT_FROM + ")");
console.log("written to " + F);
