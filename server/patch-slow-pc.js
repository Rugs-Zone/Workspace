/* 19 Nov 2026 — "Rugs Email is slow / does not load on some PCs (old i3 5th gen), fine on fast ones".
   Logs showed Chrome and Edge equally slow, so it is not the browser. Old PCs (2 cores / 4 threads,
   about 4 GB RAM) simply have less power for the same work. Slow-PC mode makes the app do less at once
   on those PCs only. Fast PCs keep working exactly as before. Nothing changes in features, rules or data.
     - detection: navigator.hardwareConcurrency <= 4 or navigator.deviceMemory <= 4  ->  window.SLOW_PC
       (manual override for testing: localStorage 'rugs-slowpc' = '1' forces on, '0' forces off)
     - new-mail check every 30 s instead of 15 s
     - sign-in preload: 10 conversations / 20 pictures, 2 at a time (was 25 / 80, 3 at a time)
     - the list draws 60 rows at a time (was 150); "scroll for more" works as before
     - the copy kept on the device is saved 20 s after a change (was 4 s), when the PC is idle
     - no blur and no hover/fade transitions (old graphics chips stutter on them)
   Run:  node server/mailapp-b64.js decode  &&  node server/patch-slow-pc.js  &&  node server/mailapp-b64.js encode
*/
const fs = require('fs');
const F = '.tmp/email.html';
let s = fs.readFileSync(F, 'utf8'), n = 0;
function edit(name, old, nw) {
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error('FAILED: ' + name + ' found ' + c + ' times'); process.exit(1); }
  s = s.replace(old, () => nw); n++; console.log('ok  ' + name);
}

edit('detect slow PC', '<title>Rugs Email</title>',
  '<title>Rugs Email</title><script>/* 19 Nov 2026: slow-PC mode (server/patch-slow-pc.js) */(function(){var o=null;try{o=localStorage.getItem("rugs-slowpc")}catch(e){}' +
  'var hc=navigator.hardwareConcurrency||8,dm=navigator.deviceMemory||8;window.SLOW_PC=o==="1"?true:o==="0"?false:(hc<=4||dm<=4);' +
  'if(window.SLOW_PC){document.documentElement.classList.add("slowpc");var st=document.createElement("style");' +
  'st.textContent=".slowpc *,.slowpc *::before,.slowpc *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition-duration:0s!important}";' +
  'document.head.appendChild(st)}})();</script>');

edit('new-mail check 30 s on slow PCs', 'pollT=setInterval(poll,15000)',
  'pollT=setInterval(poll,window.SLOW_PC?30000:15000)');

edit('smaller sign-in preload on slow PCs',
  'const PRELOAD_MAX_MS=15000,PRELOAD_N=25,PRELOAD_PAR=3,PRELOAD_PICS=80;',
  'const PRELOAD_MAX_MS=15000,PRELOAD_N=window.SLOW_PC?10:25,PRELOAD_PAR=window.SLOW_PC?2:3,PRELOAD_PICS=window.SLOW_PC?20:80;');

edit('device copy saved later, when idle',
  'function idbSaveSoon(){clearTimeout(_iT);_iT=setTimeout(idbSave,4000)}',
  'function idbSaveSoon(){clearTimeout(_iT);_iT=setTimeout(()=>{const ric=window.requestIdleCallback;if(window.SLOW_PC&&ric)ric(()=>idbSave(),{timeout:5000});else idbSave()},window.SLOW_PC?20000:4000)}');

edit('60 rows at a time on slow PCs', 'const LIST_PAGE=150;', 'const LIST_PAGE=window.SLOW_PC?60:150;');

edit('APP_BUILD', "const APP_BUILD='2026-11-18-6';", "const APP_BUILD='2026-11-19-1';");

fs.writeFileSync(F, s);
console.log(n + ' edits');
