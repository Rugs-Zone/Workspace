/* 27 Nov 2026 - bug 14: classic-blue UI polish for Rugs Email.
   ONLY the header, the footer, the LEFT folder pane and the RIGHT reading pane.
   The centre mail list is deliberately NOT touched, and no rule, ownership,
   folder, count or server behaviour changes.
     colours  header #0F6CBD with white text - left pane + footer #F5F5F5 -
              selected folder #DCEBFA with a 3px #0F6CBD left bar - lines #E1E1E1 -
              Reply #0F6CBD - New mail #FF5000 (dark mode keeps its own palette)
     header   every existing control stays, in the same order; the search box gains
              "All mailboxes / This folder"; Sync reads "Send / Receive" and its icon
              spins while syncing; equal icon size; every control has a tooltip;
              on a phone text size + full screen move into one "..." menu
     reader   subject 19px, one tidy toolbar, each mail inside a white card
     footer   "Items - Unread" on the left, "* Connected - All folders are up to
              date - HH:MM" on the right
   Run: node server/mailapp-b64.js decode && node server/patch-ui-14.js && node server/mailapp-b64.js encode
   Safe to run twice: it refuses once its own marker is in the file. */
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('__ui14:start')) { console.log('already applied - nothing to do'); process.exit(0); }

function one(find, repl, what) {
  const i = s.indexOf(find);
  if (i < 0) { console.error('NOT FOUND: ' + what); process.exit(1); }
  if (s.indexOf(find, i + 1) >= 0) { console.error('FOUND TWICE: ' + what); process.exit(1); }
  s = s.slice(0, i) + repl + s.slice(i + find.length);
  console.log('ok  ' + what);
}

/* (1) the Sync button becomes "Send / Receive". The SVG is kept, because ".ib.spin svg"
       is what spins while a sync is running. */
one(
  '<button class="ib sm" id="syncBtn" title="Sync inbox and sent now" aria-label="Sync">',
  '<button class="ib sm sr" id="syncBtn" title="Send / Receive — check for new mail now" aria-label="Send and receive">',
  '(1) #syncBtn -> "Send / Receive" (button)');

one(
  '<path d="M21 4v5h-5M3 20v-5h5"/></svg></button>\n    <span class="zoomc"',
  '<path d="M21 4v5h-5M3 20v-5h5"/></svg><span class="srl">Send / Receive</span></button>\n    <span class="zoomc"',
  '(1) #syncBtn -> "Send / Receive" (label)');

/* (2) the Outlook pack's own reading-pane bar (Quick steps / Read aloud / Immersive)
       sat ABOVE the subject. It now sits under the toolbar, so the reading pane reads
       subject -> one toolbar -> the mail. */
one(
  '    el.insertBefore(bar, el.firstChild);',
  "    const _u14top = el.querySelector('.rtop');   /* __ui14: under the subject, not above it */\n"
  + '    if (_u14top && _u14top.nextSibling) el.insertBefore(bar, _u14top.nextSibling);\n'
  + '    else if (_u14top) el.appendChild(bar);\n'
  + '    else el.insertBefore(bar, el.firstChild);',
  '(2) .olbar sits under the subject, not above it');

/* ------------------------------------------------------------------ block -- */
const BLOCK = [
  '',
  '<script>/* __ui14:start  27 Nov 2026 (bug 14): classic-blue chrome - header, footer, left',
  ' * folder pane, reading pane. The centre mail list is NOT touched. No rule, no ownership,',
  ' * no count and no server change. server/patch-ui-14.js */',
  '(function(){',
  ' var CSS=[',
  '  /* one place for the colours, so light and dark are both deliberate */',
  '  ":root{--u14hdr:#0F6CBD;--u14side:#F5F5F5;--u14sel:#DCEBFA;--u14selfg:#0C5696;--u14line:#E1E1E1;--u14blue:#0F6CBD;--u14nm:#FF5000;--u14ground:#FAFAFA;--u14card:#FFFFFF;--u14ftfg:#44403b;--u14logo:#FFE8DA}",',
  '  "@media (prefers-color-scheme:dark){:root:not([data-theme=\\"light\\"]){--u14hdr:#0d3f6b;--u14side:#1b1918;--u14sel:#17324e;--u14selfg:#a8ccf0;--u14line:#2a2624;--u14blue:#2f6fe0;--u14nm:#ff5a12;--u14ground:#0d0c0c;--u14card:#161414;--u14ftfg:#9c948e;--u14logo:#ffd2b8}}",',
  '  ":root[data-theme=\\"dark\\"]{--u14hdr:#0d3f6b;--u14side:#1b1918;--u14sel:#17324e;--u14selfg:#a8ccf0;--u14line:#2a2624;--u14blue:#2f6fe0;--u14nm:#ff5a12;--u14ground:#0d0c0c;--u14card:#161414;--u14ftfg:#9c948e;--u14logo:#ffd2b8}",',
  '  /* ---- header ---- */',
  '  "header.top{background:var(--u14hdr)!important;color:#fff!important}",',
  '  "header.top .logo em{color:var(--u14logo)!important}",',
  '  "header.top .search{background:#ffffff26!important;border-color:#ffffff4d!important}",',
  '  "header.top .search input::placeholder{color:#ffffffcc!important}",',
  '  "header.top .ib:hover,header.top .hamb:hover,header.top .me:hover{background:#ffffff2e!important}",',
  '  "header.top .ib,header.top .ib.sm,header.top .hamb{width:36px;height:36px}",',
  '  "header.top .ib.sr{width:auto;min-width:36px;padding:0 11px;border-radius:999px;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700}",',
  '  "header.top .ib.sr .srl{white-space:nowrap}",',
  '  "@media (max-width:1180px){header.top .ib.sr .srl{display:none}header.top .ib.sr{width:36px;padding:0}}",',
  '  "#qscope{flex:none;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:#fff;background:#ffffff2b;border:1px solid #ffffff4d;border-radius:999px;padding:4px 9px;white-space:nowrap;cursor:pointer}",',
  '  "#qscope:hover{background:#ffffff40}",',
  '  "#hdrMore{display:none}",',
  '  "@media (max-width:760px){header.top .zoomc,header.top #fsBtn{display:none!important}#hdrMore{display:grid!important}#qscope{font-size:11.5px;padding:3px 7px}}",',
  '  /* the one small menu the search scope and the phone button both use */',
  '  ".u14menu{position:fixed;z-index:95;min-width:210px;max-width:300px;background:var(--pane);color:var(--fg);border:1px solid var(--u14line);border-radius:12px;box-shadow:var(--shadow);padding:6px;display:flex;flex-direction:column;gap:2px}",',
  '  ".u14menu button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:9px 10px;border-radius:8px;font-size:13.5px;font-weight:600;color:var(--fg);min-height:40px}",',
  '  ".u14menu button:hover{background:var(--hover)}",',
  '  ".u14menu button[aria-checked=\\"true\\"]{background:var(--u14sel);color:var(--u14selfg)}",',
  '  ".u14menu h6{margin:5px 8px 2px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700}",',
  '  /* ---- left folder pane ---- */',
  '  ".folders,.rail{background:var(--u14side)!important;border-right:1px solid var(--u14line)!important}",',
  '  ".fi{border-left:3px solid transparent;padding-left:7px}",',
  '  ".fi[aria-current=\\"true\\"]{background:var(--u14sel)!important;color:var(--u14selfg)!important;border-left-color:var(--u14blue)!important}",',
  '  ".fi[aria-current=\\"true\\"] .c,.fi[aria-current=\\"true\\"] .c.hot{color:var(--u14selfg)!important}",',
  '  ".fi[aria-current=\\"true\\"]+.fdel{color:var(--u14selfg)!important}",',
  '  ".newmail{background:var(--u14nm)!important;box-shadow:0 4px 14px rgba(255,80,0,.30)!important}",',
  '  ".fab{background:var(--u14nm)!important}",',
  '  /* ---- right reading pane ---- */',
  '  "#read .rtop{border-bottom:1px solid var(--u14line)!important}",',
  '  "#read .rtop h1{font-size:19px!important;line-height:1.3}",',
  '  "#read .acts:not(.xacts){background:var(--u14side);border:1px solid var(--u14line);border-radius:10px;padding:6px;gap:4px;align-items:center}",',
  '  "#read .acts:not(.xacts) .btn:not(.pri):not(.ok):not(.vio){background:transparent;border-color:transparent}",',
  '  "#read .acts:not(.xacts) .btn:not(.pri):not(.ok):not(.vio):hover{background:var(--pane);border-color:var(--u14line)}",',
  '  "#read .btn.pri{background:var(--u14blue)!important;border-color:var(--u14blue)!important;color:#fff!important}",',
  '  "#read .olbar{background:var(--u14side)!important;border-bottom:1px solid var(--u14line)!important}",',
  '  "#read .rbody{background:var(--u14ground)!important}",',
  '  "#read .rbody>article.mail{background:var(--u14card)!important;border:1px solid var(--u14line)!important;border-radius:10px;padding:14px 16px!important;margin-bottom:12px}",',
  '  "#read .rbody>article.mail.collapsed{padding:10px 14px!important}",',
  '  /* ---- footer ---- */',
  '  ".stbar{background:var(--u14side)!important;border-top:1px solid var(--u14line)!important;color:var(--u14ftfg)!important;height:28px;gap:8px}",',
  '  ".stbar b{color:var(--fg)!important}",',
  '  ".stbar .stleft{order:0}.stbar .stgrow{order:1}.stbar .stprog{order:2}",',
  '  ".stbar .stdot{order:3;margin-left:2px}.stbar .stmsg{order:4;padding-left:2px}"',
  ' ].join("\\n");',
  ' var put=function(){var st=document.getElementById("ui14css");if(!st){st=document.createElement("style");st.id="ui14css"}st.textContent=CSS;document.head.appendChild(st)};',
  ' put();setTimeout(put,2200);setTimeout(put,6200);',
  '})();',
  '',
  '/* ---------------- the small menu both new controls use ---------------- */',
  'function u14close(){var m=document.getElementById("u14menu");if(m)m.remove()}',
  'function u14menu(anchor,items){',
  ' u14close();',
  ' var m=document.createElement("div");m.className="u14menu";m.id="u14menu";m.setAttribute("role","menu");',
  ' items.forEach(function(it){',
  '  if(it.h){var h=document.createElement("h6");h.textContent=it.h;m.appendChild(h);return}',
  '  var b=document.createElement("button");b.type="button";b.setAttribute("role","menuitem");b.textContent=it.t;',
  '  if(it.on!=null)b.setAttribute("aria-checked",String(!!it.on));',
  '  if(it.title)b.title=it.title;',
  '  b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();u14close();try{it.fn()}catch(err){}});',
  '  m.appendChild(b)});',
  ' document.body.appendChild(m);',
  ' var r=anchor.getBoundingClientRect(),w=m.offsetWidth,h2=m.offsetHeight;',
  ' var left=Math.max(8,Math.min(r.left,innerWidth-w-8)),top=r.bottom+6;',
  ' if(top+h2>innerHeight-8)top=Math.max(8,r.top-h2-6);',
  ' m.style.left=left+"px";m.style.top=top+"px";',
  ' var f=m.querySelector("button");if(f)try{f.focus()}catch(e){}',
  ' return m}',
  'document.addEventListener("click",function(e){if(!e.target.closest("#u14menu,#qscope,#hdrMore"))u14close()},true);',
  'document.addEventListener("keydown",function(e){if(e.key==="Escape")u14close()});',
  'addEventListener("resize",u14close);',
  '',
  '/* ---------------- 1 - the search scope: All mailboxes / This folder ----------------',
  '   "All mailboxes" is what the app has always done, so it is the default and nothing',
  '   changes unless somebody picks "This folder". It narrows a SEARCH only - it is never',
  '   asked when the box is empty, so no folder, count or ownership rule is involved. */',
  'let U14SCOPE="all";',
  'function u14hasQ(){try{var q=document.getElementById("q");return !!(q&&String(q.value||"").trim())}catch(e){return false}}',
  'function u14scopeSync(){',
  ' var q=document.getElementById("q");if(!q||!q.parentNode)return null;',
  ' var b=document.getElementById("qscope");',
  ' if(!b){b=document.createElement("button");b.id="qscope";b.type="button";b.setAttribute("aria-haspopup","menu");',
  '  q.parentNode.appendChild(b);',
  '  b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();',
  '   u14menu(b,[{h:"Search in"},',
  '    {t:"This folder",on:U14SCOPE==="folder",title:"Only the mailbox and folder you are looking at",fn:function(){u14setScope("folder")}},',
  '    {t:"All mailboxes",on:U14SCOPE==="all",title:"Every mailbox you are allowed to see",fn:function(){u14setScope("all")}}])})}',
  ' b.title="Where to search: "+(U14SCOPE==="all"?"every mailbox you can see":"only this folder")+" \\u2014 press to change";',
  ' b.setAttribute("aria-label",b.title);',
  ' var want=(U14SCOPE==="all"?"All mailboxes":"This folder")+" \\u25be";',
  ' if(b.textContent!==want)b.textContent=want;',
  ' return b}',
  'function u14setScope(v){if(U14SCOPE===v){u14scopeSync();return}U14SCOPE=v;u14scopeSync();try{render()}catch(e){}}',
  'if(typeof listRows==="function"){',
  ' const _lr14=listRows;',
  ' listRows=function(){var r=_lr14.apply(this,arguments);',
  '  try{if(U14SCOPE==="folder"&&u14hasQ())return r.filter(function(t){try{return inView(t)}catch(e){return true}})}catch(e){}',
  '  return r}}',
  'if(typeof listKey==="function"){const _lk14=listKey;listKey=function(){return _lk14.apply(this,arguments)+"|u14:"+U14SCOPE}}',
  '',
  '/* ---------------- 2 - the phone menu (text size + full screen) + tooltips ---------------- */',
  'function u14hdrExtras(){',
  ' var tb=document.querySelector("header.top .tb"),bell=document.getElementById("bell");',
  ' if(tb&&bell&&!document.getElementById("hdrMore")){',
  '  var b=document.createElement("button");b.type="button";b.id="hdrMore";b.className="ib";',
  '  b.title="More \\u2014 text size and full screen";b.setAttribute("aria-label",b.title);',
  '  b.setAttribute("aria-haspopup","menu");b.textContent="\\u22ef";',
  '  tb.insertBefore(b,bell);',
  '  b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();',
  '   var hit=function(id){var x=document.getElementById(id);if(x)x.click()};',
  '   var zr=document.getElementById("zReset");',
  '   u14menu(b,[{h:"Text size"},',
  '    {t:"A\\u2212  Smaller",fn:function(){hit("zOut")}},',
  '    {t:(zr?zr.textContent:"100%")+"  Reset size",fn:function(){hit("zReset")}},',
  '    {t:"A+  Bigger",fn:function(){hit("zIn")}},',
  '    {h:"View"},{t:"\\u2922  Full screen",fn:function(){hit("fsBtn")}}])})}',
  ' var bl=document.getElementById("bell");if(bl&&!bl.title)bl.title="Notifications";',
  ' var me=document.getElementById("meBtn");if(me&&!me.title)me.title="Your account \\u2014 settings, theme, sign out";',
  ' try{u14scopeSync()}catch(e){}}',
  'u14hdrExtras();setTimeout(u14hdrExtras,1500);setTimeout(u14hdrExtras,5000);',
  'if(typeof render==="function"){const _rd14=render;render=function(){var r=_rd14.apply(this,arguments);try{u14scopeSync()}catch(e){}return r}}',
  '',
  '/* ---------------- 3 - the footer line ---------------- */',
  'if(typeof stbarPaint==="function"){',
  ' const _sb14=stbarPaint;',
  ' stbarPaint=function(){var r=_sb14.apply(this,arguments);',
  '  try{',
  '   var el=document.getElementById("statusbar");if(!el||el.hidden)return r;',
  '   var T=el.querySelector("#stT");if(!T)return r;',
  '   var s=String(T.textContent||"");',
  '   if(!navigator.onLine)s="Not connected \\u00b7 Rugs Email will catch up when the internet is back";',
  '   else{s=s.replace(" \\u00b7 checked "," \\u00b7 ");if(!/^Connected/.test(s))s="Connected \\u00b7 "+s}',
  '   if(T.textContent!==s)T.textContent=s;',
  '   el.title=s;',
  '  }catch(e){}',
  '  return r};',
  ' try{stbarPaint()}catch(e){}}',
  '/* __ui14:end */<' + '/script>',
  ''
].join('\n');

s = s.replace(/\s*$/, '\n') + BLOCK;
console.log('ok  ui14 block appended at the end of the file');
fs.writeFileSync(F, s);
console.log('done: ' + n0 + ' -> ' + s.length + ' chars');
